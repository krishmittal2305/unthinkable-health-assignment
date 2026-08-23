const { z } = require("zod");

const postVisitNotesSchema = z.object({
  clinicalNotes: z.string().min(1, "Clinical notes are required"),
  prescriptions: z
    .array(
      z.object({
        drugName: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        durationDays: z.number().int().positive(),
      }),
    )
    .default([]),
});

module.exports = { postVisitNotesSchema };
