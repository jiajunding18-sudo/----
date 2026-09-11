import { z } from "zod";

import { learningStateV4Schema } from "@/lib/validation/progress-schemas";
import { trimmedTextSchema, utcTimestampSchema } from "@/lib/validation/shared-schemas";
import type { LearningStateV4, TrackDefinition } from "@/types";

export const LEARNING_STATE_APP_ID = "machine-vision-learning-os" as const;
export const LEARNING_STATE_SCHEMA_VERSION = 4 as const;
export const LEARNING_STATE_STORAGE_KEY = "mv-learning-os:learning-state";
export const LEARNING_STATE_RECOVERY_KEY_PREFIX = "mv-learning-os:recovery:";

export const persistedEnvelopeV4Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().positive(),
  savedAt: utcTimestampSchema,
  payload: learningStateV4Schema,
});

export type PersistedEnvelopeV4 = z.infer<typeof persistedEnvelopeV4Schema>;

export const exportEnvelopeV4Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().nonnegative(),
  savedAt: utcTimestampSchema,
  exportedAt: utcTimestampSchema,
  payload: learningStateV4Schema,
});

export type ExportEnvelopeV4 = z.infer<typeof exportEnvelopeV4Schema>;

export function createInitialLearningState(
  tracks: readonly Pick<TrackDefinition, "id" | "defaultGoal" | "kind">[],
  timestamp: string,
): LearningStateV4 {
  const trackGoals = Object.fromEntries(
    tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const defaultAdvancedMaster = tracks.find(
    ({ defaultGoal, kind }) =>
      kind === "advanced-branch" && defaultGoal === "master",
  );

  return learningStateV4Schema.parse({
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    preferences: {
      focusedTrackIds: defaultAdvancedMaster ? [defaultAdvancedMaster.id] : [],
      trackGoals,
      weeklyTargetMinutes: 540,
      updatedAt: timestamp,
    },
    conceptProgress: {},
    projectProgress: {},
    stageCheckpoints: {},
    studyLogs: [],
  });
}

export function createPersistedEnvelope(
  payload: LearningStateV4,
  contentVersion: string,
  revision: number,
  savedAt: string,
): PersistedEnvelopeV4 {
  return persistedEnvelopeV4Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    payload,
  });
}

export function createExportEnvelope(
  payload: LearningStateV4,
  contentVersion: string,
  revision: number,
  savedAt: string,
  exportedAt: string,
): ExportEnvelopeV4 {
  return exportEnvelopeV4Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    exportedAt,
    payload,
  });
}
