const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const { AppError } = require("../lib/errors");
const { env } = require("../lib/env");
const { createOAuth2Client, isGoogleConfigured } = require("../lib/googleClient");
const { prisma } = require("../lib/prisma");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const STATE_PURPOSE = "google_oauth_state";

function getAuthUrl(doctorId) {
  if (!isGoogleConfigured()) {
    throw new AppError(503, "Google Calendar integration is not configured on this server");
  }

  const client = createOAuth2Client();
  const state = jwt.sign({ purpose: STATE_PURPOSE, doctorId }, env.jwtSecret, { expiresIn: "10m" });

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
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
      sendUpdates: "all",
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

async function deleteEventForAppointment(appointmentId) {
  try {
    const calendarEvent = await prisma.calendarEvent.findUnique({ where: { appointmentId } });
    if (!calendarEvent) return;

    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    const client = await getClientForDoctor(appointment.doctorId);
    if (!client) {

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
