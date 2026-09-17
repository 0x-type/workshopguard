# C01 — Dealership communication & vehicle-status prototype

## Context

**The problem.** A dealership customer-service lead: customers re-explain themselves to three people, and advisers hop between messages, the booking screen and the workshop. The team's real fear is not slowness — it is *making another promise they cannot keep*. `C01/initial.json` shows exactly how that happens: JOB-1 has `workshop_state: "work finished"` and `crm_state: "ready for collection"` while `quality_check` is still `"pending"`. An adviser reading only the CRM would tell Customer A "yes, collect this afternoon" and be wrong.

**The intervention.** One screen that joins the message, the case record and the rules, detects that contradiction deterministically, and refuses to let anyone but a service adviser promise collection — plus a customer portal that answers "is it ready?" honestly so the customer stops calling.

**The hard boundary.** AI reads and writes language. Deterministic code decides everything that can become a promise. `C01/initial.json` is read-only and is never written to.

**Environment (confirmed).** Greenfield dir `/Users/test/octopus` (not a git repo, contains only `C01/`). Node v22.18.0, npm 10.9.3. `OPENAI_API_KEY` present; no `ANTHROPIC_API_KEY`. Wolf handoff template found at `~/Downloads/octopus-candidate-pack/wolf-handoff-template.md` — copy into the repo, do not edit the original.

**Decisions taken (from user):** Next.js + TypeScript + Tailwind single app · pluggable AI adapter with a deterministic **mock provider as default** · real Resend key + verified test address available (recipient hard-allowlisted).

---

## 1. One-sentence product definition

A dealership workspace where a customer message is automatically matched to a verified case, checked against real job records by deterministic rules, answered by an AI draft that only a service adviser can approve — paired with a customer portal that shows a safe status so the customer stops calling.

## 2. Simplest complete user journey

Message arrives → matched to a verified case by `customer_id` + `case_ref` → rules evaluate the case and surface conflicts → AI drafts a reply in the customer's language → employee inspects evidence, edits, approves → action is executed under permission and channel rules → audit history records it → the customer portal reflects the new safe status.

## 3. Customer A demonstration flow (the ordinary + changed-information path)

| # | Actor | Action | System behaviour |
|---|---|---|---|
| 1 | — | Reset to initial state | State rebuilt from `C01/initial.json` + labelled synthetic overlay |
| 2 | Customer A | Opens portal link | Shows: repair work **finished**, quality check **in progress**, collection **not yet confirmed**. No CRM wording, no internal notes |
| 3 | Customer A | MSG-1 "Can I collect my car this afternoon?" | Appears in employee inbox, channel badge `email` |
| 4 | System | AI intent | `collection_request`, confidence, summary, language `French` |
| 5 | System | Deterministic match | `CUS-A` + `JOB-1` both supplied and case owner matches → **verified** |
| 6 | System | Rule evaluation | Conflict banner: *"Conflict: CRM says ready for collection, but quality check is still pending. Employee review required."* |
| 7 | System | AI draft (French) | Acknowledges, explains quality check outstanding, **promises nothing**; post-validated against a promise-phrase guardrail |
| 8 | Adviser | Opens **Evidence** panel | Facts with sources (`initial.json → jobs[JOB-1].quality_check = pending`), rules applied, recommendation "Do not confirm collection" |
| 9 | Adviser | Edits + Approves | Only `service-adviser` can; technician/QI see the button disabled with a reason |
| 10 | Adviser | Send test email | Resend → **allowlisted test address only**, labelled TEST; on failure draft is preserved with a retry state |
| 11 | — | History | Approval + email attempt recorded with actor, time, real/test/simulated label |
| 12 | **Quality inspector** | quality check `pending → passed` | **Changed information.** Adviser cannot do this; QI cannot confirm collection |
| 13 | System | Recalculate | Conflict clears, `collectionAllowed` flips true, portal timeline advances |
| 14 | Adviser | Confirm collection | Now permitted; audited |
| 15 | Customer A | Portal | **Collection confirmed**, plus the approved message in "previous messages" |

