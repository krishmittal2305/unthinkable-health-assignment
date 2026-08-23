const { AppError } = require("../lib/errors");
const { env } = require("../lib/env");
const { prisma } = require("../lib/prisma");
const calendarService = require("../services/calendarService");

async function connect(req, res) {
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.userId } });
  if (!doctorProfile) {
    throw new AppError(404, "Doctor profile not found");
  }

  const authUrl = calendarService.getAuthUrl(doctorProfile.id);
  res.json({ authUrl });
}

// Hit directly by Google's redirect — no Authorization header, so this route
// is intentionally public. Identity/authorization for *which doctor* comes
// from the signed `state` param, verified inside handleOAuthCallback.
async function callback(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`${env.frontendUrl}/doctor/calendar?status=error&reason=${encodeURIComponent(oauthError)}`);
  }
  if (typeof code !== "string" || typeof state !== "string") {
    throw new AppError(400, "Missing code or state");
  }

  await calendarService.handleOAuthCallback(code, state);
  res.redirect(`${env.frontendUrl}/doctor/calendar?status=connected`);
}

module.exports = { connect, callback };
