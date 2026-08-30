"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { useLearningStore } from "@/features/progress/learning-store-provider";
import type { StudyLog } from "@/types";

import {
  selectStudyLogSummary,
  sortStudyLogsByDateDescending,
  type StudyLogInput,
} from "./study-log-domain";

interface StudyLogCatalogEntity {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
}

interface StudyLogCatalog {
  readonly concepts: readonly StudyLogCatalogEntity[];
  readonly projects: readonly StudyLogCatalogEntity[];
}

interface EditorState {
  readonly localDate: string;
  readonly minutes: string;
  readonly conceptIds: readonly string[];
  readonly projectIds: readonly string[];
  readonly learned: string;
  readonly blockers: string;
  readonly completed: string;
  readonly tomorrowPlan: string;
}

const emptyEditor: EditorState = {
  localDate: "",
  minutes: "",
  conceptIds: [],
  projectIds: [],
  learned: "",
  blockers: "",
  completed: "",
  tomorrowPlan: "",
};

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

function editorFromLog(log: StudyLog): EditorState {
  return {
    localDate: log.localDate,
    minutes: String(log.minutes),
    conceptIds: log.conceptIds,
    projectIds: log.projectIds,
    learned: log.learned,
    blockers: log.blockers,
    completed: log.completed,
    tomorrowPlan: log.tomorrowPlan,
  };
}

function toggleId(ids: readonly string[], id: string, checked: boolean) {
  return checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id);
}

function StudyLogAssociations({
  entities,
  ids,
  kind,
}: {
  readonly entities: readonly StudyLogCatalogEntity[];
  readonly ids: readonly string[];
  readonly kind: "concept" | "project";
}) {
  if (ids.length === 0) return null;
  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-xs" data-study-log-associations={kind}>
      {ids.map((id) => {
        const entity = byId.get(id);
        if (entity?.publicationStatus === "published") {
          return (
            <li key={id}>
              <Link
                className="inline-flex min-h-8 items-center rounded-full border border-[var(--color-border)] px-3 font-semibold text-[var(--color-accent)] underline underline-offset-4"
                href={`/${kind === "concept" ? "knowledge" : "projects"}/${entity.slug}/`}
              >
                {entity.title}
              </Link>
            </li>
          );
        }
        return (
          <li
            className="inline-flex min-h-8 items-center rounded-full border border-dashed border-[var(--color-border)] px-3 text-[var(--color-muted)]"
            key={id}
          >
            {entity ? `${entity.title}（当前未发布）` : `关联实体当前不可用：${id}`}
          </li>
        );
      })}
    </ul>
  );
}

