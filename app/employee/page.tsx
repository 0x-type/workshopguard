import { getState } from "@/lib/store/store";
import { currentRole } from "@/lib/session";
import { minutesToClock } from "@/lib/store/seed";
import { checkPermission } from "@/lib/domain/permissions";
import { evaluateCase } from "@/lib/domain/rules";
import { TopBar } from "@/components/TopBar";
import { InboxWatcher } from "@/components/ui/Toasts";
import { LiveUpdates } from "@/components/employee/LiveUpdates";
import { StatusPill } from "@/components/ui/StatusPill";
import { TechnicianQueue } from "@/components/employee/TechnicianQueue";
import { InspectorQueue } from "@/components/employee/InspectorQueue";
import { InboxList } from "@/components/employee/InboxList";
import { StatusChecklist } from "@/components/employee/StatusChecklist";
import { ConflictBanner } from "@/components/employee/ConflictBanner";
import { EvidencePanel } from "@/components/employee/EvidencePanel";
import { AiPanel } from "@/components/employee/AiPanel";
import { CaseControls } from "@/components/employee/CaseControls";
import { ManualReview } from "@/components/employee/ManualReview";
import { ActivityHistory } from "@/components/employee/ActivityHistory";
import { SimulateInbound } from "@/components/employee/SimulateInbound";
import { CallbackPanel } from "@/components/employee/CallbackPanel";
import { RequestPanel } from "@/components/employee/RequestPanel";
import { NextActionBox } from "@/components/employee/NextAction";
import { nextActions } from "@/lib/domain/nextAction";
import { channelPolicy } from "@/lib/domain/channelPolicy";

export const dynamic = "force-dynamic";

