type Kind = "supplied" | "synthetic" | "simulated" | "test" | "portal" | "inbound";

const LABEL: Record<Kind, { text: string; cls: string; title: string }> = {
  supplied: { text: "supplied", cls: "pill", title: "Value comes from C01/initial.json" },
  synthetic: { text: "synthetic", cls: "pill pill-warn", title: "Added for the demo, not supplied data" },
  simulated: { text: "simulated", cls: "pill pill-warn", title: "Nothing actually happened outside this app" },
  test: { text: "test", cls: "pill pill-warn", title: "Test integration, restricted to an allow-listed address" },
  portal: { text: "portal", cls: "pill pill-accent", title: "Submitted by the customer in the portal" },
  inbound: {
    text: "real inbound",
    cls: "pill pill-ok",
    title: "A real email received through Resend's inbound webhook",
  },
};

/** Marks where a value came from, so nothing on screen is mistaken for real. */
export function OriginTag({ kind }: { kind: Kind }) {
  const l = LABEL[kind] ?? LABEL.synthetic;
  return (
    <span className={l.cls} title={l.title}>
      {l.text}
    </span>
  );
}
