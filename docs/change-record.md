# What we were told, and what we changed because of it

A short record of the problem as given, the feedback received while building, and what actually
moved as a result. Kept honest: it includes the things we got wrong.

---

## 1. The original client problem

From the C01 brief. Fictional role-play dialogue, not a real client quote:

> "Customers tell us they have already explained the problem to three people. My team keeps
> switching between messages, the booking screen and the workshop. I want them to give a useful
> answer without making another promise we cannot keep."

**The actor:** a service adviser, mid-shift, with a customer waiting on the phone.
**The painful moment:** answering "can I collect it?" while the three systems in front of them
disagree.
**The consequence:** a promise that has to be taken back, and a customer who calls again.

### What the supplied record actually shows

The pain is not vagueness — it is a **specific contradiction**:

| Field | Value |
|---|---|
| `workshop_state` | work finished |
| `quality_check` | **pending** |
| `crm_state` | **ready for collection** |

Two of the three sources say the car is ready. The one that decides whether it is safe to release
says it is not. Whoever answers first, wins.

This reframed the work. The initial instinct was "summarise everything in one place" — a better
inbox. But a better inbox with the same contradiction in it produces the same wrong promise
faster. The intervention had to be a **refusal**, not a summary.

---

## 2. Feedback during the working session, and what changed

| # | What we were told | What changed |
|---|---|---|
| 1 | "I didn't like the design or the UX — I want it clear and light" | Rebuilt the design system: light, colour-coded by status (green done, amber waiting, red stop, grey not started). Status now carries the only strong colour on screen |
| 2 | "Each role only needs its own thing — a technician just needs a list of cars and a done button" | Split one screen with disabled buttons into **three screens**. A technician sees a repair list; an inspector sees cars awaiting sign-off; only the adviser sees the inbox. Verified server-side that no other role's content leaks in |
| 3 | "The approve step is annoying — you already clicked approve" | Removed the confirmation dialog. Direct **Approve / Deny** buttons that act immediately. Added a real *deny* action, which previously did not exist |
| 4 | "When I send from the portal I don't see a notification on the employee side" | Correct, and a genuine gap: nothing told an open workspace that anything had happened. Added polling plus an immediate sync when the tab regains focus — the common case, since the portal and the workspace are two tabs |
| 5 | "The reschedule should be a calendar, like a normal one" | Replaced the free-text slot field with a day strip and a time grid. Kept exercise-local days rather than real dates, because the supplied record states no real date is implied |
| 6 | "I need one page with login, not a collection of demo links" | Added `/portal` with sign-in by **customer ID + case reference** — deliberately the same pair the workspace uses to verify a message. The direct links remain, relabelled as a testing shortcut |
| 7 | "Customer B can send a message and a reschedule at the same time — it's confusing" | Found a real inconsistency: a portal *message* created an inbox item, a *reschedule* silently set a field on the case. Now everything the customer does lands in the inbox, with structured requests rendered as the change they ask for and **no AI panel** — a form needs no interpreting |
| 8 | "Don't make the call side complicated — just done if the call is done" | Reduced four steps to two one-click actions: **Done — I called**, and **Agreed \<time\>**. The note is optional; what must be recorded is that the call happened and who says so |
| 9 | "The next action is buried" | Added a **Next action** box at the top of every case, derived from the record so it cannot drift from what the rules permit |
| 10 | "Too much technical explanation is always visible" | Moved `jobs[JOB-1].quality_check` and the matching explanation into the Evidence panel. The checklist now reads in plain English; provenance stays on a badge |
| 11 | "Use employee-friendly wording" | "AI reading of this message" → **Suggested response**. "Analyse message" → **Prepare response**. CRM state demoted from a headline stat to a footnote |
| 12 | "Activity history should be useful — like 'technician passed the review'" | Raw action codes became sentences: `check-updated` → *"Quality check recorded as passed — Quality inspector"* |
| 13 | "Denying shouldn't be a dead end" | A denied draft stays editable with its buttons. The message stays on the adviser's pile instead of being flagged "manual review", which now means only *we could not work out whose case this is* |
| 14 | "Build the page where the employee registers a new customer and their car" | Added counter intake. It also solved a demo problem: the supplied record has JOB-1's work already finished, so the technician had nothing to do. A repair booked at intake starts *in progress* |

---

## 3. What we pushed back on, and why

**Matching a customer by their email address.** Asked whether an inbound email could identify the
sender so they need not quote an ID. We did not do it. The supplied rules say *"use customer IDs,
never guessed identity matches"*, and a `From:` header is trivially forged — we demonstrated this
with a test where an email claiming to be Customer A while quoting Customer B's case is refused.
The proposed middle path (a registered address producing a *suggested* match an employee confirms
in one click) was deferred by the client, not rejected.

**Sending a denied response.** Asked to keep the send button available after a denial. We kept
**Approve / Deny / Save edit**, but *Send* still appears only once a response is approved —
sending something a human explicitly refused would break the one rule the prototype exists to
enforce.

---

## 4. What we got wrong along the way

- The draft editor rendered **empty** after the first AI response: `useState` reads its initial
  value only on mount, and the panel mounted before any draft existed. Fixed by keying the panel to
  the draft id.
- A server component imported data from a `"use client"` module, which crashed the home page —
  everything crossing that boundary arrives as a reference proxy, not real data.
- We ran a production build while the dev server was running and corrupted it.
- We told the client to check their inbox for a test email that had actually been received by
  Resend, because the target domain's MX points there. That also exposed a loop: the prototype's
  own outgoing mail came back through the inbound webhook and would have appeared as a customer
  message. Now filtered.

---

## 5. What remains an assumption

The prototype proves the contradiction can be caught and that no role can bypass the rules. It has
**not** been tested on the thing that actually decides whether this works: whether an adviser under
time pressure trusts a screen telling them *not* to promise, while the CRM in the next tab says
they can. That is the next validation test, described in the README.
