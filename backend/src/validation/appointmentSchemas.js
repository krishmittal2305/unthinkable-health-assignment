const { z } = require("zod");

const holdSlotSchema = z.object({
  doctorId: z.string().uuid(),
  slotStart: z.string().datetime({ message: "slotStart must be an ISO 8601 datetime" }),
});

const confirmBookingSchema = z.object({
  holdId: z.string().uuid(),
  symptoms: z.string().min(1, "Please describe the symptoms"),
  durationDays: z.number().int().positive().optional(),
  severity: z.string().optional(),
});

module.exports = { holdSlotSchema, confirmBookingSchema };
