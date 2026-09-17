import { NextResponse } from "next/server";
import { getState } from "@/lib/store/store";
import { matchMessage } from "@/lib/domain/matching";

export const dynamic = "force-dynamic";

/**
 * Portal sign-in.
 *
 * Identity is established exactly the way the inbox does it: a customer ID AND
 * a case reference that belong together. A name, an email address or a plate is
 * never enough — the same supplied rule, applied to the customer's own door.
 *
 * This is a demo sign-in, not authentication. In a real deployment the customer
 * would arrive on a signed one-time link; that is out of scope here and the
 * page says so.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const customerId = String(body.customerId ?? "").trim().toUpperCase();
  const caseRef = String(body.caseRef ?? "").trim().toUpperCase();

  if (!customerId || !caseRef) {
    return NextResponse.json(
      { error: "Enter both your customer ID and your case reference." },
      { status: 400 },
    );
  }

  const state = getState();
  const match = matchMessage(
    { claimedCustomerId: customerId, claimedCaseRef: caseRef },
    state,
  );

  if (match.status !== "verified") {
    // Deliberately vague back to the customer: a precise reason would let
    // someone probe which IDs and cases exist.
    return NextResponse.json(
      { error: "Those details do not match our records. Please check them, or call us." },
      { status: 401 },
    );
  }

  const customer = state.customers.find((c) => c.id === match.customerId)!;
  return NextResponse.json({ ok: true, token: customer.portalToken });
}
