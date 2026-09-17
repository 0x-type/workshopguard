/**
 * Deterministic "AI" provider.
 *
 * Rule-based intent detection and templated drafts. It is labelled in the UI as
 * rule-based, not as a language model. It exists so the demonstration is
 * reproducible and works with the network off; Phase 3 adds a real provider
 * behind the same interface.
 */

import type { AiProvider, AnalyzeInput, AnalyzeOutput } from "@/lib/ai/provider";
import type { Intent } from "@/lib/types";

const INTENT_RULES: { intent: Intent; pattern: RegExp; confidence: number }[] = [
  { intent: "collection_request", pattern: /\b(collect|collection|pick ?up|r[ée]cup[ée]rer|retrait)\b/i, confidence: 0.92 },
  { intent: "appointment_change", pattern: /\b(appointment|booking|reschedul|change my service|rendez-?vous)\b/i, confidence: 0.9 },
  { intent: "callback_request", pattern: /\b(call me|callback|call back|ring me|rappel(ez)?)\b/i, confidence: 0.86 },
  { intent: "status_question", pattern: /\b(ready|status|progress|how long|pr[êe]t|avancement)\b/i, confidence: 0.7 },
];

function detectIntent(text: string): { intent: Intent; confidence: number } {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(text)) return { intent: rule.intent, confidence: rule.confidence };
  }
  return { intent: "unknown", confidence: 0.2 };
}

function isFrench(language: string): boolean {
  return /fran|french/i.test(language);
}

function summarise(input: AnalyzeInput, intent: Intent): string {
  const turns = [...input.history, { channel: input.channel, text: input.text }];
  const channels = [...new Set(turns.map((t) => t.channel))];
  const subject: Record<Intent, string> = {
    collection_request: "when they can collect their vehicle",
    appointment_change: "changing their service appointment",
    callback_request: "being called back",
    status_question: "the current status of their vehicle",
    unknown: "something the system could not classify",
  };
  const repeat =
    turns.length > 1
      ? ` They have now asked ${turns.length} times, across ${channels.join(" and ")}.`
      : "";
  return `Customer is asking about ${subject[intent]}.${repeat}`;
}

function collectionDraft(input: AnalyzeInput): string {
  const e = input.evaluation;
  const caseId = input.caseRecord?.id ?? "your case";
  const phone = input.dealershipPhone;
  const french = isFrench(input.customer?.preferredLanguage ?? "English");

  const allowed = e?.collectionAllowed ?? false;

  if (french) {
    return allowed
      ? [
          "Bonjour,",
          "",
          `Merci pour votre message concernant votre véhicule (dossier ${caseId}).`,
          "Les travaux en atelier sont terminés et le contrôle qualité a été validé.",
          "Un conseiller service va vous contacter pour convenir d'un horaire.",
          "",
          `Vous pouvez également nous joindre au ${phone}.`,
          "",
          "Cordialement,",
          "Service après-vente",
        ].join("\n")
      : [
          "Bonjour,",
          "",
          `Merci pour votre message concernant votre véhicule (dossier ${caseId}).`,
          "Les travaux en atelier sont terminés. Le contrôle qualité est encore en cours,",
          "je ne peux donc pas encore vous confirmer un horaire.",
          "",
          "Dès que ce contrôle sera terminé, nous vous recontacterons pour convenir d'un rendez-vous.",
          `Si vous préférez en parler de vive voix, vous pouvez nous joindre au ${phone}.`,
          "",
          "Merci de votre patience,",
          "Service après-vente",
        ].join("\n");
  }

  return allowed
    ? [
        "Hello,",
        "",
        `Thank you for your message about your vehicle (case ${caseId}).`,
        "The workshop work is finished and the quality check has passed.",
        "A service adviser will contact you to agree a time.",
        "",
        `You can also reach us on ${phone}.`,
        "",
        "Kind regards,",
        "Service team",
      ].join("\n")
    : [
        "Hello,",
        "",
        `Thank you for your message about your vehicle (case ${caseId}).`,
        "The workshop work is finished. The quality check is still in progress,",
        "so I am not able to confirm a time yet.",
        "",
        "As soon as that check is complete we will contact you to agree a time.",
        `If you would prefer to speak to someone, you can reach us on ${phone}.`,
        "",
        "Thank you for your patience,",
        "Service team",
      ].join("\n");
}

function appointmentDraft(input: AnalyzeInput): string {
  const slot = input.caseRecord?.appointment?.slot ?? "your booked slot";
  const phone = input.dealershipPhone;
  const french = isFrench(input.customer?.preferredLanguage ?? "English");
  const callbackOnly = input.customer?.contactPermission === "callback only";

  if (callbackOnly) {
    return french
      ? `Ce client est en « rappel uniquement ». Ne pas envoyer les détails du rendez-vous par e-mail. Créer une tâche de rappel et appeler le client au numéro vérifié. Créneau actuel : ${slot}.`
      : `This customer is set to callback only. Do not send appointment details by email. Create a callback task and telephone the customer on their verified number. Current slot: ${slot}.`;
  }

  return french
    ? [
        "Bonjour,",
        "",
        "Merci pour votre message concernant votre rendez-vous.",
        `Votre créneau actuel est : ${slot}.`,
        "Une modification doit être validée par un conseiller service avant d'être confirmée.",
        "",
        `Vous pouvez nous joindre au ${phone}.`,
        "",
        "Cordialement,",
        "Service après-vente",
      ].join("\n")
    : [
        "Hello,",
        "",
        "Thank you for your message about your appointment.",
        `Your current slot is: ${slot}.`,
        "Any change has to be approved by a service adviser before it is confirmed.",
        "",
        `You can reach us on ${phone}.`,
        "",
        "Kind regards,",
        "Service team",
      ].join("\n");
}

export const mockProvider: AiProvider = {
  name: "mock (rule-based, deterministic)",

  async analyze(input: AnalyzeInput): Promise<AnalyzeOutput> {
    if (process.env.C01_FORCE_AI_FAILURE === "true") {
      return {
        intent: "unknown",
        confidence: 0,
        summary: "",
        language: input.customer?.preferredLanguage ?? "unknown",
        error: "AI provider unavailable (forced failure for the demonstration).",
      };
    }

    const { intent, confidence } = detectIntent(input.text);
    const language = input.customer?.preferredLanguage ?? "unknown";

    if (intent === "unknown") {
      return {
        intent,
        confidence,
        summary: "The request could not be classified with confidence.",
        language,
        error: "Intent could not be determined from the message text.",
      };
    }

    let draft: string | undefined;
    if (input.caseRecord && input.customer) {
      if (intent === "collection_request" || intent === "status_question") {
        draft = collectionDraft(input);
      } else if (intent === "appointment_change" || intent === "callback_request") {
        draft = appointmentDraft(input);
      }
    }

    return { intent, confidence, summary: summarise(input, intent), language, draft };
  },
};
