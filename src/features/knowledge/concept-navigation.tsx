import Link from "next/link";

import type {
  KnowledgeConceptRelation,
  KnowledgeConceptView,
} from "./knowledge-model";

function RelationList({
  emptyText,
  relations,
  role,
}: {
  readonly emptyText: string;
  readonly relations: readonly KnowledgeConceptRelation[];
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
      {relations.map(({ concept, kind, rationale }) => (
        <li
          className="py-4"
          data-dependency-kind={kind}
          data-related-concept-id={concept.id}
          key={`${kind}:${concept.id}`}
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
                ? kind === "hard"
                  ? "hard · 必须前置"
                  : "recommended · 建议前置"
                : kind === "hard"
                  ? "本知识是其 hard 前置"
                  : "本知识是其 recommended 参考"}
            </span>
            {!concept.href ? (
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                尚未发布 · 不提供页面
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            {rationale}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ConceptNavigation({ concept }: { readonly concept: KnowledgeConceptView }) {
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
        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:border-[var(--color-accent)]"
          href={`/roadmap/#roadmap-stage-${concept.stage.id}`}
        >
          在 Roadmap 查看对应 Stage
        </Link>
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
            relations={concept.prerequisites}
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
            relations={concept.dependents}
            role="dependent"
          />
        </section>
      </div>
    </section>
  );
}
