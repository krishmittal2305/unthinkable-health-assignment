const { prisma } = require("../lib/prisma");

async function runSlotHoldCleanup() {
  const { count } = await prisma.slotHold.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (count > 0) {
    console.log(`[slotHoldCleanupJob] removed ${count} expired hold(s)`);
  }
}

module.exports = { runSlotHoldCleanup };
