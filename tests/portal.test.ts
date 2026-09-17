import { test } from "node:test";
import assert from "node:assert/strict";

import { getState, resetState } from "../lib/store/store.ts";
import { buildPublicView } from "../lib/domain/publicStatus.ts";
import { channelPolicy } from "../lib/domain/channelPolicy.ts";
import {
  analyzeMessage,
  approveDraft,
  approveBookingChange,
  completeCallbackTask,
  portalRequestCallback,
  portalRequestSlot,
  portalSubmitMessage,
  portalView,
  setCheck,
  confirmCollection,
} from "../lib/domain/transitions.ts";
import type { Actor } from "../lib/types.ts";

function actors() {
  const s = getState();
  const by = (role: string) => s.employees.find((e) => e.role === role)! as Actor;
  return { tech: by("technician"), qi: by("quality-inspector"), adviser: by("service-adviser") };
}

const tokenA = () => getState().customers.find((c) => c.id === "CUS-A")!.portalToken;
const tokenB = () => getState().customers.find((c) => c.id === "CUS-B")!.portalToken;

test("the portal shows Customer A a safe status, not the internal one", () => {
  resetState();
  const view = portalView(tokenA());
  assert.equal(view.ok, true);
  if (!view.ok) return;

  const c = view.data.cases[0];
  assert.equal(c.caseRef, "JOB-1");
  assert.equal(c.stages.find((s) => s.key === "repair")!.state, "done");
  assert.equal(c.stages.find((s) => s.key === "quality")!.state, "in progress");
  assert.equal(c.stages.find((s) => s.key === "collection")!.state, "not yet");
  assert.equal(c.collectionConfirmed, false);
});

test("the portal payload leaks nothing internal", async () => {
  resetState();
  const { adviser, qi } = actors();

  // Generate internal material: a draft, evidence, an internal note, a denial.
  await analyzeMessage("MSG-1", adviser);
  setCheck("JOB-1", "quality-check", { status: "failed", note: "SECRET-INTERNAL-NOTE" }, qi);

  const view = portalView(tokenA());
  assert.equal(view.ok, true);
  if (!view.ok) return;
  const payload = JSON.stringify(view.data);

  for (const forbidden of [
    "SECRET-INTERNAL-NOTE",
    "ready for collection", // CRM state wording
    "crmState",
    "CRM",
    "evidence",
    "EMP-ADV-1",
    "EMP-QUA-1",
    "initial.json",
    "CUS-B",
    "JOB-2",
  ]) {
    assert.ok(
      !payload.includes(forbidden),
      `portal payload must not contain "${forbidden}" — found in: ${payload.slice(0, 200)}`,
    );
  }
});

test("an unapproved draft never reaches the customer, an approved one does", async () => {
  resetState();
  const { adviser } = actors();

  await analyzeMessage("MSG-1", adviser);
  let view = portalView(tokenA());
  assert.equal(view.ok && view.data.cases[0].approvedMessages.length, 0, "suggestion is not shown");

  const draft = getState().drafts.find((d) => d.inboxItemId === "MSG-1")!;
  assert.equal(approveDraft(draft.id, adviser).ok, true);

  view = portalView(tokenA());
  assert.equal(view.ok && view.data.cases[0].approvedMessages.length, 1, "approved message is shown");
});

test("one customer's link cannot reach another customer's case", () => {
  resetState();
  const viewA = portalView(tokenA());
  assert.equal(viewA.ok, true);
  if (viewA.ok) {
    assert.deepEqual(viewA.data.cases.map((c) => c.caseRef), ["JOB-1"]);
  }

  // Even naming the other case explicitly is refused.
  assert.equal(portalSubmitMessage(tokenA(), "JOB-2", "let me in").ok, false);
  assert.equal(portalRequestSlot(tokenA(), "JOB-2", "Day 9").ok, false);
  assert.equal(portalView("not-a-real-token").ok, false);
});

test("the portal reflects collection once it is genuinely confirmed", () => {
  resetState();
  const { qi, adviser } = actors();
  setCheck("JOB-1", "quality-check", { status: "passed" }, qi);
  confirmCollection("JOB-1", adviser);

  const view = portalView(tokenA());
  assert.equal(view.ok, true);
  if (!view.ok) return;
  const c = view.data.cases[0];
  assert.equal(c.collectionConfirmed, true);
  assert.equal(c.collectionHeadline, "Ready to collect");
  assert.equal(c.stages.find((s) => s.key === "collection")!.state, "done");
});

test("Customer B is callback only, so nothing may be emailed", () => {
  resetState();
  const b = getState().customers.find((c) => c.id === "CUS-B")!;
  const policy = channelPolicy(b);
  assert.equal(policy.emailAllowed, false);
  assert.equal(policy.callbackRequired, true);
  assert.match(policy.reason, /callback only/);

  const a = getState().customers.find((c) => c.id === "CUS-A")!;
  assert.equal(channelPolicy(a).emailAllowed, true);
});

