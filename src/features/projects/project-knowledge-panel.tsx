"use client";

import Link from "next/link";

import { useLearningStore } from "@/features/progress";
import type { LearningStatus } from "@/types";

import { getProjectKnowledgeReadiness } from "./project-readiness";

const statusLabels: Record<LearningStatus, string> = {
  not_started: "未学习",
  learning: "学习中",
  understood: "已理解",
  mastered: "已掌握",
};

interface RequirementView {
  readonly concept: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
  };
  readonly requirement: {
    readonly conceptId: string;
    readonly kind: "hard" | "recommended";
    readonly minimumStatus: "understood" | "mastered";
    readonly reason: string;
  };
}

function RequirementGroup({
  kind,
  requirements,
  readinessByConceptId,
}: {
  readonly kind: "hard" | "recommended";
  readonly requirements: readonly RequirementView[];
  readonly readinessByConceptId: ReadonlyMap<
    string,
    ReturnType<typeof getProjectKnowledgeReadiness>["hardRequirements"][number]
  >;
}) {
  return (
    <section aria-labelledby={`project-requirements-${kind}`}>
      <h3 className="text-base font-semibold" id={`project-requirements-${kind}`}>
        {kind === "hard" ? "Hard requirements" : "Recommended / supportive"}
      </h3>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
        {kind === "hard"
          ? "必须达到各自 minimumStatus 才显示“已具备开始条件”。"
          : "用于降低实施摩擦，不阻止浏览或开始项目。"}
      </p>
      <ul className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {requirements.map(({ concept, requirement }) => {
          const item = readinessByConceptId.get(concept.id);
          return (
            <li className="py-4" data-project-requirement={concept.id} key={concept.id}>
              <div className="flex flex-wrap items-center gap-2">
                {concept.publicationStatus === "published" ? (
                  <Link
                    className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                    href={`/knowledge/${concept.slug}/`}
                  >
                    {concept.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{concept.title}</span>
                )}
                <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold">
                  需要{requirement.minimumStatus === "mastered" ? "已掌握" : "已理解"}
                </span>
                {item ? (
                  <span
                    className="text-xs font-semibold text-[var(--color-muted)]"
                    data-requirement-satisfied={item.satisfied ? "true" : "false"}
                  >
                    当前：{statusLabels[item.actualStatus]} · {item.satisfied ? "已达到" : "仍缺"}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                {requirement.reason}
              </p>
              {concept.publicationStatus !== "published" ? (
                <p className="mt-2 text-xs font-semibold text-[var(--color-muted)]">
                  路线已规划，正式内容尚未展开；不创建假 Concept 页面。
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProjectKnowledgePanel({
  project,
  requirements,
}: {
  readonly project: {
    readonly conceptRequirements: readonly RequirementView["requirement"][];
  };
  readonly requirements: readonly RequirementView[];
}) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );
  const readiness = getProjectKnowledgeReadiness(project, progress);
  const readinessByConceptId = new Map(
    hydrated
      ? [
          ...readiness.hardRequirements,
          ...readiness.recommendedRequirements,
        ].map((item) => [item.conceptId, item] as const)
      : [],
  );
  const hardRequirements = requirements.filter(
    ({ requirement }) => requirement.kind === "hard",
  );
  const recommendedRequirements = requirements.filter(
    ({ requirement }) => requirement.kind === "recommended",
  );

  return (
    <section
      aria-labelledby="project-required-knowledge"
      className="my-10 border-y border-[var(--color-border)] py-7"
      data-project-knowledge-readiness={
        hydrated ? (readiness.ready ? "ready" : "not-ready") : "pending"
      }
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Project readiness
      </p>
      <h2 className="mt-2 text-2xl font-semibold" id="project-required-knowledge">
        Required Knowledge
      </h2>
      <div className="mt-4 border-l-2 border-[var(--color-accent)] pl-4">
        {!hydrated ? (
          <p className="text-sm text-[var(--color-muted)]">正在读取本地学习状态…</p>
        ) : (
          <>
            <p className="font-semibold">
              {readiness.ready ? "已具备开始条件" : "尚未具备推荐开始条件"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              {readiness.total} 项要求中已达到 {readiness.satisfiedCount} 项；
              {readiness.missingHard.length > 0
                ? `仍缺 ${readiness.missingHard.length} 项 hard requirement。项目内容仍可浏览。`
                : "hard requirement 已全部满足。"}
            </p>
          </>
        )}
      </div>
      <div className="mt-7 grid gap-8 lg:grid-cols-2">
        <RequirementGroup
          kind="hard"
          readinessByConceptId={readinessByConceptId}
          requirements={hardRequirements}
        />
        <RequirementGroup
          kind="recommended"
          readinessByConceptId={readinessByConceptId}
          requirements={recommendedRequirements}
        />
      </div>
    </section>
  );
}
