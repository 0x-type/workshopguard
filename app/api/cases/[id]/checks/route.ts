import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { setCheck } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (!body.key || !body.status) {
    return NextResponse.json({ error: "A check key and status are required." }, { status: 400 });
  }
  const result = setCheck(
    id,
    body.key,
    { status: body.status, note: body.note, name: body.name },
    await currentActor(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, case: result.data });
}
