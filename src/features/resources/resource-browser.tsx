"use client";

import { useState } from "react";

import { ResourceSummary } from "./resource-summary";
import type { ResourceCatalogView } from "./resource-model";

const typeLabels = {
  "official-doc": "官方文档",
  course: "公开课程",
  book: "教材 / 书籍",
  repository: "开源项目",
  video: "视频",
  article: "文章",
  paper: "论文",
  dataset: "Dataset",
} as const;

const levelLabels = {
  beginner: "入门",
  intermediate: "中级",
  advanced: "高级",
} as const;

export function ResourceBrowser({ view }: { readonly view: ResourceCatalogView }) {
  const [type, setType] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [trackId, setTrackId] = useState("all");
  const [level, setLevel] = useState("all");
  const [conceptId, setConceptId] = useState("all");
  const resourceTypes = [...new Set(view.resources.map(({ resource }) => resource.type))];
  const levels = [...new Set(view.resources.map(({ resource }) => resource.level))];
  const visibleResources = view.resources.filter(
    (item) =>
      (type === "all" || item.resource.type === type) &&
      (stageId === "all" || item.stages.some(({ id }) => id === stageId)) &&
      (trackId === "all" || item.tracks.some(({ id }) => id === trackId)) &&
      (level === "all" || item.resource.level === level) &&
      (conceptId === "all" ||
        item.concepts.some(({ concept }) => concept.id === conceptId)),
  );
  const isAll =
    type === "all" &&
    stageId === "all" &&
    trackId === "all" &&
    level === "all" &&
    conceptId === "all";

  function resetFilters() {
    setType("all");
    setStageId("all");
    setTrackId("all");
    setLevel("all");
    setConceptId("all");
  }

  return (
    <section aria-labelledby="resources-browser-title" className="mt-10">
      <div className="max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Curated resource catalog
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]" id="resources-browser-title">
          正式资源目录
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          默认先列出 essential，再按来源优先级排列。Stage、Track 与相关主题均从 Concept / Project 的正式关系反向派生。
        </p>
      </div>

      <nav aria-label="Resources 浏览筛选" className="mt-6 border-y border-[var(--color-border)] py-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            aria-pressed={isAll}
            className={`min-h-11 rounded-md border px-4 text-sm font-semibold ${
              isAll
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
            }`}
            data-resource-filter="all"
            onClick={resetFilters}
            type="button"
          >
            全部资源
          </button>

          <label className="min-w-0 text-sm font-semibold" htmlFor="resource-type-filter">
            按 Type 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="resource-type-filter"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              <option value="all">全部 Type（{view.resources.length}）</option>
              {resourceTypes.map((resourceType) => (
                <option key={resourceType} value={resourceType}>
                  {typeLabels[resourceType]}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-semibold" htmlFor="resource-stage-filter">
            按 Stage 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="resource-stage-filter"
              onChange={(event) => setStageId(event.target.value)}
              value={stageId}
            >
              <option value="all">全部相关 Stage</option>
              {view.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.title}</option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-semibold" htmlFor="resource-track-filter">
            按 Track 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="resource-track-filter"
              onChange={(event) => setTrackId(event.target.value)}
              value={trackId}
            >
              <option value="all">全部相关 Track</option>
              {view.tracks.map((track) => (
                <option key={track.id} value={track.id}>{track.title}</option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-semibold" htmlFor="resource-level-filter">
            按 Difficulty 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="resource-level-filter"
              onChange={(event) => setLevel(event.target.value)}
              value={level}
            >
              <option value="all">全部难度</option>
              {levels.map((resourceLevel) => (
                <option key={resourceLevel} value={resourceLevel}>
                  {levelLabels[resourceLevel]}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-semibold" htmlFor="resource-concept-filter">
            按 Related Concept 浏览
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="resource-concept-filter"
              onChange={(event) => setConceptId(event.target.value)}
              value={conceptId}
            >
              <option value="all">全部相关 Concept</option>
              {view.concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>{concept.title}</option>
              ))}
            </select>
          </label>
        </div>
      </nav>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          仅展示正式 catalog 数据；链接状态不是用户评分，也不自动推断质量。
        </p>
        <p
          aria-live="polite"
          className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]"
          data-resource-result-count={visibleResources.length}
        >
          {visibleResources.length} 个正式 Resource
        </p>
      </div>

      {visibleResources.length > 0 ? (
        <div className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {visibleResources.map((item) => (
            <ResourceSummary item={item} key={item.resource.id} />
          ))}
        </div>
      ) : (
        <div className="mt-6 border-y border-[var(--color-border)] py-10" data-resource-empty-state>
          <h3 className="text-lg font-semibold">当前组合没有正式 Resource</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            调整一个筛选条件，或返回全部资源；这里不会用草稿或虚假关系填充结果。
          </p>
          <button
            className="mt-5 min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)]"
            onClick={resetFilters}
            type="button"
          >
            返回全部资源
          </button>
        </div>
      )}
    </section>
  );
}
