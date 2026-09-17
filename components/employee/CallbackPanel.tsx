"use client";

import { useState } from "react";
import type { CallbackTask, Case } from "@/lib/types";
import { Feedback, useAction } from "@/components/useAction";
import { StatusPill } from "@/components/ui/StatusPill";

/**
 * A callback-only customer cannot be emailed, so the work is a phone call.
 *
 * Two things happen here and nothing else: mark the call done, and record the
 * time that was actually agreed on it. There is no collection approval on an
 * appointment case — there is no car to release.
 */
export function CallbackPanel({
  task,
  caseRecord,
  policyReason,
  canManage,
  manageReason,
}: {
  task?: CallbackTask;
  caseRecord: Case;
  policyReason: string;
  canManage: boolean;
  manageReason: string;
}) {
  const { run, busy, error, notice } = useAction();
  const [otherTime, setOtherTime] = useState(false);
  const [agreedSlot, setAgreedSlot] = useState("");

  const appointment = caseRecord.appointment;
  const requested = appointment?.changeStatus === "requested" ? appointment.requestedSlot : undefined;
  const called = task?.status === "completed";

  return (
    <section className="card card-edge edge-warn p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">Call this customer</h3>
          <p className="text-sm muted mt-0.5">{policyReason}</p>
        </div>
        {task && <StatusPill status={called ? "call done" : "to call"} tone={called ? "ok" : "warn"} />}
      </div>

      {task && (
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="section-title mb-1">Verified number</p>
            <p className="text-2xl font-semibold mono">{task.phone}</p>
            <p className="text-xs faint mt-1">
              From the record for {task.customerId}. Never dialled automatically.
            </p>
          </div>

          {called ? (
            <p className="text-sm" style={{ color: "var(--ok)" }}>
              ✓ Called by {task.completedBy} at {task.completedAt}
            </p>
          ) : (
            <button
              className="btn btn-ok"
              disabled={busy || !canManage}
              title={canManage ? "Mark this call as made (the call itself is simulated)" : manageReason}
              onClick={() =>
                run(`/api/callbacks/${task.id}/complete`, {
                  body: {},
                  okTitle: "Call marked done",
                  okMessage: "Logged as a simulated call in the case history.",
                  okIcon: "☏",
                })
              }
            >
              <span aria-hidden>☏</span> Done — I called
            </button>
          )}
        </div>
      )}

      {!canManage && <p className="text-xs muted">{manageReason}</p>}

      {requested && (
        <div className="space-y-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <p className="text-sm">
            Customer asked to move <strong>{appointment?.slot}</strong> to{" "}
            <strong>{requested}</strong>. Nothing changes until you record what was agreed.
          </p>

          {!otherTime ? (
            <div className="flex gap-2 flex-wrap items-center">
              <button
                className="btn btn-ok"
                disabled={busy || !canManage}
                title={canManage ? "Apply the time the customer asked for" : manageReason}
                onClick={() =>
                  run(`/api/cases/${caseRecord.id}/booking`, {
                    body: { agreedSlot: requested },
                    okTitle: "Appointment moved",
                    okMessage: `Now ${requested}. The external booking push is simulated.`,
                    okIcon: "✓",
                  })
                }
              >
                <span aria-hidden>✓</span> Agreed {requested}
              </button>
              <button
                className="btn"
                disabled={busy || !canManage}
                onClick={() => {
                  setAgreedSlot(requested);
                  setOtherTime(true);
                }}
              >
                We agreed a different time
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <input
                className="field"
                style={{ flex: "1 1 14rem" }}
                placeholder="e.g. Day 3 at 15:30"
                value={agreedSlot}
                onChange={(e) => setAgreedSlot(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <button
                className="btn btn-ok"
                disabled={busy || !agreedSlot.trim()}
                onClick={() =>
                  run(`/api/cases/${caseRecord.id}/booking`, {
                    body: { agreedSlot },
                    okTitle: "Appointment moved",
                    okMessage: `Now ${agreedSlot}. The external booking push is simulated.`,
                    okIcon: "✓",
                  })
                }
              >
                Apply
              </button>
              <button className="btn" disabled={busy} onClick={() => setOtherTime(false)}>
                Cancel
              </button>
            </div>
          )}

          <p className="text-xs faint">
            The external booking system is not contacted. The update is recorded as SIMULATED.
          </p>
        </div>
      )}

      {appointment?.changeStatus === "employee-approved" && (
        <p className="banner banner-ok text-sm">
          <span aria-hidden>✓</span>
          <span>
            Appointment is now <strong>{appointment.slot}</strong>. The external booking push was
            recorded as SIMULATED — no real booking changed.
          </span>
        </p>
      )}

      <Feedback error={error} notice={notice} />
    </section>
  );
}
