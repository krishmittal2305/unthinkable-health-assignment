# API Documentation

Base URL: `http://localhost:4000` (dev); all routes below are relative to that.

Auth: `Authorization: Bearer <token>` header, token from `/api/auth/login` or `/api/auth/register`.
Roles: `PATIENT`, `DOCTOR`, `ADMIN`. Unless marked **Public**, a route requires a valid token of the
listed role(s).

All error responses: `{ "error": "message" }` (validation errors also include `details`). Standard
status codes: `400` validation, `401` missing/invalid token, `403` wrong role, `404` not found, `409`
conflict, `410` gone (expired hold), `429` rate-limited, `500` unexpected.

## Auth (`/api/auth`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | Public | `{ email, password, name, phone? }` | Creates a `PATIENT` account. Rate-limited. |
| POST | `/login` | Public | `{ email, password }` | Returns `{ token, user }`. Rate-limited. |
| GET | `/me` | Any | - | Current user. |
| POST | `/admin/users` | ADMIN | `{ email, password, name, phone?, role: "DOCTOR"\|"ADMIN" }` | Only way to create non-patient accounts. |

## Admin: Doctor management (`/api/admin/doctors`)

All routes ADMIN-only.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/` | `{ email, password, name, phone?, specialisation, workingHours, slotDurationMins }` | Creates the `User` + `DoctorProfile` together. `workingHours` e.g. `{"mon":["09:00","17:00"]}`. |
| GET | `/` | - | List all doctors (full detail, incl. leave days). |
| GET | `/:doctorId` | - | Single doctor detail. |
| PATCH | `/:doctorId` | `{ specialisation?, workingHours?, slotDurationMins? }` | Partial update. |
| DELETE | `/:doctorId` | - | `409` if the doctor has any `BOOKED`/`COMPLETED` appointment. |
| POST | `/:doctorId/leave-days` | `{ date, reason? }` | Marks leave; cascades to cancel that day's bookings (see system design doc). Returns `{ leaveDay, cancelledAppointmentCount }`. |
| DELETE | `/:doctorId/leave-days/:leaveDayId` | - | Un-marks a leave day (does not restore cancelled bookings). |

## Public doctor search (`/api/doctors`)

All routes public, no auth.

| Method | Path | Query | Notes |
|---|---|---|---|
| GET | `/` | `?specialisation=` (optional) | Trimmed doctor list: `id, name, specialisation, slotDurationMins`. |
| GET | `/:doctorId` | - | Single doctor, same trimmed shape. |
| GET | `/:doctorId/availability` | `?date=YYYY-MM-DD` | `{ doctorId, date, onLeave, slots: [{ slotStart, slotEnd }] }`. |

## Appointments (patient) (`/api/appointments`)

All routes PATIENT-only.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/hold` | `{ doctorId, slotStart }` | 5-min hold on a slot. `409` if just taken. |
| POST | `/confirm` | `{ holdId, symptoms, durationDays?, severity? }` | Creates the appointment + triggers pre-visit LLM summary, notifications, calendar sync. `410` if hold expired, `409` if raced. |
| GET | `/mine` | - | Patient's own appointments with symptom form / pre- and post-visit summaries. |
| POST | `/:appointmentId/cancel` | - | Only on `BOOKED` appointments. |

## Doctor appointments (`/api/doctor/appointments`)

All routes DOCTOR-only, ownership-checked (`doctorUserId` must match caller).

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | - | All of this doctor's appointments, any status. |
| GET | `/:appointmentId` | - | Full detail: patient info, symptom form, pre-visit summary, post-visit note + prescriptions, post-visit summary. |
| POST | `/:appointmentId/post-visit` | `{ clinicalNotes, prescriptions: [{ drugName, dosage, frequency, durationDays }] }` | Only on `BOOKED` appointments; flips status to `COMPLETED`, schedules medication reminders, triggers post-visit LLM summary. |

## Google Calendar (`/api/doctor/calendar`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/connect` | DOCTOR | Returns `{ authUrl }`; redirect the browser there. |
| GET | `/callback` | Public | Hit directly by Google's redirect (no Bearer token available); doctor identity comes from a signed `state` param. Redirects to `FRONTEND_URL/doctor/calendar?status=connected\|error`. |

## Admin: appointments overview (`/api/admin/appointments`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | ADMIN | Every appointment in the system with patient/doctor names, specialisation, status. |

## Misc

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Public. `{ "status": "ok" }`. |
