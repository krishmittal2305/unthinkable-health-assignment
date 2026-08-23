# Google Calendar Setup

The app uses Google Calendar API v3 with OAuth 2.0 so a doctor can connect their own calendar; booked
appointments then sync there automatically, with the patient added as an event attendee (Google emails
them an invite — no patient-side OAuth needed). If you skip this setup entirely, the app still works
fully — booking/cancelling never depends on Calendar being connected (see `calendarService.js`'s
graceful-degradation contract), you just won't get calendar sync.

## 1. Create a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or reuse an existing one).

## 2. Enable the Calendar API

1. In the project, go to **APIs & Services → Library**.
2. Search for **Google Calendar API** and click **Enable**.

## 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** (or **Internal** if you have a Google Workspace org) is fine for testing.
3. Fill in the required app name/support email fields.
4. Add scope: `https://www.googleapis.com/auth/calendar.events`.
5. Under **Test users** (while the app is in "Testing" publish status), add the Google account(s) you'll
   use to test the doctor connect flow — Google restricts unverified apps to test users only.

## 4. Create OAuth 2.0 credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URIs — add the exact callback URL the backend serves:
   - Local dev: `http://localhost:4000/api/doctor/calendar/callback`
   - Production: `https://<your-deployed-backend-domain>/api/doctor/calendar/callback`
4. Save. Copy the generated **Client ID** and **Client Secret**.

## 5. Configure the backend

In `backend/.env`:

```bash
GOOGLE_CLIENT_ID="<client id from step 4>"
GOOGLE_CLIENT_SECRET="<client secret from step 4>"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/doctor/calendar/callback"
```

`GOOGLE_REDIRECT_URI` must match a URI registered in step 4 **exactly** (scheme, host, port, path) or
Google will reject the OAuth request with `redirect_uri_mismatch`.

## 6. Connect a doctor's calendar

1. Log in to the app as a doctor.
2. Call `GET /api/doctor/calendar/connect` (Bearer token required) — returns `{ authUrl }`.
3. Send the browser to `authUrl`. Google's consent screen appears; the doctor approves calendar access.
4. Google redirects to `GOOGLE_REDIRECT_URI` with a `code` + `state`; the backend exchanges the code for
   tokens and stores them in `GoogleCalendarToken`, then redirects the browser to
   `FRONTEND_URL/doctor/calendar?status=connected`.

From then on, `createEventForAppointment`/`deleteEventForAppointment` run automatically on booking and
cancellation for that doctor.

## Notes / gotchas

- The app always requests `access_type=offline&prompt=consent` so Google issues a `refresh_token` on
  every connect — without `prompt=consent`, a doctor reconnecting after already having granted access
  once might not get a new refresh token back.
- Access tokens are refreshed automatically via the stored refresh token and persisted back to the DB
  (`googleapis`'s `tokens` event handler in `calendarService.js`) — no manual re-connect needed unless
  the doctor revokes access from their Google account.
- If a doctor's token is later revoked/invalid, calendar sync for their appointments is skipped and
  logged — bookings/cancellations still succeed normally.
