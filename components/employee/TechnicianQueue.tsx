"use client";

import { useMemo, useState } from "react";
import type { Case } from "@/lib/types";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { Feedback, useAction } from "@/components/useAction";

type Row = {
  caseId: string;
  customerId: string;
  checkName: string;
  status: string;
  note: string;
  updatedAt: string;
  updatedBy: string;
};

/**
 * The technician's whole screen: the cars they are responsible for, and one
 * button per car. No inbox, no customer messages, no collection controls —
 * a technician cannot do any of that, so it is not on their screen.
 */
export function TechnicianQueue({ cases }: { cases: Case[] }) {
  const { run, busy, error, notice } = useAction();
  const [query, setQuery] = useState("");

  const rows: Row[] = useMemo(
    () =>
      cases
        .map((c) => {
          const check = c.checks.find((k) => k.key === "workshop-work");
          if (!check) return null;
          return {
            caseId: c.id,
            customerId: c.customerId,
            checkName: check.name,
            status: check.status,
            note: check.note,
            updatedAt: check.updatedAt,
            updatedBy: check.updatedBy,
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

  const outstanding = rows.filter((r) => r.status !== "finished").length;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Repair list</h1>
          <p className="muted text-sm mt-0.5">
            {outstanding === 0
              ? "All repair work is marked finished."
              : `${outstanding} job${outstanding === 1 ? "" : "s"} still open.`}
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
          const done = row.status === "finished";
          return (
            <li
              key={row.caseId}
              className={`card card-edge ${done ? "edge-ok" : "edge-warn"} p-4`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {row.caseId} <span className="muted font-normal">· {row.customerId}</span>
                  </p>
                  <p className="text-sm muted mt-0.5">{row.checkName}</p>
                  {row.note && <p className="text-xs faint mt-1">{row.note}</p>}
                  <p className="text-xs faint mt-1 mono">
                    updated {row.updatedAt} by {row.updatedBy}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <StatusPill status={row.status} />
                  {!done && (
                    <button
                      className="btn btn-ok btn-sm"
                      disabled={busy}
                      onClick={() =>
                        run(`/api/cases/${row.caseId}/checks`, {
                          body: { key: "workshop-work", status: "finished" },
                          okTitle: "Repair work finished",
                          okMessage: `${row.caseId} recorded as finished. A quality check is still required.`,
                          okIcon: "✓",
                        })
                      }
                    >
                      Mark finished
                    </button>
                  )}
                </div>
              </div>

            </li>
          );
        })}
        {filtered.length === 0 && <li className="muted text-sm">Nothing matches that search.</li>}
      </ul>

      <Feedback error={error} notice={notice} />
    </div>
  );
}
