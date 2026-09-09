import { z } from "zod";
import { learningStateV1Schema } from "@/lib/validation/progress-schemas";
import { migrateLearningStateV1ToV2 } from "./project-milestone-migration";

import {
  LEARNING_STATE_APP_ID,
  LEARNING_STATE_SCHEMA_VERSION,
  exportEnvelopeV2Schema,
  persistedEnvelopeV2Schema,
  type ExportEnvelopeV2,
  type PersistedEnvelopeV2,
} from "./learning-state";

const envelopeHeaderSchema = z.looseObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.number().int().positive(),
});

export interface SequentialMigration {
  readonly fromVersion: number;
  readonly fromSchema: z.ZodType;
  readonly migrate: (value: unknown) => unknown;
}

export type MigrationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | {
      readonly ok: false;
      readonly reason: "corrupt" | "unsupported-newer-version";
      readonly message: string;
    };

export function applySequentialMigrations<Value>(options: {
  readonly input: unknown;
  readonly inputVersion: number;
  readonly targetVersion: number;
  readonly targetSchema: z.ZodType<Value>;
  readonly migrations: ReadonlyMap<number, SequentialMigration>;
}): MigrationResult<Value> {
  let version = options.inputVersion;
  let value = options.input;

  if (version > options.targetVersion) {
    return {
      ok: false,
      reason: "unsupported-newer-version",
      message: `存储版本 ${version} 高于当前支持版本 ${options.targetVersion}`,
    };
  }

  while (version < options.targetVersion) {
    const migration = options.migrations.get(version);
    if (!migration || migration.fromVersion !== version) {
      return {
        ok: false,
        reason: "corrupt",
        message: `缺少连续 migration：v${version} → v${version + 1}`,
      };
    }

    const previous = migration.fromSchema.safeParse(value);
    if (!previous.success) {
      return {
        ok: false,
        reason: "corrupt",
        message: `v${version} 数据未通过迁移前校验：${previous.error.message}`,
      };
    }

    try {
      value = migration.migrate(previous.data);
    } catch (error) {
      return {
        ok: false,
        reason: "corrupt",
        message: `v${version} → v${version + 1} migration 失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    version += 1;
  }

  const parsed = options.targetSchema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        reason: "corrupt",
        message: `当前版本数据校验失败：${parsed.error.message}`,
      };
}

// v1 → v2 is the first real migration. Old schemas remain strict at the boundary.
const previousPersistedSchema = persistedEnvelopeV2Schema.extend({ schemaVersion: z.literal(1), payload: learningStateV1Schema });
const previousExportSchema = exportEnvelopeV2Schema.extend({ schemaVersion: z.literal(1), payload: learningStateV1Schema });
const persistedMigrations = new Map<number, SequentialMigration>([[1, {
  fromVersion: 1, fromSchema: previousPersistedSchema,
  migrate: (input) => { const value = previousPersistedSchema.parse(input); return { ...value, schemaVersion: 2, payload: migrateLearningStateV1ToV2(value.payload) }; },
}]]);
const exportMigrations = new Map<number, SequentialMigration>([[1, {
  fromVersion: 1, fromSchema: previousExportSchema,
  migrate: (input) => { const value = previousExportSchema.parse(input); return { ...value, schemaVersion: 2, payload: migrateLearningStateV1ToV2(value.payload) }; },
}]]);

export function migratePersistedEnvelope(
  input: unknown,
): MigrationResult<PersistedEnvelopeV2> {
  const header = envelopeHeaderSchema.safeParse(input);
  if (!header.success) {
    return {
      ok: false,
      reason: "corrupt",
      message: `无法识别 Learning State envelope：${header.error.message}`,
    };
  }

  return applySequentialMigrations({
    input,
    inputVersion: header.data.schemaVersion,
    targetVersion: LEARNING_STATE_SCHEMA_VERSION,
    targetSchema: persistedEnvelopeV2Schema,
    migrations: persistedMigrations,
  });
}

export function migrateExportEnvelope(
  input: unknown,
): MigrationResult<ExportEnvelopeV2> {
  const header = envelopeHeaderSchema.safeParse(input);
  if (!header.success) {
    return {
      ok: false,
      reason: "corrupt",
      message: `无法识别 Learning State 备份 envelope：${header.error.message}`,
    };
  }

  return applySequentialMigrations({
    input,
    inputVersion: header.data.schemaVersion,
    targetVersion: LEARNING_STATE_SCHEMA_VERSION,
    targetSchema: exportEnvelopeV2Schema,
    migrations: exportMigrations,
  });
}
