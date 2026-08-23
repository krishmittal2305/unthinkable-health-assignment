-- DropIndex
DROP INDEX "Appointment_doctorId_slotStart_key";

-- Partial unique index: only appointments that actually occupy a slot
-- (BOOKED or COMPLETED) participate in the uniqueness check, so a
-- cancelled appointment frees its slot for rebooking instead of
-- permanently blocking it. This is the real double-booking guard —
-- concurrent inserts for the same doctor+slot+active-status collide on
-- this index and the loser gets a unique_violation, which the booking
-- service (Step 6) turns into a 409 Conflict.
CREATE UNIQUE INDEX "Appointment_doctorId_slotStart_active_key"
  ON "Appointment" ("doctorId", "slotStart")
  WHERE "status" IN ('BOOKED', 'COMPLETED');
