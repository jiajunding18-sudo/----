import { z } from "zod";

import {
  conceptIdSchema,
  dependencyKindSchema,
  estimatedHoursSchema,
  httpUrlSchema,
  levelSchema,
  localDateSchema,
  masteryCriterionIdSchema,
  projectIdSchema,
  publicationStatusSchema,
  resourceIdSchema,
  semanticIdSchema,
  slugSchema,
  stageIdSchema,
  trackGoalSchema,
  trackIdSchema,
  trimmedTextSchema,
  uniqueSemanticIdArraySchema,
  uniqueSlugArraySchema,
  uniqueTextArraySchema,
} from "./shared-schemas";

/**
 * Authoring ownership is intentionally one-way:
 * ConceptMeta and ProjectMeta come from their MDX frontmatter; TrackDefinition,
 * StageDefinition, and Resource come from TypeScript catalogs. Normalized
 * Dependency records and all reverse indexes are derived and are never authored
 * as a second catalog.
 */

export const conceptDependencySchema = z.strictObject({
  conceptId: conceptIdSchema,
  kind: dependencyKindSchema,
  reason: trimmedTextSchema,
});

export const dependencySchema = z
  .strictObject({
    prerequisiteId: conceptIdSchema,
    targetId: conceptIdSchema,
    kind: dependencyKindSchema,
    rationale: trimmedTextSchema,
  })
  .refine(
    ({ prerequisiteId, targetId }) => prerequisiteId !== targetId,
    {
      message: "依赖边不得指向自身",
      path: ["prerequisiteId"],
    },
  );

export const masteryCriterionSchema = z.strictObject({
  id: masteryCriterionIdSchema,
  description: trimmedTextSchema,
  evidenceHint: trimmedTextSchema,
  required: z.boolean(),
});

export const embeddedSearchEntrySchema = z.strictObject({
  id: semanticIdSchema,
  kind: z.enum(["formula", "tool"]),
  title: trimmedTextSchema,
  aliases: uniqueTextArraySchema,
  anchor: slugSchema,
  summary: trimmedTextSchema.optional(),
});

export const conceptMetaSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: conceptIdSchema,
    slug: slugSchema,
    legacySlugs: uniqueSlugArraySchema.optional(),
    title: trimmedTextSchema,
    englishTitle: trimmedTextSchema,
    aliases: uniqueTextArraySchema,
    searchKeywords: uniqueTextArraySchema,
    summary: trimmedTextSchema,
    why: trimmedTextSchema,
    stageId: stageIdSchema,
    trackIds: uniqueSemanticIdArraySchema.min(1),
    order: z.number().int().nonnegative(),
    level: levelSchema,
    requiredness: z.enum(["required", "optional"]),
    targetDepth: z.enum(["master", "understand", "advanced"]),
    estimatedHours: estimatedHoursSchema,
    dependencies: z.array(conceptDependencySchema),
    relatedConceptIds: uniqueSemanticIdArraySchema.optional(),
    tags: uniqueTextArraySchema,
    learningOutcomes: uniqueTextArraySchema.min(1),
    masteryCriteria: z.array(masteryCriterionSchema),
    resourceIds: uniqueSemanticIdArraySchema,
    searchEntries: z.array(embeddedSearchEntrySchema).optional(),
    publicationStatus: publicationStatusSchema,
    contentVersion: trimmedTextSchema,
  })
  .superRefine((concept, context) => {
    if (
      concept.targetDepth === "advanced" &&
      concept.requiredness !== "optional"
    ) {
      context.addIssue({
        code: "custom",
        message: "advanced 深度必须同时标记为 optional",
        path: ["requiredness"],
      });
    }

    if (concept.legacySlugs?.includes(concept.slug)) {
      context.addIssue({
        code: "custom",
        message: "canonical slug 不得同时出现在 legacySlugs 中",
        path: ["legacySlugs"],
      });
    }

    const dependencyIndexByConceptId = new Map<string, number>();
    concept.dependencies.forEach((dependency, index) => {
      if (dependency.conceptId === concept.id) {
        context.addIssue({
          code: "custom",
          message: "概念不得依赖自身",
          path: ["dependencies", index, "conceptId"],
        });
      }

      const firstIndex = dependencyIndexByConceptId.get(dependency.conceptId);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: "custom",
          message: `与第 ${firstIndex + 1} 条依赖重复，同一概念不能同时维护多条边`,
          path: ["dependencies", index, "conceptId"],
        });
      } else {
        dependencyIndexByConceptId.set(dependency.conceptId, index);
      }
    });

    concept.relatedConceptIds?.forEach((relatedConceptId, index) => {
      if (relatedConceptId === concept.id) {
        context.addIssue({
          code: "custom",
          message: "概念不得关联自身",
          path: ["relatedConceptIds", index],
        });
      }

      if (dependencyIndexByConceptId.has(relatedConceptId)) {
        context.addIssue({
          code: "custom",
          message: "同一概念不能同时声明为依赖和无方向关联",
          path: ["relatedConceptIds", index],
        });
      }
    });

    const criterionIds = new Set<string>();
    concept.masteryCriteria.forEach((criterion, index) => {
      if (criterionIds.has(criterion.id)) {
        context.addIssue({
          code: "custom",
          message: "掌握标准 ID 必须在概念内唯一",
          path: ["masteryCriteria", index, "id"],
        });
      }
      criterionIds.add(criterion.id);
    });

    const searchEntryIds = new Set<string>();
    concept.searchEntries?.forEach((entry, index) => {
      if (searchEntryIds.has(entry.id)) {
        context.addIssue({
          code: "custom",
          message: "内嵌搜索条目 ID 必须在概念内唯一",
          path: ["searchEntries", index, "id"],
        });
      }
      searchEntryIds.add(entry.id);
    });

    if (
      concept.publicationStatus === "published" &&
      !concept.masteryCriteria.some((criterion) => criterion.required)
    ) {
      context.addIssue({
        code: "custom",
        message: "已发布概念必须至少包含一项必需掌握标准",
        path: ["masteryCriteria"],
      });
    }
  });

