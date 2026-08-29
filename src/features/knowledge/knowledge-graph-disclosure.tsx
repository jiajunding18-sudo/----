"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { KnowledgeNeighborhood } from "./knowledge-graph-model";

const KnowledgeGraphCanvas = dynamic(
  () => import("./knowledge-graph-canvas"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-live="polite"
        className="flex h-56 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-5 text-sm text-[var(--color-muted)]"
      >
        正在准备知识关系图……
      </div>
    ),
  },
);

export function KnowledgeGraphDisclosure({
  neighborhood,
}: {
  readonly neighborhood: KnowledgeNeighborhood;
}) {
  const [expanded, setExpanded] = useState(false);
  const graphId = `knowledge-graph-${neighborhood.current.slug}`;

  return (
    <div data-knowledge-graph-disclosure>
      <button
        aria-controls={graphId}
        aria-expanded={expanded}
        className="inline-flex min-h-11 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)]"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? "收起邻域图" : "展开 1 跳邻域图"}
      </button>
      {expanded ? (
        <div className="mt-4 min-w-0" id={graphId}>
          <KnowledgeGraphCanvas
            ariaLabel={`${neighborhood.current.title} 的一跳知识关系图`}
            graph={neighborhood}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
          小屏默认不加载画布；上方等价列表已包含全部关系与导航。
        </p>
      )}
    </div>
  );
}
