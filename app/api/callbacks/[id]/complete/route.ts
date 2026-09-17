import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { completeCallbackTask } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const result = completeCallbackTask(id, String(body.outcomeNote ?? ""), await currentActor());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, task: result.data });
}
