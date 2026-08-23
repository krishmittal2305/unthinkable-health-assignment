const { Prisma } = require("@prisma/client");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const availabilityService = require("./availabilityService");
const doctorService = require("./doctorService");
const notificationService = require("./notificationService");
const llmService = require("./llmService");

const SLOT_HOLD_TTL_MS = 5 * 60 * 1000;

function isUniqueConstraintViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function assertSlotIsOfferable(doctorId, slotStart) {
  const dateOnly = slotStart.toISOString().slice(0, 10);
  const availability = await availabilityService.getAvailableSlots(doctorId, dateOnly); // 404s if doctor missing
  const isOfferable = availability.slots.some((slot) => slot.slotStart === slotStart.toISOString());
  if (!isOfferable) {
    throw new AppError(409, "That slot is not currently available. Please pick another.");
  }
}

async function createHold(patientId, { doctorId, slotStart: slotStartStr }) {
  const doctor = await doctorService.getDoctorById(doctorId); // 404s if missing
  const slotStart = new Date(slotStartStr);
  const slotEnd = new Date(slotStart.getTime() + doctor.slotDurationMins * 60_000);

  await assertSlotIsOfferable(doctorId, slotStart);

  // Opportunistically clear a stale hold on this exact slot instead of making
  // the patient wait for the Step 9 cron sweep — safe because expiresAt < now
  // is an objective fact, not a race.
  await prisma.slotHold.deleteMany({
    where: { doctorId, slotStart, expiresAt: { lt: new Date() } },
  });

  try {
    const hold = await prisma.slotHold.create({
      data: {
        doctorId,
        patientId,
        slotStart,
        slotEnd,
        expiresAt: new Date(Date.now() + SLOT_HOLD_TTL_MS),
      },
    });
    return hold;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new AppError(409, "This slot was just taken by another patient. Please pick another.");
    }
    throw error;
  }
}