## 4. Customer B demonstration flow (callback path)

Customer B: `contact_permission: "callback only"`, JOB-2 booked Day 2 10:00, booking confirmed.

1. Message arrives **either** via portal submit **or** a clearly labelled *Simulate incoming email* button — the outcome must be identical, proving incoming channel ≠ communication permission.
2. Intent `appointment_change`; match `CUS-B` + `JOB-2` verified.
3. Channel policy: permission is `callback only` → **email path blocked and visibly refused**; appointment details must not be emailed.
4. System creates a **callback task**, shows the employee Customer B's verified phone, shows Customer B the dealership phone in the portal.
5. Customer B may suggest a preferred new slot from the portal → stored as `requestedSlot`, status **requested — not confirmed**, and the portal says so plainly.
6. Adviser marks the call made (**simulated**), records the agreed slot, approves the change → `appointment.slot` updates, booking-system push logged as **SIMULATED**.
7. Portal shows the new confirmed appointment; history shows call + approval + simulated booking update.

**Failure / uncertainty path (demonstrated as its own scripted step):** a simulated inbound email with no `customer_id` and no `case_ref` ("my car, the blue one — is it ready?"). Never matched by name or plate. Result: **Manual review required**, original text preserved verbatim, no draft, no send, and an employee affordance to link it to a verified case (audited as a manual verification) or leave it unresolved. A dev toggle also forces an AI-provider failure to show the same safe stop.

## 5. Pages and components

- `/` **Demo home** — role switcher (labelled DEMO), three scripted demos with deep links, **Reset to initial state**, environment banner (AI provider in use, email mode: real-test / simulated).
- `/employee` **Workspace** — two panes.
  - `InboxList` — channel badges `email` / `web` / `phone-note` / `portal`, match state, `Manual review required` chip.
  - `CaseHeader` · `CustomerCard` (id, language, contact permission, verified phone) · `StatusChecklist` (name · status · owner · note · last update · updated by) · `ConflictBanner` · `AiPanel` (summary, intent, suggested response, language) · `EvidenceDrawer` · `ActionBar` (edit / approve / send test email / confirm collection / create callback / approve booking change — each disabled **with the reason shown** when the role is not permitted) · `CallbackTaskCard` · `ActivityHistory`.
- `/portal/[token]` **Customer portal** — `PublicStatusTimeline`, `CollectionStatusCard`, `AppointmentCard` + request-different-slot form, `DealershipPhoneCard`, `CommunicationPreferenceCard`, `ApprovedMessagesList`, `MessageBox`, `RequestCallbackButton`.
- Global: `SimulationBadge`, `RoleSwitcher`, `ResetButton`.

**Portal access = secure demo case links** (chosen over accounts: faster, and it demonstrates isolation). One opaque token per customer; the token resolves to exactly one customer, and every portal query is scoped to that customer server-side. An unknown or other-customer token returns 404 — covered by a test.

## 6. Minimal data model

```ts
Customer  { id, preferredLanguage, contactPermission,          // supplied
            displayLabel, verifiedPhone, portalToken, origin }  // synthetic overlay

CheckRecord { key: 'workshop-work'|'quality-check'|'collection-approval'|string,
              name, status, ownerRole, note, updatedAt, updatedBy, origin }

Case      { id, customerId, workshopState, crmState, checks: CheckRecord[],
            appointment?: { slot, bookingStatus, requestedSlot?,
                            changeStatus: 'none'|'requested'|'employee-approved',
                            lastBookingPush?: 'SIMULATED' },
            updatedAt, origin }

InboxItem { id, channel, text, receivedAt, origin: 'supplied'|'simulated'|'portal',
            claimedCustomerId?, claimedCaseRef?,
            match: { status: 'verified'|'unverified', customerId?, caseId?, reason },
            ai?: { intent, confidence, summary, language, error? },
            status: 'new'|'needs-manual-review'|'drafted'|'approved'|'closed' }

Draft     { id, inboxItemId, caseId, language, body, editedBody?,
            status: 'suggested'|'edited'|'approved'|'rejected'|'send-failed',
            evidence: Evidence, approvedBy?, approvedAt? }

Evidence  { recommendation, facts: {label,value,source}[],
            rules: {id,text,outcome}[], conflicts: string[], generatedAt }

CallbackTask { id, caseId, customerId, reason, phone, status:'open'|'completed',
               outcomeNote?, createdBy, completedBy? }

OutboundAttempt { id, draftId, to, provider:'resend'|'simulated',
                  result:'sent'|'failed', error?, at, label:'TEST'|'SIMULATED' }

AuditEvent { id, at, actorRole, actorId, action, target, detail,
             label: 'real'|'test'|'simulated' }
```

