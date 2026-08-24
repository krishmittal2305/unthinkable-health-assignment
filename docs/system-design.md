# System Design Write-up

## Slot hold mechanism

Booking is a two-step flow, not a single insert. When a patient picks a slot, the backend calls
`POST /api/appointments/hold`, which first re-validates the slot against the availability engine
(working hours, slot-duration grid, leave days, already-taken slots) and then inserts a `SlotHold`
row with a 5-minute `expiresAt`. The patient fills the symptom form against that hold, then
`POST /api/appointments/confirm` runs one Prisma transaction that re-checks the hold hasn't expired,
re-checks the doctor hasn't just gone on leave, creates the `Appointment` + `SymptomForm`, and deletes
the hold. `SlotHold(doctorId, slotStart)` has a full DB unique constraint, so a slot can only ever be
held by one patient at a time, a second hold attempt on the same slot fails atomically. Expired holds
are cleaned up opportunistically (whenever another patient tries that exact slot) and reliably by a
per-minute cron sweep, so a patient who abandons the flow doesn't block the slot for 5 minutes' worth
of other patients unnecessarily long.

## Double-booking prevention

The hold mechanism above handles the *common* case, but the real guarantee against double-booking is a
**partial unique index** at the database level: `UNIQUE (doctorId, slotStart) WHERE status IN ('BOOKED',
'COMPLETED')` on `Appointment`. This was deliberately not a plain `@@unique` in Prisma's schema, a plain
constraint would mean a *cancelled* appointment's row still occupies that key forever, permanently
blocking the slot from ever being rebooked. The partial index only enforces uniqueness among rows that
actually occupy the slot, so cancelling immediately frees it. Two concurrent `confirm` requests
(e.g. two browser tabs, or a hold that a second request races against) will both attempt to insert an
`Appointment` for the same `(doctorId, slotStart)`; Postgres serializes that at the index level, one
insert succeeds and the other raises a `unique_violation`, which `appointmentService` catches and turns
into a clean `409 Conflict` rather than a crash or a silent double-booking. This was verified under real
concurrency, not just in theory: firing two simultaneous hold requests for an identical slot from two
different patients, and separately two simultaneous confirm requests against the same hold, both
resulted in exactly one success and one clean 409.

## Doctor leave conflict handling

When an admin marks a doctor on leave for a date, `leaveService.markDoctorOnLeave` runs a single
transaction that: creates the `LeaveDay` row; deletes any in-flight `SlotHold`s for that day (nothing
valid to confirm on a day the doctor won't be there); finds every `BOOKED` appointment on that day and
moves it to `CANCELLED_BY_LEAVE`; and queues a `LEAVE_NOTICE` notification per affected patient. Because
all of this happens in one transaction, there's no window where the leave day exists but a stale hold or
a not-yet-cancelled appointment survives. `confirmBooking` also re-checks for a leave day immediately
before inserting the appointment, closing the narrow remaining race where a hold was created moments
before leave was marked. The admin UI surfaces how many appointments were just cancelled so the
action's blast radius is visible immediately, not discovered later.

## Notification failure handling

Every outbound notification, account creation, booking confirmation, a separate new-booking notice to
the doctor, post-visit summary, cancellation, leave notice, and appointment/medication reminders, is
first written to a `NotificationLog` row with `status: PENDING`, so the intent to notify is durable
before any network call happens (inside the same transaction as the triggering state change where that
matters, e.g. leave cancellations). Actual delivery is decoupled: a best-effort attempt fires immediately
after the triggering request completes (fire-and-forget, so a slow or failing email API never delays or
breaks the booking/cancellation response), and a cron job sweeps `PENDING`/`FAILED` rows every 2 minutes
as the reliable fallback. Failed sends retry with exponential backoff (1/2/4/8/16 minutes) up to 5
attempts, recording the real error each time, so a transient outage self-heals without spamming retries
or silently dropping the notification.

Email itself is sent via Resend's HTTP API rather than SMTP: Render's free Web Services block outbound
SMTP ports entirely, so an SMTP-based mailer cannot reach any provider once deployed there. Resend's API
runs over HTTPS, which isn't blocked, and the `sendMail` interface stayed identical when swapping
transports, so the retry/logging layer above needed no changes.

This was verified by deliberately breaking the email API credentials mid-session: bookings and
cancellations still returned success, and the failed notifications were correctly logged with their retry
count and error rather than crashing anything.

The same "log the intent, then best-effort deliver, never let it block the caller" pattern is reused for
the LLM summaries (bounded timeout, labeled fallback on any failure) and Google Calendar sync
(missing/revoked doctor tokens simply skip the calendar step), a deliberate consistency across every
external dependency, so failure in any one degrades that feature only, never the core booking flow.
