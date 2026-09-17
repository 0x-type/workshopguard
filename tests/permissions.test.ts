import { test } from "node:test";
import assert from "node:assert/strict";

import { can, checkPermission, PERMISSIONS, type Action } from "../lib/domain/permissions.ts";
import type { Role } from "../lib/types.ts";

const ROLES: Role[] = ["technician", "quality-inspector", "service-adviser", "customer"];

/** The matrix from the brief, asserted exhaustively. */
const EXPECTED: Record<Action, Role[]> = {
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

test("every role x action pair matches the agreed matrix", () => {
  for (const action of Object.keys(EXPECTED) as Action[]) {
    for (const role of ROLES) {
      assert.equal(
        can(role, action),
        EXPECTED[action].includes(role),
        `${role} / ${action}`,
      );
    }
  }
});

test("a customer can take no employee action at all", () => {
  for (const action of Object.keys(PERMISSIONS) as Action[]) {
    assert.equal(can("customer", action), false, `customer must not ${action}`);
  }
});

test("only the service adviser can approve a response or confirm collection", () => {
  for (const role of ROLES) {
    const expected = role === "service-adviser";
    assert.equal(can(role, "approve-response"), expected);
    assert.equal(can(role, "confirm-collection"), expected);
  }
});

test("a technician cannot set the quality check, and an inspector cannot do repair work", () => {
  assert.equal(can("technician", "set-quality-check"), false);
  assert.equal(can("quality-inspector", "update-repair-check"), false);
});

test("a refusal explains itself in a sentence an employee can read", () => {
  const r = checkPermission("technician", "confirm-collection");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.reason, /A technician cannot confirm collection/);
    assert.match(r.reason, /Only the service adviser can\./);
  }
});
