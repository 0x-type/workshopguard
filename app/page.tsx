import Link from "next/link";
import { getState } from "@/lib/store/store";
import { minutesToClock, suppliedHash } from "@/lib/store/seed";
import { currentRole } from "@/lib/session";
import { evaluateCase } from "@/lib/domain/rules";
import { TopBar } from "@/components/TopBar";
import { ProfileCards } from "@/components/ProfileCards";
import { StatusPill } from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

function envSummary() {
  const provider = (process.env.AI_PROVIDER || "deepseek").toLowerCase();
  const hasKey = Boolean(process.env.DEEPSEEK_API_KEY);
  const emailOn = process.env.EMAIL_ENABLED === "true" && Boolean(process.env.RESEND_API_KEY);
  return {
    provider: provider === "mock" || !hasKey ? "Rule-based drafting" : `${provider} with rules fallback`,
    providerTone: provider === "mock" || !hasKey ? ("idle" as const) : ("ok" as const),
    email: emailOn ? `Test email: ${process.env.DEMO_TEST_EMAIL}` : "Email simulated",
  };
}

export default async function Home() {
  const state = getState();
  const role = await currentRole();
  const env = envSummary();
  const job1 = state.cases.find((c) => c.id === "JOB-1");
  const evaluation = job1 ? evaluateCase(job1) : undefined;

  return (
    <>
      <TopBar dealership={state.dealership} role={role} clock={minutesToClock(state.clockMinutes)} />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="max-w-3xl">
          <p className="section-title mb-2">Operational demonstration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Customer communication workspace</h1>
          <p className="muted mt-2">
            Review messages, resolve record conflicts and communicate only what the verified case supports.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link href="/employee" className="btn btn-primary">Open employee workspace</Link>
            <Link href="/portal" className="btn">Open customer portal</Link>
          </div>
        </header>

        {evaluation && evaluation.conflicts.length > 0 && (
          <section className="banner banner-warn items-start">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">JOB-1 needs employee review</p>
              <p className="text-sm mt-1">{evaluation.conflicts[0]}</p>
            </div>
            <Link href="/employee" className="btn btn-sm">Review case</Link>
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Choose an employee role</h2>
            <p className="muted text-sm mt-1">Each role sees only the work it is permitted to perform.</p>
          </div>
          <ProfileCards current={role} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/employee/new" className="row-link card p-5">
            <p className="section-title">Service desk</p>
            <h2 className="text-lg font-semibold mt-1">Register a customer</h2>
            <p className="text-sm muted mt-2">Record the vehicle, booking and permitted contact channel.</p>
          </Link>
          <Link href="/portal" className="row-link card p-5">
            <p className="section-title">Customer access</p>
            <h2 className="text-lg font-semibold mt-1">Check vehicle status</h2>
            <p className="text-sm muted mt-2">Sign in with a customer ID and case reference.</p>
          </Link>
        </section>

        <details className="audit-disclosure card">
          <summary>
            <span>Demo and test information</span>
            <span className="text-xs muted font-normal">Synthetic data</span>
          </summary>
          <div className="audit-disclosure-body grid gap-5 py-4 sm:grid-cols-3 text-sm">
            <div><p className="section-title mb-2">Drafting</p><StatusPill status={env.provider} tone={env.providerTone} dot={false} /></div>
            <div><p className="section-title mb-2">Outbound email</p><StatusPill status={env.email} tone="idle" dot={false} /></div>
            <div>
              <p className="section-title mb-2">Supplied record</p>
              <p className="mono text-xs muted">C01/initial.json · {suppliedHash().slice(0, 16)}…</p>
            </div>
          </div>
        </details>
      </main>
    </>
  );
}
