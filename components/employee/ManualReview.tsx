"use client";

import { useState } from "react";
import type { Customer, InboxItem } from "@/lib/types";
import { Feedback, useAction } from "@/components/useAction";

/**
 * The uncertain path. Nothing is guessed, nothing is drafted, nothing is sent.
 * An employee may vouch for a link by hand, and that is recorded as their act.
 */
export function ManualReview({
  item,
  customers,
  cases,
  canLink,
  linkReason,
}: {
  item: InboxItem;
  customers: Customer[];
  cases: { id: string; customerId: string }[];
  canLink: boolean;
  linkReason: string;
}) {
  const { run, busy, error, notice } = useAction();
  const [customerId, setCustomerId] = useState("");
  const [caseRef, setCaseRef] = useState("");

  return (
    <section className="card card-edge edge-stop p-4 space-y-4 anim-rise">
      <div className="flex items-start gap-2">
        <span aria-hidden style={{ color: "var(--stop)" }}>
          ⊘
        </span>
        <div>
          <h3 className="font-semibold" style={{ color: "var(--stop)" }}>
            Manual review required
          </h3>
          <p className="text-sm muted mt-0.5">{item.match.reason}</p>
        </div>
      </div>

      <div>
        <p className="section-title mb-1.5">Original message, unchanged</p>
        <blockquote
          className="p-3 rounded text-sm"
          style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}
        >
          {item.text}
        </blockquote>
      </div>

      <p className="text-sm muted">
        No response has been drafted and nothing can be sent. To continue, an employee must identify
        the case explicitly — a name, an email address or a plate is never enough.
      </p>

      <div className="flex gap-2 flex-wrap items-end">
        <label className="text-xs">
          <span className="block section-title mb-1">Customer ID</span>
          <select
            className="field"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={!canLink}
          >
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block section-title mb-1">Case reference</span>
          <select
            className="field"
            value={caseRef}
            onChange={(e) => setCaseRef(e.target.value)}
            disabled={!canLink}
          >
            <option value="">—</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-primary"
          disabled={busy || !canLink || !customerId || !caseRef}
          title={
            canLink
              ? "You are vouching for this identification; it is recorded under your name"
              : linkReason
          }
          onClick={() =>
            run(`/api/messages/${item.id}/link`, {
              body: { customerId, caseRef },
              okTitle: "Linked by hand",
              okMessage: `Recorded as a manual verification against ${customerId} · ${caseRef}.`,
              okIcon: "⚭",
            })
          }
        >
          Verify link by hand
        </button>
      </div>
      <p className="text-xs faint">
        Linking records this as <strong>your</strong> verification in the history, not a system
        match.
      </p>

      {!canLink && <p className="text-xs muted">{linkReason}</p>}

      <Feedback error={error} notice={notice} />
    </section>
  );
}
