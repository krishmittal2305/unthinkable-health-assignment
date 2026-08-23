-- DropIndex
DROP INDEX "Appointment_doctorId_slotStart_key";

CREATE UNIQUE INDEX "Appointment_doctorId_slotStart_active_key"
  ON "Appointment" ("doctorId", "slotStart")
  WHERE "status" IN ('BOOKED', 'COMPLETED');