export const trackGoalConditionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("always") }),
  z.strictObject({
    kind: z.literal("track-goal"),
    trackId: trackIdSchema,
    minimumGoal: trackGoalSchema,
  }),
]);

type CheckpointGateValue =
  | { kind: "checkpoint"; stageId: string }
  | {
      kind: "track-goal-checkpoint";
      stageId: string;
      trackId: string;
      minimumTrackGoal: "understand" | "master";
    }
  | {
      kind: "allOf" | "anyOf";
      gates: [CheckpointGateValue, ...CheckpointGateValue[]];
    };

export const checkpointGateSchema: z.ZodType<CheckpointGateValue> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("checkpoint"), stageId: stageIdSchema }),
      z.strictObject({
        kind: z.literal("track-goal-checkpoint"),
        stageId: stageIdSchema,
        trackId: trackIdSchema,
        minimumTrackGoal: trackGoalSchema,
      }),
      z.strictObject({
        kind: z.literal("allOf"),
        gates: z.tuple([checkpointGateSchema], checkpointGateSchema),
      }),
      z.strictObject({
        kind: z.literal("anyOf"),
        gates: z.tuple([checkpointGateSchema], checkpointGateSchema),
      }),
    ]),
);

export const stageExitCriterionSchema = z.strictObject({
  id: semanticIdSchema,
  description: trimmedTextSchema,
  required: z.boolean(),
  when: trackGoalConditionSchema,
});

export const trackDefinitionSchema = z
  .strictObject({
    id: trackIdSchema,
    order: z.number().int().nonnegative(),
    title: trimmedTextSchema,
    summary: trimmedTextSchema,
    kind: z.enum(["common", "advanced-branch"]),
    defaultGoal: trackGoalSchema,
    exclusiveMasteryGroup: semanticIdSchema.optional(),
  })
  .superRefine((track, context) => {
    if (track.kind === "common" && track.defaultGoal !== "master") {
      context.addIssue({
        code: "custom",
        message: "公共 Track 的默认目标必须是 master",
        path: ["defaultGoal"],
      });
    }

    if (
      track.kind === "advanced-branch" &&
      track.exclusiveMasteryGroup === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "高级分支必须声明 exclusiveMasteryGroup",
        path: ["exclusiveMasteryGroup"],
      });
    }
  });

