const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const notificationService = require("./notificationService");
const calendarService = require("./calendarService");

// Marks a doctor on leave for a date and resolves every conflict that
// creates in one transaction:
//  - any in-flight SlotHold for that day is invalidated (nothing to confirm
//    on a day the doctor won't be in)
//  - any BOOKED appointment for that day is moved to CANCELLED_BY_LEAVE
//  - a NotificationLog row (EMAIL, LEAVE_NOTICE) is queued per affected
//    patient, delivered by the best-effort trigger right after this
//    transaction commits (Step 9's cron is the reliable fallback for
//    anything that attempt misses).
async function markDoctorOnLeave(doctorId, { date, reason }) {
  let affectedAppointmentIds = [];

  const result = await prisma.$transaction(async (tx) => {
    const doctor = await tx.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { name: true } } },
    });
    if (!doctor) {
      throw new AppError(404, "Doctor not found");
    }

    const existingLeave = await tx.leaveDay.findUnique({
      where: { doctorId_date: { doctorId, date } },
    });
    if (existingLeave) {
      throw new AppError(409, "This doctor is already marked on leave for that date");
    }

    const leaveDay = await tx.leaveDay.create({ data: { doctorId, date, reason } });

    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    await tx.slotHold.deleteMany({
      where: { doctorId, slotStart: { gte: date, lt: dayEnd } },
    });

    const affectedAppointments = await tx.appointment.findMany({
      where: { doctorId, slotStart: { gte: date, lt: dayEnd }, status: "BOOKED" },
      include: { patient: { select: { name: true } } },
    });
    affectedAppointmentIds = affectedAppointments.map((appointment) => appointment.id);

    if (affectedAppointments.length > 0) {
      await tx.appointment.updateMany({
        where: { id: { in: affectedAppointmentIds } },
        data: { status: "CANCELLED_BY_LEAVE" },
      });

      for (const appointment of affectedAppointments) {
        await notificationService.createNotification(
          {
            channel: "EMAIL",
            type: "LEAVE_NOTICE",
            recipientId: appointment.patientId,
            payload: {
              appointmentId: appointment.id,
              doctorName: doctor.user.name,
              patientName: appointment.patient.name,
              slotStart: appointment.slotStart.toISOString(),
              reason: reason ?? null,
            },
          },
          tx,
        );
      }
    }

    return { leaveDay, cancelledAppointmentCount: affectedAppointments.length };
  });

  notificationService.triggerBestEffortDelivery();
  for (const appointmentId of affectedAppointmentIds) {
    calendarService.deleteEventForAppointment(appointmentId).catch(() => {});
  }

  return result;
}

module.exports = { markDoctorOnLeave };
