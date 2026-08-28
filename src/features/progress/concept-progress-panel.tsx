"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { useLearningStore } from "./learning-store-provider";
import {
  getConceptReadiness,
  getConceptStatus,
  getMasteryEligibility,
  type ProgressConceptDefinition,
} from "./progress-domain";
import type { EvidenceKind, MasteryEvidence } from "@/types";

const statusContent = {
  not_started: {
    label: "未开始",
    description: "尚未正式开始学习；打开或阅读本页不会自动改变状态。",
  },
  learning: {
    label: "学习中",
    description: "已经开始学习，正在建立能够解释和应用的理解。",
  },
  understood: {
    label: "已理解",
    description: "已满足理解要求和 hard 前置，可以继续积累掌握证据。",
  },
  mastered: {
    label: "已掌握",
    description: "全部必需标准已有通过证据，并完成了主动掌握确认。",
  },
} as const;

const evidenceKindOptions: readonly {
  readonly value: EvidenceKind;
  readonly label: string;
}[] = [
  { value: "exercise", label: "独立练习" },
  { value: "mini-project", label: "小型项目" },
  { value: "project", label: "项目产物" },
  { value: "code-artifact", label: "代码产物" },
  { value: "written-explanation", label: "书面解释" },
  { value: "demonstration", label: "演示或口头说明" },
  { value: "other", label: "其他可检查证据" },
];

interface PrerequisitePresentation {
  readonly id: string;
  readonly title: string;
  readonly href?: string;
  readonly kind: "hard" | "recommended";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function createEvidenceId(conceptId: string) {
  const randomPart = crypto.randomUUID().replaceAll("-", "");
  return `evidence.${conceptId}.${Date.now()}.${randomPart}`;
}

function PrerequisiteLinks({
  prerequisites,
}: {
  readonly prerequisites: readonly PrerequisitePresentation[];
}) {
  return prerequisites.map((prerequisite, index) => (
    <span key={prerequisite.id}>
      {index > 0 ? "、" : ""}
      {prerequisite.href ? (
        <Link
          className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
          href={prerequisite.href}
        >
          {prerequisite.title}
        </Link>
      ) : (
        `${prerequisite.title}（当前未发布）`
      )}
    </span>
  ));
}

export function ConceptProgressPanel({
  concept,
  prerequisites,
}: {
  readonly concept: ProgressConceptDefinition;
  readonly prerequisites: readonly PrerequisitePresentation[];
}) {
  const [actionMessage, setActionMessage] = useState("");
  const [selectedCriterionIds, setSelectedCriterionIds] = useState<string[]>([]);
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>("exercise");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [masteryConfirmed, setMasteryConfirmed] = useState(false);
  const [downgradeConfirmed, setDowngradeConfirmed] = useState(false);
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const persistenceMessage = useLearningStore(
    ({ persistenceMessage }) => persistenceMessage,
  );
  const progressByConcept = useLearningStore(
    ({ learningState }) => learningState.conceptProgress,
  );
  const startConcept = useLearningStore((state) => state.startConcept);
  const markUnderstood = useLearningStore((state) => state.markUnderstood);
  const addEvidence = useLearningStore((state) => state.addEvidence);
  const confirmMastery = useLearningStore((state) => state.confirmMastery);
  const downgradeConcept = useLearningStore((state) => state.downgradeConcept);
  const progress = progressByConcept[concept.id];
  const status = getConceptStatus(progressByConcept, concept.id);
  const readiness = useMemo(
    () => getConceptReadiness(concept, progressByConcept),
    [concept, progressByConcept],
  );
  const masteryEligibility = useMemo(
    () => (progress ? getMasteryEligibility(concept, progress) : undefined),
    [concept, progress],
  );
  const prerequisiteById = useMemo(
    () => new Map(prerequisites.map((item) => [item.id, item])),
    [prerequisites],
  );
  const missingHard = readiness.missingHard.flatMap((id) => {
    const item = prerequisiteById.get(id);
    return item ? [item] : [];
  });
  const missingRecommended = readiness.missingRecommended.flatMap((id) => {
    const item = prerequisiteById.get(id);
    return item ? [item] : [];
  });
  const hardPrerequisites = prerequisites.filter(({ kind }) => kind === "hard");
  const requiredCriteria = concept.masteryCriteria.filter(({ required }) => required);
  const uncoveredCriteria = new Set(
    masteryEligibility?.uncoveredRequiredCriteria ?? requiredCriteria.map(({ id }) => id),
  );
  const writesBlocked = persistenceStatus === "blocked";
  const canRecordEvidence = status === "learning" || status === "understood";

  async function reportAction(
    action: () => Promise<{ readonly ok: boolean; readonly message?: string }>,
    successMessage: string,
  ) {
    const result = await action();
    setActionMessage(result.ok ? successMessage : (result.message ?? "操作未完成。"));
    return result.ok;
  }

  function toggleCriterion(criterionId: string) {
    setSelectedCriterionIds((current) =>
      current.includes(criterionId)
        ? current.filter((id) => id !== criterionId)
        : [...current, criterionId],
    );
  }

  async function handleEvidenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedCriterionIds.length === 0) {
      setActionMessage("请先选择这条证据能够证明的掌握标准。");
      return;
    }
    if (!evidenceTitle.trim() || !evidenceNote.trim()) {
      setActionMessage("请填写证据标题，并说明这条证据如何被检查。纯空格不能作为证据说明。");
      return;
    }

