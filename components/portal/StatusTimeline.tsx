import type { PublicStage } from "@/lib/domain/publicStatus";

const DOT: Record<string, { bg: string; ring: string; mark: string }> = {
  done: { bg: "var(--ok)", ring: "var(--ok-bg)", mark: "✓" },
  "in progress": { bg: "var(--warn-border)", ring: "var(--warn-bg)", mark: "●" },
  "not yet": { bg: "var(--border-strong)", ring: "var(--idle-bg)", mark: "" },
};

export function StatusTimeline({ stages }: { stages: PublicStage[] }) {
  return (
    <ol className="space-y-0">
      {stages.map((stage, i) => {
        const d = DOT[stage.state];
        const last = i === stages.length - 1;
        return (
          <li key={stage.key} className="flex gap-3">
            <div className="flex flex-col items-center" style={{ width: 26 }}>
              <span
                aria-hidden
                className="inline-flex items-center justify-center shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: d.bg,
                  color: "#fff",
                  fontSize: 11,
                  boxShadow: `0 0 0 4px ${d.ring}`,
                }}
              >
                {d.mark}
              </span>
              {!last && (
                <span
                  aria-hidden
                  style={{
                    flex: 1,
                    width: 2,
                    minHeight: 30,
                    background: stage.state === "done" ? "var(--ok)" : "var(--border)",
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                />
              )}
            </div>
            <div className={last ? "pb-0" : "pb-5"}>
              <p className="font-medium text-sm">{stage.label}</p>
              <p className="text-sm muted mt-0.5">{stage.note}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