export const stageProjectGateSchema = z.strictObject({
  projectId: projectIdSchema,
  milestoneId: semanticIdSchema.optional(),
  when: trackGoalConditionSchema,
});

function visitCheckpointGate(
  gate: CheckpointGateValue,
  visit: (gate: CheckpointGateValue) => void,
) {
  visit(gate);
  if (gate.kind === "allOf" || gate.kind === "anyOf") {
    gate.gates.forEach((childGate) => visitCheckpointGate(childGate, visit));
  }
}

export const stageDefinitionSchema = z
  .strictObject({
    id: stageIdSchema,
    categoryOrder: z.number().int().min(0).max(11),
    order: z.number().int().nonnegative(),
    title: trimmedTextSchema,
    summary: trimmedTextSchema,
    contentStatus: z.enum(["available", "planned"]),
    trackIds: uniqueSemanticIdArraySchema.min(1),
    categoryExitForTrackIds: uniqueSemanticIdArraySchema,
    outcomes: uniqueTextArraySchema.min(1),
    estimatedHours: estimatedHoursSchema,
    projectGates: z.array(stageProjectGateSchema),
    entryGate: checkpointGateSchema.optional(),
    exitCriteria: z.array(stageExitCriterionSchema).min(1),
    retestAfterDays: z.number().int().positive().optional(),
  })
  .superRefine((stage, context) => {
    const trackIds = new Set(stage.trackIds);
    stage.categoryExitForTrackIds.forEach((trackId, index) => {
      if (!trackIds.has(trackId)) {
        context.addIssue({
          code: "custom",
          message: "分类出口 Track 必须同时存在于 trackIds",
          path: ["categoryExitForTrackIds", index],
        });
      }
    });

    if (
      stage.categoryExitForTrackIds.length > 0 &&
      stage.retestAfterDays !== 7
    ) {
      context.addIssue({
        code: "custom",
        message: "路线分类出口必须配置 7 天复测",
        path: ["retestAfterDays"],
      });
    }

    if (stage.entryGate) {
      visitCheckpointGate(stage.entryGate, (gate) => {
        if (
          (gate.kind === "checkpoint" ||
            gate.kind === "track-goal-checkpoint") &&
          gate.stageId === stage.id
        ) {
          context.addIssue({
            code: "custom",
            message: "Stage 的 entryGate 不得直接引用自身",
            path: ["entryGate"],
          });
        }

        if (
          gate.kind === "track-goal-checkpoint" &&
          !trackIds.has(gate.trackId)
        ) {
          context.addIssue({
            code: "custom",
            message: "条件 checkpoint 的 Track 必须属于当前 Stage",
            path: ["entryGate"],
          });
        }
      });
    }

    const projectGateKeys = new Set<string>();
    stage.projectGates.forEach((gate, index) => {
      const key = JSON.stringify(gate);
      if (projectGateKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: "项目门槛不得重复",
          path: ["projectGates", index],
        });
      }
      projectGateKeys.add(key);

      if (gate.when.kind === "track-goal" && !trackIds.has(gate.when.trackId)) {
        context.addIssue({
          code: "custom",
          message: "项目门槛引用的 Track 必须属于当前 Stage",
          path: ["projectGates", index, "when", "trackId"],
        });
      }
    });

    const exitCriterionIds = new Set<string>();
    stage.exitCriteria.forEach((criterion, index) => {
      if (exitCriterionIds.has(criterion.id)) {
        context.addIssue({
          code: "custom",
          message: "出口标准 ID 必须在 Stage 内唯一",
          path: ["exitCriteria", index, "id"],
        });
      }
      exitCriterionIds.add(criterion.id);

      if (
        criterion.when.kind === "track-goal" &&
        !trackIds.has(criterion.when.trackId)
      ) {
        context.addIssue({
          code: "custom",
          message: "出口标准引用的 Track 必须属于当前 Stage",
          path: ["exitCriteria", index, "when", "trackId"],
        });
      }
    });
  });

