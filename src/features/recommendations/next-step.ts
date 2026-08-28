import {
  getConceptReadiness,
  getConceptStatus,
  getRouteRequiredStatus,
  hasReachedRequiredStatus,
  type RequiredConceptStatus,
} from "@/features/progress/progress-domain";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type {
  ConceptMeta,
  LearningStateV1,
  ProjectMeta,
  StageDefinition,
  TrackDefinition,
} from "@/types";

export type NextStepReasonCode =
  | "continue-learning"
  | "project-gap"
  | "hard-prerequisite"
  | "next-unlocked";

export interface NextStepDependencyNotice {
  readonly conceptId: string;
  readonly title: string;
  readonly reason: string;
}

export interface NextStepRelatedProject {
  readonly projectId: string;
  readonly title: string;
}

export interface ConceptNextStep {
  readonly kind: "recommendation";
  readonly targetType: "concept";
  readonly targetId: string;
  readonly requiredStatus: RequiredConceptStatus;
  readonly reasonCode: NextStepReasonCode;
  readonly reasonText: string;
  readonly estimatedTime: {
    readonly minHours: number;
    readonly maxHours: number;
  };
  readonly completionCriteria: readonly string[];
  readonly relatedProject?: NextStepRelatedProject;
  readonly unmetRecommendedDependencies: readonly NextStepDependencyNotice[];
}

export interface EmptyNextStep {
  readonly kind: "empty";
  readonly reasonCode: "published-route-complete" | "no-actionable-concept";
  readonly reasonText: string;
}

export type NextStep = ConceptNextStep | EmptyNextStep;

export interface NextStepCatalog {
  readonly concepts: readonly DeepReadonly<ConceptMeta>[];
  readonly projects: readonly DeepReadonly<ProjectMeta>[];
  readonly stages: readonly DeepReadonly<StageDefinition>[];
  readonly tracks: readonly DeepReadonly<TrackDefinition>[];
}

export interface GetNextStepInput {
  readonly catalog: NextStepCatalog;
  readonly state: LearningStateV1;
}

interface RecommendationContext {
  readonly catalog: NextStepCatalog;
  readonly state: LearningStateV1;
  readonly concepts: readonly DeepReadonly<ConceptMeta>[];
  readonly conceptsById: ReadonlyMap<string, DeepReadonly<ConceptMeta>>;
  readonly compareConcepts: (
    left: DeepReadonly<ConceptMeta>,
    right: DeepReadonly<ConceptMeta>,
  ) => number;
}

interface HardPrerequisiteSource {
  readonly blockedConcept: DeepReadonly<ConceptMeta>;
  readonly relatedProject?: DeepReadonly<ProjectMeta>;
}

const requiredStatusLabel: Readonly<Record<RequiredConceptStatus, string>> = {
  understood: "已理解",
  mastered: "已掌握",
};

function isCurrentPublishedConcept(
  concept: DeepReadonly<ConceptMeta>,
  availableStageIds: ReadonlySet<string>,
  trackIds: ReadonlySet<string>,
) {
  return (
    concept.publicationStatus === "published" &&
    availableStageIds.has(concept.stageId) &&
    concept.trackIds.some((trackId) => trackIds.has(trackId))
  );
}

function createContext(
  catalog: NextStepCatalog,
  state: LearningStateV1,
): RecommendationContext {
  const stageOrder = new Map(catalog.stages.map((stage) => [stage.id, stage.order]));
  const availableStageIds = new Set(
    catalog.stages
      .filter(({ contentStatus }) => contentStatus === "available")
      .map(({ id }) => id),
  );
  const trackIds = new Set(catalog.tracks.map(({ id }) => id));
  const compareConcepts = (
    left: DeepReadonly<ConceptMeta>,
    right: DeepReadonly<ConceptMeta>,
  ) =>
    (stageOrder.get(left.stageId) ?? Number.MAX_SAFE_INTEGER) -
      (stageOrder.get(right.stageId) ?? Number.MAX_SAFE_INTEGER) ||
    left.order - right.order ||
    left.id.localeCompare(right.id, "en");
  const concepts = catalog.concepts
    .filter((concept) =>
      isCurrentPublishedConcept(concept, availableStageIds, trackIds),
    )
    .toSorted(compareConcepts);

  return {
    catalog,
    state,
    concepts,
    conceptsById: new Map(concepts.map((concept) => [concept.id, concept])),
    compareConcepts,
  };
}

