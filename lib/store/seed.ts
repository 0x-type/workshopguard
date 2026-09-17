/**
 * Builds the runtime State from two files:
 *
 *   C01/initial.json        - THE SUPPLIED RECORD. Opened read-only, never written.
 *   data/synthetic-overlay.json - clearly labelled demo additions.
 *
 * Nothing else seeds state. Reset simply calls buildInitialState() again, which
 * is why the reset is genuinely repeatable rather than an undo stack.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { matchMessage } from "@/lib/domain/matching";
import type {
  Actor,
  Case,
  CheckRecord,
  Customer,
  InboxItem,
  Role,
  State,
} from "@/lib/types";

const ROOT = process.cwd();
export const SUPPLIED_PATH = path.join(ROOT, "C01", "initial.json");
export const OVERLAY_PATH = path.join(ROOT, "data", "synthetic-overlay.json");

/** Shape of the supplied file. Declared, not assumed, so a change is visible. */
type SuppliedRecord = {
  case_id: string;
  data_status: string;
  clock: string;
  customers: { id: string; preferred_language: string; contact_permission: string }[];
  messages: { id: string; customer_id: string; channel: string; text: string; case_ref: string }[];
  jobs: {
    id: string;
    workshop_state: string;
    quality_check?: string;
    crm_state: string;
    slot?: string;
    updated_at: string;
  }[];
  rules: string[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function readSupplied(): SuppliedRecord {
  return readJson<SuppliedRecord>(SUPPLIED_PATH);
}

export function readOverlay(): any {
  return readJson<any>(OVERLAY_PATH);
}

/** Used by the integrity test to prove the supplied file was never written to. */
export function suppliedHash(): string {
  return createHash("sha256").update(readFileSync(SUPPLIED_PATH)).digest("hex");
}

/** The three rules the supplied file states, surfaced for the evidence panel. */
export function suppliedRules(): string[] {
  return readSupplied().rules;
}

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}

export function buildInitialState(): State {
  const supplied = readSupplied();
  const overlay = readOverlay();

  const ownership = new Map<string, string>(); // caseId -> customerId
  for (const row of overlay.case_ownership) {
    ownership.set(row.case_ref, row.customer_id);
  }

  const customers: Customer[] = supplied.customers.map((c) => {
    const extra = overlay.customers.find((o: any) => o.id === c.id);
    if (!extra) throw new Error(`No synthetic overlay entry for supplied customer ${c.id}`);
    return {
      id: c.id,
      preferredLanguage: c.preferred_language,
      contactPermission: c.contact_permission as Customer["contactPermission"],
      displayLabel: extra.display_label,
      verifiedPhone: extra.verified_phone,
      portalToken: extra.portal_token,
      origin: "supplied",
    };
  });

  const employees: Actor[] = overlay.employees.map((e: any) => ({
    id: e.id,
    displayLabel: e.display_label,
    role: e.role as Role,
  }));

  const cases: Case[] = supplied.jobs.map((job) => {
    const customerId = ownership.get(job.id);
    if (!customerId) throw new Error(`No derived owner for supplied job ${job.id}`);

    const checks: CheckRecord[] = (overlay.case_checks[job.id] ?? []).map((c: any) => ({
      key: c.key,
      name: c.name,
      status: c.status,
      ownerRole: c.owner_role as Role,
      note: c.note,
      updatedAt: job.updated_at,
      updatedBy: "seed",
      origin: c.origin,
    }));

    return {
      id: job.id,
      customerId,
      workshopState: job.workshop_state,
      crmState: job.crm_state,
      checks,
      appointment: job.slot
        ? { slot: job.slot, bookingStatus: job.crm_state, changeStatus: "none" }
        : undefined,
      updatedAt: job.updated_at,
      origin: "supplied",
    };
  });

  const inbox: InboxItem[] = supplied.messages.map((m) => ({
    id: m.id,
    kind: "message",
    channel: m.channel as InboxItem["channel"],
    text: m.text,
    receivedAt: overlay.message_times[m.id] ?? "09:00",
    origin: "supplied",
    claimedCustomerId: m.customer_id,
    claimedCaseRef: m.case_ref,
    match: { status: "unverified", reason: "Not yet evaluated." },
    status: "new",
  }));

  // Deterministic matching runs at load, so the inbox never shows an
  // unevaluated message. Nothing is inferred from names or plates.
  for (const item of inbox) {
    item.match = matchMessage(item, { customers, cases });
    if (item.match.status !== "verified") item.status = "needs-manual-review";
  }

  return {
    seedVersion: `${supplied.case_id}/${suppliedHash().slice(0, 12)}`,
    clockMinutes: clockToMinutes(overlay.clock.starts_at),
    dealership: {
      name: overlay.dealership.name,
      productName: overlay.dealership.product_name,
      disclaimer: overlay.dealership.disclaimer,
      logo: overlay.dealership.logo,
      supportEmail: overlay.dealership.support_email,
      phone: overlay.dealership.phone,
    },
    customers,
    employees,
    cases,
    inbox,
    drafts: [],
    callbackTasks: [],
    outbound: [],
    audit: [],
    counters: {},
  };
}
