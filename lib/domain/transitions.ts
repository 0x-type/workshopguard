/**
 * The single funnel for every state change.
 *
 * Each function: check the permission -> validate against the rules -> mutate ->
 * write the audit entry. API routes contain no logic of their own, so there is
 * no path that changes state without a permission check and a history record.
 */

import type {
  Actor,
  CallbackTask,
  Case,
  CheckRecord,
  Customer,
  Draft,
  InboxItem,
  OutboundAttempt,
  State,
} from "@/lib/types";
import { getState, mutate, nextId, now, recordAudit } from "@/lib/store/store";
import { suppliedRules } from "@/lib/store/seed";
import { checkPermission, type Action } from "@/lib/domain/permissions";
import { matchMessage } from "@/lib/domain/matching";
import { evaluateCase, findCheck, isValidQualityTransition, type Evaluation } from "@/lib/domain/rules";
import { buildEvidence } from "@/lib/domain/evidence";
import { checkDraft } from "@/lib/ai/guardrail";
import { getProvider } from "@/lib/ai/provider";
import { channelPolicy } from "@/lib/domain/channelPolicy";
import { buildPublicView, type PublicView } from "@/lib/domain/publicStatus";

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function fail(status: number, error: string): Result<never> {
  return { ok: false, status, error };
}

/** A refused action is recorded, not silently dropped. */
function guard(actor: Actor, action: Action, target: string): Result<true> {
  const check = checkPermission(actor.role, action);
  if (check.ok) return { ok: true, data: true };
  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: `denied:${action}`,
    target,
    detail: check.reason,
    label: "real",
  });
  return fail(403, check.reason);
}

export function caseById(state: State, id: string): Case | undefined {
  return state.cases.find((c) => c.id === id);
}

export function evaluationFor(caseId: string): Evaluation | undefined {
  const c = caseById(getState(), caseId);
  return c ? evaluateCase(c) : undefined;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function analyzeMessage(itemId: string, actor: Actor): Promise<Result<InboxItem>> {
  const permitted = guard(actor, "analyze-message", itemId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const item = state.inbox.find((m) => m.id === itemId);
  if (!item) return fail(404, `Message ${itemId} not found.`);

  // A structured request already says exactly what it wants. Handing it to a
  // model would be inventing an interpretation step that adds nothing.
  if (item.kind !== "message") {
    return fail(
      400,
      "This is a structured request, not a written message. There is nothing to interpret — act on it directly.",
    );
  }

  // Deterministic matching first. AI never sees an unverified case.
  item.match = matchMessage(item, state);

  if (item.match.status !== "verified") {
    item.status = "needs-manual-review";
    item.ai = undefined;
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "manual-review-required",
      target: item.id,
      detail: item.match.reason,
      label: "real",
    });
    mutate(() => undefined);
    return { ok: true, data: item };
  }

  const caseRecord = caseById(state, item.match.caseId!)!;
  const customer = state.customers.find((c) => c.id === item.match.customerId!)!;
  const evaluation = evaluateCase(caseRecord);

  // How the dealership may REPLY is decided here, deterministically, before
  // any draft exists. The channel a message arrived on grants nothing.
  const policy = channelPolicy(customer);

  const provider = await getProvider();
  const history = state.inbox
    .filter((m) => m.id !== item.id && m.match.caseId === caseRecord.id)
    .map((m) => ({ channel: m.channel, text: m.text }));

  const output = await provider.analyze({
    text: item.text,
    channel: item.channel,
    customer,
    caseRecord,
    evaluation,
    dealershipPhone: state.dealership.phone,
    history,
  });

  // When the live model failed and the deterministic mock stood in, say so
  // rather than presenting a templated draft as if a model wrote it.
  const providerLabel = output.fellBackFrom
    ? `mock fallback (${output.fellBackFrom} unavailable)`
    : provider.name;

  item.ai = {
    intent: output.intent,
    confidence: output.confidence,
    summary: output.summary,
    language: output.language,
    provider: providerLabel,
    error: output.error,
  };

  // A customer who may not be emailed never gets an email draft, whatever the
  // model produced. The request becomes a call task instead.
  if (!policy.emailAllowed) {
    item.status = "callback-required";
    state.drafts = state.drafts.filter((d) => d.inboxItemId !== item.id);

    openCallback(caseRecord.id, customer.id, `${item.text} — ${policy.reason}`, {
      role: actor.role,
      id: actor.id,
    });

    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "email-blocked",
      target: item.id,
      detail: `${policy.reason} No response was drafted for sending.`,
      label: "real",
    });
    mutate(() => undefined);
    return { ok: true, data: item };
  }

  if (output.error || !output.draft) {
    item.status = "needs-manual-review";
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "manual-review-required",
      target: item.id,
      detail: output.error ?? "No response could be drafted for this message.",
      label: "real",
    });
    mutate(() => undefined);
    return { ok: true, data: item };
  }

  // The guardrail runs on the model's own output before a human ever sees it.
  const verdict = checkDraft(output.draft, evaluation);
  if (!verdict.ok) {
    item.status = "needs-manual-review";
    item.ai.error = `Draft refused by the promise guardrail: "${verdict.matched}". ${verdict.reason}`;
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "draft-refused",
      target: item.id,
      detail: item.ai.error,
      label: "real",
    });
    mutate(() => undefined);
    return { ok: true, data: item };
  }

  const draft: Draft = {
    id: nextId("DRF"),
    inboxItemId: item.id,
    caseId: caseRecord.id,
    language: output.language,
    body: output.draft,
    status: "suggested",
    evidence: buildEvidence(caseRecord, customer, evaluation, suppliedRules(), now()),
  };
  state.drafts = state.drafts.filter((d) => d.inboxItemId !== item.id);
  state.drafts.push(draft);
  item.status = "drafted";

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "response-drafted",
    target: item.id,
    detail: `Intent '${output.intent}' (${Math.round(output.confidence * 100)}%). Draft ${draft.id} prepared in ${output.language} by ${providerLabel}.`,
    label: output.fellBackFrom ? "simulated" : "real",
  });

  mutate(() => undefined);
  return { ok: true, data: item };
}

