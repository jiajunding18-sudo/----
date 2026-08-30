"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { useLearningStore } from "@/features/progress/learning-store-provider";
import type { StudyLog } from "@/types";

import {
  selectDashboardSnapshot,
  type DashboardCatalog,
  type DashboardConcept,
  type DashboardProject,
} from "./dashboard-model";

const subscribeToLocalDate = () => () => undefined;

function localDateFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function useTodayLocalDate() {
  return useSyncExternalStore(
    subscribeToLocalDate,
    () => localDateFromDate(new Date()),
    () => undefined,
  );
}

function formatLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-");
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

function StudyLogAssociations({
  catalog,
  log,
}: {
  readonly catalog: DashboardCatalog;
  readonly log: StudyLog;
}) {
  const associations: Array<{
    readonly entity: DashboardConcept | DashboardProject | undefined;
    readonly hrefPrefix: "/knowledge" | "/projects";
    readonly id: string;
  }> = [
    ...log.conceptIds.map((id) => ({
      entity: catalog.concepts.find((concept) => concept.id === id),
      hrefPrefix: "/knowledge" as const,
      id,
    })),
    ...log.projectIds.map((id) => ({
      entity: catalog.projects.find((project) => project.id === id),
      hrefPrefix: "/projects" as const,
      id,
    })),
  ];

  if (associations.length === 0) return null;

  return (
    <ul className="mt-3 flex min-w-0 flex-wrap gap-2 text-xs">
      {associations.map(({ entity, hrefPrefix, id }) => (
        <li className="min-w-0" key={`${hrefPrefix}-${id}`}>
          {entity?.publicationStatus === "published" ? (
            <Link
              className="inline-flex min-h-8 max-w-full items-center rounded-full border border-[var(--color-border)] px-3 font-semibold text-[var(--color-accent)] underline underline-offset-4"
              href={`${hrefPrefix}/${entity.slug}/`}
            >
              <span className="truncate">{entity.title}</span>
            </Link>
          ) : (
            <span className="inline-flex min-h-8 max-w-full items-center rounded-full border border-dashed border-[var(--color-border)] px-3 text-[var(--color-muted)]">
              <span className="truncate">
                {entity
                  ? `${entity.title}（当前未发布）`
                  : `关联实体当前不可用：${id}`}
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DashboardConsole({
  catalog,
}: {
  readonly catalog: DashboardCatalog;
}) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const persistenceMessage = useLearningStore(
    ({ persistenceMessage }) => persistenceMessage,
  );
  const state = useLearningStore(({ learningState }) => learningState);
  const todayLocalDate = useTodayLocalDate();
  const snapshot = useMemo(
    () =>
      todayLocalDate
        ? selectDashboardSnapshot(catalog, state, todayLocalDate)
        : undefined,
    [catalog, state, todayLocalDate],
  );

  if (!hydrated || !snapshot) {
    return (
      <section
        aria-busy="true"
        aria-labelledby="dashboard-console-title"
        className="mt-8 border-t border-[var(--color-border)] pt-7"
        data-dashboard-console="loading"
      >
        <h2 className="text-2xl font-semibold" id="dashboard-console-title">
          今日学习控制台
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          正在恢复浏览器本地学习状态…
        </p>
      </section>
    );
  }

  const { currentProject, learningConcepts, progress, studyLog } = snapshot;
  const weeklyTargetMinutes = state.preferences.weeklyTargetMinutes;
  const remainingWeeklyMinutes = Math.max(
    weeklyTargetMinutes - studyLog.weekMinutes,
    0,
  );
  const conceptTitles = new Map(
    catalog.concepts.map(({ id, title }) => [id, title]),
  );

  return (
    <div className="mt-10" data-dashboard-console="ready">
      {persistenceStatus !== "ready" ? (
        <p
          className="mb-6 border-l-2 border-[var(--color-accent)] pl-4 text-sm leading-6 text-[var(--color-muted)]"
          role="status"
        >
          本地数据以安全默认状态显示：
          {persistenceMessage ?? persistenceStatus}
        </p>
      ) : null}

      <section
        aria-labelledby="dashboard-learning-title"
        className="border-y border-[var(--color-border)] py-7"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          In progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="dashboard-learning-title">
          当前学习中
        </h2>
        {learningConcepts.length > 0 ? (
          <ul className="mt-5 divide-y divide-[var(--color-border)]" data-dashboard-learning-list>
            {learningConcepts.map((concept) => (
              <li className="py-4 first:pt-0 last:pb-0" key={concept.id}>
                <Link
                  className="inline-flex min-h-11 items-center font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                  data-dashboard-learning-concept-id={concept.id}
                  href={`/knowledge/${concept.slug}/`}
                >
                  {concept.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div data-dashboard-learning-empty>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              当前没有处于“学习中”的已发布 Concept。上方 Next Step 是正式可执行入口。
            </p>
            <nav aria-label="浏览学习路线" className="mt-4 flex flex-wrap gap-3">
              <Link
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
                href="/roadmap/"
              >
                浏览 Roadmap
              </Link>
              <Link
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
                href="/knowledge/"
              >
                浏览 Knowledge
              </Link>
            </nav>
          </div>
        )}
      </section>

      <section aria-labelledby="dashboard-project-title" className="mt-9">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Active project
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="dashboard-project-title">
          当前 Project
        </h2>
        {currentProject ? (
          <div
            className="mt-5 border-l-2 border-[var(--color-accent)] pl-5"
            data-dashboard-current-project={currentProject.project.id}
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold">{currentProject.project.title}</h3>
              <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                进行中
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]" data-dashboard-project-readiness>
              {currentProject.readiness.knowledgeReady
                ? "知识前置已满足"
                : `仍有 ${currentProject.readiness.missingHardConceptIds.length} 个 hard 知识缺口`}
              {currentProject.readiness.environmentReady === true
                ? "；所选执行路径环境已就绪。"
                : currentProject.readiness.environmentReady === false
                  ? `；所选执行路径仍缺 ${currentProject.readiness.missingEnvironmentRequirementIds.length} 项环境要求。`
                  : "；尚未形成可核对的执行路径环境结果。"}
            </p>
            {currentProject.readiness.missingHardConceptIds.length > 0 ? (
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]" data-dashboard-project-gaps>
                当前缺口：
                {currentProject.readiness.missingHardConceptIds
                  .map((id) => conceptTitles.get(id) ?? id)
                  .join("、")}
              </p>
            ) : null}
            <p className="mt-4 text-sm font-semibold">下一动作</p>
            <p className="mt-1 text-sm leading-6" data-dashboard-project-next-action>
              {currentProject.progress.nextAction}
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
              href={`/projects/${currentProject.project.slug}/`}
            >
              进入 Project
            </Link>
          </div>
        ) : (
          <div data-dashboard-project-empty>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              当前没有正在执行的已发布 Project。浏览项目不会自动开始执行记录。
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
              href="/projects/"
            >
              浏览 Projects
            </Link>
          </div>
        )}
      </section>

      <section
        aria-labelledby="dashboard-study-time-title"
        className="mt-10 border-y border-[var(--color-border)] py-7"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Manual study time
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="dashboard-study-time-title">
          今日与本周学习
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          这里只汇总你在 Study Log 中主动填写的分钟数，不使用页面停留时间。
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-[var(--color-muted)]">今日</dt>
            <dd className="mt-1 text-2xl font-semibold" data-dashboard-today-minutes>
              {studyLog.todayMinutes} 分钟
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--color-muted)]">本周</dt>
            <dd className="mt-1 text-2xl font-semibold" data-dashboard-week-minutes>
              {studyLog.weekMinutes} 分钟
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs font-semibold text-[var(--color-muted)]">最近学习日期</dt>
            <dd className="mt-1 text-base font-semibold" data-dashboard-last-study-date>
              {studyLog.lastStudyDate
                ? formatLocalDate(studyLog.lastStudyDate)
                : "尚无学习记录"}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm leading-6 text-[var(--color-muted)]" data-dashboard-weekly-target>
          {weeklyTargetMinutes > 0
            ? `本周目标 ${weeklyTargetMinutes} 分钟；${remainingWeeklyMinutes > 0 ? `尚余 ${remainingWeeklyMinutes} 分钟` : "本周目标已达到"}。`
            : "当前未设置本周学习时长目标。"}
        </p>
      </section>

      <section aria-labelledby="dashboard-progress-title" className="mt-10">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
          Route progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="dashboard-progress-title">
          Progress 总览
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          只统计当前 published + required Concept；接触、理解与掌握保持三个独立视角。
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3" data-dashboard-progress>
          {[
            ["接触", progress.started, "started"],
            ["理解", progress.understood, "understood"],
            ["掌握", progress.mastered, "mastered"],
          ].map(([label, value, key]) => (
            <div className="border-l-2 border-[var(--color-border)] pl-3 sm:pl-4" key={key}>
              <dt className="text-xs font-semibold text-[var(--color-muted)]">{label}</dt>
              <dd className="mt-1 text-xl font-semibold" data-dashboard-progress-kind={key}>
                {value} / {progress.total}
              </dd>
            </div>
          ))}
        </dl>
        <Link
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4"
          href="/knowledge/"
        >
          查看正式 Concept
        </Link>
      </section>

      <section aria-labelledby="dashboard-recent-logs-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
              Recent reflection
            </p>
            <h2 className="mt-2 text-2xl font-semibold" id="dashboard-recent-logs-title">
              最近 Study Log
            </h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4"
            href="/study-log/"
          >
            查看完整历史
          </Link>
        </div>
        {studyLog.recentLogs.length > 0 ? (
          <ol
            className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]"
            data-dashboard-recent-logs
          >
            {studyLog.recentLogs.map((log) => (
              <li className="min-w-0 py-5" data-dashboard-study-log-id={log.id} key={log.id}>
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  <time dateTime={log.localDate}>{formatLocalDate(log.localDate)}</time>
                  <span aria-hidden="true"> · </span>
                  <span>{log.minutes} 分钟</span>
                </p>
                <p className="mt-2 line-clamp-2 min-w-0 leading-6">{log.learned}</p>
                <StudyLogAssociations catalog={catalog} log={log} />
              </li>
            ))}
          </ol>
        ) : (
          <div data-dashboard-recent-logs-empty>
            <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
              还没有 Study Log。只有你主动保存的记录才会出现在这里。
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
              href="/study-log/"
            >
              记录真实学习
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
