const { AppError } = require("../lib/errors");
const { prisma } = require("../lib/prisma");
const llmService = require("./llmService");
const { buildReminderSchedule } = require("./medicationScheduler");

async function submitPostVisitNotes(doctorUserId, appointmentId, { clinicalNotes, prescriptions }) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.doctorUserId !== doctorUserId) {
    throw new AppError(404, "Appointment not found");
  }
  if (appointment.status !== "BOOKED") {
    throw new AppError(409, `Cannot submit post-visit notes for an appointment with status ${appointment.status}`);
  }

  const { postVisitNote } = await prisma.$transaction(async (tx) => {
    const note = await tx.postVisitNote.create({
      data: {
        appointmentId,
        doctorUserId,
        clinicalNotes,
        prescriptions: { create: prescriptions },
      },
      include: { prescriptions: true },
    });

    await tx.appointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } });

    return { postVisitNote: note };
  });

  // Reminder scheduling and the LLM summary are both best-effort follow-ups —
  // the visit itself is already recorded and the appointment already marked
  // COMPLETED regardless of what happens next.
  try {
    const now = new Date();
    for (const prescription of postVisitNote.prescriptions) {
      const reminderTimes = buildReminderSchedule(prescription.frequency, prescription.durationDays, now);
      if (reminderTimes.length > 0) {
        await prisma.medicationReminder.createMany({
          data: reminderTimes.map((remindAt) => ({
            appointmentId,
            prescriptionId: prescription.id,
            remindAt,
          })),
        });
      }
    }
  } catch (error) {
    console.error("Failed to schedule medication reminders (post-visit note still saved):", error);
  }

  let postVisitSummary = null;
  try {
    const summary = await llmService.generatePostVisitSummary(clinicalNotes);
    postVisitSummary = await prisma.postVisitSummary.create({
      data: {
        appointmentId,
        summaryText: summary.summaryText,
        medicationPlan: summary.medicationSchedule,
        followUpSteps: summary.followUpSteps,
        rawLlmResponse: summary.rawResponse,
        isFallback: summary.isFallback,
      },
    });
  } catch (error) {
    console.error("Failed to save post-visit summary (post-visit note still saved):", error);
  }

  return { postVisitNote, postVisitSummary };
}

module.exports = { submitPostVisitNotes };
