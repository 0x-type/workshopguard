import { NextResponse } from "next/server";
import {
  verifyInbound,
  fetchInboundBody,
  extractReferences,
  isOwnOutboundEmail,
} from "@/lib/email/inbound";
import { recordInboundEmail } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";
// The raw body is needed byte-for-byte for signature verification, so this
// route must not run on an edge runtime that might transform it.
export const runtime = "nodejs";

/**
 * Resend inbound webhook. Public endpoint — treat every request as hostile
 * until the signature proves otherwise.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  const verified = verifyInbound(raw, req.headers);
  if (!verified.ok) {
    // Deliberately terse: do not tell an unauthenticated caller what was wrong.
    console.warn(`[inbound] rejected: ${verified.error}`);
    return NextResponse.json({ error: "Rejected." }, { status: verified.status });
  }

  const { type, data } = verified.event;
  if (type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  // Our own test emails land back here, because the address they are sent to
  // is on a domain that Resend receives for. They are not customer messages.
  if (isOwnOutboundEmail(data.from)) {
    return NextResponse.json({ ok: true, ignored: "own outbound test email" });
  }

  // The webhook carries metadata only; the text has to be fetched.
  const text = await fetchInboundBody(data.email_id);
  const refs = extractReferences(text, data.subject ?? "");

  const result = recordInboundEmail({
    emailId: data.email_id,
    from: data.from,
    subject: data.subject ?? "(no subject)",
    text,
    customerId: refs.customerId,
    caseRef: refs.caseRef,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.data.id, match: result.data.match.status });
}