export const resourceTypeSchema = z.enum([
  "official-doc",
  "course",
  "book",
  "repository",
  "video",
  "article",
  "paper",
  "dataset",
]);

const resourceBaseSchema = z.strictObject({
  id: resourceIdSchema,
  title: trimmedTextSchema,
  authorOrOrganization: trimmedTextSchema.optional(),
  type: resourceTypeSchema,
  level: levelSchema,
  priority: z.enum(["essential", "recommended", "optional"]),
  language: z.enum(["zh-CN", "en", "bilingual", "other"]),
  reason: trimmedTextSchema,
  recommendedParts: uniqueTextArraySchema.optional(),
  aliases: uniqueTextArraySchema.optional(),
});

export const resourceSchema = z
  .discriminatedUnion("verification", [
    resourceBaseSchema.extend({
      verification: z.literal("verified"),
      url: httpUrlSchema,
      verifiedAt: localDateSchema,
      lastCheckedAt: localDateSchema,
    }),
    resourceBaseSchema.extend({
      verification: z.literal("pending"),
      url: httpUrlSchema.optional(),
      lastCheckedAt: localDateSchema.optional(),
      verificationNote: trimmedTextSchema,
    }),
    resourceBaseSchema.extend({
      verification: z.literal("broken"),
      url: httpUrlSchema,
      lastCheckedAt: localDateSchema,
      verificationNote: trimmedTextSchema,
      replacementResourceId: resourceIdSchema.optional(),
    }),
  ])
  .superRefine((resource, context) => {
    if (
      resource.verification === "verified" &&
      resource.lastCheckedAt < resource.verifiedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "lastCheckedAt 不得早于 verifiedAt",
        path: ["lastCheckedAt"],
      });
    }

    if (
      resource.verification === "broken" &&
      resource.replacementResourceId === resource.id
    ) {
      context.addIssue({
        code: "custom",
        message: "失效资源不得把自身设为替代资源",
        path: ["replacementResourceId"],
      });
    }
  });

export const projectConceptRequirementSchema = z.strictObject({
  conceptId: conceptIdSchema,
  kind: dependencyKindSchema,
  minimumStatus: z.enum(["understood", "mastered"]),
  reason: trimmedTextSchema,
});

export const projectAcceptanceCriterionSchema = z.strictObject({
  id: semanticIdSchema,
  description: trimmedTextSchema,
  required: z.boolean(),
});

export const projectResourceRefSchema = z.strictObject({
  resourceId: resourceIdSchema,
  role: z.enum([
    "dataset",
    "documentation",
    "course",
    "repository",
    "reference",
  ]),
  required: z.boolean(),
});

export const projectEnvironmentRequirementSchema = z.strictObject({
  id: semanticIdSchema,
  kind: z.enum(["software", "dataset", "hardware"]),
  label: trimmedTextSchema,
  required: z.boolean(),
  details: trimmedTextSchema,
});

export const projectExecutionPathSchema = z.strictObject({
  id: semanticIdSchema,
  title: trimmedTextSchema,
  mode: z.enum([
    "preferred-hardware",
    "consumer-hardware",
    "public-data",
    "simulation",
  ]),
  requirementIds: uniqueSemanticIdArraySchema,
  evidenceBoundary: trimmedTextSchema,
});

export const projectMilestoneContractSchema = z.strictObject({
  conceptRequirements: z.array(projectConceptRequirementSchema),
  acceptanceCriteria: z.array(projectAcceptanceCriterionSchema),
  deliverableRequirements: uniqueTextArraySchema,
  evidenceConceptIds: uniqueSemanticIdArraySchema,
});

export const projectMilestoneSchema = z.strictObject({
  id: semanticIdSchema,
  stageId: stageIdSchema,
  title: trimmedTextSchema,
  // A legacy contract is referenced, not copied into a second content source.
  contract: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("project") }),
    z.strictObject({ kind: z.literal("inline"), definition: projectMilestoneContractSchema }),
    z.strictObject({ kind: z.literal("planned") }),
  ]),
});

export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;

