"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/types";
import { Avatar, PROFILES } from "@/components/profiles";

/** Home-page profile picker: switches role AND opens that role's screen. */
export function ProfileCards({ current }: { current: Role }) {
  const router = useRouter();
  const [pending, setPending] = useState<Role | null>(null);

  async function pick(role: Role) {
    setPending(role);
    await fetch("/api/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    router.push("/employee");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3 stagger">
      {PROFILES.map((p) => {
        const active = p.role === current;
        return (
          <button
            key={p.role}
            onClick={() => pick(p.role)}
            disabled={pending !== null}
            data-selected={active}
            className="row-link card p-4 text-left"
            style={{ cursor: pending ? "wait" : "pointer" }}
          >
            <div className="flex items-center gap-2.5">
              <Avatar profile={p} size={36} />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs muted">
                  {pending === p.role ? "opening…" : active ? "active" : "switch to"}
                </p>
              </div>
            </div>
            <p className="text-sm muted mt-3">{p.duty}</p>
          </button>
        );
      })}
    </div>
  );
}
