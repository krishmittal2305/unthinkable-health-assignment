const cron = require("node-cron");
const { runNotificationRetrySweep } = require("./notificationRetryJob");
const { runSlotHoldCleanup } = require("./slotHoldCleanupJob");
const { runAppointmentReminderDispatch } = require("./appointmentReminderJob");
const { runMedicationReminderDispatch } = require("./medicationReminderJob");

function safeJob(name, fn) {
  return async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`[scheduler] job "${name}" failed:`, error);
    }
  };
}

function startBackgroundJobs() {
  cron.schedule("* * * * *", safeJob("slotHoldCleanup", runSlotHoldCleanup));
  cron.schedule("*/2 * * * *", safeJob("notificationRetrySweep", runNotificationRetrySweep));
  cron.schedule("*/5 * * * *", safeJob("medicationReminderDispatch", runMedicationReminderDispatch));
  cron.schedule("*/15 * * * *", safeJob("appointmentReminderDispatch", runAppointmentReminderDispatch));

  console.log("[scheduler] background jobs registered");
}

module.exports = { startBackgroundJobs };
