"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useLearningStore } from "@/features/progress";

import type { ProjectCatalogView } from "./project-model";
import { getProjectKnowledgeReadiness } from "./project-readiness";

const levelLabels = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

function ProjectReadinessSummary({
  hydrated,
  project,
}: {
  readonly hydrated: boolean;
  readonly project: ProjectCatalogView["projects"][number]["project"];
}) {
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );
  const readiness = getProjectKnowledgeReadiness(project, progress);

  if (project.conceptRequirements.length === 0) {
    return (
      <p className="text-sm leading-6 text-[var(--color-muted)]">
        Required Knowledge 将随正式项目内容发布；当前不把 0 项要求解释为已准备。
      </p>
    );
  }

  if (!hydrated) {
    return (
      <p className="text-sm leading-6 text-[var(--color-muted)]">
        正在读取本地学习状态…
      </p>
    );
  }

  return (
    <div data-project-readiness={readiness.ready ? "ready" : "not-ready"}>
      <p className="text-sm font-semibold">
        {readiness.ready ? "已具备开始条件" : "尚缺 hard 前置能力"}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
        {readiness.total} 项知识要求中已达到 {readiness.satisfiedCount} 项；
        {readiness.missingHard.length > 0
          ? `仍缺 ${readiness.missingHard.length} 项 hard 要求。`
          : "hard 要求已全部满足。"}
      </p>
    </div>
  );
}

export function ProjectCatalogExplorer({
  catalog,
}: {
  readonly catalog: ProjectCatalogView;
}) {
  const [status, setStatus] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [trackId, setTrackId] = useState("all");
  const [level, setLevel] = useState("all");
  const hydrated = useLearningStore(({ hydrated }) => hydrated);

  const stageOptions = catalog.stages.filter((stage) =>
    catalog.projects.some(({ stages }) =>
      stages.some(({ id }) => id === stage.id),
    ),
  );
  const visibleProjects = useMemo(
    () =>
      catalog.projects.filter(({ project, stages, tracks }) => {
        const matchesStatus =
          status === "all" || project.publicationStatus === status;
        const matchesStage =
          stageId === "all" || stages.some(({ id }) => id === stageId);
        const matchesTrack =
          trackId === "all" || tracks.some(({ id }) => id === trackId);
        const matchesLevel = level === "all" || project.level === level;
        return matchesStatus && matchesStage && matchesTrack && matchesLevel;
      }),
    [catalog.projects, level, stageId, status, trackId],
  );

  return (
    <div className="mt-10" data-project-catalog>
      <section
        aria-labelledby="project-filter-title"
        className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-5"
      >
        <div className="px-4 sm:px-5">
          <h2 className="text-base font-semibold" id="project-filter-title">
            浏览维度
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 text-sm font-semibold">
              Status
              <select
                className="min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 font-normal"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="all">全部状态</option>
                <option value="published">Published · 可执行</option>
                <option value="draft">Draft · Planned</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Stage
              <select
                className="min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 font-normal"
                onChange={(event) => setStageId(event.target.value)}
                value={stageId}
              >
                <option value="all">全部 Stage</option>
                {stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Track
              <select
                className="min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 font-normal"
                onChange={(event) => setTrackId(event.target.value)}
                value={trackId}
              >
                <option value="all">全部 Track</option>
                {catalog.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Difficulty / Level
              <select
                className="min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 font-normal"
                onChange={(event) => setLevel(event.target.value)}
                value={level}
              >
                <option value="all">全部 Level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <p aria-live="polite" className="mt-4 text-sm text-[var(--color-muted)]">
            当前显示 {visibleProjects.length} / {catalog.projects.length} 个 Project
          </p>
        </div>
      </section>

      {visibleProjects.length === 0 ? (
        <p className="mt-8 border-l-2 border-[var(--color-accent)] px-4 py-3 text-sm text-[var(--color-muted)]">
          当前筛选组合没有 Project。
        </p>
      ) : (
        <div className="mt-8 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {visibleProjects.map(({ href, project, stages, tracks }) => (
            <article
              className="scroll-mt-24 py-8"
              data-project-id={project.id}
              data-project-level={project.level}
              data-project-status={project.publicationStatus}
              id={`project-${project.slug}`}
              key={project.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-3xl">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-accent)] uppercase">
                    {project.publicationStatus === "published"
                      ? "Published · 可执行"
                      : "Draft · Planned"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {project.publicationStatus === "published" ? (
                      <Link
                        className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                        href={href}
                      >
                        {project.title}
                      </Link>
                    ) : (
                      project.title
                    )}
                  </h2>
                  <p className="mt-3 leading-7 text-[var(--color-muted)]">
                    {project.problemStatement}
                  </p>
                </div>
                <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold">
                  {levelLabels[project.level]}
                </span>
              </div>

              <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="font-semibold">Stage</dt>
                  <dd className="mt-1 leading-6 text-[var(--color-muted)]">
                    {stages.map((stage, index) => (
                      <span key={stage.id}>
                        {index > 0 ? " / " : ""}
                        <Link
                          className="underline underline-offset-4"
                          href={`/roadmap/#roadmap-stage-${stage.id}`}
                        >
                          {stage.title}
                        </Link>
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Track</dt>
                  <dd className="mt-1 leading-6 text-[var(--color-muted)]">
                    {tracks.map(({ title }) => title).join(" / ")}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">预计投入</dt>
                  <dd className="mt-1 text-[var(--color-muted)]">
                    {project.estimatedHours.min}–{project.estimatedHours.max} 小时
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">所需知识</dt>
                  <dd className="mt-1 text-[var(--color-muted)]">
                    {project.conceptRequirements.length > 0
                      ? `${project.conceptRequirements.length} 项正式 requirement`
                      : "待正式内容发布"}
                  </dd>
                </div>
              </dl>

              <div className="mt-7 grid gap-7 lg:grid-cols-2">
                <div>
                  <h3 className="text-base font-semibold">
                    核心能力
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
                    {project.capabilitySummary.map((capability) => (
                      <li className="flex gap-3" key={capability}>
                        <span aria-hidden="true" className="text-[var(--color-accent)]">—</span>
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    真实应用场景
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
                    {project.realWorldApplications.map((application) => (
                      <li className="flex gap-3" key={application}>
                        <span aria-hidden="true" className="text-[var(--color-accent)]">—</span>
                        <span>{application}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-7 border-l-2 border-[var(--color-border)] pl-4">
                <ProjectReadinessSummary hydrated={hydrated} project={project} />
              </div>

              {project.publicationStatus === "published" ? (
                <Link
                  className="mt-6 inline-flex min-h-11 items-center rounded-md border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4"
                  href={href}
                >
                  查看正式项目内容
                </Link>
              ) : (
                <p className="mt-6 text-sm font-semibold text-[var(--color-muted)]">
                  路线已规划，正式项目内容尚未展开；当前不提供教程或假验收。
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
