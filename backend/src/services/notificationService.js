const { prisma } = require("../lib/prisma");
const { sendMail } = require("../lib/mailer");
const { renderEmail } = require("./emailService");

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 60_000;

function isEligibleForRetry(notification) {
  if (notification.status === "PENDING") return true;
  const backoffMs = BACKOFF_BASE_MS * 2 ** notification.retryCount;
  return Date.now() - notification.updatedAt.getTime() >= backoffMs;
}

async function createNotification(data, client = prisma) {
  return client.notificationLog.create({ data });
}

async function deliverNotification(notificationId) {
  const notification = await prisma.notificationLog.findUnique({ where: { id: notificationId } });
  if (!notification || notification.status === "SENT") {
    return;
  }

  try {
    const recipient = await prisma.user.findUnique({ where: { id: notification.recipientId } });
    if (!recipient) {
      throw new Error(`Notification recipient ${notification.recipientId} no longer exists`);
    }

    const { subject, text, html } = renderEmail(notification.type, notification.payload, recipient.name);

    await sendMail({ to: recipient.email, subject: notification.subject ?? subject, text, html });

    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: { status: "SENT", lastError: null },
    });
  } catch (error) {
    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: {
        status: "FAILED",
        retryCount: { increment: 1 },
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function deliverPendingNotifications() {
  const candidates = await prisma.notificationLog.findMany({
    where: {
      channel: "EMAIL",
      status: { in: ["PENDING", "FAILED"] },
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const deliverable = candidates.filter(isEligibleForRetry).slice(0, 50);

  for (const notification of deliverable) {

    try {
      await deliverNotification(notification.id);
    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error);
    }
  }

  return deliverable.length;
}

function triggerBestEffortDelivery() {
  deliverPendingNotifications().catch((error) => {
    console.error("Background notification delivery failed:", error);
  });
}

module.exports = {
  MAX_RETRIES,
  createNotification,
  deliverNotification,
  deliverPendingNotifications,
  triggerBestEffortDelivery,
};
