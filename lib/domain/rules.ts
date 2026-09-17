/**
 * Status rules and conflict detection. Pure functions, no I/O.
 *
 * This module decides whether a collection may be confirmed. Nothing else does,
 * and the AI never does.
 */

import type { Case, CheckRecord } from "@/lib/types";

/** The exact wording the exercise requires when CRM and the quality check disagree. */
export const CRM_PENDING_CONFLICT =
  "Conflict: CRM says ready for collection, but quality check is still pending. Employee review required.";

export const MISSING_QUALITY_CHECK =
  "Quality check status is missing from the record. Manual review required.";

export type Evaluation = {
  workshopWork: string;
  qualityCheck: string;
  crmState: string;
  collectionApproval: string;
  conflicts: string[];
  blockers: string[];
  collectionAllowed: boolean;
  collectionConfirmed: boolean;
  recommendation: string;
};

export function findCheck(caseRecord: Case, key: string): CheckRecord | undefined {
  return caseRecord.checks.find((c) => c.key === key);
}

function statusOf(caseRecord: Case, key: string): string {
  return findCheck(caseRecord, key)?.status ?? "missing";
}

export function evaluateCase(caseRecord: Case): Evaluation {
  const workshopWork = statusOf(caseRecord, "workshop-work");
  const qualityCheck = statusOf(caseRecord, "quality-check");
  const collectionApproval = statusOf(caseRecord, "collection-approval");
  const crmState = caseRecord.crmState;

  const conflicts: string[] = [];
  const blockers: string[] = [];

  const crmSaysReady = crmState.toLowerCase().includes("ready for collection");

  if (crmSaysReady && qualityCheck === "pending") {
    conflicts.push(CRM_PENDING_CONFLICT);
  } else if (crmSaysReady && qualityCheck === "failed") {
    conflicts.push(
      "Conflict: CRM says ready for collection, but the quality check has failed. Employee review required.",
    );
  } else if (crmSaysReady && qualityCheck === "missing") {
    conflicts.push(MISSING_QUALITY_CHECK);
  }

  if (workshopWork !== "finished") {
    blockers.push(`Workshop work is '${workshopWork}', not finished.`);
  }
  if (qualityCheck === "missing") {
    blockers.push("The quality check has no recorded status. A missing check is never treated as passed.");
  } else if (qualityCheck !== "passed") {
    blockers.push(`Quality check is '${qualityCheck}', not passed.`);
  }

  const collectionAllowed =
    workshopWork === "finished" && qualityCheck === "passed" && conflicts.length === 0;

  const collectionConfirmed = collectionApproval === "confirmed";

  const recommendation = collectionConfirmed
    ? "Collection is confirmed."
    : collectionAllowed
      ? "Collection may now be confirmed by the service adviser."
      : "Do not confirm collection.";

  return {
    workshopWork,
    qualityCheck,
    crmState,
    collectionApproval,
    conflicts,
    blockers,
    collectionAllowed,
    collectionConfirmed,
    recommendation,
  };
}

/** Whether a quality-check transition is permitted by the status model. */
export function isValidQualityTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    pending: ["passed", "failed"],
    failed: ["pending", "passed"],
    passed: ["pending", "failed"],
    missing: ["pending", "passed", "failed"],
  };
  return (allowed[from] ?? []).includes(to);
}
