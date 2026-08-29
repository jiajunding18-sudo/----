"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useLearningStore } from "@/features/progress";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type { ProjectMeta } from "@/types";

import { getProjectCompletionEligibility } from "./project-readiness";

interface EvidenceConceptPresentation {
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

function createDeliverableId(projectId: string) {
  const randomPart = crypto.randomUUID().replaceAll("-", "");
  return `deliverable.${projectId}.${Date.now()}.${randomPart}`;
}

export function ProjectCompletionPanel({
  evidenceConcepts,
  project,
}: {
  readonly evidenceConcepts: readonly EvidenceConceptPresentation[];
  readonly project: DeepReadonly<ProjectMeta>;
}) {
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [deliverableReference, setDeliverableReference] = useState("");
  const [deliverableNote, setDeliverableNote] = useState("");
  const [completionConfirmed, setCompletionConfirmed] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const projectProgress = useLearningStore(
    ({ learningState }) => learningState.projectProgress[project.id],
  );
  const setAcceptanceCriterion = useLearningStore(
    (state) => state.setProjectAcceptanceCriterion,
  );
  const addDeliverable = useLearningStore(
    (state) => state.addProjectDeliverable,
  );
  const removeDeliverable = useLearningStore(
    (state) => state.removeProjectDeliverable,
  );
  const completeProject = useLearningStore((state) => state.completeProject);
  const eligibility = getProjectCompletionEligibility(project, projectProgress);
  const completed = projectProgress?.status === "completed";
  const editable =
    projectProgress?.status === "in_progress" ||
    projectProgress?.status === "paused";
  const writesBlocked =
    persistenceStatus === "blocked" || persistenceStatus === "unavailable";

  async function handleDeliverableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addDeliverable(project.id, {
      id: createDeliverableId(project.id),
      title: deliverableTitle,
      reference: deliverableReference || undefined,
      note: deliverableNote || undefined,
    });
    setActionMessage(
      result.ok ? "交付物记录已保存。" : result.message,
    );
    if (result.ok) {
      setDeliverableTitle("");
      setDeliverableReference("");
      setDeliverableNote("");
      setCompletionConfirmed(false);
    }
  }

  async function handleAcceptanceChange(
    criterionId: string,
    satisfied: boolean,
  ) {
    const result = await setAcceptanceCriterion(
      project.id,
      criterionId,
      satisfied,
    );
    setActionMessage(
      result.ok ? "验收确认已保存。" : result.message,
    );
    if (result.ok) setCompletionConfirmed(false);
  }

  async function handleRemoveDeliverable(deliverableId: string) {
    const result = await removeDeliverable(project.id, deliverableId);
    setActionMessage(
      result.ok ? "交付物记录已删除。" : result.message,
    );
    if (result.ok) setCompletionConfirmed(false);
  }

  async function handleComplete() {
    const result = await completeProject(project.id, completionConfirmed);
    setActionMessage(
      result.ok
        ? "Project 已由你主动确认完成；Concept 状态和证据没有自动改变。"
        : result.message,
    );
    if (result.ok) setCompletionConfirmed(false);
  }

