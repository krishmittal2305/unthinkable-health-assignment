const { AzureOpenAI } = require("openai");
const { env } = require("../lib/env");

const LLM_TIMEOUT_MS = 15_000;

let client;
let clientInitAttempted = false;

function getClient() {
  if (clientInitAttempted) return client;
  clientInitAttempted = true;

  const { endpoint, apiKey, deployment, apiVersion } = env.azureOpenAI;
  if (!endpoint || !apiKey || !deployment) {
    console.warn("[llmService] Azure OpenAI not configured — LLM summaries will use fallback text.");
    return null;
  }

  client = new AzureOpenAI({
    endpoint,
    apiKey,
    deployment,
    apiVersion,
    timeout: LLM_TIMEOUT_MS,
    maxRetries: 2,
  });
  return client;
}

function normalizeUrgency(value) {
  const upper = String(value ?? "").toUpperCase();
  return ["LOW", "MEDIUM", "HIGH"].includes(upper) ? upper : null;
}

async function callJsonCompletion(systemPrompt, userPrompt) {
  const openaiClient = getClient();
  if (!openaiClient) {
    throw new Error("Azure OpenAI is not configured");
  }

  const response = await openaiClient.chat.completions.create({
    model: env.azureOpenAI.deployment,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty LLM response");
  }

  return { parsed: JSON.parse(content), raw: content };
}

const PRE_VISIT_SYSTEM_PROMPT = [
  "You are a clinical intake assistant helping a doctor prepare for a patient visit.",
  'Respond ONLY with a single JSON object, no markdown fences, no prose, with exactly these keys:',
  '{"urgencyLevel": "Low" | "Medium" | "High", "chiefComplaint": string, "suggestedQuestions": [string, string, string]}',
].join(" ");

function preVisitFallback(symptoms) {
  return {
    isFallback: true,
    urgencyLevel: "MEDIUM",
    chiefComplaint: symptoms.length > 200 ? `${symptoms.slice(0, 200)}…` : symptoms,
    suggestedQuestions: [
      "Can you describe your symptoms in more detail?",
      "When did the symptoms start, and have they changed?",
      "Have you taken any medication for this, and did it help?",
    ],
    rawResponse: null,
  };
}

async function generatePreVisitSummary(symptoms) {
  const userPrompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}`;

  try {
    const { parsed, raw } = await callJsonCompletion(PRE_VISIT_SYSTEM_PROMPT, userPrompt);

    const urgencyLevel = normalizeUrgency(parsed.urgencyLevel);
    const chiefComplaint = typeof parsed.chiefComplaint === "string" ? parsed.chiefComplaint.trim() : "";
    const suggestedQuestions = Array.isArray(parsed.suggestedQuestions)
      ? parsed.suggestedQuestions.filter((q) => typeof q === "string" && q.trim()).slice(0, 3)
      : [];

    if (!urgencyLevel || !chiefComplaint || suggestedQuestions.length !== 3) {
      throw new Error(`Malformed LLM response shape: ${raw}`);
    }

    return { isFallback: false, urgencyLevel, chiefComplaint, suggestedQuestions, rawResponse: raw };
  } catch (error) {
    console.error("[llmService] generatePreVisitSummary failed, using fallback:", error.message);
    return preVisitFallback(symptoms);
  }
}

const POST_VISIT_SYSTEM_PROMPT = [
  "You are a medical assistant translating a doctor's clinical notes into a patient-friendly summary.",
  'Respond ONLY with a single JSON object, no markdown fences, no prose, with exactly these keys:',
  '{"summaryText": string, "medicationSchedule": [{"drug": string, "instructions": string}], "followUpSteps": [string]}',
  "Use plain, reassuring, non-technical language a patient without medical training can understand.",
].join(" ");

function postVisitFallback(notes) {
  return {
    isFallback: true,
    summaryText:
      "We couldn't generate an AI-simplified summary right now. Here are the doctor's original notes:\n\n" + notes,
    medicationSchedule: null,
    followUpSteps: [],
    rawResponse: null,
  };
}

async function generatePostVisitSummary(notes) {
  const userPrompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}`;

  try {
    const { parsed, raw } = await callJsonCompletion(POST_VISIT_SYSTEM_PROMPT, userPrompt);

    const summaryText = typeof parsed.summaryText === "string" ? parsed.summaryText.trim() : "";
    if (!summaryText) {
      throw new Error(`Malformed LLM response shape: ${raw}`);
    }

    const medicationSchedule = Array.isArray(parsed.medicationSchedule) ? parsed.medicationSchedule : null;
    const followUpSteps = Array.isArray(parsed.followUpSteps)
      ? parsed.followUpSteps.filter((step) => typeof step === "string" && step.trim())
      : [];

    return { isFallback: false, summaryText, medicationSchedule, followUpSteps, rawResponse: raw };
  } catch (error) {
    console.error("[llmService] generatePostVisitSummary failed, using fallback:", error.message);
    return postVisitFallback(notes);
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
