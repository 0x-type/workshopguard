import { test } from "node:test";
import assert from "node:assert/strict";

import { assertAllowedRecipient, emailConfig, sendTestEmail } from "../lib/email/resend.ts";
import { extractReferences, isOwnOutboundEmail } from "../lib/email/inbound.ts";
import { verifyInbound } from "../lib/email/inbound.ts";
import { getState, resetState } from "../lib/store/store.ts";
import { recordInboundEmail } from "../lib/domain/transitions.ts";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("only the allow-listed address may ever be emailed", () => {
  withEnv({ DEMO_TEST_EMAIL: "allowed@example.com" }, () => {
    assert.doesNotThrow(() => assertAllowedRecipient("allowed@example.com"));
    assert.doesNotThrow(() => assertAllowedRecipient("  ALLOWED@example.com "), "case and space tolerant");

    for (const bad of ["someone.else@example.com", "customer@real-person.com", ""]) {
      assert.throws(() => assertAllowedRecipient(bad), /Refusing to send/, `must refuse ${bad}`);
    }
  });
});

test("with no address configured, nothing can be sent at all", async () => {
  await withEnv({ DEMO_TEST_EMAIL: undefined, EMAIL_ENABLED: "true" }, async () => {
    const out = await sendTestEmail({ subject: "s", body: "b", caseRef: "JOB-1", customerId: "CUS-A" });
    assert.equal(out.result, "simulated", "it degrades safely rather than guessing a recipient");
  });
});

test("with the flag off it simulates, makes no network call, and says so", async () => {
  // A key IS present here, so the flag is provably the thing stopping the send.
  await withEnv(
    { EMAIL_ENABLED: "false", DEMO_TEST_EMAIL: "allowed@example.com", RESEND_API_KEY: "re_fake" },
    async () => {
      const out = await sendTestEmail({ subject: "s", body: "b", caseRef: "JOB-1", customerId: "CUS-A" });
      assert.equal(out.result, "simulated");
      assert.equal(out.provider, "simulated");
      if (out.result === "simulated") assert.match(out.reason, /EMAIL_ENABLED/);
    },
  );
});

test("the email config never derives a recipient from a customer record", () => {
  withEnv({ DEMO_TEST_EMAIL: "allowed@example.com" }, () => {
    const cfg = emailConfig();
    assert.equal(cfg.to, "allowed@example.com");
    // The signature of sendTestEmail takes no recipient at all, by design.
    assert.equal(sendTestEmail.length, 1, "callers cannot pass a recipient");
  });
});

// --- inbound ---------------------------------------------------------------

test("an inbound webhook without a signing secret is refused", () => {
  withEnv({ RESEND_WEBHOOK_SECRET: undefined }, () => {
    const r = verifyInbound("{}", new Headers());
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 503);
  });
});

test("an inbound webhook with no signature headers is refused", () => {
  withEnv({ RESEND_WEBHOOK_SECRET: "whsec_test" }, () => {
    const r = verifyInbound('{"type":"email.received"}', new Headers());
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 400);
      assert.match(r.error, /Svix/);
    }
  });
});

test("an inbound webhook with a forged signature is refused", () => {
  withEnv({ RESEND_WEBHOOK_SECRET: "whsec_YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=" }, () => {
    const headers = new Headers({
      "svix-id": "msg_1",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,Zm9yZ2VkIHNpZ25hdHVyZQ==",
    });
    const r = verifyInbound('{"type":"email.received"}', headers);
    assert.equal(r.ok, false, "a forged signature must never pass");
    if (!r.ok) assert.equal(r.status, 401);
  });
});

test("references are read from the text as a hint, never as proof", () => {
  assert.deepEqual(extractReferences("please help with JOB-1, I am CUS-A", ""), {
    customerId: "CUS-A",
    caseRef: "JOB-1",
  });
  assert.deepEqual(extractReferences("no ids here", "nothing"), {
    customerId: undefined,
    caseRef: undefined,
  });
  // Lowercase in the body still normalises.
  assert.equal(extractReferences("ref job-2 for cus-b", "").caseRef, "JOB-2");
});

test("a real inbound email is still matched by the record, not by its sender", () => {
  resetState();

  // Exactly what the webhook route does: parse hints out of the text, then let
  // the ordinary matching rules decide whether they hold up.
  const asRouteWould = (emailId: string, from: string, subject: string, text: string) =>
    recordInboundEmail({ emailId, from, subject, text, ...extractReferences(text, subject) });

  // The sender claims to be Customer A but quotes Customer B's case.
  const mismatched = asRouteWould(
    "ext-1",
    "cus-a@wherever.example",
    "About JOB-2",
    "Hello, this is CUS-A about JOB-2.",
  );
  assert.equal(mismatched.ok, true);
  if (mismatched.ok) {
    assert.equal(mismatched.data.status, "needs-manual-review");
    assert.match(mismatched.data.match.reason, /does not belong to customer CUS-A/);
    assert.equal(mismatched.data.origin, "inbound");
  }

  // An email with no references at all is never identified by its address.
  const anonymous = asRouteWould(
    "ext-2",
    "someone@example.com",
    "is my car ready",
    "Just checking on the blue one.",
  );
  assert.equal(anonymous.ok && anonymous.data.status, "needs-manual-review");
  assert.equal(
    getState().drafts.length,
    0,
    "an unverified inbound email produces no draft, so nothing can be sent",
  );
});

test("a retried webhook does not create a duplicate message", () => {
  resetState();
  const args = {
    emailId: "ext-same",
    from: "x@example.com",
    subject: "hello",
    text: "CUS-A JOB-1 any news?",
    customerId: "CUS-A",
    caseRef: "JOB-1",
  };
  const first = recordInboundEmail(args);
  const retry = recordInboundEmail(args);
  assert.equal(first.ok && retry.ok && first.data.id, retry.ok ? retry.data.id : "", "same item returned");
  assert.equal(getState().inbox.filter((m) => m.externalId === "ext-same").length, 1);
});

test("our own outbound test email is not mistaken for a customer message", () => {
  withEnv({ RESEND_FROM: '"Autohaus Frisch Assistant <service-desk@nassim0x.com>"' }, () => {
    assert.equal(isOwnOutboundEmail("service-desk@nassim0x.com"), true);
    assert.equal(isOwnOutboundEmail("Autohaus Frisch Assistant <service-desk@nassim0x.com>"), true);
    assert.equal(isOwnOutboundEmail("SERVICE-DESK@NASSIM0X.COM"), true, "case-insensitive");

    // A real customer writing in is still a real message.
    assert.equal(isOwnOutboundEmail("someone@example.com"), false);
    // And a lookalike is not us.
    assert.equal(isOwnOutboundEmail("service-desk@nassim0x.com.evil.example"), false);
  });
});
