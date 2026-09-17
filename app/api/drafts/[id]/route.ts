import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { editDraft } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.body !== "string") {
    return NextResponse.json({ error: "A response body is required." }, { status: 400 });
  }
  const result = editDraft(id, body.body, await currentActor());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, draft: result.data });
}
