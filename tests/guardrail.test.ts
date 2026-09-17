import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInitialState } from "../lib/store/seed.ts";
import { evaluateCase, findCheck } from "../lib/domain/rules.ts";
import { checkDraft } from "../lib/ai/guardrail.ts";
import { mockProvider } from "../lib/ai/mock.ts";

const job1 = () => buildInitialState().cases.find((c) => c.id === "JOB-1")!;
const cusA = () => buildInitialState().customers.find((c) => c.id === "CUS-A")!;

test("a promise of collection is refused while the quality check is pending", () => {
  const e = evaluateCase(job1());
  for (const promise of [
    "Yes, you can collect your car this afternoon.",
    "Your vehicle is ready for collection.",
    "Bonjour, vous pouvez récupérer votre véhicule cet après-midi.",
    "Votre véhicule est prêt.",
  ]) {
    const v = checkDraft(promise, e);
    assert.equal(v.ok, false, `should refuse: ${promise}`);
  }
});

test("a careful draft that promises nothing passes", () => {
  const e = evaluateCase(job1());
  const safe =
    "The workshop work is finished. The quality check is still in progress, so I am not able to confirm a time yet.";
  assert.equal(checkDraft(safe, e).ok, true);
});

test("the same promise is allowed once the record supports it", () => {
  const c = job1();
  findCheck(c, "quality-check")!.status = "passed";
  const e = evaluateCase(c);
  assert.equal(checkDraft("Your vehicle is ready for collection.", e).ok, true);
});

test("the mock provider drafts in the customer's preferred language and promises nothing", async () => {
  const c = job1();
  const customer = cusA();
  const out = await mockProvider.analyze({
    text: "Can I collect my car this afternoon?",
    channel: "email",
    customer,
    caseRecord: c,
    evaluation: evaluateCase(c),
    dealershipPhone: "+212 520 000 000",
    history: [],
  });

  assert.equal(out.intent, "collection_request");
  assert.equal(out.language, "French");
  assert.ok(out.draft, "a draft was produced");
  assert.match(out.draft!, /contrôle qualité/, "drafted in French");
  assert.equal(checkDraft(out.draft!, evaluateCase(c)).ok, true, "its own output passes the guardrail");
});

test("an unclassifiable message yields no draft and an explicit error", async () => {
  const out = await mockProvider.analyze({
    text: "asdfgh qwerty zzz",
    channel: "email",
    customer: cusA(),
    caseRecord: job1(),
    evaluation: evaluateCase(job1()),
    dealershipPhone: "+212 520 000 000",
    history: [],
  });
  assert.equal(out.intent, "unknown");
  assert.equal(out.draft, undefined);
  assert.ok(out.error, "the failure is stated, not hidden");
});

test("the summary notices a customer who has asked more than once", async () => {
  const out = await mockProvider.analyze({
    text: "Can I collect my car this afternoon?",
    channel: "email",
    customer: cusA(),
    caseRecord: job1(),
    evaluation: evaluateCase(job1()),
    dealershipPhone: "+212 520 000 000",
    history: [{ channel: "phone-note", text: "I asked about collecting the same car." }],
  });
  assert.match(out.summary, /asked 2 times/);
});