function getUnmetRecommendedDependencies(
  context: RecommendationContext,
  concept: DeepReadonly<ConceptMeta>,
): NextStepDependencyNotice[] {
  const readiness = getConceptReadiness(
    concept,
    context.state.conceptProgress,
  );
  const dependencyById = new Map(
    concept.dependencies.map((dependency) => [dependency.conceptId, dependency]),
  );

  return readiness.missingRecommended.flatMap((conceptId) => {
    const prerequisite = context.conceptsById.get(conceptId);
    const dependency = dependencyById.get(conceptId);
    return prerequisite && dependency
      ? [
          {
            conceptId,
            title: prerequisite.title,
            reason: dependency.reason,
          },
        ]
      : [];
  });
}

function createConceptStep(
  context: RecommendationContext,
  concept: DeepReadonly<ConceptMeta>,
  requiredStatus: RequiredConceptStatus,
  reasonCode: NextStepReasonCode,
  reasonText: string,
  relatedProject?: DeepReadonly<ProjectMeta>,
): ConceptNextStep {
  return {
    kind: "recommendation",
    targetType: "concept",
    targetId: concept.id,
    requiredStatus,
    reasonCode,
    reasonText,
    estimatedTime: {
      minHours: concept.estimatedHours.min,
      maxHours: concept.estimatedHours.max,
    },
    completionCriteria: concept.masteryCriteria
      .filter(({ required }) => required)
      .map(({ description }) => description),
    relatedProject: relatedProject
      ? { projectId: relatedProject.id, title: relatedProject.title }
      : undefined,
    unmetRecommendedDependencies: getUnmetRecommendedDependencies(
      context,
      concept,
    ),
  };
}

function findFirstExecutableHardPrerequisite(
  context: RecommendationContext,
  concept: DeepReadonly<ConceptMeta>,
  visited = new Set<string>(),
): DeepReadonly<ConceptMeta> | undefined {
  if (visited.has(concept.id)) return undefined;
  visited.add(concept.id);

  const missingHardConcepts = getConceptReadiness(
    concept,
    context.state.conceptProgress,
  ).missingHard
    .flatMap((conceptId) => {
      const prerequisite = context.conceptsById.get(conceptId);
      return prerequisite ? [prerequisite] : [];
    })
    .toSorted(context.compareConcepts);

  for (const prerequisite of missingHardConcepts) {
    const status = getConceptStatus(
      context.state.conceptProgress,
      prerequisite.id,
    );
    if (hasReachedRequiredStatus(status, "understood")) continue;

    const readiness = getConceptReadiness(
      prerequisite,
      context.state.conceptProgress,
    );
    if (readiness.ready) return prerequisite;

    const executable = findFirstExecutableHardPrerequisite(
      context,
      prerequisite,
      visited,
    );
    if (executable) return executable;
  }

  return undefined;
}

function createHardPrerequisiteStep(
  context: RecommendationContext,
  target: DeepReadonly<ConceptMeta>,
  source: HardPrerequisiteSource,
) {
  const reasonText = source.relatedProject
    ? `「${source.relatedProject.title}」需要「${source.blockedConcept.title}」；它仍有 hard 前置，建议先完成「${target.title}」。`
    : `你正在学习「${source.blockedConcept.title}」，但它的 hard 前置尚未满足；建议先完成「${target.title}」。`;

  return createConceptStep(
    context,
    target,
    "understood",
    "hard-prerequisite",
    reasonText,
    source.relatedProject,
  );
}

function getContinueLearningStep(
  context: RecommendationContext,
): ConceptNextStep | undefined {
  const learningConcepts = context.concepts.filter(
    ({ id }) =>
      getConceptStatus(context.state.conceptProgress, id) === "learning",
  );

  for (const concept of learningConcepts) {
    const readiness = getConceptReadiness(
      concept,
      context.state.conceptProgress,
    );
    if (readiness.ready) {
      return createConceptStep(
        context,
        concept,
        getRouteRequiredStatus(
          concept,
          context.catalog.tracks,
          context.state.preferences,
        ),
        "continue-learning",
        `你已经开始学习「${concept.title}」，建议先继续完成它。`,
      );
    }

    const prerequisite = findFirstExecutableHardPrerequisite(context, concept);
    if (prerequisite) {
      return createHardPrerequisiteStep(context, prerequisite, {
        blockedConcept: concept,
      });
    }
  }

  return undefined;
}

function getProjectRouteRank(
  project: DeepReadonly<ProjectMeta>,
  conceptRank: ReadonlyMap<string, number>,
) {
  return Math.min(
    ...project.conceptRequirements.map(
      ({ conceptId }) => conceptRank.get(conceptId) ?? Number.MAX_SAFE_INTEGER,
    ),
    Number.MAX_SAFE_INTEGER,
  );
}

