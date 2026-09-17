import type { Evaluation } from "@/lib/domain/rules";

export function ConflictBanner({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.conflicts.length === 0) return null;
  return (
    <div className="banner banner-warn anim-attention">
      <span aria-hidden>⚠</span>
      <div className="space-y-1">
        {evaluation.conflicts.map((c) => (
          <p key={c} className="font-medium">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}