/**
 * One route, three screens. Each role sees only the work it is allowed to do,
 * rather than one screen with most of its buttons greyed out.
 */
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const state = getState();
  const role = await currentRole();
  const clock = minutesToClock(state.clockMinutes);

  const inboxIds = state.inbox.map((m) => m.id);
  const revision = state.audit.length;

  const shell = (children: React.ReactNode, showLive = false) => (
    <>
      <TopBar role={role} dealership={state.dealership} clock={clock} />
      <main className="mx-auto max-w-7xl px-4 py-5 space-y-3">
        {showLive && (
          <div className="flex justify-end">
            <LiveUpdates ids={inboxIds} revision={revision} />
          </div>
        )}
        {children}
      </main>
    </>
  );

  if (role === "technician") return shell(<TechnicianQueue cases={state.cases} />, true);
  if (role === "quality-inspector") return shell(<InspectorQueue cases={state.cases} />, true);

  // ---- Service adviser -----------------------------------------------------

  const selected = state.inbox.find((m) => m.id === msg) ?? state.inbox[0];
  const caseRecord = selected?.match.caseId
    ? state.cases.find((c) => c.id === selected.match.caseId)
    : undefined;
  const customer = caseRecord
    ? state.customers.find((c) => c.id === caseRecord.customerId)
    : undefined;
  const evaluation = caseRecord ? evaluateCase(caseRecord) : undefined;
  const draft = selected ? state.drafts.find((d) => d.inboxItemId === selected.id) : undefined;

  const policy = customer ? channelPolicy(customer) : undefined;
  const callbackTask = caseRecord
    ? [...state.callbackTasks]
        .filter((t) => t.caseId === caseRecord.id)
        .sort((a, b) => (a.status === "open" ? -1 : 1))[0]
    : undefined;

  const perm = {
    analyze: checkPermission(role, "analyze-message"),
    callback: checkPermission(role, "manage-callback"),
    send: checkPermission(role, "send-approved-email"),
    approve: checkPermission(role, "approve-response"),
    confirm: checkPermission(role, "confirm-collection"),
    link: checkPermission(role, "link-message"),
  };

  const lastSend = draft
    ? [...state.outbound].reverse().find((o) => o.draftId === draft.id)
    : undefined;

  const emailMode =
    process.env.EMAIL_ENABLED === "true" && process.env.RESEND_API_KEY
      ? `Real Resend send, locked to ${process.env.DEMO_TEST_EMAIL}`
      : "Simulated — nothing leaves this machine";

  const caseAudit = caseRecord
    ? state.audit.filter(
        (a) =>
          a.target === caseRecord.id ||
          a.target.startsWith(`${caseRecord.id}/`) ||
          a.target === selected?.id ||
          a.target === draft?.id ||
          a.target === callbackTask?.id ||
          a.action === "reset",
      )
    : state.audit;

  return shell(
    <>
      <InboxWatcher
        items={state.inbox.map((i) => ({
          id: i.id,
          channel: i.channel,
          text: i.text,
          status: i.status,
          kind: i.kind,
          summary: i.request?.to
            ? `${i.request.from} → ${i.request.to}`
            : i.request?.summary,
          match:
            i.match.status === "verified"
              ? `${i.match.customerId} · ${i.match.caseId}`
              : undefined,
        }))}
      />

      <div className="workspace-grid">
        <aside className="space-y-3 workspace-inbox">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title">Customer messages</h2>
            <span className="flex items-center gap-2">
              <LiveUpdates ids={inboxIds} revision={revision} />
              <span className="pill">{state.inbox.length}</span>
            </span>
          </div>
          <InboxList items={state.inbox} selectedId={selected?.id} />
          <div className="work-section">
            <SimulateInbound />
          </div>
        </aside>

        <div className="space-y-4">
          {!selected && <p className="muted">No messages.</p>}

          {selected && selected.match.status !== "verified" && (
            <ManualReview
              item={selected}
              customers={state.customers}
              cases={state.cases.map((c) => ({ id: c.id, customerId: c.customerId }))}
              canLink={perm.link.ok}
              linkReason={perm.link.ok ? "" : perm.link.reason}
            />
          )}

          {selected && caseRecord && customer && evaluation && (
            <>
              <section className="case-header space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h1 className="text-lg font-semibold">
                      Case {caseRecord.id}
                      <span className="muted font-normal"> · Customer {customer.id}</span>
                    </h1>
                    <p className="text-xs faint mt-0.5">{selected.match.reason}</p>
                  </div>
                  <StatusPill
                    status={evaluation.collectionConfirmed ? "collection confirmed" : "in progress"}
                    tone={evaluation.collectionConfirmed ? "ok" : "warn"}
                  />
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3 pt-1">
                  {[
                    ["How we may contact them", customer.contactPermission],
                    ["Their language", customer.preferredLanguage],
                    ["Phone", customer.verifiedPhone],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="section-title mb-1">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="text-xs faint" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
                  CRM record says &ldquo;{caseRecord.crmState}&rdquo;. The checks below decide what
                  the customer is told, not the CRM.
                </p>
              </section>

              <NextActionBox
                actions={nextActions({
                  caseRecord,
                  evaluation,
                  item: selected,
                  draft,
                  callback: callbackTask,
                  policy,
                  viewer: role,
                })}
              />

              <div id="primary-work" className="space-y-4 scroll-mt-24">
                <ConflictBanner evaluation={evaluation} />

                <section className="work-section space-y-2">
                  <h3 className="font-semibold text-sm">Job status</h3>
                  <StatusChecklist caseRecord={caseRecord} />
                </section>

                {policy && !policy.emailAllowed && (
                  <CallbackPanel
                    task={callbackTask}
                    caseRecord={caseRecord}
                    policyReason={policy.reason}
                    canManage={perm.callback.ok}
                    manageReason={perm.callback.ok ? "" : perm.callback.reason}
                  />
                )}

                {selected.kind !== "message" ? (
                  <RequestPanel item={selected} />
                ) : (
                  <>
                    <AiPanel
                      /* Remount when the draft appears or changes, so the editor
                         picks up the new body. useState only reads its initial
                         value on mount. */
                      key={draft?.id ?? `${selected.id}-nodraft`}
                      item={selected}
                      draft={draft}
                      canAnalyze={perm.analyze.ok}
                      canApprove={perm.approve.ok}
                      approveReason={perm.approve.ok ? "" : perm.approve.reason}
                      customerId={customer.id}
                      canSend={perm.send.ok && Boolean(policy?.emailAllowed)}
                      emailMode={emailMode}
                      lastSend={lastSend}
                    />
                    {draft && <EvidencePanel evidence={draft.evidence} />}
                  </>
                )}

                {!caseRecord.appointment && (
                  <CaseControls
                    caseRecord={caseRecord}
                    evaluation={evaluation}
                    canConfirm={perm.confirm.ok}
                    confirmReason={perm.confirm.ok ? "" : perm.confirm.reason}
                  />
                )}
              </div>
            </>
          )}

          <ActivityHistory audit={caseAudit} />
        </div>
      </div>
    </>,
  );
}
