# Project Status

Last updated: 2026-08-24

## Overview

Healthcare Appointment & Follow-up Manager: a clinic platform with separate patient, doctor, and admin
portals. Backend: Node.js, Express, Prisma, PostgreSQL. Frontend: React, Vite, styled with a light
"Modernist" design system (flat, zero-radius, red accent on light background, Archivo typeface). The
application is deployed and live: frontend, backend, and PostgreSQL are all hosted on Render.

## Deployment

- Frontend: `https://unthinkable-health-assignment-1.onrender.com`
- Backend: `https://unthinkable-health-assignment.onrender.com`
- Database: Render PostgreSQL (free tier)
- All three services are wired together (CORS, `VITE_API_BASE_URL`, `FRONTEND_URL`) and confirmed
  working end to end in production, including Google Calendar OAuth and the booking flow.

## Repository state

- Branch: `main`
- Node modules, `.env`, build artifacts, and editor folders are gitignored and not tracked
- `host.md` and `emailplan.md` are also gitignored: internal working notes for deployment and the email
  integration, not part of the submitted deliverables
- Source comments are stripped repo-wide per submission guidelines; `docs/` prose is unaffected

## What is built and working

### Backend

- Auth: patient self-registration, login, JWT with role-based middleware (PATIENT, DOCTOR, ADMIN).
  Doctor and admin accounts are admin-created only. Rate limiting on login/register.
- Admin: doctor profile CRUD (including edit), leave-day management with automatic cancellation of
  affected bookings and patient notification, all-appointments overview.
- Availability engine: derives bookable slots from working hours, slot duration, leave days, and
  existing bookings/holds.
- Booking flow: slot hold (5-minute TTL) then confirm, with a DB-level partial unique index as the real
  double-booking guard. Verified safe under real concurrent requests (both hold-vs-hold and
  confirm-vs-confirm races tested).
- Doctor leave conflict handling: transactional leave-marking that invalidates holds, cancels affected
  bookings, and queues patient notifications.
- Email notifications, sent via Resend's HTTP API (`docs/email-setup.md`): account creation, booking
  confirmation (patient), a separate new-booking notice to the doctor (patient contact info, symptoms,
  and the AI pre-visit summary), post-visit summary, cancellation, leave notice, appointment reminder,
  medication reminder. Each type has a plain-text and an inline-styled HTML version. Every send is logged
  before it's attempted and retried with exponential backoff on failure; nothing in the app ever blocks
  or fails on the email step. Currently configured against Resend's shared `onboarding@resend.dev`
  sender, which restricts real delivery to the Resend account's own registered email address; see the
  Limitation section in `docs/email-setup.md`.
- Background jobs (node-cron, in-process): slot-hold cleanup, notification retry sweep, medication
  reminder dispatch, appointment reminder dispatch.
- LLM integration (Azure OpenAI): pre-visit summary (urgency, chief complaint, suggested questions) and
  post-visit summary (patient-friendly text, medication schedule, follow-up steps). Every failure mode
  falls back to safe default content rather than breaking the request. Prompts are hardened against
  injection (delimited, escaped patient/doctor input, explicit "treat as data" instruction) and capped so
  total prompt input stays around 400 tokens per call. A doctor can manually regenerate either summary if
  it came back as fallback.
- Post-visit flow: doctor submits clinical notes and prescriptions; appointment marked completed;
  medication reminders scheduled from each prescription's frequency (heuristic parser).
- Google Calendar integration: OAuth 2.0 connect flow per doctor, event created/deleted on
  booking/cancellation, patient added as an email attendee. Degrades gracefully when not connected or not
  configured. Fully working in production, including the SPA rewrite rule and OAuth consent screen test
  users needed to complete the flow on Render.
- Cross-cutting hardening: centralized error handling, Zod validation on all mutating endpoints, CORS
  restricted to the configured frontend origin, baseline security headers, trust proxy enabled.

### Frontend

- Design system: full token sheet (`index.css`) and component layer (`ui.css` plus `components/ui/`:
  `Button`, `Tag`, `Card`, `Field`, `LoadingState`/`EmptyState`/`ErrorState`, `AiStatusBanner`), flat,
  zero border-radius, single accent color (red) used sparingly, Archivo typeface, ruled-grid layout
  instead of card-with-shadow.
- Login page: includes a visible "Demo credentials" box listing the seeded admin and example
  doctor/patient logins, pulled from the same table as `README.md`.
- Patient portal: registration, doctor search, booking (date strip, live 5-minute hold countdown,
  severity segmented control), an appointments table linking to a dedicated appointment detail page
  (post-visit AI summary, prescriptions, follow-up steps).
- Doctor portal: schedule (ruled rows with an urgency spine and stat row), appointment detail (AI
  pre-visit summary in an accent banner, post-visit notes plus a grid prescription editor, manual
  regenerate action on both AI summaries when they're a fallback), and a working Google Calendar connect
  page.
- Admin portal: doctor CRUD including edit, a leave-day manager with an inline conflict warning
  (replacing a blocking `alert()`), and an all-appointments overview with a status filter and summary
  stats.
- Auto-refresh: list/detail pages poll every 25s (and on tab focus) so state doesn't go stale if
  something changes elsewhere (for example, an admin-triggered leave cancellation while a patient has the
  page open).

### Documentation

- `docs/system-design.md`: required write-up (double-booking prevention, leave conflict handling, slot
  hold mechanism, notification failure handling), under the 800-word cap.
- `docs/db-schema.md`, `docs/api-docs.md`, `docs/llm-prompts.md`, `docs/google-calendar-setup.md`,
  `docs/email-setup.md`.
- `README.md`: setup guide, environment variables, first-login walkthrough with test credentials for all
  three roles, inline overviews of the API/schema/LLM/calendar/email subsystems, known scope limitations.

## Verified end to end (against real local Postgres and the deployed Render backend)

- Full booking lifecycle: hold, confirm, cancel, slot reopening after cancellation.
- Concurrent double-booking attempts correctly resolve to exactly one success.
- Doctor leave marking correctly cancels affected bookings and queues notifications.
- Full email pipeline: account creation, booking confirmation and doctor notification (including the AI
  summary), and post-visit summary all correctly queue and attempt delivery through Resend, with clean
  `FAILED` logging (not crashes) when credentials or recipient restrictions block a send.
- LLM pre-visit and post-visit summaries, tested against both the fallback path and a real Azure OpenAI
  endpoint; manual regeneration of a fallback summary into real content confirmed for both summary types.
- Prescription data flowing from doctor submission through to the patient's appointment view.
- Google Calendar OAuth connect flow completed end to end in production, including consent, callback
  redirect, and calendar event creation on booking.
- The frontend design system: production build passes clean; every page confirmed served without
  import/resolution errors.

## Known issues and limitations

- The "View" button on `/patient/my-appointments` was reported to redirect to `/login` in some cases.
  Diagnostic logging was added to `ProtectedRoute.jsx`, `api/client.js`, and `App.jsx`'s wildcard route to
  capture the failure the next time it's reproduced; that logging is still in place and the root cause is
  still unconfirmed. This should be revisited: reproduce with the browser console open, read the logged
  reason, then remove the diagnostic logging once fixed.
- Email delivery is currently restricted to the Resend account's own registered address (shared
  `onboarding@resend.dev` sender, no verified domain). See `docs/email-setup.md` for what this affects
  and how to lift it.
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
- No automated test suite (unit or integration). All verification so far has been manual, targeted
  testing against the running application and live database.
- Render's free-tier gotchas apply: the backend Web Service spins down after inactivity (first request
  after idle is slow, not broken), and the free Postgres instance is time-limited.
