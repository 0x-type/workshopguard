import { test } from "node:test";
import assert from "node:assert/strict";

import { getState, resetState } from "../lib/store/store.ts";
import {
  analyzeMessage,
  approveDraft,
  confirmCollection,
  editDraft,
  evaluationFor,
  linkMessage,
  rejectDraft,
  setCheck,
  simulateInbound,
} from "../lib/domain/transitions.ts";
import { nextActions } from "../lib/domain/nextAction.ts";
import { channelPolicy } from "../lib/domain/channelPolicy.ts";
import type { Actor } from "../lib/types.ts";

function actors() {
  const s = getState();
  const by = (role: string) => s.employees.find((e) => e.role === role)! as Actor;
  return {
    tech: by("technician"),
    qi: by("quality-inspector"),
    adviser: by("service-adviser"),
  };
}

test("Customer A: the whole demonstration, end to end", async () => {
  resetState();
  const { tech, qi, adviser } = actors();

  // 1. The message is matched deterministically and drafted.
  const analyzed = await analyzeMessage("MSG-1", adviser);
  assert.equal(analyzed.ok, true);
  const item = getState().inbox.find((m) => m.id === "MSG-1")!;
  assert.equal(item.match.status, "verified");
  assert.equal(item.ai?.intent, "collection_request");
  assert.equal(item.status, "drafted");

  // 2. The conflict is present and the evidence cites the real record.
  const draft = getState().drafts.find((d) => d.inboxItemId === "MSG-1")!;
  assert.equal(draft.evidence.recommendation, "Do not confirm collection.");
  assert.equal(
    draft.evidence.conflicts[0],
    "Conflict: CRM says ready for collection, but quality check is still pending. Employee review required.",
  );
  const qcFact = draft.evidence.facts.find((f) => f.label === "Quality check")!;
  assert.equal(qcFact.value, "pending");
  assert.equal(qcFact.source, "C01/initial.json → jobs[JOB-1].quality_check");

  // 3. A technician cannot approve the response.
  const techApproval = approveDraft(draft.id, tech);
  assert.equal(techApproval.ok, false);
  if (!techApproval.ok) assert.equal(techApproval.status, 403);
  assert.ok(
    getState().audit.some((a) => a.action === "denied:approve-response"),
    "the refusal is recorded, not silently dropped",
  );

  // 4. An edit that sneaks in a promise is refused at approval.
  editDraft(draft.id, "Yes, you can collect your car this afternoon.", adviser);
  const promised = approveDraft(draft.id, adviser);
  assert.equal(promised.ok, false, "the guardrail catches a human-introduced promise");

  // 5. A careful edit is approved.
  editDraft(
    draft.id,
    "The workshop work is finished. The quality check is still in progress, so I cannot confirm a time yet.",
    adviser,
  );
  assert.equal(approveDraft(draft.id, adviser).ok, true);
  assert.equal(getState().drafts.find((d) => d.id === draft.id)!.status, "approved");

  // 6. Nobody can confirm collection yet — not even the adviser.
  const early = confirmCollection("JOB-1", adviser);
  assert.equal(early.ok, false);
  if (!early.ok) assert.equal(early.status, 409);

  // 7. Wrong roles cannot pass the quality check.
  assert.equal(setCheck("JOB-1", "quality-check", { status: "passed" }, tech).ok, false);
  assert.equal(setCheck("JOB-1", "quality-check", { status: "passed" }, adviser).ok, false);

  // 8. The quality inspector passes it. THE CHANGED INFORMATION.
  const passed = setCheck(
    "JOB-1",
    "quality-check",
    { status: "passed", note: "Road test and visual inspection completed." },
    qi,
  );
  assert.equal(passed.ok, true);

  // 9. The status recalculates by itself.
  const after = evaluationFor("JOB-1")!;
  assert.deepEqual(after.conflicts, []);
  assert.equal(after.collectionAllowed, true);

  // 10. Now, and only now, the adviser can confirm collection.
  assert.equal(confirmCollection("JOB-1", qi).ok, false, "the inspector still cannot confirm");
  assert.equal(confirmCollection("JOB-1", adviser).ok, true);
  assert.equal(evaluationFor("JOB-1")!.collectionConfirmed, true);

  // 11. Everything that happened is in the history.
  const actions = getState().audit.map((a) => a.action);
  for (const expected of [
    "response-drafted",
    "denied:approve-response",
    "response-approved",
    "denied:confirm-collection",
    "check-updated",
    "collection-confirmed",
  ]) {
    assert.ok(actions.includes(expected), `history must contain ${expected}`);
  }
});

