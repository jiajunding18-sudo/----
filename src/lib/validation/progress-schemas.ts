import { z } from "zod";

import {
  conceptIdSchema,
  evidenceIdSchema,
  learningStatusSchema,
  masteryCriterionIdSchema,
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

export const conceptProgressSchema = z
  .strictObject({
    status: learningStatusSchema,
    note: z.string(),
    favorite: z.boolean(),
    userDifficulty: z.number().int().min(1).max(5).optional(),
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

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type MasteryEvidence = z.infer<typeof masteryEvidenceSchema>;
export type MasteryConfirmation = z.infer<typeof masteryConfirmationSchema>;
export type ConceptProgress = z.infer<typeof conceptProgressSchema>;
