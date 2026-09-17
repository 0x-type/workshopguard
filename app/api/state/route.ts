import { NextResponse } from "next/server";
import { getState } from "@/lib/store/store";
import { currentActor } from "@/lib/session";
import { suppliedHash, suppliedRules } from "@/lib/store/seed";

export const dynamic = "force-dynamic";

/**
 * Inspection endpoint. Returns the whole internal state, so it is EMPLOYEE-ONLY.
 * The customer portal never reads this; it has its own one-way safe projection
 * (added in Phase 2).
 */
export async function GET() {
  const actor = await currentActor();
  if (actor.role === "customer") {
    return NextResponse.json({ error: "Employee view only." }, { status: 403 });
  }
  return NextResponse.json({
    actor,
    suppliedFile: { path: "C01/initial.json", sha256: suppliedHash(), rules: suppliedRules() },
    state: getState(),
  });
}
