# Healthcare Appointment & Follow-up Manager

A clinic appointment platform with separate portals for patients, doctors, and admins — booking with
double-booking prevention, AI-generated pre-visit and post-visit summaries (Azure OpenAI), email
notifications, and Google Calendar sync.

> **Status:** work in progress. This README will be filled in as each part of the system is built
> (see `docs/system-design.md` and the setup instructions below, added in later steps).

## Stack

- **Backend:** Node.js, Express, JavaScript, Prisma ORM, PostgreSQL
- **Frontend:** React, Vite, JavaScript
- **LLM:** Azure OpenAI (pre-visit and post-visit summaries)
- **Email:** Nodemailer (Gmail/SMTP)
- **Calendar:** Google Calendar API v3 (OAuth 2.0)
- **Background jobs:** node-cron

## Project structure

```
/backend    Express API, Prisma schema/migrations, background jobs, LLM/email/calendar services
/frontend   React + Vite app (patient, doctor, admin portals)
/docs       System design write-up, DB schema notes, API docs, LLM prompts
```

## Setup

Full setup instructions (LLM/email/calendar env vars, Google Calendar OAuth setup) will be filled in as
those pieces are built. Database setup below is already complete and working.

### Database (PostgreSQL)

This dev machine has PostgreSQL 17 installed locally as a Windows service (`postgresql-x64-17`), with:
- superuser: `postgres` / password: `postgres` (local dev only — never use this in production)
- database: `healthcare_appointments`

If setting up on a different machine, install PostgreSQL, create a database, and point `DATABASE_URL` in
`backend/.env` at it — no code changes needed.

### Backend

```bash
cd backend
npm install
cp .env.example .env          # already pre-filled with local DB creds on this machine
npm run prisma:migrate         # applies backend/prisma/migrations
npm run prisma:seed            # creates admin@clinic.test / ChangeMe123!
npm run dev                    # http://localhost:4000/health
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173 (redirects to /login)
```

Log in at `/login` with the seeded admin (`admin@clinic.test` / `ChangeMe123!`) to reach the doctor
management page at `/admin/doctors`.
