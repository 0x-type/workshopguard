import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { approveBookingChange } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

/** Approving a change updates our record. The external booking push is SIMULATED. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const result = approveBookingChange(id, String(body.agreedSlot ?? ""), await currentActor());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, case: result.data });
}
