import type { Case } from "@/lib/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { OriginTag } from "@/components/ui/OriginTag";

export function StatusChecklist({ caseRecord }: { caseRecord: Case }) {
  return (
    <ul className="space-y-2">
      {caseRecord.checks.map((check) => (
        <li
          key={check.key}
          className="flex items-start justify-between gap-3 flex-wrap py-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{check.name}</span>
              <OriginTag kind={check.origin === "supplied" ? "supplied" : "synthetic"} />
            </div>
            <p className="text-xs muted mt-1">{check.note || "No note recorded."}</p>
            <p className="text-xs faint mt-0.5 mono">
              {check.ownerRole} · updated {check.updatedAt} by {check.updatedBy}
            </p>
          </div>
          <StatusPill status={check.status} />
        </li>
      ))}
    </ul>
  );
}