export const projectMetaSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: projectIdSchema,
    slug: slugSchema,
    legacySlugs: uniqueSlugArraySchema.optional(),
    title: trimmedTextSchema,
    level: levelSchema,
    trackIds: uniqueSemanticIdArraySchema.min(1),
    problemStatement: trimmedTextSchema,
    capabilitySummary: uniqueTextArraySchema.min(1),
    realWorldApplications: uniqueTextArraySchema.min(1),
    conceptRequirements: z.array(projectConceptRequirementSchema),
    estimatedHours: estimatedHoursSchema,
    techStack: uniqueTextArraySchema,
    resources: z.array(projectResourceRefSchema),
    environmentRequirements: z.array(projectEnvironmentRequirementSchema),
    executionPaths: z.array(projectExecutionPathSchema),
    acceptanceCriteria: z.array(projectAcceptanceCriterionSchema),
    deliverableRequirements: uniqueTextArraySchema,
    evidenceConceptIds: uniqueSemanticIdArraySchema,
    resumeOutcome: trimmedTextSchema,
    tags: uniqueTextArraySchema,
    publicationStatus: publicationStatusSchema,
    contentVersion: trimmedTextSchema,
    milestones: z.array(projectMilestoneSchema).optional(),
  })
  .superRefine((project, context) => {
    const milestoneIds = new Set<string>();
    let projectContractCount = 0;
    for (const [index, milestone] of (project.milestones ?? []).entries()) {
      if (milestoneIds.has(milestone.id)) context.addIssue({ code: "custom", message: "milestone ID 不得重复", path: ["milestones", index, "id"] });
      milestoneIds.add(milestone.id);
      if (milestone.contract.kind === "project") projectContractCount += 1;
      if (milestone.contract.kind === "inline") {
        const contract = milestone.contract.definition;
        if (!contract.acceptanceCriteria.some(({ required }) => required) || contract.deliverableRequirements.length === 0) {
          context.addIssue({ code: "custom", message: "可执行 milestone 必须有必需验收与交付物", path: ["milestones", index, "contract"] });
        }
        for (const ids of [contract.conceptRequirements.map(({ conceptId }) => conceptId), contract.acceptanceCriteria.map(({ id }) => id)]) {
          if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "milestone contract 引用不得重复", path: ["milestones", index, "contract"] });
        }
      }
    }
    if (projectContractCount > 1) context.addIssue({ code: "custom", message: "既有 project contract 只能由一个 milestone 承接", path: ["milestones"] });
    if (project.legacySlugs?.includes(project.slug)) {
      context.addIssue({
        code: "custom",
        message: "canonical slug 不得同时出现在 legacySlugs 中",
        path: ["legacySlugs"],
      });
    }

    const conceptRequirementIds = new Set<string>();
    project.conceptRequirements.forEach((requirement, index) => {
      if (conceptRequirementIds.has(requirement.conceptId)) {
        context.addIssue({
          code: "custom",
          message: "同一项目知识要求不得重复",
          path: ["conceptRequirements", index, "conceptId"],
        });
      }
      conceptRequirementIds.add(requirement.conceptId);
    });

    const resourceIds = new Set<string>();
    project.resources.forEach((resource, index) => {
      if (resourceIds.has(resource.resourceId)) {
        context.addIssue({
          code: "custom",
          message: "同一项目资源引用不得重复",
          path: ["resources", index, "resourceId"],
        });
      }
      resourceIds.add(resource.resourceId);
    });

    const requirementIds = new Set<string>();
    project.environmentRequirements.forEach((requirement, index) => {
      if (requirementIds.has(requirement.id)) {
        context.addIssue({
          code: "custom",
          message: "环境要求 ID 必须在项目内唯一",
          path: ["environmentRequirements", index, "id"],
        });
      }
      requirementIds.add(requirement.id);
    });

    const executionPathIds = new Set<string>();
    project.executionPaths.forEach((executionPath, pathIndex) => {
      if (executionPathIds.has(executionPath.id)) {
        context.addIssue({
          code: "custom",
          message: "执行路径 ID 必须在项目内唯一",
          path: ["executionPaths", pathIndex, "id"],
        });
      }
      executionPathIds.add(executionPath.id);

      executionPath.requirementIds.forEach((requirementId, requirementIndex) => {
        if (!requirementIds.has(requirementId)) {
          context.addIssue({
            code: "custom",
            message: "执行路径引用了不存在的环境要求",
            path: [
              "executionPaths",
              pathIndex,
              "requirementIds",
              requirementIndex,
            ],
          });
        }
      });
    });

    const acceptanceCriterionIds = new Set<string>();
    project.acceptanceCriteria.forEach((criterion, index) => {
      if (acceptanceCriterionIds.has(criterion.id)) {
        context.addIssue({
          code: "custom",
          message: "验收标准 ID 必须在项目内唯一",
          path: ["acceptanceCriteria", index, "id"],
        });
      }
      acceptanceCriterionIds.add(criterion.id);
    });

    if (project.publicationStatus === "published") {
      const executionContracts = project.milestones?.length
        ? project.milestones.flatMap(({ contract }) => contract.kind === "project" ? [project] : contract.kind === "inline" ? [contract.definition] : [])
        : [project];
      if (project.executionPaths.length === 0) {
        context.addIssue({
          code: "custom",
          message: "已发布项目必须至少提供一条执行路径",
          path: ["executionPaths"],
        });
      }

      if (executionContracts.length === 0 || !executionContracts.every((contract) => contract.acceptanceCriteria.some((criterion) => criterion.required))) {
        context.addIssue({
          code: "custom",
          message: "已发布项目的每个可执行契约必须至少包含一项必需验收标准",
          path: ["acceptanceCriteria"],
        });
      }

      if (executionContracts.length === 0 || !executionContracts.every((contract) => contract.deliverableRequirements.length > 0)) {
        context.addIssue({
          code: "custom",
          message: "已发布项目的每个可执行契约必须声明交付物要求",
          path: ["deliverableRequirements"],
        });
      }

      const hasPreferredHardwarePath = project.executionPaths.some(
        (path) => path.mode === "preferred-hardware",
      );
      const hasAlternativePath = project.executionPaths.some((path) =>
        ["consumer-hardware", "public-data", "simulation"].includes(path.mode),
      );
      if (hasPreferredHardwarePath && !hasAlternativePath) {
        context.addIssue({
          code: "custom",
          message: "含首选硬件路径的已发布项目必须提供消费级设备、公开数据或仿真替代路径",
          path: ["executionPaths"],
        });
      }
    }
  });

