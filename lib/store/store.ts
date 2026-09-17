/**
 * Server-side state singleton.
 *
 * Held on globalThis so Next.js hot-reload does not silently wipe a running
 * demo, and written through to .runtime/state.json so restarting the dev server
 * mid-presentation does not either. Reset is always one call away.
 *
 * There is no database. That is deliberate: the whole point of the exercise is a
 * repeatable start state.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ActionLabel, AuditEvent, Role, State } from "@/lib/types";
import { buildInitialState, minutesToClock } from "@/lib/store/seed";

const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const RUNTIME_FILE = path.join(RUNTIME_DIR, "state.json");

type Holder = { state: State | null };

const holder: Holder = ((globalThis as any).__C01_STORE__ ??= { state: null });

/** Tests run against a throwaway in-memory state; they must not leave a file behind. */
const PERSIST_DISABLED = process.env.C01_NO_PERSIST === "true";

function persist(state: State): void {
  if (PERSIST_DISABLED) return;
  try {
    if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
    writeFileSync(RUNTIME_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Persistence is a convenience, never a requirement. In-memory state stands.
  }
}

function restore(): State | null {
  if (PERSIST_DISABLED) return null;
  try {
    if (!existsSync(RUNTIME_FILE)) return null;
    const saved = JSON.parse(readFileSync(RUNTIME_FILE, "utf8")) as State;
    // If the supplied file changed underneath us, the saved state is stale.
    if (saved.seedVersion !== buildInitialState().seedVersion) return null;
    return saved;
  } catch {
    return null;
  }
}

export function getState(): State {
  if (!holder.state) {
    holder.state = restore() ?? buildInitialState();
  }
  return holder.state;
}

/** Apply a change and persist it. All mutations go through here. */
export function mutate<T>(fn: (state: State) => T): T {
  const state = getState();
  const result = fn(state);
  persist(state);
  return result;
}

/** Rebuild from the supplied file + overlay. The repeatable start state. */
export function resetState(actorId = "system"): State {
  const fresh = buildInitialState();
  holder.state = fresh;
  recordAudit({
    actorRole: "system",
    actorId,
    action: "reset",
    target: "state",
    detail: "State rebuilt from C01/initial.json and data/synthetic-overlay.json.",
    label: "real",
  });
  return holder.state;
}

export function nextId(prefix: string): string {
  const state = getState();
  const n = (state.counters[prefix] ?? 0) + 1;
  state.counters[prefix] = n;
  return `${prefix}-${n}`;
}

/** Current exercise-local time, as HH:MM. No real date is ever implied. */
export function now(): string {
  return minutesToClock(getState().clockMinutes);
}

/**
 * Append to the audit history. Every recorded event advances the exercise clock
 * by one minute, which keeps the history legible and the tests deterministic.
 */
export function recordAudit(event: {
  actorRole: Role | "system";
  actorId: string;
  action: string;
  target: string;
  detail: string;
  label: ActionLabel;
}): AuditEvent {
  const state = getState();
  const entry: AuditEvent = {
    id: nextId("AUD"),
    at: minutesToClock(state.clockMinutes),
    ...event,
  };
  state.audit.push(entry);
  state.clockMinutes += 1;
  persist(state);
  return entry;
}
