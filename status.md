# Project Status

Last updated: 2026-08-23

## Overview

Healthcare Appointment & Follow-up Manager — a clinic platform with separate patient, doctor, and admin
portals. Backend: Node.js/Express/Prisma/PostgreSQL. Frontend: React/Vite, restyled to a light
"Modernist" design system (flat, zero-radius, mono-red-on-light, Archivo typeface). Built incrementally
against a 19-step backend/full-stack plan, then a separate frontend restyle plan; all of it is implemented
and individually verified against a live local database.

## Repository state

- Branch: `main`
- Working tree: clean, no uncommitted changes
- Latest commit: `UI Overhaul` (the full frontend design-system replacement)
- Node modules, `.env`, build artifacts, and editor folders are gitignored and not tracked
- Source comments are stripped repo-wide per submission guidelines; `docs/` prose is unaffected

## What is built and working

### Backend

- Auth: patient self-registration, login, JWT + role-based middleware (PATIENT / DOCTOR / ADMIN).
  Doctor and admin accounts are admin-created only. Rate limiting on login/register.
- Admin: doctor profile CRUD (including `PATCH` edit, now with a real UI), leave-day management with
  automatic cancellation of affected bookings and patient notification, all-appointments overview.
- Availability engine: derives bookable slots from working hours, slot duration, leave days, and existing
  bookings/holds.
- Booking flow: slot hold (5-minute TTL) then confirm, with a DB-level partial unique index as the real
  double-booking guard. Verified safe under real concurrent requests (both hold-vs-hold and
  confirm-vs-confirm races tested).
- Doctor leave conflict handling: transactional leave-marking that invalidates holds, cancels affected
  bookings, and queues patient notifications.
- Email notifications: booking confirmation, cancellation, leave notice, appointment reminder, medication
  reminder. Logged before send, retried with exponential backoff on failure, never blocks the request that
  triggered them. Plain text only — no HTML templates exist yet (see Outstanding below).
- Background jobs (node-cron, in-process): slot-hold cleanup, notification retry sweep, medication
  reminder dispatch, appointment reminder dispatch.
- LLM integration (Azure OpenAI): pre-visit summary (urgency, chief complaint, suggested questions) and
  post-visit summary (patient-friendly text, follow-up steps). Every failure mode falls back to safe
  default content rather than breaking the request. `maxRetries` raised 0→2 to absorb transient
  connection failures. A doctor can manually regenerate either summary if it came back as fallback —
  `POST /api/doctor/appointments/:id/regenerate-pre-visit-summary` and the symmetric
  `regenerate-post-visit-summary` (added once the frontend needed parity between the two).
- Post-visit flow: doctor submits clinical notes and prescriptions; appointment marked completed;
  medication reminders scheduled from each prescription's frequency (heuristic parser).
- Google Calendar integration: OAuth 2.0 connect flow per doctor, event created/deleted on
  booking/cancellation, patient added as an email attendee. Degrades gracefully when not connected or not
  configured. Now has a real UI entry point (`/doctor/calendar`) — previously API-only.
- Cross-cutting hardening: centralized error handling, Zod validation on all mutating endpoints, CORS
  restricted to the configured frontend origin, baseline security headers, trust proxy enabled.

### Frontend

- Design system: full token sheet (`index.css`) and component layer (`ui.css` + `components/ui/`:
  `Button`, `Tag`, `Card`, `Field`, `LoadingState`/`EmptyState`/`ErrorState`, `AiStatusBanner`) — flat,
  zero border-radius, single accent color (red) used sparingly, Archivo typeface, ruled-grid layout
  instead of card-with-shadow. This superseded an earlier dark "Swiss minimal" theme built against
  `userstyle.md`, which is no longer in effect.
- Patient portal: registration, doctor search, booking (date strip, live 5-minute hold countdown,
  severity segmented control), an appointments table linking to a dedicated appointment detail page
  (post-visit AI summary, prescriptions, follow-up steps).
