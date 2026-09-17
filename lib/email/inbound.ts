/**
 * Inbound email from Resend.
 *
 * Two things matter here and both are security, not convenience:
 *
 *  1. The request must be PROVEN to come from Resend. It arrives from the open
 *     internet, so it is verified against the webhook signing secret using the
 *     raw body. An unverified POST is rejected outright — otherwise anyone who
 *     found the URL could inject messages into the dealership's inbox.
 *
 *  2. Nothing in the email establishes identity. The sender address, the
 *     display name and the subject are all attacker-controlled. They are stored
 *     as text and never used to match a customer. Only a customer ID and a case
 *     reference found in the body can do that, and they are still checked
 *     against the record by the ordinary matching rules.
 */

import { Resend } from "resend";

export type InboundEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    received_for?: string[];
  };
};

export type VerifiedInbound =
  | { ok: true; event: InboundEvent }
  | { ok: false; status: number; error: string };

/**
 * Verifies the Svix signature Resend sends on every webhook.
 * The RAW body string must be used — parsing and re-stringifying changes the
 * bytes and the signature will not match.
 */
export function verifyInbound(rawBody: string, headers: Headers): VerifiedInbound {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "RESEND_WEBHOOK_SECRET is not set; inbound is disabled." };
  }

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return { ok: false, status: 400, error: "Missing Svix signature headers." };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    resend.webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    });
  } catch (err) {
    return {
      ok: false,
      status: 401,
      error: `Signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    return { ok: true, event: JSON.parse(rawBody) as InboundEvent };
  } catch {
    return { ok: false, status: 400, error: "Body was not valid JSON." };
  }
}

/**
 * The webhook carries metadata only — no body. Resend's own docs are explicit
 * about this, so the text has to be fetched separately.
 */
export async function fetchInboundBody(emailId: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return "";
    const body = (await res.json()) as { text?: string | null; html?: string | null };
    if (body.text?.trim()) return body.text.trim();
    if (body.html?.trim()) return stripHtml(body.html);
    return "";
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * True when an inbound email is one this prototype sent itself.
 *
 * The demo's own test emails go to an address on a domain whose MX points at
 * Resend, so they arrive straight back through the inbound webhook. Their
 * footer quotes the case and customer, which would otherwise match cleanly and
 * appear in the workspace as a message from the customer. It is not one.
 */
export function isOwnOutboundEmail(from: string): boolean {
  const configured = process.env.RESEND_FROM ?? "";
  // RESEND_FROM may be "Name <addr@host>" or a bare address.
  const ourAddress = (configured.match(/<([^>]+)>/)?.[1] ?? configured)
    .trim()
    .replace(/^"|"$/g, "")
    .toLowerCase();
  if (!ourAddress) return false;
  const sender = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  return sender === ourAddress;
}

/**
 * Looks for a customer ID and a case reference IN THE TEXT the customer wrote.
 *
 * This is not identification — it is a hint that still has to survive the
 * ordinary matching rules against the record. An email claiming "CUS-A" proves
 * nothing on its own, which is exactly why the result is fed to matchMessage()
 * rather than trusted.
 */
export function extractReferences(text: string, subject: string): {
  customerId?: string;
  caseRef?: string;
} {
  const haystack = `${subject}\n${text}`;
  const customer = haystack.match(/\bCUS-[A-Z0-9]+\b/i)?.[0]?.toUpperCase();
  const job = haystack.match(/\bJOB-[A-Z0-9]+\b/i)?.[0]?.toUpperCase();
  return { customerId: customer, caseRef: job };
}
