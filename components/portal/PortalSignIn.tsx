"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sign-in by customer ID and case reference — the same pair the workspace uses
 * to verify a message. Deliberately not a name or an email address.
 */
export function PortalSignIn({ dealershipPhone }: { dealershipPhone: string }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, caseRef }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Please try again.");
        return;
      }
      router.push(`/portal/${data.token}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3 anim-rise">
      <label className="block">
        <span className="section-title block mb-1">Customer ID</span>
        <input
          className="field mono"
          placeholder="CUS-A"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
      </label>

      <label className="block">
        <span className="section-title block mb-1">Case reference</span>
        <input
          className="field mono"
          placeholder="JOB-1"
          value={caseRef}
          onChange={(e) => setCaseRef(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
      </label>

      <p className="text-xs muted">
        Both are printed on your job sheet. We ask for the pair because a name or an email address
        on its own is not enough to identify your vehicle.
      </p>

      {error && (
        <p className="banner banner-stop text-sm" role="alert">
          <span aria-hidden>⊘</span>
          <span>{error}</span>
        </p>
      )}

      <button className="btn btn-primary w-full" disabled={busy || !customerId || !caseRef}>
        {busy ? "Checking…" : "View my vehicle"}
      </button>

      <p className="text-xs faint text-center">
        Trouble signing in? Call us on <strong>{dealershipPhone}</strong>.
      </p>
    </form>
  );
}
