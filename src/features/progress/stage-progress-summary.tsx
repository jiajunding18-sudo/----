"use client";

import { useLearningStore } from "./learning-store-provider";
import {
  summarizeStageProgress,
  type ProgressConceptDefinition,
} from "./progress-domain";

export function StageProgressSummary({
  concepts,
  stageId,
}: {
  readonly concepts: readonly ProgressConceptDefinition[];
  readonly stageId: string;
}) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const persistenceMessage = useLearningStore(
    ({ persistenceMessage }) => persistenceMessage,
  );
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );

  if (!hydrated) {
    return (
      <p className="mt-6 text-sm text-[var(--color-muted)]">
        正在恢复浏览器本地学习状态…
      </p>
    );
  }

  const summary = summarizeStageProgress(concepts, progress, stageId);
  return (
    <section aria-labelledby="stage-progress-title" className="mt-8" data-stage-progress>
      <h2 className="text-lg font-semibold" id="stage-progress-title">
        Stage 0 本地进度
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="border-l-2 border-[var(--color-border)] pl-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">接触</dt>
          <dd className="mt-1 text-xl font-semibold">
            {summary.started} / {summary.total}
          </dd>
        </div>
        <div className="border-l-2 border-[var(--color-border)] pl-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">理解</dt>
          <dd className="mt-1 text-xl font-semibold">
            {summary.understood} / {summary.total}
          </dd>
        </div>
        <div className="border-l-2 border-[var(--color-border)] pl-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">掌握</dt>
          <dd className="mt-1 text-xl font-semibold">
            {summary.mastered} / {summary.total}
          </dd>
        </div>
      </dl>
      {persistenceStatus !== "ready" ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]" role="status">
          本地数据以安全默认状态显示：{persistenceMessage ?? persistenceStatus}
        </p>
      ) : null}
    </section>
  );
}
