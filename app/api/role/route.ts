import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROLE_COOKIE, isRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Demo role switch. Not authentication — clearly labelled as such in the UI. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!isRole(body.role)) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }
  const store = await cookies();
  store.set(ROLE_COOKIE, body.role, { path: "/", httpOnly: false, sameSite: "lax" });
  return NextResponse.json({ ok: true, role: body.role });
}