The three governed statuses are `CheckRecord`s with fixed keys, so the checklist, the rules engine and "employees may add or update a check" all share one shape. `crmState` stays a separate plain field — it is an external system's opinion, and the whole point is that it can disagree.

**Provenance is explicit.** Everything from `initial.json` carries `origin: 'supplied'`; everything else `origin: 'synthetic'` and is rendered with a SYNTHETIC badge. Customer↔case ownership is *derived* from the supplied messages (MSG-1 → CUS-A/JOB-1, MSG-3 → CUS-B/JOB-2) and that derivation is recorded in the overlay as its source, not invented.

## 7. Roles and permissions

Single table in `lib/domain/permissions.ts`; the UI and the API read the same table. A denied attempt returns 403 **and writes an audit entry** — that denial is a demo moment, not an error.

| Action | technician | quality-inspector | service-adviser | customer |
|---|---|---|---|---|
| Update repair / custom check | ✅ | — | — | — |
| Set quality-check status | — | ✅ | — | — |
| Approve customer response | — | — | ✅ | — |
| Confirm collection | — | — | ✅ | — |
| Send approved test email | — | — | ✅ | — |
| Create / complete callback task | — | — | ✅ | — |
| Approve booking change | — | — | ✅ | — |
| Submit message / request callback / request slot | — | — | — | ✅ |
| View internal notes & evidence | ✅ | ✅ | ✅ | ❌ |

## 8. Status-transition rules (`lib/domain/rules.ts`, pure functions)

- **Matching** — a message is verified only when `customer_id` **and** `case_ref` are both present, both exist, and the case's owner equals the customer. Anything else → `unverified` + a stated reason. Name, email and plate are never used to establish identity.
- **Conflict** — `crmState === 'ready for collection' && qualityCheck !== 'passed'` emits verbatim: *"Conflict: CRM says ready for collection, but quality check is still pending. Employee review required."*
- **Missing data** — `qualityCheck` absent/unknown → `Manual review required`, never treated as passed.
- **Collection** — `collectionAllowed = workshopWork === finished && qualityCheck === passed && conflicts.length === 0`. Confirming additionally requires role `service-adviser` and an explicit approve action. Three independent gates.
- **Quality check** — `pending → passed | failed`, `failed → pending`; quality-inspector only.
- **Booking change** — `none → requested` (customer or employee) `→ employee-approved` (adviser only) → slot updated, external push logged `SIMULATED`.
- **Channel policy** — `callback only` ⇒ outbound email refused, callback task required. `service updates only` ⇒ email permitted for service-update intents only.
- **Public projection** — `computePublicStatus(case)` returns only stage states, collection status, appointment and approved messages. It never emits CRM state, internal notes, evidence, drafts or another customer's data. Enforced by a test asserting the serialized portal payload contains none of those strings.

## 9. AI vs deterministic code

**AI** (`lib/ai/`): understand the message, classify intent, summarise the conversation, select relevant information, draft the response in the customer's preferred language (French for CUS-A), and explain missing/conflicting information in plain words.

**Deterministic code** (`lib/domain/`): customer and case matching · roles and permissions · communication permissions · status transitions · conflict detection · whether collection may be confirmed · whether email or callback is allowed · ensuring only approved responses are sent · audit history · recalculating public status · blocking cross-customer access.

