import { z } from "zod";
import { semanticIdSchema as id, trimmedTextSchema as text } from "./shared-schemas";
export const retestProbeSchema = z.strictObject({
  id, title: text, criterionIds: z.array(id).min(1), goal: text,
  inputRequirement: text, whatToRecord: text, selfCheck: text,
});
export const retestDefinitionSchema = z.strictObject({
  id, stageId: id, version: z.number().int().positive(), contentStatus: z.enum(["published", "planned"]),
  estimatedMinutes: z.strictObject({ min: z.number().positive(), max: z.number().positive() }),
  probes: z.array(retestProbeSchema),
}).superRefine((d, ctx) => {
  if (d.estimatedMinutes.max < d.estimatedMinutes.min || (d.contentStatus === "published" && !d.probes.length)) ctx.addIssue({code:"custom", message:"复测范围或 probes 无效"});
  if (new Set(d.probes.map(p=>p.id)).size !== d.probes.length) ctx.addIssue({code:"custom", message:"probe ID 重复"});
});
export type RetestDefinition = z.infer<typeof retestDefinitionSchema>;
