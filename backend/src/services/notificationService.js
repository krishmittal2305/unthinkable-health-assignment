const { prisma } = require("../lib/prisma");
const { sendMail } = require("../lib/mailer");
const { renderEmail } = require("./emailService");

const MAX_RETRIES = 5;

// `client` is either the top-level `prisma` client or a `tx` inside an
// active transaction — callers that need the notification row to commit
// atomically with other writes (e.g. leaveService cancelling appointments)
// pass their `tx`; everything else just uses the default.
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

    const { subject, text } = renderEmail(notification.type, notification.payload, recipient.name);

    await sendMail({ to: recipient.email, subject: notification.subject ?? subject, text });

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

// Sweeps every EMAIL notification that's still eligible for delivery.
// Called opportunistically right after enqueueing (fast path for the common
// case) and periodically by the Step 9 cron job (the reliable fallback for
// anything that failed or whose opportunistic attempt never ran).
async function deliverPendingNotifications() {
  const deliverable = await prisma.notificationLog.findMany({
    where: {
      channel: "EMAIL",
      status: { in: ["PENDING", "FAILED"] },
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const notification of deliverable) {
    await deliverNotification(notification.id);
  }

  return deliverable.length;
}

// Fire-and-forget trigger for use in request handlers: never awaited by the
// caller, never lets an email failure surface as a 500 on an unrelated
// request (booking/cancelling/leave-marking must succeed regardless of
// whether the email happens to go out immediately).
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
