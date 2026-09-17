import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { linkMessage } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (!body.customerId || !body.caseRef) {
    return NextResponse.json(
      { error: "A customer ID and a case reference are both required. Identity is never guessed." },
      { status: 400 },
    );
  }
  const result = linkMessage(id, body.customerId, body.caseRef, await currentActor());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, item: result.data });
}
