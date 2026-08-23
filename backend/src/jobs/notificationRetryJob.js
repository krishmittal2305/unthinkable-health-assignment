const notificationService = require("../services/notificationService");

// Reliable fallback for email delivery: notificationService.triggerBestEffortDelivery()
// already fires opportunistically right after booking/cancelling/leave-marking, but this
// sweep is what actually guarantees delivery — it catches anything that opportunistic
// attempt missed (process restarted mid-send, transient SMTP outage, etc.), respecting
// the same exponential backoff and MAX_RETRIES cap.
async function runNotificationRetrySweep() {
  const count = await notificationService.deliverPendingNotifications();
  if (count > 0) {
    console.log(`[notificationRetryJob] processed ${count} notification(s)`);
  }
}

module.exports = { runNotificationRetrySweep };
