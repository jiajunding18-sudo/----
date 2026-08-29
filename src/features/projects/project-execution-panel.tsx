"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { useLearningStore } from "@/features/progress";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type { ProjectMeta } from "@/types";

import {
  getProjectKnowledgeReadiness,
  getProjectPathReadiness,
  getProjectReadiness,
} from "./project-readiness";

interface ProjectConceptPresentation {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ReadinessStatus({ ready }: { readonly ready: boolean }) {
  return (
    <span
      className="text-sm font-semibold"
      data-readiness-ready={ready ? "true" : "false"}
    >
      {ready ? "已准备" : "尚未准备"}
    </span>
  );
}

function MissingConcepts({
  conceptIds,
  conceptsById,
}: {
  readonly conceptIds: readonly string[];
  readonly conceptsById: ReadonlyMap<string, ProjectConceptPresentation>;
}) {
  return (
    <ul className="mt-3 space-y-2 text-sm leading-6">
      {conceptIds.map((conceptId) => {
        const concept = conceptsById.get(conceptId);
        return (
          <li key={conceptId}>
            {concept?.publicationStatus === "published" ? (
              <Link
                className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                href={`/knowledge/${concept.slug}/`}
              >
                {concept.title}
              </Link>
            ) : (
              <span className="font-semibold">{concept?.title ?? conceptId}</span>
            )}
            <span className="text-[var(--color-muted)]">
              {concept?.publicationStatus === "published"
                ? ""
                : "（路线已规划，正式内容尚未展开）"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectExecutionPanel({
  project,
  concepts,
}: {
  readonly project: DeepReadonly<ProjectMeta>;
  readonly concepts: readonly ProjectConceptPresentation[];
}) {
  const [selectedPathId, setSelectedPathId] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [environmentChecks, setEnvironmentChecks] = useState<
    Record<string, boolean>
  >({});
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const learningState = useLearningStore(({ learningState }) => learningState);
  const startProject = useLearningStore((state) => state.startProject);
  const setStoredEnvironmentCheck = useLearningStore(
    (state) => state.setProjectEnvironmentCheck,
  );
  const projectProgress = learningState.projectProgress[project.id];
  const knowledge = useMemo(
    () =>
      getProjectKnowledgeReadiness(project, learningState.conceptProgress),
    [learningState.conceptProgress, project],
  );
  const readiness = useMemo(
    () => getProjectReadiness(project, learningState),
    [learningState, project],
  );
  const conceptsById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept])),
    [concepts],
  );
  const environmentById = useMemo(
    () =>
      new Map(
        project.environmentRequirements.map((requirement) => [
          requirement.id,
          requirement,
        ]),
      ),
    [project.environmentRequirements],
  );
  const activePathId = projectProgress?.selectedExecutionPathId ?? selectedPathId;
  const activePath = project.executionPaths.find(({ id }) => id === activePathId);
  const activeChecks = projectProgress?.environmentChecks ?? environmentChecks;
  const activePathReadiness = getProjectPathReadiness(
    project,
    activeChecks,
  ).find(({ pathId }) => pathId === activePathId);
  const activeEnvironmentRequirements =
    activePath?.requirementIds.flatMap((requirementId) => {
      const requirement = environmentById.get(requirementId);
      return requirement ? [requirement] : [];
    }) ?? [];
  const writesBlocked =
    persistenceStatus === "blocked" || persistenceStatus === "unavailable";
  const executing =
    projectProgress?.status === "in_progress" ||
    projectProgress?.status === "paused";
  const completed = projectProgress?.status === "completed";
  const hasStarted = executing || completed;

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await startProject(project.id, {
      selectedExecutionPathId: selectedPathId,
      nextAction,
      environmentChecks,
      confirmPrerequisiteOverride: overrideConfirmed,
    });
    setSubmitting(false);
    setActionMessage(
      result.ok
        ? "Project 已开始，执行状态已保存到当前浏览器。"
        : result.message,
    );
  }

  async function handleStoredEnvironmentCheck(
    requirementId: string,
    checked: boolean,
  ) {
    const result = await setStoredEnvironmentCheck(
      project.id,
      requirementId,
      checked,
    );
    setActionMessage(
      result.ok
        ? "环境准备状态已保存。"
        : result.message,
    );
  }

  if (!hydrated) {
    return (
      <section
        aria-labelledby="project-execution-title"
        className="mt-8 border-y border-[var(--color-border)] py-7"
        data-project-execution
      >
        <h2 className="text-2xl font-semibold" id="project-execution-title">
          开始执行
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          正在恢复本地 Project 状态…
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="project-execution-title"
      className="mt-8 border-y border-[var(--color-border)] py-7"
      data-project-execution
      data-project-progress-status={projectProgress?.status ?? "not_started"}
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Project execution
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold" id="project-execution-title">
            {completed ? "项目已完成" : executing ? "当前正在执行" : "开始执行"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {completed
              ? "完成快照已保存；当前 Knowledge Readiness 仍按最新 Concept 状态独立计算。"
              : executing
              ? "ProjectProgress 已建立；Concept 学习状态与项目状态仍分别维护。"
              : "浏览本页不会改变状态。只有提交下方表单才会建立 ProjectProgress。"}
          </p>
        </div>
        {hasStarted && projectProgress.startedAt ? (
          <p className="text-sm font-semibold" data-project-started-at>
            开始于 {formatTimestamp(projectProgress.startedAt)}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="knowledge-readiness-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold" id="knowledge-readiness-title">
              Knowledge Readiness
            </h3>
            <ReadinessStatus ready={readiness.knowledgeReady} />
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {knowledge.hardRequirements.length - knowledge.missingHard.length}/
            {knowledge.hardRequirements.length} 项 hard requirement 已满足。
            {knowledge.missingRecommended.length > 0
              ? `另有 ${knowledge.missingRecommended.length} 项 recommended 提醒，不阻塞开始。`
              : "recommended requirement 已满足。"}
          </p>
          {readiness.missingHardConceptIds.length > 0 ? (
            <div
              className="mt-4 border-l-2 border-[var(--color-accent)] pl-4"
              data-project-hard-gaps
            >
              <p className="text-sm font-semibold">仍缺少以下前置能力：</p>
              <MissingConcepts
                conceptIds={readiness.missingHardConceptIds}
                conceptsById={conceptsById}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold">已具备建议开始条件。</p>
          )}
        </section>

        <section aria-labelledby="project-goal-title">
          <h3 className="text-lg font-semibold" id="project-goal-title">
            当前项目目标
          </h3>
          <p className="mt-2 text-sm leading-6">{project.problemStatement}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {project.resumeOutcome}
          </p>
        </section>
      </div>

      {hasStarted ? (
        <div className="mt-7 border-t border-[var(--color-border)] pt-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="active-path-title">
              <h3 className="font-semibold" id="active-path-title">
                当前执行路径
              </h3>
              <p className="mt-2 text-sm">{activePath?.title ?? activePathId}</p>
              {activePath ? (
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  {activePath.evidenceBoundary}
                </p>
              ) : null}
            </section>
            <section aria-labelledby="active-next-action-title">
              <h3 className="font-semibold" id="active-next-action-title">
                下一动作
              </h3>
              <p className="mt-2 text-sm leading-6" data-project-next-action>
                {completed
                  ? "项目已完成；完成快照中不再保留待执行下一动作。"
                  : projectProgress.nextAction}
              </p>
            </section>
          </div>
        </div>
      ) : (
        <form className="mt-7" onSubmit={handleStart}>
          <fieldset>
            <legend className="text-lg font-semibold">选择执行路径</legend>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              每条路径只检查自己引用的正式环境要求；选择不会自动开始项目。
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {project.executionPaths.map((path) => {
                const pathReadiness = getProjectPathReadiness(
                  project,
                  environmentChecks,
                ).find(({ pathId }) => pathId === path.id);
                return (
                  <label
                    className="flex min-w-0 gap-3 rounded-md border border-[var(--color-border)] p-4"
                    key={path.id}
                  >
                    <input
                      checked={selectedPathId === path.id}
                      className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                      name="project-execution-path"
                      onChange={() => {
                        setSelectedPathId(path.id);
                        setActionMessage("");
                      }}
                      type="radio"
                      value={path.id}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{path.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
                        {pathReadiness?.ready
                          ? "必需环境项已确认"
                          : `还有 ${pathReadiness?.missingEnvironmentRequirementIds.length ?? 0} 项必需环境待确认`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {activePath ? (
            <EnvironmentChecklist
              checks={environmentChecks}
              disabled={writesBlocked}
              onChange={(requirementId, checked) =>
                setEnvironmentChecks((current) => ({
                  ...current,
                  [requirementId]: checked,
                }))
              }
              pathReady={activePathReadiness?.ready ?? false}
              requirements={activeEnvironmentRequirements}
            />
          ) : null}

          <label className="mt-6 block max-w-2xl" htmlFor="project-next-action">
            <span className="font-semibold">第一项下一动作</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
              必须具体且非空；环境缺口可以作为第一项下一动作。
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm leading-6 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              id="project-next-action"
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="例如：创建项目目录并记录 Python 解释器路径"
              value={nextAction}
            />
          </label>

          {readiness.missingHardConceptIds.length > 0 ? (
            <label className="mt-5 flex max-w-2xl gap-3 border-l-2 border-[var(--color-accent)] pl-4">
              <input
                checked={overrideConfirmed}
                className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                onChange={(event) => setOverrideConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm leading-6">
                我理解仍缺少上述 hard 前置能力，并确认仍然开始。系统会记录本次覆盖，且不会把 Knowledge Readiness 显示为已准备。
              </span>
            </label>
          ) : null}

          <button
            className="mt-5 min-h-11 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            disabled={
              writesBlocked ||
              submitting ||
              !selectedPathId ||
              !nextAction.trim() ||
              (readiness.missingHardConceptIds.length > 0 &&
                !overrideConfirmed)
            }
            type="submit"
          >
            {readiness.missingHardConceptIds.length > 0
              ? "确认带缺口开始 Project"
              : "开始 Project"}
          </button>
        </form>
      )}

      {activePath && hasStarted ? (
        <EnvironmentChecklist
          checks={activeChecks}
          disabled={writesBlocked || !executing}
          onChange={(requirementId, checked) =>
            void handleStoredEnvironmentCheck(requirementId, checked)
          }
          pathReady={readiness.environmentReady === true}
          requirements={activeEnvironmentRequirements}
        />
      ) : null}

      {actionMessage ? (
        <p
          aria-live="polite"
          className="mt-5 text-sm font-semibold"
          data-project-action-message
        >
          {actionMessage}
        </p>
      ) : null}
    </section>
  );
}

function EnvironmentChecklist({
  checks,
  disabled,
  onChange,
  pathReady,
  requirements,
}: {
  readonly checks: Readonly<Record<string, boolean>>;
  readonly disabled: boolean;
  readonly onChange: (requirementId: string, checked: boolean) => void;
  readonly pathReady: boolean;
  readonly requirements: DeepReadonly<
    ProjectMeta["environmentRequirements"]
  >;
}) {
  return (
    <fieldset
      className="mt-6 max-w-3xl border-t border-[var(--color-border)] pt-5"
      data-environment-readiness={pathReady ? "ready" : "not-ready"}
    >
      <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 pr-2 text-lg font-semibold">
        <span>Environment / Setup Readiness</span>
        <ReadinessStatus ready={pathReady} />
      </legend>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        这里只记录你对当前路径环境事实的确认；它不会改变 Knowledge Readiness。
      </p>
      <div className="mt-4 space-y-3">
        {requirements.map((requirement) => (
          <label
            className="flex gap-3 border-b border-[var(--color-border)] pb-3"
            key={requirement.id}
          >
            <input
              checked={checks[requirement.id] === true}
              className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
              disabled={disabled}
              onChange={(event) =>
                onChange(requirement.id, event.target.checked)
              }
              type="checkbox"
            />
            <span className="min-w-0 text-sm leading-6">
              <span className="font-semibold">{requirement.label}</span>
              <span className="ml-2 text-xs font-semibold text-[var(--color-muted)]">
                {requirement.required ? "必需" : "可选"}
              </span>
              <span className="block text-[var(--color-muted)]">
                {requirement.details}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
