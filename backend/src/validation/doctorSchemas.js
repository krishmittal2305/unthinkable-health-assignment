const { z } = require("zod");

// workingHours: { mon: ["09:00","17:00"], tue: [...], ... } — missing/absent day = not working.
const dayHoursSchema = z.tuple([
  z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
]);

const workingHoursSchema = z
  .object({
    mon: dayHoursSchema.optional(),
    tue: dayHoursSchema.optional(),
    wed: dayHoursSchema.optional(),
    thu: dayHoursSchema.optional(),
    fri: dayHoursSchema.optional(),
    sat: dayHoursSchema.optional(),
    sun: dayHoursSchema.optional(),
  })
  .refine((hours) => Object.keys(hours).length > 0, "At least one working day is required");

const createDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  phone: z.string().optional(),
  specialisation: z.string().min(1),
  workingHours: workingHoursSchema,
  slotDurationMins: z.number().int().positive().default(30),
});

const updateDoctorProfileSchema = z.object({
  specialisation: z.string().min(1).optional(),
  workingHours: workingHoursSchema.optional(),
  slotDurationMins: z.number().int().positive().optional(),
});

const leaveDaySchema = z.object({
  date: z.coerce.date(),
  reason: z.string().optional(),
});

module.exports = {
  createDoctorSchema,
  updateDoctorProfileSchema,
  leaveDaySchema,
};
