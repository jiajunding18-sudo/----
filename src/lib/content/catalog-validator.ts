import type {
  CheckpointGate,
  Dependency,
  Resource,
  StageDefinition,
  TrackDefinition,
} from "@/types";

import type { ContentValidationIssue } from "./content-errors";
import { throwIfContentIssues } from "./content-errors";
import { extractMdxHeadings, extractMdxLinks } from "./mdx-headings.mjs";
import type {
  ContentCatalogInput,
  LoadedConcept,
  LoadedProject,
} from "./manifest-types";

interface EntityIdentity {
  readonly id: string;
  readonly sourcePath: string;
  readonly fieldPath: string;
  readonly slug?: string;
}

function addMissingReferenceIssue(
  issues: ContentValidationIssue[],
  entity: EntityIdentity,
  fieldPath: string,
  referencedId: string,
  kind: string,
) {
  issues.push({
    sourcePath: entity.sourcePath,
    fieldPath,
    entityId: entity.id,
    slug: entity.slug,
    message: `${kind}引用不存在的 ID "${referencedId}"`,
  });
}

function registerUniqueIdentity(
  registry: Map<string, EntityIdentity>,
  identity: EntityIdentity,
  issues: ContentValidationIssue[],
  label: string,
) {
  const existing = registry.get(identity.id);
  if (existing) {
    issues.push({
      sourcePath: identity.sourcePath,
      fieldPath: identity.fieldPath,
      entityId: identity.id,
      slug: identity.slug,
      message: `${label} ID "${identity.id}" 与 ${existing.sourcePath}:${existing.fieldPath} 重复`,
    });
    return;
  }
  registry.set(identity.id, identity);
}

function registerSlug(
  registry: Map<string, EntityIdentity>,
  identity: EntityIdentity,
  slug: string,
  fieldPath: string,
  issues: ContentValidationIssue[],
  label: string,
) {
  const existing = registry.get(slug);
  if (existing) {
    issues.push({
      sourcePath: identity.sourcePath,
      fieldPath,
      entityId: identity.id,
      slug,
      message: `${label} slug "${slug}" 与 ${existing.sourcePath}:${existing.fieldPath} 重复`,
    });
    return;
  }
  registry.set(slug, { ...identity, fieldPath, slug });
}

function visitCheckpointGate(
  gate: CheckpointGate,
  fieldPath: string,
  visit: (gate: CheckpointGate, fieldPath: string) => void,
) {
  visit(gate, fieldPath);
  if (gate.kind === "allOf" || gate.kind === "anyOf") {
    gate.gates.forEach((childGate, index) =>
      visitCheckpointGate(childGate, `${fieldPath}.gates.${index}`, visit),
    );
  }
}

function findDirectedCycle(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>,
) {
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  const stackIndex = new Map<string, number>();

  function visit(nodeId: string): string[] | undefined {
    state.set(nodeId, "visiting");
    stackIndex.set(nodeId, stack.length);
    stack.push(nodeId);

    const targets = [...(adjacency.get(nodeId) ?? [])].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    for (const targetId of targets) {
      if (state.get(targetId) === "visiting") {
        const cycleStart = stackIndex.get(targetId);
        return cycleStart === undefined
          ? [targetId, targetId]
          : [...stack.slice(cycleStart), targetId];
      }
      if (state.get(targetId) !== "visited") {
        const cycle = visit(targetId);
        if (cycle) {
          return cycle;
        }
      }
    }

    stack.pop();
    stackIndex.delete(nodeId);
    state.set(nodeId, "visited");
    return undefined;
  }

  for (const nodeId of [...nodeIds].sort((left, right) =>
    left.localeCompare(right, "en"),
  )) {
    if (!state.has(nodeId)) {
      const cycle = visit(nodeId);
      if (cycle) {
        return cycle;
      }
    }
  }

  return undefined;
}

function conceptIdentity(concept: LoadedConcept): EntityIdentity {
  return {
    id: concept.meta.id,
    slug: concept.meta.slug,
    sourcePath: concept.sourcePath,
    fieldPath: "id",
  };
}

function projectIdentity(project: LoadedProject): EntityIdentity {
  return {
    id: project.meta.id,
    slug: project.meta.slug,
    sourcePath: project.sourcePath,
    fieldPath: "id",
  };
}

function catalogIdentity(
  id: string,
  sourcePath: string,
): EntityIdentity {
  return { id, sourcePath, fieldPath: "id" };
}

