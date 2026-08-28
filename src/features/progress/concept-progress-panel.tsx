"use client";

import { useMemo, useState } from "react";

import { useLearningStore } from "./learning-store-provider";
import {
  getConceptStatus,
  satisfiesHardPrerequisite,
} from "./progress-domain";

const statusLabels = {
  not_started: "未学习",
  learning: "学习中",
  understood: "已理解",
  mastered: "已掌握",
} as const;

export function ConceptProgressPanel({
  conceptId,
  hardPrerequisites,
}: {
  readonly conceptId: string;
  readonly hardPrerequisites: readonly {
    readonly id: string;
    readonly title: string;
  }[];
}) {
  const [actionMessage, setActionMessage] = useState("");
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
  const startConcept = useLearningStore((state) => state.startConcept);
  const markUnderstood = useLearningStore((state) => state.markUnderstood);
  const status = getConceptStatus(progress, conceptId);
  const missingHard = useMemo(
    () =>
      hardPrerequisites.filter(
        ({ id }) => !satisfiesHardPrerequisite(getConceptStatus(progress, id)),
      ),
    [hardPrerequisites, progress],
  );
  const writesBlocked = persistenceStatus === "blocked";

  async function runAction(
    action: () => ReturnType<typeof startConcept>,
    successMessage: string,
  ) {
    const result = await action();
    setActionMessage(result.ok ? successMessage : result.message);
  }

  return (
    <section
      aria-labelledby="concept-progress-title"
      className="mt-6 border-y border-[var(--color-border)] py-5"
      data-concept-progress
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-accent)] uppercase">
            Local progress · Phase 4A
          </p>
          <h2 className="mt-2 text-lg font-semibold" id="concept-progress-title">
            学习状态
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {hydrated
              ? `当前：${statusLabels[status]}`
              : "正在从浏览器本地存储恢复状态…"}
          </p>
        </div>

        {hydrated && !writesBlocked ? (
          <div className="flex flex-wrap gap-2">
            {status === "not_started" ? (
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white"
                onClick={() =>
                  void runAction(
                    () => startConcept(conceptId),
                    "已记录为学习中，并保存到当前浏览器。",
                  )
                }
                type="button"
              >
                开始学习
              </button>
            ) : null}
            {status === "learning" ? (
              <button
                className="min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] disabled:cursor-not-allowed disabled:text-[var(--color-muted)]"
                disabled={missingHard.length > 0}
                onClick={() =>
                  void runAction(
                    () => markUnderstood(conceptId),
                    "已确认理解，并保存到当前浏览器。",
                  )
                }
                type="button"
              >
                确认已理解
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {missingHard.length > 0 && status === "learning" ? (
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          尚不能确认 understood；hard 前置未满足：
          {missingHard.map(({ title }) => title).join("、")}。
        </p>
      ) : null}
      {status === "understood" ? (
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          mastered 不会自动授予；需要通过证据覆盖全部必需标准并再次主动确认。
        </p>
      ) : null}
      {hydrated && persistenceStatus !== "ready" ? (
        <p
          className="mt-3 text-sm leading-6 text-[var(--color-muted)]"
          role="status"
        >
          本地持久化状态：{persistenceMessage ?? persistenceStatus}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm" data-progress-action-message>
        {actionMessage}
      </p>
    </section>
  );
}
