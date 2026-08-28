"use client";

import Link from "next/link";
import { useMemo } from "react";

import { getNextStep, type NextStepCatalog } from "./next-step";
import { ConceptStatusLabel } from "@/features/progress/concept-status-label";
import { useLearningStore } from "@/features/progress/learning-store-provider";
import { getConceptStatus } from "@/features/progress/progress-domain";

const completionCriteriaPreviewLimit = 2;

export function DashboardNextStep({
  catalog,
}: {
  readonly catalog: NextStepCatalog;
}) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const learningState = useLearningStore(({ learningState }) => learningState);
  const nextStep = useMemo(
    () => (hydrated ? getNextStep({ catalog, state: learningState }) : undefined),
    [catalog, hydrated, learningState],
  );

  if (!nextStep) {
    return (
      <section
        aria-busy="true"
        aria-labelledby="next-step-title"
        className="mt-8"
        data-dashboard-next-step="loading"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Next step
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="next-step-title">
          下一步学习
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]" role="status">
          正在恢复浏览器本地学习状态…
        </p>
      </section>
    );
  }

  if (nextStep.kind === "empty") {
    return (
      <section
        aria-labelledby="next-step-title"
        className="mt-8 border-y border-[var(--color-border)] py-7"
        data-dashboard-next-step="empty"
        data-next-step-reason-code={nextStep.reasonCode}
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Next step
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="next-step-title">
          下一步学习
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-[var(--color-muted)]">
          {nextStep.reasonText}
        </p>
        <nav aria-label="继续浏览学习内容" className="mt-5 flex flex-wrap gap-3">
          <Link
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold"
            href="/roadmap/"
          >
            浏览 Roadmap
          </Link>
          <Link
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold"
            href="/knowledge/"
          >
            浏览 Knowledge
          </Link>
        </nav>
      </section>
    );
  }

  const concept = catalog.concepts.find(({ id }) => id === nextStep.targetId);
  if (!concept) {
    return (
      <section
        aria-labelledby="next-step-title"
        className="mt-8"
        data-dashboard-next-step="unavailable"
      >
        <h2 className="text-2xl font-semibold" id="next-step-title">
          下一步学习
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]" role="status">
          推荐目标暂时无法从正式内容中读取。你的本地学习数据没有被修改。
        </p>
      </section>
    );
  }

  const stage = catalog.stages.find(({ id }) => id === concept.stageId);
  const relatedProject = nextStep.relatedProject
    ? catalog.projects.find(({ id }) => id === nextStep.relatedProject?.projectId)
    : undefined;
  const status = getConceptStatus(
    learningState.conceptProgress,
    concept.id,
  );
  const actionLabel = status === "not_started" ? "开始学习" : "继续学习";
  const completionCriteria = nextStep.completionCriteria.slice(
    0,
    completionCriteriaPreviewLimit,
  );

  return (
    <section
      aria-labelledby="next-step-title"
      className="mt-8"
      data-dashboard-next-step="recommendation"
      data-next-step-reason-code={nextStep.reasonCode}
      data-next-step-target-id={nextStep.targetId}
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Next step
      </p>
      <h2 className="mt-2 text-2xl font-semibold" id="next-step-title">
        下一步学习
      </h2>

      <article className="mt-5 min-w-0 border-y border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 shadow-[var(--shadow-subtle)] sm:px-7">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--color-muted)]">
              {stage?.title ?? concept.stageId}
            </p>
            <h3 className="mt-2 [overflow-wrap:anywhere] text-2xl font-semibold">
              {concept.title}
            </h3>
            {concept.englishTitle ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {concept.englishTitle}
              </p>
            ) : null}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-muted)]">
              当前状态
            </p>
            <ConceptStatusLabel conceptId={concept.id} />
          </div>
        </div>

        <div className="mt-6 border-l-2 border-[var(--color-accent)] pl-4">
          <p className="text-xs font-semibold text-[var(--color-muted)]">
            为什么现在学这个
          </p>
          <p className="mt-2 leading-7" data-next-step-reason>
            {nextStep.reasonText}
          </p>
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[var(--color-muted)]">预计学习时间</dt>
            <dd className="mt-1" data-next-step-estimated-time>
              {nextStep.estimatedTime.minHours}–{nextStep.estimatedTime.maxHours} 小时
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--color-muted)]">路线目标</dt>
            <dd className="mt-1">
              达到{nextStep.requiredStatus === "mastered" ? "掌握" : "理解"}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="next-step-completion-title" className="mt-7">
          <h4 className="text-base font-semibold" id="next-step-completion-title">
            做到什么程度算完成
          </h4>
          <ul
            className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--color-muted)]"
            data-next-step-completion-criteria
          >
            {completionCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
          {nextStep.completionCriteria.length > completionCriteria.length ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              完整标准请进入 Concept 查看。
            </p>
          ) : null}
        </section>

        {relatedProject ? (
          <p className="mt-6 text-sm" data-next-step-related-project>
            与{" "}
            <Link
              className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
              href={`/projects/${relatedProject.slug}/`}
            >
              {relatedProject.title}
            </Link>{" "}
            相关
          </p>
        ) : null}

        {nextStep.unmetRecommendedDependencies.length > 0 ? (
          <aside
            className="mt-6 rounded-md bg-[var(--color-surface-subtle)] px-4 py-3 text-sm leading-6"
            data-next-step-recommended-prerequisites
          >
            <p className="font-semibold">建议同时了解（不阻止开始）</p>
            <ul className="mt-2 space-y-2">
              {nextStep.unmetRecommendedDependencies.map((dependency) => {
                const prerequisite = catalog.concepts.find(
                  ({ id }) => id === dependency.conceptId,
                );
                return (
                  <li key={dependency.conceptId}>
                    {prerequisite ? (
                      <Link
                        className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                        href={`/knowledge/${prerequisite.slug}/`}
                      >
                        {dependency.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{dependency.title}</span>
                    )}
                    ：{dependency.reason}
                  </li>
                );
              })}
            </ul>
          </aside>
        ) : null}

        <div className="mt-7">
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white"
            data-next-step-action
            href={`/knowledge/${concept.slug}/`}
          >
            {actionLabel}
          </Link>
        </div>
      </article>
    </section>
  );
}
