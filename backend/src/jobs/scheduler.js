const cron = require("node-cron");
const { runNotificationRetrySweep } = require("./notificationRetryJob");
const { runSlotHoldCleanup } = require("./slotHoldCleanupJob");
const { runAppointmentReminderDispatch } = require("./appointmentReminderJob");
const { runMedicationReminderDispatch } = require("./medicationReminderJob");

// Wraps a job so one throwing exception can't kill node-cron's internal
// scheduler loop or take down the process — matches the "system should not
// break" requirement that already governs LLM/email failure handling.
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
