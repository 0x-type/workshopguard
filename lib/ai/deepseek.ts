/**
 * DeepSeek provider (OpenAI-compatible chat completions API).
 *
 * The model is given the deterministic evaluation as FACTS IT MAY NOT
 * CONTRADICT, and is told explicitly that it must not promise a collection.
 * Its output is still checked by the guardrail afterwards — the prompt is a
 * request, the guardrail is the enforcement.
 */

import type { AiProvider, AnalyzeInput, AnalyzeOutput } from "@/lib/ai/provider";
import type { Intent } from "@/lib/types";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 20000);

const VALID_INTENTS: Intent[] = [
  "collection_request",
  "appointment_change",
  "status_question",
  "callback_request",
  "unknown",
];

function buildPrompt(input: AnalyzeInput): { system: string; user: string } {
  const e = input.evaluation;
  const facts = e
    ? [
        `Workshop work: ${e.workshopWork}`,
        `Quality check: ${e.qualityCheck}`,
        `CRM state: ${e.crmState}`,
        `Collection approval: ${e.collectionApproval}`,
        `Collection may be confirmed: ${e.collectionAllowed ? "yes" : "NO"}`,
        e.conflicts.length ? `Conflicts: ${e.conflicts.join(" ")}` : "Conflicts: none",
        e.blockers.length ? `Blockers: ${e.blockers.join(" ")}` : "Blockers: none",
      ].join("\n")
    : "No case record available.";

  const system = [
    "You work on a car dealership service desk. You write to customers on behalf of the service team.",
    "",
    "You do not decide anything. The facts below were computed by the dealership's systems and you must not contradict, soften or reinterpret them.",
    "",
    "HARD RULES:",
    "- If 'Collection may be confirmed' is NO, you must NOT say or imply the car can be collected, is ready, or give any collection time. Explain plainly what is still outstanding instead.",
    "- Never invent a date, a time, a price or a diagnosis.",
    "- Never mention internal systems, the CRM, or internal disagreements. Say 'a quality check is still in progress', not 'the CRM says X but Y'.",
    "- Write in the customer's preferred language.",
    "- Be brief, warm and concrete. No more than 120 words.",
    "",
    "Reply with STRICT JSON only, no markdown fences:",
    '{"intent": one of ["collection_request","appointment_change","status_question","callback_request","unknown"],',
    ' "confidence": 0..1,',
    ' "summary": "one or two sentences for the employee, in English",',
    ' "draft": "the message to the customer, in their preferred language"}',
  ].join("\n");

  const history = input.history.length
    ? input.history.map((h) => `- (${h.channel}) ${h.text}`).join("\n")
    : "- none";

  const user = [
    `Customer preferred language: ${input.customer?.preferredLanguage ?? "English"}`,
    `Contact permission: ${input.customer?.contactPermission ?? "unknown"}`,
    `Case reference: ${input.caseRecord?.id ?? "unknown"}`,
    `Dealership phone: ${input.dealershipPhone}`,
    "",
    "FACTS (authoritative, do not contradict):",
    facts,
    "",
    "Earlier messages on this case:",
    history,
    "",
    `New message (arrived by ${input.channel}):`,
    input.text,
  ].join("\n");

  return { system, user };
}

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Occasionally a model wraps JSON in prose. Take the outermost object.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export const deepseekProvider: AiProvider = {
  name: `deepseek (${MODEL})`,

  async analyze(input: AnalyzeInput): Promise<AnalyzeOutput> {
    const language = input.customer?.preferredLanguage ?? "unknown";
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return { intent: "unknown", confidence: 0, summary: "", language, error: "DEEPSEEK_API_KEY is not set." };
    }

    const { system, user } = buildPrompt(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          intent: "unknown",
          confidence: 0,
          summary: "",
          language,
          error: `DeepSeek returned ${res.status}. ${detail.slice(0, 160)}`,
        };
      }

      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        model?: string;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        return { intent: "unknown", confidence: 0, summary: "", language, error: "DeepSeek returned an empty response." };
      }

      const parsed = parseJson(content);
      if (!parsed) {
        return { intent: "unknown", confidence: 0, summary: "", language, error: "DeepSeek returned output that was not valid JSON." };
      }

      const intent = VALID_INTENTS.includes(parsed.intent as Intent)
        ? (parsed.intent as Intent)
        : "unknown";
      const draft = typeof parsed.draft === "string" && parsed.draft.trim() ? parsed.draft.trim() : undefined;
      const summary = typeof parsed.summary === "string" ? parsed.summary : "";
      const confidence =
        typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;

      if (intent === "unknown" || !draft) {
        return {
          intent,
          confidence,
          summary: summary || "The request could not be classified with confidence.",
          language,
          error: "The model could not produce a usable draft for this message.",
        };
      }

      return { intent, confidence, summary, language, draft };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        intent: "unknown",
        confidence: 0,
        summary: "",
        language,
        error: aborted
          ? `DeepSeek did not respond within ${TIMEOUT_MS / 1000}s.`
          : `DeepSeek request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
