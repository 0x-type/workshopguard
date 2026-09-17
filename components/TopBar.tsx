import Link from "next/link";
import type { Dealership, Role } from "@/lib/types";
import { Brand } from "@/components/Brand";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { ResetButton } from "@/components/ResetButton";

export function TopBar({
  role,
  dealership,
  clock,
}: {
  role: Role;
  dealership: Dealership;
  clock: string;
}) {
  return (
    <header
      className="sticky top-0 z-30"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-2.5">
        <Brand name={dealership.name} productName={dealership.productName} logo={dealership.logo} />
        <span className="pill hidden xl:inline-flex">Unofficial prototype</span>
        <span className="mono text-xs muted ml-auto hidden lg:inline" aria-label={`Demo time ${clock}`}>
          {clock}
        </span>
        <Link href="/employee" className="btn btn-sm hidden sm:inline-flex">
          Workspace
        </Link>
        {role === "service-adviser" && (
          <Link href="/employee/new" className="btn btn-primary btn-sm">
            New customer
          </Link>
        )}
        <details className="demo-controls">
          <summary>Demo</summary>
          <div className="demo-controls-panel">
            <ResetButton compact />
          </div>
        </details>
        <ProfileSwitcher current={role} />
      </div>
    </header>
  );
}
