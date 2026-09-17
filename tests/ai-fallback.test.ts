import { test } from "node:test";
import assert from "node:assert/strict";

import { getProvider } from "../lib/ai/provider.ts";
import { buildInitialState } from "../lib/store/seed.ts";
import { evaluateCase } from "../lib/domain/rules.ts";

const job1 = () => buildInitialState().cases.find((c) => c.id === "JOB-1")!;
const cusA = () => buildInitialState().customers.find((c) => c.id === "CUS-A")!;

function input() {
  const c = job1();
  return {
    text: "Can I collect my car this afternoon?",
    channel: "email",
    customer: cusA(),
    caseRecord: c,
    evaluation: evaluateCase(c),
    dealershipPhone: "+212 520 000 000",
    history: [],
  };
}

test("a live provider with no key falls back to the mock and discloses it", async () => {
  const prev = { provider: process.env.AI_PROVIDER, key: process.env.DEEPSEEK_API_KEY };
  process.env.AI_PROVIDER = "deepseek";
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const provider = await getProvider();
    const out = await provider.analyze(input());

    assert.ok(out.fellBackFrom, "the fallback is recorded, not hidden");
    assert.match(out.fellBackFrom!, /deepseek/);
    assert.equal(out.intent, "collection_request", "the demo still works");
    assert.ok(out.draft, "a usable draft is still produced");
    assert.equal(out.error, undefined, "the fallback succeeded, so there is no error");
  } finally {
    if (prev.provider) process.env.AI_PROVIDER = prev.provider;
    if (prev.key) process.env.DEEPSEEK_API_KEY = prev.key;
  }
});

test("fallback can be switched off, and then the failure surfaces", async () => {
  const prev = {
    provider: process.env.AI_PROVIDER,
    key: process.env.DEEPSEEK_API_KEY,
    fb: process.env.AI_FALLBACK,
  };
  process.env.AI_PROVIDER = "deepseek";
  process.env.AI_FALLBACK = "false";
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const provider = await getProvider();
    const out = await provider.analyze(input());
    assert.ok(out.error, "the failure is stated");
    assert.equal(out.draft, undefined, "nothing is drafted, so nothing can be sent");
  } finally {
    if (prev.provider) process.env.AI_PROVIDER = prev.provider;
    if (prev.key) process.env.DEEPSEEK_API_KEY = prev.key;
    if (prev.fb) process.env.AI_FALLBACK = prev.fb;
    else delete process.env.AI_FALLBACK;
  }
});

test("an unknown provider name degrades to the mock rather than crashing", async () => {
  const prev = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "not-a-real-provider";
  try {
    const provider = await getProvider();
    const out = await provider.analyze(input());
    assert.equal(out.intent, "collection_request");
  } finally {
    if (prev) process.env.AI_PROVIDER = prev;
  }
});