export type ConceptDependency = z.infer<typeof conceptDependencySchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type MasteryCriterion = z.infer<typeof masteryCriterionSchema>;
export type EmbeddedSearchEntry = z.infer<typeof embeddedSearchEntrySchema>;
export type ConceptMeta = z.infer<typeof conceptMetaSchema>;
export type TrackGoalCondition = z.infer<typeof trackGoalConditionSchema>;
export type CheckpointGate = z.infer<typeof checkpointGateSchema>;
export type StageExitCriterion = z.infer<typeof stageExitCriterionSchema>;
export type TrackDefinition = z.infer<typeof trackDefinitionSchema>;
export type StageProjectGate = z.infer<typeof stageProjectGateSchema>;
export type StageDefinition = z.infer<typeof stageDefinitionSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type ProjectConceptRequirement = z.infer<
  typeof projectConceptRequirementSchema
>;
export type ProjectAcceptanceCriterion = z.infer<
  typeof projectAcceptanceCriterionSchema
>;
export type ProjectResourceRef = z.infer<typeof projectResourceRefSchema>;
export type ProjectEnvironmentRequirement = z.infer<
  typeof projectEnvironmentRequirementSchema
>;
export type ProjectExecutionPath = z.infer<typeof projectExecutionPathSchema>;
export type ProjectMeta = z.infer<typeof projectMetaSchema>;

export function deriveDependencies(
  concepts: readonly ConceptMeta[],
): Dependency[] {
  return concepts.flatMap((concept) =>
    concept.dependencies.map((dependency) =>
      dependencySchema.parse({
        prerequisiteId: dependency.conceptId,
        targetId: concept.id,
        kind: dependency.kind,
        rationale: dependency.reason,
      }),
    ),
  );
}
