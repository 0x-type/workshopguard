"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToasts } from "@/components/ui/Toasts";

/**
 * Posts to the API and refreshes the server-rendered view.
 *
 * Every outcome raises a notification, success or refusal. A refusal ("only the
 * service adviser can confirm collection") is information the employee needs,
 * so it is shown verbatim rather than swallowed.
 */
export function useAction() {
  const router = useRouter();
  const { push } = useToasts();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(
    url: string,
    options: {
      method?: string;
      body?: unknown;
      okMessage?: string;
      okTitle?: string;
      okIcon?: string;
      quiet?: boolean;
    } = {},
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: options.method ?? "POST",
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data.error ?? `Request failed (${res.status}).`;
        setError(message);
        push({
          title: res.status === 403 ? "Not allowed for this role" : "Refused",
          detail: message,
          icon: "⊘",
          tone: "stop",
          ttl: 9000,
        });
        return false;
      }

      if (options.okMessage) setNotice(options.okMessage);
      if (options.okMessage && !options.quiet) {
        push({
          title: options.okTitle ?? "Done",
          detail: options.okMessage,
          icon: options.okIcon ?? "✓",
          tone: "ok",
        });
      }
      startTransition(() => router.refresh());
      return true;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, notice, setError };
}

export function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error) return null;
  return (
    <p className="banner banner-stop text-sm" role="alert">
      <span aria-hidden>⊘</span>
      <span>{error}</span>
    </p>
  );
}
