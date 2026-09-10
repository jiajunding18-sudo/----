import {
  getConceptReadiness,
  getConceptStatus,
  getRouteRequiredStatus,
  hasReachedRequiredStatus,
  type RequiredConceptStatus,
} from "@/features/progress/progress-domain";
import {
  getStageReadiness,
  type StageReadiness,
} from "@/features/progress/stage-readiness";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import { getProjectScopeProgress, isProjectGateCompleted, resolveProjectMilestone } from "@/features/projects/project-milestones";
import type {
  ConceptMeta,
  LearningStateV3,
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

export interface ProjectMilestoneNextStep {
  readonly kind: "project-milestone";
  readonly projectId: string;
  readonly milestoneId: string;
  readonly title: string;
  readonly contractPublished: boolean;
  readonly reasonText: string;
}
export interface StageExitNextStep {
  readonly kind: "stage-exit" | "eligibility-pending";
  readonly stageId: string;
  readonly title: string;
  readonly criterionIds: readonly string[];
  readonly reasonText: string;
}
export type NextStep = ConceptNextStep | EmptyNextStep | ProjectMilestoneNextStep | StageExitNextStep;

export interface NextStepCatalog {
  readonly concepts: readonly DeepReadonly<ConceptMeta>[];
  readonly projects: readonly DeepReadonly<ProjectMeta>[];
  readonly stages: readonly DeepReadonly<StageDefinition>[];
  readonly tracks: readonly DeepReadonly<TrackDefinition>[];
}

export interface GetNextStepInput {
  readonly catalog: NextStepCatalog;
  readonly state: LearningStateV3;
  readonly now?: string;
}

interface RecommendationContext {
  readonly now: string;
  readonly catalog: NextStepCatalog;
  readonly state: LearningStateV3;
  readonly concepts: readonly DeepReadonly<ConceptMeta>[];
  readonly conceptsById: ReadonlyMap<string, DeepReadonly<ConceptMeta>>;
  readonly stagesById: ReadonlyMap<string, DeepReadonly<StageDefinition>>;
  readonly stageReadiness: Map<string, StageReadiness>;
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
  state: LearningStateV3,
  now: string,
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
    now,
    catalog,
    state,
    concepts,
    conceptsById: new Map(concepts.map((concept) => [concept.id, concept])),
    stagesById: new Map(catalog.stages.map((stage) => [stage.id, stage])),
    stageReadiness: new Map(),
    compareConcepts,
  };
}