/** Resolve an unverified message by hand. The employee vouches for the link. */
export function linkMessage(
  itemId: string,
  customerId: string,
  caseRef: string,
  actor: Actor,
): Result<InboxItem> {
  const permitted = guard(actor, "link-message", itemId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const item = state.inbox.find((m) => m.id === itemId);
  if (!item) return fail(404, `Message ${itemId} not found.`);

  const result = matchMessage(
    { claimedCustomerId: customerId, claimedCaseRef: caseRef },
    state,
  );
  if (result.status !== "verified") return fail(400, result.reason);

  item.claimedCustomerId = customerId;
  item.claimedCaseRef = caseRef;
  item.match = { ...result, resolvedBy: actor.id, reason: `${result.reason} Verified by hand.` };
  item.status = "new";

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "message-linked",
    target: item.id,
    detail: `Manually verified against customer ${customerId} and case ${caseRef}.`,
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: item };
}

/** Clearly-labelled simulated inbound message. Not a real integration. */
export function simulateInbound(
  payload: { text: string; channel: InboxItem["channel"]; customerId?: string; caseRef?: string },
  actor: Actor,
): Result<InboxItem> {
  const permitted = guard(actor, "simulate-inbound", "inbox");
  if (!permitted.ok) return permitted;

  const state = getState();
  const item: InboxItem = {
    id: nextId("SIM"),
    kind: "message",
    channel: payload.channel,
    text: payload.text,
    receivedAt: now(),
    origin: "simulated",
    claimedCustomerId: payload.customerId,
    claimedCaseRef: payload.caseRef,
    match: { status: "unverified", reason: "Not yet evaluated." },
    status: "new",
  };
  item.match = matchMessage(item, state);
  if (item.match.status !== "verified") item.status = "needs-manual-review";
  state.inbox.push(item);

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "simulated-inbound",
    target: item.id,
    detail: `SIMULATED incoming ${payload.channel} message. No real message was received.`,
    label: "simulated",
  });
  mutate(() => undefined);
  return { ok: true, data: item };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function setCheck(
  caseId: string,
  key: string,
  patch: { status: string; note?: string; name?: string },
  actor: Actor,
): Result<Case> {
  const action: Action = key === "quality-check" ? "set-quality-check" : "update-repair-check";
  const permitted = guard(actor, action, `${caseId}/${key}`);
  if (!permitted.ok) return permitted;

  const state = getState();
  const caseRecord = caseById(state, caseId);
  if (!caseRecord) return fail(404, `Case ${caseId} not found.`);

  if (key === "collection-approval") {
    return fail(400, "Collection approval is not a free-form check. Use the confirm-collection action.");
  }

  const existing = findCheck(caseRecord, key);

  if (key === "quality-check") {
    const from = existing?.status ?? "missing";
    if (!isValidQualityTransition(from, patch.status)) {
      return fail(400, `A quality check cannot move from '${from}' to '${patch.status}'.`);
    }
  }

  const before = existing?.status ?? "missing";

  if (existing) {
    existing.status = patch.status;
    if (patch.note !== undefined) existing.note = patch.note;
    existing.updatedAt = now();
    existing.updatedBy = actor.displayLabel;
    existing.origin = "synthetic";
  } else {
    caseRecord.checks.push({
      key,
      name: patch.name ?? key,
      status: patch.status,
      ownerRole: actor.role,
      note: patch.note ?? "",
      updatedAt: now(),
      updatedBy: actor.displayLabel,
      origin: "synthetic",
    });
  }
  caseRecord.updatedAt = now();

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "check-updated",
    target: `${caseId}/${key}`,
    detail: `'${before}' → '${patch.status}'.${patch.note ? ` Note: ${patch.note}` : ""}`,
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: caseRecord };
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export function confirmCollection(caseId: string, actor: Actor): Result<Case> {
  const permitted = guard(actor, "confirm-collection", caseId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const caseRecord = caseById(state, caseId);
  if (!caseRecord) return fail(404, `Case ${caseId} not found.`);

  const evaluation = evaluateCase(caseRecord);
  if (!evaluation.collectionAllowed) {
    const reason = [...evaluation.conflicts, ...evaluation.blockers].join(" ");
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "denied:confirm-collection",
      target: caseId,
      detail: `Refused by the rules: ${reason}`,
      label: "real",
    });
    return fail(409, `Collection cannot be confirmed. ${reason}`);
  }

  const check = findCheck(caseRecord, "collection-approval");
  if (check) {
    check.status = "confirmed";
    check.updatedAt = now();
    check.updatedBy = actor.displayLabel;
    check.note = "Collection approved by the service adviser.";
  }
  caseRecord.updatedAt = now();

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "collection-confirmed",
    target: caseId,
    detail: "Workshop work finished, quality check passed, no unresolved conflict.",
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: caseRecord };
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export function editDraft(draftId: string, body: string, actor: Actor): Result<Draft> {
  const permitted = guard(actor, "edit-draft", draftId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft) return fail(404, `Draft ${draftId} not found.`);
  if (draft.status === "approved") return fail(409, "An approved response can no longer be edited.");

  draft.editedBody = body;
  draft.status = "edited";

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "draft-edited",
    target: draftId,
    detail: "Suggested response edited by an employee before approval.",
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: draft };
}

