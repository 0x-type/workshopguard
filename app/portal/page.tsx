import { getState } from "@/lib/store/store";
import { PortalSignIn } from "@/components/portal/PortalSignIn";
import { Brand } from "@/components/Brand";

export const dynamic = "force-dynamic";

/** The customer's front door. One page, one form. */
export default function PortalHome() {
  const state = getState();

  return (
      <main className="mx-auto px-4 py-12" style={{ maxWidth: "26rem" }}>
      <div className="mb-6 space-y-5">
        <Brand
          name={state.dealership.name}
          productName={state.dealership.productName}
          logo={state.dealership.logo}
          size="lg"
          href={null}
        />
        <h1 className="text-2xl font-semibold text-center">Your vehicle</h1>
        <p className="muted text-sm mt-2 text-center">
          Check progress, send us details and ask for a different appointment.
        </p>
      </div>

      <PortalSignIn dealershipPhone={state.dealership.phone} />

      <p className="text-xs faint text-center mt-6">
        {state.dealership.disclaimer} A demo sign-in, not real authentication — a live service
        would send a signed one-time link instead.
      </p>
      </main>
  );
}
