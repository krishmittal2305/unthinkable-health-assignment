const { prisma } = require("../lib/prisma");
const notificationService = require("../services/notificationService");

async function runMedicationReminderDispatch() {
  const dueReminders = await prisma.medicationReminder.findMany({
    where: { sent: false, remindAt: { lte: new Date() } },
    include: {
      prescription: { select: { drugName: true, dosage: true } },
      appointment: { select: { patientId: true } },
    },
  });

  for (const reminder of dueReminders) {
    await notificationService.createNotification({
      channel: "EMAIL",
      type: "MEDICATION_REMINDER",
      recipientId: reminder.appointment.patientId,
      payload: {
        drugName: reminder.prescription.drugName,
        dosage: reminder.prescription.dosage,
      },
    });

    await prisma.medicationReminder.update({
      where: { id: reminder.id },
      data: { sent: true },
    });
  }

  if (dueReminders.length > 0) {
    console.log(`[medicationReminderJob] queued ${dueReminders.length} medication reminder(s)`);
    notificationService.triggerBestEffortDelivery();
  }
}

module.exports = { runMedicationReminderDispatch };
