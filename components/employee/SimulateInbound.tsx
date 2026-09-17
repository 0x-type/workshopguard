"use client";

import { useState } from "react";
import { Feedback, useAction } from "@/components/useAction";

const PRESETS = [
  {
    label: "Unidentifiable email (failure path)",
    text: "My car, the blue one — is it ready?",
    customerId: "",
    caseRef: "",
  },
  {
    label: "Customer B, appointment change",
    text: "I need to change my service appointment. Could we do Day 3 at 14:00?",
    customerId: "CUS-B",
    caseRef: "JOB-2",
  },
];

/** Explicitly simulates an incoming message. Labelled a simulation everywhere. */
export function SimulateInbound() {
  const { run, busy, error, notice } = useAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(PRESETS[0].text);
  const [customerId, setCustomerId] = useState("");
  const [caseRef, setCaseRef] = useState("");

  if (!open) {
    return (
      <button className="btn w-full btn-sm" onClick={() => setOpen(true)}>
        Simulate an incoming email
      </button>
    );
  }

  return (
    <div className="space-y-2 anim-rise">
      <div className="flex items-center justify-between">
        <span className="pill pill-warn">simulated inbound</span>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="btn btn-sm text-xs"
            onClick={() => {
              setText(p.text);
              setCustomerId(p.customerId);
              setCaseRef(p.caseRef);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        className="field"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="field text-xs"
          placeholder="Customer ID (optional)"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <input
          className="field text-xs"
          placeholder="Case ref (optional)"
          value={caseRef}
          onChange={(e) => setCaseRef(e.target.value)}
        />
      </div>
      <p className="text-xs faint">
        Leave both blank to produce the uncertain case. No real email is received — this stands in
        for an inbound webhook.
      </p>
      <button
        className="btn btn-primary w-full btn-sm"
        disabled={busy || !text.trim()}
        onClick={() =>
          run("/api/inbox", {
            body: { text, channel: "email", customerId, caseRef },
            okMessage: "Simulated message added.",
          })
        }
      >
        {busy ? "Adding…" : "Add to inbox"}
      </button>
      <Feedback error={error} notice={notice} />
    </div>
  );
}
