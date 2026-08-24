# Healthcare Appointment & Follow-up Manager

A clinic appointment platform with separate portals for patients, doctors, and admins — booking with
double-booking prevention, AI-generated pre-visit and post-visit summaries (Azure OpenAI), email
notifications, and Google Calendar sync.

## Deployment Link: https://unthinkable-health-assignment-1.onrender.com/login
## Stack

- **Backend:** Node.js, Express, JavaScript, Prisma ORM, PostgreSQL
- **Frontend:** React, Vite, JavaScript
- **LLM:** Azure OpenAI (pre-visit and post-visit summaries)
- **Email:** Resend (transactional email HTTP API)
- **Calendar:** Google Calendar API v3 (OAuth 2.0)
- **Background jobs:** node-cron

## Project structure

```
/backend    Express API, Prisma schema/migrations, background jobs, LLM/email/calendar services
/frontend   React + Vite app (patient, doctor, admin portals)
/docs       Documentation (see below)
```

## Documentation

- [docs/system-design.md](docs/system-design.md) — double-booking prevention, leave conflict handling,
  slot hold mechanism, notification failure handling (required write-up, ≤800 words)
- [docs/db-schema.md](docs/db-schema.md) — database schema, model-by-model
- [docs/api-docs.md](docs/api-docs.md) — every API endpoint, method, auth, body shape
- [docs/llm-prompts.md](docs/llm-prompts.md) — exact LLM prompts and fallback behavior
- [docs/google-calendar-setup.md](docs/google-calendar-setup.md) — Google Cloud / OAuth setup steps

## Setup

### 1. Database (PostgreSQL)

Install PostgreSQL locally (or use any hosted Postgres — Neon/Supabase/Render all have free tiers) and
create a database, e.g.:

```sql
CREATE DATABASE healthcare_appointments;
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:
- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — any long random string
- `AZURE_OPENAI_*` — optional; without these, pre/post-visit summaries fall back to safe default text
  instead of failing (see `docs/llm-prompts.md`)
- `RESEND_API_KEY` / `EMAIL_FROM` — optional; without these, emails are logged as `FAILED` in
  `NotificationLog` and retried, but nothing crashes (see **Email service** below)
- `GOOGLE_*` — optional; see `docs/google-calendar-setup.md`. Without these, calendar sync is skipped
- `FRONTEND_URL` — used for CORS and for redirect targets (Google OAuth callback, etc.)

Then:

```bash
npm run prisma:migrate   # applies backend/prisma/migrations
npm run prisma:seed      # creates the initial admin account (see SEED_ADMIN_EMAIL/PASSWORD in .env.example)
npm run dev               # http://localhost:4000/health
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_BASE_URL, defaults to http://localhost:4000
npm run dev                # http://localhost:5173
```

### 4. First login

The seed script creates one admin account (override via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` before
seeding). Doctor and patient accounts aren't seeded — an admin creates doctors, and patients self-register
— but for quick testing you can use (or recreate) these:

| Role    | Email                    | Password       | Notes |
|---------|--------------------------|----------------|-------|
| Admin   | `admin@clinic.test`      | `ChangeMe123!` | Created by `npm run prisma:seed` |
| Doctor  | `dr.ashish@clinic.com`  | `password123`  | Example: Cardiology, Mon/Tue 09:00–17:00 UTC — create via the admin **Doctors** tab |
| Patient | `daksh@fake.com`      | `daksh123`  | Create via `/register` |

Log in at `/login`:

- **Admin** → `/admin/doctors`: create doctor accounts (specialisation, working hours, slot duration),
  manage leave days, view all appointments at `/admin/appointments`.
- **Doctor** → `/doctor`: created by admin, not self-registered. View schedule, see AI pre-visit
  summaries, submit post-visit notes + prescriptions.
- **Patient** → `/patient`: self-register at `/register`. Search doctors, book a slot, fill a symptom
  form, view appointments, AI summaries, and prescriptions.

## Background jobs

`npm run dev`/`npm start` also starts an in-process `node-cron` scheduler (`backend/src/jobs/scheduler.js`):
slot-hold cleanup (1 min), notification retry sweep (2 min, exponential backoff), medication reminder
dispatch (5 min), appointment reminder dispatch (15 min). No separate worker process needed.

## API overview

Full detail (every endpoint, auth requirement, body shape) is in
[docs/api-docs.md](docs/api-docs.md). Summary of the route groups:

| Group | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | Register (patient self-signup), login, `/me`, admin-only user creation for doctor/admin accounts |
| Admin: doctor management | `/api/admin/doctors` | Create/update/delete doctors, mark/unmark leave days |
| Public doctor search | `/api/doctors` | Search by specialisation, view availability — no auth |
| Appointments (patient) | `/api/appointments` | Hold → confirm booking flow, list own appointments, cancel |
| Doctor appointments | `/api/doctor/appointments` | Schedule, appointment detail, submit post-visit notes + prescriptions, regenerate AI summaries |
| Google Calendar | `/api/doctor/calendar` | OAuth connect + callback |
| Admin: appointments overview | `/api/admin/appointments` | Every appointment in the system |
| Misc | `/health` | Health check |