export function approveDraft(draftId: string, actor: Actor): Result<Draft> {
  const permitted = guard(actor, "approve-response", draftId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft) return fail(404, `Draft ${draftId} not found.`);

  const caseRecord = caseById(state, draft.caseId);
  if (!caseRecord) return fail(404, `Case ${draft.caseId} not found.`);
  const evaluation = evaluateCase(caseRecord);

  // The guardrail runs again on the text actually being approved, because a
  // human edit can introduce a promise the model never wrote.
  const finalBody = draft.editedBody ?? draft.body;
  const verdict = checkDraft(finalBody, evaluation);
  if (!verdict.ok) {
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "denied:approve-response",
      target: draftId,
      detail: `Promise guardrail refused the text: "${verdict.matched}".`,
      label: "real",
    });
    return fail(409, verdict.reason);
  }

  draft.status = "approved";
  draft.approvedBy = actor.displayLabel;
  draft.approvedAt = now();

  const item = state.inbox.find((m) => m.id === draft.inboxItemId);
  if (item) item.status = "approved";

  // Refresh the evidence so the panel reflects the state at the moment of approval.
  const customer = state.customers.find((c) => c.id === caseRecord.customerId);
  draft.evidence = buildEvidence(caseRecord, customer, evaluation, suppliedRules(), now());

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "response-approved",
    target: draftId,
    detail: `Response to ${caseRecord.customerId} on case ${caseRecord.id} approved${draft.editedBody ? " (edited before approval)" : ""}.`,
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: draft };
}

