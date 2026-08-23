const { google } = require("googleapis");
const { env } = require("./env");

function isGoogleConfigured() {
  const { clientId, clientSecret, redirectUri } = env.google;
  return Boolean(clientId && clientSecret && redirectUri);
}

// A fresh client per call — this app is stateless per-request, and OAuth2
// clients are cheap to construct. Callers set credentials on the instance
// they get back.
function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = env.google;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

module.exports = { isGoogleConfigured, createOAuth2Client };
