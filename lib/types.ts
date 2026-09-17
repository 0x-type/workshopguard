/**
 * C01 domain types.
 *
 * `origin` appears on every record so the UI can always tell the user whether a
 * value came from the supplied C01/initial.json or was added for the demo.
 */

export type Origin = "supplied" | "synthetic" | "simulated" | "portal" | "inbound";

export type Role = "technician" | "quality-inspector" | "service-adviser" | "customer";

export type Actor = {
  id: string;
  displayLabel: string;
  role: Role;
};

/** Times are exercise-local HH:MM strings. No real date is ever implied. */
export type ExerciseTime = string;

export type ContactPermission = "service updates only" | "callback only";

export type Customer = {
  id: string;
  preferredLanguage: string;
  contactPermission: ContactPermission;
  displayLabel: string;
  verifiedPhone: string;
  portalToken: string;
  origin: Origin;
};

export type CheckKey = "workshop-work" | "quality-check" | "collection-approval" | "appointment" | (string & {});

export type CheckRecord = {
  key: CheckKey;
  name: string;
  status: string;
  ownerRole: Role;
  note: string;
  updatedAt: ExerciseTime;
  updatedBy: string;
  origin: Origin;
};

export type BookingChangeStatus = "none" | "requested" | "employee-approved";

export type Appointment = {
  slot: string;
  bookingStatus: string;
  requestedSlot?: string;
  requestedBy?: string;
  changeStatus: BookingChangeStatus;
  lastBookingPush?: "SIMULATED";
};

export type Case = {
  id: string;
  customerId: string;
  workshopState: string;
  crmState: string;
  checks: CheckRecord[];
  appointment?: Appointment;
  updatedAt: ExerciseTime;
  origin: Origin;
};

export type Channel = "email" | "web" | "phone-note" | "portal";

export type MatchStatus = "verified" | "unverified";

export type MatchResult = {
  status: MatchStatus;
  customerId?: string;
  caseId?: string;
  /** Plain-language reason, shown to the employee when status is 'unverified'. */
  reason: string;
  /** Set when an employee resolved an unverified message by hand. */
  resolvedBy?: string;
};

export type Intent =
  | "collection_request"
  | "appointment_change"
  | "status_question"
  | "callback_request"
  | "unknown";

export type AiAnalysis = {
  intent: Intent;
  confidence: number;
  summary: string;
  language: string;
  provider: string;
  error?: string;
};

export type InboxItemStatus =
  | "new"
  | "needs-manual-review"
  | "callback-required"
  | "drafted"
  | "approved"
  | "closed";

/**
 * What the customer actually sent. A free-text message needs interpreting; a
 * structured request does not — the system already knows exactly what was
 * asked, so no model is involved in reading it.
 */
export type InboxKind = "message" | "appointment-request" | "callback-request";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  channel: Channel;
  text: string;
  receivedAt: ExerciseTime;
  origin: Origin;
  claimedCustomerId?: string;
  claimedCaseRef?: string;
  match: MatchResult;
  ai?: AiAnalysis;
  status: InboxItemStatus;
  /** Provider id for a real inbound email, used to ignore webhook retries. */
  externalId?: string;
  /** Recorded for the employee to read. NEVER used to identify the customer. */
  fromAddress?: string;
  subject?: string;
  /** Set on a structured request: the concrete thing being asked for. */
  request?: { from?: string; to?: string; summary: string };
};

export type EvidenceFact = {
  label: string;
  value: string;
  /** Where the value came from, e.g. "C01/initial.json -> jobs[JOB-1].quality_check". */
  source: string;
};

export type EvidenceRule = {
  id: string;
  text: string;
  outcome: string;
};

export type Evidence = {
  recommendation: string;
  facts: EvidenceFact[];
  rules: EvidenceRule[];
  conflicts: string[];
  generatedAt: ExerciseTime;
};

export type DraftStatus = "suggested" | "edited" | "approved" | "rejected" | "send-failed";

export type Draft = {
  id: string;
  inboxItemId: string;
  caseId: string;
  language: string;
  body: string;
  editedBody?: string;
  status: DraftStatus;
  evidence: Evidence;
  approvedBy?: string;
  approvedAt?: ExerciseTime;
};

export type CallbackTask = {
  id: string;
  caseId: string;
  customerId: string;
  reason: string;
  phone: string;
  status: "open" | "completed";
  outcomeNote?: string;
  createdBy: string;
  createdAt: ExerciseTime;
  completedBy?: string;
  completedAt?: ExerciseTime;
};

export type OutboundAttempt = {
  id: string;
  draftId: string;
  to: string;
  provider: "resend" | "simulated";
  result: "sent" | "failed";
  error?: string;
  at: ExerciseTime;
  label: "TEST" | "SIMULATED";
};

/** Distinguishes what actually happened from what was only demonstrated. */
export type ActionLabel = "real" | "test" | "simulated";

export type AuditEvent = {
  id: string;
  at: ExerciseTime;
  actorRole: Role | "system";
  actorId: string;
  action: string;
  target: string;
  detail: string;
  label: ActionLabel;
};

export type Dealership = {
  name: string;
  /** What this tool is called, as distinct from the dealership itself. */
  productName: string;
  /** Shown wherever the dealership's name or logo appears. */
  disclaimer: string;
  logo: string;
  supportEmail: string;
  phone: string;
};

export type State = {
  seedVersion: string;
  /** Minutes elapsed on the exercise-local clock since 00:00. */
  clockMinutes: number;
  dealership: Dealership;
  customers: Customer[];
  employees: Actor[];
  cases: Case[];
  inbox: InboxItem[];
  drafts: Draft[];
  callbackTasks: CallbackTask[];
  outbound: OutboundAttempt[];
  audit: AuditEvent[];
  counters: Record<string, number>;
};
