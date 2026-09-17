import type { Role } from "@/lib/types";

/**
 * Shared profile data. Deliberately NOT a "use client" module: both the server
 * pages and the client switcher read it, and anything exported across a client
 * boundary arrives on the server as a reference proxy rather than real data.
 */

export type Profile = {
  role: Role;
  name: string;
  initials: string;
  duty: string;
  colour: string;
};

export const PROFILES: Profile[] = [
  {
    role: "technician",
    name: "Technician",
    initials: "TE",
    duty: "Works through the repair list",
    colour: "#7c3aed",
  },
  {
    role: "quality-inspector",
    name: "Quality inspector",
    initials: "QI",
    duty: "Signs off quality checks",
    colour: "#0891b2",
  },
  {
    role: "service-adviser",
    name: "Service adviser",
    initials: "SA",
    duty: "Answers customers, confirms collection",
    colour: "#2563eb",
  },
];

export function Avatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: profile.colour,
        color: "#fff",
        fontSize: size * 0.36,
        letterSpacing: "0.02em",
        flex: "none",
      }}
    >
      {profile.initials}
    </span>
  );
}