**The guardrail that ties them together:** the deterministic evaluation is injected into the draft prompt, and the returned draft is then *post-validated* against a promise-phrase check. If a draft implies collection while `collectionAllowed === false`, the draft is rejected and the item flips to Manual review. AI never gets the last word on a promise.

## 10. Resend integration and fallback

- `lib/email/resend.ts`. Sending requires (a) a draft with `status: 'approved'`, (b) actor role `service-adviser`, (c) channel policy allows email for that customer.
- **Recipient hard-allowlist**: only `DEMO_TEST_EMAIL`. Any other recipient throws before a network call — covered by a test. No customer address is ever used.
- Every email is labelled TEST in the subject/body prefix and in history.
- `EMAIL_ENABLED=false` or a missing key → clearly labelled **SIMULATED** send, recorded identically in history. Same code path, so the demo never depends on the network.
- Failure → draft stays approved, status `send-failed`, visible error + **Retry**. Resend can never block the main demonstration.
- **Inbound** is P2 and optional: `/api/inbound/resend` accepts a webhook if time allows; the default and the rehearsed path is the labelled **Simulate incoming email** button.
- Keys live in `.env.local` (gitignored), requested at implementation time, never written into tracked files.

## 11. Implementation order — phases with demo checkpoints

Work is phase by phase; each phase ends at a checkpoint that is demonstrable on its own.

**Phase 0 — Scaffold and data spine.** Next.js app, types, read-only loader for `initial.json`, synthetic overlay, store singleton (`globalThis` + `.runtime/state.json` so a dev-server restart doesn't lose the demo), audit log, `POST /api/reset`, role switcher, demo home.
✅ *Checkpoint:* `/` renders, `/api/state` shows both customers and both jobs, Reset restores initial state, `initial.json` byte-identical.

**Phase 1 — P0 employee core.** Inbox, case view, status checklist, rules engine, conflict banner, evidence drawer, AI mock provider (intent + summary + FR/EN draft + guardrail), edit/approve, quality-check update, recalculated collection status, confirm collection, activity history, the unverified-message failure case.
✅ *Checkpoint:* **the entire Customer A demonstration runs internally** — conflict → evidence → approval → QC passes → collection confirmed — with no portal and no email.

**Phase 2 — P1 portal and Customer B.** Token links, public projection, portal timeline, message submission, request callback, request different slot, callback task flow, booking-change approval with simulated push, role-based demo views.
✅ *Checkpoint:* Customer A end-to-end **including the portal updating to collection confirmed**, and Customer B's callback path from both portal and simulated email.

**Phase 3 — P2 Resend and real AI.** Real outbound test email with allowlist + retry, real AI provider behind the adapter, optional inbound webhook, visual polish.
✅ *Checkpoint:* a labelled test email lands in your inbox and appears in case history; `AI_PROVIDER=openai` produces a French draft that still passes the guardrail; `AI_PROVIDER=mock` still works with the network off.

**Phase 4 — Deliverables.** README, the short pain/feedback/change record, the completed Wolf handoff, a full rehearsal from Reset.
✅ *Checkpoint:* a cold `git clone`-equivalent run reproduces all four scripted paths.

## 12. Testing plan

Pure domain logic runs under `node --test` with no React and no network — fast enough to run after every phase.

- **rules**: JOB-1 emits the conflict string verbatim; `collectionAllowed` false→true only after QC passes; missing QC → manual review, never pass.
- **permissions**: full role × action matrix, including every denial.
- **matching**: verified pair; wrong-owner pair; missing `case_ref`; unknown customer; plate/name never matches.
- **channelPolicy**: CUS-B email refused and a callback task required; CUS-A service-update email allowed.
- **publicStatus leak test**: the serialized portal payload for CUS-A contains no CRM state, no internal note text, no evidence, no draft, and nothing belonging to CUS-B.
- **portal token isolation**: CUS-A's token cannot load JOB-2; unknown token → 404.
- **email allowlist**: non-allowlisted recipient throws before any network call; unapproved draft cannot be sent.
- **AI guardrail**: a draft containing a collection promise is rejected while `collectionAllowed === false`.
- **reset**: mutate heavily → reset → state deep-equals the initial projection; and `C01/initial.json` content hash is unchanged after a full demo run (asserted in CI-style script).
- `scripts/demo-check.ts` drives the whole Customer A flow headlessly through the domain layer — a one-command smoke test before presenting.
- Manual E2E: the four scripted paths in the README, each starting from Reset.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Dev-server restart / HMR loses demo state mid-presentation | `globalThis` singleton + `.runtime/state.json` write-through; Reset is one click |
| Live model latency, refusal or unparseable JSON during the demo | Mock provider is the **default**; real provider is opt-in; any AI failure degrades to Manual review, which is itself a required demo path |
| Resend domain/verification friction or send failure | Allowlisted recipient, `EMAIL_ENABLED` flag, identical simulated path, retry state; email is P2 and never on the critical path |
| Scope creep into a repair-management system | Explicit non-goal; checks are a flat list, no scheduling, no parts, no diagnosis |
| Internal data leaking into the portal | Dedicated one-way projection + an automated leak test, not developer discipline |
| Provenance blur between supplied and invented records | `origin` on every record, SYNTHETIC badges, `initial.json` opened read-only and hash-checked |
| Time overrun | P0 is complete and demonstrable at the end of Phase 1; everything after is additive |

## 14. Cut list if time runs short (in this order)

1. Real AI provider — ship with the mock (it is deterministic and honest, and is labelled as rule-based).
2. Resend **inbound** webhook — the simulated incoming email button is the rehearsed path anyway.
3. Adding **custom** checks — keep the three governed ones.
4. The `failed` quality-check branch — `pending → passed` carries the demo.
5. Visual polish, and the customer's *suggested* preferred slot (keep the request-and-approve flow itself — it is Customer B's whole point).

