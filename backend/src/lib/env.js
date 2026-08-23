require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get jwtSecret() {
    return required("JWT_SECRET");
  },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  // Deliberately NOT `required()` — an unconfigured LLM must degrade to the
  // fallback summary, never crash the app. llmService treats a missing
  // endpoint/apiKey/deployment as "skip the call, go straight to fallback."
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview",
  },
};

module.exports = { env };
