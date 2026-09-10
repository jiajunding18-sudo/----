import { z } from "zod";

import { learningStateV3Schema } from "@/lib/validation/progress-schemas";
import { trimmedTextSchema, utcTimestampSchema } from "@/lib/validation/shared-schemas";
import type { LearningStateV3, TrackDefinition } from "@/types";

export const LEARNING_STATE_APP_ID = "machine-vision-learning-os" as const;
export const LEARNING_STATE_SCHEMA_VERSION = 3 as const;
export const LEARNING_STATE_STORAGE_KEY = "mv-learning-os:learning-state";
export const LEARNING_STATE_RECOVERY_KEY_PREFIX = "mv-learning-os:recovery:";

export const persistedEnvelopeV3Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().positive(),
  savedAt: utcTimestampSchema,
  payload: learningStateV3Schema,
});

export type PersistedEnvelopeV3 = z.infer<typeof persistedEnvelopeV3Schema>;

export const exportEnvelopeV3Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().nonnegative(),
  savedAt: utcTimestampSchema,
  exportedAt: utcTimestampSchema,
  payload: learningStateV3Schema,
});

export type ExportEnvelopeV3 = z.infer<typeof exportEnvelopeV3Schema>;

export function createInitialLearningState(
  tracks: readonly Pick<TrackDefinition, "id" | "defaultGoal" | "kind">[],
  timestamp: string,
): LearningStateV3 {
  const trackGoals = Object.fromEntries(
    tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const defaultAdvancedMaster = tracks.find(
    ({ defaultGoal, kind }) =>
      kind === "advanced-branch" && defaultGoal === "master",
  );

  return learningStateV3Schema.parse({
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
  payload: LearningStateV3,
  contentVersion: string,
  revision: number,
  savedAt: string,
): PersistedEnvelopeV3 {
  return persistedEnvelopeV3Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    payload,
  });
}

export function createExportEnvelope(
  payload: LearningStateV3,
  contentVersion: string,
  revision: number,
  savedAt: string,
  exportedAt: string,
): ExportEnvelopeV3 {
  return exportEnvelopeV3Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    exportedAt,
    payload,
  });
}
