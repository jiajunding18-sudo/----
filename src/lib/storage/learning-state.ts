import { z } from "zod";

import { learningStateV2Schema } from "@/lib/validation/progress-schemas";
import { trimmedTextSchema, utcTimestampSchema } from "@/lib/validation/shared-schemas";
import type { LearningStateV2, TrackDefinition } from "@/types";

export const LEARNING_STATE_APP_ID = "machine-vision-learning-os" as const;
export const LEARNING_STATE_SCHEMA_VERSION = 2 as const;
export const LEARNING_STATE_STORAGE_KEY = "mv-learning-os:learning-state";
export const LEARNING_STATE_RECOVERY_KEY_PREFIX = "mv-learning-os:recovery:";

export const persistedEnvelopeV2Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().positive(),
  savedAt: utcTimestampSchema,
  payload: learningStateV2Schema,
});

export type PersistedEnvelopeV2 = z.infer<typeof persistedEnvelopeV2Schema>;

export const exportEnvelopeV2Schema = z.strictObject({
  app: z.literal(LEARNING_STATE_APP_ID),
  schemaVersion: z.literal(LEARNING_STATE_SCHEMA_VERSION),
  contentVersion: trimmedTextSchema,
  revision: z.number().int().nonnegative(),
  savedAt: utcTimestampSchema,
  exportedAt: utcTimestampSchema,
  payload: learningStateV2Schema,
});

export type ExportEnvelopeV2 = z.infer<typeof exportEnvelopeV2Schema>;

export function createInitialLearningState(
  tracks: readonly Pick<TrackDefinition, "id" | "defaultGoal" | "kind">[],
  timestamp: string,
): LearningStateV2 {
  const trackGoals = Object.fromEntries(
    tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const defaultAdvancedMaster = tracks.find(
    ({ defaultGoal, kind }) =>
      kind === "advanced-branch" && defaultGoal === "master",
  );

  return learningStateV2Schema.parse({
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
  payload: LearningStateV2,
  contentVersion: string,
  revision: number,
  savedAt: string,
): PersistedEnvelopeV2 {
  return persistedEnvelopeV2Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    payload,
  });
}

export function createExportEnvelope(
  payload: LearningStateV2,
  contentVersion: string,
  revision: number,
  savedAt: string,
  exportedAt: string,
): ExportEnvelopeV2 {
  return exportEnvelopeV2Schema.parse({
    app: LEARNING_STATE_APP_ID,
    schemaVersion: LEARNING_STATE_SCHEMA_VERSION,
    contentVersion,
    revision,
    savedAt,
    exportedAt,
    payload,
  });
}
