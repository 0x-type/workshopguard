/**
 * Roles and permissions. One table, read by both the API and the UI, so a button
 * is never enabled for something the server would refuse.
 *
 * Denials are not errors to hide: they are recorded in the audit history and
 * shown with a reason, because "who was allowed to promise this" is the whole
 * point of the exercise.
 */

import type { Role } from "@/lib/types";

export type Action =
  | "analyze-message"
  | "link-message"
  | "update-repair-check"
  | "set-quality-check"
  | "edit-draft"
  | "approve-response"
  | "confirm-collection"
  | "send-approved-email"
  | "manage-callback"
  | "approve-booking-change"
  | "simulate-inbound"
  | "register-customer";

export const ACTION_LABELS: Record<Action, string> = {
  "analyze-message": "Analyse a customer message",
  "link-message": "Link a message to a verified case by hand",
  "update-repair-check": "Update workshop repair work",
  "set-quality-check": "Set the quality-check result",
  "edit-draft": "Edit a suggested response",
  "approve-response": "Approve a response to the customer",
  "confirm-collection": "Confirm collection",
  "send-approved-email": "Send an approved response by email",
  "manage-callback": "Create or complete a callback task",
  "approve-booking-change": "Approve an appointment change",
  "simulate-inbound": "Simulate an incoming message",
  "register-customer": "Register a new customer and vehicle",
};

/** The single source of truth. Anything not listed here is denied. */
export const PERMISSIONS: Record<Action, Role[]> = {
  "analyze-message": ["technician", "quality-inspector", "service-adviser"],
  "link-message": ["service-adviser"],
  "update-repair-check": ["technician"],
  "set-quality-check": ["quality-inspector"],
  "edit-draft": ["service-adviser"],
  "approve-response": ["service-adviser"],
  "confirm-collection": ["service-adviser"],
  "send-approved-email": ["service-adviser"],
  "manage-callback": ["service-adviser"],
  "approve-booking-change": ["service-adviser"],
  "simulate-inbound": ["technician", "quality-inspector", "service-adviser"],
  "register-customer": ["service-adviser"],
};

const ROLE_NAMES: Record<Role, string> = {
  technician: "A technician",
  "quality-inspector": "A quality inspector",
  "service-adviser": "A service adviser",
  customer: "A customer",
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[action]?.includes(role) ?? false;
}

export type PermissionCheck = { ok: true } | { ok: false; reason: string };

/** Returns a sentence an employee can read, not an error code. */
export function checkPermission(role: Role, action: Action): PermissionCheck {
  if (can(role, action)) return { ok: true };
  const allowed = PERMISSIONS[action] ?? [];
  const who =
    allowed.length === 1
      ? `Only the ${allowed[0].replace("-", " ")} can.`
      : `Allowed roles: ${allowed.join(", ") || "none"}.`;
  return {
    ok: false,
    reason: `${ROLE_NAMES[role]} cannot ${ACTION_LABELS[action].toLowerCase()}. ${who}`,
  };
}
