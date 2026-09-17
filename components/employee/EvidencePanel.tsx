import type { Evidence } from "@/lib/types";

/**
 * Why the system recommended what it recommended. Every fact names the file and
 * field it came from, so the employee can check it rather than trust it.
 */
export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  return (
    <details className="card p-4 group">
      <summary className="cursor-pointer font-semibold text-sm flex items-center gap-2 select-none">
        <span aria-hidden style={{ color: "var(--accent)" }}>
          ⓘ
        </span>
        Evidence — why this was recommended
        <span className="ml-auto text-xs faint font-normal">
          {evidence.facts.length} facts · {evidence.rules.length} rules
        </span>
      </summary>

      <div className="mt-4 space-y-5 text-sm anim-fade">
        <div>
          <p className="section-title mb-1.5">Recommendation</p>
          <p className="font-medium">{evidence.recommendation}</p>
        </div>

        {evidence.conflicts.length > 0 && (
          <div>
            <p className="section-title mb-1.5">Conflicts</p>
            {evidence.conflicts.map((c) => (
              <p key={c} className="banner banner-warn">
                {c}
              </p>
            ))}
          </div>
        )}

        <div>
          <p className="section-title mb-1.5">Facts used</p>
          <div className="space-y-0">
            {evidence.facts.map((f) => (
              <div
                key={f.label}
                className="py-2 grid gap-1 sm:grid-cols-[11rem_9rem_1fr] sm:gap-3 items-baseline"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="muted">{f.label}</span>
                <span className="font-medium">{f.value}</span>
                <span className="mono text-xs faint break-all">{f.source}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="section-title mb-1.5">Rules applied</p>
          <ul className="space-y-0">
            {evidence.rules.map((r, i) => (
              <li key={`${r.id}-${i}`} className="py-2" style={{ borderTop: "1px solid var(--border)" }}>
                <p>{r.text}</p>
                <p className="muted text-xs mt-0.5">{r.outcome}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="faint text-xs mono">Generated at {evidence.generatedAt} on the exercise clock.</p>
      </div>
    </details>
  );
}
