import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { simulateInbound } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

/** Clearly-labelled simulated inbound message. Nothing is actually received. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  }
  const result = simulateInbound(
    {
      text: body.text,
      channel: body.channel ?? "email",
      customerId: body.customerId || undefined,
      caseRef: body.caseRef || undefined,
    },
    await currentActor(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, item: result.data });
}
