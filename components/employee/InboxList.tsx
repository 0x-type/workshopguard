import Link from "next/link";
import type { InboxItem } from "@/lib/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { OriginTag } from "@/components/ui/OriginTag";

const CHANNEL: Record<string, { label: string; icon: string }> = {
  email: { label: "Email", icon: "✉" },
  web: { label: "Web", icon: "◧" },
  "phone-note": { label: "Phone note", icon: "☏" },
  portal: { label: "Portal", icon: "◈" },
};

const KIND: Record<string, { label: string; icon: string }> = {
  "appointment-request": { label: "Appointment change", icon: "🗓" },
  "callback-request": { label: "Callback request", icon: "☏" },
};

export function InboxList({ items, selectedId }: { items: InboxItem[]; selectedId?: string }) {
  return (
    <ul className="space-y-2 stagger">
      {items.map((item) => {
        const review = item.status === "needs-manual-review";
        const structured = item.kind !== "message";
        const kind = KIND[item.kind];
        const ch = CHANNEL[item.channel] ?? { label: item.channel, icon: "•" };

        return (
          <li key={item.id}>
            <Link
              href={`/employee?msg=${item.id}`}
              data-selected={item.id === selectedId}
              className={`row-link card card-edge p-3 ${
                review ? "edge-stop" : item.status === "approved" ? "edge-ok" : "edge-accent"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: structured ? "var(--accent)" : "var(--muted)" }}
                >
                  <span aria-hidden className="mr-1">
                    {structured ? kind.icon : ch.icon}
                  </span>
                  {structured ? kind.label : ch.label}
                </span>
                <span className="mono text-xs faint">{item.receivedAt}</span>
              </div>

              {/* A request is shown as the change it asks for; a message as what
                  the customer actually wrote. */}
              {structured && item.request?.from && item.request?.to ? (
                <p className="mt-2 text-sm leading-snug">
                  <span className="faint mono text-xs">{item.request.from}</span>
                  <span aria-hidden className="faint mx-1.5">
                    →
                  </span>
                  <strong className="mono text-xs" style={{ color: "var(--accent)" }}>
                    {item.request.to}
                  </strong>
                </p>
              ) : (
                <p className="mt-2 text-sm leading-snug">
                  {structured ? item.request?.summary : item.text}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs mono faint">
                  {item.match.status === "verified"
                    ? `${item.match.customerId} · ${item.match.caseId}`
                    : "unmatched"}
                </span>
                <span className="flex items-center gap-1.5">
                  {item.origin !== "supplied" && <OriginTag kind={item.origin} />}
                  <StatusPill
                    status={
                      review
                        ? "manual review"
                        : item.status === "callback-required"
                          ? "call needed"
                          : item.status
                    }
                  />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
