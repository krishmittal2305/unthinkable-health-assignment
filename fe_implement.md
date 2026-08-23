# Frontend Implementation Plan

Planning document only — no code has been changed to match this yet. Goal: restyle the frontend to the
`userstyle.md` Swiss-minimal system, and make every screen sync correctly and visibly with the backend's
actual behavior — including the parts that are asynchronous or fallback-prone (LLM summaries, email/
calendar side effects, leave-triggered cancellations).

## 1. Current state audit

### Frontend files that exist today

```
src/App.jsx, main.jsx, App.css, index.css
src/api/client.js                          fetch wrapper, no changes needed
src/context/AuthContext.jsx                localStorage-persisted auth, no changes needed
src/components/ProtectedRoute.jsx          role gate, no changes needed
src/components/{Patient,Doctor,Admin}Layout.jsx   nav shells
src/pages/LoginPage.jsx, RegisterPage.jsx
src/pages/patient/{DoctorSearchPage,BookAppointmentPage,MyAppointmentsPage}.jsx
src/pages/doctor/{DoctorSchedulePage,DoctorAppointmentDetailPage}.jsx
src/pages/admin/{AdminDoctorsPage,AdminAppointmentsPage}.jsx
```

Styling today is `App.css`'s leftover Vite-scaffold tokens (light theme, purple accent) plus a handful of
generic `.card`/`.button-secondary`/`.button-danger`/`.table` classes. It works functionally but has no
relationship to the black/white/six-accent Swiss system in `userstyle.md`, and status/urgency are
currently shown as plain colored text, not the solid pills the style guide requires.

### Full backend API surface (confirmed from route files, this is everything the frontend has to work with)

| Area | Endpoints | Current frontend consumer |
|---|---|---|
| Auth | `POST /api/auth/register`, `/login`, `GET /me`, `POST /admin/users` | RegisterPage, LoginPage, AuthContext. `/admin/users` is unused by the UI (admin creates doctors via `/api/admin/doctors` which does both user+profile in one call) |
| Admin doctors | `POST/GET /api/admin/doctors`, `GET/PATCH/DELETE /:id`, `POST/DELETE /:id/leave-days[/:id]` | AdminDoctorsPage. `PATCH /:id` (edit doctor) is **not used anywhere in the UI today** |
| Public doctors | `GET /api/doctors`, `GET /:id`, `GET /:id/availability` | DoctorSearchPage, BookAppointmentPage |
| Patient appointments | `POST /hold`, `POST /confirm`, `GET /mine`, `POST /:id/cancel` | BookAppointmentPage, MyAppointmentsPage |
| Doctor appointments | `GET /`, `GET /:id`, `POST /:id/regenerate-pre-visit-summary`, `POST /:id/post-visit` | DoctorSchedulePage, DoctorAppointmentDetailPage |
| Admin appointments | `GET /api/admin/appointments` | AdminAppointmentsPage |
| Calendar | `GET /connect`, `GET /callback` | **Not used anywhere in the UI today** — API-only, per README |

Two concrete gaps this plan should close: doctor profile editing (`PATCH`) has no UI, and Google Calendar
connect has no UI entry point despite the backend fully supporting it.

### Where "sync with backend/LLM output" is currently weak

- Booking confirm and post-visit submit both block on a real LLM call server-side (up to ~15s on
  timeout) before responding. Today the button just says "Confirming..." / "Saving..." — there's no
  messaging that an AI summary is actively being generated, so a slow response reads as the app being
  stuck rather than working.
- `isFallback` is surfaced today only as a small muted parenthetical next to a heading. It should be a
  first-class, unmissable state (see design system below) since it's the signal that tells a doctor
  "this urgency rating is a generic default, verify it yourself."
- Nothing on any list/detail page ever refetches on its own. If an admin marks a doctor on leave while a
  patient has "My appointments" open in another tab, that patient's view is stale until they navigate
  away and back. Same for a doctor regenerating a summary in one tab while another tab shows the old one.
- The doctor's schedule list shows urgency as a bare colored word; there's no equivalent glance-ability
  for appointment status, which is currently plain text too.

## 2. Design system layer (build once, reuse everywhere)

New file: `src/styles/tokens.css` (or fold into `index.css`) defining the palette from `userstyle.md` as
CSS custom properties: `--bg`, `--surface`, `--text`, `--text-muted`, `--border`, and
`--accent-blue/red/pink/green/yellow/orange`. Remove the current light-theme tokens in `index.css`
entirely rather than layering a dark theme on top of them.

New shared components (`src/components/ui/`):

- `Pill.jsx` — solid-background status/urgency badge. Props: `tone` (`blue|red|pink|green|yellow|orange`),
  `label`. Encapsulates the background/text-color pairing table from `userstyle.md` in one place so no
  page ever hand-rolls a low-contrast pill by accident.
- `Button.jsx` — `variant="solid"` (filled, one accent color) | `"outline"` | `"danger"`. Replaces the
  current ad hoc `.button-secondary`/`.button-danger` classes with one component so every button in the
  app is visually consistent.
- `Card.jsx` / `Section.jsx` — hairline-bordered container per the "no shadow, no card elevation" rule.
- `EmptyState.jsx`, `LoadingState.jsx`, `ErrorState.jsx` — every list page currently hand-writes its own
  `{loading && <p>Loading...</p>}` block; consolidating this makes the loading/empty/error treatment
  actually consistent instead of "close enough" across nine different pages.
- `AiStatusBanner.jsx` — the component that solves the `isFallback` visibility gap: a solid-background
  banner (yellow tone) reading "AI summary unavailable — showing default content" when `isFallback` is
  true, with a `Regenerate` action slot for the pages that support it.

