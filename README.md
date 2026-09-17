# Autohaus Frisch — Communication Assistant

**Unofficial prototype.** Not an Autohaus Frisch service, not connected to their systems, and
not to be published as one. Every customer, vehicle and message in it is invented.

Built for case **C01, "The customer who keeps calling."**

---

## The problem it addresses

The supplied record contains a contradiction:

```json
"id": "JOB-1",
"workshop_state": "work finished",
"quality_check":  "pending",
"crm_state":      "ready for collection"
```

An adviser reading the CRM tells the customer "yes, collect it this afternoon" — and is wrong,
because the quality check has not been done. That is the promise the client says their team keeps
having to make and then take back.

This prototype makes that contradiction impossible to miss and impossible to act on:

- **Deterministic code decides anything that could become a promise** — matching, permissions,
  contact permissions, status transitions, conflicts, whether collection may be confirmed.
- **AI only handles language** — reading the message, summarising it, drafting a reply in the
  customer's language. Its output is checked afterwards and refused if it promises something the
  record does not support.

---

## Install and run

Requires **Node 20+** (developed on 22.18) and npm.

```bash
npm install
cp .env.example .env      # optional — it runs with no keys at all
npm run dev               # http://localhost:3000
```

With no `.env` the prototype is fully usable: drafting falls back to a deterministic rule-based
provider, and email is simulated. Add keys to turn on the real integrations.

| Variable | Effect if unset |
|---|---|
| `DEEPSEEK_API_KEY` + `AI_PROVIDER=deepseek` | Falls back to the offline rule-based drafter, labelled as such on screen |
| `EMAIL_ENABLED`, `RESEND_API_KEY`, `DEMO_TEST_EMAIL`, `RESEND_FROM` | Sending is simulated; nothing leaves the machine |
| `RESEND_WEBHOOK_SECRET` | The inbound webhook refuses every request (the safe default) |

```bash
npm test        # 87 tests, no network, no browser
npm run check   # pre-demo smoke test of the whole Customer A story
```

Run `npm run check` immediately before presenting. If it exits 0, the demo works.

> **Do not run `npx next build` while `npm run dev` is running** — the production build overwrites
> `.next/` and breaks the running dev server.

---

## Demo steps

Press **Reset** (top bar) before starting. It rebuilds everything from `C01/initial.json`.

### 1. Customer A — the ordinary path

1. Open **http://localhost:3000**, pick the **Service adviser** profile.
2. Select the first message: *"Can I collect my car this afternoon?"*
3. **Next action** at the top reads *"The quality inspector must complete the quality check."*
4. The amber banner shows, verbatim:
   *"Conflict: CRM says ready for collection, but quality check is still pending. Employee review required."*
5. Click **Prepare response**. Intent `collection_request`, drafted **in French** (CUS-A's language
   in the supplied record), promising no collection time.
6. Open **Evidence — why this was recommended**. Every fact names its source, e.g.
   `C01/initial.json → jobs[JOB-1].quality_check = pending`.
7. **Try to break it.** Edit the draft to say *"Yes, you can collect your car this afternoon"* and
   press **Approve**. It is refused — the guardrail checks the wording a human is approving, not
   just the model's.
8. Switch to **Technician** and try to approve. Refused, with the reason, and recorded in history.

### 2. Customer A — the changed-information path

9. Switch to **Quality inspector**. Their screen is a list of cars, not an inbox. Press **Pass**.
10. Back as **Service adviser**: the conflict has gone, the Next action now reads
    *"Every check passes — the service adviser can now confirm collection."*
11. **Confirm collection.** Open Customer A's portal — the timeline has advanced and the approved
    message is there.

### 3. Customer B — the callback path

12. Open **http://localhost:3000/portal**, sign in as `CUS-B` + `JOB-2`.
13. Under *Change your appointment*, pick a day and a time. The portal immediately says
    **"Requested — not confirmed."** The real booking still reads Day 2, 10:00.
14. As **Service adviser**, open Customer B's request. There is **no email draft** — instead a
    callback panel with their verified number, because the supplied record says `callback only`.
15. Press **Done — I called**, then **Agreed …** to apply the time. The external booking update is
    recorded as `SIMULATED`.

The same thing happens whether the request arrives by web, by portal or by email. Incoming channel
and contact permission are separate concerns, and a test asserts both routes produce the same
outcome.

### 4. The uncertain path

16. Press **Simulate an incoming email**, leave both ID fields blank, add it.
17. It lands as **Manual review required**: original text preserved, nothing drafted, nothing
    sendable. Try to link it to `CUS-A` + `JOB-2` — refused, because that case belongs to someone
    else.