    const timestamp = new Date().toISOString();
    const evidence: MasteryEvidence = {
      id: createEvidenceId(concept.id),
      conceptId: concept.id,
      criterionIds: selectedCriterionIds,
      kind: evidenceKind,
      title: evidenceTitle.trim(),
      note: evidenceNote.trim(),
      result: "passed",
      completedAt: timestamp,
      reference: evidenceReference.trim() || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await reportAction(
      () => addEvidence(concept.id, evidence),
      "通过证据已保存；它不会自动把状态改为已掌握。",
    );
    if (saved) {
      setSelectedCriterionIds([]);
      setEvidenceTitle("");
      setEvidenceNote("");
      setEvidenceReference("");
      setMasteryConfirmed(false);
    }
  }

  async function handleDowngrade() {
    const targetStatus = status === "mastered" ? "understood" : "learning";
    const successMessage =
      status === "mastered"
        ? "已撤销当前掌握确认并保留为已理解；已有证据与历史时间仍保留。"
        : "已改为重新学习；已有证据仍保留。";
    const changed = await reportAction(
      () => downgradeConcept(concept.id, targetStatus),
      successMessage,
    );
    if (changed) {
      setDowngradeConfirmed(false);
      setMasteryConfirmed(false);
    }
  }

  return (
    <section
      aria-labelledby="concept-progress-title"
      className="mt-6 border-y border-[var(--color-border)] py-6"
      data-concept-progress
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-accent)] uppercase">
            Learning progress
          </p>
          <h2 className="mt-2 text-lg font-semibold" id="concept-progress-title">
            学习状态
          </h2>
          <p className="mt-2 text-sm font-semibold" data-progress-status={status}>
            {hydrated ? `当前：${statusContent[status].label}` : "正在恢复状态…"}
          </p>
          {hydrated ? (
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              {statusContent[status].description}
            </p>
          ) : null}
        </div>

        {hydrated && !writesBlocked && status === "not_started" ? (
          <button
            className="min-h-11 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            onClick={() =>
              void reportAction(
                () => startConcept(concept.id),
                "已记录为学习中，并保存到当前浏览器。",
              )
            }
            type="button"
          >
            开始学习
          </button>
        ) : null}
      </div>

      {hydrated ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby={`prerequisites-${concept.id}`}>
            <h3 className="font-semibold" id={`prerequisites-${concept.id}`}>
              前置条件
            </h3>
            <div className="mt-3 space-y-3 text-sm leading-6">
              <p data-hard-prerequisites>
                <span className="font-semibold">必须先理解：</span>
                {hardPrerequisites.length === 0
                  ? "无。"
                  : missingHard.length === 0
                    ? "已全部满足。"
                    : <PrerequisiteLinks prerequisites={missingHard} />}
              </p>
              <p className="text-[var(--color-muted)]" data-recommended-prerequisites>
                <span className="font-semibold text-[var(--color-ink)]">建议先学习：</span>
                {prerequisites.every(({ kind }) => kind !== "recommended")
                  ? "无。"
                  : missingRecommended.length === 0
                    ? "已满足现有建议。"
                    : <><PrerequisiteLinks prerequisites={missingRecommended} />；这是建议，不会阻止确认理解。</>}
              </p>
            </div>
          </section>

          <section aria-labelledby={`next-action-${concept.id}`}>
            <h3 className="font-semibold" id={`next-action-${concept.id}`}>
              下一步
            </h3>
            {status === "not_started" ? (
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                准备好后主动点击“开始学习”。阅读页面本身不会修改状态。
              </p>
            ) : null}
            {status === "learning" ? (
              <div className="mt-3">
                {missingHard.length > 0 ? (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    在确认理解本知识点前，还需要先理解：
                    <PrerequisiteLinks prerequisites={missingHard} />。
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    当你能解释核心概念并完成代表性基础练习时，可以主动确认已理解。
                  </p>
                )}
                <button
                  className="mt-3 min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-accent)] disabled:cursor-not-allowed disabled:text-[var(--color-muted)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                  disabled={missingHard.length > 0 || writesBlocked}
                  onClick={() =>
                    void reportAction(
                      () => markUnderstood(concept.id),
                      "已确认理解，并保存到当前浏览器。",
                    )
                  }
                  type="button"
                >
                  确认已理解
                </button>
              </div>
            ) : null}
            {status === "understood" ? (
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                继续用可检查的结果覆盖全部必需掌握标准；证据齐全后仍需主动确认掌握。
              </p>
            ) : null}
            {status === "mastered" && progress?.lastMasteredAt ? (
              <p className="mt-3 text-sm leading-6" data-mastered-at>
                最近确认掌握：{formatTimestamp(progress.lastMasteredAt)}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {hydrated ? (
        <section
          aria-labelledby={`mastery-evidence-${concept.id}`}
          className="mt-7 border-t border-[var(--color-border)] pt-6"
          data-mastery-evidence
        >
          <h3 className="text-base font-semibold" id={`mastery-evidence-${concept.id}`}>
            掌握要求与证据
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            这些标准来自本 Concept 的正式内容。保存一条通过证据只表示条件被覆盖，不会自动变成“已掌握”。
          </p>

          <ol className="mt-4 space-y-4" data-mastery-criteria>
            {concept.masteryCriteria.map((criterion, index) => (
              <li
                className="border-l-2 border-[var(--color-border)] pl-4"
                data-criterion-id={criterion.id}
                key={criterion.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {index + 1}. {criterion.description}
                  </p>
                  <span className="text-xs font-semibold text-[var(--color-muted)]">
                    {criterion.required ? "必需" : "可选"} · {uncoveredCriteria.has(criterion.id) ? "尚缺通过证据" : "已有通过证据"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  建议证据：{criterion.evidenceHint}
                </p>
              </li>
            ))}
          </ol>

          {canRecordEvidence && !writesBlocked ? (
            <form
              aria-labelledby={`evidence-form-${concept.id}`}
              className="mt-6 rounded-md border border-[var(--color-border)] p-4"
              onSubmit={handleEvidenceSubmit}
            >
              <fieldset>
                <legend className="text-sm font-semibold" id={`evidence-form-${concept.id}`}>
                  记录一条通过证据
                </legend>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                  选择这项结果实际证明的标准；不要勾选尚未由结果支持的项目。
                </p>
                <div className="mt-3 grid gap-2">
                  {concept.masteryCriteria.map((criterion) => (
                    <label className="flex min-h-10 items-start gap-3 text-sm leading-6" key={criterion.id}>
                      <input
                        checked={selectedCriterionIds.includes(criterion.id)}
                        className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                        onChange={() => toggleCriterion(criterion.id)}
                        type="checkbox"
                      />
                      <span>{criterion.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-semibold">
                  证据类型
                  <select
                    className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                    onChange={(event) => setEvidenceKind(event.target.value as EvidenceKind)}
                    value={evidenceKind}
                  >
                    {evidenceKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-sm font-semibold">
                  证据标题
                  <input
                    className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                    onChange={(event) => setEvidenceTitle(event.target.value)}
                    placeholder="例如：三组输入的分类统计脚本"
                    required
                    type="text"
                    value={evidenceTitle}
                  />
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold">
                如何检查这条证据
                <textarea
                  className="mt-2 block min-h-24 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal"
                  onChange={(event) => setEvidenceNote(event.target.value)}
                  placeholder="记录输入、产物、结果和你如何核对它，而不只是写“我会了”。"
                  required
                  value={evidenceNote}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                产物位置（可选）
                <input
                  className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                  onChange={(event) => setEvidenceReference(event.target.value)}
                  placeholder="本地路径、commit hash 或 http(s) 链接"
                  type="text"
                  value={evidenceReference}
                />
              </label>
              <button
                className="mt-4 min-h-11 rounded-md border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                type="submit"
              >
                保存通过证据
              </button>
            </form>
          ) : null}

          {progress?.evidence.length ? (
            <div className="mt-6" data-saved-evidence>
              <h4 className="text-sm font-semibold">已保存证据</h4>
              <ul className="mt-3 space-y-3">
                {progress.evidence.map((evidence) => (
                  <li className="rounded-md border border-[var(--color-border)] p-3 text-sm" key={evidence.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold">{evidence.title}</span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {evidence.result === "passed" ? "通过" : "未通过"} · {formatTimestamp(evidence.completedAt)}
                      </span>
                    </div>
                    <p className="mt-2 leading-6 text-[var(--color-muted)]">{evidence.note}</p>
                    <p className="mt-2 break-words text-xs text-[var(--color-muted)]">
                      覆盖标准：{evidence.criterionIds.map((criterionId) =>
                        concept.masteryCriteria.find(({ id }) => id === criterionId)?.description ?? criterionId,
                      ).join("；")}
                    </p>
                    {evidence.reference ? (
                      <p className="mt-1 break-all text-xs text-[var(--color-muted)]">产物位置：{evidence.reference}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {hydrated && status !== "mastered" ? (
        <section
          aria-labelledby={`mastery-confirmation-${concept.id}`}
          className="mt-7 border-t border-[var(--color-border)] pt-6"
          data-mastery-confirmation
        >
          <h3 className="font-semibold" id={`mastery-confirmation-${concept.id}`}>确认掌握</h3>
          {status !== "understood" ? (
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              还不能确认掌握：请先达到“已理解”，并为全部必需标准保存通过证据。
            </p>
          ) : masteryEligibility?.eligible ? (
            <div className="mt-3">
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  checked={masteryConfirmed}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                  onChange={(event) => setMasteryConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>我已检查上述通过证据，并主动确认自己能够独立达到全部必需掌握标准。</span>
              </label>
              <button
                className="mt-3 min-h-11 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                disabled={!masteryConfirmed || writesBlocked}
                onClick={() =>
                  void reportAction(
                    () => confirmMastery(concept.id, masteryConfirmed),
                    "已主动确认掌握，并保存完整确认快照。",
                  )
                }
                type="button"
              >
                确认已掌握
              </button>
            </div>
          ) : (
            <div className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              <p>还缺少以下必需证据：</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {requiredCriteria.filter(({ id }) => uncoveredCriteria.has(id)).map((criterion) => (
                  <li key={criterion.id}>{criterion.description}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      {hydrated && (status === "understood" || status === "mastered") ? (
        <details className="mt-7 border-t border-[var(--color-border)] pt-5" data-progress-downgrade>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-muted)]">
            调整为较早的学习状态
          </summary>
          <div className="mt-3 max-w-2xl">
            <p className="text-sm leading-6 text-[var(--color-muted)]">
              {status === "mastered"
                ? "这会撤销当前掌握确认并保留为已理解。已有证据、首次掌握时间和历史记录都会保留。"
                : "这会把当前状态改为学习中。已有证据和时间记录都会保留。"}
            </p>
            <label className="mt-3 flex items-start gap-3 text-sm leading-6">
              <input
                checked={downgradeConfirmed}
                className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                onChange={(event) => setDowngradeConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>我理解这会降低当前学习状态，并希望继续。</span>
            </label>
            <button
              className="mt-3 min-h-11 rounded-md border border-[var(--color-border)] px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!downgradeConfirmed || writesBlocked}
              onClick={() => void handleDowngrade()}
              type="button"
            >
              {status === "mastered" ? "撤销掌握确认" : "重新学习"}
            </button>
          </div>
        </details>
      ) : null}

      {hydrated && persistenceStatus !== "ready" ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]" role="status">
          本地持久化状态：{persistenceMessage ?? persistenceStatus}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-4 text-sm" data-progress-action-message>
        {actionMessage}
      </p>
    </section>
  );
}
