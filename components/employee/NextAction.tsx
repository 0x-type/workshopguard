import type { NextAction } from "@/lib/domain/nextAction";

const ROLE_LABEL: Record<string, string> = {
  technician: "Technician",
  "quality-inspector": "Quality inspector",
  "service-adviser": "Service adviser",
  customer: "Customer",
};

/** The one thing the case is waiting on, at the top where it cannot be missed. */
export function NextActionBox({ actions }: { actions: NextAction[] }) {
  if (actions.length === 0) return null;
  const [first, ...rest] = actions;
  const settled = first.text.startsWith("Nothing is waiting");

  return (
    <section
      className="action-band"
      data-settled={settled}
    >
      <div className="min-w-0">
        <p className="section-title mb-1">Next action</p>
        <p className="font-semibold text-base">{first.text}</p>

        {!settled && (
          <p className="text-xs muted mt-1">
            Owner: {[...new Set(actions.map((a) => ROLE_LABEL[a.owner] ?? a.owner))].join(", ")}
          </p>
        )}

        {rest.length > 0 && (
          <details className="mt-2 text-sm muted">
            <summary className="cursor-pointer">{rest.length} later step{rest.length === 1 ? "" : "s"}</summary>
            <ul className="mt-1 space-y-1 pl-4 list-disc">
              {rest.map((a) => <li key={a.text}>{a.text}</li>)}
            </ul>
          </details>
        )}
      </div>

      {!settled && first.yours && (
        <a className="btn btn-primary shrink-0" href="#primary-work">
          Open task
        </a>
      )}
    </section>
  );
}