test("Customer B: the same outcome whether the request arrives by web or portal", async () => {
  for (const source of ["supplied-web", "portal"] as const) {
    resetState();
    const { adviser } = actors();

    let messageId = "MSG-3";
    if (source === "portal") {
      const submitted = portalSubmitMessage(tokenB(), "JOB-2", "I need to change my service appointment.");
      assert.equal(submitted.ok, true);
      if (!submitted.ok) return;
      messageId = submitted.data.id;
    }

    await analyzeMessage(messageId, adviser);
    const item = getState().inbox.find((m) => m.id === messageId)!;

    assert.equal(item.status, "callback-required", `${source}: reply must be a call, not an email`);
    assert.equal(
      getState().drafts.filter((d) => d.inboxItemId === messageId).length,
      0,
      `${source}: no sendable email draft exists`,
    );

    const task = getState().callbackTasks.find((t) => t.caseId === "JOB-2");
    assert.ok(task, `${source}: a callback task was created`);
    assert.equal(task!.phone, "+212 600 000 002", `${source}: the verified number is shown`);
    assert.ok(getState().audit.some((a) => a.action === "email-blocked"), `${source}: recorded`);
  }
});

test("Customer B's requested slot stays a request until an adviser approves it", () => {
  resetState();
  const { adviser, tech } = actors();

  assert.equal(portalRequestSlot(tokenB(), "JOB-2", "Day 3 at 14:00").ok, true);

  const appt = () => getState().cases.find((c) => c.id === "JOB-2")!.appointment!;
  assert.equal(appt().slot, "Day 2, 10:00", "the real booking has not moved");
  assert.equal(appt().requestedSlot, "Day 3 at 14:00");
  assert.equal(appt().changeStatus, "requested");

  // The customer sees it as a request, not a confirmation.
  const view = portalView(tokenB());
  assert.equal(view.ok && view.data.cases[0].appointment!.changeState, "requested");
  assert.match(view.ok ? view.data.cases[0].appointment!.note : "", /not confirmed/);

  // A technician cannot approve it.
  assert.equal(approveBookingChange("JOB-2", "Day 3 at 14:00", tech).ok, false);

  // The adviser records the call, then applies what was actually agreed.
  const task = getState().callbackTasks.find((t) => t.caseId === "JOB-2")!;
  assert.equal(completeCallbackTask(task.id, "Called customer, agreed Day 3 at 15:30.", adviser).ok, true);
  assert.equal(approveBookingChange("JOB-2", "Day 3 at 15:30", adviser).ok, true);

  assert.equal(appt().slot, "Day 3 at 15:30", "the agreed slot, not the requested one");
  assert.equal(appt().requestedSlot, undefined);
  assert.equal(appt().lastBookingPush, "SIMULATED");

  const push = getState().audit.find((a) => a.action === "booking-change-approved")!;
  assert.equal(push.label, "simulated");
  assert.match(push.detail, /SIMULATED/);

  const call = getState().audit.find((a) => a.action === "callback-completed")!;
  assert.equal(call.label, "simulated", "the call itself is never claimed to be real");
});

test("a portal callback request creates a task with the verified number", () => {
  resetState();
  assert.equal(portalRequestCallback(tokenB(), "JOB-2").ok, true);
  const task = getState().callbackTasks.find((t) => t.caseId === "JOB-2")!;
  assert.equal(task.status, "open");
  assert.equal(task.phone, "+212 600 000 002");
  assert.equal(task.createdBy, "CUS-B");
});

test("marking a call done needs no note, but still records who and when", () => {
  resetState();
  const { adviser, tech } = actors();
  portalRequestCallback(tokenB(), "JOB-2");
  const task = getState().callbackTasks.find((t) => t.caseId === "JOB-2")!;

  // Still guarded: a technician cannot close someone else's callback.
  assert.equal(completeCallbackTask(task.id, "", tech).ok, false);

  assert.equal(completeCallbackTask(task.id, "", adviser).ok, true);
  const done = getState().callbackTasks.find((t) => t.id === task.id)!;
  assert.equal(done.status, "completed");
  assert.equal(done.completedBy, "Demo Service Adviser");
  assert.ok(done.completedAt, "the time is recorded");
  assert.match(done.outcomeNote!, /Call made/);

  const entry = getState().audit.find((a) => a.action === "callback-completed")!;
  assert.equal(entry.label, "simulated", "never claimed as a real call");
  assert.match(entry.detail, /SIMULATED call to \+212 600 000 002/);
});