function validateConceptReferences({
  concepts,
  conceptIds,
  stageIds,
  trackIds,
  resourceIds,
  issues,
}: {
  readonly concepts: readonly LoadedConcept[];
  readonly conceptIds: ReadonlySet<string>;
  readonly stageIds: ReadonlySet<string>;
  readonly trackIds: ReadonlySet<string>;
  readonly resourceIds: ReadonlySet<string>;
  readonly issues: ContentValidationIssue[];
}) {
  const masteryCriterionRegistry = new Map<string, EntityIdentity>();
  const conceptOrderRegistryByStage = new Map<
    string,
    Map<number, EntityIdentity>
  >();

  concepts.forEach((concept) => {
    const identity = conceptIdentity(concept);
    const stageOrderRegistry =
      conceptOrderRegistryByStage.get(concept.meta.stageId) ??
      new Map<number, EntityIdentity>();
    const existingOrder = stageOrderRegistry.get(concept.meta.order);
    if (existingOrder) {
      issues.push({
        sourcePath: concept.sourcePath,
        fieldPath: "order",
        entityId: concept.meta.id,
        slug: concept.meta.slug,
        message: `Stage "${concept.meta.stageId}" 内的 Concept order ${concept.meta.order} 与 ${existingOrder.sourcePath}:order 重复，推荐路线顺序不唯一`,
      });
    } else {
      stageOrderRegistry.set(concept.meta.order, identity);
      conceptOrderRegistryByStage.set(concept.meta.stageId, stageOrderRegistry);
    }
    if (!stageIds.has(concept.meta.stageId)) {
      addMissingReferenceIssue(
        issues,
        identity,
        "stageId",
        concept.meta.stageId,
        "Stage ",
      );
    }
    concept.meta.trackIds.forEach((trackId, index) => {
      if (!trackIds.has(trackId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `trackIds.${index}`,
          trackId,
          "Track ",
        );
      }
    });
    concept.meta.resourceIds.forEach((resourceId, index) => {
      if (!resourceIds.has(resourceId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `resourceIds.${index}`,
          resourceId,
          "Resource ",
        );
      }
    });
    concept.meta.dependencies.forEach((dependency, index) => {
      if (!conceptIds.has(dependency.conceptId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `dependencies.${index}.conceptId`,
          dependency.conceptId,
          "Dependency ",
        );
      }
      if (dependency.conceptId === concept.meta.id) {
        issues.push({
          sourcePath: concept.sourcePath,
          fieldPath: `dependencies.${index}.conceptId`,
          entityId: concept.meta.id,
          slug: concept.meta.slug,
          message: `概念 "${concept.meta.id}" 不得依赖自身`,
        });
      }
    });
    concept.meta.relatedConceptIds?.forEach((relatedId, index) => {
      if (!conceptIds.has(relatedId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `relatedConceptIds.${index}`,
          relatedId,
          "Related concept ",
        );
      }
    });
    concept.meta.masteryCriteria.forEach((criterion, index) => {
      registerUniqueIdentity(
        masteryCriterionRegistry,
        {
          id: criterion.id,
          sourcePath: concept.sourcePath,
          fieldPath: `masteryCriteria.${index}.id`,
        },
        issues,
        "Mastery criterion",
      );
    });
  });
}

function decodeAnchor(anchor: string) {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}

