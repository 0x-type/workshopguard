# WorkshopGuard demo guide

This walkthrough starts from a repeatable synthetic state and uses no real customer information.

## Start and reset

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, open **Demo** in the top bar and press **Reset**. The reset rebuilds state from read-only `C01/initial.json` plus `data/synthetic-overlay.json`.

## Customer A: conflict, evidence and resolution

1. Use the **Service adviser** profile and open the first message, “Can I collect my car this afternoon?”
2. Confirm that **Next action** assigns the pending quality check to the quality inspector.
3. Observe the conflict: the CRM says ready for collection while the quality check is pending.
4. Press **Prepare response**. The response is drafted in French and makes no collection promise.
5. Open **Evidence — why this was recommended** and review the source attached to each fact.
6. Edit the draft to promise collection before the check, then try to approve it. The promise guardrail refuses the wording.
7. Switch to **Quality inspector** and pass the pending quality check.
8. Return as **Service adviser**, approve the safe response and confirm collection.
9. Open Customer A's portal. The safe timeline and approved message now reflect the completed decision.

## Customer B: callback-only appointment change

1. Open `/portal` and sign in with `CUS-B` and `JOB-2`.
2. Request a different appointment slot. The portal labels it **Requested — not confirmed**.
3. Return to the workspace as **Service adviser** and open Customer B's request.
4. Confirm there is a callback task rather than an email draft because the customer's permission is callback only.
5. Mark the call complete, then apply the agreed time. The booking-system update is explicitly recorded as `SIMULATED`.

## Manual-review case

1. As **Service adviser**, simulate an incoming email without a customer ID or case reference.
2. Confirm that the original text is preserved and the item becomes **Manual review required**.
3. Attempt to link `CUS-A` to `JOB-2`. The cross-customer link is refused.

## Intake

Use **New customer** to create a synthetic customer, vehicle and job. A repair created through intake begins in progress so the technician has work to complete. Intake remains demonstration data and is removed by reset.

## Automated checks

```bash
npm test
npm run check
npx tsc --noEmit
```

`npm run check` exercises the Customer A conflict and resolution flow without a browser and verifies that `C01/initial.json` remains unchanged.