test("failure path: a message that cannot be tied to one verified case stops", async () => {
  resetState();
  const { adviser } = actors();

  const created = simulateInbound(
    { text: "My car, the blue one — is it ready?", channel: "email" },
    adviser,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const id = created.data.id;

  const analyzed = await analyzeMessage(id, adviser);
  assert.equal(analyzed.ok, true);

  const item = getState().inbox.find((m) => m.id === id)!;
  assert.equal(item.status, "needs-manual-review");
  assert.equal(item.match.status, "unverified");
  assert.equal(item.ai, undefined, "no AI output is produced for an unverified case");
  assert.equal(item.text, "My car, the blue one — is it ready?", "the original text is preserved");
  assert.equal(
    getState().drafts.filter((d) => d.inboxItemId === id).length,
    0,
    "nothing is drafted and nothing could be sent",
  );

  // An employee can resolve it by hand, and that is recorded.
  const linked = linkMessage(id, "CUS-A", "JOB-1", adviser);
  assert.equal(linked.ok, true);
  assert.equal(getState().inbox.find((m) => m.id === id)!.match.status, "verified");
  assert.ok(getState().audit.some((a) => a.action === "message-linked"));

  // Linking to someone else's case is still refused.
  const wrong = linkMessage(id, "CUS-A", "JOB-2", adviser);
  assert.equal(wrong.ok, false);
});

test("failure path: an AI provider failure also stops at manual review", async () => {
  resetState();
  const { adviser } = actors();
  process.env.C01_FORCE_AI_FAILURE = "true";
  try {
    await analyzeMessage("MSG-1", adviser);
    const item = getState().inbox.find((m) => m.id === "MSG-1")!;
    assert.equal(item.status, "needs-manual-review");
    assert.match(item.ai!.error!, /unavailable/);
    assert.equal(getState().drafts.length, 0, "no draft, so nothing can be sent");
  } finally {
    delete process.env.C01_FORCE_AI_FAILURE;
  }
});

test("a quality check cannot jump to an invalid status", () => {
  resetState();
  const { qi } = actors();
  const r = setCheck("JOB-1", "quality-check", { status: "cancelled" }, qi);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /cannot move from 'pending' to 'cancelled'/);
});

test("a denied response sends nothing and goes back for manual handling", async () => {
  resetState();
  const { tech, adviser } = actors();

  await analyzeMessage("MSG-1", adviser);
  const draft = getState().drafts.find((d) => d.inboxItemId === "MSG-1")!;

  // Only the service adviser may deny, same as approving.
  assert.equal(rejectDraft(draft.id, tech).ok, false);

  assert.equal(rejectDraft(draft.id, adviser, "Wording too vague").ok, true);
  assert.equal(getState().drafts.find((d) => d.id === draft.id)!.status, "rejected");
  assert.equal(
    getState().inbox.find((m) => m.id === "MSG-1")!.status,
    "drafted",
    "it stays on the adviser's pile so the wording can be revised, not abandoned",
  );

  const entry = getState().audit.find((a) => a.action === "response-denied")!;
  assert.ok(entry, "the denial is recorded");
  assert.match(entry.detail, /Wording too vague/);
});

test("an approved response cannot be denied afterwards", async () => {
  resetState();
  const { adviser } = actors();

  await analyzeMessage("MSG-1", adviser);
  const draft = getState().drafts.find((d) => d.inboxItemId === "MSG-1")!;
  assert.equal(approveDraft(draft.id, adviser).ok, true);

  const late = rejectDraft(draft.id, adviser);
  assert.equal(late.ok, false);
  if (!late.ok) assert.match(late.error, /already approved/);
});

test("a denied response can be reworded and approved, then sent", async () => {
  resetState();
  const { adviser } = actors();

  await analyzeMessage("MSG-1", adviser);
  const draft = getState().drafts.find((d) => d.inboxItemId === "MSG-1")!;

  assert.equal(rejectDraft(draft.id, adviser, "Too vague").ok, true);
  assert.equal(getState().drafts.find((d) => d.id === draft.id)!.status, "rejected");

  // The case still shows an outstanding approval rather than going quiet.
  const caseRecord = getState().cases.find((c) => c.id === "JOB-1")!;
  const customer = getState().customers.find((c) => c.id === "CUS-A")!;
  const actions = nextActions({
    caseRecord,
    evaluation: evaluationFor("JOB-1")!,
    draft: getState().drafts.find((d) => d.id === draft.id),
    policy: channelPolicy(customer),
    viewer: "service-adviser",
  });
  assert.ok(
    actions.some((a) => /denied response needs rewording/.test(a.text)),
    "the denial is surfaced as work still to do",
  );

  // Reword and approve — no reset, no new analysis needed.
  assert.equal(
    editDraft(
      draft.id,
      "Bonjour, les travaux sont terminés. Le contrôle qualité est encore en cours.",
      adviser,
    ).ok,
    true,
  );
  assert.equal(approveDraft(draft.id, adviser).ok, true);
  assert.equal(getState().drafts.find((d) => d.id === draft.id)!.status, "approved");
});
