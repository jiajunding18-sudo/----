"use client";

import Link from "next/link";
import { useState } from "react";

import { ConceptStatusLabel } from "@/features/progress/concept-status-label";
import { useLearningStore } from "@/features/progress/learning-store-provider";
import {
  selectConceptIdsByStatus,
  type ProgressStatusFilter,
} from "@/features/progress/progress-domain";

import type {
  KnowledgeConceptRelation,
  KnowledgeConceptView,
  KnowledgeView,
} from "./knowledge-model";
import type { ConceptProgress, UserDifficulty } from "@/types";

const depthLabels = {
  master: "必须掌握",
  understand: "理解即可",
  advanced: "后期深入",
} as const;

const statusFilters: readonly {
  readonly value: ProgressStatusFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "not_started", label: "未开始" },
  { value: "learning", label: "学习中" },
  { value: "understood", label: "已理解" },
  { value: "mastered", label: "已掌握" },
];

const userDifficultyLabels: Readonly<Record<UserDifficulty, string>> = {
  1: "很容易",
  2: "较容易",
  3: "适中",
  4: "较难",
  5: "很难",
};

function PrerequisiteSummary({
  prerequisites,
}: {
  readonly prerequisites: KnowledgeConceptView["prerequisites"];
}) {
  const hard = prerequisites.filter(({ kind }) => kind === "hard");
  const recommended = prerequisites.filter(
    ({ kind }) => kind === "recommended",
  );

  function renderRelations(relations: readonly KnowledgeConceptRelation[]) {
    return relations.map(({ concept }, index) => (
      <span key={concept.id}>
        {index > 0 ? "、" : ""}
        {concept.href ? (
          <Link
            className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
            href={concept.href}
          >
            {concept.title}
          </Link>
        ) : (
          `${concept.title}（尚未发布）`
        )}
      </span>
    ));
  }

  return (
    <div className="mt-4 grid gap-2 text-xs leading-5 text-[var(--color-muted)] sm:grid-cols-2">
      <p data-dependency-kind="hard">
        <span className="font-semibold text-[var(--color-ink)]">hard 前置：</span>
        {hard.length > 0 ? renderRelations(hard) : "无，可作为当前 DAG 的起点或并行入口"}
      </p>
      <p data-dependency-kind="recommended">
        <span className="font-semibold text-[var(--color-ink)]">
          recommended：
        </span>
        {recommended.length > 0 ? renderRelations(recommended) : "无"}
      </p>
    </div>
  );
}