Never cut: conflict detection, evidence view, adviser approval, the failure path, reset.

## 15. Definition of done

- [ ] `npm install && npm run dev` from a clean checkout, and the demo home loads.
- [ ] `C01/initial.json` is byte-identical after a full demo run (hash-asserted).
- [ ] Reset restores the supplied initial state, repeatably, from any state.
- [ ] Customer A **ordinary path**: portal shows finished / pending / not confirmed; MSG-1 reaches the inbox; intent identified; case matched by ID + ref; the conflict string displays verbatim; the French draft promises nothing; evidence cites the actual supplied records and rules; only the adviser can approve.
- [ ] Customer A **changed-information path**: quality inspector passes the check; status recalculates; the adviser confirms collection; the portal shows collection confirmed.
- [ ] Customer B **callback path**: works identically from portal and simulated email; no email sent; callback task created; verified phone shown to the employee; dealership phone shown to the customer; slot change stays a request until adviser approval; booking push logged SIMULATED.
- [ ] **Failure path**: unverifiable message → Manual review required, original preserved, nothing sent, nothing guessed, employee can resolve it.
- [ ] Every mutation appears in activity history with actor, role, time and a real/test/simulated label.
- [ ] A labelled test email reaches only the allowlisted address and is recorded in history; a forced failure preserves the approved draft and offers retry.
- [ ] Permission denials are visible and audited, not silent.
- [ ] `node --test` green.
- [ ] README (install, run, exact demo steps, real vs simulated, Resend limitation, known limitations, next validation test), the pain/feedback/change record, and the completed Wolf handoff are all present in the repo.

## 16. File-level implementation plan

