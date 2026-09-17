/**
 * Outbound email, deliberately hard to misuse.
 *
 * Three independent gates, all of which must pass:
 *   1. the draft is APPROVED by a service adviser (checked by the caller),
 *   2. the customer's communication permission allows email at all,
 *   3. the recipient is the single allow-listed test address.
 *
 * Gate 3 throws before any network call is attempted. No customer address is
 * ever used, and there is no code path that accepts one.
 */

import { Resend } from "resend";

export const TEST_SUBJECT_PREFIX = "[TEST — synthetic exercise]";

export type SendOutcome =
  | { result: "sent"; provider: "resend"; id: string; to: string }
  | { result: "simulated"; provider: "simulated"; to: string; reason: string }
  | { result: "failed"; provider: "resend"; to: string; error: string };

export function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const to = process.env.DEMO_TEST_EMAIL ?? "";
  const from = process.env.RESEND_FROM || "Service Desk <service-desk@nassim0x.com>";
  const enabled = process.env.EMAIL_ENABLED === "true" && Boolean(apiKey) && Boolean(to);
  return { apiKey, to, from, enabled };
}

/** The only address this prototype may ever contact. */
export function allowedRecipient(): string {
  const { to } = emailConfig();
  if (!to) throw new Error("DEMO_TEST_EMAIL is not set. There is no address this may send to.");
  return to;
}

export function assertAllowedRecipient(recipient: string): void {
  const allowed = allowedRecipient();
  if (recipient.trim().toLowerCase() !== allowed.trim().toLowerCase()) {
    throw new Error(
      `Refusing to send to '${recipient}'. This prototype may only email the allow-listed test address.`,
    );
  }
}

export async function sendTestEmail(args: {
  subject: string;
  body: string;
  caseRef: string;
  customerId: string;
}): Promise<SendOutcome> {
  const cfg = emailConfig();

  // Recipient is never taken from a customer record — only from config.
  const to = cfg.to;
  if (!to) {
    return {
      result: "simulated",
      provider: "simulated",
      to: "(no address configured)",
      reason: "DEMO_TEST_EMAIL is not set, so nothing was sent.",
    };
  }
  assertAllowedRecipient(to);

  if (!cfg.enabled) {
    return {
      result: "simulated",
      provider: "simulated",
      to,
      reason: !cfg.apiKey
        ? "RESEND_API_KEY is not set."
        : "EMAIL_ENABLED is not 'true', so sending is switched off.",
    };
  }

  const subject = `${TEST_SUBJECT_PREFIX} ${args.subject}`;
  const notice = [
    "-----------------------------------------------------------",
    "TEST MESSAGE from an UNOFFICIAL PROTOTYPE.",
    "Not an Autohaus Frisch service and not connected to their",
    "systems.",
    `Case ${args.caseRef}, customer ${args.customerId} — both invented.`,
    "No real customer was contacted. Sent only to an allow-listed",
    "test address.",
    "-----------------------------------------------------------",
  ].join("\n");

  try {
    const resend = new Resend(cfg.apiKey);
    const { data, error } = await resend.emails.send({
      from: cfg.from,
      to: [to],
      subject,
      text: `${args.body}\n\n\n${notice}`,
    });

    if (error) {
      return { result: "failed", provider: "resend", to, error: `${error.name}: ${error.message}` };
    }
    return { result: "sent", provider: "resend", id: data?.id ?? "unknown", to };
  } catch (err) {
    return {
      result: "failed",
      provider: "resend",
      to,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
