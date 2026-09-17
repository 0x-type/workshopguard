import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { buildInitialState, suppliedHash, SUPPLIED_PATH, minutesToClock } from "../lib/store/seed.ts";
import { getState, resetState, recordAudit } from "../lib/store/store.ts";

/** Hash captured before anything runs, compared again at the end. */
const HASH_BEFORE = createHash("sha256").update(readFileSync(SUPPLIED_PATH)).digest("hex");

test("the supplied record loads without being modified", () => {
  const state = buildInitialState();
  assert.equal(state.customers.length, 2, "both supplied customers load");
  assert.equal(state.cases.length, 2, "both supplied jobs load");
  assert.equal(state.inbox.length, 3, "all three supplied messages load");
  assert.equal(suppliedHash(), HASH_BEFORE, "reading state did not alter the supplied file");
});

test("supplied values are carried through unchanged", () => {
  const state = buildInitialState();

  const a = state.customers.find((c) => c.id === "CUS-A")!;
  assert.equal(a.preferredLanguage, "French");
  assert.equal(a.contactPermission, "service updates only");

  const b = state.customers.find((c) => c.id === "CUS-B")!;
  assert.equal(b.contactPermission, "callback only");

  const job1 = state.cases.find((c) => c.id === "JOB-1")!;
  assert.equal(job1.workshopState, "work finished");
  assert.equal(job1.crmState, "ready for collection");
  assert.equal(
    job1.checks.find((c) => c.key === "quality-check")!.status,
    "pending",
    "the quality check starts pending — this contradiction is the whole case",
  );

  const job2 = state.cases.find((c) => c.id === "JOB-2")!;
  assert.equal(job2.appointment?.slot, "Day 2, 10:00");
  assert.equal(job2.appointment?.changeStatus, "none");
});

test("case ownership is derived from the supplied messages, never guessed", () => {
  const state = buildInitialState();
  assert.equal(state.cases.find((c) => c.id === "JOB-1")!.customerId, "CUS-A");
  assert.equal(state.cases.find((c) => c.id === "JOB-2")!.customerId, "CUS-B");
});

test("reset restores the supplied initial state from any state", () => {
  const before = JSON.stringify(resetState());

  // Churn the state.
  const state = getState();
  state.cases[0].checks.find((c) => c.key === "quality-check")!.status = "passed";
  state.inbox.push({
    id: "MSG-JUNK",
    kind: "message",
    channel: "email",
    text: "noise",
    receivedAt: "10:00",
    origin: "simulated",
    match: { status: "unverified", reason: "test" },
    status: "new",
  });
  recordAudit({
    actorRole: "service-adviser",
    actorId: "EMP-ADV-1",
    action: "test-churn",
    target: "JOB-1",
    detail: "deliberate mess",
    label: "simulated",
  });

  assert.notEqual(JSON.stringify(getState()), before, "state really did change");
  assert.equal(JSON.stringify(resetState()), before, "reset returns to the identical start state");
});

test("the exercise clock is HH:MM only, so no real date is implied", () => {
  assert.equal(minutesToClock(555), "09:15");
  assert.equal(minutesToClock(9 * 60), "09:00");
  assert.match(minutesToClock(getState().clockMinutes), /^\d{2}:\d{2}$/);
});

test("every audit entry advances the clock by one minute", () => {
  resetState();
  const start = getState().clockMinutes;
  recordAudit({
    actorRole: "system",
    actorId: "system",
    action: "tick",
    target: "-",
    detail: "-",
    label: "simulated",
  });
  assert.equal(getState().clockMinutes, start + 1);
});

test("C01/initial.json is byte-identical after the whole run", () => {
  const after = createHash("sha256").update(readFileSync(SUPPLIED_PATH)).digest("hex");
  assert.equal(after, HASH_BEFORE, "the supplied record must never be written to");
});
