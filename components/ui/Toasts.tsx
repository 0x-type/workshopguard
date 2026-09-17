"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Top-left notification stack. Motion is reserved for genuinely new messages
 * and status changes; dismissal remains available to keyboard users.
 */

export type Tone = "ok" | "warn" | "stop" | "accent";

export type Toast = {
  id: number;
  title: string;
  detail?: string;
  meta?: string;
  icon?: string;
  tone?: Tone;
  ttl?: number;
};

type Ctx = { push: (t: Omit<Toast, "id">) => void };
const ToastContext = createContext<Ctx>({ push: () => {} });

export function useToasts() {
  return useContext(ToastContext);
}

const TONE: Record<Tone, { fg: string; bg: string; edge: string }> = {
  ok: { fg: "var(--ok)", bg: "var(--ok-bg)", edge: "var(--ok)" },
  warn: { fg: "var(--warn)", bg: "var(--warn-bg)", edge: "var(--warn-border)" },
  stop: { fg: "var(--stop)", bg: "var(--stop-bg)", edge: "var(--stop)" },
  accent: { fg: "var(--accent)", bg: "var(--accent-soft)", edge: "var(--accent)" },
};

const DEFAULT_TTL = 7000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [leaving, setLeaving] = useState<number[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setLeaving((l) => (l.includes(id) ? l : [...l, id]));
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      setLeaving((l) => l.filter((x) => x !== id));
    }, 260);
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++counter.current;
      setToasts((prev) => [{ ...t, id }, ...prev].slice(0, 4));
      setTimeout(() => dismiss(id), t.ttl ?? DEFAULT_TTL);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="fixed z-50 flex flex-col gap-2.5"
        style={{ top: "3.5rem", left: "1rem", width: "min(21rem, calc(100vw - 2rem))" }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const tone = TONE[t.tone ?? "accent"];
          const going = leaving.includes(t.id);
          return (
            <div
              key={t.id}
              role="status"
              className={`toast ${going ? "toast-out" : "toast-in"}`}
              style={{ borderLeft: `3px solid ${tone.edge}` }}
            >
              <div className="flex items-start gap-2.5 p-3 pr-2.5">
                <span
                  className="toast-icon relative"
                  style={{ background: tone.bg, color: tone.fg }}
                  aria-hidden
                >
                  {t.icon ?? "•"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: tone.fg }}>
                    {t.title}
                  </p>
                  {t.detail && (
                    <p className="text-xs muted mt-0.5 leading-snug line-clamp-2">{t.detail}</p>
                  )}
                  {t.meta && <p className="text-xs faint mono mt-1">{t.meta}</p>}
                </div>

                <button
                  type="button"
                  className="faint text-xs leading-none p-2 -m-2 rounded-sm hover:text-[var(--text)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
                  onClick={() => dismiss(t.id)}
                  aria-label={`Dismiss ${t.title}`}
                >
                  ✕
                </button>
              </div>

              <span
                className="toast-drain"
                aria-hidden
                style={{ background: tone.edge, animationDuration: `${t.ttl ?? DEFAULT_TTL}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

const CHANNEL: Record<string, { icon: string; title: string }> = {
  email: { icon: "✉", title: "New email" },
  web: { icon: "◧", title: "New web message" },
  "phone-note": { icon: "☏", title: "New phone note" },
  portal: { icon: "◈", title: "New portal message" },
};

/**
 * Watches the inbox for ids it has not seen and announces them. This is what
 * makes a simulated inbound message feel like an arrival rather than a reload.
 */
const KIND: Record<string, { icon: string; title: string }> = {
  "appointment-request": { icon: "🗓", title: "Appointment change requested" },
  "callback-request": { icon: "☏", title: "Callback requested" },
};

export function InboxWatcher({
  items,
}: {
  items: {
    id: string;
    channel: string;
    text: string;
    status: string;
    kind?: string;
    summary?: string;
    match?: string;
  }[];
}) {
  const { push } = useToasts();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      // First render: adopt what is already there without announcing it.
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    for (const item of items) {
      if (!seen.current.has(item.id)) {
        seen.current.add(item.id);
        const unmatched = item.status === "needs-manual-review";
        const structured = item.kind && item.kind !== "message" ? KIND[item.kind] : undefined;
        const channel = CHANNEL[item.channel] ?? { icon: "✦", title: "New message" };
        const body = structured ? (item.summary ?? item.text) : item.text;

        push({
          title: unmatched ? "Unidentified message" : (structured?.title ?? channel.title),
          detail: body.length > 88 ? `${body.slice(0, 88)}…` : body,
          meta: unmatched ? "needs manual review" : item.match,
          icon: structured?.icon ?? channel.icon,
          tone: unmatched ? "stop" : structured ? "warn" : "accent",
        });
      }
    }
  }, [items, push]);

  return null;
}
