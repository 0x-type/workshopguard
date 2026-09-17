import type { AuditEvent } from "@/lib/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { describeActor, describeAudit } from "@/lib/domain/auditText";

export function ActivityHistory({ audit }: { audit: AuditEvent[] }) {
  if (audit.length === 0) {
    return <p className="text-sm muted">Nothing has happened yet on this state.</p>;
  }
  return (
    <details className="audit-disclosure card">
      <summary>
        <span>Activity history</span>
        <span className="text-xs muted font-normal">{audit.length} events</span>
      </summary>
      <ol className="audit-disclosure-body space-y-0">
        {[...audit].reverse().map((e) => {
          const denied = e.action.startsWith("denied:");
          return (
            <li
              key={e.id}
              className="py-2.5 flex gap-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="mono text-xs faint pt-0.5 shrink-0" style={{ width: "2.8rem" }}>
                {e.at}
              </span>
              <span
                aria-hidden
                className="shrink-0 mt-1.5"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: denied ? "var(--stop)" : e.label === "real" ? "var(--ok)" : "var(--border-strong)",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="font-medium text-sm"
                    style={{ color: denied ? "var(--stop)" : "var(--text)" }}
                  >
                    {describeAudit(e)}
                  </span>
                  <span className="text-xs muted">— {describeActor(e)}</span>
                  {e.label !== "real" && (
                    <StatusPill status={e.label} dot={false} tone="idle" />
                  )}
                </div>
                <p className="faint text-xs mt-0.5">{e.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