- Doctor portal: schedule (ruled rows with an urgency spine + stat row), appointment detail (AI pre-visit
  summary in an accent banner, post-visit notes + grid prescription editor, manual regenerate action on
  both AI summaries when they're a fallback), and a Google Calendar connect page.
- Admin portal: doctor CRUD including edit, a leave-day manager with an inline conflict warning (replacing
  a blocking `alert()`), and an all-appointments overview with a status filter and summary stats.
- Auto-refresh: list/detail pages poll every 25s (and on tab focus) so state doesn't go stale if something
  changes elsewhere (e.g. an admin-triggered leave cancellation while a patient has the page open).

### Documentation

- `docs/system-design.md` — required write-up (double-booking prevention, leave conflict handling, slot
  hold mechanism, notification failure handling), under the 800-word cap.
- `docs/db-schema.md`, `docs/api-docs.md`, `docs/llm-prompts.md`, `docs/google-calendar-setup.md`.
- `README.md` — setup guide, environment variables, first-login walkthrough with test credentials for all
  three roles, known scope limitations.
- `fe_implement.md` — the (now largely superseded) staged frontend implementation plan used for the
  first restyle pass; kept for history.

## Verified end-to-end (against real local Postgres, not mocked)

- Full booking lifecycle: hold, confirm, cancel, slot reopening after cancellation.
- Concurrent double-booking attempts correctly resolve to exactly one success.
- Doctor leave marking correctly cancels affected bookings and queues notifications.
- Email delivery and graceful failure/retry, tested against both a working SMTP account and deliberately
  broken credentials.
- LLM pre-visit and post-visit summaries, tested against both the fallback path and a real Azure OpenAI
  endpoint; manual regeneration of a fallback summary into real content confirmed for both summary types.
- Prescription data flowing from doctor submission through to the patient's appointment view.
- The full frontend restyle: production build and `oxlint` both pass clean; every changed page confirmed
  served without import/resolution errors; the data layer re-verified live against the backend after the
  restyle (login, appointment list, etc. all still round-trip correctly).

## Known issues and limitations

- Azure OpenAI connectivity has been intermittent from the development machine (DNS/connection errors
  observed alongside successful calls). The application handles this correctly (retries, then falls back
  to labeled placeholder content with a manual regenerate option), but summary quality depends on that
  connectivity being stable at request time.
- No dedicated reschedule endpoint. Reschedule is cancel-then-rebook, which is functionally correct.
- Medication reminder timing is a simple heuristic (fixed daily clock-times or a fixed hourly interval
  parsed from free-text frequency), not a full scheduling grammar.
- The auth rate limiter is in-memory and single-process; correct for the current deployment target, not
  suitable as-is for a horizontally scaled deployment.
- `frontend/.env` is not present on the local machine; the app falls back to the correct default
  (`http://localhost:4000`) so this has not caused an issue, but it should be created from
  `frontend/.env.example` for explicitness.
- Google Calendar integration has a real UI entry point now, but has not been exercised through a complete
  real OAuth consent flow with a live Google account (no test credentials available in this environment).
- No automated test suite (unit or integration). All verification so far has been manual, targeted testing
  against the running application and live database.
- Several data points the current frontend design describes are not exposed by any existing API endpoint
  and were substituted with computable alternatives rather than adding new backend surface: per-doctor
  "next free slot" and working hours on the search page, a live "calendar sync" stat on the doctor
  schedule, and "active holds" / "email retry" counts plus per-row notification/calendar status on the
  admin appointments page.

## Not yet done

- Deployment (hosting the backend, database, and frontend on a public URL). The user is handling this
  step themselves.
- Final production environment variables (JWT secret, SMTP credentials, stable Azure OpenAI endpoint,
  Google OAuth redirect URI) have not been set for a deployed environment.
- A dedicated "booking confirmation" screen described in the latest frontend design spec was not built
  (the spec offered it as optional, deferred).
- HTML email templates — the backend currently sends plain-text-only emails; restyling to HTML per the
  latest design spec would mean adding new backend capability (not just visual changes), so it's on hold
  pending a decision on how to scope that.
