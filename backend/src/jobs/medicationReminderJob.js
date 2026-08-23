const { prisma } = require("../lib/prisma");
const notificationService = require("../services/notificationService");

// Consumer half of medication reminders — Step 12 is the producer that
// creates MedicationReminder rows from a prescription's frequency; until
// that exists this simply finds nothing to do, which is correct behavior,
// not a stub.
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
