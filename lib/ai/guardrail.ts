/**
 * The guardrail between language and promises.
 *
 * A draft is checked against the deterministic evaluation AFTER it is written —
 * by the model, and again after a human edits it. If the text implies a
 * collection the rules do not support, it is refused. The supplied rule is
 * "Only the service adviser can promise collection"; this is what stops anyone,
 * including the adviser, promising one the record contradicts.
 */

import type { Evaluation } from "@/lib/domain/rules";

/** Phrases that read as a collection promise, in the two demo languages. */
const PROMISE_PATTERNS: RegExp[] = [
  // English
  /\byou (can|may) (now )?(come and )?(collect|pick ?up)\b/i,
  /\b(is|it'?s) ready (for|to) (collect|collection|pick ?up)\b/i,
  /\bready for collection\b/i,
  /\bcollect (it|your car|your vehicle) (today|this afternoon|this morning)\b/i,
  /\bconfirmed for collection\b/i,
  // French
  /\bvous pouvez( venir)? (récupérer|reprendre|prendre)\b/i,
  /\bvotre v[ée]hicule est pr[êe]t\b/i,
  /\bpr[êe]t(e)? (pour|à) (le |la )?(retrait|r[ée]cup[ée]ration)\b/i,
  /\bdisponible (cet après-midi|aujourd'hui) pour le retrait\b/i,
];

export type GuardrailResult =
  | { ok: true }
  | { ok: false; reason: string; matched: string };

export function checkDraft(body: string, evaluation: Evaluation): GuardrailResult {
  // Once collection is genuinely confirmed, saying so is accurate, not a promise.
  if (evaluation.collectionConfirmed) return { ok: true };
  if (evaluation.collectionAllowed) return { ok: true };

  for (const pattern of PROMISE_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      return {
        ok: false,
        matched: match[0],
        reason: `This wording promises collection, but the record does not support it (${evaluation.blockers.join(" ")}). Remove the promise or resolve the check first.`,
      };
    }
  }
  return { ok: true };
}
