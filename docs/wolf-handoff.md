# Prototype handoff

Case: **C01 — "The customer who keeps calling."**
Candidate/team: **[your name]**.
Prototype location: **`/Users/test/octopus`** — `npm install && npm run dev` → http://localhost:3000.

## The problem we validated

**Actor, painful moment and consequence:** a service adviser, mid-shift, answering "can I collect
my car this afternoon?" while the workshop record, the CRM and the quality check disagree. They
answer from whichever screen is open, promise a collection the record does not support, and the
customer calls back when it is taken away.

**Client evidence:** the supplied record carries the contradiction directly. `JOB-1` has
`workshop_state: "work finished"` and `crm_state: "ready for collection"` while
`quality_check` is still `"pending"`. Two sources of three say the car is ready; the one that
decides whether it is safe to release says it is not.

**What the client changed in our understanding:** we began aiming at "one place to see everything"
— a better inbox. A better inbox containing the same contradiction produces the same wrong promise,
faster. The intervention had to be a **refusal**, not a summary: the system must be able to stop a
promise, including one an adviser has typed themselves.

**What remains an assumption:** that an adviser under time pressure will trust a screen telling
them *not* to promise, while a CRM in the next tab says they can. Detection is proven. Adoption is
not.

## Open and demonstrate it

**Exact run instructions and start state:**

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # pre-demo smoke test; exits 0 if the demo will work
```

Press **Reset** in the top bar first. It rebuilds state from `C01/initial.json`, which is opened
read-only and hash-checked by a test. Runs with no API keys at all: drafting falls back to a
deterministic rule-based provider and email is simulated, both labelled on screen.

**Ordinary path:** Service adviser → first message ("Can I collect my car this afternoon?") →
*Next action* names the quality inspector → the conflict banner appears verbatim → **Prepare
response** drafts in French → **Evidence** cites `C01/initial.json → jobs[JOB-1].quality_check` →
approval is refused for a technician, and refused for anyone if the wording promises collection.

**Changed-information path:** Quality inspector → **Pass** → the conflict clears, *Next action*
becomes "the service adviser can now confirm collection" → adviser confirms → the customer's portal
timeline advances and the approved message appears.

**Failure or uncertainty path:** **Simulate an incoming email** with no IDs → *Manual review
required*, original text preserved, nothing drafted, nothing sendable. Linking it to another
customer's case is refused. A forced AI failure produces the same safe stop.

## What is real

| Component | Implemented or simulated | Evidence and limitation |
| --- | --- | --- |
| Input and event trigger | **Real** inbound email via Resend webhook; **simulated** button as the rehearsed fallback | Svix signature verified against the raw body; unsigned and forged requests refused (verified live). Needs a public URL — on a laptop, an ngrok tunnel whose address changes on restart |
| Retrieval / reasoning | **Split.** Matching, permissions, conflicts and status transitions are deterministic; DeepSeek handles language only | 87 tests, no network. The model receives the evaluation as facts it may not contradict, and its output is re-checked by a promise guardrail — which also runs on human edits. Falls back to a rule-based drafter on failure and says so on screen |
| Human review | **Real** | Only a service adviser may approve, deny or confirm collection. Refusals are recorded, not swallowed. Roles are a demo switch, not authentication — the rules are enforced server-side, the identity behind them is not |
| External action | **Real** outbound email, hard-limited; **simulated** telephone call and booking update | `sendTestEmail()` takes no recipient argument; the address comes only from `DEMO_TEST_EMAIL` and any other is refused before a network call. No booking system exists — the push is logged `SIMULATED`. Nothing is dialled |
| Persistence and history | **Real** audit, **in-memory** state | Every mutation passes one funnel that checks permission and writes history with actor, time and a real/test/simulated label. State is a module singleton written through to `.runtime/state.json`; there is no database, because repeatability matters more than durability here |

## Next client validation

**One real case we would test:** the next customer who telephones twice about the same vehicle.
Before answering, the adviser opens this screen and reads the *Next action* line aloud.

**What counts as success:** across ten such cases, the adviser gives an answer they would not
otherwise have given — declining a collection the record does not support, or confirming one they
would have hedged on. Measured as second calls avoided and promises retracted.

**Who evaluates it:** the customer-service lead, from the call log — not from this prototype's own
history, which would be marking its own homework.

## Wolf work

**Required integration and permission:** read access to the workshop job record, the CRM case
state, and the customer's contact-permission field — the three sources that currently disagree.
Write access is needed only for the two decisions a human makes: the quality-check result and the
collection approval. Booking changes can stay read-only at first; the adviser records what was
agreed on the call. Outbound messaging needs a verified sending domain and, critically, a
recipient policy owned by the dealership rather than by this code.

**Data boundary and model processing location:** customer message text, the vehicle's status
fields and the customer's language leave the building and reach DeepSeek. Names, addresses,
telephone numbers, plates and identifiers do not — the model is given a case reference and a
computed evaluation, never the customer record. No status, permission or promise is ever decided
outside our own code, so a model change cannot alter what a customer is told. If the dealership
requires that nothing leaves at all, the rule-based drafter already in the codebase produces a
usable, if blunter, reply with no network call.

**Failure/recovery plan:** every integration degrades to something safe and visible. AI failure →
rule-based draft, labelled, or *Manual review required*. Send failure → the approved wording is
preserved and a retry offered. Webhook down → Resend stores and retries, and the labelled simulate
button covers the demo. Unverifiable message → manual review with the original text intact. The
pattern throughout is **stop and say so**, never guess.

**Monitoring owner:** the customer-service lead owns the queue that matters — unresolved *Manual
review* items and open callbacks. Whoever owns the CRM integration owns the alert that matters
most: the rate at which CRM state and the quality check disagree. That number is the business case.

**Scope and effort drivers:** the size of this job is decided by three things, none of which are
the UI. (1) How many systems actually hold the truth, and whether they can be read live or only
nightly — a stale read reintroduces the exact contradiction we are solving. (2) Whether contact
permissions exist as data today, or live in people's heads. (3) Whether quality sign-off is
already a recorded event with an owner, or an informal nod on the workshop floor; if it is not
recorded, there is nothing to gate on. No invented price or delivery commitment.

**Next action and owner:** the customer-service lead nominates one live case for the validation
test described above, and confirms whether the quality check exists as a recorded event today. Both
are needed before any integration work is scoped.