  return (
    <section
      aria-labelledby="project-completion-title"
      className="mt-10 border-y border-[var(--color-border)] py-8"
      data-project-completion
      data-project-completion-status={projectProgress?.status ?? "not_started"}
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Deliverables &amp; acceptance
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold" id="project-completion-title">
            项目交付与完成验收
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            交付要求和验收标准直接来自正式 ProjectMeta。勾选最后一项不会自动完成项目。
          </p>
        </div>
        {completed && projectProgress.completedAt ? (
          <p className="text-sm font-semibold" data-project-completed-at>
            已完成 · {formatTimestamp(projectProgress.completedAt)}
          </p>
        ) : null}
      </div>

      {!hydrated ? (
        <p className="mt-5 text-sm text-[var(--color-muted)]">
          正在恢复本地 Project 状态…
        </p>
      ) : (
        <>
          <section className="mt-7" aria-labelledby="deliverable-requirements-title">
            <h3 className="text-lg font-semibold" id="deliverable-requirements-title">
              正式交付要求
            </h3>
            <ul
              className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6"
              data-deliverable-requirements
            >
              {project.deliverableRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="recorded-deliverables-title"
            className="mt-8 border-t border-[var(--color-border)] pt-6"
          >
            <h3 className="text-lg font-semibold" id="recorded-deliverables-title">
              已记录交付物
            </h3>
            {projectProgress?.deliverables.length ? (
              <ul className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                {projectProgress.deliverables.map((deliverable) => (
                  <li
                    className="py-4"
                    data-project-deliverable={deliverable.id}
                    key={deliverable.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{deliverable.title}</p>
                        {deliverable.reference ? (
                          <p className="mt-1 break-words text-sm text-[var(--color-muted)]">
                            引用：{deliverable.reference}
                          </p>
                        ) : null}
                        {deliverable.note ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                            {deliverable.note}
                          </p>
                        ) : null}
                      </div>
                      {editable ? (
                        <button
                          className="min-h-10 rounded-md border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-muted)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                          disabled={writesBlocked}
                          onClick={() =>
                            void handleRemoveDeliverable(deliverable.id)
                          }
                          type="button"
                        >
                          删除记录
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                尚未记录可检查交付物。项目完成至少需要一条记录。
              </p>
            )}

            {editable ? (
              <form className="mt-5 grid max-w-2xl gap-4" onSubmit={handleDeliverableSubmit}>
                <label className="grid gap-2 text-sm font-semibold">
                  交付物标题
                  <input
                    className="min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                    onChange={(event) => setDeliverableTitle(event.target.value)}
                    placeholder="例如：Pixel Lab 可复现项目目录"
                    value={deliverableTitle}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  文件、commit 或结果引用（可选）
                  <input
                    className="min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                    onChange={(event) => setDeliverableReference(event.target.value)}
                    placeholder="例如：evidence/stage-0-exit/index.md"
                    value={deliverableReference}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  检查说明（可选）
                  <textarea
                    className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal leading-6"
                    onChange={(event) => setDeliverableNote(event.target.value)}
                    value={deliverableNote}
                  />
                </label>
                <button
                  className="min-h-11 w-fit rounded-md border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                  disabled={writesBlocked || !deliverableTitle.trim()}
                  type="submit"
                >
                  记录交付物
                </button>
              </form>
            ) : null}
          </section>

          <fieldset
            className="mt-8 border-t border-[var(--color-border)] pt-6"
            data-acceptance-criteria
          >
            <legend className="text-lg font-semibold">Acceptance Criteria</legend>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              逐项确认可观察结果。required 项全部满足后仍需单独确认完成。
            </p>
            <div className="mt-4 space-y-3">
              {project.acceptanceCriteria.map((criterion) => (
                <label
                  className="flex gap-3 border-b border-[var(--color-border)] pb-3"
                  data-acceptance-criterion={criterion.id}
                  key={criterion.id}
                >
                  <input
                    checked={projectProgress?.acceptance[criterion.id] === true}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                    disabled={!editable || writesBlocked}
                    onChange={(event) =>
                      void handleAcceptanceChange(
                        criterion.id,
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                  <span className="text-sm leading-6">
                    <span className="font-semibold">
                      {criterion.required ? "必需" : "可选"}
                    </span>
                    <span className="ml-2">{criterion.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {!projectProgress ? (
            <p className="mt-6 border-l-2 border-[var(--color-accent)] pl-4 text-sm leading-6">
              请先在页面上方主动开始 Project，之后才能记录交付物和确认验收项。
            </p>
          ) : null}

          {editable ? (
            <section
              aria-labelledby="completion-eligibility-title"
              className="mt-8 border-t border-[var(--color-border)] pt-6"
              data-completion-eligible={eligibility.eligible ? "true" : "false"}
            >
              <h3 className="text-lg font-semibold" id="completion-eligibility-title">
                完成资格
              </h3>
              <p className="mt-3 text-sm leading-6">
                {eligibility.eligible
                  ? "必需验收项已满足，且已有可检查交付物。现在可以主动确认完成。"
                  : `仍缺 ${eligibility.missingAcceptanceCriterionIds.length} 项必需验收；${eligibility.hasDeliverable ? "已有交付物" : "尚无交付物"}。`}
              </p>
              <label className="mt-5 flex max-w-2xl gap-3">
                <input
                  checked={completionConfirmed}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                  onChange={(event) => setCompletionConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm leading-6">
                  我已逐项检查正式验收标准与交付物，并主动确认完成此 Project。我理解这不会自动授予任何 Concept mastered。
                </span>
              </label>
              <button
                className="mt-5 min-h-11 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                disabled={
                  writesBlocked || !eligibility.eligible || !completionConfirmed
                }
                onClick={() => void handleComplete()}
                type="button"
              >
                确认完成项目
              </button>
            </section>
          ) : null}

          {completed ? (
            <section
              aria-labelledby="project-evidence-candidates-title"
              className="mt-8 border-t border-[var(--color-border)] pt-6"
              data-project-evidence-candidates
            >
              <h3 className="text-lg font-semibold" id="project-evidence-candidates-title">
                Concept Evidence 候选
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                以下关联只来自 ProjectMeta.evidenceConceptIds。项目交付物可以被你选择为证据来源，但系统没有自动添加 Evidence，也没有改变 Concept 状态。
              </p>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {evidenceConcepts.map((concept) => (
                  <li key={concept.id}>
                    {concept.publicationStatus === "published" ? (
                      <Link
                        className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                        href={`/knowledge/${concept.slug}/`}
                      >
                        {concept.title}
                      </Link>
                    ) : (
                      <span>
                        {concept.title}（路线已规划，正式内容尚未展开）
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {actionMessage ? (
            <p
              aria-live="polite"
              className="mt-6 text-sm font-semibold"
              data-project-completion-message
            >
              {actionMessage}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
