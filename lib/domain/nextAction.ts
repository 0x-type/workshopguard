/**
 * What has to happen next, and who has to do it.
 *
 * Derived from the record, not written by hand anywhere in the UI — so it can
 * never drift from what the rules will actually allow. Listed most-blocking
 * first: the top line is the thing the case is genuinely waiting on.
 */

import type { CallbackTask, Case, Draft, InboxItem, Role } from "@/lib/types";
import type { Evaluation } from "@/lib/domain/rules";
import type { ChannelDecision } from "@/lib/domain/channelPolicy";

export type NextAction = {
  /** Plain sentence an employee can act on. */
  text: string;
  /** Who is expected to do it. */
  owner: Role;
  /** True when the person currently looking at the screen is that person. */
  yours?: boolean;
};

export function nextActions(input: {
  caseRecord: Case;
  evaluation: Evaluation;
  item?: InboxItem;
  draft?: Draft;
  callback?: CallbackTask;
  policy?: ChannelDecision;
  viewer: Role;
}): NextAction[] {
  const { caseRecord, evaluation, item, draft, callback, policy, viewer } = input;
  const actions: NextAction[] = [];

  const add = (text: string, owner: Role) => actions.push({ text, owner, yours: owner === viewer });

  // 1. An unidentified message blocks everything else on it.
  if (item && item.match.status !== "verified") {
    add("A service adviser must identify which case this message belongs to.", "service-adviser");
    return actions;
  }

  // 2. Work that is physically outstanding.
  if (evaluation.workshopWork !== "finished" && evaluation.workshopWork !== "missing") {
    add("The technician must finish the repair work.", "technician");
  }

  if (evaluation.workshopWork === "finished") {
    if (evaluation.qualityCheck === "pending") {
      add("The quality inspector must complete the quality check.", "quality-inspector");
    } else if (evaluation.qualityCheck === "failed") {
      add("The quality check failed — the technician must put the fault right.", "technician");
    } else if (evaluation.qualityCheck === "missing") {
      add("The quality inspector must record a result; there is none on file.", "quality-inspector");
    }
  }

  // 3. Talking to the customer.
  if (policy?.callbackRequired && callback?.status === "open") {
    add(
      `The service adviser must telephone the customer on ${callback.phone}. This customer may not be emailed.`,
      "service-adviser",
    );
  }

  if (caseRecord.appointment?.changeStatus === "requested") {
    add(
      "The service adviser must record the appointment time that was agreed on the call.",
      "service-adviser",
    );
  }

  if (draft && draft.status !== "approved") {
    add(
      draft.status === "rejected"
        ? "The denied response needs rewording and the service adviser's approval."
        : "The customer response needs the service adviser's approval.",
      "service-adviser",
    );
  }

  // 4. The decision the whole case exists for.
  if (!caseRecord.appointment) {
    if (evaluation.collectionAllowed && !evaluation.collectionConfirmed) {
      add("Every check passes — the service adviser can now confirm collection.", "service-adviser");
    }
  }

  if (actions.length === 0) {
    add("Nothing is waiting on anyone. The customer has been answered.", viewer);
  }

  return actions;
}
