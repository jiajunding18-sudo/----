"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type {
  RoadmapCheckpointGateView,
  RoadmapOverviewStageView,
  RoadmapOverviewView,
} from "./roadmap-model";

const trackGoalLabels = {
  understand: "理解",
  master: "主修掌握",
} as const;

function focusStageDetails(stageId: string) {
  const details = document.getElementById(`roadmap-stage-${stageId}`);
  if (!(details instanceof HTMLDetailsElement)) {
    return;
  }

  details.open = true;
  details.scrollIntoView({ behavior: "auto", block: "start" });
  details.querySelector<HTMLElement>("summary")?.focus();
}

function StageStatus({ stage }: { readonly stage: RoadmapOverviewStageView }) {
  if (stage.contentStatus === "available") {
    return (
      <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
        可学习
      </span>
    );
  }

  return (
    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
      已规划 · 正式学习内容尚未展开
    </span>
  );
}

function CheckpointGateLeaf({
  gate,
  onInspectStage,
}: {
  readonly gate: Extract<
    RoadmapCheckpointGateView,
    { readonly kind: "checkpoint" | "track-goal-checkpoint" }
  >;
  readonly onInspectStage: (stageId: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm leading-6">
        先通过
        <button
          className="mx-1 rounded-sm font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
          onClick={() => onInspectStage(gate.stage.id)}
          type="button"
        >
          {gate.stage.title}
        </button>
        checkpoint。
        {gate.kind === "track-goal-checkpoint"
          ? `同时，「${gate.track.title}」需要选择「${trackGoalLabels[gate.minimumTrackGoal]}」目标。`
          : ""}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
        这个前置节点用于证明你已经能够：{gate.stage.primaryOutcome}
      </p>
    </div>
  );
}

function CheckpointGateExplanation({
  gate,
  onInspectStage,
}: {
  readonly gate: RoadmapCheckpointGateView;
  readonly onInspectStage: (stageId: string) => void;
}) {
  if (gate.kind === "checkpoint" || gate.kind === "track-goal-checkpoint") {
    return <CheckpointGateLeaf gate={gate} onInspectStage={onInspectStage} />;
  }

  return (
    <div data-gate-operator={gate.kind}>
      <p className="text-sm font-semibold">
        {gate.kind === "allOf"
          ? "以下条件都需要满足："
          : "以下条件满足任意一项即可："}
      </p>
      <ul className="mt-3 space-y-4 border-l border-[var(--color-border)] pl-4">
        {gate.gates.map((childGate, index) => (
          <li key={`${childGate.kind}:${index}`}>
            <CheckpointGateExplanation
              gate={childGate}
              onInspectStage={onInspectStage}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageEntryGate({
  stage,
  onInspectStage,
}: {
  readonly stage: RoadmapOverviewStageView;
  readonly onInspectStage: (stageId: string) => void;
}) {
  return (
    <section aria-labelledby={`${stage.id}-entry-gate-title`}>
      <h5 className="text-base font-semibold" id={`${stage.id}-entry-gate-title`}>
        进入本阶段前，你需要
      </h5>
      <div className="mt-3">
        {stage.entryGate ? (
          <CheckpointGateExplanation
            gate={stage.entryGate}
            onInspectStage={onInspectStage}
          />
        ) : (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            没有 checkpoint 级入口门槛。具体 Concept 发布后，仍以各自的 hard dependency 判断学习前置。
          </p>
        )}
      </div>
    </section>
  );
}

function StageExitCriteria({
  stage,
}: {
  readonly stage: RoadmapOverviewStageView;
}) {
  return (
    <section aria-labelledby={`${stage.id}-checkpoint-title`}>
      <h5 className="text-base font-semibold" id={`${stage.id}-checkpoint-title`}>
        完成本 checkpoint 需要证明
      </h5>
      <ol className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {stage.exitCriteria.map(({ criterion, conditionSummary }, index) => (
          <li
            className="grid gap-2 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]"
            data-exit-criterion-id={criterion.id}
            key={criterion.id}
          >
            <span className="text-xs font-semibold tabular-nums text-[var(--color-accent)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6">{criterion.description}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                {criterion.required ? "必需能力证据" : "可选能力证据"} · {conditionSummary}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {stage.retestAfterDays ? (
        <p className="mt-4 border-l-2 border-[var(--color-accent)] pl-4 text-sm leading-6 text-[var(--color-muted)]">
          首次满足入口、内容、项目门槛和能力证据后，需要间隔至少 {stage.retestAfterDays} 天再次验证；阅读完成或一次偶然成功不能代替复测。
        </p>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
          本 checkpoint 没有单独配置延迟复测；仍需为所有生效的必需标准提供可检查证据。
        </p>
      )}
    </section>
  );
}

function StageProjectGates({
  stage,
}: {
  readonly stage: RoadmapOverviewStageView;
}) {
  return (
    <section aria-labelledby={`${stage.id}-project-gates-title`}>
      <h5 className="text-base font-semibold" id={`${stage.id}-project-gates-title`}>
        项目验证门槛
      </h5>
      {stage.projectGates.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          catalog 没有为这个 checkpoint 配置必须完成的 Project gate；关联项目仍可作为能力证据，但不会被误算成正式门槛。
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {stage.projectGates.map(({ conditionSummary, project }) => (
            <li className="py-4" data-project-gate-id={project.id} key={project.id}>
              <div className="flex flex-wrap items-center gap-2">
                {project.publicationStatus === "published" ? (
                  <Link
                    className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
                    href={`/projects/${project.slug}/`}
                  >
                    {project.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{project.title}</span>
                )}
                <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
                  {project.publicationStatus === "published"
                    ? "项目内容已发布"
                    : "项目已规划 · 正文未发布"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                {conditionSummary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StageDetails({
  stage,
  onInspectStage,
}: {
  readonly stage: RoadmapOverviewStageView;
  readonly onInspectStage: (stageId: string) => void;
}) {
  const isShared = stage.tracks.length > 1;

  return (
    <details
      className="group border-b border-[var(--color-border)] py-1"
      data-content-status={stage.contentStatus}
      data-entry-gate-kind={stage.entryGate?.kind ?? "none"}
      data-overview-stage-id={stage.id}
      data-shared-checkpoint={isShared ? "true" : "false"}
      id={`roadmap-stage-${stage.id}`}
    >
      <summary className="cursor-pointer list-none py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="text-lg font-semibold tracking-[-0.02em]">
                {stage.title}
              </h4>
              <StageStatus stage={stage} />
              {isShared ? (
                <span className="rounded-full border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                  共享能力 · {stage.tracks.length} 个方向共同需要
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              {stage.summary}
            </p>
          </div>
          <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold">所属 Track</p>
              <p className="mt-1 leading-6 text-[var(--color-muted)]">
                {stage.tracks.map(({ title }) => title).join(" / ")}
              </p>
            </div>
            <div>
              <p className="font-semibold">正式内容</p>
              <p className="mt-1 leading-6 text-[var(--color-muted)]">
                {stage.conceptCount} 个已发布 Concept · 预计 {stage.estimatedHours.min}–{stage.estimatedHours.max} 小时
              </p>
            </div>
            <p className="text-xs font-semibold text-[var(--color-accent)] sm:col-span-2">
              展开查看进入条件、能力 checkpoint 与项目门槛
            </p>
          </div>
        </div>
      </summary>

      <div className="mb-6 border-l-2 border-[var(--color-border)] pl-4 sm:pl-6">
        {stage.contentStatus === "planned" ? (
          <p className="mb-6 bg-[var(--color-surface-subtle)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
            已规划 · 正式学习内容尚未展开。下面展示的是正式路线条件和能力标准，不代表课程正文已经发布。
          </p>
        ) : (
          <Link
            className="mb-6 inline-flex min-h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:border-[var(--color-accent)]"
            href={`#${stage.id}-detail`}
          >
            进入正式 Stage 内容（{stage.conceptCount} 个 Concept）
          </Link>
        )}

        <div className="grid gap-8 xl:grid-cols-2">
          <section aria-labelledby={`${stage.id}-outcomes-title`}>
            <h5 className="text-base font-semibold" id={`${stage.id}-outcomes-title`}>
              本阶段学完后，你应该能够
            </h5>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--color-muted)]">
              {stage.outcomes.map((outcome) => (
                <li className="flex gap-3" key={outcome}>
                  <span aria-hidden="true" className="text-[var(--color-accent)]">
                    —
                  </span>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>
          <StageEntryGate stage={stage} onInspectStage={onInspectStage} />
          <StageExitCriteria stage={stage} />
          <StageProjectGates stage={stage} />
        </div>
      </div>
    </details>
  );
}

export function RoadmapRouteExplorer({
  overview,
}: {
  readonly overview: RoadmapOverviewView;
}) {
  const [activeFocus, setActiveFocus] = useState<string>("all");
  const pendingStageId = useRef<string | undefined>(undefined);
  const activeTrack = overview.tracks.find(
    ({ track }) => track.id === activeFocus,
  );
  const visibleStages =
    activeFocus === "all"
      ? overview.stages
      : overview.stages.filter((stage) =>
          stage.tracks.some(({ id }) => id === activeFocus),
        );

  useEffect(() => {
    const stageId = pendingStageId.current;
    if (activeFocus !== "all" || !stageId) {
      return;
    }

    pendingStageId.current = undefined;
    requestAnimationFrame(() => focusStageDetails(stageId));
  }, [activeFocus]);

  function inspectStage(stageId: string) {
    if (activeFocus === "all") {
      requestAnimationFrame(() => focusStageDetails(stageId));
      return;
    }

    pendingStageId.current = stageId;
    setActiveFocus("all");
  }

  return (
    <section
      aria-labelledby="roadmap-overview-title"
      className="mt-12"
      data-roadmap-overview
    >
      <div className="max-w-4xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          University route overview
        </p>
        <h2
          className="mt-2 text-3xl font-semibold tracking-[-0.03em]"
          id="roadmap-overview-title"
        >
          大学阶段全局路线
        </h2>
        <p className="mt-4 leading-7 text-[var(--color-muted)]">
          先选择路线范围，再展开一个 Stage 查看进入条件与能力 checkpoint。筛选只改变阅读范围，不改变正式依赖、路线目标或学习状态。
        </p>
      </div>

      <nav aria-label="Roadmap Track 聚焦" className="mt-7">
        <p className="text-sm font-semibold">聚焦路线</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            aria-pressed={activeFocus === "all"}
            className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${
              activeFocus === "all"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
            }`}
            data-track-focus="all"
            onClick={() => setActiveFocus("all")}
            type="button"
          >
            全部路线
          </button>
          {overview.tracks.map(({ track }) => (
            <button
              aria-pressed={activeFocus === track.id}
              className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${
                activeFocus === track.id
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
              }`}
              data-track-focus={track.id}
              key={track.id}
              onClick={() => setActiveFocus(track.id)}
              type="button"
            >
              {track.title}
            </button>
          ))}
        </div>
      </nav>

      <div
        aria-live="polite"
        className="mt-6 border-y border-[var(--color-border)] py-5"
        data-active-track={activeFocus}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0 max-w-3xl">
            <h3 className="text-xl font-semibold">
              {activeTrack ? activeTrack.track.title : "全部路线"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              {activeTrack
                ? activeTrack.track.summary
                : "按 catalog 的推荐 order 展示全部唯一 checkpoint；Stage 编号用于分类，entryGate 才是跨阶段能力条件。"}
            </p>
          </div>
          <p className="w-fit rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
            {visibleStages.length} 个唯一 checkpoint
            {activeTrack
              ? ` · 默认目标：${trackGoalLabels[activeTrack.track.defaultGoal]}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-4" data-focused-stage-list>
        {visibleStages.map((stage) => (
          <StageDetails
            key={stage.id}
            onInspectStage={inspectStage}
            stage={stage}
          />
        ))}
      </div>
    </section>
  );
}
