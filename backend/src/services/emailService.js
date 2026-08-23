function formatSlot(isoString) {
  return new Date(isoString).toUTCString();
}

const TEMPLATES = {
  BOOKING_CONFIRMATION: (payload, recipientName) => ({
    subject: "Appointment confirmed",
    text: [
      `Hi ${recipientName},`,
      "",
      `An appointment is confirmed for ${formatSlot(payload.slotStart)}.`,
      `Doctor: ${payload.doctorName} (${payload.specialisation})`,
      payload.patientName ? `Patient: ${payload.patientName}` : null,
      "",
      "— Clinic Appointment Manager",
    ]
      .filter(Boolean)
      .join("\n"),
  }),

  APPOINTMENT_REMINDER: (payload, recipientName) => ({
    subject: "Upcoming appointment reminder",
    text: [
      `Hi ${recipientName},`,
      "",
      `This is a reminder of your upcoming appointment at ${formatSlot(payload.slotStart)}.`,
      `Doctor: ${payload.doctorName} (${payload.specialisation})`,
      "",
      "— Clinic Appointment Manager",
    ].join("\n"),
  }),

  CANCELLATION: (payload, recipientName) => ({
    subject: "Appointment cancelled",
    text: [
      `Hi ${recipientName},`,
      "",
      `The appointment scheduled for ${formatSlot(payload.slotStart)} has been cancelled.`,
      payload.doctorName ? `Doctor: ${payload.doctorName}` : null,
      payload.patientName ? `Patient: ${payload.patientName}` : null,
      payload.reason ? `Reason: ${payload.reason}` : null,
      "",
      "— Clinic Appointment Manager",
    ]
      .filter(Boolean)
      .join("\n"),
  }),

  LEAVE_NOTICE: (payload, recipientName) => ({
    subject: "Your appointment has been cancelled (doctor on leave)",
    text: [
      `Hi ${recipientName},`,
      "",
      `Unfortunately Dr. ${payload.doctorName} is unavailable on ${formatSlot(payload.slotStart)}, so your appointment has been cancelled.`,
      payload.reason ? `Reason: ${payload.reason}` : null,
      "Please book a new slot at your convenience.",
      "",
      "— Clinic Appointment Manager",
    ]
      .filter(Boolean)
      .join("\n"),
  }),

  MEDICATION_REMINDER: (payload, recipientName) => ({
    subject: "Medication reminder",
    text: [
      `Hi ${recipientName},`,
      "",
      `It's time to take: ${payload.drugName} (${payload.dosage}).`,
      "",
      "— Clinic Appointment Manager",
    ].join("\n"),
  }),
};

function renderEmail(type, payload, recipientName) {
  const render = TEMPLATES[type];
  if (!render) {
    throw new Error(`No email template for notification type: ${type}`);
  }
  return render(payload, recipientName);
}

module.exports = { renderEmail };
