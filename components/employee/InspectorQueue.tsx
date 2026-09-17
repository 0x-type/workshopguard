"use client";

import { useMemo, useState } from "react";
import type { Case } from "@/lib/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { Feedback, useAction } from "@/components/useAction";

type Row = {
  caseId: string;
  customerId: string;
  status: string;
  note: string;
  updatedAt: string;
  updatedBy: string;
  workshopStatus: string;
  crmState: string;
};

/**
 * The quality inspector's whole screen: cars waiting on a check, pass or fail.
 * They cannot confirm collection or answer a customer, so neither appears here.
 */
export function InspectorQueue({ cases }: { cases: Case[] }) {
  const { run, busy, error, notice } = useAction();
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const rows: Row[] = useMemo(
    () =>
      cases
        .map((c) => {
          const check = c.checks.find((k) => k.key === "quality-check");
          if (!check) return null;
          return {
            caseId: c.id,
            customerId: c.customerId,
            status: check.status,
            note: check.note,
            updatedAt: check.updatedAt,
            updatedBy: check.updatedBy,
            workshopStatus: c.checks.find((k) => k.key === "workshop-work")?.status ?? "unknown",
            crmState: c.crmState,
          };
        })
        .filter((r): r is Row => r !== null),
    [cases],
  );

  const filtered = rows.filter(
    (r) =>
      r.caseId.toLowerCase().includes(query.toLowerCase()) ||
      r.customerId.toLowerCase().includes(query.toLowerCase()),
  );
  const waiting = rows.filter((r) => r.status === "pending").length;

  function record(row: Row, outcome: "passed" | "failed") {
    return run(`/api/cases/${row.caseId}/checks`, {
      body: { key: "quality-check", status: outcome, note: notes[row.caseId] || undefined },
      okTitle: outcome === "passed" ? "Quality check passed" : "Quality check failed",
      okMessage:
        outcome === "passed"
          ? `${row.caseId} unblocked. A service adviser still has to confirm collection.`
          : `${row.caseId} stays blocked. Collection cannot be confirmed.`,
      okIcon: outcome === "passed" ? "✓" : "⊘",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Quality checks</h1>
          <p className="muted text-sm mt-0.5">
            {waiting === 0
              ? "Nothing is waiting on a check."
              : `${waiting} car${waiting === 1 ? "" : "s"} waiting on your sign-off.`}
          </p>
        </div>
        <input
          className="field"
          style={{ maxWidth: "16rem" }}
          placeholder="Find a job or customer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="space-y-2 stagger">
        {filtered.map((row) => {
          const pending = row.status === "pending";
          const crmAhead = pending && row.crmState.includes("ready for collection");
          const ready = row.workshopStatus === "finished";
          const edge =
            row.status === "passed" ? "edge-ok" : row.status === "failed" ? "edge-stop" : "edge-warn";

          return (
            <li key={row.caseId} className={`card card-edge ${edge} p-4`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {row.caseId} <span className="muted font-normal">· {row.customerId}</span>
                  </p>
                  <p className="text-sm muted mt-0.5">
                    Repair work: <strong>{row.workshopStatus}</strong>
                  </p>
                  {row.note && <p className="text-xs faint mt-1">{row.note}</p>}
                  <p className="text-xs faint mt-1 mono">
                    updated {row.updatedAt} by {row.updatedBy}
                  </p>
                </div>
                <StatusPill status={row.status} />
              </div>

              {crmAhead && (
                <p className="banner banner-warn mt-3 text-xs">
                  <span aria-hidden>⚠</span>
                  <span>
                    The CRM already says &ldquo;ready for collection&rdquo; on this car while your
                    check is still open. Your result decides it, not the CRM.
                  </span>
                </p>
              )}

              {ready && (
                <div className="mt-3 flex gap-2 flex-wrap items-center">
                  <input
                    className="field"
                    style={{ flex: "1 1 16rem" }}
                    placeholder="What did you check? (recorded as evidence)"
                    value={notes[row.caseId] ?? ""}
                    onChange={(e) => setNote(row.caseId, e.target.value)}
                    disabled={busy}
                  />
                  <button
                    className="btn btn-ok"
                    disabled={busy}
                    title="Record this check as passed"
                    onClick={() => record(row, "passed")}
                  >
                    <span aria-hidden>✓</span> Pass
                  </button>
                  <button
                    className="btn btn-stop"
                    disabled={busy}
                    title="Record this check as failed — the car stays blocked"
                    onClick={() => record(row, "failed")}
                  >
                    <span aria-hidden>⊘</span> Fail
                  </button>
                </div>
              )}

              {!ready && (
                <p className="text-xs muted mt-3">
                  Waiting on the workshop. A check cannot be recorded until the repair work is
                  marked finished.
                </p>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && <li className="muted text-sm">Nothing matches that search.</li>}
      </ul>

      <Feedback error={error} notice={notice} />
    </div>
  );

  function setNote(caseId: string, value: string) {
    setNotes((n) => ({ ...n, [caseId]: value }));
  }
}