export function rejectDraft(draftId: string, actor: Actor, reason?: string): Result<Draft> {
  const permitted = guard(actor, "approve-response", draftId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft) return fail(404, `Draft ${draftId} not found.`);
  if (draft.status === "approved") {
    return fail(409, "This response was already approved and cannot be denied afterwards.");
  }

  draft.status = "rejected";

  // The customer still has not been answered, so the message stays on the
  // adviser's pile with its draft intact, ready to be reworded and approved.
  const item = state.inbox.find((m) => m.id === draft.inboxItemId);
  if (item) item.status = "drafted";

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "response-denied",
    target: draftId,
    detail: reason
      ? `Suggested response denied. Reason: ${reason}`
      : "Suggested response denied. Nothing was sent; the wording can be revised and approved.",
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: draft };
}

// ---------------------------------------------------------------------------
// Portal (customer-initiated). A customer can ask; they can never decide.
// ---------------------------------------------------------------------------


/** Resolves an opaque demo link to exactly one customer, or nobody. */
export function customerForToken(token: string) {
  return getState().customers.find((c) => c.portalToken === token);
}

export function portalView(token: string): Result<PublicView> {
  const state = getState();
  const customer = customerForToken(token);
  if (!customer) return fail(404, "Unknown link.");
  return {
    ok: true,
    data: buildPublicView(customer, state.cases, state.drafts, state.callbackTasks, state.dealership),
  };
}

/** A case only counts as the customer's own if the record says so. */
type OwnCase =
  | { ok: false; error: string }
  | { ok: true; customer: Customer; caseRecord: Case };

function ownCase(token: string, caseId: string): OwnCase {
  const state = getState();
  const customer = customerForToken(token);
  if (!customer) return { ok: false, error: "Unknown link." };
  const caseRecord = state.cases.find((c) => c.id === caseId && c.customerId === customer.id);
  if (!caseRecord) return { ok: false, error: "That case is not on this account." };
  return { ok: true, customer, caseRecord };
}

