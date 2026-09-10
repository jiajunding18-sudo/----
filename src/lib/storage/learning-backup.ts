import { z } from "zod";
import { mergeStageCheckpoints } from "./stage-checkpoint-merge";
import type { StageProgress } from "@/lib/validation/stage-progress-schemas";
import { reconcileStageEligibility, stageInspectionErrors } from "@/features/progress/stage-lifecycle";

import {
  inspectLearningStateAgainstCatalog,
  type ProgressCatalog,
} from "@/features/progress/progress-domain";
import { learningStateV3Schema } from "@/lib/validation/progress-schemas";
import type {
  ConceptProgress,
  LearningStateV3,
  ProjectProgress,
  StudyLog,
} from "@/types";

import {
  createExportEnvelope,
  LEARNING_STATE_APP_ID,
  LEARNING_STATE_SCHEMA_VERSION,
  type ExportEnvelopeV3,
} from "./learning-state";
import { migrateExportEnvelope } from "./migrations";

export type ImportMode = "merge" | "replace";

export interface ImportRecordSummary {
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
}

export interface ImportPreview {
  readonly mode: ImportMode;
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly savedAt: string;
  readonly exportedAt: string;
  readonly conceptRecordCount: number;
  readonly projectRecordCount: number;
  readonly studyLogRecordCount: number;
  readonly understoodCount: number;
  readonly masteredCount: number;
  readonly orphanConceptIds: readonly string[];
  readonly orphanProjectIds: readonly string[];
  readonly orphanStageIds: readonly string[];
  readonly orphanTrackIds: readonly string[];
  readonly conceptChanges: ImportRecordSummary;
  readonly studyLogChanges: ImportRecordSummary;
}

export interface PreparedLearningStateImport {
  readonly envelope: ExportEnvelopeV3;
  readonly nextState: LearningStateV3;
  readonly preview: ImportPreview;
}

export type PrepareImportResult =
  | { readonly ok: true; readonly value: PreparedLearningStateImport }
  | {
      readonly ok: false;
      readonly code:
        | "invalid-json"
        | "wrong-app"
        | "invalid-schema"
        | "unsupported-newer-version"
        | "catalog-conflict";
      readonly message: string;
    };

const importHeaderSchema = z.looseObject({
  app: z.string(),
  schemaVersion: z.number().int().positive(),
});

function chooseNewer<Value extends { readonly updatedAt: string }>(
  current: Value,
  incoming: Value,
): Value {
  return incoming.updatedAt > current.updatedAt ? incoming : current;
}

function mergeByStableId<Value extends { readonly id: string; readonly updatedAt: string }>(
  current: readonly Value[],
  incoming: readonly Value[],
): Value[] {
  const merged = new Map(current.map((value) => [value.id, value]));
  for (const value of incoming) {
    const existing = merged.get(value.id);
    merged.set(value.id, existing ? chooseNewer(existing, value) : value);
  }
  return [...merged.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id, "en"),
  );
}

function mergeConceptProgress(
  current: ConceptProgress,
  incoming: ConceptProgress,
): ConceptProgress {
  const selected = chooseNewer(current, incoming);
  return {
    ...selected,
    evidence: mergeByStableId(current.evidence, incoming.evidence),
  };
}

function mergeProjectProgress(
  current: ProjectProgress,
  incoming: ProjectProgress,
): ProjectProgress {
  const selected = chooseNewer(current, incoming);
  return {
    ...selected,
    deliverables: mergeByStableId(current.deliverables, incoming.deliverables),
    ...(current.milestones || incoming.milestones ? {
      milestones: mergeRecord(current.milestones ?? {}, incoming.milestones ?? {}, mergeProjectProgress),
    } : {}),
  };
}

function mergeRecord<Value extends { readonly updatedAt: string }>(
  current: Readonly<Record<string, Value>>,
  incoming: Readonly<Record<string, Value>>,
  mergeValue: (currentValue: Value, incomingValue: Value) => Value = chooseNewer,
): Record<string, Value> {
  const result: Record<string, Value> = { ...current };
  for (const [id, value] of Object.entries(incoming)) {
    const existing = result[id];
    result[id] = existing ? mergeValue(existing, value) : value;
  }
  return result;
}

export function mergeLearningStates(
  current: LearningStateV3,
  incoming: LearningStateV3,
): LearningStateV3 {
  return learningStateV3Schema.parse({
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    preferences: chooseNewer(current.preferences, incoming.preferences),
    conceptProgress: mergeRecord<ConceptProgress>(
      current.conceptProgress,
      incoming.conceptProgress,
      mergeConceptProgress,
    ),
    projectProgress: mergeRecord<ProjectProgress>(
      current.projectProgress,
      incoming.projectProgress,
      mergeProjectProgress,
    ),
    stageCheckpoints: mergeRecord<StageProgress>(
      current.stageCheckpoints,
      incoming.stageCheckpoints,
      mergeStageCheckpoints,
    ),
    studyLogs: mergeByStableId<StudyLog>(current.studyLogs, incoming.studyLogs),
  });
}