test("the one-click path applies exactly the slot the customer asked for", () => {
  resetState();
  const { adviser } = actors();
  portalRequestSlot(tokenB(), "JOB-2", "Day 3 at 14:00");

  // One click = approve the requested slot as-is.
  assert.equal(approveBookingChange("JOB-2", "Day 3 at 14:00", adviser).ok, true);

  const appt = getState().cases.find((c) => c.id === "JOB-2")!.appointment!;
  assert.equal(appt.slot, "Day 3 at 14:00");
  assert.equal(appt.changeStatus, "employee-approved");
  assert.equal(appt.lastBookingPush, "SIMULATED");
});

test("an appointment case never offers a collection approval", () => {
  resetState();
  const job2 = getState().cases.find((c) => c.id === "JOB-2")!;
  assert.ok(job2.appointment, "JOB-2 is an appointment case");
  assert.equal(
    job2.checks.some((c) => c.key === "collection-approval"),
    false,
    "there is no car to release on a booking, so no collection approval exists",
  );
});

test("an appointment can only be moved before the vehicle is with us", () => {
  resetState();

  // JOB-2: booked, vehicle still with the customer.
  let view = portalView(tokenB());
  assert.equal(view.ok && view.data.cases[0].appointment!.canReschedule, true);

  // Once a change is already requested, no second request is taken.
  assert.equal(portalRequestSlot(tokenB(), "JOB-2", "Day 3 at 14:00").ok, true);
  view = portalView(tokenB());
  assert.equal(view.ok && view.data.cases[0].appointment!.canReschedule, false);

  const second = portalRequestSlot(tokenB(), "JOB-2", "Day 4 at 09:00");
  assert.equal(second.ok, false, "the rule is enforced on the server, not only in the UI");
  if (!second.ok) assert.match(second.error, /already have a change request/);

  // The first request is untouched by the refused second one.
  const appt = getState().cases.find((c) => c.id === "JOB-2")!.appointment!;
  assert.equal(appt.requestedSlot, "Day 3 at 14:00");
});

test("a second callback request is refused while one is still open", () => {
  resetState();
  assert.equal(portalRequestCallback(tokenB(), "JOB-2").ok, true);

  const again = portalRequestCallback(tokenB(), "JOB-2");
  assert.equal(again.ok, false);
  if (!again.ok) assert.match(again.error, /already have your callback request/);

  assert.equal(
    getState().callbackTasks.filter((t) => t.caseId === "JOB-2").length,
    1,
    "the adviser's list is not cluttered with duplicates",
  );

  const view = portalView(tokenB());
  assert.equal(view.ok && view.data.cases[0].callbackPending, true, "the portal knows to stop offering it");
});

test("a repair case in the workshop offers no reschedule at all", () => {
  resetState();
  const view = portalView(tokenA());
  assert.equal(view.ok, true);
  if (!view.ok) return;
  assert.equal(view.data.cases[0].appointment, undefined, "JOB-1 is a repair, not a booking");
});

test("every phone number shown is an obviously synthetic +212 placeholder", () => {
  resetState();
  const state = getState();
  assert.match(state.dealership.phone, /^\+212 /);
  for (const c of state.customers) {
    assert.match(c.verifiedPhone, /^\+212 6\d\d 000 00\d$/, `${c.id} has a synthetic number`);
  }
});

test("everything the customer does lands in the inbox, messages and requests alike", async () => {
  resetState();
  const { adviser } = actors();
  const before = getState().inbox.length;

  portalSubmitMessage(tokenB(), "JOB-2", "Please call me after 17:00.");
  portalRequestSlot(tokenB(), "JOB-2", "Day 3 at 14:00");

  const inbox = getState().inbox;
  assert.equal(inbox.length, before + 2, "both actions are visible, not just the message");

  const message = inbox.find((i) => i.text.includes("17:00"))!;
  assert.equal(message.kind, "message");
  assert.equal(message.request, undefined);

  const request = inbox.find((i) => i.kind === "appointment-request")!;
  assert.ok(request, "the reschedule is in the inbox too, not hidden on the case");
  assert.equal(request.request!.from, "Day 2, 10:00");
  assert.equal(request.request!.to, "Day 3 at 14:00");
  assert.equal(request.status, "callback-required");
  assert.equal(request.match.status, "verified");

  // A structured request is never handed to a model to re-interpret.
  const analysed = await analyzeMessage(request.id, adviser);
  assert.equal(analysed.ok, false);
  if (!analysed.ok) assert.match(analysed.error, /structured request/);
  assert.equal(getState().inbox.find((i) => i.id === request.id)!.ai, undefined);
});

test("a portal callback request also appears in the inbox", () => {
  resetState();
  const before = getState().inbox.length;
  portalRequestCallback(tokenB(), "JOB-2", "Best reached in the evening.");

  const item = getState().inbox.find((i) => i.kind === "callback-request")!;
  assert.equal(getState().inbox.length, before + 1);
  assert.equal(item.request!.summary, "Best reached in the evening.");
  assert.equal(item.status, "callback-required");
});