function isConceptStageEntryReady(
  context: RecommendationContext,
  concept: DeepReadonly<ConceptMeta>,
) {
  const stage = context.stagesById.get(concept.stageId);
  if (!stage) return false;

  let readiness = context.stageReadiness.get(stage.id);
  if (!readiness) {
    readiness = getStageReadiness(
      stage,
      context.catalog.stages,
      context.catalog.concepts,
      context.catalog.projects,
      context.catalog.tracks,
      context.state,
      context.now,
    );
    context.stageReadiness.set(stage.id, readiness);
  }
  return readiness.entryReady;
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
    if (!isConceptStageEntryReady(context, prerequisite)) continue;

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
    if (!isConceptStageEntryReady(context, concept)) continue;
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
    .flatMap((project) => {
      const scopes = project.milestones?.length ? project.milestones.map(({ id }) => id) : [undefined];
      return scopes.flatMap((milestoneId) => {
        const scoped = resolveProjectMilestone(project, milestoneId);
        const progress = getProjectScopeProgress(context.state, project.id, milestoneId);
        return scoped && !isProjectGateCompleted(project, context.state, milestoneId)
          ? [{ project: scoped, milestoneId, progress }] : [];
      });
    })
    .filter(
      ({ project }) =>
        project.publicationStatus === "published",
    )
    .toSorted(
      (left, right) =>
        getProjectRouteRank(left.project, conceptRank) -
          getProjectRouteRank(right.project, conceptRank) ||
        left.project.id.localeCompare(right.project.id, "en") ||
        (left.milestoneId ?? "").localeCompare(right.milestoneId ?? "", "en"),
    );
  const primaryProject = unfinishedProjects.find(
    ({ project }) => project.id === context.state.preferences.primaryProjectId,
  );
  const inProgressProjects = unfinishedProjects
    .filter(
      ({ progress }) => progress?.status === "in_progress",
    )
    .toSorted((left, right) => {
      const leftUpdatedAt = left.progress?.updatedAt ?? "";
      const rightUpdatedAt = right.progress?.updatedAt ?? "";
      return (
        rightUpdatedAt.localeCompare(leftUpdatedAt, "en") ||
        left.project.id.localeCompare(right.project.id, "en") ||
        (left.milestoneId ?? "").localeCompare(right.milestoneId ?? "", "en")
      );
    });

  if (primaryProject) {
    return inProgressProjects.find(({ project }) => project.id === primaryProject.project.id)?.project ?? primaryProject.project;
  }
  return (inProgressProjects[0] ?? unfinishedProjects[0])?.project;
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
    if (!isConceptStageEntryReady(context, concept)) continue;
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
  onlyNotStarted = true,
): ConceptNextStep | undefined {
  const concept = context.concepts.find(
    (candidate) =>
      candidate.requiredness === "required" &&
      (!onlyNotStarted || getConceptStatus(context.state.conceptProgress, candidate.id) === "not_started") &&
      !hasReachedRequiredStatus(getConceptStatus(context.state.conceptProgress, candidate.id), getRouteRequiredStatus(candidate, context.catalog.tracks, context.state.preferences)) &&
      isConceptStageEntryReady(context, candidate) &&
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

function getPendingMilestoneStep(context: RecommendationContext): ProjectMilestoneNextStep | undefined {
  const stages = [...context.catalog.stages].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const stage of stages) {
    if (stage.contentStatus !== "available") continue;
    if (context.state.preferences.activeStageId && context.state.preferences.activeStageId !== stage.id) continue;
    const readiness = getStageReadiness(stage, context.catalog.stages, context.catalog.concepts, context.catalog.projects, context.catalog.tracks, context.state, context.now);
    if (!readiness.entryReady || readiness.unmetMasterConceptIds.length || readiness.unmetUnderstandConceptIds.length || readiness.unmetProjectRequirementConceptIds.length) continue;
    for (const gate of stage.projectGates) {
      if (!gate.milestoneId || !readiness.effectiveRequiredProjectIds.includes(gate.projectId)) continue;
      if (gate.when.kind === "track-goal" && gate.when.minimumGoal === "master" && context.state.preferences.trackGoals[gate.when.trackId] !== "master") continue;
      const project = context.catalog.projects.find(({ id }) => id === gate.projectId);
      const milestone = project?.milestones?.find(({ id }) => id === gate.milestoneId);
      if (!project || project.publicationStatus !== "published" || !milestone || isProjectGateCompleted(project, context.state, milestone.id)) continue;
      const contractPublished = milestone.contract.kind !== "planned";
      return { kind: "project-milestone", projectId: project.id, milestoneId: milestone.id, title: milestone.title, contractPublished,
        reasonText: contractPublished ? "当前阶段仍需独立验收此项目增量；历史完成不会代替它。" : "当前阶段项目增量的正式契约尚未发布；已有历史完成不能满足此 gate。" };
    }
  }
  return undefined;
}

function getStageExitStep(context: RecommendationContext): StageExitNextStep | undefined {
  for (const stage of [...context.catalog.stages].sort((a,b) => a.order - b.order || a.id.localeCompare(b.id))) {
    if (stage.contentStatus !== "available" || (context.state.preferences.activeStageId && context.state.preferences.activeStageId !== stage.id)) continue;
    const r = getStageReadiness(stage, context.catalog.stages, context.catalog.concepts, context.catalog.projects, context.catalog.tracks, context.state, context.now);
    if (r.ready || !r.entryReady || r.unmetMasterConceptIds.length || r.unmetUnderstandConceptIds.length || r.unmetProjectRequirementConceptIds.length || r.incompleteProjectIds.length) continue;
    return { kind: r.nonRetestReady ? "eligibility-pending" : "stage-exit", stageId: stage.id, title: stage.title,
      criterionIds: r.unmetExitCriterionIds,
      reasonText: r.nonRetestReady ? (r.currentEligibilityValid ? (r.retestRequired ? "首次出口条件与资格已核验；请在规定间隔后完成保留复测。当前资格不等于阶段完成。" : "出口条件与资格已核验；没有额外复测等待天数，仍需最终出口确认。") : "非复测条件已满足，但当前轮次需要核验；请查看出口证据与资格。") : "Concept 与项目门槛已满足；请逐条登记出口证据、解释并显式确认。项目完成不会自动通过出口标准。" };
  }
}

export function getNextStep({ catalog, state, now = new Date().toISOString() }: GetNextStepInput): NextStep {
  const context = createContext(catalog, state, now);
  const projectFocus = state.preferences.primaryProjectId ? getCurrentPublishedProject(context)?.conceptRequirements.find(r => r.kind === "hard" && !hasReachedRequiredStatus(getConceptStatus(state.conceptProgress, r.conceptId), r.minimumStatus)) : undefined;
  const focusId = state.preferences.activeStageId ?? context.conceptsById.get(state.preferences.currentConceptId ?? "")?.stageId ?? context.conceptsById.get(projectFocus?.conceptId ?? "")?.stageId;
  const focus = context.stagesById.get(focusId ?? "");
  if (focus?.contentStatus === "available") {
    const r = getStageReadiness(focus, catalog.stages, catalog.concepts, catalog.projects, catalog.tracks, state, now);
    if (r.entryReady) {
      const missing = new Set([...r.unmetMasterConceptIds, ...r.unmetUnderstandConceptIds, ...r.unmetProjectRequirementConceptIds]);
      for (const concept of context.concepts.filter(c => missing.has(c.id))) {
        if (!isConceptStageEntryReady(context, concept)) continue;
        let requiredStatus = getRouteRequiredStatus(concept, catalog.tracks, state.preferences);
        for (const gate of focus.projectGates.filter(g => r.effectiveRequiredProjectIds.includes(g.projectId))) {
          const project = catalog.projects.find(p => p.id === gate.projectId);
          if (project && resolveProjectMilestone(project, gate.milestoneId)?.conceptRequirements.some(req => req.kind === "hard" && req.conceptId === concept.id && req.minimumStatus === "mastered")) requiredStatus = "mastered";
        }
        if (getConceptReadiness(concept, state.conceptProgress).ready) return createConceptStep(context, concept, requiredStatus, "next-unlocked", "先补齐当前检查点的知识目标，再处理出口。", undefined);
        const prerequisite = findFirstExecutableHardPrerequisite(context, concept);
        if (prerequisite) return createHardPrerequisiteStep(context, prerequisite, { blockedConcept: concept });
      }
      const scoped = { ...context, state: { ...state, preferences: { ...state.preferences, activeStageId: focus.id } } };
      const task = getPendingMilestoneStep(scoped) ?? getStageExitStep(scoped);
      if (task) return task;
    }
  }

  return (
    getContinueLearningStep(context) ??
    getProjectGapStep(context) ??
    getPendingMilestoneStep(context) ??
    getStageExitStep(context) ??
    getNextUnlockedConceptStep(context) ??
    getNextUnlockedConceptStep(context, false) ??
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
