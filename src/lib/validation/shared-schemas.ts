import { z } from "zod";

export const SEMANTIC_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const trimmedTextSchema = z.string().trim().min(1);
export const semanticIdSchema = trimmedTextSchema.regex(
  SEMANTIC_ID_PATTERN,
  "必须是小写 ASCII 语义 ID，并且只能使用字母、数字、点或连字符",
);
export const slugSchema = trimmedTextSchema.regex(
  SLUG_PATTERN,
  "必须是小写 kebab-case slug",
);

export const conceptIdSchema = semanticIdSchema.describe("ConceptId");
export const projectIdSchema = semanticIdSchema.describe("ProjectId");
export const resourceIdSchema = semanticIdSchema.describe("ResourceId");
export const stageIdSchema = semanticIdSchema.describe("StageId");
export const trackIdSchema = semanticIdSchema.describe("TrackId");
export const masteryCriterionIdSchema = semanticIdSchema.describe(
  "MasteryCriterionId",
);
export const evidenceIdSchema = semanticIdSchema.describe("EvidenceId");

export const localDateSchema = z.iso.date();
export const utcTimestampSchema = z.iso.datetime({ offset: false });
export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "只允许 http 或 https URL");

export const levelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);
export const publicationStatusSchema = z.enum([
  "draft",
  "published",
  "hidden",
  "retired",
]);
export const dependencyKindSchema = z.enum(["hard", "recommended"]);
export const trackGoalSchema = z.enum(["understand", "master"]);
export const learningStatusSchema = z.enum([
  "not_started",
  "learning",
  "understood",
  "mastered",
]);

function addDuplicateIssues(
  values: readonly string[],
  context: z.RefinementCtx,
) {
  const firstIndexByValue = new Map<string, number>();

  values.forEach((value, index) => {
    const normalizedValue = value.toLocaleLowerCase("en-US");
    const firstIndex = firstIndexByValue.get(normalizedValue);

    if (firstIndex === undefined) {
      firstIndexByValue.set(normalizedValue, index);
      return;
    }

    context.addIssue({
      code: "custom",
      message: `与第 ${firstIndex + 1} 项重复`,
      path: [index],
    });
  });
}

export const uniqueTextArraySchema = z
  .array(trimmedTextSchema)
  .superRefine(addDuplicateIssues);
export const uniqueSemanticIdArraySchema = z
  .array(semanticIdSchema)
  .superRefine(addDuplicateIssues);
export const uniqueSlugArraySchema = z
  .array(slugSchema)
  .superRefine(addDuplicateIssues);

export const estimatedHoursSchema = z
  .strictObject({
    min: z.number().finite().positive(),
    max: z.number().finite().positive(),
  })
  .superRefine(({ min, max }, context) => {
    if (min > max) {
      context.addIssue({
        code: "custom",
        message: "最小工时不得大于最大工时",
        path: ["min"],
      });
    }
  });

export type ConceptId = z.infer<typeof conceptIdSchema>;
export type ProjectId = z.infer<typeof projectIdSchema>;
export type ResourceId = z.infer<typeof resourceIdSchema>;
export type StageId = z.infer<typeof stageIdSchema>;
export type TrackId = z.infer<typeof trackIdSchema>;
export type MasteryCriterionId = z.infer<typeof masteryCriterionIdSchema>;
export type EvidenceId = z.infer<typeof evidenceIdSchema>;
export type DependencyKind = z.infer<typeof dependencyKindSchema>;
export type TrackGoal = z.infer<typeof trackGoalSchema>;
export type LearningStatus = z.infer<typeof learningStatusSchema>;
