"use client";

import dagre from "@dagrejs/dagre";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import {
  learningStatusLabels,
} from "@/features/progress/concept-status-label";
import { useLearningStore } from "@/features/progress/learning-store-provider";
import { getConceptStatus } from "@/features/progress/progress-domain";

import type {
  KnowledgeGraphData,
  KnowledgeGraphNode,
} from "./knowledge-graph-model";

const nodeWidth = 244;
const nodeHeight = 166;

type ConceptNodeData = {
  readonly concept: KnowledgeGraphNode;
  readonly graphMode: "global" | "neighborhood";
  readonly isLearningFocus: boolean;
  readonly outgoingCount: number;
};

type ConceptFlowNode = Node<ConceptNodeData, "concept">;

const publicationLabels: Readonly<
  Record<KnowledgeGraphNode["publicationStatus"], string>
> = {
  draft: "draft · 暂无正式页面",
  hidden: "hidden · 暂不公开",
  published: "published · 正式内容",
  retired: "retired · 已退出路线",
};

function ConceptGraphNode({ data }: NodeProps<ConceptFlowNode>) {
  const { concept, graphMode, isLearningFocus, outgoingCount } = data;
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );
  const status =
    concept.publicationStatus === "published" && hydrated
      ? getConceptStatus(progress, concept.id)
      : undefined;

  return (
    <div
      className={`h-[166px] w-[244px] rounded-lg border bg-[var(--color-surface)] p-4 shadow-sm ${
        concept.isCurrent || isLearningFocus
          ? "border-2 border-[var(--color-accent)] ring-4 ring-[var(--color-accent-soft)]"
          : concept.publicationStatus === "published"
            ? "border-[var(--color-border)]"
            : "border-2 border-dashed border-[var(--color-muted)]"
      }`}
      data-graph-concept-id={concept.id}
      data-graph-current={concept.isCurrent ? "true" : "false"}
      data-graph-learning-focus={isLearningFocus ? "true" : "false"}
      data-graph-progress-status={status ?? "not-applicable"}
      data-graph-publication-status={concept.publicationStatus}
    >
      <Handle
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--color-surface)] !bg-[var(--color-muted)]"
        isConnectable={false}
        position={Position.Left}
        type="target"
      />
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="text-[0.66rem] font-bold tracking-[0.1em] text-[var(--color-accent)] uppercase">
          {concept.isCurrent
            ? "当前 Concept"
            : isLearningFocus
              ? "当前学习位置"
              : outgoingCount > 1
                ? `分支点 · ${outgoingCount} 条后续`
                : graphMode === "global"
                  ? "路线节点"
                  : "1 跳关系"}
        </p>
        <span className="shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-[var(--color-muted)]">
          {concept.publicationStatus}
        </span>
      </div>
      {concept.href ? (
        <Link
          className="nodrag nopan mt-2 block text-sm font-bold leading-5 text-[var(--color-ink)] underline decoration-[var(--color-border)] underline-offset-4 hover:text-[var(--color-accent)]"
          href={concept.href}
        >
          {concept.title}
        </Link>
      ) : (
        <p className="mt-2 text-sm font-bold leading-5 text-[var(--color-ink)]">
          {concept.title}
        </p>
      )}
      <p className="mt-2 line-clamp-2 text-[0.68rem] leading-4 text-[var(--color-muted)]">
        {concept.stage.title}
      </p>
      <p className="mt-1 truncate text-[0.68rem] leading-4 text-[var(--color-muted)]">
        {concept.tracks.map(({ title }) => title).join(" / ")}
      </p>
      <p className="mt-2 text-[0.68rem] font-semibold text-[var(--color-muted)]">
        {concept.publicationStatus === "published"
          ? hydrated && status
            ? `学习状态：${learningStatusLabels[status]}`
            : "学习状态：恢复中"
          : publicationLabels[concept.publicationStatus]}
      </p>
      <Handle
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--color-surface)] !bg-[var(--color-muted)]"
        isConnectable={false}
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

const nodeTypes = { concept: ConceptGraphNode } as const;

