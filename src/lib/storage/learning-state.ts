import { z } from "zod";

import { learningStateV1Schema } from "@/lib/validation/progress-schemas";
import { trimmedTextSchema, utcTimestampSchema } from "@/lib/validation/shared-schemas";
import type { LearningStateV1, TrackDefinition } from "@/types";

export const LEARNING_STATE_APP_ID = "machine-vision-learning-os" as const;
export const LEARNING_STATE_SCHEMA_VERSION = 1 as const;
export const LEARNING_STATE_STORAGE_KEY = "mv-learning-os:learning-state";
export const LEARNING_STATE_RECOVERY_KEY_PREFIX = "mv-learning-os:recovery:";

export const persistedEnvelopeV1Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().positive(),
  savedAt: utcTimestampSchema,
  payload: learningStateV1Schema,
});

export type PersistedEnvelopeV1 = z.infer<typeof persistedEnvelopeV1Schema>;

export const exportEnvelopeV1Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().nonnegative(),
  savedAt: utcTimestampSchema,
  exportedAt: utcTimestampSchema,
  payload: learningStateV1Schema,
});

export type ExportEnvelopeV1 = z.infer<typeof exportEnvelopeV1Schema>;

export function createInitialLearningState(
  tracks: readonly Pick<TrackDefinition, "id" | "defaultGoal" | "kind">[],
  timestamp: string,
): LearningStateV1 {
  const trackGoals = Object.fromEntries(
    tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const defaultAdvancedMaster = tracks.find(
    ({ defaultGoal, kind }) =>
      kind === "advanced-branch" && defaultGoal === "master",
  );

  return learningStateV1Schema.parse({
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
  payload: LearningStateV1,
  contentVersion: string,
  revision: number,
  savedAt: string,
): PersistedEnvelopeV1 {
  return persistedEnvelopeV1Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    payload,
  });
}

export function createExportEnvelope(
  payload: LearningStateV1,
  contentVersion: string,
  revision: number,
  savedAt: string,
  exportedAt: string,
): ExportEnvelopeV1 {
  return exportEnvelopeV1Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    exportedAt,
    payload,
  });
}