function summarizeConceptChanges(
  current: Readonly<Record<string, ConceptProgress>>,
  incoming: Readonly<Record<string, ConceptProgress>>,
): ImportRecordSummary {
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const [id, value] of Object.entries(incoming)) {
    const existing = current[id];
    if (!existing) added += 1;
    else if (value.updatedAt > existing.updatedAt) updated += 1;
    else unchanged += 1;
  }
  return { added, updated, unchanged };
}

function summarizeStudyLogChanges(
  current: readonly StudyLog[],
  incoming: readonly StudyLog[],
): ImportRecordSummary {
  const currentById = new Map(current.map((log) => [log.id, log]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const log of incoming) {
    const existing = currentById.get(log.id);
    if (!existing) added += 1;
    else if (log.updatedAt > existing.updatedAt) updated += 1;
    else unchanged += 1;
  }
  return { added, updated, unchanged };
}

export function createLearningBackup(options: {
  readonly state: LearningStateV3;
  readonly contentVersion: string;
  readonly revision: number;
  readonly savedAt: string;
  readonly exportedAt: string;
}): { readonly envelope: ExportEnvelopeV3; readonly json: string } {
  const envelope = createExportEnvelope(
    options.state,
    options.contentVersion,
    options.revision,
    options.savedAt,
    options.exportedAt,
  );
  return { envelope, json: JSON.stringify(envelope, null, 2) };
}

export function getLearningBackupFileName(localDate: string) {
  return `machine-vision-learning-os-backup-${localDate}-v${LEARNING_STATE_SCHEMA_VERSION}.json`;
}

export function prepareLearningStateImport(options: {
  readonly now?: string;
  readonly raw: string;
  readonly currentState: LearningStateV3;
  readonly catalog: ProgressCatalog;
  readonly mode: ImportMode;
}): PrepareImportResult {
  let input: unknown;
  try {
    input = JSON.parse(options.raw) as unknown;
  } catch (error) {
    return {
      ok: false,
      code: "invalid-json",
      message: `备份文件不是有效 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const header = importHeaderSchema.safeParse(input);
  if (!header.success) {
    return {
      ok: false,
      code: "invalid-schema",
      message: `无法识别备份 envelope：${header.error.message}`,
    };
  }
  if (header.data.app !== LEARNING_STATE_APP_ID) {
    return {
      ok: false,
      code: "wrong-app",
      message: `备份属于其他应用（${header.data.app}），当前应用不会导入。`,
    };
  }
  if (header.data.schemaVersion > LEARNING_STATE_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "unsupported-newer-version",
      message: `备份版本 v${header.data.schemaVersion} 高于当前支持的 v${LEARNING_STATE_SCHEMA_VERSION}。`,
    };
  }

  const migrated = migrateExportEnvelope(input);
  if (!migrated.ok) {
    return {
      ok: false,
      code:
        migrated.reason === "unsupported-newer-version"
          ? "unsupported-newer-version"
          : "invalid-schema",
      message: migrated.message,
    };
  }

  const inspection = inspectLearningStateAgainstCatalog(
    migrated.value.payload,
    options.catalog,
  );
  if (inspection.errors.length > 0) {
    return {
      ok: false,
      code: "catalog-conflict",
      message: `备份引用校验失败：${inspection.errors.join("；")}`,
    };
  }

  let nextState: LearningStateV3;
  try {
    const timestamp = options.now ?? new Date().toISOString();
    const stageErrors = stageInspectionErrors(migrated.value.payload, options.catalog, timestamp, true);
    if (stageErrors.length) throw new Error(stageErrors.join("；"));
    nextState = reconcileStageEligibility(options.mode === "merge"
      ? mergeLearningStates(options.currentState, migrated.value.payload)
      : learningStateV3Schema.parse(migrated.value.payload), options.catalog, timestamp);
  } catch (error) {
    return { ok: false, code: "catalog-conflict", message: error instanceof Error ? error.message : String(error) };
  }
  const records = Object.values(migrated.value.payload.conceptProgress);

  return {
    ok: true,
    value: {
      envelope: migrated.value,
      nextState,
      preview: {
        mode: options.mode,
        schemaVersion: migrated.value.schemaVersion,
        contentVersion: migrated.value.contentVersion,
        savedAt: migrated.value.savedAt,
        exportedAt: migrated.value.exportedAt,
        conceptRecordCount: records.length,
        projectRecordCount: Object.keys(
          migrated.value.payload.projectProgress,
        ).length,
        studyLogRecordCount: migrated.value.payload.studyLogs.length,
        understoodCount: records.filter(
          ({ status }) => status === "understood" || status === "mastered",
        ).length,
        masteredCount: records.filter(({ status }) => status === "mastered").length,
        orphanConceptIds: inspection.orphanConceptIds,
        orphanProjectIds: inspection.orphanProjectIds,
        orphanStageIds: inspection.orphanStageIds,
        orphanTrackIds: inspection.orphanTrackIds,
        conceptChanges: summarizeConceptChanges(
          options.currentState.conceptProgress,
          migrated.value.payload.conceptProgress,
        ),
        studyLogChanges: summarizeStudyLogChanges(
          options.currentState.studyLogs,
          migrated.value.payload.studyLogs,
        ),
      },
    },
  };
}
