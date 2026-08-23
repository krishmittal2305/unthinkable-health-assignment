const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const { AppError } = require("../lib/errors");
const { env } = require("../lib/env");
const { createOAuth2Client, isGoogleConfigured } = require("../lib/googleClient");
const { prisma } = require("../lib/prisma");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const STATE_PURPOSE = "google_oauth_state";

// The OAuth callback is hit directly by Google's redirect (a plain browser
// navigation, no Authorization header available), so "which doctor is
// connecting" has to travel through the `state` param itself rather than a
// session. Signed + short-lived + purpose-tagged so it can't be confused
// with (or forged from) a normal auth JWT.
function getAuthUrl(doctorId) {
  if (!isGoogleConfigured()) {
    throw new AppError(503, "Google Calendar integration is not configured on this server");
  }

  const client = createOAuth2Client();
  const state = jwt.sign({ purpose: STATE_PURPOSE, doctorId }, env.jwtSecret, { expiresIn: "10m" });

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token even if the doctor connected before
    scope: SCOPES,
    state,
  });
}

function verifyState(state) {
  let payload;
  try {
    payload = jwt.verify(state, env.jwtSecret);
  } catch {
    throw new AppError(400, "Invalid or expired OAuth state");
  }
  if (payload.purpose !== STATE_PURPOSE || !payload.doctorId) {
    throw new AppError(400, "Invalid OAuth state");
  }
  return payload.doctorId;
}

async function handleOAuthCallback(code, state) {
  const doctorId = verifyState(state);

  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    const existing = await prisma.googleCalendarToken.findUnique({ where: { doctorId } });
    if (!existing) {
      throw new AppError(502, "Google did not return a refresh token. Please try connecting again.");
    }
  }

  await prisma.googleCalendarToken.upsert({
    where: { doctorId },
    update: {
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiryDate: new Date(tokens.expiry_date),
    },
    create: {
      doctorId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date),
    },
  });

  return doctorId;
}

// Returns null (never throws) when the doctor hasn't connected a calendar,
// or Google isn't configured server-side — every caller treats that as
// "skip calendar sync for this appointment", not an error.
async function getClientForDoctor(doctorId) {
  if (!isGoogleConfigured()) return null;

  const tokenRow = await prisma.googleCalendarToken.findUnique({ where: { doctorId } });
  if (!tokenRow) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.expiryDate.getTime(),
  });

  // googleapis auto-refreshes the access token using the refresh_token when
  // it's expired; persist the refreshed token back so future calls reuse it.
  client.on("tokens", (newTokens) => {
    prisma.googleCalendarToken
      .update({
        where: { doctorId },
        data: {
          accessToken: newTokens.access_token ?? tokenRow.accessToken,
          ...(newTokens.refresh_token ? { refreshToken: newTokens.refresh_token } : {}),
          ...(newTokens.expiry_date ? { expiryDate: new Date(newTokens.expiry_date) } : {}),
        },
      })
      .catch((error) => console.error("[calendarService] failed to persist refreshed token:", error));
  });

  return client;
}

// Best-effort, never throws — booking must succeed whether or not the
// doctor has connected Google Calendar, or the API call happens to fail.
async function createEventForAppointment(appointment) {
  try {
    const client = await getClientForDoctor(appointment.doctorId);
    if (!client) {
      console.log(
        `[calendarService] doctor ${appointment.doctorId} has no connected calendar — skipping event creation`,
      );
      return;
    }

    const [patient, doctorProfile] = await Promise.all([
      prisma.user.findUnique({ where: { id: appointment.patientId }, select: { email: true, name: true } }),
      prisma.doctorProfile.findUnique({
        where: { id: appointment.doctorId },
        include: { user: { select: { name: true } } },
      }),
    ]);

    const calendar = google.calendar({ version: "v3", auth: client });
    const event = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all", // emails the patient an invite — no patient-side OAuth needed
      requestBody: {
        summary: `Appointment: ${doctorProfile.user.name} & ${patient.name}`,
        description: "Booked via Healthcare Appointment Manager",
        start: { dateTime: appointment.slotStart.toISOString() },
        end: { dateTime: appointment.slotEnd.toISOString() },
        attendees: [{ email: patient.email }],
      },
    });

    await prisma.calendarEvent.create({
      data: { appointmentId: appointment.id, googleEventId: event.data.id },
    });
  } catch (error) {
    console.error(`[calendarService] failed to create calendar event for appointment ${appointment.id}:`, error.message);
  }
}

// Best-effort, never throws — cancellation must succeed regardless of
// calendar sync outcome.
async function deleteEventForAppointment(appointmentId) {
  try {
    const calendarEvent = await prisma.calendarEvent.findUnique({ where: { appointmentId } });
    if (!calendarEvent) return; // no linked event — nothing to do (e.g. doctor never connected)

    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    const client = await getClientForDoctor(appointment.doctorId);
    if (!client) {
      // Token missing/revoked since the event was created. Nothing we can
      // delete remotely — drop our local link so this doesn't retry forever.
      await prisma.calendarEvent.delete({ where: { appointmentId } });
      return;
    }

    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.delete({
      calendarId: "primary",
      eventId: calendarEvent.googleEventId,
      sendUpdates: "all",
    });

    await prisma.calendarEvent.delete({ where: { appointmentId } });
  } catch (error) {
    console.error(`[calendarService] failed to delete calendar event for appointment ${appointmentId}:`, error.message);
  }
}

module.exports = { getAuthUrl, handleOAuthCallback, createEventForAppointment, deleteEventForAppointment };
