# Healthcare Appointment & Follow-up Manager

A clinic appointment platform with separate portals for patients, doctors, and admins — booking with
double-booking prevention, AI-generated pre-visit and post-visit summaries (Azure OpenAI), email
notifications, and Google Calendar sync.

> **Status:** work in progress. This README will be filled in as each part of the system is built
> (see `docs/system-design.md` and the setup instructions below, added in later steps).

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Frontend:** React, Vite, TypeScript
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

Full setup instructions (env vars, database migration, running both apps, Google Calendar OAuth setup)
will be documented here as those pieces are built.

### Quick start (current scaffold)

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in values
npm run dev             # http://localhost:4000/health

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```
