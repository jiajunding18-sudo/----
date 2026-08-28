"use client";

import Link from "next/link";
import { useState } from "react";

import { ConceptStatusLabel } from "./concept-status-label";
import { useLearningStore } from "./learning-store-provider";
import {
  selectConceptIdsByStatus,
  summarizeStageProgress,
  type ProgressCatalog,
  type ProgressStatusFilter,
} from "./progress-domain";
import type { ProgressOverviewView } from "./progress-overview-model";

const filters: readonly {
  readonly value: ProgressStatusFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "learning", label: "学习中" },
  { value: "understood", label: "已理解" },
  { value: "mastered", label: "已掌握" },
  { value: "not_started", label: "未开始" },
];

const exactStatusLabels = {
  not_started: "未开始",
  learning: "学习中",
  understood: "已理解",
  mastered: "已掌握",
} as const;

export function ProgressOverview({
  catalog,
  overview,
}: {
  readonly catalog: ProgressCatalog;
  readonly overview: ProgressOverviewView;
}) {
  const [statusFilter, setStatusFilter] = useState<ProgressStatusFilter>("all");
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
      <section aria-busy="true" aria-labelledby="progress-overview-title" className="mt-8">
        <h2 className="text-2xl font-semibold" id="progress-overview-title">
          学习进度总览
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          正在恢复浏览器本地学习状态…
        </p>
      </section>
    );
  }

  const conceptIds = overview.concepts.map(({ id }) => id);
  const idsByStatus = {
    not_started: selectConceptIdsByStatus(conceptIds, progress, "not_started"),
    learning: selectConceptIdsByStatus(conceptIds, progress, "learning"),
    understood: selectConceptIdsByStatus(conceptIds, progress, "understood"),
    mastered: selectConceptIdsByStatus(conceptIds, progress, "mastered"),
  };
  const visibleIds = new Set(
    selectConceptIdsByStatus(conceptIds, progress, statusFilter),
  );
  const visibleConcepts = overview.concepts.filter(({ id }) => visibleIds.has(id));
  const continuingConcepts = overview.concepts.filter(({ id }) =>
    idsByStatus.learning.includes(id),
  );
  const availableStages = overview.stages.filter(
    ({ contentStatus }) => contentStatus === "available",
  );
  const plannedStages = overview.stages.filter(
    ({ contentStatus }) => contentStatus === "planned",
  );

  return (
    <section aria-labelledby="progress-overview-title" className="mt-8" data-progress-overview>
      <div className="max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Local learning progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="progress-overview-title">
          学习进度总览
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          四种状态互斥；接触、理解与掌握则是三个独立的累计视角。已掌握表示掌握证据完整，并由你主动确认。
        </p>
      </div>

      {persistenceStatus !== "ready" ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]" role="status">
          本地数据以安全默认状态显示：{persistenceMessage ?? persistenceStatus}
        </p>
      ) : null}

      <section aria-labelledby="continue-learning-title" className="mt-8 border-y border-[var(--color-border)] py-6">
        <h3 className="text-lg font-semibold" id="continue-learning-title">
          继续学习
        </h3>
        {continuingConcepts.length > 0 ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              以下是你已经主动开始、目前仍处于学习中的 Concept；顺序来自正式路线，不是推荐算法。
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-continue-learning-list>
              {continuingConcepts.map((concept) => (
                <li key={concept.id}>
                  <Link
                    className="block min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold hover:border-[var(--color-accent)]"
                    data-continue-concept-id={concept.id}
                    href={`/knowledge/${concept.slug}/`}
                  >
                    {concept.title}
                    <span className="mt-1 block text-xs font-normal text-[var(--color-muted)]">
                      {concept.stageTitle}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div data-no-continuing-concepts>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              当前没有正在学习的知识点。这里不会自动指定下一项。
            </p>
            <nav aria-label="浏览正式学习内容" className="mt-4 flex flex-wrap gap-3">
              <Link className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold" href="/roadmap/">
                浏览 Roadmap
              </Link>
              <Link className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold" href="/knowledge/">
                浏览 Knowledge
              </Link>
            </nav>
          </div>
        )}
      </section>

      <section aria-labelledby="concept-progress-title" className="mt-10">
        <h3 className="text-xl font-semibold" id="concept-progress-title">
          Concept 状态
        </h3>
        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(["not_started", "learning", "understood", "mastered"] as const).map(
            (status) => (
              <div className="border-l-2 border-[var(--color-border)] pl-4" key={status}>
                <dt className="text-xs font-semibold text-[var(--color-muted)]">
                  {exactStatusLabels[status]}
                </dt>
                <dd className="mt-1 text-xl font-semibold" data-overview-status-count={status}>
                  {idsByStatus[status].length}
                </dd>
              </div>
            ),
          )}
        </dl>

        <nav aria-label="按学习状态筛选 Concept" className="mt-6 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              aria-pressed={statusFilter === filter.value}
              className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${
                statusFilter === filter.value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
              }`}
              data-progress-filter={filter.value}
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </nav>

        <p aria-live="polite" className="mt-4 text-sm text-[var(--color-muted)]">
          当前显示 {visibleConcepts.length} 个正式 Concept
        </p>
        {visibleConcepts.length > 0 ? (
          <ol className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]" data-progress-concept-results>
            {visibleConcepts.map((concept) => (
              <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4" data-progress-concept-id={concept.id} key={concept.id}>
                <div className="min-w-0">
                  <Link className="font-semibold underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]" href={`/knowledge/${concept.slug}/`}>
                    {concept.title}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {concept.englishTitle} · {concept.stageTitle}
                  </p>
                </div>
                <ConceptStatusLabel conceptId={concept.id} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 border-y border-[var(--color-border)] py-8 text-sm text-[var(--color-muted)]" data-progress-filter-empty>
            当前没有处于“{filters.find(({ value }) => value === statusFilter)?.label}”状态的正式 Concept。
          </p>
        )}
      </section>

      <section aria-labelledby="stage-progress-title" className="mt-12">
        <h3 className="text-xl font-semibold" id="stage-progress-title">
          Stage 学习情况
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          只统计当前已发布的必修 Concept；接触、理解、掌握不会合并成单一完成率。
        </p>
        <div className="mt-5 space-y-5">
          {availableStages.map((stage) => {
            const summary = summarizeStageProgress(
              catalog.concepts,
              progress,
              stage.id,
            );

            return (
              <article className="border-y border-[var(--color-border)] py-5" data-stage-progress={stage.id} key={stage.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-semibold">{stage.title}</h4>
                  <p className="text-xs text-[var(--color-muted)]">
                    {summary.total > 0 ? `${summary.total} 个正式必修 Concept` : "暂无必修内容"}
                  </p>
                </div>
                {summary.total > 0 ? (
                  <>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                      <div><dt className="text-[var(--color-muted)]">未开始</dt><dd className="font-semibold" data-stage-status="not_started">{summary.notStarted}</dd></div>
                      <div><dt className="text-[var(--color-muted)]">学习中</dt><dd className="font-semibold" data-stage-status="learning">{summary.learning}</dd></div>
                      <div><dt className="text-[var(--color-muted)]">已理解</dt><dd className="font-semibold" data-stage-status="understood">{summary.understoodOnly}</dd></div>
                      <div><dt className="text-[var(--color-muted)]">已掌握</dt><dd className="font-semibold" data-stage-status="mastered">{summary.mastered}</dd></div>
                    </dl>
                    <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="border-l-2 border-[var(--color-border)] pl-4"><dt className="text-xs font-semibold text-[var(--color-muted)]">接触</dt><dd className="mt-1 text-lg font-semibold" data-stage-metric="started">{summary.started} / {summary.total}</dd></div>
                      <div className="border-l-2 border-[var(--color-border)] pl-4"><dt className="text-xs font-semibold text-[var(--color-muted)]">理解</dt><dd className="mt-1 text-lg font-semibold" data-stage-metric="understood">{summary.understood} / {summary.total}</dd></div>
                      <div className="border-l-2 border-[var(--color-border)] pl-4"><dt className="text-xs font-semibold text-[var(--color-muted)]">掌握</dt><dd className="mt-1 text-lg font-semibold" data-stage-metric="mastered">{summary.mastered} / {summary.total}</dd></div>
                    </dl>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>

        {plannedStages.length > 0 ? (
          <details className="mt-6" data-planned-stages>
            <summary className="w-fit cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold marker:text-[var(--color-accent)]">
              查看 {plannedStages.length} 个已规划 Stage
            </summary>
            <ul className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {plannedStages.map((stage) => (
                <li className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]" key={stage.id}>
                  <span className="font-semibold">{stage.title}</span>
                  <span className="text-[var(--color-muted)]">已规划 · 正式学习内容尚未展开</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </section>
  );
}