function validateConceptBodyLinks(
  concepts: readonly LoadedConcept[],
  issues: ContentValidationIssue[],
) {
  const conceptBySlug = new Map(
    concepts.map((concept) => [concept.meta.slug, concept] as const),
  );
  const headingAnchorsBySlug = new Map(
    concepts.map((concept) => [
      concept.meta.slug,
      new Set(extractMdxHeadings(concept.body).map(({ anchor }) => anchor)),
    ] as const),
  );

  concepts.forEach((concept) => {
    extractMdxLinks(concept.body).forEach((href, index) => {
      let target: LoadedConcept | undefined = concept;
      let anchor: string | undefined;

      if (href.startsWith("#")) {
        anchor = href.slice(1);
      } else if (href === "/knowledge" || href === "/knowledge/") {
        return;
      } else if (href.startsWith("/knowledge/")) {
        const match = href.match(/^\/knowledge\/([^/?#]+)\/?(?:#([^?]+))?$/u);
        if (!match) {
          issues.push({
            sourcePath: concept.sourcePath,
            fieldPath: `<mdx>.links.${index}`,
            entityId: concept.meta.id,
            slug: concept.meta.slug,
            message: `Concept 内部链接格式无效："${href}"`,
          });
          return;
        }
        target = conceptBySlug.get(match[1]);
        anchor = match[2];
        if (!target) {
          issues.push({
            sourcePath: concept.sourcePath,
            fieldPath: `<mdx>.links.${index}`,
            entityId: concept.meta.id,
            slug: concept.meta.slug,
            message: `Concept 内部链接引用不存在的已发布页面："${href}"`,
          });
          return;
        }
        if (target.meta.publicationStatus !== "published") {
          issues.push({
            sourcePath: concept.sourcePath,
            fieldPath: `<mdx>.links.${index}`,
            entityId: concept.meta.id,
            slug: concept.meta.slug,
            message: `Concept 内部链接不得指向 ${target.meta.publicationStatus} 内容："${href}"`,
          });
          return;
        }
      } else {
        return;
      }

      if (
        target &&
        anchor &&
        !headingAnchorsBySlug.get(target.meta.slug)?.has(decodeAnchor(anchor))
      ) {
        issues.push({
          sourcePath: concept.sourcePath,
          fieldPath: `<mdx>.links.${index}`,
          entityId: concept.meta.id,
          slug: concept.meta.slug,
          message: `Concept 内部链接引用不存在的章节锚点："${href}"`,
        });
      }
    });
  });
}

function validateProjectReferences({
  projects,
  conceptIds,
  trackIds,
  resourceIds,
  issues,
}: {
  readonly projects: readonly LoadedProject[];
  readonly conceptIds: ReadonlySet<string>;
  readonly trackIds: ReadonlySet<string>;
  readonly resourceIds: ReadonlySet<string>;
  readonly issues: ContentValidationIssue[];
}) {
  projects.forEach((project) => {
    const identity = projectIdentity(project);
    project.meta.trackIds.forEach((trackId, index) => {
      if (!trackIds.has(trackId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `trackIds.${index}`,
          trackId,
          "Track ",
        );
      }
    });
    project.meta.conceptRequirements.forEach((requirement, index) => {
      if (!conceptIds.has(requirement.conceptId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `conceptRequirements.${index}.conceptId`,
          requirement.conceptId,
          "Project concept requirement ",
        );
      }
    });
    project.meta.evidenceConceptIds.forEach((conceptId, index) => {
      if (!conceptIds.has(conceptId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `evidenceConceptIds.${index}`,
          conceptId,
          "Evidence concept ",
        );
      }
    });
    project.meta.resources.forEach((resource, index) => {
      if (!resourceIds.has(resource.resourceId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `resources.${index}.resourceId`,
          resource.resourceId,
          "Project resource ",
        );
      }
    });
  });
}

function validateStageReferences({
  stages,
  stageIds,
  trackIds,
  projectIds,
  issues,
}: {
  readonly stages: readonly StageDefinition[];
  readonly stageIds: ReadonlySet<string>;
  readonly trackIds: ReadonlySet<string>;
  readonly projectIds: ReadonlySet<string>;
  readonly issues: ContentValidationIssue[];
}) {
  const sourcePath = "content/catalog/stages.ts";
  stages.forEach((stage, stageIndex) => {
    const identity = catalogIdentity(stage.id, sourcePath);
    stage.trackIds.forEach((trackId, index) => {
      if (!trackIds.has(trackId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `${stageIndex}.trackIds.${index}`,
          trackId,
          "Stage Track ",
        );
      }
    });
    stage.projectGates.forEach((projectGate, index) => {
      if (!projectIds.has(projectGate.projectId)) {
        addMissingReferenceIssue(
          issues,
          identity,
          `${stageIndex}.projectGates.${index}.projectId`,
          projectGate.projectId,
          "Stage project gate ",
        );
      }
      if (
        projectGate.when.kind === "track-goal" &&
        !trackIds.has(projectGate.when.trackId)
      ) {
        addMissingReferenceIssue(
          issues,
          identity,
          `${stageIndex}.projectGates.${index}.when.trackId`,
          projectGate.when.trackId,
          "Stage gate Track ",
        );
      }
    });
    stage.exitCriteria.forEach((criterion, index) => {
      if (
        criterion.when.kind === "track-goal" &&
        !trackIds.has(criterion.when.trackId)
      ) {
        addMissingReferenceIssue(
          issues,
          identity,
          `${stageIndex}.exitCriteria.${index}.when.trackId`,
          criterion.when.trackId,
          "Exit criterion Track ",
        );
      }
    });
    if (stage.entryGate) {
      visitCheckpointGate(stage.entryGate, `${stageIndex}.entryGate`, (gate, path) => {
        if (gate.kind === "checkpoint" || gate.kind === "track-goal-checkpoint") {
          if (!stageIds.has(gate.stageId)) {
            addMissingReferenceIssue(
              issues,
              identity,
              `${path}.stageId`,
              gate.stageId,
              "Checkpoint ",
            );
          }
        }
        if (
          gate.kind === "track-goal-checkpoint" &&
          !trackIds.has(gate.trackId)
        ) {
          addMissingReferenceIssue(
            issues,
            identity,
            `${path}.trackId`,
            gate.trackId,
            "Checkpoint Track ",
          );
        }
      });
    }
  });
}

function validateResourceReferences(
  resources: readonly Resource[],
  resourceIds: ReadonlySet<string>,
  concepts: readonly LoadedConcept[],
  projects: readonly LoadedProject[],
  issues: ContentValidationIssue[],
) {
  const referencedResourceIds = new Set([
    ...concepts.flatMap(({ meta }) => meta.resourceIds),
    ...projects.flatMap(({ meta }) =>
      meta.resources.map(({ resourceId }) => resourceId),
    ),
  ]);

  resources.forEach((resource, index) => {
    if (!referencedResourceIds.has(resource.id)) {
      issues.push({
        sourcePath: "content/catalog/resources.ts",
        fieldPath: `${index}.id`,
        entityId: resource.id,
        message:
          "Resource 必须由至少一个 Concept.resourceIds 或 Project.resources 正式关联",
      });
    }

    if (
      resource.verification === "broken" &&
      resource.replacementResourceId &&
      !resourceIds.has(resource.replacementResourceId)
    ) {
      addMissingReferenceIssue(
        issues,
        catalogIdentity(resource.id, "content/catalog/resources.ts"),
        `${index}.replacementResourceId`,
        resource.replacementResourceId,
        "Replacement resource ",
      );
    }
  });
}

function validateTrackGroups(
  tracks: readonly TrackDefinition[],
  issues: ContentValidationIssue[],
) {
  const groups = new Map<string, TrackDefinition[]>();
  tracks.forEach((track) => {
    if (track.exclusiveMasteryGroup) {
      const groupTracks = groups.get(track.exclusiveMasteryGroup) ?? [];
      groupTracks.push(track);
      groups.set(track.exclusiveMasteryGroup, groupTracks);
    }
  });

  groups.forEach((groupTracks, groupId) => {
    const masters = groupTracks.filter((track) => track.defaultGoal === "master");
    if (masters.length !== 1) {
      issues.push({
        sourcePath: "content/catalog/tracks.ts",
        fieldPath: "exclusiveMasteryGroup",
        entityId: groupId,
        message: `互斥主修组 "${groupId}" 必须恰有一个默认 master，当前为 ${masters.length} 个`,
      });
    }
  });
}

function validateCatalogOrders({
  stages,
  tracks,
  issues,
}: {
  readonly stages: readonly StageDefinition[];
  readonly tracks: readonly TrackDefinition[];
  readonly issues: ContentValidationIssue[];
}) {
  const stageOrders = new Map<number, StageDefinition>();
  stages.forEach((stage, index) => {
    const existing = stageOrders.get(stage.order);
    if (existing) {
      issues.push({
        sourcePath: "content/catalog/stages.ts",
        fieldPath: `${index}.order`,
        entityId: stage.id,
        message: `Stage order ${stage.order} 与 "${existing.id}" 重复，推荐展示位置不唯一`,
      });
      return;
    }
    stageOrders.set(stage.order, stage);
  });

  const trackOrders = new Map<number, TrackDefinition>();
  tracks.forEach((track, index) => {
    const existing = trackOrders.get(track.order);
    if (existing) {
      issues.push({
        sourcePath: "content/catalog/tracks.ts",
        fieldPath: `${index}.order`,
        entityId: track.id,
        message: `Track order ${track.order} 与 "${existing.id}" 重复，推荐展示位置不唯一`,
      });
      return;
    }
    trackOrders.set(track.order, track);
  });
}

function validateStageContentStatus(
  stages: readonly StageDefinition[],
  concepts: readonly LoadedConcept[],
  issues: ContentValidationIssue[],
) {
  const publishedConceptCountByStage = new Map<string, number>();
  concepts.forEach((concept) => {
    if (concept.meta.publicationStatus !== "published") {
      return;
    }
    publishedConceptCountByStage.set(
      concept.meta.stageId,
      (publishedConceptCountByStage.get(concept.meta.stageId) ?? 0) + 1,
    );
  });

  stages.forEach((stage, index) => {
    const publishedConceptCount =
      publishedConceptCountByStage.get(stage.id) ?? 0;
    if (stage.contentStatus === "available" && publishedConceptCount === 0) {
      issues.push({
        sourcePath: "content/catalog/stages.ts",
        fieldPath: `${index}.contentStatus`,
        entityId: stage.id,
        message: `Stage "${stage.id}" 标记为 available，但没有已发布 Concept`,
      });
    }
    if (stage.contentStatus === "planned" && publishedConceptCount > 0) {
      issues.push({
        sourcePath: "content/catalog/stages.ts",
        fieldPath: `${index}.contentStatus`,
        entityId: stage.id,
        message: `Stage "${stage.id}" 标记为 planned，但存在 ${publishedConceptCount} 个已发布 Concept`,
      });
    }
  });
}

function validateRouteConnectivity({
  stages,
  tracks,
  concepts,
  issues,
}: {
  readonly stages: readonly StageDefinition[];
  readonly tracks: readonly TrackDefinition[];
  readonly concepts: readonly LoadedConcept[];
  readonly issues: ContentValidationIssue[];
}) {
  const referencedCheckpointIds = new Set<string>();
  stages.forEach((stage) => {
    if (!stage.entryGate) {
      return;
    }
    visitCheckpointGate(stage.entryGate, "entryGate", (gate) => {
      if (gate.kind === "checkpoint" || gate.kind === "track-goal-checkpoint") {
        referencedCheckpointIds.add(gate.stageId);
      }
    });
  });

  const publishedConceptStageIds = new Set(
    concepts
      .filter(({ meta }) => meta.publicationStatus === "published")
      .map(({ meta }) => meta.stageId),
  );
  stages.forEach((stage, index) => {
    if (
      stage.categoryExitForTrackIds.length === 0 &&
      !referencedCheckpointIds.has(stage.id) &&
      !publishedConceptStageIds.has(stage.id)
    ) {
      issues.push({
        sourcePath: "content/catalog/stages.ts",
        fieldPath: `${index}.id`,
        entityId: stage.id,
        message:
          "Stage 既不是分类出口，也没有已发布 Concept 或下游 entryGate 引用，形成孤立 checkpoint",
      });
    }
  });

  tracks.forEach((track, index) => {
    if (!stages.some((stage) => stage.trackIds.includes(track.id))) {
      issues.push({
        sourcePath: "content/catalog/tracks.ts",
        fieldPath: `${index}.id`,
        entityId: track.id,
        message: `Track "${track.id}" 没有任何 Stage 引用，形成孤立 Track`,
      });
    }
  });
}

function validateHardDependencyCycle(
  concepts: readonly LoadedConcept[],
  dependencies: readonly Dependency[],
  issues: ContentValidationIssue[],
) {
  const adjacency = new Map<string, string[]>();
  dependencies
    .filter((dependency) => dependency.kind === "hard")
    .forEach((dependency) => {
      const targets = adjacency.get(dependency.prerequisiteId) ?? [];
      targets.push(dependency.targetId);
      adjacency.set(dependency.prerequisiteId, targets);
    });
  const cycle = findDirectedCycle(
    concepts.map((concept) => concept.meta.id),
    adjacency,
  );
  if (!cycle) {
    return;
  }

  const cycleTarget = cycle.at(-2) ?? cycle[0];
  const targetConcept = concepts.find(
    (concept) => concept.meta.id === cycleTarget,
  );
  issues.push({
    sourcePath: targetConcept?.sourcePath ?? "content/concepts",
    fieldPath: "dependencies",
    entityId: cycleTarget,
    slug: targetConcept?.meta.slug,
    message: `hard dependency 形成有向环：${cycle.join(" -> ")}`,
  });
}

function validateStageGateCycle(
  stages: readonly StageDefinition[],
  issues: ContentValidationIssue[],
) {
  const adjacency = new Map<string, string[]>();
  stages.forEach((stage) => {
    if (!stage.entryGate) {
      return;
    }
    const prerequisites: string[] = [];
    visitCheckpointGate(stage.entryGate, "entryGate", (gate) => {
      if (gate.kind === "checkpoint" || gate.kind === "track-goal-checkpoint") {
        prerequisites.push(gate.stageId);
      }
    });
    adjacency.set(stage.id, prerequisites);
  });
  const cycle = findDirectedCycle(
    stages.map((stage) => stage.id),
    adjacency,
  );
  if (cycle) {
    issues.push({
      sourcePath: "content/catalog/stages.ts",
      fieldPath: "entryGate",
      entityId: cycle[0],
      message: `Stage entryGate 形成有向环：${cycle.join(" -> ")}`,
    });
  }
}

export function validateContentCatalog(
  input: ContentCatalogInput,
  dependencies: readonly Dependency[],
) {
  const issues: ContentValidationIssue[] = [];
  const globalIds = new Map<string, EntityIdentity>();
  const conceptSlugs = new Map<string, EntityIdentity>();
  const projectSlugs = new Map<string, EntityIdentity>();

  input.concepts.forEach((concept) => {
    const identity = conceptIdentity(concept);
    registerUniqueIdentity(globalIds, identity, issues, "Concept");
    registerSlug(
      conceptSlugs,
      identity,
      concept.meta.slug,
      "slug",
      issues,
      "Concept",
    );
    concept.meta.legacySlugs?.forEach((slug, index) =>
      registerSlug(
        conceptSlugs,
        identity,
        slug,
        `legacySlugs.${index}`,
        issues,
        "Concept",
      ),
    );
  });
  input.projects.forEach((project) => {
    const identity = projectIdentity(project);
    registerUniqueIdentity(globalIds, identity, issues, "Project");
    registerSlug(
      projectSlugs,
      identity,
      project.meta.slug,
      "slug",
      issues,
      "Project",
    );
    project.meta.legacySlugs?.forEach((slug, index) =>
      registerSlug(
        projectSlugs,
        identity,
        slug,
        `legacySlugs.${index}`,
        issues,
        "Project",
      ),
    );
  });
  input.tracks.forEach((track, index) =>
    registerUniqueIdentity(
      globalIds,
      catalogIdentity(track.id, "content/catalog/tracks.ts"),
      issues,
      `Track at index ${index}`,
    ),
  );
  input.stages.forEach((stage, index) => {
    registerUniqueIdentity(
      globalIds,
      catalogIdentity(stage.id, "content/catalog/stages.ts"),
      issues,
      `Stage at index ${index}`,
    );
    stage.exitCriteria.forEach((criterion, criterionIndex) =>
      registerUniqueIdentity(
        globalIds,
        {
          id: criterion.id,
          sourcePath: "content/catalog/stages.ts",
          fieldPath: `${index}.exitCriteria.${criterionIndex}.id`,
        },
        issues,
        "Stage exit criterion",
      ),
    );
  });
  input.resources.forEach((resource, index) =>
    registerUniqueIdentity(
      globalIds,
      catalogIdentity(resource.id, "content/catalog/resources.ts"),
      issues,
      `Resource at index ${index}`,
    ),
  );

  const conceptIds = new Set(input.concepts.map((concept) => concept.meta.id));
  const projectIds = new Set(input.projects.map((project) => project.meta.id));
  const trackIds = new Set(input.tracks.map((track) => track.id));
  const stageIds = new Set(input.stages.map((stage) => stage.id));
  const resourceIds = new Set(input.resources.map((resource) => resource.id));

  validateConceptReferences({
    concepts: input.concepts,
    conceptIds,
    stageIds,
    trackIds,
    resourceIds,
    issues,
  });
  validateConceptBodyLinks(input.concepts, issues);
  validateProjectReferences({
    projects: input.projects,
    conceptIds,
    trackIds,
    resourceIds,
    issues,
  });
  validateStageReferences({
    stages: input.stages,
    stageIds,
    trackIds,
    projectIds,
    issues,
  });
  validateResourceReferences(
    input.resources,
    resourceIds,
    input.concepts,
    input.projects,
    issues,
  );
  validateTrackGroups(input.tracks, issues);
  validateCatalogOrders({
    stages: input.stages,
    tracks: input.tracks,
    issues,
  });
  validateStageContentStatus(input.stages, input.concepts, issues);
  validateRouteConnectivity({
    stages: input.stages,
    tracks: input.tracks,
    concepts: input.concepts,
    issues,
  });
  validateHardDependencyCycle(input.concepts, dependencies, issues);
  validateStageGateCycle(input.stages, issues);

  throwIfContentIssues(issues);
}
