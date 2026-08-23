const { google } = require("googleapis");
const { env } = require("./env");

function isGoogleConfigured() {
  const { clientId, clientSecret, redirectUri } = env.google;
  return Boolean(clientId && clientSecret && redirectUri);
}

function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = env.google;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

module.exports = { isGoogleConfigured, createOAuth2Client };