export function StudyLogExperience({ catalog }: { readonly catalog: StudyLogCatalog }) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const logs = useLearningStore(({ learningState }) => learningState.studyLogs);
  const createStudyLog = useLearningStore(({ createStudyLog }) => createStudyLog);
  const updateStudyLog = useLearningStore(({ updateStudyLog }) => updateStudyLog);
  const deleteStudyLog = useLearningStore(({ deleteStudyLog }) => deleteStudyLog);
  const todayLocalDate = useTodayLocalDate();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [editingId, setEditingId] = useState<string>();
  const [deleteCandidateId, setDeleteCandidateId] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const publishedConcepts = catalog.concepts.filter(
    ({ publicationStatus }) => publicationStatus === "published",
  );
  const publishedProjects = catalog.projects.filter(
    ({ publicationStatus }) => publicationStatus === "published",
  );
  const conceptById = new Map(catalog.concepts.map((entity) => [entity.id, entity]));
  const projectById = new Map(catalog.projects.map((entity) => [entity.id, entity]));
  const unavailableConceptIds = editor.conceptIds.filter(
    (id) => conceptById.get(id)?.publicationStatus !== "published",
  );
  const unavailableProjectIds = editor.projectIds.filter(
    (id) => projectById.get(id)?.publicationStatus !== "published",
  );
  const sortedLogs = useMemo(() => sortStudyLogsByDateDescending(logs), [logs]);
  const summary = useMemo(
    () =>
      todayLocalDate
        ? selectStudyLogSummary(logs, todayLocalDate, 3)
        : undefined,
    [logs, todayLocalDate],
  );

  function resetEditor() {
    setEditor(emptyEditor);
    setEditingId(undefined);
  }

  function showError(nextError: string) {
    setMessage("");
    setError(nextError);
  }

  async function submitLog() {
    const localDate = editor.localDate || todayLocalDate;
    const minutes = Number(editor.minutes);
    if (!localDate) {
      showError("请选择学习日期。");
      return;
    }
    if (!Number.isInteger(minutes) || minutes <= 0) {
      showError("学习时长必须是大于 0 的整数分钟，并由你主动填写。");
      return;
    }

    const input: StudyLogInput = {
      ...editor,
      localDate,
      minutes,
    };
    const result = editingId
      ? await updateStudyLog(editingId, input)
      : await createStudyLog(input);
    if (!result.ok) {
      showError(result.message);
      return;
    }

    setError("");
    setMessage(
      editingId
        ? result.changed
          ? "学习记录已更新并保存到当前浏览器。"
          : "学习记录没有变化。"
        : "学习记录已创建并保存到当前浏览器。",
    );
    resetEditor();
  }

  async function confirmDelete(logId: string) {
    const result = await deleteStudyLog(logId, true);
    if (!result.ok) {
      showError(result.message);
      return;
    }
    if (editingId === logId) resetEditor();
    setDeleteCandidateId(undefined);
    setError("");
    setMessage("学习记录已删除；Concept、Project 与 NextStep 状态没有改变。");
  }

  if (!hydrated || !todayLocalDate) {
    return (
      <p className="mt-10 text-sm text-[var(--color-muted)]" role="status">
        正在恢复浏览器本地学习记录…
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-10" data-study-log-experience>
      <section aria-labelledby="study-summary-title">
        <h2 className="text-xl font-semibold" id="study-summary-title">
          学习时间摘要
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          仅汇总你主动保存的日志分钟数；页面停留和状态变化不会生成时长。
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <dt className="text-sm text-[var(--color-muted)]">今日学习</dt>
            <dd className="mt-2 text-2xl font-semibold" data-study-today-minutes>
              {summary?.todayMinutes ?? 0} 分钟
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <dt className="text-sm text-[var(--color-muted)]">本周学习</dt>
            <dd className="mt-2 text-2xl font-semibold" data-study-week-minutes>
              {summary?.weekMinutes ?? 0} 分钟
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <dt className="text-sm text-[var(--color-muted)]">当前连续记录</dt>
            <dd className="mt-2 text-2xl font-semibold" data-study-streak-days>
              {summary?.streakDays ?? 0} 天
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <dt className="text-sm text-[var(--color-muted)]">最近学习日期</dt>
            <dd className="mt-2 text-base font-semibold" data-study-last-date>
              {summary?.lastStudyDate ? formatLocalDate(summary.lastStudyDate) : "尚无记录"}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="study-log-form-title"
        className="border-t border-[var(--color-border)] pt-8"
        data-study-log-form
      >
        <h2 className="text-xl font-semibold" id="study-log-form-title">
          {editingId ? "编辑学习记录" : "新建学习记录"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          时间必须由你主动填写。本轮不使用后台计时或页面停留估算。
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold" htmlFor="study-log-date">
            学习日期
            <input
              className="min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
              id="study-log-date"
              max={todayLocalDate}
              onChange={(event) =>
                setEditor((current) => ({ ...current, localDate: event.target.value }))
              }
              required
              type="date"
              value={editor.localDate || todayLocalDate}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="study-log-minutes">
            学习时长（分钟）
            <input
              className="min-h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
              id="study-log-minutes"
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                setEditor((current) => ({ ...current, minutes: event.target.value }))
              }
              placeholder="例如 45"
              required
              step="1"
              type="number"
              value={editor.minutes}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold" htmlFor="study-log-learned">
            学习了什么
            <textarea
              className="min-h-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal leading-6"
              id="study-log-learned"
              onChange={(event) =>
                setEditor((current) => ({ ...current, learned: event.target.value }))
              }
              required
              value={editor.learned}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="study-log-blockers">
            遇到什么问题
            <textarea
              className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal leading-6"
              id="study-log-blockers"
              onChange={(event) =>
                setEditor((current) => ({ ...current, blockers: event.target.value }))
              }
              value={editor.blockers}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="study-log-completed">
            完成了什么
            <textarea
              className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal leading-6"
              id="study-log-completed"
              onChange={(event) =>
                setEditor((current) => ({ ...current, completed: event.target.value }))
              }
              value={editor.completed}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="study-log-plan">
            下一步准备做什么
            <textarea
              className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal leading-6"
              id="study-log-plan"
              onChange={(event) =>
                setEditor((current) => ({ ...current, tomorrowPlan: event.target.value }))
              }
              value={editor.tomorrowPlan}
            />
          </label>
        </div>

        <fieldset className="mt-7">
          <legend className="text-sm font-semibold">关联 Concept（可多选）</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {publishedConcepts.map((concept) => (
              <label
                className="flex min-w-0 gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm leading-6"
                key={concept.id}
              >
                <input
                  checked={editor.conceptIds.includes(concept.id)}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      conceptIds: toggleId(
                        current.conceptIds,
                        concept.id,
                        event.target.checked,
                      ),
                    }))
                  }
                  type="checkbox"
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{concept.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-sm font-semibold">关联 Project（可多选）</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {publishedProjects.map((project) => (
              <label
                className="flex min-w-0 gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm leading-6"
                key={project.id}
              >
                <input
                  checked={editor.projectIds.includes(project.id)}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      projectIds: toggleId(
                        current.projectIds,
                        project.id,
                        event.target.checked,
                      ),
                    }))
                  }
                  type="checkbox"
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{project.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {unavailableConceptIds.length + unavailableProjectIds.length > 0 ? (
          <fieldset className="mt-7 rounded-md border border-dashed border-[var(--color-border)] p-4">
            <legend className="px-1 text-sm font-semibold">历史不可用关联</legend>
            <p className="text-sm leading-6 text-[var(--color-muted)]">
              这些关联来自旧日志。默认保留；取消勾选可移除，但当前不能新增回来。
            </p>
            <div className="mt-3 grid gap-2">
              {unavailableConceptIds.map((id) => (
                <label className="flex gap-3 text-sm" key={id}>
                  <input
                    checked
                    onChange={() =>
                      setEditor((current) => ({
                        ...current,
                        conceptIds: current.conceptIds.filter((value) => value !== id),
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{conceptById.get(id)?.title ?? id}（Concept 当前不可关联）</span>
                </label>
              ))}
              {unavailableProjectIds.map((id) => (
                <label className="flex gap-3 text-sm" key={id}>
                  <input
                    checked
                    onChange={() =>
                      setEditor((current) => ({
                        ...current,
                        projectIds: current.projectIds.filter((value) => value !== id),
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{projectById.get(id)?.title ?? id}（Project 当前不可关联）</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            className="min-h-11 rounded-md bg-[var(--color-accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={persistenceStatus === "blocked"}
            onClick={() => void submitLog()}
            type="button"
          >
            {editingId ? "保存修改" : "保存学习记录"}
          </button>
          {editingId ? (
            <button
              className="min-h-11 rounded-md border border-[var(--color-border)] px-5 text-sm font-semibold"
              onClick={resetEditor}
              type="button"
            >
              取消编辑
            </button>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="study-history-title"
        className="border-t border-[var(--color-border)] pt-8"
      >
        <h2 className="text-xl font-semibold" id="study-history-title">
          历史学习记录
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          按学习日期倒序；同一天按创建时间倒序。
        </p>
        {sortedLogs.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-muted)]">
            尚无学习记录。请只记录真实发生的学习活动。
          </p>
        ) : (
          <div className="mt-5 grid gap-5">
            {sortedLogs.map((log) => (
              <article
                className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-subtle)] sm:p-6"
                data-study-log-entry-id={log.id}
                key={log.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{formatLocalDate(log.localDate)}</h3>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      用户记录时长：{log.minutes} 分钟
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-md border border-[var(--color-border)] px-4 text-sm font-semibold"
                      onClick={() => {
                        setEditingId(log.id);
                        setEditor(editorFromLog(log));
                        setDeleteCandidateId(undefined);
                        setMessage("");
                        setError("");
                        document
                          .querySelector("[data-study-log-form]")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      className="min-h-10 rounded-md border border-red-300 px-4 text-sm font-semibold text-red-800"
                      onClick={() => setDeleteCandidateId(log.id)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 text-sm leading-6 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold">学习了什么</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--color-muted)]">{log.learned}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">遇到什么问题</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--color-muted)]">{log.blockers || "未记录"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">完成了什么</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--color-muted)]">{log.completed || "未记录"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">下一步准备做什么</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[var(--color-muted)]">{log.tomorrowPlan || "未记录"}</dd>
                  </div>
                </dl>
                <StudyLogAssociations
                  entities={catalog.concepts}
                  ids={log.conceptIds}
                  kind="concept"
                />
                <StudyLogAssociations
                  entities={catalog.projects}
                  ids={log.projectIds}
                  kind="project"
                />

                {deleteCandidateId === log.id ? (
                  <div
                    className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
                    data-study-log-delete-confirm
                  >
                    <p className="font-semibold">
                      确认删除这条学习记录？此操作只删除日志，不改变学习状态。
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        className="min-h-10 rounded-md border border-red-300 bg-white px-4 font-semibold"
                        onClick={() => setDeleteCandidateId(undefined)}
                        type="button"
                      >
                        取消
                      </button>
                      <button
                        className="min-h-10 rounded-md bg-red-800 px-4 font-semibold text-white"
                        onClick={() => void confirmDelete(log.id)}
                        type="button"
                      >
                        确认删除
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <div aria-live="polite" className="min-h-6 text-sm" data-study-log-message>
        {message}
      </div>
      {error ? (
        <p className="text-sm leading-6 text-red-800" data-study-log-error role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
