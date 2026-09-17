import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { confirmCollection } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = confirmCollection(id, await currentActor());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, case: result.data });
}