## Database schema

Full detail (every model, field-by-field) is in [docs/db-schema.md](docs/db-schema.md). PostgreSQL via
Prisma, organized around:

- **Identity** — `User` (single table for all three roles), `DoctorProfile`, `LeaveDay`
- **Booking** — `SlotHold` (5-min claim before a real booking exists), `Appointment` — double-booking is
  prevented by a partial unique index on `(doctorId, slotStart)` scoped to active statuses, not a plain
  Prisma `@@unique`, so a cancelled slot frees up immediately instead of staying permanently blocked
- **Pre-visit** — `SymptomForm`, `PreVisitSummary` (AI-generated, with an `isFallback` flag)
- **Post-visit** — `PostVisitNote`, `Prescription`, `MedicationReminder`, `PostVisitSummary`
- **Notifications & Calendar** — `NotificationLog` (every outbound email logged before it's attempted),
  `GoogleCalendarToken`, `CalendarEvent`

## LLM integration

Full detail (exact prompts, validation, fallback contract) is in
[docs/llm-prompts.md](docs/llm-prompts.md). Azure OpenAI generates two summaries, both requesting strict
JSON output and both wrapped so a failure (missing credentials, timeout, malformed response) **never**
breaks the underlying booking/post-visit flow — it substitutes a clearly labeled (`isFallback: true`)
default instead:

- **Pre-visit summary** — generated right after a booking is confirmed, from the patient's reported
  symptoms: urgency level, chief complaint, three suggested questions for the doctor.
- **Post-visit summary** — generated after the doctor submits clinical notes: a patient-friendly summary,
  medication schedule, and follow-up steps.

Both prompts wrap the patient/doctor-supplied free text in delimiters with an explicit
"treat as data, not instructions" boundary (prompt-injection mitigation) and cap input length so total
prompt tokens stay around ~400 per call.

## Google Calendar integration

Full setup walkthrough (Google Cloud project, OAuth consent screen, credentials) is in
[docs/google-calendar-setup.md](docs/google-calendar-setup.md). Only doctors connect via OAuth 2.0
(`GET /api/doctor/calendar/connect`); the patient is added to the resulting Google Calendar event as an
attendee by email, so they get an invite without a second OAuth flow. Like email, this is entirely
best-effort — an unconfigured, revoked, or failing calendar connection never blocks or breaks booking,
cancellation, or any other core flow; it's skipped and logged instead.

## Email service

Transactional email — account creation, booking confirmation, a separate new-booking notice to the
doctor (including the AI pre-visit summary), post-visit summary, cancellation, leave notice, appointment
reminders, and medication reminders — is sent via [Resend](https://resend.com)'s HTTP API
(`backend/src/lib/mailer.js`), not SMTP.

**Why HTTP API instead of SMTP:** Render's free Web Services have blocked all outbound traffic to SMTP
ports (25, 465, 587) since September 2025, so an SMTP-based mailer cannot reach any provider once
deployed there regardless of credentials. Resend's API runs over HTTPS, which isn't blocked.

**How it's wired in:** every outbound email is first written to a `NotificationLog` row
(`status: PENDING`) in the same request that triggers it, then a best-effort send is attempted
immediately; a cron job separately sweeps `PENDING`/`FAILED` rows every 2 minutes with exponential
backoff (up to 5 attempts). This means the app never blocks or fails a booking/registration/etc. on the
email step — a failed or slow send is retried in the background, and the real error is recorded in
`NotificationLog.lastError` for debugging. Configure via two env vars: `RESEND_API_KEY` and `EMAIL_FROM`
— both optional; without them, sends simply fail and get logged/retried like any other transient failure,
nothing crashes.

**Limitation — no paid/verified sending domain:** this project does not use a purchased or
DNS-verified custom domain for sending email. It sends from Resend's shared address,
`onboarding@resend.dev`, which requires no domain setup but comes with a real restriction: Resend will
only actually deliver mail to the email address the sending Resend account itself is registered under —
every other recipient's send is rejected by Resend's API and logged as `status: FAILED` in
`NotificationLog` (not silently dropped, but also not delivered). In practice this means the email
feature is fully functional and testable end-to-end using an account whose email matches the Resend
account's own address, but a real deployment serving arbitrary patients/doctors would need a verified
custom domain (standard Resend "Domains → Add Domain" flow, adding SPF/DKIM/DMARC DNS records) to
deliver to everyone — that step was intentionally left out of this submission's scope.

## Known scope limitations

- No dedicated "reschedule" endpoint — reschedule is cancel-then-rebook, which correctly frees the old
  slot and syncs the calendar (delete old event, create new one on the new booking).
- Medication reminder timing is a simple heuristic (fixed daily clock-times or a fixed hourly interval
  parsed from the prescription's free-text frequency), not a full scheduling DSL — documented in
  `docs/db-schema.md`.
- The rate limiter on auth endpoints is in-memory, single-process — fine for this deployment target, not
  suitable as-is for a multi-instance/horizontally-scaled deployment.
- No paid/verified email-sending domain — see **Email service** above for what this restricts.
