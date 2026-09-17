import { test } from "node:test";
import assert from "node:assert/strict";

import { getState, resetState } from "../lib/store/store.ts";
import { registerCustomer, portalView, evaluationFor } from "../lib/domain/transitions.ts";
import { suppliedHash } from "../lib/store/seed.ts";
import type { Actor } from "../lib/types.ts";

function actors() {
  const s = getState();
  const by = (role: string) => s.employees.find((e) => e.role === role)! as Actor;
  return { tech: by("technician"), qi: by("quality-inspector"), adviser: by("service-adviser") };
}

const repair = {
  displayLabel: "Amina Cherkaoui",
  preferredLanguage: "French",
  contactPermission: "service updates only" as const,
  verifiedPhone: "+212 600 000 003",
  caseType: "repair" as const,
  note: "Reported a noise from the front.",
};

test("only the service adviser can book a customer in", () => {
  resetState();
  const { tech, qi, adviser } = actors();
  assert.equal(registerCustomer(repair, tech).ok, false);
  assert.equal(registerCustomer(repair, qi).ok, false);
  assert.equal(registerCustomer(repair, adviser).ok, true);
  assert.ok(getState().audit.some((a) => a.action === "denied:register-customer"));
});

test("a new customer gets the next free id and their own portal link", () => {
  resetState();
  const { adviser } = actors();
  const first = registerCustomer(repair, adviser);
  assert.equal(first.ok, true);
  if (!first.ok) return;

  assert.equal(first.data.customer.id, "CUS-C", "CUS-A and CUS-B are supplied");
  assert.equal(first.data.caseRecord.id, "JOB-3");
  assert.equal(first.data.customer.origin, "synthetic");
  assert.equal(first.data.caseRecord.origin, "synthetic");
  assert.match(first.data.customer.portalToken, /^demo-c-[0-9a-f]+$/);

  const second = registerCustomer({ ...repair, displayLabel: "Youssef B." }, adviser);
  assert.equal(second.ok && second.data.customer.id, "CUS-D");
  assert.equal(second.ok && second.data.caseRecord.id, "JOB-4");
});

test("a newly booked repair gives the technician real work, with no fake conflict", () => {
  resetState();
  const { adviser } = actors();
  const created = registerCustomer(repair, adviser);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const c = created.data.caseRecord;
  assert.equal(c.checks.find((k) => k.key === "workshop-work")!.status, "in progress");
  assert.equal(c.checks.find((k) => k.key === "quality-check")!.status, "pending");

  const evaluation = evaluationFor(c.id)!;
  assert.deepEqual(evaluation.conflicts, [], "a fresh case is not seeded with a contradiction");
  assert.equal(evaluation.collectionAllowed, false);
});

test("the contact permission chosen at intake governs the case", () => {
  resetState();
  const { adviser } = actors();
  const created = registerCustomer(
    { ...repair, displayLabel: "Callback Only Person", contactPermission: "callback only" },
    adviser,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.data.customer.contactPermission, "callback only");
});

test("an appointment booked at intake appears on the customer's own portal", () => {
  resetState();
  const { adviser } = actors();
  const created = registerCustomer(
    { ...repair, caseType: "appointment", slot: "Day 4 at 11:30" },
    adviser,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const view = portalView(created.data.customer.portalToken);
  assert.equal(view.ok, true);
  if (!view.ok) return;
  assert.equal(view.data.cases.length, 1, "they see only their own case");
  assert.equal(view.data.cases[0].appointment!.slot, "Day 4 at 11:30");
  assert.equal(view.data.cases[0].caseRef, created.data.caseRecord.id);
});

test("intake is validated, not trusted", () => {
  resetState();
  const { adviser } = actors();
  assert.equal(registerCustomer({ ...repair, displayLabel: "  " }, adviser).ok, false);
  assert.equal(registerCustomer({ ...repair, verifiedPhone: "" }, adviser).ok, false);
  assert.equal(
    registerCustomer({ ...repair, caseType: "appointment", slot: "" }, adviser).ok,
    false,
    "an appointment without a slot is meaningless",
  );
});

test("registering never touches the supplied record, and reset removes it", () => {
  const before = suppliedHash();
  resetState();
  const { adviser } = actors();
  registerCustomer(repair, adviser);
  assert.equal(getState().customers.length, 3);

  resetState();
  assert.equal(getState().customers.length, 2, "reset returns to the supplied two");
  assert.equal(getState().cases.length, 2);
  assert.equal(suppliedHash(), before, "C01/initial.json is untouched");
});
