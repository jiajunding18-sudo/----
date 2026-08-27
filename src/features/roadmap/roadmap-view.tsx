import Link from "next/link";

import { ContentState } from "@/components/content/content-state";

import type { RoadmapStageView, RoadmapView } from "./roadmap-model";

const depthLabels = {
  master: { code: "M", label: "必须掌握" },
  understand: { code: "U", label: "理解即可" },
  advanced: { code: "A", label: "后期深入" },
} as const;

function getConditionLabel(
  condition: RoadmapStageView["stage"]["exitCriteria"][number]["when"],
) {
  return condition.kind === "always"
    ? "始终要求"
    : `当 ${condition.trackId} 目标为 ${condition.minimumGoal} 时要求`;
}

function ConceptRoute({ stage }: { readonly stage: RoadmapStageView }) {
  if (stage.concepts.length === 0) {
    return (
      <ContentState
        description="这个 Stage 已进入正式 catalog，但当前没有已发布的 Concept。路线不会用占位课程补齐。"
        title="本 Stage 尚无正式 Concept"
      />
    );
  }

  return (
    <section aria-labelledby={`${stage.stage.id}-concepts`} className="mt-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Recommended sequence
        </p>
        <h3
          className="mt-2 text-2xl font-semibold tracking-[-0.02em]"
          id={`${stage.stage.id}-concepts`}
        >
          Concept 学习路线
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          序号按正式 manifest 的 order 排列；它是阅读建议，不是把所有节点串成单一路径。真正阻塞开始的只有 hard 前置，recommended 只提供学习建议。
        </p>
      </div>

      <ol
        aria-label={`${stage.stage.title} Concept 推荐学习顺序`}
        className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]"
      >
        {stage.concepts.map(({ concept, dependencies }, index) => {
          const hardDependencies = dependencies.filter(
            ({ dependency }) => dependency.kind === "hard",
          );
          const recommendedDependencies = dependencies.filter(
            ({ dependency }) => dependency.kind === "recommended",
          );
          const depth = depthLabels[concept.targetDepth];

          return (
            <li className="py-7" data-concept-id={concept.id} key={concept.id}>
              <article className="grid min-w-0 gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                <p className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-xl font-semibold tracking-[-0.02em]">
                        <Link
                          className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                          href={`/knowledge/${concept.slug}/`}
                        >
                          {concept.title}
                        </Link>
                      </h4>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {concept.englishTitle}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                      {depth.code} · {depth.label}
                    </span>
                  </div>

                  <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                    {concept.why}
                  </p>
                  <p className="mt-3 text-xs font-semibold tabular-nums text-[var(--color-muted)]">
                    manifest order {concept.order} · 预计 {concept.estimatedHours.min}–{concept.estimatedHours.max} 小时
                  </p>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold">hard 前置</p>
                      {hardDependencies.length === 0 ? (
                        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                          无 hard 前置；可作为当前 Stage 的起点或并行节点。
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-3">
                          {hardDependencies.map(({ dependency, prerequisite }) => (
                            <li
                              className="text-sm leading-6"
                              data-dependency-kind="hard"
                              key={`${dependency.prerequisiteId}:${dependency.targetId}:hard`}
                            >
                              <Link
                                className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
                                href={`/knowledge/${prerequisite.slug}/`}
                              >
                                {prerequisite.title}
                              </Link>
                              <span className="text-[var(--color-muted)]">
                                ：{dependency.rationale}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold">recommended 建议</p>
                      {recommendedDependencies.length === 0 ? (
                        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                          当前没有额外建议前置。
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-3">
                          {recommendedDependencies.map(
                            ({ dependency, prerequisite }) => (
                              <li
                                className="text-sm leading-6"
                                data-dependency-kind="recommended"
                                key={`${dependency.prerequisiteId}:${dependency.targetId}:recommended`}
                              >
                                <Link
                                  className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
                                  href={`/knowledge/${prerequisite.slug}/`}
                                >
                                  {prerequisite.title}
                                </Link>
                                <span className="text-[var(--color-muted)]">
                                  ：{dependency.rationale}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StageProjects({ stage }: { readonly stage: RoadmapStageView }) {
  return (
    <section aria-labelledby={`${stage.stage.id}-projects`} className="mt-12">
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Practice checkpoint
      </p>
      <h3
        className="mt-2 text-2xl font-semibold tracking-[-0.02em]"
        id={`${stage.stage.id}-projects`}
      >
        对应项目
      </h3>

      {stage.projects.length === 0 ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
          当前没有由正式项目门槛或 Concept 要求关联到这个 Stage 的已发布项目。
        </p>
      ) : (
        <div className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {stage.projects.map(({ isStageGate, project, requirements }) => {
            const stageRequirements = requirements.filter(({ concept }) =>
              stage.concepts.some(
                ({ concept: stageConcept }) => stageConcept.id === concept.id,
              ),
            );
            const hardCount = stageRequirements.filter(
              ({ requirement }) => requirement.kind === "hard",
            ).length;
            const recommendedCount = stageRequirements.length - hardCount;

            return (
              <article className="py-6" data-project-id={project.id} key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xl font-semibold">
                      <Link
                        className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                        href={`/projects/${project.slug}/`}
                      >
                        {project.title}
                      </Link>
                    </h4>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                      {project.resumeOutcome}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold">
                    {isStageGate ? "正式项目门槛" : "阶段关联项目"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
                  关联本 Stage {stageRequirements.length} 个 Concept：{hardCount} 个 hard 项目要求
                  {recommendedCount > 0
                    ? `，${recommendedCount} 个 recommended 项目要求`
                    : ""}
                  。预计 {project.estimatedHours.min}–{project.estimatedHours.max} 小时。
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StageExit({ stage }: { readonly stage: RoadmapStageView }) {
  return (
    <section aria-labelledby={`${stage.stage.id}-exit`} className="mt-12">
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Exit criteria
      </p>
      <h3
        className="mt-2 text-2xl font-semibold tracking-[-0.02em]"
        id={`${stage.stage.id}-exit`}
      >
        Stage 出口标准
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
        离开 Stage 不是点击完成；以下标准来自 StageDefinition，并需要可检查证据。
        {stage.stage.retestAfterDays
          ? `首次满足后还需间隔 ${stage.stage.retestAfterDays} 天复测。`
          : ""}
      </p>
      <ol className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {stage.stage.exitCriteria.map((criterion, index) => (
          <li className="grid gap-3 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)]" key={criterion.id}>
            <span className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6">{criterion.description}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {criterion.required ? "必需" : "可选"} · {getConditionLabel(criterion.when)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RoadmapViewContent({ roadmap }: { readonly roadmap: RoadmapView }) {
  if (roadmap.stages.length === 0) {
    return (
      <ContentState
        description="manifest 当前没有正式 Stage。请先补充并通过 StageDefinition 校验。"
        title="路线尚未展开"
      />
    );
  }

  return (
    <>
      <section
        aria-labelledby="roadmap-reading-guide"
        className="mt-10 max-w-4xl border-l-2 border-[var(--color-accent)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-subtle)]"
      >
        <h2 className="text-base font-semibold" id="roadmap-reading-guide">
          如何阅读这条路线
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          当前 manifest 包含 {roadmap.stages.length} 个正式 Stage、{roadmap.publishedConceptCount} 个已发布 Concept 和 {roadmap.publishedProjectCount} 个已发布 Project。Stage 负责组织目标，Concept 的 hard dependency 才决定必须先学什么；recommended dependency 不阻塞开始。
        </p>
      </section>

      <div className="mt-10 space-y-8">
        {roadmap.stages.map((stage, stageIndex) => (
          <article
            aria-labelledby={`${stage.stage.id}-title`}
            className="border-t border-[var(--color-border)] pt-8 first:border-t-0 first:pt-0"
            data-stage-id={stage.stage.id}
            key={stage.stage.id}
          >
            <p className="text-sm font-semibold text-[var(--color-accent)]">
              {stage.tracks.map(({ title }) => title).join(" / ")}
            </p>
            <h2
              className="mt-2 text-3xl font-semibold tracking-[-0.03em]"
              id={`${stage.stage.id}-title`}
            >
              {stage.stage.title}
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-[var(--color-muted)]">
              {stage.stage.summary}
            </p>

            <details className="mt-6" open={stageIndex === 0}>
              <summary className="w-fit cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold marker:text-[var(--color-accent)]">
                查看阶段目标、路线、项目与出口
              </summary>
              <div className="mt-8">
                <section aria-labelledby={`${stage.stage.id}-outcomes`}>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
                    Learning outcomes
                  </p>
                  <h3
                    className="mt-2 text-2xl font-semibold tracking-[-0.02em]"
                    id={`${stage.stage.id}-outcomes`}
                  >
                    Stage 学习目标
                  </h3>
                  <ul className="mt-4 max-w-3xl space-y-3 text-sm leading-6 text-[var(--color-muted)]">
                    {stage.stage.outcomes.map((outcome) => (
                      <li className="flex gap-3" key={outcome}>
                        <span aria-hidden="true" className="text-[var(--color-accent)]">
                          —
                        </span>
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <ConceptRoute stage={stage} />
                <StageProjects stage={stage} />
                <StageExit stage={stage} />
              </div>
            </details>
          </article>
        ))}
      </div>

      <section
        aria-labelledby="future-stages-title"
        className="mt-12 border-t border-[var(--color-border)] pt-8"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Future stages
        </p>
        <h2 className="mt-2 text-xl font-semibold" id="future-stages-title">
          后续路线尚未展开
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
          后续 Stage 只有在正式 StageDefinition 与已校验内容进入 manifest 后才会出现在这里；当前页面不会用假课程或占位节点补齐长期路线。
        </p>
      </section>
    </>
  );
}
