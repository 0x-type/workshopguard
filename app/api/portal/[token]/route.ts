import { NextResponse } from "next/server";
import {
  portalRequestCallback,
  portalRequestSlot,
  portalSubmitMessage,
  portalView,
} from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

/**
 * The customer's only endpoint. Everything it returns comes from the one-way
 * safe projection, and every write is scoped to the token's own customer.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = portalView(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, view: result.data });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const caseId = typeof body.caseId === "string" ? body.caseId : "";

  switch (body.action) {
    case "message": {
      const r = portalSubmitMessage(token, caseId, String(body.text ?? ""));
      return r.ok
        ? NextResponse.json({ ok: true, id: r.data.id })
        : NextResponse.json({ error: r.error }, { status: r.status });
    }
    case "callback": {
      const r = portalRequestCallback(token, caseId, body.reason);
      return r.ok
        ? NextResponse.json({ ok: true, id: r.data.id })
        : NextResponse.json({ error: r.error }, { status: r.status });
    }
    case "slot": {
      const r = portalRequestSlot(token, caseId, String(body.slot ?? ""));
      return r.ok
        ? NextResponse.json({ ok: true, requested: r.data.appointment?.requestedSlot })
        : NextResponse.json({ error: r.error }, { status: r.status });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
