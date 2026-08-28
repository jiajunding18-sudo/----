"use client";

import { useState, type ChangeEvent } from "react";

import { useLearningStore } from "./learning-store-provider";
import type {
  ImportMode,
  PreparedLearningStateImport,
} from "@/lib/storage";

function localDateForFile(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(value: string | undefined) {
  if (!value) return "尚无记录";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataManagementPanel() {
  const hydrated = useLearningStore(({ hydrated }) => hydrated);
  const learningState = useLearningStore(({ learningState }) => learningState);
  const persistenceStatus = useLearningStore(
    ({ persistenceStatus }) => persistenceStatus,
  );
  const persistenceMessage = useLearningStore(
    ({ persistenceMessage }) => persistenceMessage,
  );
  const rawRecoveryData = useLearningStore(({ rawRecoveryData }) => rawRecoveryData);
  const revision = useLearningStore(({ revision }) => revision);
  const savedAt = useLearningStore(({ savedAt }) => savedAt);
  const orphanConceptIds = useLearningStore(({ orphanConceptIds }) =>
    orphanConceptIds,
  );
  const orphanProjectIds = useLearningStore(({ orphanProjectIds }) =>
    orphanProjectIds,
  );
  const orphanStageIds = useLearningStore(({ orphanStageIds }) => orphanStageIds);
  const orphanTrackIds = useLearningStore(({ orphanTrackIds }) => orphanTrackIds);
  const createBackup = useLearningStore(({ createBackup }) => createBackup);
  const recordBackupCreated = useLearningStore(
    ({ recordBackupCreated }) => recordBackupCreated,
  );
  const prepareImport = useLearningStore(({ prepareImport }) => prepareImport);
  const applyImport = useLearningStore(({ applyImport }) => applyImport);
  const resetLearningData = useLearningStore(
    ({ resetLearningData }) => resetLearningData,
  );

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importRaw, setImportRaw] = useState<string>();
  const [preparedImport, setPreparedImport] =
    useState<PreparedLearningStateImport>();
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);

  const conceptRecordCount = Object.keys(learningState.conceptProgress).length;
  const orphanCount =
    orphanConceptIds.length +
    orphanProjectIds.length +
    orphanStageIds.length +
    orphanTrackIds.length;

  function showError(nextError: string) {
    setMessage("");
    setError(nextError);
  }

  function refreshPreview(raw: string, mode: ImportMode) {
    const result = prepareImport(raw, mode);
    setImportConfirmed(false);
    if (!result.ok) {
      setPreparedImport(undefined);
      showError(result.message);
      return;
    }
    setError("");
    setMessage("备份已通过校验。请检查摘要后再确认导入。");
    setPreparedImport(result.value);
  }

  async function handleExport() {
    const now = new Date();
    const result = createBackup(localDateForFile(now));
    if (!result.ok) {
      showError(result.message);
      return;
    }

    downloadText(result.filename, result.json);
    const recorded = await recordBackupCreated(result.envelope.exportedAt);
    if (!recorded.ok) {
      showError(`备份文件已生成，但最近备份时间保存失败：${recorded.message}`);
      return;
    }
    setError("");
    setMessage(`已生成本地 JSON 备份：${result.filename}`);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      setImportRaw(raw);
      refreshPreview(raw, importMode);
    } catch (fileError) {
      showError(
        `读取备份文件失败：${
          fileError instanceof Error ? fileError.message : String(fileError)
        }`,
      );
    }
  }

  function changeImportMode(mode: ImportMode) {
    setImportMode(mode);
    if (importRaw) refreshPreview(importRaw, mode);
  }

  function cancelImport() {
    setPreparedImport(undefined);
    setImportRaw(undefined);
    setImportConfirmed(false);
    setFileInputKey((value) => value + 1);
    setError("");
    setMessage("已取消导入；当前浏览器学习数据没有改变。");
  }

  async function confirmImport() {
    if (!preparedImport) return;
    const result = await applyImport(preparedImport, importConfirmed);
    if (!result.ok) {
      showError(result.message);
      return;
    }

    const modeLabel = preparedImport.preview.mode === "replace" ? "替换恢复" : "合并导入";
    setPreparedImport(undefined);
    setImportRaw(undefined);
    setImportConfirmed(false);
    setFileInputKey((value) => value + 1);
    setError("");
    setMessage(
      `${modeLabel}已完成并保存到当前浏览器。${
        result.recoveryKey ? "操作前数据已写入独立恢复快照。" : ""
      }`,
    );
  }

  async function confirmReset() {
    const result = await resetLearningData(resetConfirmed);
    if (!result.ok) {
      showError(result.message);
      return;
    }
    setResetConfirmed(false);
    setResetOpen(false);
    setError("");
    setMessage("学习记录已清空；课程正文与路线设置未改变，操作前数据已保留为恢复快照。");
  }

  if (!hydrated) {
    return (
      <p className="mt-10 text-sm text-[var(--color-muted)]" role="status">
        正在恢复浏览器本地学习数据…
      </p>
    );
  }

  return (
    <div className="mt-10 grid max-w-3xl gap-8" data-data-management>
      <section
        aria-labelledby="data-status-title"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-subtle)] sm:p-6"
      >
        <h2 className="text-xl font-semibold" id="data-status-title">
          数据状态
        </h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Schema version</dt>
            <dd className="mt-1 font-semibold">v{learningState.schemaVersion}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Storage revision</dt>
            <dd className="mt-1 font-semibold">{revision}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">最近保存</dt>
            <dd className="mt-1 font-semibold">{formatTimestamp(savedAt)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">最近导出备份</dt>
            <dd className="mt-1 font-semibold">
              {formatTimestamp(learningState.preferences.lastBackupAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Concept 学习记录</dt>
            <dd className="mt-1 font-semibold">{conceptRecordCount} 条</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">历史 orphan</dt>
            <dd className="mt-1 font-semibold">{orphanCount} 条</dd>
          </div>
        </dl>
        {persistenceStatus !== "ready" ? (
          <p className="mt-5 text-sm leading-6 text-amber-800" role="alert">
            本地数据当前处于保护状态：{persistenceMessage ?? persistenceStatus}
          </p>
        ) : null}
        {rawRecoveryData ? (
          <button
            className="mt-4 min-h-10 rounded-md border border-[var(--color-border)] px-4 text-sm font-semibold"
            onClick={() =>
              downloadText(
                `machine-vision-learning-os-raw-recovery-${localDateForFile(new Date())}.json`,
                rawRecoveryData,
              )
            }
            type="button"
          >
            下载原始异常数据
          </button>
        ) : null}
      </section>

      <section
        aria-labelledby="export-title"
        className="border-t border-[var(--color-border)] pt-8"
      >
        <h2 className="text-xl font-semibold" id="export-title">
          Export · 导出备份
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          下载完整的版本化用户数据 JSON。文件只包含个人学习状态，不包含课程正文或 manifest。
        </p>
        <button
          className="mt-5 min-h-11 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={persistenceStatus === "blocked"}
          onClick={() => void handleExport()}
          type="button"
        >
          导出 JSON 备份
        </button>
      </section>

      <section
        aria-labelledby="import-title"
        className="border-t border-[var(--color-border)] pt-8"
      >
        <h2 className="text-xl font-semibold" id="import-title">
          Import · 导入备份
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          选择文件后只做解析与预览；在你明确确认前，不会修改当前浏览器数据。
        </p>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">导入方式</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex gap-3 rounded-md border border-[var(--color-border)] p-4 text-sm leading-6">
              <input
                checked={importMode === "merge"}
                name="import-mode"
                onChange={() => changeImportMode("merge")}
                type="radio"
              />
              <span>
                <strong className="block">合并（默认）</strong>
                同一 ID 保留 updatedAt 更新的一条。
              </span>
            </label>
            <label className="flex gap-3 rounded-md border border-[var(--color-border)] p-4 text-sm leading-6">
              <input
                checked={importMode === "replace"}
                name="import-mode"
                onChange={() => changeImportMode("replace")}
                type="radio"
              />
              <span>
                <strong className="block">替换恢复</strong>
                用备份完整替换当前学习状态。
              </span>
            </label>
          </div>
        </fieldset>
        <label className="mt-5 block text-sm font-semibold" htmlFor="backup-file">
          选择 Learning OS JSON 备份
        </label>
        <input
          accept="application/json,.json"
          className="mt-2 block w-full max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--color-surface-subtle)] file:px-3 file:py-2 file:font-semibold"
          id="backup-file"
          key={fileInputKey}
          onChange={(event) => void handleFile(event)}
          type="file"
        />

        {preparedImport ? (
          <div
            aria-labelledby="import-preview-title"
            className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            data-import-preview
          >
            <h3 className="text-lg font-semibold" id="import-preview-title">
              导入预览
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              备份保存于 {formatTimestamp(preparedImport.preview.savedAt)}，schema v
              {preparedImport.preview.schemaVersion}，内容版本 {preparedImport.preview.contentVersion}。
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
              <li>{preparedImport.preview.conceptRecordCount} 个 Concept 的学习记录</li>
              <li>{preparedImport.preview.understoodCount} 个已理解（含已掌握）</li>
              <li>{preparedImport.preview.masteredCount} 个已掌握</li>
              <li>
                预计新增 {preparedImport.preview.conceptChanges.added} 条、更新 {preparedImport.preview.conceptChanges.updated} 条、保持 {preparedImport.preview.conceptChanges.unchanged} 条 Concept 记录
              </li>
              <li>
                {preparedImport.preview.orphanConceptIds.length} 条当前课程中不存在的历史 Concept 记录
              </li>
              <li>
                其他 orphan：Project {preparedImport.preview.orphanProjectIds.length} 条、Stage {preparedImport.preview.orphanStageIds.length} 条、Track {preparedImport.preview.orphanTrackIds.length} 条
              </li>
            </ul>
            <p className="mt-4 text-sm font-semibold leading-6">
              {preparedImport.preview.mode === "replace"
                ? "确认后，当前浏览器中的学习状态将被备份文件替换；操作前会先创建独立恢复快照。"
                : "确认后，备份将按稳定 ID 与 updatedAt 合并；当前较新的主动回退不会被旧备份覆盖。"}
            </p>
            <label className="mt-4 flex gap-3 text-sm leading-6">
              <input
                checked={importConfirmed}
                onChange={(event) => setImportConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>
                我已检查摘要，并明确确认
                {preparedImport.preview.mode === "replace" ? "替换当前学习状态" : "合并学习数据"}。
              </span>
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="min-h-10 rounded-md border border-[var(--color-border)] px-4 text-sm font-semibold"
                onClick={cancelImport}
                type="button"
              >
                取消导入
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!importConfirmed}
                onClick={() => void confirmImport()}
                type="button"
              >
                {preparedImport.preview.mode === "replace"
                  ? "确认替换并恢复"
                  : "确认合并导入"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="reset-title"
        className="border-t border-red-200 pt-8"
      >
        <h2 className="text-xl font-semibold text-red-800" id="reset-title">
          Reset · 清空学习记录
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          清空 Concept、Project、Stage checkpoint 与 Study Log；课程正文、manifest 和路线设置不会被删除。
        </p>
        {!resetOpen ? (
          <button
            className="mt-5 min-h-10 rounded-md border border-red-300 px-4 text-sm font-semibold text-red-800"
            onClick={() => setResetOpen(true)}
            type="button"
          >
            准备清空学习记录
          </button>
        ) : (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 p-5">
            <p className="text-sm font-semibold leading-6 text-red-900">
              当前浏览器中的学习记录将被清空。继续前会先创建独立恢复快照；若快照失败，清空不会执行。
            </p>
            <label className="mt-4 flex gap-3 text-sm leading-6 text-red-900">
              <input
                checked={resetConfirmed}
                onChange={(event) => setResetConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>我理解影响范围，并明确确认清空学习记录。</span>
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="min-h-10 rounded-md border border-[var(--color-border)] bg-white px-4 text-sm font-semibold"
                onClick={() => {
                  setResetOpen(false);
                  setResetConfirmed(false);
                }}
                type="button"
              >
                取消
              </button>
              <button
                className="min-h-10 rounded-md bg-red-800 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!resetConfirmed}
                onClick={() => void confirmReset()}
                type="button"
              >
                确认清空学习记录
              </button>
            </div>
          </div>
        )}
      </section>

      <div aria-live="polite" className="min-h-6 text-sm" data-data-message>
        {message}
      </div>
      {error ? (
        <p className="text-sm leading-6 text-red-800" data-data-error role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
