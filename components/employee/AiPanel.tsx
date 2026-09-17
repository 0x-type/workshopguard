"use client";

import { useState } from "react";
import type { Draft, InboxItem } from "@/lib/types";
import { Feedback, useAction } from "@/components/useAction";
import { StatusPill } from "@/components/ui/StatusPill";

type Props = {
  item: InboxItem;
  draft?: Draft;
  lastSend?: { result: string; to: string; error?: string; at: string; label: string };
  emailMode: string;
  canSend: boolean;
  canAnalyze: boolean;
  canApprove: boolean;
  approveReason: string;
  customerId: string;
};

export function AiPanel({
  item,
  draft,
  lastSend,
  emailMode,
  canSend,
  canAnalyze,
  canApprove,
  approveReason,
  customerId,
}: Props) {
  const { run, busy, error, notice } = useAction();
  const [body, setBody] = useState(draft?.editedBody ?? draft?.body ?? "");
  const [dirty, setDirty] = useState(false);

  const approved = draft?.status === "approved";

  return (
    <section className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm">Suggested response</h3>
        {item.ai ? (
          <span className="pill pill-accent" title="Which engine produced this">
            {item.ai.provider}
          </span>
        ) : (
          <span className="pill">not analysed</span>
        )}
      </div>

      {!item.ai && (
        <div className="space-y-3">
          <p className="text-sm muted">
            Nothing has been prepared for this message yet.
          </p>
          <button
            className="btn btn-primary"
            disabled={busy || !canAnalyze}
            onClick={() => run(`/api/messages/${item.id}/analyze`)}
          >
            {busy ? "Preparing…" : "Prepare response"}
          </button>
        </div>
      )}

      {item.ai && (
        <div className="anim-fade space-y-2">
          <p className="text-sm">{item.ai.summary}</p>
          <p className="text-xs faint">
            Written in {item.ai.language} for {customerId} · understood as &ldquo;
            {item.ai.intent.replace(/_/g, " ")}&rdquo; ({Math.round(item.ai.confidence * 100)}%
            confidence)
          </p>
        </div>
      )}

      {item.ai?.error && <p className="banner banner-warn">{item.ai.error}</p>}

      {draft && (
        <div className="space-y-2" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="font-semibold text-sm" htmlFor="draft-body">
              Message to the customer
            </label>
            <StatusPill status={draft.status} />
          </div>

          <textarea
            id="draft-body"
            className="field"
            style={{ minHeight: "13rem", lineHeight: 1.55 }}
            value={body}
            readOnly={approved}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
          />

          {approved || draft.status === "send-failed" ? (
            <div className="space-y-3">
              <p className="banner banner-ok">
                <span aria-hidden>✓</span>
                <span>
                  Approved by {draft.approvedBy} at {draft.approvedAt}, and recorded in the case
                  history.
                </span>
              </p>

              {lastSend?.result === "sent" ? (
                <p className="banner banner-ok text-sm">
                  <span aria-hidden>✉</span>
                  <span>
                    <strong>{lastSend.label}</strong> email sent to {lastSend.to} at {lastSend.at}.
                    No real customer was contacted.
                  </span>
                </p>
              ) : (
                <>
                  {lastSend?.result === "failed" && (
                    <p className="banner banner-stop text-sm">
                      <span aria-hidden>⊘</span>
                      <span>
                        Sending failed at {lastSend.at}: {lastSend.error} The approved wording is
                        preserved — you can retry.
                      </span>
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      className="btn btn-primary"
                      disabled={busy || !canSend}
                      title={canSend ? "Send to the allow-listed test address only" : approveReason}
                      onClick={() =>
                        run(`/api/drafts/${draft.id}/send`, {
                          okTitle: lastSend?.result === "failed" ? "Retry sent" : "Test email sent",
                          okMessage: "Delivered to the allow-listed test address only.",
                          okIcon: "✉",
                        })
                      }
                    >
                      <span aria-hidden>✉</span>
                      {lastSend?.result === "failed" ? "Retry send" : "Send test email"}
                    </button>
                    <span className="text-xs muted">{emailMode}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {draft.status === "rejected" && (
                <p className="text-sm muted">
                  You denied this wording. Edit it and approve when you are happy — nothing has
                  been sent.
                </p>
              )}

              <div className="flex gap-2 flex-wrap items-center">
                <button
                  className="btn btn-ok"
                  disabled={busy || !canApprove}
                  title={canApprove ? "Approve and record this response" : approveReason}
                  onClick={async () => {
                    if (dirty) {
                      const saved = await run(`/api/drafts/${draft.id}`, {
                        method: "PATCH",
                        body: { body },
                        quiet: true,
                      });
                      if (!saved) return;
                      setDirty(false);
                    }
                    await run(`/api/drafts/${draft.id}/approve`, {
                      okTitle: "Response approved",
                      okMessage: `Recorded against your name for ${customerId}.`,
                      okIcon: "✓",
                    });
                  }}
                >
                  <span aria-hidden>✓</span> Approve
                </button>

                <button
                  className="btn btn-stop"
                  disabled={busy || !canApprove}
                  title={canApprove ? "Deny this response — nothing is sent" : approveReason}
                  onClick={() =>
                    run(`/api/drafts/${draft.id}/reject`, {
                      okTitle: "Response denied",
                      okMessage: "Nothing sent. The message goes back for manual handling.",
                      okIcon: "⊘",
                    })
                  }
                >
                  <span aria-hidden>⊘</span> Deny
                </button>

                <button
                  className="btn"
                  disabled={busy || !dirty}
                  onClick={async () => {
                    const ok = await run(`/api/drafts/${draft.id}`, {
                      method: "PATCH",
                      body: { body },
                      okTitle: "Edit saved",
                      okMessage: "Saved as a draft. Not approved yet.",
                      okIcon: "✎",
                    });
                    if (ok) setDirty(false);
                  }}
                >
                  Save edit
                </button>

                {dirty && (
                  <span className="text-xs muted">
                    Unsaved edits — approving will save them first.
                  </span>
                )}
              </div>
              {!canApprove && <p className="text-xs muted">{approveReason}</p>}
            </>
          )}

          <Feedback error={error} notice={notice} />
        </div>
      )}

      {!draft && item.ai && <Feedback error={error} notice={notice} />}
    </section>
  );
}
