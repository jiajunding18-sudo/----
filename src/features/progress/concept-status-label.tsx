"use client";

import { useLearningStore } from "./learning-store-provider";
import { getConceptStatus } from "./progress-domain";

const statusLabels = {
  not_started: "未开始",
  learning: "学习中",
  understood: "已理解",
  mastered: "已掌握",
} as const;

export function ConceptStatusLabel({ conceptId }: { readonly conceptId: string }) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );

  return (
    <span
      className="w-fit rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]"
      data-concept-status={hydrated ? getConceptStatus(progress, conceptId) : "loading"}
    >
      {hydrated ? statusLabels[getConceptStatus(progress, conceptId)] : "恢复状态中"}
    </span>
  );
}
