import { NextResponse } from "next/server";
import { currentActor } from "@/lib/session";
import { registerCustomer } from "@/lib/domain/transitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = registerCustomer(
    {
      displayLabel: String(body.displayLabel ?? ""),
      preferredLanguage: String(body.preferredLanguage ?? "English"),
      contactPermission: body.contactPermission === "callback only" ? "callback only" : "service updates only",
      verifiedPhone: String(body.verifiedPhone ?? ""),
      caseType: body.caseType === "appointment" ? "appointment" : "repair",
      slot: body.slot ? String(body.slot) : undefined,
      note: body.note ? String(body.note) : undefined,
    },
    await currentActor(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    ok: true,
    customer: result.data.customer,
    case: result.data.caseRecord,
  });
}
