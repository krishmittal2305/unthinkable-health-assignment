const nodemailer = require("nodemailer");

let transporter;

// Lazily built so a missing/invalid SMTP config doesn't crash the app at
// startup — it only surfaces as a failed send, which notificationService
// already handles gracefully (logged, retried, never thrown at the caller).
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER;
  return getTransporter().sendMail({ from, to, subject, text, html });
}

module.exports = { sendMail };
