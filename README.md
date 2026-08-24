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
  `NotificationLog` and retried, but nothing crashes (see `emailplan.md` for Resend setup)
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

## Known scope limitations

- No dedicated "reschedule" endpoint — reschedule is cancel-then-rebook, which correctly frees the old
  slot and syncs the calendar (delete old event, create new one on the new booking).
- Medication reminder timing is a simple heuristic (fixed daily clock-times or a fixed hourly interval
  parsed from the prescription's free-text frequency), not a full scheduling DSL — documented in
  `docs/db-schema.md`.
- The rate limiter on auth endpoints is in-memory, single-process — fine for this deployment target, not
  suitable as-is for a multi-instance/horizontally-scaled deployment.
