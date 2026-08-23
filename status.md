# Project Status

Last updated: 2026-08-23

## Overview

Healthcare Appointment & Follow-up Manager — a clinic platform with separate patient, doctor, and admin
portals. Backend: Node.js/Express/Prisma/PostgreSQL. Frontend: React/Vite. Built incrementally against a
19-step plan; all 19 steps are implemented and individually verified against a live local database.

## Repository state

- Branch: `main`
- Working tree: clean, no uncommitted changes
- Node modules, `.env`, build artifacts, and editor folders are gitignored and not tracked
- Source comments have been stripped repo-wide per submission guidelines; `docs/` prose is unaffected

## What is built and working

### Backend

- Auth: patient self-registration, login, JWT + role-based middleware (PATIENT / DOCTOR / ADMIN).
  Doctor and admin accounts are admin-created only. Rate limiting on login/register.
- Admin: doctor profile CRUD, leave-day management with automatic cancellation of affected bookings and
  patient notification, all-appointments overview.
- Availability engine: derives bookable slots from working hours, slot duration, leave days, and existing
  bookings/holds.
- Booking flow: slot hold (5-minute TTL) then confirm, with a DB-level partial unique index as the real
  double-booking guard. Verified safe under real concurrent requests (both hold-vs-hold and
  confirm-vs-confirm races tested).
- Doctor leave conflict handling: transactional leave-marking that invalidates holds, cancels affected
  bookings, and queues patient notifications.
- Email notifications: booking confirmation, cancellation, leave notice, appointment reminder, medication
  reminder. Logged before send, retried with exponential backoff on failure, never blocks the request that
  triggered them.
- Background jobs (node-cron, in-process): slot-hold cleanup, notification retry sweep, medication
  reminder dispatch, appointment reminder dispatch.
- LLM integration (Azure OpenAI): pre-visit summary (urgency, chief complaint, suggested questions) and
  post-visit summary (patient-friendly text, follow-up steps). Every failure mode falls back to safe
  default content rather than breaking the request; a doctor can manually trigger regeneration if a
  summary came back as fallback.
- Post-visit flow: doctor submits clinical notes and prescriptions; appointment marked completed;
  medication reminders scheduled from each prescription's frequency (heuristic parser).
- Google Calendar integration: OAuth 2.0 connect flow per doctor, event created/deleted on
  booking/cancellation, patient added as an email attendee. Degrades gracefully when not connected or not
  configured.
- Cross-cutting hardening: centralized error handling, Zod validation on all mutating endpoints, CORS
  restricted to the configured frontend origin, baseline security headers, trust proxy enabled.

### Frontend

- Patient portal: registration, doctor search, booking (hold, symptom form, confirm), appointment list
  showing status, pre-visit AI summary, post-visit AI summary, prescriptions (fetched directly from the
  database, not LLM-derived), and cancellation.
- Doctor portal: schedule list with urgency-coded rows, appointment detail with AI pre-visit summary,
  post-visit notes and dynamic prescription entry form, manual "regenerate AI summary" action when a
  summary is a fallback.
- Admin portal: doctor CRUD, leave-day management UI, all-appointments overview with status filter.

### Documentation

- `docs/system-design.md` — required write-up (double-booking prevention, leave conflict handling, slot
  hold mechanism, notification failure handling), under the 800-word cap.
- `docs/db-schema.md`, `docs/api-docs.md`, `docs/llm-prompts.md`, `docs/google-calendar-setup.md`.
- `README.md` — setup guide, environment variables, first-login walkthrough with test credentials for all
  three roles, known scope limitations.

## Verified end-to-end (against real local Postgres, not mocked)

- Full booking lifecycle: hold, confirm, cancel, slot reopening after cancellation.
- Concurrent double-booking attempts correctly resolve to exactly one success.
- Doctor leave marking correctly cancels affected bookings and queues notifications.
- Email delivery and graceful failure/retry, tested against both a working SMTP account and deliberately
  broken credentials.
- LLM pre-visit and post-visit summaries, tested against both the fallback path (no/broken credentials)
  and a real Azure OpenAI endpoint (once reachable).
- Manual summary regeneration endpoint, confirmed to update the existing record rather than duplicate it.
- Prescription data flowing from doctor submission through to the patient's appointment view.

## Known issues and limitations

- Azure OpenAI connectivity has been intermittent from the development machine (DNS/connection errors
  observed alongside successful calls). The application handles this correctly (retries, then falls back
  to labeled placeholder content, never breaks the request), but summary quality depends on that
  connectivity being stable at request time.
- No dedicated reschedule endpoint. Reschedule is cancel-then-rebook, which is functionally correct
  (frees the old slot, syncs the calendar) but is a different flow than an in-place reschedule.
- Medication reminder timing is a simple heuristic (fixed daily clock-times or a fixed hourly interval
  parsed from free-text frequency), not a full scheduling grammar.
- The auth rate limiter is in-memory and single-process; correct for the current deployment target, not
  suitable as-is for a horizontally scaled deployment.
- `frontend/.env` is not present on the local machine; the app falls back to the correct default
  (`http://localhost:4000`) so this has not caused an issue, but it should be created from
  `frontend/.env.example` for explicitness.
- Google Calendar integration has been verified for its graceful-degradation behavior and OAuth URL/state
  construction, but not yet exercised through a complete real OAuth consent flow with a live Google
  account.
- No automated test suite (unit or integration). All verification so far has been manual, targeted testing
  against the running application and live database.

## Not yet done

- Deployment (hosting the backend, database, and frontend on a public URL). The user is handling this
  step themselves.
- Final production environment variables (JWT secret, SMTP credentials, stable Azure OpenAI endpoint,
  Google OAuth redirect URI) have not been set for a deployed environment.
