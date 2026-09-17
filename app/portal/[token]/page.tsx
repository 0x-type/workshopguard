import { notFound } from "next/navigation";
import { portalView } from "@/lib/domain/transitions";
import { readOverlay } from "@/lib/store/seed";
import { StatusTimeline } from "@/components/portal/StatusTimeline";
import { PortalActions } from "@/components/portal/PortalActions";
import { StatusPill } from "@/components/ui/StatusPill";
import { Brand } from "@/components/Brand";

export const dynamic = "force-dynamic";

/**
 * The customer's view. Everything on this page comes from buildPublicView().
 * Internal notes, CRM state, evidence, unapproved drafts and other customers'
 * records cannot reach it, because they are never put into the projection.
 */
export default async function Portal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = portalView(token);
  if (!result.ok) notFound();

  const view = result.data;
  const slots = readOverlay().appointment_slots as { days: string[]; times: string[] };

  return (
      <main className="portal-shell mx-auto px-4 py-8 space-y-6" style={{ maxWidth: "46rem" }}>
      <header className="space-y-2">
        <Brand
          name={view.dealershipName}
          productName={view.productName}
          logo={view.logo}
          size="lg"
          href={null}
        />
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {view.customerLabel}</h1>
        <p className="muted text-sm">Your current vehicle status and agreed contact details.</p>
      </header>

      {view.cases.map((c) => (
        <section key={c.caseRef} className="space-y-4">
          <div className="card portal-case">
          <div className="portal-section">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="section-title">Your reference</p>
                <p className="text-lg font-semibold mono">{c.caseRef}</p>
              </div>
              <StatusPill
                status={c.collectionHeadline}
                tone={c.collectionConfirmed || c.collectionHeadline.toLowerCase().includes("booked") ? "ok" : "warn"}
              />
            </div>
            <p className="text-sm muted mt-3">{c.collectionNote}</p>
          </div>

          <div className="portal-section">
            <h2 className="font-semibold text-sm mb-4">Progress</h2>
            <StatusTimeline stages={c.stages} />
          </div>

          {c.appointment && (
            <div className="portal-section space-y-2">
              <h2 className="font-semibold text-sm">Your appointment</h2>
              <p className="text-lg font-medium">{c.appointment.slot}</p>
              <p className="text-sm muted">{c.appointment.note}</p>
              {c.appointment.requestedSlot && (
                <p className="banner banner-warn text-sm">
                  <span aria-hidden>ⓘ</span>
                  <span>
                    You asked for <strong>{c.appointment.requestedSlot}</strong>. This is a request
                    and is <strong>not confirmed</strong> — we will call you to agree it.
                  </span>
                </p>
              )}
            </div>
          )}

          {c.callback && (
            <div className="portal-section space-y-1">
              <h2 className="font-semibold text-sm">Callback</h2>
              <p className="text-sm muted">{c.callback.note}</p>
              <StatusPill status={c.callback.state === "open" ? "we will call you" : "call completed"} tone={c.callback.state === "open" ? "warn" : "ok"} />
            </div>
          )}

          {c.approvedMessages.length > 0 && (
            <div className="portal-section space-y-3">
              <h2 className="font-semibold text-sm">Messages from us</h2>
              {c.approvedMessages.map((m, i) => (
                <div
                  key={i}
                  className="p-3 rounded text-sm"
                  style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs faint mono mb-1.5">{m.at}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
                </div>
              ))}
            </div>
          )}
          </div>

          <PortalActions
            token={token}
            caseRef={c.caseRef}
            currentSlot={c.appointment?.slot}
            canReschedule={c.appointment?.canReschedule ?? false}
            rescheduleBlockedReason={c.appointment?.rescheduleBlockedReason}
            callbackPending={c.callbackPending}
            dealershipPhone={view.dealershipPhone}
            callbackOnly={view.communicationPreference === "callback only"}
            slotDays={slots.days}
            slotTimes={slots.times}
          />
        </section>
      ))}

      <section className="work-section space-y-2">
        <h2 className="font-semibold text-sm">How we contact you</h2>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="muted">Your preference</span>
          <StatusPill status={view.communicationPreference} tone="accent" dot={false} />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="muted">Our number</span>
          <strong>{view.dealershipPhone}</strong>
        </div>
      </section>

      <p className="text-xs faint text-center">{view.disclaimer}</p>
      </main>
  );
}
