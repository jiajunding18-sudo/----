import { z } from "zod";

import {
  conceptIdSchema,
  evidenceIdSchema,
  learningStatusSchema,
  localDateSchema,
  masteryCriterionIdSchema,
  projectIdSchema,
  semanticIdSchema,
  stageIdSchema,
  trackGoalSchema,
  trackIdSchema,
  trimmedTextSchema,
  uniqueSemanticIdArraySchema,
  utcTimestampSchema,
} from "./shared-schemas";

// Progress is user-owned state keyed by permanent content IDs. It is validated
// separately and must never be merged back into static ConceptMeta or ProjectMeta.

export const evidenceKindSchema = z.enum([
  "exercise",
  "mini-project",
  "project",
  "code-artifact",
  "written-explanation",
  "demonstration",
  "other",
]);

export const masteryEvidenceSchema = z
  .strictObject({
    id: evidenceIdSchema,
    conceptId: conceptIdSchema,
    criterionIds: uniqueSemanticIdArraySchema.min(1),
    kind: evidenceKindSchema,
    title: trimmedTextSchema,
    note: z.string(),
    result: z.enum(["passed", "failed"]),
    completedAt: utcTimestampSchema,
    reference: trimmedTextSchema.optional(),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .superRefine((evidence, context) => {
    if (evidence.updatedAt < evidence.createdAt) {
      context.addIssue({
        code: "custom",
        message: "updatedAt 不得早于 createdAt",
        path: ["updatedAt"],
      });
    }
  });

export const masteryConfirmationSchema = z.strictObject({
  confirmedAt: utcTimestampSchema,
  criterionIds: z.array(masteryCriterionIdSchema).min(1).superRefine(
    (values, context) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            message: "确认快照中的掌握标准不得重复",
            path: [index],
          });
        }
        seen.add(value);
      });
    },
  ),
  evidenceIds: z.array(evidenceIdSchema).min(1).superRefine(
    (values, context) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            message: "确认快照中的证据不得重复",
            path: [index],
          });
        }
        seen.add(value);
      });
    },
  ),
  statementVersion: z.literal(1),
});

export const userDifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const conceptProgressSchema = z
  .strictObject({
    status: learningStatusSchema,
    note: z.string(),
    favorite: z.boolean(),
    userDifficulty: userDifficultySchema.optional(),
    startedAt: utcTimestampSchema.optional(),
    understoodAt: utcTimestampSchema.optional(),
    firstMasteredAt: utcTimestampSchema.optional(),
    lastMasteredAt: utcTimestampSchema.optional(),
    updatedAt: utcTimestampSchema,
    evidence: z.array(masteryEvidenceSchema),
    masteryConfirmation: masteryConfirmationSchema.optional(),
  })
  .superRefine((progress, context) => {
    if (progress.status !== "not_started" && progress.startedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "已开始的知识状态必须记录 startedAt",
        path: ["startedAt"],
      });
    }

    if (
      (progress.status === "understood" || progress.status === "mastered") &&
      progress.understoodAt === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "已理解或已掌握状态必须记录 understoodAt",
        path: ["understoodAt"],
      });
    }

    if (progress.status === "mastered") {
      if (progress.firstMasteredAt === undefined) {
        context.addIssue({
          code: "custom",
          message: "已掌握状态必须记录 firstMasteredAt",
          path: ["firstMasteredAt"],
        });
      }
      if (progress.lastMasteredAt === undefined) {
        context.addIssue({
          code: "custom",
          message: "已掌握状态必须记录 lastMasteredAt",
          path: ["lastMasteredAt"],
        });
      }
      if (progress.masteryConfirmation === undefined) {
        context.addIssue({
          code: "custom",
          message: "已掌握状态必须包含用户手动确认快照",
          path: ["masteryConfirmation"],
        });
      }
    } else if (progress.masteryConfirmation !== undefined) {
      context.addIssue({
        code: "custom",
        message: "非 mastered 状态不得保留当前掌握确认快照",
        path: ["masteryConfirmation"],
      });
    }

    if (
      progress.firstMasteredAt !== undefined &&
      progress.lastMasteredAt !== undefined &&
      progress.lastMasteredAt < progress.firstMasteredAt
    ) {
      context.addIssue({
        code: "custom",
        message: "lastMasteredAt 不得早于 firstMasteredAt",
        path: ["lastMasteredAt"],
      });
    }

    const evidenceById = new Map<string, (typeof progress.evidence)[number]>();
    progress.evidence.forEach((evidence, index) => {
      if (evidenceById.has(evidence.id)) {
        context.addIssue({
          code: "custom",
          message: "证据 ID 必须在知识进度内唯一",
          path: ["evidence", index, "id"],
        });
      }
      evidenceById.set(evidence.id, evidence);
    });

    const confirmation = progress.masteryConfirmation;
    if (confirmation === undefined) {
      return;
    }

    const coveredCriterionIds = new Set<string>();
    confirmation.evidenceIds.forEach((evidenceId, index) => {
      const evidence = evidenceById.get(evidenceId);
      if (evidence === undefined) {
        context.addIssue({
          code: "custom",
          message: "掌握确认引用了不存在的证据",
          path: ["masteryConfirmation", "evidenceIds", index],
        });
        return;
      }

      if (evidence.result !== "passed") {
        context.addIssue({
          code: "custom",
          message: "失败证据不能用于掌握确认",
          path: ["masteryConfirmation", "evidenceIds", index],
        });
        return;
      }

      evidence.criterionIds.forEach((criterionId) => {
        coveredCriterionIds.add(criterionId);
      });
    });

    confirmation.criterionIds.forEach((criterionId, index) => {
      if (!coveredCriterionIds.has(criterionId)) {
        context.addIssue({
          code: "custom",
          message: "确认快照中的标准没有被所引用的通过证据覆盖",
          path: ["masteryConfirmation", "criterionIds", index],
        });
      }
    });
  });