function KnowledgeConceptList({
  concepts,
  hydrated,
  progress,
}: {
  readonly concepts: readonly KnowledgeConceptView[];
  readonly hydrated: boolean;
  readonly progress: Readonly<Record<string, ConceptProgress>>;
}) {
  return (
    <ol
      className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]"
      data-knowledge-results
    >
      {concepts.map((item) => {
        const personal = progress[item.concept.id];
        return (
          <li
            className="py-6"
            data-concept-order={item.concept.order}
            data-knowledge-concept-id={item.concept.id}
            key={item.concept.id}
          >
            <article className="grid min-w-0 gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
              <p className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
                {String(item.recommendedSequence).padStart(2, "0")}
              </p>
              <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">
                    <Link
                      className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                      href={`/knowledge/${item.concept.slug}/`}
                    >
                      {item.concept.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {item.concept.englishTitle}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <ConceptStatusLabel conceptId={item.concept.id} />
                  {hydrated && personal?.favorite ? (
                    <span
                      className="w-fit rounded-full border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]"
                      data-knowledge-favorite="true"
                    >
                      已收藏
                    </span>
                  ) : null}
                  {hydrated && personal?.userDifficulty ? (
                    <span
                      className="w-fit rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]"
                      data-knowledge-user-difficulty={personal.userDifficulty}
                    >
                      个人难度 {personal.userDifficulty} ·{" "}
                      {userDifficultyLabels[personal.userDifficulty]}
                    </span>
                  ) : null}
                  <span className="w-fit rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                    available · 正式内容
                  </span>
                </div>
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                {item.concept.summary}
              </p>
              <p className="mt-3 text-sm leading-6">
                <span className="font-semibold">本单元目标：</span>
                {item.concept.learningOutcome}
              </p>

              <dl className="mt-4 grid gap-x-5 gap-y-2 text-xs leading-5 text-[var(--color-muted)] sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-semibold text-[var(--color-ink)]">Stage</dt>
                  <dd>{item.stage.title}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--color-ink)]">Track</dt>
                  <dd>{item.tracks.map(({ title }) => title).join(" / ")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--color-ink)]">学习深度</dt>
                  <dd>{depthLabels[item.concept.targetDepth]}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--color-ink)]">预计时间</dt>
                  <dd>
                    {item.concept.estimatedHours.min}–
                    {item.concept.estimatedHours.max} 小时
                  </dd>
                </div>
              </dl>

                <PrerequisiteSummary prerequisites={item.prerequisites} />
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

export function KnowledgeBrowser({
  knowledge,
}: {
  readonly knowledge: KnowledgeView;
}) {
  const [stageId, setStageId] = useState("all");
  const [trackId, setTrackId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProgressStatusFilter>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );
  const selectedStage = knowledge.stages.find(({ id }) => id === stageId);
  const selectedTrack = knowledge.tracks.find(({ id }) => id === trackId);
  const statusConceptIds = new Set(
    selectConceptIdsByStatus(
      knowledge.concepts.map(({ concept }) => concept.id),
      progress,
      statusFilter,
    ),
  );
  const visibleConcepts = knowledge.concepts.filter(
    ({ concept, stage, tracks }) =>
      (stageId === "all" || stage.id === stageId) &&
      (trackId === "all" || tracks.some(({ id }) => id === trackId)) &&
      statusConceptIds.has(concept.id) &&
      (!favoriteOnly || progress[concept.id]?.favorite === true),
  );
  const isAll =
    stageId === "all" &&
    trackId === "all" &&
    statusFilter === "all" &&
    !favoriteOnly;

  function resetFilters() {
    setStageId("all");
    setTrackId("all");
    setStatusFilter("all");
    setFavoriteOnly(false);
  }

  return (
    <section aria-labelledby="knowledge-browser-title" className="mt-10">
      <div className="max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Published knowledge catalog
        </p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-[-0.03em]"
          id="knowledge-browser-title"
        >
          正式知识目录
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          推荐序位来自 Stage 与 Concept 的正式 order；真正的前置条件来自 dependency DAG。没有 hard 关系的节点可以并行学习，recommended 只表示有帮助的准备。
        </p>
      </div>

      <nav aria-label="Knowledge 浏览筛选" className="mt-6 border-y border-[var(--color-border)] py-5">
        <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <button
            aria-pressed={isAll}
            className={`min-h-11 rounded-md border px-4 text-sm font-semibold ${
              isAll
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
            }`}
            data-knowledge-filter="all"
            onClick={resetFilters}
            type="button"
          >
            全部知识
          </button>

          <label className="min-w-0 text-sm font-semibold" htmlFor="knowledge-stage-filter">
            按 Stage 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal text-[var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="knowledge-stage-filter"
              onChange={(event) => setStageId(event.target.value)}
              value={stageId}
            >
              <option value="all">全部 Stage（{knowledge.concepts.length}）</option>
              {knowledge.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}（{stage.publishedConceptCount}
                  {stage.contentStatus === "planned" ? " · planned" : ""}）
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-semibold" htmlFor="knowledge-track-filter">
            按 Track 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal text-[var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="knowledge-track-filter"
              onChange={(event) => setTrackId(event.target.value)}
              value={trackId}
            >
              <option value="all">全部 Track（{knowledge.concepts.length}）</option>
              {knowledge.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}（{track.publishedConceptCount}）
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">按学习状态浏览</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                aria-pressed={statusFilter === filter.value}
                className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${
                  statusFilter === filter.value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                }`}
                data-knowledge-status-filter={filter.value}
                disabled={!hydrated}
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          {!hydrated ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]" role="status">
              正在恢复本地学习状态…
            </p>
          ) : null}
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">个人标记</legend>
          <button
            aria-pressed={favoriteOnly}
            className={`mt-2 min-h-10 rounded-md border px-4 text-sm font-semibold ${
              favoriteOnly
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
            }`}
            data-knowledge-favorite-filter
            disabled={!hydrated}
            onClick={() => setFavoriteOnly((value) => !value)}
            type="button"
          >
            仅看收藏
          </button>
        </fieldset>
      </nav>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          当前 catalog：{knowledge.availableStageCount} 个 Stage 已有正式内容，
          {knowledge.plannedStageCount} 个 Stage 为 planned。planned Stage 不计入可学习知识结果，也不会生成 Concept 页面。
        </p>
        <p
          aria-live="polite"
          className="w-fit rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]"
          data-knowledge-result-count={visibleConcepts.length}
        >
          {visibleConcepts.length} 个正式 Concept
        </p>
      </div>

      {visibleConcepts.length > 0 ? (
        <KnowledgeConceptList
          concepts={visibleConcepts}
          hydrated={hydrated}
          progress={progress}
        />
      ) : (
        <div
          className="mt-6 border-y border-[var(--color-border)] py-10"
          data-knowledge-empty-state
        >
          <h3 className="text-lg font-semibold">当前范围没有正式 Concept</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            {favoriteOnly
              ? "当前筛选范围没有已收藏的正式 Concept。"
              : selectedStage?.contentStatus === "planned"
              ? `「${selectedStage.title}」路线已规划，但正式学习内容尚未展开。`
              : selectedTrack?.publishedConceptCount === 0
                ? `「${selectedTrack.title}」路线已规划，但目前没有已发布 Concept。`
                : statusFilter !== "all"
                  ? `当前范围没有处于“${statusFilters.find(({ value }) => value === statusFilter)?.label}”的正式 Concept；调整状态筛选或返回全部知识。`
                  : "当前 Stage 与 Track 组合没有共同的已发布 Concept；调整一个筛选条件或返回全部知识。"}
          </p>
          <button
            className="mt-5 min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)]"
            onClick={resetFilters}
            type="button"
          >
            返回全部知识
          </button>
        </div>
      )}
    </section>
  );
}
