"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps an open workspace current.
 *
 * Without this, a message submitted from the customer portal — or a check
 * passed by a colleague on another screen — only appears when someone happens
 * to reload. It polls a tiny endpoint and refreshes when the server has moved
 * on; the toast itself is raised by InboxWatcher once the new props arrive.
 *
 * A hidden tab is not polled (pointless, and browsers throttle it anyway), so
 * it also syncs the moment the tab is looked at again. That is the common case
 * in this demo: the portal is one tab, the workspace is another.
 */
export function LiveUpdates({
  ids,
  revision,
  intervalMs = 3000,
}: {
  ids: string[];
  revision: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState(true);

  const rendered = useRef({ ids, revision });
  rendered.current = { ids, revision };

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/head", { cache: "no-store" });
      if (!res.ok) return;
      const head = (await res.json()) as { ids: string[]; revision: number };
      const current = rendered.current;
      const changed =
        head.revision !== current.revision ||
        head.ids.length !== current.ids.length ||
        head.ids.some((id, i) => id !== current.ids[i]);
      if (changed) {
        // Assume the refresh lands, so the next tick does not fire again before
        // React has re-rendered with the new props.
        rendered.current = head;
        router.refresh();
      }
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [router]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const loop = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await check();
      if (!stopped) timer = setTimeout(loop, intervalMs);
    };

    // Sync straight away on mount, and again whenever the tab is looked at.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    timer = setTimeout(loop, intervalMs);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check, intervalMs]);

  return (
    <span
      className="flex items-center gap-1.5 text-xs faint"
      title="This screen updates on its own, and syncs when you come back to this tab"
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: live ? "var(--ok)" : "var(--stop)",
          boxShadow: live ? "0 0 0 3px var(--ok-bg)" : "0 0 0 3px var(--stop-bg)",
        }}
      />
      {live ? "live" : "offline"}
    </span>
  );
}
