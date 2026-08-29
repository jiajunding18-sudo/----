"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ConceptStatusLabel } from "@/features/progress/concept-status-label";
import { useLearningStore } from "@/features/progress/learning-store-provider";
import {
  selectConceptIdsByStatus,
  type ProgressStatusFilter,
} from "@/features/progress/progress-domain";
import type { DependencyKind } from "@/types";

import {
  selectGlobalKnowledgeGraphView,
  type GlobalKnowledgeGraphCatalog,
  type GlobalKnowledgeGraphScope,
  type GlobalKnowledgeGraphView,
  type KnowledgeGraphNode,
} from "./knowledge-graph-model";

const KnowledgeGraphCanvas = dynamic(
  () => import("./knowledge-graph-canvas"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-live="polite"
        className="flex h-56 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-5 text-sm text-[var(--color-muted)]"
      >
        正在准备当前 scope 的知识图……
      </div>
    ),
  },
);

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

function getScopeLabel(
  catalog: GlobalKnowledgeGraphCatalog,
  scope: GlobalKnowledgeGraphScope,
) {
  if (scope.kind === "published") return "全部已发布内容";
  if (scope.kind === "stage") {
    return catalog.stages.find(({ id }) => id === scope.id)?.title ?? scope.id;
  }
  return catalog.tracks.find(({ id }) => id === scope.id)?.title ?? scope.id;
}

function ConceptReference({ node }: { readonly node: KnowledgeGraphNode }) {
  return node.href ? (
    <Link
      className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
      href={node.href}
    >
      {node.title}
    </Link>
  ) : (
    <span className="font-semibold">{node.title}</span>
  );
}

