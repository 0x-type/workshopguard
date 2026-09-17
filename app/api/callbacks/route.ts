import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { createCallbackTask } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.caseId || !body.reason) {
    return NextResponse.json({ error: "A case and a reason are required." }, { status: 400 });
  }
  const result = createCallbackTask(body.caseId, body.reason, await currentActor());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, task: result.data });
}
