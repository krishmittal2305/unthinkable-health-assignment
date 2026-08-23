const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const doctorService = require("./doctorService");

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// All slot arithmetic is done in UTC, and a "date" is always the UTC calendar
// day, regardless of the server's local timezone. This keeps slot generation,
// leave-day matching, and stored appointment times mutually consistent.
function parseDateOnly(dateStr) {
  if (!DATE_ONLY_RE.test(dateStr)) {
    throw new AppError(400, "date must be in YYYY-MM-DD format");
  }
  const midnightUtc = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(midnightUtc.getTime())) {
    throw new AppError(400, "Invalid date");
  }
  return midnightUtc;
}

function timeToMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildSlotDate(midnightUtc, minutesFromMidnight) {
  return new Date(midnightUtc.getTime() + minutesFromMidnight * 60_000);
}

function generateCandidateSlots(midnightUtc, dayHours, slotDurationMins) {
  if (!dayHours) return [];

  const [startTime, endTime] = dayHours;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  const slots = [];
  for (let m = startMinutes; m + slotDurationMins <= endMinutes; m += slotDurationMins) {
    slots.push({
      slotStart: buildSlotDate(midnightUtc, m),
      slotEnd: buildSlotDate(midnightUtc, m + slotDurationMins),
    });
  }
  return slots;
}

async function getAvailableSlots(doctorId, dateStr) {
  const midnightUtc = parseDateOnly(dateStr);
  const doctor = await doctorService.getDoctorById(doctorId); // 404s if missing

  const isOnLeave = doctor.leaveDays?.some(
    (leaveDay) => new Date(leaveDay.date).getTime() === midnightUtc.getTime(),
  );
  if (isOnLeave) {
    return { doctorId, date: dateStr, onLeave: true, slots: [] };
  }

  const dayKey = WEEKDAY_KEYS[midnightUtc.getUTCDay()];
  const dayHours = doctor.workingHours?.[dayKey];
  const candidates = generateCandidateSlots(midnightUtc, dayHours, doctor.slotDurationMins);

  if (candidates.length === 0) {
    return { doctorId, date: dateStr, onLeave: false, slots: [] };
  }

  const dayEnd = buildSlotDate(midnightUtc, 24 * 60);

  const [occupyingAppointments, activeHolds] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId,
        slotStart: { gte: midnightUtc, lt: dayEnd },
        status: { in: ["BOOKED", "COMPLETED"] },
      },
      select: { slotStart: true },
    }),
    prisma.slotHold.findMany({
      where: {
        doctorId,
        slotStart: { gte: midnightUtc, lt: dayEnd },
        expiresAt: { gt: new Date() },
      },
      select: { slotStart: true },
    }),
  ]);

  const takenTimestamps = new Set(
    [...occupyingAppointments, ...activeHolds].map((row) => row.slotStart.getTime()),
  );

  const slots = candidates
    .filter((slot) => !takenTimestamps.has(slot.slotStart.getTime()))
    .map((slot) => ({ slotStart: slot.slotStart.toISOString(), slotEnd: slot.slotEnd.toISOString() }));

  return { doctorId, date: dateStr, onLeave: false, slots };
}

module.exports = { getAvailableSlots, parseDateOnly };