function layoutKnowledgeGraph(
  graph: KnowledgeGraphData,
  graphMode: "global" | "neighborhood",
  highlightConceptId?: string,
) {
  const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layout.setGraph({
    rankdir: "LR",
    ranksep: 96,
    nodesep: 42,
    edgesep: 24,
    marginx: 28,
    marginy: 28,
  });

  for (const node of graph.nodes) {
    layout.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const edge of graph.edges) {
    layout.setEdge(edge.source, edge.target);
  }
  dagre.layout(layout);

  const outgoingCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1);
  }
  const nodes: ConceptFlowNode[] = graph.nodes.map((concept) => {
    const position = layout.node(concept.id) as { x: number; y: number };
    return {
      id: concept.id,
      type: "concept",
      data: {
        concept,
        graphMode,
        isLearningFocus: concept.id === highlightConceptId,
        outgoingCount: outgoingCounts.get(concept.id) ?? 0,
      },
      position: {
        x: position.x - nodeWidth / 2,
        y: position.y - nodeHeight / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
      connectable: false,
      selectable: true,
      focusable: false,
      ariaLabel: `${concept.isCurrent ? "当前 Concept，" : ""}${concept.title}，${concept.stage.title}，${publicationLabels[concept.publicationStatus]}`,
    };
  });
  const titlesById = new Map(
    graph.nodes.map(({ id, title }) => [id, title]),
  );
  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.kind,
    ariaLabel: `${edge.kind} dependency：${titlesById.get(edge.source)} 前置于 ${titlesById.get(edge.target)}`,
    focusable: false,
    selectable: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: {
      stroke: edge.kind === "hard" ? "#245640" : "#627169",
      strokeWidth: edge.kind === "hard" ? 2.4 : 2,
      strokeDasharray: edge.kind === "recommended" ? "7 5" : undefined,
    },
    labelStyle: {
      fill: "#17211b",
      fontSize: 11,
      fontWeight: 700,
    },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.94 },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 4,
  }));

  return { nodes, edges };
}

function GraphViewportFocus({
  conceptId,
  requestKey,
}: {
  readonly conceptId?: string;
  readonly requestKey: number;
}) {
  const { fitView } = useReactFlow<ConceptFlowNode>();

  useEffect(() => {
    if (!conceptId || requestKey === 0) return;
    void fitView({
      nodes: [{ id: conceptId }],
      padding: 1.2,
      minZoom: 0.7,
      maxZoom: 1.05,
      duration: 0,
    });
  }, [conceptId, fitView, requestKey]);

  return null;
}

export default function KnowledgeGraphCanvas({
  ariaLabel,
  focusConceptId,
  focusRequestKey = 0,
  graph,
  graphMode = "neighborhood",
  highlightConceptId,
}: {
  readonly ariaLabel: string;
  readonly focusConceptId?: string;
  readonly focusRequestKey?: number;
  readonly graph: KnowledgeGraphData;
  readonly graphMode?: "global" | "neighborhood";
  readonly highlightConceptId?: string;
}) {
  const layoutedGraph = useMemo(
    () => layoutKnowledgeGraph(graph, graphMode, highlightConceptId),
    [graph, graphMode, highlightConceptId],
  );

  return (
    <div
      aria-label={ariaLabel}
      className="h-[31rem] min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] sm:h-[34rem]"
      data-graph-edge-ids={graph.edges.map(({ id }) => id).join("|")}
      data-graph-node-ids={graph.nodes.map(({ id }) => id).join("|")}
      data-knowledge-graph-canvas
      data-knowledge-graph-mode={graphMode}
      role="region"
    >
      <ReactFlow
        aria-label={`${ariaLabel}；完整关系可使用页面中的等价文本列表`}
        edges={layoutedGraph.edges}
        edgesFocusable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.05 }}
        maxZoom={1.5}
        minZoom={0.25}
        nodeTypes={nodeTypes}
        nodes={layoutedGraph.nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        nodesFocusable={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        zoomOnScroll={false}
      >
        <GraphViewportFocus
          conceptId={focusConceptId}
          requestKey={focusRequestKey}
        />
        <Background color="#c7d2ca" gap={24} size={1} variant={BackgroundVariant.Dots} />
        <Controls
          aria-label="知识关系图缩放控制"
          fitViewOptions={{ padding: 0.16, maxZoom: 1.05 }}
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
