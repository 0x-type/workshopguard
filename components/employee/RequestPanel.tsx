import type { InboxItem } from "@/lib/types";

const TITLE: Record<string, string> = {
  "appointment-request": "Appointment change requested",
  "callback-request": "Callback requested",
};

/**
 * A structured request, shown as the concrete thing it is. No AI panel appears
 * for these: the customer used a form, so what they asked for is already known
 * exactly, and a model reading it back would add nothing but doubt.
 */
export function RequestPanel({ item }: { item: InboxItem }) {
  if (!item.request) return null;
  const { from, to, summary } = item.request;

  return (
    <section className="card card-edge edge-accent p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm">{TITLE[item.kind] ?? "Customer request"}</h3>
        <span className="pill pill-accent">
          <span className="pill-dot" /> from the portal · {item.receivedAt}
        </span>
      </div>

      {from && to ? (
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="p-2 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
            <span className="section-title block mb-0.5">Currently</span>
            <strong>{from}</strong>
          </span>
          <span aria-hidden className="faint">
            →
          </span>
          <span
            className="p-2 rounded"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}
          >
            <span className="section-title block mb-0.5">Asked for</span>
            <strong style={{ color: "var(--accent)" }}>{to}</strong>
          </span>
        </div>
      ) : (
        <p className="text-sm">{summary}</p>
      )}

      <p className="text-xs muted">
        Requested only — nothing has changed. Nothing here was interpreted by a model; the customer
        chose it from a form.
      </p>
    </section>
  );
}