export const legacyProjectProgressSchema = z
  .strictObject({
    status: z.enum(["not_started", "in_progress", "paused", "completed"]),
    note: z.string(),
    nextAction: z.string().optional(),
    selectedExecutionPathId: semanticIdSchema.optional(),
    environmentChecks: z.record(semanticIdSchema, z.boolean()),
    prerequisiteOverride: z
      .strictObject({
        confirmedAt: utcTimestampSchema,
        missingRequirementConceptIds: z.array(conceptIdSchema),
      })
      .optional(),
    acceptance: z.record(semanticIdSchema, z.boolean()),
    deliverables: z.array(
      z
        .strictObject({
          id: semanticIdSchema,
          title: trimmedTextSchema,
          reference: trimmedTextSchema.optional(),
          note: z.string().optional(),
          createdAt: utcTimestampSchema,
          updatedAt: utcTimestampSchema,
        })
        .refine(({ createdAt, updatedAt }) => updatedAt >= createdAt, {
          message: "updatedAt 不得早于 createdAt",
          path: ["updatedAt"],
        }),
    ),
    unverifiedAssumptions: z.array(trimmedTextSchema),
    completionConfirmation: z
      .strictObject({
        confirmedAt: utcTimestampSchema,
        acceptanceCriterionIds: z.array(semanticIdSchema),
        deliverableIds: z.array(semanticIdSchema),
      })
      .optional(),
    startedAt: utcTimestampSchema.optional(),
    completedAt: utcTimestampSchema.optional(),
    updatedAt: utcTimestampSchema,
  })
  .superRefine((progress, context) => {
    if (progress.status === "in_progress") {
      if (!progress.nextAction?.trim()) {
        context.addIssue({
          code: "custom",
          message: "进行中的项目必须有非空下一动作",
          path: ["nextAction"],
        });
      }
      if (progress.selectedExecutionPathId === undefined) {
        context.addIssue({
          code: "custom",
          message: "进行中的项目必须选择执行路径",
          path: ["selectedExecutionPathId"],
        });
      }
    }

    if (progress.status !== "not_started" && progress.startedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "已开始的项目必须记录 startedAt",
        path: ["startedAt"],
      });
    }

    if (progress.status === "completed") {
      if (progress.completedAt === undefined) {
        context.addIssue({
          code: "custom",
          message: "已完成项目必须记录 completedAt",
          path: ["completedAt"],
        });
      }
      if (progress.completionConfirmation === undefined) {
        context.addIssue({
          code: "custom",
          message: "已完成项目必须包含用户确认快照",
          path: ["completionConfirmation"],
        });
      }
    }
  });

export const projectProgressSchema = legacyProjectProgressSchema.safeExtend({
  milestones: z.record(semanticIdSchema, legacyProjectProgressSchema).optional(),
});

export const studyLogSchema = z
  .strictObject({
    id: semanticIdSchema,
    localDate: localDateSchema,
    minutes: z.number().int().positive(),
    conceptIds: z.array(conceptIdSchema),
    projectIds: z.array(projectIdSchema),
    learned: z.string(),
    blockers: z.string(),
    completed: z.string(),
    tomorrowPlan: z.string(),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .refine(({ createdAt, updatedAt }) => updatedAt >= createdAt, {
    message: "updatedAt 不得早于 createdAt",
    path: ["updatedAt"],
  });

export const userPreferencesSchema = z.strictObject({
  focusedTrackIds: z.array(trackIdSchema),
  trackGoals: z.record(trackIdSchema, trackGoalSchema),
  activeStageId: stageIdSchema.optional(),
  weeklyTargetMinutes: z.number().int().nonnegative(),
  todayAvailableMinutes: z.number().int().nonnegative().optional(),
  primaryProjectId: projectIdSchema.optional(),
  currentConceptId: conceptIdSchema.optional(),
  lastBackupAt: utcTimestampSchema.optional(),
  updatedAt: utcTimestampSchema,
});

export const stageCheckpointSchema = z.strictObject({
  criterionEvidence: z.record(semanticIdSchema, z.array(semanticIdSchema)),
  initiallyEligibleAt: utcTimestampSchema.optional(),
  retestedAt: utcTimestampSchema.optional(),
  updatedAt: utcTimestampSchema,
});

export const learningStateV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  preferences: userPreferencesSchema,
  conceptProgress: z.record(conceptIdSchema, conceptProgressSchema),
  projectProgress: z.record(projectIdSchema, legacyProjectProgressSchema),
  stageCheckpoints: z.record(stageIdSchema, stageCheckpointSchema),
  studyLogs: z.array(studyLogSchema),
});

export const learningStateV2Schema = learningStateV1Schema.extend({
  schemaVersion: z.literal(2),
  projectProgress: z.record(projectIdSchema, projectProgressSchema),
});
export type LearningStateV2 = z.infer<typeof learningStateV2Schema>;

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type MasteryEvidence = z.infer<typeof masteryEvidenceSchema>;
export type MasteryConfirmation = z.infer<typeof masteryConfirmationSchema>;
export type UserDifficulty = z.infer<typeof userDifficultySchema>;
export type ConceptProgress = z.infer<typeof conceptProgressSchema>;
export type ProjectProgress = z.infer<typeof projectProgressSchema>;
export type StudyLog = z.infer<typeof studyLogSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type StageCheckpoint = z.infer<typeof stageCheckpointSchema>;
export type LearningStateV1 = z.infer<typeof learningStateV1Schema>;
