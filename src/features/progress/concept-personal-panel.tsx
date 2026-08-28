"use client";

import { useState } from "react";

import { useLearningStore } from "./learning-store-provider";
import type { LearningStoreActionResult } from "./learning-store";
import type { UserDifficulty } from "@/types";

const difficultyOptions: readonly {
  readonly value: UserDifficulty;
  readonly label: string;
}[] = [
  { value: 1, label: "很容易" },
  { value: 2, label: "较容易" },
  { value: 3, label: "适中" },
  { value: 4, label: "较难" },
  { value: 5, label: "很难" },
];

function difficultyFromInput(value: string): UserDifficulty | undefined {
  return difficultyOptions.find((option) => String(option.value) === value)
    ?.value;
}

function actionMessage(
  result: LearningStoreActionResult,
  success: string,
  unchanged: string,
) {
  if (!result.ok) return result.message;
  return result.changed ? success : unchanged;
}

export function ConceptPersonalPanel({
  conceptId,
}: {
  readonly conceptId: string;
}) {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);

  if (!hydrated) {
    return (
      <section
        aria-busy="true"
        aria-labelledby="concept-personal-title"
        className="mt-6 border-y border-[var(--color-border)] py-6"
        data-concept-personal="loading"
      >
        <h2 className="text-lg font-semibold" id="concept-personal-title">
          个人学习记录
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]" role="status">
          正在恢复浏览器本地个人数据…
        </p>
      </section>
    );
  }

  return <HydratedConceptPersonalPanel conceptId={conceptId} />;
}

