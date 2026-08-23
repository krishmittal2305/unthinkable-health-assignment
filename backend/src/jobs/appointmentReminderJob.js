const { prisma } = require("../lib/prisma");
const notificationService = require("../services/notificationService");

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // remind once an appointment is within 24h

// Finds BOOKED appointments starting within the next 24h that haven't been
// reminded yet, queues an APPOINTMENT_REMINDER for both patient and doctor,
// and marks reminderSentAt so re-running this job never double-sends —
// correct regardless of how often the cron actually fires.
async function runAppointmentReminderDispatch() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const dueAppointments = await prisma.appointment.findMany({
    where: {
      status: "BOOKED",
      reminderSentAt: null,
      slotStart: { gt: now, lte: windowEnd },
    },
    include: {
      patient: { select: { name: true } },
      doctorProfile: { select: { specialisation: true, user: { select: { id: true, name: true } } } },
    },
  });

  for (const appointment of dueAppointments) {
    const payload = {
      appointmentId: appointment.id,
      doctorName: appointment.doctorProfile.user.name,
      patientName: appointment.patient.name,
      specialisation: appointment.doctorProfile.specialisation,
      slotStart: appointment.slotStart.toISOString(),
    };

    await notificationService.createNotification({
      channel: "EMAIL",
      type: "APPOINTMENT_REMINDER",
      recipientId: appointment.patientId,
      payload,
    });
    await notificationService.createNotification({
      channel: "EMAIL",
      type: "APPOINTMENT_REMINDER",
      recipientId: appointment.doctorProfile.user.id,
      payload,
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSentAt: now },
    });
  }

  if (dueAppointments.length > 0) {
    console.log(`[appointmentReminderJob] queued reminders for ${dueAppointments.length} appointment(s)`);
    notificationService.triggerBestEffortDelivery();
  }
}

module.exports = { runAppointmentReminderDispatch };