Status/urgency color mapping (concrete, so implementation doesn't have to improvise):

| Domain value | Pill tone |
|---|---|
| Urgency `LOW` | green |
| Urgency `MEDIUM` | yellow |
| Urgency `HIGH` | red |
| Appointment `BOOKED` | blue |
| Appointment `COMPLETED` | green |
| Appointment `CANCELLED_BY_PATIENT` / `CANCELLED_BY_DOCTOR` | orange |
| Appointment `CANCELLED_BY_LEAVE` | red |
| Appointment `NO_SHOW` | pink |

## 3. Data sync strategy ("updates dynamically")

No new infrastructure dependency (no WebSocket/SSE server) — the backend has no push mechanism today and
adding one is out of scope for a frontend pass. Instead, three concrete, low-cost mechanisms:

1. **Refetch on window focus and on a fixed interval**, for list/detail pages where staleness matters
   most: `MyAppointmentsPage`, `DoctorSchedulePage`, `DoctorAppointmentDetailPage`,
   `AdminAppointmentsPage`. A small `usePolling(fn, intervalMs)` hook (`document.visibilityState` +
   `window.addEventListener("focus", ...)` + `setInterval`, all cleaned up on unmount) covers this
   without a new dependency. Suggested interval: 20–30s — frequent enough to feel live, far below
   anything that would stress the API.
2. **Explicit in-flight states around the two LLM-backed writes** (`confirm`, `submitPostVisitNotes`) and
   the regenerate action: replace the generic "Confirming..."/"Saving..." button label with a distinct
   message once the request has been in flight for >1s (e.g. "Generating AI summary — this can take a
   few seconds"), using a short `setTimeout` so a fast response never flashes the extra message.
3. **Always refetch, never trust local mutation**, after every write. This is already the pattern
   (`await load()` after cancel/create/etc.) — the plan is to keep this discipline as new mutations
   (doctor edit, calendar connect) are added, rather than optimistically patching local state.

## 4. Per-portal plan

### Patient

- **DoctorSearchPage** — restyle to design system; no functional change.
- **BookAppointmentPage** — slot buttons become solid-blue selectable pills; hold countdown (currently
  static text) becomes a live "expires in Xm Ys" ticking display using `hold.expiresAt`, since the
  5-minute hold is exactly the kind of time-sensitive state that should visibly update. On expiry
  (countdown hits 0), auto-clear the held slot and show a message instead of waiting for the user to
  submit and get a 410.
- **MyAppointmentsPage** — apply `Pill` for status and urgency; wrap `isFallback` sections in
  `AiStatusBanner`; add the polling refetch described above; prescriptions table restyled per the
  hairline-table rule, no functional change (already fetches real DB data, not LLM-derived, per the
  existing requirement).

### Doctor

- **DoctorSchedulePage** — status and urgency both become pills (today only urgency is color-coded, and
  as bare text); add polling refetch.
- **DoctorAppointmentDetailPage** — `AiStatusBanner` wraps the pre-visit summary section when
  `isFallback`, with the existing "Regenerate AI summary" button moved into the banner's action slot;
  same treatment added to the post-visit summary section, which currently has no regenerate option at
  all — this plan adds one, mirroring the pre-visit endpoint pattern but calling
  `generatePostVisitSummary` server-side (**new backend endpoint required**:
  `POST /api/doctor/appointments/:id/regenerate-post-visit-summary`, symmetric to the existing pre-visit
  one — flagging here since it's a backend gap this frontend plan surfaces, not something the frontend
  can do alone).
- Post-visit form: prescription rows restyled as a repeating card group instead of a cramped inline row.

### Admin

- **AdminDoctorsPage** — leave-day manager restyled; add an **edit doctor** action (form pre-filled via
  `GET /api/admin/doctors/:id`, submitting `PATCH /:id`) since that endpoint currently has no UI.
- **AdminAppointmentsPage** — status becomes a pill; polling refetch since this view has the most
  reason to go stale (any patient/doctor/admin action anywhere affects it).
- **New: doctor calendar connect entry point.** Today `GET /api/doctor/calendar/connect` is API-only.
  Add a "Connect Google Calendar" button to the doctor portal (top-level nav or a settings area) that
  calls it and redirects the browser to the returned `authUrl`, and handle the
  `?status=connected|error` redirect target the backend already sends the browser back to
  (`FRONTEND_URL/doctor/calendar?status=...`) — this route currently doesn't exist in the frontend
  router at all and needs a small landing page to catch it.

## 5. Suggested implementation order

1. Design tokens + shared `ui/` components (Pill, Button, Card, states, AiStatusBanner) — foundation,
   nothing else can be restyled correctly without this first.
2. Restyle `App.css`/`index.css` global chrome (layout shells, nav, forms) to match.
3. Patient portal restyle + hold countdown + polling.
4. Doctor portal restyle + AI status banners (pre- and post-visit) + polling.
   - Depends on the new post-visit-regenerate backend endpoint if that piece is included; can ship
     pre-visit-only first and add post-visit once the endpoint exists.
5. Admin portal restyle + doctor edit form + polling.
6. Doctor Calendar connect entry point + `/doctor/calendar` landing route.
7. Cross-page pass: confirm every list/detail page has consistent loading/empty/error treatment via the
   new shared components, nothing left on the old ad hoc pattern.

## 6. Verification approach

Same discipline as the backend build: after each numbered step, exercise it against the real local
backend (not mocked) — log in as each seeded role, confirm pills render with correct solid-background
contrast per `userstyle.md`'s table, confirm polling actually refetches (observable via a network tab or
a temporary console log), confirm the hold countdown expires and clears correctly, and confirm the new
doctor-edit and calendar-connect flows round-trip against the real endpoints before moving to the next
step.