export function portalSubmitMessage(token: string, caseId: string, text: string): Result<InboxItem> {
  const found = ownCase(token, caseId);
  if (!found.ok) return fail(404, found.error);
  if (!text.trim()) return fail(400, "A message is required.");

  const state = getState();
  const item: InboxItem = {
    id: nextId("POR"),
    kind: "message",
    channel: "portal",
    text: text.trim(),
    receivedAt: now(),
    origin: "portal",
    claimedCustomerId: found.customer.id,
    claimedCaseRef: found.caseRecord.id,
    match: { status: "unverified", reason: "Not yet evaluated." },
    status: "new",
  };
  item.match = matchMessage(item, state);
  state.inbox.push(item);

  recordAudit({
    actorRole: "customer",
    actorId: found.customer.id,
    action: "portal-message",
    target: item.id,
    detail: `Customer submitted a message on case ${found.caseRecord.id} from the portal.`,
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: item };
}

/**
 * Puts a structured customer request into the inbox alongside their messages,
 * so the adviser has one list of everything the customer has done rather than
 * a message here and a hidden field on the case there.
 */
function recordRequest(
  customer: Customer,
  caseRecord: Case,
  kind: InboxItem["kind"],
  text: string,
  request: { from?: string; to?: string; summary: string },
  needsCall: boolean,
): InboxItem {
  const state = getState();
  const item: InboxItem = {
    id: nextId("REQ"),
    kind,
    channel: "portal",
    text,
    receivedAt: now(),
    origin: "portal",
    claimedCustomerId: customer.id,
    claimedCaseRef: caseRecord.id,
    match: matchMessage(
      { claimedCustomerId: customer.id, claimedCaseRef: caseRecord.id },
      state,
    ),
    // A structured request needs no interpretation, so it is never "new and
    // unread" — it is already understood and waiting on a person.
    status: needsCall ? "callback-required" : "new",
    request,
  };
  state.inbox.push(item);
  return item;
}

export function portalRequestCallback(token: string, caseId: string, reason?: string): Result<CallbackTask> {
  const found = ownCase(token, caseId);
  if (!found.ok) return fail(404, found.error);

  // One open callback per case. A second request does not get the customer
  // called twice; it just clutters the adviser's list.
  const already = getState().callbackTasks.find(
    (t) => t.caseId === found.caseRecord.id && t.status === "open",
  );
  if (already) {
    return fail(409, "We already have your callback request. We will telephone you.");
  }

  const why = reason?.trim() || "Customer requested a callback from the portal.";
  recordRequest(
    found.customer,
    found.caseRecord,
    "callback-request",
    "Asked to be called back.",
    { summary: why },
    true,
  );

  return openCallback(found.caseRecord.id, found.customer.id, why, {
    role: "customer",
    id: found.customer.id,
  });
}

export function portalRequestSlot(token: string, caseId: string, slot: string): Result<Case> {
  const found = ownCase(token, caseId);
  if (!found.ok) return fail(404, found.error);
  if (!slot.trim()) return fail(400, "A preferred date and time is required.");

  const { caseRecord, customer } = found;
  if (!caseRecord.appointment) return fail(400, "That case has no appointment to change.");

  // The same rule the portal shows, enforced here so it cannot be bypassed.
  const view = buildPublicView(customer, [caseRecord], [], getState().callbackTasks, getState().dealership);
  const publicAppointment = view.cases[0]?.appointment;
  if (publicAppointment && !publicAppointment.canReschedule) {
    return fail(409, publicAppointment.rescheduleBlockedReason ?? "This visit can no longer be changed.");
  }

  const previousSlot = caseRecord.appointment.slot;
  caseRecord.appointment.requestedSlot = slot.trim();
  caseRecord.appointment.requestedBy = customer.id;
  caseRecord.appointment.changeStatus = "requested";
  caseRecord.updatedAt = now();

  recordAudit({
    actorRole: "customer",
    actorId: customer.id,
    action: "appointment-change-requested",
    target: caseRecord.id,
    detail: `Customer asked for '${slot.trim()}' instead of '${caseRecord.appointment.slot}'. REQUESTED ONLY — not confirmed.`,
    label: "real",
  });

  const policy = channelPolicy(customer);

  recordRequest(
    customer,
    caseRecord,
    "appointment-request",
    `Asked to move their appointment to ${slot.trim()}.`,
    { from: previousSlot, to: slot.trim(), summary: "Appointment change requested." },
    policy.callbackRequired,
  );

  // A callback-only customer cannot be answered by email, so the request
  // becomes a call task the moment it arrives.
  if (policy.callbackRequired) {
    openCallback(
      caseRecord.id,
      customer.id,
      `Appointment change requested: '${slot.trim()}'. ${policy.reason}`,
      { role: "customer", id: customer.id },
    );
  }

  mutate(() => undefined);
  return { ok: true, data: caseRecord };
}

// ---------------------------------------------------------------------------
// Callback tasks
// ---------------------------------------------------------------------------

function openCallback(
  caseId: string,
  customerId: string,
  reason: string,
  by: { role: Actor["role"] | "customer"; id: string },
): Result<CallbackTask> {
  const state = getState();
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) return fail(404, `Customer ${customerId} not found.`);

  const existing = state.callbackTasks.find((t) => t.caseId === caseId && t.status === "open");
  if (existing) {
    existing.reason = `${existing.reason} · ${reason}`;
    mutate(() => undefined);
    return { ok: true, data: existing };
  }

  const task: CallbackTask = {
    id: nextId("CBK"),
    caseId,
    customerId,
    reason,
    phone: customer.verifiedPhone,
    status: "open",
    createdBy: by.id,
    createdAt: now(),
  };
  state.callbackTasks.push(task);

  recordAudit({
    actorRole: by.role as Actor["role"],
    actorId: by.id,
    action: "callback-task-created",
    target: task.id,
    detail: `${reason} Call ${customer.verifiedPhone}.`,
    label: "real",
  });
  mutate(() => undefined);
  return { ok: true, data: task };
}

export function createCallbackTask(caseId: string, reason: string, actor: Actor): Result<CallbackTask> {
  const permitted = guard(actor, "manage-callback", caseId);
  if (!permitted.ok) return permitted;
  const state = getState();
  const caseRecord = caseById(state, caseId);
  if (!caseRecord) return fail(404, `Case ${caseId} not found.`);
  return openCallback(caseId, caseRecord.customerId, reason, { role: actor.role, id: actor.id });
}

