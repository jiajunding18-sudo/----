"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  KnowledgeConceptRelation,
  KnowledgeConceptView,
  KnowledgeView,
} from "./knowledge-model";

const depthLabels = {
  master: "必须掌握",
  understand: "理解即可",
  advanced: "后期深入",
} as const;

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
}: {
  readonly concepts: readonly KnowledgeConceptView[];
}) {
  return (
    <ol
      className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]"
      data-knowledge-results
    >
      {concepts.map((item) => (
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
                <span className="w-fit rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                  available · 正式内容
                </span>
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
      ))}
    </ol>
  );
}

export function KnowledgeBrowser({ knowledge }: { readonly knowledge: KnowledgeView }) {
  const [stageId, setStageId] = useState("all");
  const [trackId, setTrackId] = useState("all");
  const selectedStage = knowledge.stages.find(({ id }) => id === stageId);
  const selectedTrack = knowledge.tracks.find(({ id }) => id === trackId);
  const visibleConcepts = knowledge.concepts.filter(
    ({ stage, tracks }) =>
      (stageId === "all" || stage.id === stageId) &&
      (trackId === "all" || tracks.some(({ id }) => id === trackId)),
  );
  const isAll = stageId === "all" && trackId === "all";

  function resetFilters() {
    setStageId("all");
    setTrackId("all");
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
        <KnowledgeConceptList concepts={visibleConcepts} />
      ) : (
        <div
          className="mt-6 border-y border-[var(--color-border)] py-10"
          data-knowledge-empty-state
        >
          <h3 className="text-lg font-semibold">当前范围没有正式 Concept</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            {selectedStage?.contentStatus === "planned"
              ? `「${selectedStage.title}」路线已规划，但正式学习内容尚未展开。`
              : selectedTrack?.publishedConceptCount === 0
                ? `「${selectedTrack.title}」路线已规划，但目前没有已发布 Concept。`
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
