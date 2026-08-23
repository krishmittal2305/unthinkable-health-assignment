# LLM Prompts

Implementation: [backend/src/services/llmService.js](../backend/src/services/llmService.js), via
Azure OpenAI (`AzureOpenAI` client from the `openai` SDK). Both calls request strict JSON output
(`response_format: { type: "json_object" }`) so the response is structurally parseable, not free text.

## Pre-visit summary

Used in `generatePreVisitSummary(symptoms)`, called right after a booking is confirmed
(`appointmentService.confirmBooking`), storing the result as `PreVisitSummary`.

**System prompt:**
> You are a clinical intake assistant helping a doctor prepare for a patient visit. Respond ONLY with a
> single JSON object, no markdown fences, no prose, with exactly these keys:
> `{"urgencyLevel": "Low" | "Medium" | "High", "chiefComplaint": string, "suggestedQuestions": [string, string, string]}`

**User prompt** (exact text from the assignment brief, with `<symptoms>` interpolated):
> Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three
> suggested questions for the doctor. Symptoms: `<symptoms>`

**Validation before trusting the response:** `urgencyLevel` must normalize to `LOW`/`MEDIUM`/`HIGH`,
`chiefComplaint` must be a non-empty string, `suggestedQuestions` must contain exactly 3 non-empty
strings. Any deviation (malformed JSON, wrong enum value, missing field) is treated as a failure and
routed to the fallback below — the response is never partially trusted.

**Fallback** (used when Azure OpenAI is unconfigured, times out, errors, or returns something that
fails validation):
- `urgencyLevel: "MEDIUM"` — a deliberately safe default so an LLM outage never silently under-triages
  a patient
- `chiefComplaint`: the patient's raw symptom text (truncated to 200 chars)
- `suggestedQuestions`: three generic clinical intake questions
- `isFallback: true` is stored alongside the summary so the UI can label it as such to the doctor

## Post-visit summary

Used in `generatePostVisitSummary(notes)`, called after the doctor submits clinical notes
(`postVisitService.submitPostVisitNotes`), storing the result as `PostVisitSummary`.

**System prompt:**
> You are a medical assistant translating a doctor's clinical notes into a patient-friendly summary.
> Respond ONLY with a single JSON object, no markdown fences, no prose, with exactly these keys:
> `{"summaryText": string, "medicationSchedule": [{"drug": string, "instructions": string}], "followUpSteps": [string]}`
> Use plain, reassuring, non-technical language a patient without medical training can understand.

**User prompt** (exact text from the assignment brief, with `<notes>` interpolated):
> Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up
> steps: `<notes>`

**Validation:** `summaryText` must be a non-empty string; `medicationSchedule`/`followUpSteps` are
coerced to arrays (or `null`/`[]`) rather than trusted blindly.

**Fallback:** `summaryText` echoes the doctor's original raw notes prefixed with an explanation that the
AI summary wasn't available — the patient still gets the substance of the visit, just not simplified.
`medicationSchedule: null`, `followUpSteps: []`, `isFallback: true`.

## Failure handling contract

Both functions:
- run with a 15-second timeout and `maxRetries: 0` on the SDK (one attempt; retrying is this app's own
  fallback logic, not the SDK's backoff)
- **never throw** — every failure path (unconfigured client, network error, timeout, malformed/invalid
  JSON) resolves to the labeled fallback object above
- are called *after* their triggering DB transaction commits, never inside one — an LLM call is slow
  external I/O and must not hold a transaction (and its row locks) open

This means a booking or a post-visit note submission always succeeds regardless of Azure OpenAI's
availability; only the AI summary quality degrades, clearly labeled via `isFallback`.