/**
 * Records that a call was made. The call itself is SIMULATED — no telephone
 * system is contacted and the audit entry says so.
 */
export function completeCallbackTask(
  taskId: string,
  outcomeNote: string,
  actor: Actor,
): Result<CallbackTask> {
  const permitted = guard(actor, "manage-callback", taskId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const task = state.callbackTasks.find((t) => t.id === taskId);
  if (!task) return fail(404, `Callback task ${taskId} not found.`);
  if (task.status === "completed") return fail(409, "That callback is already completed.");

  // A note is welcome but not demanded. What must be recorded is that the call
  // happened and who says so; what was agreed about the booking is recorded by
  // the booking change itself.
  const note = outcomeNote.trim() || "Call made. No further note recorded.";

  task.status = "completed";
  task.outcomeNote = note;
  task.completedBy = actor.displayLabel;
  task.completedAt = now();

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "callback-completed",
    target: task.id,
    detail: `SIMULATED call to ${task.phone}. Outcome: ${note}`,
    label: "simulated",
  });
  mutate(() => undefined);
  return { ok: true, data: task };
}

// ---------------------------------------------------------------------------
// Booking changes
// ---------------------------------------------------------------------------

export function approveBookingChange(
  caseId: string,
  agreedSlot: string,
  actor: Actor,
): Result<Case> {
  const permitted = guard(actor, "approve-booking-change", caseId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const caseRecord = caseById(state, caseId);
  if (!caseRecord?.appointment) return fail(404, `Case ${caseId} has no appointment.`);
  if (!agreedSlot.trim()) return fail(400, "Record the slot that was actually agreed.");

  const previous = caseRecord.appointment.slot;
  caseRecord.appointment.slot = agreedSlot.trim();
  caseRecord.appointment.requestedSlot = undefined;
  caseRecord.appointment.requestedBy = undefined;
  caseRecord.appointment.changeStatus = "employee-approved";
  caseRecord.appointment.lastBookingPush = "SIMULATED";
  caseRecord.updatedAt = now();

  const appointmentCheck = findCheck(caseRecord, "appointment");
  if (appointmentCheck) {
    appointmentCheck.status = "booked";
    appointmentCheck.note = `Moved from '${previous}' to '${agreedSlot.trim()}' by agreement on a call.`;
    appointmentCheck.updatedAt = now();
    appointmentCheck.updatedBy = actor.displayLabel;
    appointmentCheck.origin = "synthetic";
  }

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "booking-change-approved",
    target: caseRecord.id,
    detail: `'${previous}' → '${agreedSlot.trim()}'. External booking system update is SIMULATED; no real booking was changed.`,
    label: "simulated",
  });
  mutate(() => undefined);
  return { ok: true, data: caseRecord };
}

// ---------------------------------------------------------------------------
// Outbound test email
// ---------------------------------------------------------------------------

/**
 * Sends an APPROVED response to the allow-listed test address.
 *
 * A failure never loses the work: the draft stays approved, the attempt is
 * recorded, and the employee can retry.
 */
