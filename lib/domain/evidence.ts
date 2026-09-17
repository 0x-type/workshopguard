/**
 * Builds the evidence panel from the ACTUAL records and rules, never from prose.
 *
 * Every fact carries the path it came from, so an employee can check the claim
 * against the file rather than trusting the screen.
 */

import type { Case, Customer, Evidence, EvidenceFact, EvidenceRule } from "@/lib/types";
import type { Evaluation } from "@/lib/domain/rules";
import { findCheck } from "@/lib/domain/rules";

const SUPPLIED = "C01/initial.json";
const OVERLAY = "data/synthetic-overlay.json";

function sourceForCheck(caseRecord: Case, key: string, suppliedField: string): string {
  const check = findCheck(caseRecord, key);
  if (!check) return `${SUPPLIED} → jobs[${caseRecord.id}] (field absent)`;
  if (check.origin === "supplied") return `${SUPPLIED} → jobs[${caseRecord.id}].${suppliedField}`;
  if (check.updatedBy !== "seed") {
    return `Recorded in this session by ${check.updatedBy} at ${check.updatedAt}`;
  }
  return `${OVERLAY} → case_checks[${caseRecord.id}]`;
}

export function buildEvidence(
  caseRecord: Case,
  customer: Customer | undefined,
  evaluation: Evaluation,
  suppliedRules: string[],
  generatedAt: string,
): Evidence {
  const facts: EvidenceFact[] = [
    {
      label: "Workshop work",
      value: evaluation.workshopWork,
      source: sourceForCheck(caseRecord, "workshop-work", "workshop_state"),
    },
    {
      label: "Quality check",
      value: evaluation.qualityCheck,
      source: sourceForCheck(caseRecord, "quality-check", "quality_check"),
    },
    {
      label: "CRM state",
      value: evaluation.crmState,
      source: `${SUPPLIED} → jobs[${caseRecord.id}].crm_state`,
    },
    {
      label: "Collection approval",
      value: evaluation.collectionApproval,
      source: sourceForCheck(caseRecord, "collection-approval", "—"),
    },
  ];

  if (customer) {
    facts.push(
      {
        label: "Communication permission",
        value: customer.contactPermission,
        source: `${SUPPLIED} → customers[${customer.id}].contact_permission`,
      },
      {
        label: "Preferred language",
        value: customer.preferredLanguage,
        source: `${SUPPLIED} → customers[${customer.id}].preferred_language`,
      },
    );
  }

  if (caseRecord.appointment) {
    facts.push({
      label: "Appointment slot",
      value: caseRecord.appointment.slot,
      source: `${SUPPLIED} → jobs[${caseRecord.id}].slot`,
    });
  }

  /** The three rules the supplied file states, each with what it did here. */
  const rules: EvidenceRule[] = suppliedRules.map((text) => {
    let outcome = "No effect on this case.";
    if (text.includes("service adviser")) {
      outcome = evaluation.collectionConfirmed
        ? "Applied: collection was confirmed by a service adviser."
        : "Applied: only a service adviser may confirm collection, and no other role can.";
    } else if (text.includes("Conflicting states")) {
      outcome =
        evaluation.conflicts.length > 0
          ? `Triggered: ${evaluation.conflicts.length} conflict found. Employee review required.`
          : "Not triggered: no conflicting states on this case.";
    } else if (text.includes("customer IDs")) {
      outcome = `Applied: this case was matched on customer ID ${caseRecord.customerId} and case reference ${caseRecord.id}, never on a name or plate.`;
    }
    return { id: "supplied-rule", text, outcome };
  });

  rules.push({
    id: "collection-gate",
    text: "Collection requires workshop work finished AND quality check passed AND no unresolved conflict.",
    outcome: evaluation.collectionAllowed
      ? "Satisfied."
      : `Not satisfied: ${evaluation.blockers.join(" ") || "an unresolved conflict is present."}`,
  });

  rules.push({
    id: "how-matching-works",
    text: "A message is matched to a case by customer ID and case reference only — never by a name, an email address or a plate.",
    outcome: `Applied: this case was reached through customer ${caseRecord.customerId} and reference ${caseRecord.id}. The wording above was written only after that check passed.`,
  });

  rules.push({
    id: "missing-is-never-pass",
    text: "A missing or unknown check status is never treated as passed.",
    outcome:
      evaluation.qualityCheck === "missing"
        ? "Triggered: the quality check has no recorded status."
        : "Not triggered: the quality check has a recorded status.",
  });

  return {
    recommendation: evaluation.recommendation,
    facts,
    rules,
    conflicts: evaluation.conflicts,
    generatedAt,
  };
}
