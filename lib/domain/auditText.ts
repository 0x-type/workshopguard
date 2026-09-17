/**
 * Turns an audit action into a sentence a service manager can read.
 *
 * The raw action names are stable identifiers for code and tests; this is the
 * presentation layer for them. The original detail is still shown underneath,
 * so nothing is hidden — it is just no longer the headline.
 */

import type { AuditEvent, Role } from "@/lib/types";

const ROLE_NAME: Record<Role | "system", string> = {
  technician: "Technician",
  "quality-inspector": "Quality inspector",
  "service-adviser": "Service adviser",
  customer: "Customer",
  system: "System",
};

/** "JOB-1/quality-check" → "Quality check" */
function checkName(target: string): string {
  const key = target.split("/")[1] ?? "";
  const names: Record<string, string> = {
    "workshop-work": "Repair work",
    "quality-check": "Quality check",
    "collection-approval": "Collection approval",
    appointment: "Appointment",
  };
  return names[key] ?? (key.replace(/-/g, " ") || "A check");
}

/** "'pending' → 'passed'." → "passed" */
function newStatus(detail: string): string | undefined {
  return detail.match(/→ '([^']+)'/)?.[1];
}

export function describeAudit(event: AuditEvent): string {
  const { action, target, detail } = event;

  if (action.startsWith("denied:")) {
    return "Refused — not permitted for this role";
  }

  switch (action) {
    case "reset":
      return "Reset to the supplied starting point";
    case "customer-registered":
      return "Customer registered at the counter";
    case "check-updated": {
      const status = newStatus(detail);
      return status ? `${checkName(target)} recorded as ${status}` : `${checkName(target)} updated`;
    }
    case "collection-confirmed":
      return "Collection confirmed";
    case "response-drafted":
      return "Response prepared for the customer";
    case "draft-edited":
      return "Response edited before approval";
    case "response-approved":
      return "Response approved";
    case "response-denied":
      return "Response denied — nothing was sent";
    case "draft-refused":
      return "Draft refused: it promised something the record does not support";
    case "manual-review-required":
      return "Sent for manual review — could not be matched to one case";
    case "message-linked":
      return "Message matched to a case by hand";
    case "simulated-inbound":
      return "Simulated message added to the inbox";
    case "inbound-email-received":
      return "Email received from a customer";
    case "portal-message":
      return "Customer sent a message from the portal";
    case "appointment-change-requested":
      return "Customer asked for a different appointment time";
    case "callback-task-created":
      return "Callback added to the list";
    case "callback-completed":
      return "Customer telephoned";
    case "booking-change-approved":
      return "Appointment moved to the agreed time";
    case "email-blocked":
      return "Email blocked — this customer may only be telephoned";
    case "test-email-sent":
      return "Test email sent";
    case "email-simulated":
      return "Email simulated — nothing was sent";
    case "email-send-failed":
      return "Email failed to send";
    default:
      return action.replace(/-/g, " ");
  }
}

export function describeActor(event: AuditEvent): string {
  if (event.actorId === "resend-inbound") return "Received by email";
  if (event.actorRole === "customer") return "Customer";
  return ROLE_NAME[event.actorRole] ?? String(event.actorRole);
}