export async function sendApprovedDraft(
  draftId: string,
  actor: Actor,
): Promise<Result<OutboundAttempt>> {
  const permitted = guard(actor, "send-approved-email", draftId);
  if (!permitted.ok) return permitted;

  const state = getState();
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft) return fail(404, `Draft ${draftId} not found.`);
  if (draft.status !== "approved" && draft.status !== "send-failed") {
    return fail(409, "Only a response that a service adviser has approved can be sent.");
  }

  const caseRecord = caseById(state, draft.caseId);
  if (!caseRecord) return fail(404, `Case ${draft.caseId} not found.`);
  const customer = state.customers.find((c) => c.id === caseRecord.customerId);
  if (!customer) return fail(404, "Customer not found.");

  // The communication permission is checked again at the moment of sending, not
  // only when the draft was written.
  const policy = channelPolicy(customer);
  if (!policy.emailAllowed) {
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "denied:send-approved-email",
      target: draftId,
      detail: policy.reason,
      label: "real",
    });
    return fail(409, policy.reason);
  }

  const { sendTestEmail } = await import("@/lib/email/resend");
  const outcome = await sendTestEmail({
    subject: `Your vehicle — case ${caseRecord.id}`,
    body: draft.editedBody ?? draft.body,
    caseRef: caseRecord.id,
    customerId: customer.id,
  });

  const attempt: OutboundAttempt = {
    id: nextId("OUT"),
    draftId: draft.id,
    to: outcome.to,
    provider: outcome.provider,
    result: outcome.result === "failed" ? "failed" : "sent",
    error: outcome.result === "failed" ? outcome.error : undefined,
    at: now(),
    label: outcome.provider === "resend" ? "TEST" : "SIMULATED",
  };
  state.outbound.push(attempt);

  if (outcome.result === "failed") {
    // The approved wording is preserved for a retry — it is not thrown away.
    draft.status = "send-failed";
    recordAudit({
      actorRole: actor.role,
      actorId: actor.id,
      action: "email-send-failed",
      target: draft.id,
      detail: `Resend failed: ${outcome.error}. The approved draft is preserved and can be retried.`,
      label: "test",
    });
    mutate(() => undefined);
    return fail(502, `Sending failed: ${outcome.error}`);
  }

  draft.status = "approved";
  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: outcome.provider === "resend" ? "test-email-sent" : "email-simulated",
    target: draft.id,
    detail:
      outcome.provider === "resend"
        ? `TEST email sent via Resend to the allow-listed address ${outcome.to}. No real customer was contacted.`
        : `Email SIMULATED (${outcome.result === "simulated" ? outcome.reason : ""}). Nothing left this machine.`,
    label: outcome.provider === "resend" ? "test" : "simulated",
  });

  mutate(() => undefined);
  return { ok: true, data: attempt };
}

// ---------------------------------------------------------------------------
// Inbound email (Resend webhook)
// ---------------------------------------------------------------------------

/**
 * Turns a verified inbound email into an inbox item.
 *
 * The sender's address is recorded but is NEVER used to identify them. Matching
 * runs on a customer ID and case reference quoted in the message, and only if
 * those survive the same checks every other channel goes through. An email that
 * cannot be tied to one verified case stops at manual review, exactly like the
 * simulated one.
 */
export function recordInboundEmail(payload: {
  emailId: string;
  from: string;
  subject: string;
  text: string;
  customerId?: string;
  caseRef?: string;
}): Result<InboxItem> {
  const state = getState();

  if (state.inbox.some((m) => m.externalId === payload.emailId)) {
    const existing = state.inbox.find((m) => m.externalId === payload.emailId)!;
    return { ok: true, data: existing }; // Webhooks can be retried; do not duplicate.
  }

  const item: InboxItem = {
    id: nextId("EML"),
    kind: "message",
    channel: "email",
    text: payload.text.trim() || "(The email arrived with no readable text.)",
    receivedAt: now(),
    origin: "inbound",
    externalId: payload.emailId,
    fromAddress: payload.from,
    subject: payload.subject,
    claimedCustomerId: payload.customerId,
    claimedCaseRef: payload.caseRef,
    match: { status: "unverified", reason: "Not yet evaluated." },
    status: "new",
  };

  item.match = matchMessage(item, state);
  if (item.match.status !== "verified") item.status = "needs-manual-review";

  state.inbox.push(item);

  recordAudit({
    actorRole: "system",
    actorId: "resend-inbound",
    action: "inbound-email-received",
    target: item.id,
    detail: `REAL inbound email via Resend from ${payload.from}. Sender address recorded but never used to identify the customer. Match: ${item.match.reason}`,
    label: "real",
  });

  mutate(() => undefined);
  return { ok: true, data: item };
}

// ---------------------------------------------------------------------------
// Intake: registering a new customer and their vehicle
// ---------------------------------------------------------------------------

export type IntakePayload = {
  displayLabel: string;
  preferredLanguage: string;
  contactPermission: Customer["contactPermission"];
  verifiedPhone: string;
  caseType: "repair" | "appointment";
  /** Only for an appointment case. */
  slot?: string;
  note?: string;
};