function GlobalGraphEquivalentList({
  view,
}: {
  readonly view: GlobalKnowledgeGraphView;
}) {
  const nodesById = new Map(view.nodes.map((node) => [node.id, node]));
  const outgoingCounts = new Map<string, number>();
  for (const edge of view.edges) {
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1);
  }

  return (
    <section
      aria-labelledby="global-graph-list-title"
      className="mt-10"
      data-global-graph-equivalent-list
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Accessible equivalent
      </p>
      <h2 className="mt-2 text-2xl font-semibold" id="global-graph-list-title">
        当前图的等价列表
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
        节点与关系严格对应当前筛选后的图。无需操作画布，也能读取 Stage、Track、发布状态、个人进度和完整依赖方向。
      </p>

      <section aria-labelledby="global-graph-node-list-title" className="mt-7">
        <h3 className="text-lg font-semibold" id="global-graph-node-list-title">
          当前节点
        </h3>
        {view.nodes.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
            当前 scope 与筛选组合没有可显示的 Concept。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {view.nodes.map((node) => {
              const outgoingCount = outgoingCounts.get(node.id) ?? 0;
              return (
                <li
                  className="py-4"
                  data-global-graph-node-id={node.id}
                  key={node.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ConceptReference node={node} />
                    <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
                      {node.publicationStatus}
                    </span>
                    {node.publicationStatus === "published" ? (
                      <ConceptStatusLabel conceptId={node.id} />
                    ) : (
                      <span className="text-xs font-semibold text-[var(--color-muted)]">
                        不提供正式学习页面
                      </span>
                    )}
                    {outgoingCount > 1 ? (
                      <span className="rounded-full border border-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)]">
                        分支点 · {outgoingCount} 条后续
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                    Stage：{node.stage.title} · Track：
                    {node.tracks.map(({ title }) => title).join(" / ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="global-graph-edge-list-title" className="mt-8">
        <h3 className="text-lg font-semibold" id="global-graph-edge-list-title">
          依赖关系（前置 → 后续）
        </h3>
        {view.edges.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
            当前节点之间没有符合 dependency kind 筛选的直接关系。
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {view.edges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;

              return (
                <li
                  className="py-4"
                  data-dependency-kind={edge.kind}
                  data-global-graph-edge-id={edge.id}
                  key={edge.id}
                >
                  <p className="flex flex-wrap items-center gap-2 text-sm leading-6">
                    <ConceptReference node={source} />
                    <span aria-label="前置到后续">→</span>
                    <ConceptReference node={target} />
                    <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
                      {edge.kind === "hard"
                        ? "hard · 实线"
                        : "recommended · 虚线"}
                    </span>
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                    {edge.rationale}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </section>
  );
}

export function GlobalKnowledgeGraph({
  catalog,
}: {
  readonly catalog: GlobalKnowledgeGraphCatalog;
}) {
  const initialStageId =
    catalog.defaultScope.kind === "stage"
      ? catalog.defaultScope.id
      : (catalog.stages[0]?.id ?? "");
  const [scopeKind, setScopeKind] = useState<GlobalKnowledgeGraphScope["kind"]>(
    catalog.defaultScope.kind,
  );
  const [stageId, setStageId] = useState(initialStageId);
  const [trackId, setTrackId] = useState(catalog.tracks[0]?.id ?? "");
  const [showHard, setShowHard] = useState(true);
  const [showRecommended, setShowRecommended] = useState(true);
  const [statusFilter, setStatusFilter] =
    useState<ProgressStatusFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );
  const scope = useMemo<GlobalKnowledgeGraphScope>(
    () =>
      scopeKind === "stage"
        ? { kind: "stage", id: stageId }
        : scopeKind === "track"
          ? { kind: "track", id: trackId }
          : { kind: "published" },
    [scopeKind, stageId, trackId],
  );
  const dependencyKinds = useMemo(() => {
    const kinds = new Set<DependencyKind>();
    if (showHard) kinds.add("hard");
    if (showRecommended) kinds.add("recommended");
    return kinds;
  }, [showHard, showRecommended]);
  const scopeView = useMemo(
    () =>
      selectGlobalKnowledgeGraphView(catalog, {
        scope,
        dependencyKinds: new Set<DependencyKind>(["hard", "recommended"]),
      }),
    [catalog, scope],
  );
  const visibleConceptIds = useMemo(() => {
    if (statusFilter === "all") return undefined;
    const publishedIds = scopeView.nodes
      .filter(({ publicationStatus }) => publicationStatus === "published")
      .map(({ id }) => id);
    return new Set(
      selectConceptIdsByStatus(publishedIds, progress, statusFilter),
    );
  }, [progress, scopeView.nodes, statusFilter]);
  const view = useMemo(
    () =>
      selectGlobalKnowledgeGraphView(catalog, {
        scope,
        dependencyKinds,
        visibleConceptIds,
      }),
    [catalog, dependencyKinds, scope, visibleConceptIds],
  );
  const learningConceptId = hydrated
    ? selectConceptIdsByStatus(
        view.nodes
          .filter(({ publicationStatus }) => publicationStatus === "published")
          .map(({ id }) => id),
        progress,
        "learning",
      )[0]
    : undefined;
  const learningConcept = view.nodes.find(({ id }) => id === learningConceptId);
  const scopeLabel = getScopeLabel(catalog, scope);
  const canRenderGraph =
    view.density.status === "ready" && view.nodes.length > 0;

  function resetFilters() {
    setScopeKind(catalog.defaultScope.kind);
    if (catalog.defaultScope.kind === "stage") {
      setStageId(catalog.defaultScope.id);
    }
    setShowHard(true);
    setShowRecommended(true);
    setStatusFilter("all");
    setExpanded(false);
    setFocusRequestKey(0);
  }

  return (
    <section
      aria-labelledby="global-knowledge-graph-title"
      className="mt-10 min-w-0"
      data-density-status={view.density.status}
      data-global-knowledge-graph
      data-global-scope-kind={scope.kind}
    >
      <div className="max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Global graph · controlled density
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-[-0.03em]"
          id="global-knowledge-graph-title"
        >
          全局 Knowledge Graph
        </h1>
        <p className="mt-4 leading-7 text-[var(--color-muted)]">
          从一个正式 Stage、Track 或全部已发布内容观察知识关系。图只表达 Concept 与 dependency；阶段解释、项目门槛和出口标准仍由 Roadmap 负责。
        </p>
      </div>

      <form
        aria-label="全局 Knowledge Graph 筛选"
        className="mt-8 border-y border-[var(--color-border)] py-6"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset>
          <legend className="text-sm font-semibold">选择 scope</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["stage", "按 Stage"],
              ["track", "按 Track"],
              ["published", "已发布内容"],
            ] as const).map(([value, label]) => (
              <button
                aria-pressed={scopeKind === value}
                className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${
                  scopeKind === value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                }`}
                data-global-scope={value}
                key={value}
                onClick={() => setScopeKind(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold" htmlFor="global-graph-stage">
            Stage
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              disabled={scopeKind !== "stage"}
              id="global-graph-stage"
              onChange={(event) => {
                setStageId(event.target.value);
                setScopeKind("stage");
              }}
              value={stageId}
            >
              {catalog.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}（{stage.conceptCount} · {stage.contentStatus}）
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm font-semibold" htmlFor="global-graph-track">
            Track
            <select
              className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              disabled={scopeKind !== "track"}
              id="global-graph-track"
              onChange={(event) => {
                setTrackId(event.target.value);
                setScopeKind("track");
              }}
              value={trackId}
            >
              {catalog.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}（{track.conceptCount}）
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-semibold">Dependency kind</legend>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                <input
                  checked={showHard}
                  onChange={(event) => setShowHard(event.target.checked)}
                  type="checkbox"
                />
                hard · 实线
              </label>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                <input
                  checked={showRecommended}
                  onChange={(event) =>
                    setShowRecommended(event.target.checked)
                  }
                  type="checkbox"
                />
                recommended · 虚线
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">Learning status</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  aria-pressed={statusFilter === filter.value}
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${
                    statusFilter === filter.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                  }`}
                  data-global-status={filter.value}
                  disabled={!hydrated && filter.value !== "all"}
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <button
          className="mt-6 min-h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)]"
          onClick={resetFilters}
          type="button"
        >
          恢复默认 Stage scope
        </button>
      </form>

      <div
        aria-live="polite"
        className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
        data-global-graph-view
      >
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{scopeLabel}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            当前显示 {view.nodes.length} / {view.scopeNodeCount} 个 scope 节点、
            {view.edges.length} / {view.scopeEdgeCount} 条 scope 内关系。
            {view.hiddenNodeCount > 0 || view.hiddenEdgeCount > 0
              ? `筛选隐藏了 ${view.hiddenNodeCount} 个节点和 ${view.hiddenEdgeCount} 条边；正式数据未被修改。`
              : "当前未隐藏 scope 内关系。"}
          </p>
        </div>
        <p className="w-fit rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
          上限 {view.density.maxNodes} 节点 / {view.density.maxEdges} 边
        </p>
      </div>

      {view.density.status === "too-dense" ? (
        <div
          className="mt-6 border-l-2 border-[var(--color-accent)] bg-[var(--color-surface-subtle)] px-5 py-4"
          data-global-graph-density-warning
          role="status"
        >
          <h2 className="font-semibold">当前范围超过可读密度</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            画布不会抽样或删除真实关系。请选择更小的 Stage/Track、筛选学习状态，或关闭 recommended 边后再展开。
          </p>
        </div>
      ) : view.nodes.length === 0 ? (
        <div className="mt-6 border-y border-[var(--color-border)] py-8">
          <h2 className="font-semibold">当前范围没有可显示的 Concept</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            该 Stage/Track 可能仍是 planned，或当前 Progress 筛选没有命中；不会用占位节点伪造路线覆盖。
          </p>
        </div>
      ) : null}

      <section aria-labelledby="global-graph-canvas-title" className="mt-8 min-w-0">
        <h2 className="text-xl font-semibold" id="global-graph-canvas-title">
          关系画布
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          默认不加载大画布；先确认 scope 和筛选，再按需展开。当前学习位置通过文字和边框共同突出。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            aria-expanded={expanded}
            className="min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canRenderGraph}
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded ? "收起全局图" : "展开当前 scope 图"}
          </button>
          <button
            className="min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!expanded || !learningConcept}
            onClick={() => setFocusRequestKey((value) => value + 1)}
            type="button"
          >
            {learningConcept
              ? `定位当前学习位置：${learningConcept.title}`
              : "当前范围没有学习中节点"}
          </button>
        </div>
        {expanded && canRenderGraph ? (
          <div className="mt-4 min-w-0">
            <KnowledgeGraphCanvas
              ariaLabel={`${scopeLabel}的全局知识关系图`}
              focusConceptId={learningConcept?.id}
              focusRequestKey={focusRequestKey}
              graph={view}
              graphMode="global"
              highlightConceptId={learningConcept?.id}
            />
          </div>
        ) : null}
      </section>

      <GlobalGraphEquivalentList view={view} />
    </section>
  );
}
