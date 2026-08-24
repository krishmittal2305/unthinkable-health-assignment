# Email Setup

The app sends transactional email, including account creation, booking confirmation, a separate
new-booking notice to the doctor, post-visit summary, cancellation, leave notice, and
appointment/medication reminders, via [Resend](https://resend.com)'s HTTP API
(`backend/src/lib/mailer.js`). If you skip this setup entirely, the app still works fully: nothing in
booking, cancellation, or any other core flow depends on email succeeding (see
`docs/system-design.md`'s notification-failure-handling section). You just won't get real emails, and
every send will sit as `FAILED` in `NotificationLog` instead.

## Why an HTTP API instead of SMTP

Render's free Web Services have blocked all outbound traffic to SMTP ports (25, 465, 587) since
September 2025. An SMTP-based mailer (Nodemailer, etc.) cannot reach any SMTP provider once deployed
there, regardless of credentials; the protocol itself is blocked, not any particular provider. Resend's
API runs over HTTPS (port 443), which isn't blocked, so the backend calls
`POST https://api.resend.com/emails` directly instead of opening an SMTP connection.

## 1. Create a Resend account

1. Go to [resend.com](https://resend.com) and sign up (email/password or GitHub/Google SSO). Free, no
   credit card required.
2. Verify your own email if Resend sends a confirmation link.

## 2. Choose a sending address

Resend requires a **verified domain** to deliver to arbitrary recipients. There are two paths:

- **Quick start, no domain (what this project uses):** send from Resend's shared address,
  `onboarding@resend.dev`. No DNS setup at all, but Resend restricts it to only deliver mail to the
  email address your Resend account itself is registered under. Every other recipient's send is rejected
  by Resend's API and logged as `status: FAILED` in `NotificationLog` (not silently dropped, but not
  delivered either). This is enough to fully exercise and demo the email feature end-to-end using a test
  account whose email matches your Resend account's own address, but it cannot deliver to arbitrary real
  patients/doctors.
- **Full setup, any recipient:** verify a domain you own. Resend dashboard → **Domains → Add Domain** →
  add the SPF/DKIM/DMARC DNS records Resend shows you at your domain registrar → wait for the domain to
  show as **Verified** (minutes to a few hours depending on DNS propagation). Once verified, you can send
  from any address on that domain (e.g. `clinic@yourdomain.com`) to any recipient.

This project intentionally uses the first option; see **Limitation** below.

## 3. Create an API key

1. Resend dashboard → **API Keys → Create API Key**.
2. Name it (e.g. `healthcare-app-backend`).
3. Permission level: **Full access**, or **Sending access** if offered; the backend only ever calls the
   send-email endpoint.
4. Copy the key immediately (starts with `re_`); it's shown once and can't be retrieved again; if lost,
   delete the key and create a new one.

## 4. Configure the backend

In `backend/.env`:

```bash
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="Clinic <onboarding@resend.dev>"
```

Or, if you verified a domain in step 2:

```bash
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="Clinic <clinic@your-verified-domain.com>"
```

`EMAIL_FROM` must exactly match either `onboarding@resend.dev` or an address on a domain you've verified
in your Resend account; anything else fails every send. Restart the backend after editing `.env`
(it's read once at startup, not hot-reloaded). For a deployed backend (e.g. on Render), set the same two
variables in that service's environment variables instead.

## 5. Test it

1. Register a new account using the email address your Resend account is registered under (if using the
   shared `onboarding@resend.dev` sender) → confirm a "Welcome to Clinic Appointment Manager" email
   arrives (check spam for the first send or two).
2. Book an appointment where both the patient and doctor accounts use that same address → confirm an
   "Appointment confirmed" email and a separate "New appointment booked" email (with the AI pre-visit
   summary) both arrive.
3. Submit post-visit notes as that doctor → confirm a "Your visit summary is ready" email arrives with
   the medication schedule and follow-up steps.
4. Cross-check delivery in the Resend dashboard's **Logs**/**Emails** tab, and/or query the database:
   ```sql
   SELECT type, status, "lastError", "createdAt" FROM "NotificationLog" ORDER BY "createdAt" DESC LIMIT 10;
   ```
   `status: SENT` means Resend accepted it; `status: FAILED` with `lastError` populated explains why
   (commonly: wrong/missing `RESEND_API_KEY`, or, on the shared sender, a recipient that isn't your own
   Resend account email).

## Limitation: no paid/verified sending domain

This project does not use a purchased or DNS-verified custom domain for sending email; it uses Resend's
shared `onboarding@resend.dev` address. As explained in step 2, this means real email delivery is
restricted to the one address your Resend account is registered under; every other patient/doctor
account still functions completely normally (registration, booking, cancellation, post-visit notes all
succeed), but their notification emails are logged as `FAILED` rather than delivered, since Resend
rejects the send before it ever reaches an inbox. Booking, cancellation, and every other core flow are
unaffected by this either way, by design (see `docs/system-design.md`).

To lift this restriction for a real deployment serving arbitrary recipients, complete the "full setup"
path in step 2 (verify an owned domain) and switch `EMAIL_FROM` to an address on that domain.
