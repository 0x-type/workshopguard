import { NextResponse } from "next/server";
import { resetState } from "@/lib/store/store";
import { currentActor } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Repeatable reset to the supplied initial state. Available to any demo role. */
export async function POST() {
  const actor = await currentActor();
  const state = resetState(actor.id);
  return NextResponse.json({
    ok: true,
    message: "State reset to the supplied initial state.",
    seedVersion: state.seedVersion,
    clock: state.clockMinutes,
  });
}