function HydratedConceptPersonalPanel({
  conceptId,
}: {
  readonly conceptId: string;
}) {
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const persistenceMessage = useLearningStore(
    ({ persistenceMessage }) => persistenceMessage,
  );
  const progress = useLearningStore(
    ({ learningState }) => learningState.conceptProgress[conceptId],
  );
  const updateConceptNote = useLearningStore(
    (state) => state.updateConceptNote,
  );
  const setConceptFavorite = useLearningStore(
    (state) => state.setConceptFavorite,
  );
  const setConceptUserDifficulty = useLearningStore(
    (state) => state.setConceptUserDifficulty,
  );
  const savedNote = progress?.note ?? "";
  const [noteDraft, setNoteDraft] = useState(savedNote);
  const [noteMessage, setNoteMessage] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);

  const writesBlocked = persistenceStatus === "blocked";
  const noteDirty = noteDraft !== savedNote;
  const favorite = progress?.favorite ?? false;
  const userDifficulty = progress?.userDifficulty;

  async function saveNote(note: string) {
    const result = await updateConceptNote(conceptId, note);
    setNoteMessage(
      actionMessage(
        result,
        note ? "个人笔记已保存到当前浏览器。" : "个人笔记已清空。",
        "个人笔记没有需要保存的变化。",
      ),
    );
    if (result.ok && !note) {
      setNoteDraft("");
      setClearConfirmationOpen(false);
    }
  }

  async function toggleFavorite() {
    const nextFavorite = !favorite;
    const result = await setConceptFavorite(conceptId, nextFavorite);
    setPersonalMessage(
      actionMessage(
        result,
        nextFavorite ? "已收藏这个知识点。" : "已取消收藏。",
        nextFavorite ? "这个知识点已经收藏。" : "这个知识点尚未收藏。",
      ),
    );
  }

  async function changeDifficulty(value: string) {
    const nextDifficulty = difficultyFromInput(value);
    const result = await setConceptUserDifficulty(conceptId, nextDifficulty);
    setPersonalMessage(
      actionMessage(
        result,
        nextDifficulty
          ? `个人难度已设为：${difficultyOptions.find(({ value: optionValue }) => optionValue === nextDifficulty)?.label}。`
          : "个人难度已恢复为未设置。",
        "个人难度没有变化。",
      ),
    );
  }

  return (
    <section
      aria-labelledby="concept-personal-title"
      className="mt-6 border-y border-[var(--color-border)] py-6"
      data-concept-personal="ready"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-accent)] uppercase">
          Personal learning data
        </p>
        <h2 className="mt-2 text-lg font-semibold" id="concept-personal-title">
          个人学习记录
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          这些内容只保存在当前浏览器，不会写入正式课程，也不会改变学习状态、前置条件或下一步推荐。
        </p>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <section aria-labelledby={`personal-note-${conceptId}`} className="min-w-0">
          <h3 className="font-semibold" id={`personal-note-${conceptId}`}>
            个人笔记
          </h3>
          <label className="mt-3 block text-sm" htmlFor={`concept-note-${conceptId}`}>
            记录你的理解、疑问或下次复习提醒
          </label>
          <textarea
            className="mt-2 block min-h-36 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm leading-6"
            disabled={writesBlocked}
            id={`concept-note-${conceptId}`}
            onChange={(event) => {
              setNoteDraft(event.target.value);
              setNoteMessage("");
            }}
            placeholder="纯文本笔记；例如：仍不理解相对路径为何随工作目录变化。"
            value={noteDraft}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!noteDirty || writesBlocked}
              onClick={() => void saveNote(noteDraft)}
              type="button"
            >
              保存笔记
            </button>
            {savedNote ? (
              <button
                className="min-h-10 rounded-md border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={writesBlocked}
                onClick={() => setClearConfirmationOpen(true)}
                type="button"
              >
                清空笔记
              </button>
            ) : null}
          </div>
          {clearConfirmationOpen ? (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm leading-6 text-red-900">
                清空后会立即保存。操作前的完整状态仍可通过正式备份流程保护。
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="min-h-10 rounded-md border border-[var(--color-border)] bg-white px-4 text-sm font-semibold"
                  onClick={() => setClearConfirmationOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="min-h-10 rounded-md bg-red-800 px-4 text-sm font-semibold text-white"
                  onClick={() => void saveNote("")}
                  type="button"
                >
                  确认清空笔记
                </button>
              </div>
            </div>
          ) : null}
          <p
            aria-live="polite"
            className="mt-3 min-h-6 text-sm text-[var(--color-muted)]"
            data-personal-note-status={noteDirty ? "unsaved" : "saved"}
          >
            {noteMessage || (noteDirty ? "有尚未保存的更改。" : savedNote ? "当前笔记已保存。" : "尚未记录个人笔记。")}
          </p>
        </section>

        <section aria-labelledby={`personal-flags-${conceptId}`}>
          <h3 className="font-semibold" id={`personal-flags-${conceptId}`}>
            收藏与个人难度
          </h3>
          <button
            aria-pressed={favorite}
            className="mt-3 min-h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold"
            data-concept-favorite={favorite ? "true" : "false"}
            disabled={writesBlocked}
            onClick={() => void toggleFavorite()}
            type="button"
          >
            {favorite ? "取消收藏" : "收藏此知识点"}
          </button>

          <label
            className="mt-5 block text-sm font-semibold"
            htmlFor={`concept-user-difficulty-${conceptId}`}
          >
            对我来说有多难
          </label>
          <select
            className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            data-concept-user-difficulty={userDifficulty ?? "unset"}
            disabled={writesBlocked}
            id={`concept-user-difficulty-${conceptId}`}
            onChange={(event) => void changeDifficulty(event.target.value)}
            value={userDifficulty ?? ""}
          >
            <option value="">未设置</option>
            {difficultyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value} · {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            这是个人感受，不会修改正式课程定义的难度。
          </p>
          <p
            aria-live="polite"
            className="mt-3 min-h-6 text-sm text-[var(--color-muted)]"
            data-personal-property-message
          >
            {personalMessage}
          </p>
        </section>
      </div>

      {persistenceStatus !== "ready" ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]" role="status">
          本地持久化状态：{persistenceMessage ?? persistenceStatus}
        </p>
      ) : null}
    </section>
  );
}