```
/Users/test/octopus/
├─ C01/                             READ-ONLY. Never written. Hash-checked.
│   ├─ brief.md
│   └─ initial.json
├─ data/
│   └─ synthetic-overlay.json       LABELLED SYNTHETIC: phones, portal tokens,
│                                   dealership number, seeded checks, derived ownership
├─ lib/
│  ├─ types.ts                      All domain types (§6)
│  ├─ store/
│  │   ├─ seed.ts                   Load initial.json (read-only) + overlay → State
│  │   ├─ store.ts                  globalThis singleton, write-through .runtime/state.json
│  │   └─ reset.ts                  Rebuild from seed, clear audit, log the reset
│  ├─ domain/
│  │   ├─ permissions.ts            Role × action table + can()
│  │   ├─ matching.ts               matchCase() — ID + ref only, never name/plate
│  │   ├─ rules.ts                  evaluateCase(), conflicts, collectionAllowed
│  │   ├─ publicStatus.ts           computePublicStatus() — the one-way customer projection
│  │   ├─ channelPolicy.ts          email vs callback permission
│  │   ├─ transitions.ts            applyAction(): validate → mutate → audit (single funnel)
│  │   └─ evidence.ts               Build Evidence with source citations
│  ├─ ai/
│  │   ├─ provider.ts               AiProvider interface + selection by env
│  │   ├─ mock.ts                   Deterministic intent + EN/FR templates (default)
│  │   ├─ openai.ts                 Real provider, strict JSON out
│  │   ├─ anthropic.ts              Same interface, used if ANTHROPIC_API_KEY
│  │   └─ guardrail.ts              Reject drafts that promise what rules forbid
│  └─ email/
│      └─ resend.ts                 Allowlisted send, TEST label, simulate fallback, retry
├─ app/
│  ├─ page.tsx                      Demo home: roles, scripts, reset, env banner
│  ├─ employee/page.tsx             Workspace shell (inbox | case)
│  ├─ portal/[token]/page.tsx       Customer portal
│  └─ api/
│     ├─ state/route.ts             GET state (role-scoped)
│     ├─ reset/route.ts             POST reset
│     ├─ inbox/route.ts             GET inbox · POST simulated incoming email
│     ├─ messages/[id]/analyze/route.ts   AI intent + summary + draft
│     ├─ messages/[id]/link/route.ts      Manual verification of an unmatched message
│     ├─ drafts/[id]/route.ts       PATCH edit · POST approve/reject
│     ├─ drafts/[id]/send/route.ts  Approved-only send (+ retry)
│     ├─ cases/[id]/checks/route.ts POST/PATCH a check (incl. quality check)
│     ├─ cases/[id]/collection/route.ts   Adviser-only confirm
│     ├─ cases/[id]/booking/route.ts      Request / approve slot change (SIMULATED push)
│     ├─ callbacks/route.ts         Create / complete callback tasks
│     ├─ portal/[token]/route.ts    GET safe view · POST message / callback / slot request
│     └─ inbound/resend/route.ts    P2, optional webhook
├─ components/                      InboxList, StatusChecklist, ConflictBanner, AiPanel,
│                                   EvidenceDrawer, ActionBar, CallbackTaskCard,
│                                   ActivityHistory, PortalTimeline, RoleSwitcher,
│                                   SimulationBadge, ResetButton
├─ tests/                           rules · permissions · matching · channelPolicy ·
│                                   publicStatus-leak · portal-isolation · email-allowlist ·
│                                   guardrail · reset-integrity   (node --test)
├─ scripts/demo-check.ts            Headless Customer A smoke test
├─ docs/
│  ├─ change-record.md              Pain → client feedback → what changed
│  └─ wolf-handoff.md               Copy of the supplied template, completed
├─ README.md                        Install · run · exact demo steps · real vs simulated ·
│                                   Resend limitation · limitations · next validation test
├─ .env.example                     AI_PROVIDER, OPENAI_API_KEY, ANTHROPIC_API_KEY,
│                                   RESEND_API_KEY, DEMO_TEST_EMAIL, EMAIL_ENABLED
└─ .gitignore                       .env.local, .runtime/, node_modules, .next
```

## Verification

After each phase, run `node --test` and walk the checkpoint for that phase from a fresh **Reset**. Before presenting:

1. `npm run dev`, open `/`, press **Reset to initial state**.
2. Run all four scripted paths (Customer A ordinary, Customer A changed-information, Customer B callback, failure) using the role switcher.
3. `node scripts/demo-check.ts` — headless Customer A flow must exit 0.
4. `node --test` — all green, including the `initial.json` integrity and portal-leak assertions.
5. Confirm the test email arrived at the allowlisted address and is recorded in case history with a TEST label.
