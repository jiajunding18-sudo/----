import { z } from "zod";
import { semanticIdSchema as id, utcTimestampSchema as time } from "./shared-schemas";
import { stageProgressSchema, stageCriterionProgressSchema, stageEvidenceRefSchema, eligibilityCycleSchema } from "./stage-progress-schemas";

export const probeResultSchema = z.strictObject({ probeId:id, status:z.enum(["not_checked","needs_review","passed"]), explanation:z.string(), updatedAt:time, evidenceRefs:z.array(stageEvidenceRefSchema).default([]) });
export const retestAttemptSchema = z.strictObject({
  id, stageId:id, eligibilityCycleId:id, retestDefinitionId:id, retestDefinitionVersion:z.number().int().positive(), retestDelayDays:z.number().int().positive(),
  requiredProbeIds:z.array(id).min(1), createdAt:time, updatedAt:time,
  probeResults:z.record(id,probeResultSchema), closedAt:time.optional(), confirmedAt:time.optional(), retestedAt:time.optional(),
  confirmationVersion:z.literal(1).optional(),
}).superRefine((a,ctx)=>{
  if(new Set(a.requiredProbeIds).size!==a.requiredProbeIds.length || Object.entries(a.probeResults).some(([id,p])=>id!==p.probeId || !a.requiredProbeIds.includes(id))) ctx.addIssue({code:'custom',message:'probe 身份不一致'});
  const finalFields=[a.confirmedAt,a.retestedAt,a.confirmationVersion];
  if((finalFields.some(v=>v!==undefined)&&!finalFields.every(v=>v!==undefined)) || (a.closedAt&&a.confirmedAt)) ctx.addIssue({code:'custom',message:'复测结束状态不一致'});
});
export const completionContractSchema = z.strictObject({
  stageId:id, routeGoals:z.record(id,z.enum(["understand","master"])),
  conceptTargets:z.array(z.strictObject({conceptId:id,minimumStatus:z.enum(["understood","mastered"])})),
  requiredCriterionIds:z.array(id).min(1), criteria:z.record(id,stageCriterionProgressSchema),
  projectGates:z.array(z.strictObject({projectId:id,milestoneId:id.optional()})),
  retest:z.strictObject({delayDays:z.number().int().positive(),definitionId:id,definitionVersion:z.number().int().positive(),requiredProbeIds:z.array(id).min(1)}).optional(),
});
export const historicalCompletionV4Schema = z.strictObject({
  id, modelVersion:z.literal(1), stageId:id, method:z.enum(["retention-retest","no-retest"]), completedAt:time,
  confirmationVersion:z.literal(1), cycle:eligibilityCycleSchema, contract:completionContractSchema,
  successfulAttemptId:id.optional(), successfulAttemptSnapshot:retestAttemptSchema.optional(), fingerprint:z.string().min(1),
});
export const stageProgressV4Schema = stageProgressSchema.omit({historicalCompletion:true}).extend({
  attempts:z.record(id,retestAttemptSchema).default({}),
  historicalCompletion:historicalCompletionV4Schema.optional(),
  legacyV3Completions:z.array(stageProgressSchema.shape.historicalCompletion.unwrap()).default([]),
});
export type StageProgressV4 = z.infer<typeof stageProgressV4Schema>;
export type RetestAttempt = z.infer<typeof retestAttemptSchema>;
export type HistoricalCompletion = z.infer<typeof historicalCompletionV4Schema>;