function getCurrentPublishedProject(
  context: RecommendationContext,
): DeepReadonly<ProjectMeta> | undefined {
  const conceptRank = new Map(
    context.concepts.map((concept, index) => [concept.id, index]),
  );
  const unfinishedProjects = context.catalog.projects
    .filter(
      (project) =>
        project.publicationStatus === "published" &&
        context.state.projectProgress[project.id]?.status !== "completed",
    )
    .toSorted(
      (left, right) =>
        getProjectRouteRank(left, conceptRank) -
          getProjectRouteRank(right, conceptRank) ||
        left.id.localeCompare(right.id, "en"),
    );
  const primaryProject = unfinishedProjects.find(
    ({ id }) => id === context.state.preferences.primaryProjectId,
  );
  if (primaryProject) return primaryProject;

  const inProgressProjects = unfinishedProjects
    .filter(
      ({ id }) => context.state.projectProgress[id]?.status === "in_progress",
    )
    .toSorted((left, right) => {
      const leftUpdatedAt = context.state.projectProgress[left.id]?.updatedAt ?? "";
      const rightUpdatedAt =
        context.state.projectProgress[right.id]?.updatedAt ?? "";
      return (
        rightUpdatedAt.localeCompare(leftUpdatedAt, "en") ||
        left.id.localeCompare(right.id, "en")
      );
    });

  return inProgressProjects[0] ?? unfinishedProjects[0];
}

function getProjectGapStep(
  context: RecommendationContext,
): ConceptNextStep | undefined {
  const project = getCurrentPublishedProject(context);
  if (!project) return undefined;

  const unmetRequirements = project.conceptRequirements
    .filter(({ kind }) => kind === "hard")
    .flatMap((requirement) => {
      const concept = context.conceptsById.get(requirement.conceptId);
      if (!concept) return [];
      const status = getConceptStatus(
        context.state.conceptProgress,
        requirement.conceptId,
      );
      return hasReachedRequiredStatus(status, requirement.minimumStatus)
        ? []
        : [{ concept, requirement }];
    })
    .toSorted((left, right) =>
      context.compareConcepts(left.concept, right.concept),
    );

  for (const { concept, requirement } of unmetRequirements) {
    const readiness = getConceptReadiness(
      concept,
      context.state.conceptProgress,
    );
    if (readiness.ready) {
      return createConceptStep(
        context,
        concept,
        requirement.minimumStatus,
        "project-gap",
        `「${project.title}」需要「${concept.title}」达到${requiredStatusLabel[requirement.minimumStatus]}，这是当前项目尚缺少的能力。`,
        project,
      );
    }

    const prerequisite = findFirstExecutableHardPrerequisite(context, concept);
    if (prerequisite) {
      return createHardPrerequisiteStep(context, prerequisite, {
        blockedConcept: concept,
        relatedProject: project,
      });
    }
  }

  return undefined;
}

function getNextUnlockedConceptStep(
  context: RecommendationContext,
): ConceptNextStep | undefined {
  const concept = context.concepts.find(
    (candidate) =>
      candidate.requiredness === "required" &&
      getConceptStatus(context.state.conceptProgress, candidate.id) ===
        "not_started" &&
      getConceptReadiness(
        candidate,
        context.state.conceptProgress,
      ).ready,
  );
  if (!concept) return undefined;

  return createConceptStep(
    context,
    concept,
    getRouteRequiredStatus(
      concept,
      context.catalog.tracks,
      context.state.preferences,
    ),
    "next-unlocked",
    `你已经满足「${concept.title}」的所有 hard 前置条件，它是当前路线中下一个可开始的核心节点。`,
  );
}

function hasCompletedPublishedRoute(context: RecommendationContext) {
  return context.concepts.every((concept) =>
    hasReachedRequiredStatus(
      getConceptStatus(context.state.conceptProgress, concept.id),
      getRouteRequiredStatus(
        concept,
        context.catalog.tracks,
        context.state.preferences,
      ),
    ),
  );
}

export function getNextStep({ catalog, state }: GetNextStepInput): NextStep {
  const context = createContext(catalog, state);

  return (
    getContinueLearningStep(context) ??
    getProjectGapStep(context) ??
    getNextUnlockedConceptStep(context) ??
    (hasCompletedPublishedRoute(context)
      ? {
          kind: "empty",
          reasonCode: "published-route-complete",
          reasonText: "当前已发布内容已全部完成，后续路线尚未正式展开。",
        }
      : {
          kind: "empty",
          reasonCode: "no-actionable-concept",
          reasonText:
            "当前没有符合规则的可开始任务；已理解但未达到路线目标的内容需继续通过正式证据流程完成。",
        })
  );
}
