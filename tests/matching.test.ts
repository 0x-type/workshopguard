import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInitialState } from "../lib/store/seed.ts";
import { matchMessage } from "../lib/domain/matching.ts";

const record = () => {
  const s = buildInitialState();
  return { customers: s.customers, cases: s.cases };
};

test("the supplied messages all verify on ID + case reference", () => {
  const state = buildInitialState();
  for (const m of state.inbox) {
    assert.equal(m.match.status, "verified", `${m.id} should verify`);
  }
  assert.equal(state.inbox.find((m) => m.id === "MSG-1")!.match.caseId, "JOB-1");
  assert.equal(state.inbox.find((m) => m.id === "MSG-3")!.match.caseId, "JOB-2");
});

test("a message with neither ID nor case reference is never guessed", () => {
  const r = matchMessage({}, record());
  assert.equal(r.status, "unverified");
  assert.match(r.reason, /never inferred from a name, email address or vehicle plate/);
});

test("a customer ID alone is not enough to pick a case", () => {
  const r = matchMessage({ claimedCustomerId: "CUS-A" }, record());
  assert.equal(r.status, "unverified");
  assert.match(r.reason, /cannot be tied to exactly one case/);
});

test("a case reference alone does not verify the sender", () => {
  const r = matchMessage({ claimedCaseRef: "JOB-1" }, record());
  assert.equal(r.status, "unverified");
  assert.match(r.reason, /sender cannot be verified/);
});

test("an unknown customer or case is refused", () => {
  assert.match(
    matchMessage({ claimedCustomerId: "CUS-Z", claimedCaseRef: "JOB-1" }, record()).reason,
    /CUS-Z does not exist/,
  );
  assert.match(
    matchMessage({ claimedCustomerId: "CUS-A", claimedCaseRef: "JOB-9" }, record()).reason,
    /JOB-9 does not exist/,
  );
});

test("one customer cannot reach another customer's case", () => {
  const r = matchMessage({ claimedCustomerId: "CUS-A", claimedCaseRef: "JOB-2" }, record());
  assert.equal(r.status, "unverified");
  assert.match(r.reason, /does not belong to customer CUS-A\. Access refused\./);
});
