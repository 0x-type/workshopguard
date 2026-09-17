"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    setBusy(true);
    await fetch("/api/reset", { method: "POST" });
    setBusy(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
    router.refresh();
  }

  return (
    <button
      onClick={reset}
      disabled={busy}
      className={compact ? "btn btn-sm" : "btn"}
      title="Rebuild everything from the supplied C01/initial.json"
    >
      {busy ? "Resetting…" : done ? "Reset ✓" : compact ? "Reset" : "Reset to initial state"}
    </button>
  );
}
