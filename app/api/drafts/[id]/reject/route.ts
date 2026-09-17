import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { rejectDraft } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const result = rejectDraft(id, await currentActor(), body.reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, draft: result.data });
}
