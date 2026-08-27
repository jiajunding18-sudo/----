import Link from "next/link";

import type {
  RoadmapStageView,
  RoadmapTrackView,
  RoadmapView,
} from "./roadmap-model";

const trackGoalLabels = {
  understand: "理解",
  master: "主修掌握",
} as const;

function StageStatus({ stage }: { readonly stage: RoadmapStageView }) {
  if (stage.stage.contentStatus === "available") {
    return (
      <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
        可学习
      </span>
    );
  }

  return (
    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
      已规划 · 尚未展开
    </span>
  );
}

function CheckpointSummary({ stage }: { readonly stage: RoadmapStageView }) {
  const criterionCount = stage.stage.exitCriteria.length;
  const conditionalCount = stage.conditionalExitCriterionCount;

  return (
    <>
      {criterionCount} 项能力证据
      {conditionalCount > 0 ? `，其中 ${conditionalCount} 项按 Track 目标生效` : ""}
      {stage.stage.retestAfterDays
        ? `；满足后 ${stage.stage.retestAfterDays} 天复测`
        : ""}
    </>
  );
}

function TrackStageList({ trackView }: { readonly trackView: RoadmapTrackView }) {
  return (
    <ol
      aria-label={`${trackView.track.title} Stage 推荐展示顺序`}
      className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]"
    >
      {trackView.stages.map((stage) => (
        <li className="py-6" key={`${trackView.track.id}:${stage.stage.id}`}>
          <article
            aria-labelledby={`${trackView.track.id}-${stage.stage.id}-overview-title`}
            className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
            data-content-status={stage.stage.contentStatus}
            data-entry-gate-kind={stage.entryGate?.kind ?? "none"}
            data-overview-stage-id={stage.stage.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-3">
                <h4
                  className="min-w-0 text-lg font-semibold tracking-[-0.02em]"
                  id={`${trackView.track.id}-${stage.stage.id}-overview-title`}
                >
                  {stage.stage.title}
                </h4>
                <StageStatus stage={stage} />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                {stage.stage.summary}
              </p>
              {stage.stage.contentStatus === "available" ? (
                <Link
                  className="mt-4 inline-flex min-h-10 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:border-[var(--color-accent)]"
                  href={`#${stage.stage.id}-detail`}
                >
                  查看正式内容（{stage.concepts.length} 个 Concept）
                </Link>
              ) : (
                <p className="mt-4 text-xs font-semibold text-[var(--color-muted)]">
                  0 个已发布 Concept；路线骨架已校验，正式学习内容尚未展开。
                </p>
              )}
            </div>

            <dl className="grid min-w-0 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-semibold">所属 Track</dt>
                <dd className="mt-1 leading-6 text-[var(--color-muted)]">
                  {stage.tracks.map(({ title }) => title).join(" / ")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-semibold">预计学习目标</dt>
                <dd className="mt-1 leading-6 text-[var(--color-muted)]">
                  {stage.stage.outcomes[0]}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="font-semibold">entryGate</dt>
                <dd className="mt-1 break-words leading-6 text-[var(--color-muted)]">
                  {stage.entryGateSummary}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="font-semibold">Checkpoint / exit</dt>
                <dd className="mt-1 leading-6 text-[var(--color-muted)]">
                  <CheckpointSummary stage={stage} />
                </dd>
              </div>
            </dl>
          </article>
        </li>
      ))}
    </ol>
  );
}

export function RoadmapOverview({ roadmap }: { readonly roadmap: RoadmapView }) {
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
          下方顺序用于建立阅读方位，不代表 Stage 必须逐个线性解锁。真正的跨阶段能力条件来自每个 Stage 的 entryGate；“全部满足”和“满足其中一项”会按 catalog 原始结构明确显示。
        </p>
      </div>

      <div className="mt-7 grid gap-4 border-y border-[var(--color-border)] py-5 text-sm sm:grid-cols-3">
        <div>
          <p className="font-semibold">可学习</p>
          <p className="mt-1 leading-6 text-[var(--color-muted)]">
            已有正式 Concept，可进入下方详细路线。
          </p>
        </div>
        <div>
          <p className="font-semibold">已规划 · 尚未展开</p>
          <p className="mt-1 leading-6 text-[var(--color-muted)]">
            只有 Stage、入口与出口骨架，没有伪造课程正文。
          </p>
        </div>
        <div>
          <p className="font-semibold">高级分支</p>
          <p className="mt-1 leading-6 text-[var(--color-muted)]">
            从公共能力分流，可按 entryGate 并行推进或择一主修。
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-[var(--color-border)]">
        {roadmap.tracks.map((trackView) => (
          <section
            aria-labelledby={`${trackView.track.id}-title`}
            className="py-10"
            data-track-id={trackView.track.id}
            key={trackView.track.id}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0 max-w-3xl">
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
                  {trackView.track.kind === "common"
                    ? "Common foundation"
                    : "Advanced branch"}
                </p>
                <h3
                  className="mt-2 text-2xl font-semibold tracking-[-0.02em]"
                  id={`${trackView.track.id}-title`}
                >
                  {trackView.track.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                  {trackView.track.summary}
                </p>
              </div>
              <p className="w-fit rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                默认目标：{trackGoalLabels[trackView.track.defaultGoal]} · {trackView.stages.length} 个 checkpoint
              </p>
            </div>

            <p className="mt-4 text-xs leading-5 text-[var(--color-muted)]">
              {trackView.availableStageCount} 个可学习，{trackView.plannedStageCount} 个已规划。一个 checkpoint 同属多个 Track 时会在对应分区重复出现，但始终引用同一个稳定 Stage ID。
            </p>

            <TrackStageList trackView={trackView} />
          </section>
        ))}
      </div>
    </section>
  );
}
