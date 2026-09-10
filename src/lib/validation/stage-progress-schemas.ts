import { z } from "zod";
import { semanticIdSchema, utcTimestampSchema, trimmedTextSchema } from "./shared-schemas";

export const stageEvidenceRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("project-deliverable"), projectId: semanticIdSchema, milestoneId: semanticIdSchema.optional(), deliverableId: semanticIdSchema }),
  z.strictObject({ kind: z.literal("concept-evidence"), conceptId: semanticIdSchema, evidenceId: semanticIdSchema }),
]);
export const stageCriterionProgressSchema = z.strictObject({
  evidenceRefs: z.array(stageEvidenceRefSchema),
  explanation: z.string(),
  confirmedAt: utcTimestampSchema.optional(),
  confirmationInvalidatedAt: utcTimestampSchema.optional(),
  evidenceBasis: z.array(z.string()).optional(),
  updatedAt: utcTimestampSchema,
});
export const eligibilityCycleSchema = z.strictObject({
  id: semanticIdSchema, eligibleAt: utcTimestampSchema, invalidatedAt: utcTimestampSchema.optional(),
  qualificationBasis: z.strictObject({ fingerprint: z.string(), notBefore: utcTimestampSchema }).optional(),
});
export const stageRetestSchema = z.strictObject({
  eligibilityCycleId: semanticIdSchema, evidenceRefs: z.array(stageEvidenceRefSchema).min(1),
  explanation: trimmedTextSchema, confirmedAt: utcTimestampSchema, retestedAt: utcTimestampSchema,
});
export const stageHistoricalCompletionSchema = z.strictObject({
  eligibilityCycleId: semanticIdSchema, completedAt: utcTimestampSchema,
  evidenceSnapshot: z.record(semanticIdSchema, stageCriterionProgressSchema),
  retest: stageRetestSchema.optional(),
});
export const legacyStageCheckpointSchema = z.strictObject({
  criterionEvidence: z.record(semanticIdSchema, z.array(semanticIdSchema)),
  initiallyEligibleAt: utcTimestampSchema.optional(), retestedAt: utcTimestampSchema.optional(), updatedAt: utcTimestampSchema,
});
export const stageProgressSchema = z.strictObject({
  criteria: z.record(semanticIdSchema, stageCriterionProgressSchema),
  cycles: z.record(semanticIdSchema, eligibilityCycleSchema),
  legacy: z.array(z.strictObject({ provenance: z.literal("v2-needs-review"), checkpoint: legacyStageCheckpointSchema })),
  historicalCompletion: stageHistoricalCompletionSchema.optional(),
  updatedAt: utcTimestampSchema,
});
export type StageEvidenceRef = z.infer<typeof stageEvidenceRefSchema>;
export type StageCriterionProgress = z.infer<typeof stageCriterionProgressSchema>;
export type EligibilityCycle = z.infer<typeof eligibilityCycleSchema>;
export type StageProgress = z.infer<typeof stageProgressSchema>;
