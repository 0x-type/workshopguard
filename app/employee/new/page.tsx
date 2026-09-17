import Link from "next/link";
import { getState } from "@/lib/store/store";
import { minutesToClock } from "@/lib/store/seed";
import { currentRole } from "@/lib/session";
import { checkPermission } from "@/lib/domain/permissions";
import { TopBar } from "@/components/TopBar";
import { IntakeForm } from "@/components/employee/IntakeForm";

export const dynamic = "force-dynamic";

/** Suggests the next obviously-synthetic number, so nobody types a real one. */
function nextSyntheticPhone(existing: string[]): string {
  const used = existing
    .map((p) => Number(p.match(/(\d{3})$/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `+212 600 000 ${String(used + 1).padStart(3, "0")}`;
}

export default async function Intake() {
  const state = getState();
  const role = await currentRole();
  const permission = checkPermission(role, "register-customer");

  return (
    <>
      <TopBar role={role} dealership={state.dealership} clock={minutesToClock(state.clockMinutes)} />

      <main className="mx-auto px-4 py-6" style={{ maxWidth: "46rem" }}>
        <div className="mb-5 anim-rise">
          <Link href="/employee" className="text-xs muted">
            ← Workspace
          </Link>
          <h1 className="text-xl font-semibold mt-1">New customer</h1>
          <p className="muted text-sm mt-1">
            Book a vehicle in at the counter. What you record here decides two things for the rest
            of the job: the reference the customer is identified by, and whether the dealership may
            ever email them.
          </p>
        </div>

        {permission.ok ? (
          <IntakeForm nextPhone={nextSyntheticPhone(state.customers.map((c) => c.verifiedPhone))} />
        ) : (
          <p className="banner banner-stop">
            <span aria-hidden>⊘</span>
            <span>{permission.reason}</span>
          </p>
        )}
      </main>
    </>
  );
}
