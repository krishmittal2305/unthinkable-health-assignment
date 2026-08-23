const { prisma } = require("../lib/prisma");

// Reliable fallback for stale SlotHold rows. createHold() already clears a
// stale hold on the exact slot it's about to take, opportunistically — this
// sweep is what guarantees expired holds don't linger indefinitely on slots
// nobody happens to retry (they'd otherwise sit there for up to their 5-min
// TTL plus however long until someone else tries that same slot).
async function runSlotHoldCleanup() {
  const { count } = await prisma.slotHold.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (count > 0) {
    console.log(`[slotHoldCleanupJob] removed ${count} expired hold(s)`);
  }
}

module.exports = { runSlotHoldCleanup };
