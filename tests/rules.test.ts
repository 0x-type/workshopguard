import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInitialState } from "../lib/store/seed.ts";
import { evaluateCase, CRM_PENDING_CONFLICT, findCheck, isValidQualityTransition } from "../lib/domain/rules.ts";
import type { Case } from "../lib/types.ts";

function job1(): Case {
  return buildInitialState().cases.find((c) => c.id === "JOB-1")!;
}

test("the supplied JOB-1 record produces the required conflict, verbatim", () => {
  const e = evaluateCase(job1());
  assert.deepEqual(e.conflicts, [CRM_PENDING_CONFLICT]);
  assert.equal(
    e.conflicts[0],
    "Conflict: CRM says ready for collection, but quality check is still pending. Employee review required.",
  );
});

test("collection is refused while the quality check is pending", () => {
  const e = evaluateCase(job1());
  assert.equal(e.workshopWork, "finished");
  assert.equal(e.qualityCheck, "pending");
  assert.equal(e.collectionAllowed, false);
  assert.equal(e.recommendation, "Do not confirm collection.");
});

test("collection becomes allowed only once the quality check passes", () => {
  const c = job1();
  findCheck(c, "quality-check")!.status = "passed";
  const e = evaluateCase(c);
  assert.deepEqual(e.conflicts, [], "the CRM disagreement is resolved");
  assert.equal(e.collectionAllowed, true);
  assert.equal(e.recommendation, "Collection may now be confirmed by the service adviser.");
});

test("a failed quality check blocks collection and raises its own conflict", () => {
  const c = job1();
  findCheck(c, "quality-check")!.status = "failed";
  const e = evaluateCase(c);
  assert.equal(e.collectionAllowed, false);
  assert.equal(e.conflicts.length, 1);
  assert.match(e.conflicts[0], /quality check has failed/);
});

test("a missing quality check is never treated as passed", () => {
  const c = job1();
  c.checks = c.checks.filter((x) => x.key !== "quality-check");
  const e = evaluateCase(c);
  assert.equal(e.qualityCheck, "missing");
  assert.equal(e.collectionAllowed, false);
  assert.match(e.conflicts[0], /Manual review required/);
  assert.ok(e.blockers.some((b) => /never treated as passed/.test(b)));
});

test("unfinished workshop work blocks collection even with a passed check", () => {
  const c = job1();
  findCheck(c, "workshop-work")!.status = "in progress";
  findCheck(c, "quality-check")!.status = "passed";
  const e = evaluateCase(c);
  assert.equal(e.collectionAllowed, false);
  assert.ok(e.blockers.some((b) => /not finished/.test(b)));
});

test("JOB-2 has no collection conflict — it is an appointment case", () => {
  const c = buildInitialState().cases.find((x) => x.id === "JOB-2")!;
  const e = evaluateCase(c);
  assert.deepEqual(e.conflicts, []);
  assert.equal(e.collectionAllowed, false, "no workshop work finished on a booking");
});

test("quality-check transitions are constrained", () => {
  assert.equal(isValidQualityTransition("pending", "passed"), true);
  assert.equal(isValidQualityTransition("pending", "failed"), true);
  assert.equal(isValidQualityTransition("pending", "cancelled"), false);
  assert.equal(isValidQualityTransition("failed", "passed"), true);
});