async function confirmBooking(patientId, { holdId, symptoms, durationDays, severity }) {
  let appointment;
  try {
    appointment = await prisma.$transaction(async (tx) => {
      const hold = await tx.slotHold.findUnique({ where: { id: holdId } });

      if (!hold || hold.patientId !== patientId) {
        throw new AppError(404, "Hold not found");
      }
      if (hold.expiresAt < new Date()) {
        await tx.slotHold.delete({ where: { id: holdId } });
        throw new AppError(410, "This hold has expired. Please select the slot again.");
      }

      // Defense in depth against the narrow race with leaveService.markDoctorOnLeave:
      // a hold created before leave was marked could still be mid-flight here while
      // that transaction commits concurrently. Re-checking inside this transaction,
      // right before the appointment is created, closes almost all of that window
      // (leaveService's own hold cleanup closes the rest in the common case).
      const slotDateUtc = new Date(
        Date.UTC(hold.slotStart.getUTCFullYear(), hold.slotStart.getUTCMonth(), hold.slotStart.getUTCDate()),
      );
      const leaveDay = await tx.leaveDay.findUnique({
        where: { doctorId_date: { doctorId: hold.doctorId, date: slotDateUtc } },
      });
      if (leaveDay) {
        await tx.slotHold.delete({ where: { id: holdId } });
        throw new AppError(409, "The doctor is unavailable on this date. Please choose another slot.");
      }

      const doctorProfile = await tx.doctorProfile.findUnique({
        where: { id: hold.doctorId },
        include: { user: { select: { id: true, name: true } } },
      });
      if (!doctorProfile) {
        throw new AppError(404, "Doctor not found");
      }

      const patient = await tx.user.findUnique({ where: { id: patientId }, select: { name: true } });

      const appointment = await tx.appointment.create({
        data: {
          patientId,
          doctorId: hold.doctorId,
          doctorUserId: doctorProfile.userId,
          slotStart: hold.slotStart,
          slotEnd: hold.slotEnd,
          status: "BOOKED",
          symptomForm: {
            create: { symptoms, durationDays, severity },
          },
        },
        include: { symptomForm: true },
      });

      await tx.slotHold.delete({ where: { id: holdId } });

      const notificationPayload = {
        appointmentId: appointment.id,
        doctorName: doctorProfile.user.name,
        patientName: patient?.name,
        specialisation: doctorProfile.specialisation,
        slotStart: appointment.slotStart.toISOString(),
      };
      await notificationService.createNotification(
        { channel: "EMAIL", type: "BOOKING_CONFIRMATION", recipientId: patientId, payload: notificationPayload },
        tx,
      );
      await notificationService.createNotification(
        {
          channel: "EMAIL",
          type: "BOOKING_CONFIRMATION",
          recipientId: doctorProfile.user.id,
          payload: notificationPayload,
        },
        tx,
      );

      return appointment;
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new AppError(409, "This slot was just booked by another patient. Please pick another.");
    }
    throw error;
  }

  notificationService.triggerBestEffortDelivery();

  // Deliberately outside the DB transaction above — an LLM call can take
  // several seconds and must never hold a transaction (and its row locks)
  // open. llmService never throws (Step 10's fallback contract), but the
  // DB write afterward still gets its own guard so a save failure can't
  // turn an already-successful booking into a 500.
  try {
    const summary = await llmService.generatePreVisitSummary(appointment.symptomForm.symptoms);
    appointment.preVisitSummary = await prisma.preVisitSummary.create({
      data: {
        appointmentId: appointment.id,
        urgencyLevel: summary.urgencyLevel,
        chiefComplaint: summary.chiefComplaint,
        suggestedQuestions: summary.suggestedQuestions,
        rawLlmResponse: summary.rawResponse,
        isFallback: summary.isFallback,
      },
    });
  } catch (error) {
    console.error("Failed to save pre-visit summary (booking still succeeded):", error);
  }

  return appointment;
}

// NOTE: nested user data uses `select`, never `include: true` — the User
// model carries passwordHash, and an unqualified include would serialize it
// straight into the API response.
async function listMyAppointments(patientId) {
  return prisma.appointment.findMany({
    where: { patientId },
    include: {
      doctorProfile: {
        select: {
          id: true,
          specialisation: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      symptomForm: true,
      preVisitSummary: true,
      postVisitSummary: true,
    },
    orderBy: { slotStart: "desc" },
  });
}

async function listForDoctor(doctorUserId) {
  return prisma.appointment.findMany({
    where: { doctorUserId },
    include: {
      patient: { select: { id: true, name: true, email: true, phone: true } },
      symptomForm: true,
      preVisitSummary: true,
      postVisitNote: true,
      postVisitSummary: true,
    },
    orderBy: { slotStart: "desc" },
  });
}

async function getForDoctor(doctorUserId, appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { id: true, name: true, email: true, phone: true } },
      symptomForm: true,
      preVisitSummary: true,
      postVisitNote: { include: { prescriptions: true } },
      postVisitSummary: true,
    },
  });

  if (!appointment || appointment.doctorUserId !== doctorUserId) {
    throw new AppError(404, "Appointment not found");
  }

  return appointment;
}

async function cancelAppointment(patientId, appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctorProfile: { select: { specialisation: true, user: { select: { name: true } } } },
      patient: { select: { name: true } },
    },
  });
  if (!appointment || appointment.patientId !== patientId) {
    throw new AppError(404, "Appointment not found");
  }
  if (appointment.status !== "BOOKED") {
    throw new AppError(409, `Cannot cancel an appointment with status ${appointment.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED_BY_PATIENT" },
    });

    const notificationPayload = {
      appointmentId: appointment.id,
      doctorName: appointment.doctorProfile.user.name,
      patientName: appointment.patient.name,
      slotStart: appointment.slotStart.toISOString(),
      reason: "Cancelled by patient",
    };
    await notificationService.createNotification(
      { channel: "EMAIL", type: "CANCELLATION", recipientId: appointment.patientId, payload: notificationPayload },
      tx,
    );
    await notificationService.createNotification(
      {
        channel: "EMAIL",
        type: "CANCELLATION",
        recipientId: appointment.doctorUserId,
        payload: notificationPayload,
      },
      tx,
    );

    return cancelled;
  });

  notificationService.triggerBestEffortDelivery();
  return updated;
}

module.exports = {
  createHold,
  confirmBooking,
  listMyAppointments,
  listForDoctor,
  getForDoctor,
  cancelAppointment,
  SLOT_HOLD_TTL_MS,
};