### 5. Intake (optional)

18. **+ New customer** registers a customer and their vehicle. A repair booked this way starts with
    the work still *in progress*, so the technician has a real job to work through.

---

## What is real and what is simulated

| Component | Status | Notes |
|---|---|---|
| Rules, permissions, matching, conflicts, audit | **Real** | Pure functions, 87 tests, no network |
| Customer-safe portal projection | **Real** | One-way; a test scans the payload for leaks |
| AI drafting and summarising | **Real** (DeepSeek) | Falls back to a rule-based drafter on failure, and says so on screen |
| Promise guardrail | **Real** | Runs on the model's output *and* on human edits |
| Outbound email | **Real** (Resend) | Locked to one allow-listed test address |
| Inbound email | **Real** (Resend webhook) | Signature-verified; needs a public URL (ngrok) |
| The telephone call | **Simulated** | Nothing is dialled. Logged as `SIMULATED call to …` |
| External booking update | **Simulated** | No booking system exists. Logged as `SIMULATED` |
| "Simulate an incoming email" | **Simulated** | A labelled stand-in for the inbound webhook |
| Profile switch | **Not authentication** | A demo control, labelled as one |
| Portal sign-in | **Not authentication** | ID + case reference; a live service would send a signed one-time link |

### The Resend limitation, stated plainly

The prototype can email **exactly one address**, set in `DEMO_TEST_EMAIL`. `sendTestEmail()` takes
no recipient argument at all — the address comes only from configuration, and
`assertAllowedRecipient()` throws before any network call. There is no code path that can email a
customer. Every message is prefixed `[TEST — synthetic exercise]` and carries a footer saying it
came from an unofficial prototype.

Inbound email needs a publicly reachable URL. On a laptop that means a tunnel
(`ngrok http 3000`), and the URL changes each time the tunnel restarts, so the Resend webhook has
to be repointed. Full instructions: **`docs/resend-inbound.md`**.

---

## Known limitations

- **State is in memory.** A module singleton, written through to `.runtime/state.json` so a dev
  restart does not lose a demo. No database. Reset is the point, not persistence.
- **Roles are a demo switch, not a login.** Anyone can become anyone. The permission *rules* are
  real and enforced server-side; the identity behind them is not.
- **The portal sign-in is not authentication.** It proves the person knows a customer ID and a
  matching case reference. Adequate for a demo, not for production.
- **Times are exercise-local `HH:MM`**, and appointment days are "Day 1–5". The supplied record
  says no real date is implied, so a real calendar picker would be a false claim.
- **Two customers, two cases** unless you add more through intake. Nothing has been tested at
  volume; the inbox is an unpaginated list.
- **No vehicle diagnosis anywhere.** Notes are recorded verbatim. The system never infers what is
  wrong with a car.
- **The workspace polls every 3 seconds.** Fine for a demo; a real deployment would use a push
  channel.
- **`quality_check` is absent from JOB-2** in the supplied record, so the inspector's list shows
  only JOB-1 until a repair is booked at intake.

---

## The next validation test

**One real case, one question.**

Take the next customer who telephones twice about the same vehicle. Before answering, have the
adviser open this screen and read the **Next action** line out loud.

- **Success:** the adviser gives an answer they would not otherwise have given — either declining
  to promise a collection the record does not support, or confirming one they would have hedged on.
  Measured over ten such cases: how many second calls were avoided, and how many promises were
  taken back.
- **Who evaluates it:** the customer-service lead, from the call log — not from this prototype's
  own history.

The assumption that most needs testing is **not** whether the conflict can be detected — it can,
deterministically, and the tests prove it. It is whether an adviser under time pressure trusts a
screen that tells them *not* to promise something, when the CRM in the next tab says they can.

---

## Layout

```
C01/                      the supplied record — READ-ONLY, hash-checked by a test
data/synthetic-overlay.json  labelled demo additions (phones, portal links, checklists)
lib/domain/               the rules. Pure functions, no I/O
lib/ai/                   provider adapter, deterministic mock, promise guardrail
lib/email/                outbound allow-list, inbound signature verification
lib/store/                seed from the supplied file, in-memory state, reset
app/employee/             workspace — a different screen per role
app/portal/               customer sign-in and case view
tests/                    87 tests, node --test
scripts/demo-check.ts     pre-demo smoke test
docs/                     change record, Wolf handoff, inbound setup
```

`C01/initial.json` is opened read-only and never written to. A test hashes it before and after a
full mutate-and-reset cycle and fails if a single byte differs.
