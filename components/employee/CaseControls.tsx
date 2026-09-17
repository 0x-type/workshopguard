"use client";

import type { Case } from "@/lib/types";
import type { Evaluation } from "@/lib/domain/rules";
import { Feedback, useAction } from "@/components/useAction";

/**
 * The service adviser's case actions. Quality-check controls do not appear here
 * at all — that is the inspector's screen, and the adviser cannot do it.
 */
export function CaseControls({
  caseRecord,
  evaluation,
  canConfirm,
  confirmReason,
}: {
  caseRecord: Case;
  evaluation: Evaluation;
  canConfirm: boolean;
  confirmReason: string;
}) {
  const { run, busy, error, notice } = useAction();

  const blocked = !evaluation.collectionAllowed;
  const blockText = [...evaluation.conflicts, ...evaluation.blockers].join(" ");

  return (
    <section className="card p-4 space-y-3">
      <h3 className="font-semibold text-sm">Collection</h3>

      {evaluation.collectionConfirmed ? (
        <p className="banner banner-ok">
          <span aria-hidden>✓</span>
          <span>Collection is confirmed for this case.</span>
        </p>
      ) : (
        <>
          <button
            className="btn btn-ok"
            disabled={busy || !canConfirm || blocked}
            title={!canConfirm ? confirmReason : blocked ? blockText : "Confirm collection"}
            onClick={() =>
              run(`/api/cases/${caseRecord.id}/collection`, {
                okTitle: "Collection confirmed",
                okMessage: `${caseRecord.id} is cleared for collection and recorded against your name.`,
                okIcon: "✓",
              })
            }
          >
            <span aria-hidden>✓</span> Confirm collection
          </button>

          {!canConfirm ? (
            <p className="text-xs muted">{confirmReason}</p>
          ) : blocked ? (
            <p className="banner banner-stop text-xs">
              <span aria-hidden>⊘</span>
              <span>Blocked by the rules: {blockText}</span>
            </p>
          ) : (
            <p className="text-xs muted">
              All required checks pass. This is the one action that tells the customer the car is
              genuinely ready, and it is recorded against your name.
            </p>
          )}
        </>
      )}

      <Feedback error={error} notice={notice} />
    </section>
  );
}
