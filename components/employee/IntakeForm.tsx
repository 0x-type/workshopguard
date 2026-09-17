"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToasts } from "@/components/ui/Toasts";

type Created = {
  customer: { id: string; displayLabel: string; portalToken: string; contactPermission: string };
  case: { id: string; workshopState: string };
};

const LANGUAGES = ["English", "French", "Arabic", "Spanish"];

/**
 * Counter intake. This is where a customer and their vehicle enter the system,
 * and where the two facts that govern everything later are captured: the case
 * reference they will be identified by, and how the dealership may contact them.
 */
export function IntakeForm({ nextPhone }: { nextPhone: string }) {
  const router = useRouter();
  const { push } = useToasts();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    displayLabel: "",
    preferredLanguage: "English",
    contactPermission: "service updates only",
    verifiedPhone: nextPhone,
    caseType: "repair" as "repair" | "appointment",
    slot: "Day 3 at 10:00",
    note: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not register this customer.");
        push({ title: "Not registered", detail: data.error ?? "", icon: "⊘", tone: "stop" });
        return;
      }
      setCreated({ customer: data.customer, case: data.case });
      push({
        title: `${data.customer.id} registered`,
        detail: `Case ${data.case.id} opened for ${data.customer.displayLabel}.`,
        icon: "✓",
        tone: "ok",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="card card-edge edge-ok p-5 space-y-4 anim-pop">
        <div>
          <h2 className="font-semibold">Registered</h2>
          <p className="text-sm muted mt-1">
            Give the customer their reference. They will need both parts to sign in to the portal —
            a name or an email address is never enough to identify them.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
            <p className="section-title mb-1">Customer ID</p>
            <p className="text-xl font-semibold mono">{created.customer.id}</p>
          </div>
          <div className="p-3 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
            <p className="section-title mb-1">Case reference</p>
            <p className="text-xl font-semibold mono">{created.case.id}</p>
          </div>
        </div>

        <div>
          <p className="section-title mb-1">Their portal link</p>
          <p className="mono text-xs break-all">/portal/{created.customer.portalToken}</p>
        </div>

        <p className="banner banner-warn text-xs">
          <span aria-hidden>ⓘ</span>
          <span>
            Synthetic record, created for this demonstration. It is not part of the supplied data
            and disappears when the state is reset.
          </span>
        </p>

        <div className="flex gap-2 flex-wrap">
          <a className="btn btn-primary" href="/employee">
            Open the workspace
          </a>
          <a className="btn" href={`/portal/${created.customer.portalToken}`}>
            View their portal
          </a>
          <button className="btn" onClick={() => setCreated(null)}>
            Register another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold text-sm">Customer</h2>

        <label className="block">
          <span className="section-title block mb-1">Name</span>
          <input
            className="field"
            placeholder="e.g. Amina Cherkaoui"
            value={form.displayLabel}
            onChange={(e) => set("displayLabel", e.target.value)}
            disabled={busy}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="section-title block mb-1">Preferred language</span>
            <select
              className="field"
              value={form.preferredLanguage}
              onChange={(e) => set("preferredLanguage", e.target.value)}
              disabled={busy}
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <span className="text-xs faint block mt-1">Responses are drafted in this language.</span>
          </label>

          <label className="block">
            <span className="section-title block mb-1">Contact number</span>
            <input
              className="field mono"
              value={form.verifiedPhone}
              onChange={(e) => set("verifiedPhone", e.target.value)}
              disabled={busy}
            />
            <span className="text-xs faint block mt-1">
              Never dialled automatically. Use a fictional number.
            </span>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="section-title mb-1">How may we contact them?</legend>
          {[
            {
              value: "service updates only",
              title: "Service updates only",
              detail: "We may email them about this job, and nothing else.",
            },
            {
              value: "callback only",
              title: "Callback only",
              detail: "We may never email them. Every reply becomes a telephone callback.",
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex gap-2.5 p-3 rounded cursor-pointer"
              style={{
                border: `1px solid ${form.contactPermission === opt.value ? "var(--accent)" : "var(--border)"}`,
                background: form.contactPermission === opt.value ? "var(--accent-soft)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="permission"
                className="mt-1"
                checked={form.contactPermission === opt.value}
                onChange={() => set("contactPermission", opt.value)}
                disabled={busy}
              />
              <span>
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="block text-xs muted">{opt.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold text-sm">Vehicle</h2>

        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="section-title mb-1">Why is it here?</legend>
          {[
            { value: "repair", title: "Left for repair", detail: "The car is with us now." },
            { value: "appointment", title: "Booking an appointment", detail: "The car comes in later." },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex gap-2.5 p-3 rounded cursor-pointer"
              style={{
                border: `1px solid ${form.caseType === opt.value ? "var(--accent)" : "var(--border)"}`,
                background: form.caseType === opt.value ? "var(--accent-soft)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="caseType"
                className="mt-1"
                checked={form.caseType === opt.value}
                onChange={() => set("caseType", opt.value as "repair" | "appointment")}
                disabled={busy}
              />
              <span>
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="block text-xs muted">{opt.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {form.caseType === "appointment" && (
          <label className="block anim-rise">
            <span className="section-title block mb-1">Appointment slot</span>
            <input
              className="field"
              placeholder="e.g. Day 3 at 10:00"
              value={form.slot}
              onChange={(e) => set("slot", e.target.value)}
              disabled={busy}
            />
            <span className="text-xs faint block mt-1">
              Exercise-local days, not real calendar dates.
            </span>
          </label>
        )}

        <label className="block">
          <span className="section-title block mb-1">Note for the workshop (optional)</span>
          <input
            className="field"
            placeholder="What did the customer report?"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            disabled={busy}
          />
          <span className="text-xs faint block mt-1">
            Recorded as-is. The system does not diagnose the vehicle.
          </span>
        </label>
      </section>

      {error && (
        <p className="banner banner-stop text-sm" role="alert">
          <span aria-hidden>⊘</span>
          <span>{error}</span>
        </p>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <button className="btn btn-primary" disabled={busy || !form.displayLabel.trim()}>
          {busy ? "Registering…" : "Register customer and open case"}
        </button>
        <a className="btn" href="/employee">
          Cancel
        </a>
      </div>
    </form>
  );
}
