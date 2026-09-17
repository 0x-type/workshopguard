"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Role } from "@/lib/types";
import { Avatar, PROFILES } from "@/components/profiles";

/** Demo profile switch. Not a login — it exists so each role can be shown. */
export function ProfileSwitcher({ current }: { current: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<Role | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = PROFILES.find((p) => p.role === current) ?? PROFILES[2];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function choose(role: Role) {
    setPending(role);
    await fetch("/api/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setOpen(false);
    startTransition(() => {
      router.refresh();
      setPending(null);
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        className="btn btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{ paddingLeft: "0.35rem" }}
      >
        <Avatar profile={active} size={26} />
        <span className="text-left leading-tight">
          <span className="block text-xs font-semibold">{active.name}</span>
          <span className="block faint" style={{ fontSize: "0.65rem" }}>
            demo profile
          </span>
        </span>
        <span className="faint text-xs">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="anim-pop card absolute right-0 mt-2 p-1.5 z-40"
          style={{ width: "17rem", boxShadow: "var(--shadow-lg)" }}
        >
          <p className="section-title px-2 py-1.5">Switch profile</p>
          {PROFILES.map((p) => {
            const isActive = p.role === current;
            return (
              <button
                key={p.role}
                role="menuitem"
                onClick={() => choose(p.role)}
                disabled={pending !== null}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-left"
                style={{
                  background: isActive ? "var(--accent-soft)" : "transparent",
                  border: `1px solid ${isActive ? "var(--accent-border)" : "transparent"}`,
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                <Avatar profile={p} size={32} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {p.name}
                  </span>
                  <span className="block text-xs muted truncate">{p.duty}</span>
                </span>
                {isActive && <span className="ml-auto text-xs" style={{ color: "var(--accent)" }}>●</span>}
              </button>
            );
          })}
          <p className="text-xs faint px-2 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
            Demo switch, not authentication.
          </p>
        </div>
      )}
    </div>
  );
}
