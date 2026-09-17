import { NextResponse } from "next/server";
import { getState } from "@/lib/store/store";
import { currentActor } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Cheap poll target: just enough to tell whether the workspace is stale.
 * No message bodies, so polling never leaks content into a log or a proxy.
 */
export async function GET() {
  const actor = await currentActor();
  if (actor.role === "customer") {
    return NextResponse.json({ error: "Employee view only." }, { status: 403 });
  }
  const state = getState();
  return NextResponse.json({
    ids: state.inbox.map((m) => m.id),
    // Any state change at all bumps the audit length, so a status update made
    // by another role shows up too, not only new messages.
    revision: state.audit.length,
  });
}