/** CUS-A and CUS-B are supplied, so new customers continue from CUS-C. */
function nextCustomerId(existing: string[]): string {
  for (let i = 0; i < 26; i++) {
    const candidate = `CUS-${String.fromCharCode(65 + i)}`;
    if (!existing.includes(candidate)) return candidate;
  }
  let n = 1;
  while (existing.includes(`CUS-${n}`)) n++;
  return `CUS-${n}`;
}

function nextCaseId(existing: string[]): string {
  const highest = existing
    .map((id) => Number(id.match(/^JOB-(\d+)$/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `JOB-${highest + 1}`;
}

function portalTokenFor(customerId: string): string {
  const suffix = customerId.toLowerCase().replace("cus-", "");
  const random = Math.random().toString(16).slice(2, 12);
  return `demo-${suffix}-${random}`;
}

/**
 * Registers a customer and their vehicle at the counter.
 *
 * Everything created here is labelled SYNTHETIC and disappears on reset — the
 * supplied record is never added to. A new repair case starts with the work
 * still in progress, so the technician has something real to do, and its CRM
 * state is honest rather than being seeded with a fake conflict.
 */
export function registerCustomer(payload: IntakePayload, actor: Actor): Result<{ customer: Customer; caseRecord: Case }> {
  const permitted = guard(actor, "register-customer", "intake");
  if (!permitted.ok) return permitted;

  const name = payload.displayLabel.trim();
  const phone = payload.verifiedPhone.trim();
  if (!name) return fail(400, "A customer name is required.");
  if (!phone) return fail(400, "A contact number is required — it is what a callback would use.");
  if (payload.caseType === "appointment" && !payload.slot?.trim()) {
    return fail(400, "An appointment case needs a slot.");
  }

  const state = getState();
  const customerId = nextCustomerId(state.customers.map((c) => c.id));
  const caseId = nextCaseId(state.cases.map((c) => c.id));
  const at = now();

  const customer: Customer = {
    id: customerId,
    preferredLanguage: payload.preferredLanguage.trim() || "English",
    contactPermission: payload.contactPermission,
    displayLabel: name,
    verifiedPhone: phone,
    portalToken: portalTokenFor(customerId),
    origin: "synthetic",
  };

  const note = payload.note?.trim() || `Registered at the counter by ${actor.displayLabel}.`;

  const checks: CheckRecord[] =
    payload.caseType === "appointment"
      ? [
          {
            key: "appointment",
            name: "Service appointment",
            status: "booked",
            ownerRole: "service-adviser",
            note,
            updatedAt: at,
            updatedBy: actor.displayLabel,
            origin: "synthetic",
          },
        ]
      : [
          {
            key: "workshop-work",
            name: "Workshop repair work",
            status: "in progress",
            ownerRole: "technician",
            note,
            updatedAt: at,
            updatedBy: actor.displayLabel,
            origin: "synthetic",
          },
          {
            key: "quality-check",
            name: "Quality check",
            status: "pending",
            ownerRole: "quality-inspector",
            note: "Waiting on the workshop.",
            updatedAt: at,
            updatedBy: actor.displayLabel,
            origin: "synthetic",
          },
          {
            key: "collection-approval",
            name: "Collection approval",
            status: "not confirmed",
            ownerRole: "service-adviser",
            note: "Not yet approved.",
            updatedAt: at,
            updatedBy: actor.displayLabel,
            origin: "synthetic",
          },
        ];

  const caseRecord: Case = {
    id: caseId,
    customerId,
    workshopState: payload.caseType === "appointment" ? "appointment booked" : "in progress",
    crmState: payload.caseType === "appointment" ? "booking confirmed" : "in workshop",
    checks,
    appointment:
      payload.caseType === "appointment"
        ? { slot: payload.slot!.trim(), bookingStatus: "booking confirmed", changeStatus: "none" }
        : undefined,
    updatedAt: at,
    origin: "synthetic",
  };

  state.customers.push(customer);
  state.cases.push(caseRecord);

  recordAudit({
    actorRole: actor.role,
    actorId: actor.id,
    action: "customer-registered",
    target: caseId,
    detail: `SYNTHETIC customer ${customerId} (${name}) and case ${caseId} created at intake. Not part of the supplied record; removed by reset.`,
    label: "simulated",
  });

  mutate(() => undefined);
  return { ok: true, data: { customer, caseRecord } };
}
