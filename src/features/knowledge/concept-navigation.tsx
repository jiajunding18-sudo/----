import Link from "next/link";

import { ConceptStatusLabel } from "@/features/progress/concept-status-label";

import { KnowledgeGraphDisclosure } from "./knowledge-graph-disclosure";
import type {
  KnowledgeConceptView,
} from "./knowledge-model";
import type {
  KnowledgeGraphRelation,
  KnowledgeNeighborhood,
} from "./knowledge-graph-model";

function RelationList({
  emptyText,
  relations,
  role,
}: {
  readonly emptyText: string;
  readonly relations: readonly KnowledgeGraphRelation[];
  readonly role: "prerequisite" | "dependent";
}) {
  if (relations.length === 0) {
    return (
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
      {relations.map(({ concept, edge }) => (
        <li
          className="py-4"
          data-dependency-kind={edge.kind}
          data-graph-edge-id={edge.id}
          data-related-concept-id={concept.id}
          key={edge.id}
        >
          <div className="flex flex-wrap items-center gap-2">
            {concept.href ? (
              <Link
                className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
                href={concept.href}
              >
                {concept.title}
              </Link>
            ) : (
              <span className="font-semibold">{concept.title}</span>
            )}
            <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
              {role === "prerequisite"
                ? edge.kind === "hard"
                  ? "hard · 必须前置"
                  : "recommended · 建议前置"
                : edge.kind === "hard"
                  ? "本知识是其 hard 前置"
                  : "本知识是其 recommended 参考"}
            </span>
            {concept.publicationStatus === "published" ? (
              <ConceptStatusLabel conceptId={concept.id} />
            ) : null}
            {!concept.href ? (
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                {concept.publicationStatus} · 不提供正式学习页面
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            {edge.rationale}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ConceptNavigation({
  concept,
  neighborhood,
}: {
  readonly concept: KnowledgeConceptView;
  readonly neighborhood: KnowledgeNeighborhood;
}) {
  return (
    <section
      aria-labelledby="concept-navigation-title"
      className="mb-10 border-y border-[var(--color-border)] py-6"
      data-concept-navigation
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
            Knowledge context
          </p>
          <h2 className="mt-2 text-xl font-semibold" id="concept-navigation-title">
            这项知识在路线中的位置
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {concept.stage.title} · {concept.tracks.map(({ title }) => title).join(" / ")} · 推荐序位 {String(concept.recommendedSequence).padStart(2, "0")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:max-w-72 sm:justify-end">
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:border-[var(--color-accent)]"
            href={`/roadmap/#roadmap-stage-${concept.stage.id}`}
          >
            在 Roadmap 查看对应 Stage
          </Link>
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:border-[var(--color-accent)]"
            data-concept-graph-link
            href="#concept-knowledge-graph-title"
          >
            查看当前知识关系
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="concept-prerequisites-title">
          <h3 className="text-base font-semibold" id="concept-prerequisites-title">
            前置知识
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            hard 决定 DAG 就绪关系；recommended 只提供更平滑的学习准备，不会阻止访问当前正文。
          </p>
          <RelationList
            emptyText="没有 dependency 前置；这是当前已发布 DAG 的一个起点。"
            relations={neighborhood.prerequisites}
            role="prerequisite"
          />
        </section>

        <section aria-labelledby="concept-dependents-title">
          <h3 className="text-base font-semibold" id="concept-dependents-title">
            后续相关 Concept
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            这里从同一 dependency 数据反向派生，表示哪些知识会继续复用当前能力，不是另一份课程顺序。
          </p>
          <RelationList
            emptyText="当前正式 catalog 中还没有直接复用它的后续 Concept。"
            relations={neighborhood.dependents}
            role="dependent"
          />
        </section>
      </div>

      <section
        aria-labelledby="concept-knowledge-graph-title"
        className="mt-8 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4 sm:p-5"
        data-concept-knowledge-graph
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Knowledge Graph · 1 hop
        </p>
        <h3 className="mt-2 text-base font-semibold" id="concept-knowledge-graph-title">
          当前 Concept 的一跳邻域图
        </h3>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--color-muted)]">
          共 {neighborhood.nodes.length} 个 Concept 节点、{neighborhood.edges.length} 条直接依赖边。方向统一为“前置 → 后续”；图只帮助建立空间理解，不替代上方列表或正文。
        </p>
        <div
          aria-label="依赖边图例"
          className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[var(--color-muted)]"
          role="list"
        >
          <span className="inline-flex items-center gap-2" role="listitem">
            <span aria-hidden="true" className="block w-8 border-t-2 border-[var(--color-accent)]" />
            hard · 实线
          </span>
          <span className="inline-flex items-center gap-2" role="listitem">
            <span aria-hidden="true" className="block w-8 border-t-2 border-dashed border-[var(--color-muted)]" />
            recommended · 虚线
          </span>
        </div>
        <div className="mt-5">
          <KnowledgeGraphDisclosure neighborhood={neighborhood} />
        </div>
      </section>
    </section>
  );
}
