import { test } from "node:test";
import assert from "node:assert/strict";

import { getState, resetState } from "../lib/store/store.ts";
import { evaluateCase, findCheck } from "../lib/domain/rules.ts";
import { channelPolicy } from "../lib/domain/channelPolicy.ts";
import { nextActions } from "../lib/domain/nextAction.ts";
import { describeAudit, describeActor } from "../lib/domain/auditText.ts";
import {
  analyzeMessage,
  approveDraft,
  setCheck,
  portalRequestSlot,
} from "../lib/domain/transitions.ts";
import type { Actor } from "../lib/types.ts";

function actors() {
  const s = getState();
  const by = (r: string) => s.employees.find((e) => e.role === r)! as Actor;
  return { tech: by("technician"), qi: by("quality-inspector"), adviser: by("service-adviser") };
}

const job = (id: string) => getState().cases.find((c) => c.id === id)!;

function actionsFor(caseId: string, viewer: Actor["role"] = "service-adviser") {
  const c = job(caseId);
  const customer = getState().customers.find((x) => x.id === c.customerId)!;
  return nextActions({
    caseRecord: c,
    evaluation: evaluateCase(c),
    draft: getState().drafts.find((d) => d.caseId === caseId),
    callback: getState().callbackTasks.find((t) => t.caseId === caseId),
    policy: channelPolicy(customer),
    viewer,
  });
}

test("JOB-1 starts by waiting on the quality inspector", () => {
  resetState();
  const actions = actionsFor("JOB-1");
  assert.equal(actions[0].text, "The quality inspector must complete the quality check.");
  assert.equal(actions[0].owner, "quality-inspector");
});

test("it says whose turn it is, from the viewer's point of view", () => {
  resetState();
  assert.equal(actionsFor("JOB-1", "quality-inspector")[0].yours, true);
  assert.equal(actionsFor("JOB-1", "service-adviser")[0].yours, false);
});

test("a prepared response adds an approval step for the adviser", async () => {
  resetState();
  const { adviser } = actors();
  await analyzeMessage("MSG-1", adviser);

  const texts = actionsFor("JOB-1").map((a) => a.text);
  assert.ok(texts.includes("The quality inspector must complete the quality check."));
  assert.ok(texts.includes("The customer response needs the service adviser's approval."));
});

test("once the check passes and the reply is approved, collection is the next action", async () => {
  resetState();
  const { qi, adviser } = actors();
  await analyzeMessage("MSG-1", adviser);
  approveDraft(getState().drafts[0].id, adviser);
  setCheck("JOB-1", "quality-check", { status: "passed" }, qi);

  const actions = actionsFor("JOB-1");
  assert.equal(actions[0].text, "Every check passes — the service adviser can now confirm collection.");
});

test("unfinished repair work is named before the quality check", () => {
  resetState();
  findCheck(job("JOB-1"), "workshop-work")!.status = "in progress";
  const texts = actionsFor("JOB-1").map((a) => a.text);
  assert.equal(texts[0], "The technician must finish the repair work.");
  assert.ok(
    !texts.includes("The quality inspector must complete the quality check."),
    "the inspector is not asked while the car is still being worked on",
  );
});

test("a failed check sends the work back to the technician", () => {
  resetState();
  findCheck(job("JOB-1"), "quality-check")!.status = "failed";
  const actions = actionsFor("JOB-1");
  assert.match(actions[0].text, /put the fault right/);
  assert.equal(actions[0].owner, "technician");
});

test("a callback-only customer is a phone call, with the number in the sentence", () => {
  resetState();
  portalRequestSlot(
    getState().customers.find((c) => c.id === "CUS-B")!.portalToken,
    "JOB-2",
    "Day 3 at 14:00",
  );
  const texts = actionsFor("JOB-2").map((a) => a.text);
  assert.ok(texts.some((t) => t.includes("+212 600 000 002") && t.includes("may not be emailed")));
  assert.ok(texts.some((t) => t.includes("record the appointment time that was agreed")));
});

test("an unidentified message asks for identification and nothing else", () => {
  resetState();
  const actions = nextActions({
    caseRecord: job("JOB-1"),
    evaluation: evaluateCase(job("JOB-1")),
    item: {
      id: "X",
      kind: "message",
      channel: "email",
      text: "hi",
      receivedAt: "09:00",
      origin: "simulated",
      match: { status: "unverified", reason: "no ids" },
      status: "needs-manual-review",
    },
    viewer: "service-adviser",
  });
  assert.equal(actions.length, 1);
  assert.match(actions[0].text, /must identify which case/);
});

test("audit lines read as sentences, not action codes", () => {
  const line = (e: Partial<Parameters<typeof describeAudit>[0]>) =>
    describeAudit({
      id: "A",
      at: "09:00",
      actorRole: "quality-inspector",
      actorId: "EMP-QUA-1",
      action: "check-updated",
      target: "JOB-1/quality-check",
      detail: "'pending' → 'passed'.",
      label: "real",
      ...e,
    } as Parameters<typeof describeAudit>[0]);

  assert.equal(line({}), "Quality check recorded as passed");
  assert.equal(
    line({ action: "check-updated", target: "JOB-1/workshop-work", detail: "'in progress' → 'finished'." }),
    "Repair work recorded as finished",
  );
  assert.equal(line({ action: "collection-confirmed" }), "Collection confirmed");
  assert.equal(line({ action: "denied:confirm-collection" }), "Refused — not permitted for this role");
  assert.equal(line({ action: "email-blocked" }), "Email blocked — this customer may only be telephoned");
  assert.equal(line({ action: "callback-completed" }), "Customer telephoned");

  assert.equal(
    describeActor({
      id: "A",
      at: "09:00",
      actorRole: "quality-inspector",
      actorId: "EMP-QUA-1",
      action: "check-updated",
      target: "x",
      detail: "",
      label: "real",
    }),
    "Quality inspector",
  );
});
