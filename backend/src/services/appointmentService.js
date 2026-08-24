const { Prisma } = require("@prisma/client");
const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const availabilityService = require("./availabilityService");
const doctorService = require("./doctorService");
const notificationService = require("./notificationService");
const llmService = require("./llmService");
const calendarService = require("./calendarService");

const SLOT_HOLD_TTL_MS = 5 * 60 * 1000;

function isUniqueConstraintViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function assertSlotIsOfferable(doctorId, slotStart) {
  const dateOnly = slotStart.toISOString().slice(0, 10);
  const availability = await availabilityService.getAvailableSlots(doctorId, dateOnly);
  const isOfferable = availability.slots.some((slot) => slot.slotStart === slotStart.toISOString());
  if (!isOfferable) {
    throw new AppError(409, "That slot is not currently available. Please pick another.");
  }
}

async function createHold(patientId, { doctorId, slotStart: slotStartStr }) {
  const doctor = await doctorService.getDoctorById(doctorId);
  const slotStart = new Date(slotStartStr);
  const slotEnd = new Date(slotStart.getTime() + doctor.slotDurationMins * 60_000);

  await assertSlotIsOfferable(doctorId, slotStart);

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

      const patient = await tx.user.findUnique({
        where: { id: patientId },
        select: { name: true, email: true, phone: true },
      });

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

      appointment.doctorProfile = doctorProfile;
      appointment.patient = patient;

      return appointment;
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new AppError(409, "This slot was just booked by another patient. Please pick another.");
    }
    throw error;
  }

  calendarService.createEventForAppointment(appointment).catch(() => {});

  let preVisitSummary = null;
  try {
    const summary = await llmService.generatePreVisitSummary(appointment.symptomForm.symptoms);
    preVisitSummary = await prisma.preVisitSummary.create({
      data: {
        appointmentId: appointment.id,
        urgencyLevel: summary.urgencyLevel,
        chiefComplaint: summary.chiefComplaint,
        suggestedQuestions: summary.suggestedQuestions,
        rawLlmResponse: summary.rawResponse,
        isFallback: summary.isFallback,
      },
    });
    appointment.preVisitSummary = preVisitSummary;
  } catch (error) {
    console.error("Failed to save pre-visit summary (booking still succeeded):", error);
  }

  const { doctorProfile, patient, symptomForm } = appointment;

  await notificationService.createNotification({
    channel: "EMAIL",
    type: "BOOKING_CONFIRMATION",
    recipientId: patientId,
    payload: {
      appointmentId: appointment.id,
      doctorName: doctorProfile.user.name,
      specialisation: doctorProfile.specialisation,
      slotStart: appointment.slotStart.toISOString(),
      symptoms: symptomForm.symptoms,
      severity: symptomForm.severity,
      durationDays: symptomForm.durationDays,
    },
  });
  await notificationService.createNotification({
    channel: "EMAIL",
    type: "DOCTOR_NEW_BOOKING",
    recipientId: doctorProfile.user.id,
    payload: {
      appointmentId: appointment.id,
      patientName: patient?.name,
      patientEmail: patient?.email,
      patientPhone: patient?.phone,
      slotStart: appointment.slotStart.toISOString(),
      symptoms: symptomForm.symptoms,
      severity: symptomForm.severity,
      durationDays: symptomForm.durationDays,
      urgencyLevel: preVisitSummary?.urgencyLevel,
      chiefComplaint: preVisitSummary?.chiefComplaint,
      suggestedQuestions: preVisitSummary?.suggestedQuestions,
    },
  });
  notificationService.triggerBestEffortDelivery();

  return appointment;
}

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
      postVisitNote: { include: { prescriptions: true } },
      postVisitSummary: true,
    },
    orderBy: { slotStart: "desc" },
  });
}

async function listAllForAdmin() {
  return prisma.appointment.findMany({
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctorProfile: { select: { specialisation: true, user: { select: { id: true, name: true } } } },
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

async function regeneratePreVisitSummary(doctorUserId, appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { symptomForm: true },
  });

  if (!appointment || appointment.doctorUserId !== doctorUserId) {
    throw new AppError(404, "Appointment not found");
  }
  if (!appointment.symptomForm) {
    throw new AppError(409, "This appointment has no symptom form to summarize");
  }

  const summary = await llmService.generatePreVisitSummary(appointment.symptomForm.symptoms);

  return prisma.preVisitSummary.upsert({
    where: { appointmentId },
    update: {
      urgencyLevel: summary.urgencyLevel,
      chiefComplaint: summary.chiefComplaint,
      suggestedQuestions: summary.suggestedQuestions,
      rawLlmResponse: summary.rawResponse,
      isFallback: summary.isFallback,
    },
    create: {
      appointmentId,
      urgencyLevel: summary.urgencyLevel,
      chiefComplaint: summary.chiefComplaint,
      suggestedQuestions: summary.suggestedQuestions,
      rawLlmResponse: summary.rawResponse,
      isFallback: summary.isFallback,
    },
  });
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
  calendarService.deleteEventForAppointment(appointmentId).catch(() => {});
  return updated;
}

module.exports = {
  createHold,
  confirmBooking,
  listMyAppointments,
  listAllForAdmin,
  listForDoctor,
  getForDoctor,
  regeneratePreVisitSummary,
  cancelAppointment,
  SLOT_HOLD_TTL_MS,
};
