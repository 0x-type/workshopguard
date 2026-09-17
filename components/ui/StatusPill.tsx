export type Tone = "ok" | "warn" | "stop" | "idle" | "accent";

/** Status drives the colour: green done, amber waiting, red stop, grey not started. */
export function toneForStatus(status: string): Tone {
  const s = status.toLowerCase();
  if (["finished", "passed", "confirmed", "booked", "sent", "approved", "verified"].includes(s)) return "ok";
  if (["pending", "in progress", "requested", "open"].includes(s)) return "warn";
  if (["failed", "missing", "unverified", "refused", "send-failed"].includes(s)) return "stop";
  return "idle";
}

const CLASS: Record<Tone, string> = {
  ok: "pill pill-ok",
  warn: "pill pill-warn",
  stop: "pill pill-stop",
  idle: "pill",
  accent: "pill pill-accent",
};

export function StatusPill({
  status,
  tone,
  dot = true,
  title,
}: {
  status: string;
  tone?: Tone;
  dot?: boolean;
  title?: string;
}) {
  const t = tone ?? toneForStatus(status);
  return (
    <span className={CLASS[t]} title={title}>
      {dot && <span className="pill-dot" />}
      {status}
    </span>
  );
}
