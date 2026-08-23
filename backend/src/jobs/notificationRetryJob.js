const notificationService = require("../services/notificationService");

async function runNotificationRetrySweep() {
  const count = await notificationService.deliverPendingNotifications();
  if (count > 0) {
    console.log(`[notificationRetryJob] processed ${count} notification(s)`);
  }
}

module.exports = { runNotificationRetrySweep };
