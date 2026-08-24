function formatSlot(isoString) {
  return new Date(isoString).toUTCString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapHtml(title, bodyHtml) {
  return [
    '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #201e1d;">',
    '<div style="background: #ec3013; color: #ffffff; padding: 16px 20px; font-size: 18px; font-weight: 700;">',
    escapeHtml(title),
    "</div>",
    '<div style="padding: 20px; border: 1px solid #d7d3d3; border-top: none;">',
    bodyHtml,
    '<p style="margin-top: 24px; font-size: 12px; color: #7d7979;">— Clinic Appointment Manager</p>',
    "</div>",
    "</div>",
  ].join("");
}

function detailRow(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<p style="margin: 4px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function listItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<ul style="margin: 8px 0; padding-left: 20px;">${items
    .map((item) => `<li style="margin: 4px 0;">${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

const TEMPLATES = {
  BOOKING_CONFIRMATION: (payload, recipientName) => ({
    subject: "Appointment confirmed",
    text: [
      `Hi ${recipientName},`,
      "",
      `Your appointment is confirmed for ${formatSlot(payload.slotStart)}.`,
      `Doctor: ${payload.doctorName} (${payload.specialisation})`,
      `Appointment ID: ${payload.appointmentId}`,
      payload.symptoms ? `Symptoms reported: ${payload.symptoms}` : null,
      payload.severity ? `Severity: ${payload.severity}` : null,
      payload.durationDays ? `Duration so far: ${payload.durationDays} day(s)` : null,
      "",
      "Your doctor will review your symptoms ahead of the visit.",
      "",
      "— Clinic Appointment Manager",
    ]
      .filter(Boolean)
      .join("\n"),
    html: wrapHtml(
      "Appointment confirmed",
      [
        `<p>Hi ${escapeHtml(recipientName)},</p>`,
        `<p>Your appointment is confirmed for <strong>${escapeHtml(formatSlot(payload.slotStart))}</strong>.</p>`,
        detailRow("Doctor", `${payload.doctorName} (${payload.specialisation})`),
        detailRow("Appointment ID", payload.appointmentId),
        detailRow("Symptoms reported", payload.symptoms),
        detailRow("Severity", payload.severity),
        detailRow("Duration so far", payload.durationDays ? `${payload.durationDays} day(s)` : null),
        "<p>Your doctor will review your symptoms ahead of the visit.</p>",
      ].join(""),
    ),
  }),

  DOCTOR_NEW_BOOKING: (payload, recipientName) => ({
    subject: "New appointment booked",
    text: [
      `Hi Dr. ${recipientName},`,
      "",
      `A new appointment has been booked for ${formatSlot(payload.slotStart)}.`,
      `Patient: ${payload.patientName}`,
      payload.patientEmail ? `Patient email: ${payload.patientEmail}` : null,
      payload.patientPhone ? `Patient phone: ${payload.patientPhone}` : null,
      `Appointment ID: ${payload.appointmentId}`,
      payload.symptoms ? `Symptoms reported: ${payload.symptoms}` : null,
      payload.severity ? `Severity: ${payload.severity}` : null,
      payload.durationDays ? `Duration so far: ${payload.durationDays} day(s)` : null,
      "",
      payload.urgencyLevel ? `AI pre-visit urgency: ${payload.urgencyLevel}` : null,
      payload.chiefComplaint ? `AI chief complaint summary: ${payload.chiefComplaint}` : null,
      Array.isArray(payload.suggestedQuestions) && payload.suggestedQuestions.length
        ? `Suggested questions:\n${payload.suggestedQuestions.map((q) => `- ${q}`).join("\n")}`
        : null,
      "",
      "— Clinic Appointment Manager",
    ]
      .filter(Boolean)
      .join("\n"),
    html: wrapHtml(
      "New appointment booked",
      [
        `<p>Hi Dr. ${escapeHtml(recipientName)},</p>`,
        `<p>A new appointment has been booked for <strong>${escapeHtml(formatSlot(payload.slotStart))}</strong>.</p>`,
        detailRow("Patient", payload.patientName),
        detailRow("Patient email", payload.patientEmail),
        detailRow("Patient phone", payload.patientPhone),
        detailRow("Appointment ID", payload.appointmentId),
        detailRow("Symptoms reported", payload.symptoms),
        detailRow("Severity", payload.severity),
        detailRow("Duration so far", payload.durationDays ? `${payload.durationDays} day(s)` : null),
        payload.urgencyLevel || payload.chiefComplaint
          ? '<h3 style="margin: 16px 0 4px;">AI pre-visit summary</h3>'
          : "",
        detailRow("Urgency", payload.urgencyLevel),
        detailRow("Chief complaint", payload.chiefComplaint),
        Array.isArray(payload.suggestedQuestions) && payload.suggestedQuestions.length
          ? `<p style="margin: 8px 0 0;"><strong>Suggested questions:</strong></p>${listItems(payload.suggestedQuestions)}`
          : "",
      ].join(""),
    ),
  }),

  ACCOUNT_CREATED: (payload, recipientName) => {
    const isPatient = payload.role === "PATIENT";
    return {
      subject: "Welcome to Clinic Appointment Manager",
      text: [
        `Hi ${recipientName},`,
        "",
        isPatient
          ? "Your patient account has been created. Log in to search doctors and book an appointment."
          : `Your ${payload.role?.toLowerCase()} account has been created by an admin. Log in with the credentials your admin gave you.`,
        "",
        "— Clinic Appointment Manager",
      ].join("\n"),
      html: wrapHtml(
        "Welcome to Clinic Appointment Manager",
        [
          `<p>Hi ${escapeHtml(recipientName)},</p>`,
          `<p>${
            isPatient
              ? "Your patient account has been created. Log in to search doctors and book an appointment."
              : `Your ${escapeHtml(payload.role?.toLowerCase())} account has been created by an admin. Log in with the credentials your admin gave you.`
          }</p>`,
        ].join(""),
      ),
    };
  },

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
    html: wrapHtml(
      "Upcoming appointment reminder",
      [
        `<p>Hi ${escapeHtml(recipientName)},</p>`,
        `<p>This is a reminder of your upcoming appointment at <strong>${escapeHtml(formatSlot(payload.slotStart))}</strong>.</p>`,
        detailRow("Doctor", `${payload.doctorName} (${payload.specialisation})`),
      ].join(""),
    ),
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
    html: wrapHtml(
      "Appointment cancelled",
      [
        `<p>Hi ${escapeHtml(recipientName)},</p>`,
        `<p>The appointment scheduled for <strong>${escapeHtml(formatSlot(payload.slotStart))}</strong> has been cancelled.</p>`,
        detailRow("Doctor", payload.doctorName),
        detailRow("Patient", payload.patientName),
        detailRow("Reason", payload.reason),
      ].join(""),
    ),
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
    html: wrapHtml(
      "Appointment cancelled (doctor on leave)",
      [
        `<p>Hi ${escapeHtml(recipientName)},</p>`,
        `<p>Unfortunately Dr. ${escapeHtml(payload.doctorName)} is unavailable on <strong>${escapeHtml(formatSlot(payload.slotStart))}</strong>, so your appointment has been cancelled.</p>`,
        detailRow("Reason", payload.reason),
        "<p>Please book a new slot at your convenience.</p>",
      ].join(""),
    ),
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
    html: wrapHtml(
      "Medication reminder",
      [
        `<p>Hi ${escapeHtml(recipientName)},</p>`,
        `<p>It's time to take: <strong>${escapeHtml(payload.drugName)} (${escapeHtml(payload.dosage)})</strong>.</p>`,
      ].join(""),
    ),
  }),

  POST_VISIT_SUMMARY: (payload, recipientName) => {
    const schedule = Array.isArray(payload.medicationSchedule) ? payload.medicationSchedule : [];
    return {
      subject: "Your visit summary is ready",
      text: [
        `Hi ${recipientName},`,
        "",
        payload.isFallback
          ? "Your doctor's visit notes are below (an AI-simplified summary wasn't available this time):"
          : "Here's a plain-language summary of your visit:",
        "",
        payload.summaryText ?? "",
        "",
        schedule.length
          ? `Medication schedule:\n${schedule.map((m) => `- ${m.drug}: ${m.instructions}`).join("\n")}`
          : null,
        Array.isArray(payload.followUpSteps) && payload.followUpSteps.length
          ? `Follow-up steps:\n${payload.followUpSteps.map((s) => `- ${s}`).join("\n")}`
          : null,
        "",
        "— Clinic Appointment Manager",
      ]
        .filter(Boolean)
        .join("\n"),
      html: wrapHtml(
        "Your visit summary is ready",
        [
          `<p>Hi ${escapeHtml(recipientName)},</p>`,
          `<p>${
            payload.isFallback
              ? "Your doctor's visit notes are below (an AI-simplified summary wasn't available this time):"
              : "Here's a plain-language summary of your visit:"
          }</p>`,
          `<p style="white-space: pre-wrap;">${escapeHtml(payload.summaryText)}</p>`,
          schedule.length
            ? [
                '<h3 style="margin: 16px 0 4px;">Medication schedule</h3>',
                '<table style="border-collapse: collapse; width: 100%;">',
                '<tr><th style="text-align: left; border-bottom: 1px solid #d7d3d3; padding: 4px;">Drug</th><th style="text-align: left; border-bottom: 1px solid #d7d3d3; padding: 4px;">Instructions</th></tr>',
                schedule
                  .map(
                    (m) =>
                      `<tr><td style="padding: 4px; border-bottom: 1px solid #eae7e7;">${escapeHtml(m.drug)}</td><td style="padding: 4px; border-bottom: 1px solid #eae7e7;">${escapeHtml(m.instructions)}</td></tr>`,
                  )
                  .join(""),
                "</table>",
              ].join("")
            : "",
          Array.isArray(payload.followUpSteps) && payload.followUpSteps.length
            ? `<h3 style="margin: 16px 0 4px;">Follow-up steps</h3>${listItems(payload.followUpSteps)}`
            : "",
        ].join(""),
      ),
    };
  },
};

function renderEmail(type, payload, recipientName) {
  const render = TEMPLATES[type];
  if (!render) {
    throw new Error(`No email template for notification type: ${type}`);
  }
  return render(payload, recipientName);
}

module.exports = { renderEmail };
