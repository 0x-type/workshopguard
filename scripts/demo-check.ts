/**
 * Pre-demonstration smoke test.
 *
 * Drives the whole Customer A story through the domain layer with no browser
 * and no network, then resets. Run it right before presenting: if it exits 0,
 * the demo you are about to give works.
 *
 *   npm run check
 */

import { getState, resetState } from "@/lib/store/store";
import { suppliedHash } from "@/lib/store/seed";
import {
  analyzeMessage,
  approveDraft,
  confirmCollection,
  evaluationFor,
  setCheck,
  simulateInbound,
} from "@/lib/domain/transitions";
import { CRM_PENDING_CONFLICT } from "@/lib/domain/rules";
import type { Actor } from "@/lib/types";

const steps: string[] = [];
let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  steps.push(`${condition ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

async function main() {
  const hashBefore = suppliedHash();
  resetState();

  const actor = (role: string) => getState().employees.find((e) => e.role === role)! as Actor;
  const adviser = actor("service-adviser");
  const inspector = actor("quality-inspector");
  const technician = actor("technician");

  check("supplied record loads", getState().cases.length === 2 && getState().customers.length === 2);

  // The contradiction the whole case turns on.
  check(
    "JOB-1 raises the CRM / quality-check conflict",
    evaluationFor("JOB-1")!.conflicts[0] === CRM_PENDING_CONFLICT,
  );
  check("collection is blocked", evaluationFor("JOB-1")!.collectionAllowed === false);

  // Preparing a response.
  const analysed = await analyzeMessage("MSG-1", adviser);
  check("MSG-1 is matched and a response prepared", analysed.ok);
  const draft = getState().drafts.find((d) => d.inboxItemId === "MSG-1");
  check("a draft exists", Boolean(draft));
  check(
    "the draft cites the real record",
    draft?.evidence.facts.some((f) => f.source.includes("C01/initial.json")) ?? false,
  );

  // Who may do what.
  check("a technician cannot approve", approveDraft(draft!.id, technician).ok === false);
  check("the adviser can approve", approveDraft(draft!.id, adviser).ok === true);
  check("nobody can confirm collection yet", confirmCollection("JOB-1", adviser).ok === false);
  check(
    "an adviser cannot pass the quality check",
    setCheck("JOB-1", "quality-check", { status: "passed" }, adviser).ok === false,
  );

  // The changed information.
  check(
    "the inspector passes the check",
    setCheck("JOB-1", "quality-check", { status: "passed" }, inspector).ok === true,
  );
  check("the conflict clears", evaluationFor("JOB-1")!.conflicts.length === 0);
  check("collection becomes possible", evaluationFor("JOB-1")!.collectionAllowed === true);
  check("the adviser confirms collection", confirmCollection("JOB-1", adviser).ok === true);

  // The uncertain path.
  const sim = simulateInbound({ text: "My car, the blue one — is it ready?", channel: "email" }, adviser);
  const simId = sim.ok ? sim.data.id : "";
  await analyzeMessage(simId, adviser);
  const unknown = getState().inbox.find((m) => m.id === simId)!;
  check("an unidentifiable message stops at manual review", unknown.status === "needs-manual-review");
  check("nothing was drafted for it", !getState().drafts.some((d) => d.inboxItemId === simId));

  // Repeatability.
  resetState();
  check("reset restores the start state", getState().drafts.length === 0);
  check("C01/initial.json is untouched", suppliedHash() === hashBefore);

  console.log("\nCustomer A demonstration, end to end:\n");
  console.log(steps.join("\n"));
  console.log(
    failures === 0
      ? "\nAll good. The demonstration will work.\n"
      : `\n${failures} step(s) failed. Do not present until these are fixed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
