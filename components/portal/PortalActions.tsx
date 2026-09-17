"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToasts } from "@/components/ui/Toasts";
import { SlotPicker } from "@/components/portal/SlotPicker";

type Props = {
  token: string;
  caseRef: string;
  currentSlot?: string;
  canReschedule: boolean;
  rescheduleBlockedReason?: string;
  callbackPending: boolean;
  dealershipPhone: string;
  callbackOnly: boolean;
  slotDays: string[];
  slotTimes: string[];
};

/**
 * What a customer may do: send information, ask to be called, or ask for a
 * different time. All three are requests. None of them changes anything.
 *
 * For a callback-only customer the message box is explicitly NOT the start of
 * an email thread — it is detail for the adviser to have in front of them when
 * they telephone. The wording says so rather than leaving it to be assumed.
 */
export function PortalActions({
  token,
  caseRef,
  currentSlot,
  canReschedule,
  rescheduleBlockedReason,
  callbackPending,
  dealershipPhone,
  callbackOnly,
  slotDays,
  slotTimes,
}: Props) {
  const router = useRouter();
  const { push } = useToasts();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(action: string, payload: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, caseId: caseRef, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        push({
          title: "Not sent",
          detail: data.error ?? "Please try again.",
          icon: "⊘",
          tone: "stop",
        });
        return false;
      }
      push({ title: "Sent to the service team", detail: ok, icon: "✓", tone: "ok" });
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-sm">
          {callbackOnly ? "Anything we should know before we call?" : "Send us a message"}
        </h3>

        {callbackOnly ? (
          <p className="text-sm muted">
            These details go to the adviser who calls you; we will not reply by email.
          </p>
        ) : (
          <p className="text-sm muted">A service adviser will read this and reply.</p>
        )}

        <label className="section-title block" htmlFor={`${caseRef}-message`}>
          Message details
        </label>
        <textarea
          id={`${caseRef}-message`}
          className="field"
          rows={3}
          placeholder={
            callbackOnly
              ? "e.g. best time to reach me, what I would like to change…"
              : "Ask us anything about your vehicle…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        <div className="flex gap-2 flex-wrap items-center">
          <button
            className="btn btn-primary"
            disabled={busy || !text.trim()}
            onClick={async () => {
              const ok = await send(
                "message",
                { text },
                callbackOnly
                  ? "The adviser will have this when they telephone you."
                  : "A service adviser will read your message.",
              );
              if (ok) setText("");
            }}
          >
            {callbackOnly ? "Submit callback details" : "Send message"}
          </button>

          {callbackPending ? (
            <span className="pill pill-warn">
              <span className="pill-dot" /> callback already requested
            </span>
          ) : (
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                send(
                  "callback",
                  { reason: "Customer asked to be called back." },
                  "We will telephone you on your registered number.",
                )
              }
            >
              <span aria-hidden>☏</span> Ask us to call you
            </button>
          )}
        </div>

        {callbackPending && (
          <p className="text-xs muted">
            We already have your callback request, so there is nothing more to do — we will ring
            you. You can still add details above.
          </p>
        )}
      </div>

      {currentSlot && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Change your appointment</h3>

          {canReschedule ? (
            <>
              <p className="text-sm muted">
                Your appointment is <strong>{currentSlot}</strong>. Pick a time that suits you
                better and we will call to agree it.
              </p>
              <SlotPicker
                days={slotDays}
                times={slotTimes}
                currentSlot={currentSlot}
                disabled={busy}
                onPick={(slot) =>
                  send(
                    "slot",
                    { slot },
                    "This is a request. Nothing changes until we have agreed it with you.",
                  )
                }
              />
              <p className="banner banner-warn text-xs">
                <span aria-hidden>ⓘ</span>
                <span>
                  Choosing a time does not change your booking. A service adviser will confirm it
                  with you first.
                </span>
              </p>
            </>
          ) : (
            <p className="banner banner-warn text-sm">
              <span aria-hidden>ⓘ</span>
              <span>{rescheduleBlockedReason}</span>
            </p>
          )}
        </div>
      )}

      <p className="text-sm muted text-center">
        Prefer to talk? Call us on <strong>{dealershipPhone}</strong>.
      </p>
    </div>
  );
}
