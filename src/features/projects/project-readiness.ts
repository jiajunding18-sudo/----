import {
  getConceptStatus,
  hasReachedRequiredStatus,
} from "@/features/progress/progress-domain";
import type {
  ConceptProgress,
  LearningStateV2,
  LearningStatus,
  ProjectProgress,
} from "@/types";

interface ProjectRequirements {
  readonly conceptRequirements: readonly {
    readonly conceptId: string;
    readonly kind: "hard" | "recommended";
    readonly minimumStatus: "understood" | "mastered";
  }[];
}

interface ProjectReadinessDefinition extends ProjectRequirements {
  readonly id: string;
  readonly environmentRequirements: readonly {
    readonly id: string;
    readonly required: boolean;
  }[];
  readonly executionPaths: readonly {
    readonly id: string;
    readonly requirementIds: readonly string[];
  }[];
}

export interface ProjectRequirementReadiness {
  readonly conceptId: string;
  readonly kind: "hard" | "recommended";
  readonly minimumStatus: "understood" | "mastered";
  readonly actualStatus: LearningStatus;
  readonly satisfied: boolean;
}

export interface ProjectExecutionPathReadiness {
  readonly pathId: string;
  readonly ready: boolean;
  readonly missingEnvironmentRequirementIds: readonly string[];
}

export interface ProjectReadiness {
  readonly knowledgeReady: boolean;
  readonly environmentReady: boolean | null;
  readonly selectedExecutionPathId?: string;
  readonly missingHardConceptIds: readonly string[];
  readonly missingRecommendedConceptIds: readonly string[];
  readonly missingEnvironmentRequirementIds: readonly string[];
  readonly pathReadiness: readonly ProjectExecutionPathReadiness[];
}

interface ProjectCompletionDefinition {
  readonly acceptanceCriteria: readonly {
    readonly id: string;
    readonly required: boolean;
  }[];
}

export interface ProjectCompletionEligibility {
  readonly eligible: boolean;
  readonly missingAcceptanceCriterionIds: readonly string[];
  readonly hasDeliverable: boolean;
}

export function getProjectKnowledgeReadiness(
  project: ProjectRequirements,
  progress: Readonly<Record<string, ConceptProgress>>,
) {
  const requirements: ProjectRequirementReadiness[] =
    project.conceptRequirements.map((requirement) => {
      const actualStatus = getConceptStatus(progress, requirement.conceptId);
      return {
        conceptId: requirement.conceptId,
        kind: requirement.kind,
        minimumStatus: requirement.minimumStatus,
        actualStatus,
        satisfied: hasReachedRequiredStatus(
          actualStatus,
          requirement.minimumStatus,
        ),
      };
    });
  const hardRequirements = requirements.filter(({ kind }) => kind === "hard");
  const recommendedRequirements = requirements.filter(
    ({ kind }) => kind === "recommended",
  );

  return {
    ready: hardRequirements.every(({ satisfied }) => satisfied),
    total: requirements.length,
    satisfiedCount: requirements.filter(({ satisfied }) => satisfied).length,
    hardRequirements,
    recommendedRequirements,
    missingHard: hardRequirements.filter(({ satisfied }) => !satisfied),
    missingRecommended: recommendedRequirements.filter(
      ({ satisfied }) => !satisfied,
    ),
  } as const;
}

export function getProjectPathReadiness(
  project: Pick<
    ProjectReadinessDefinition,
    "environmentRequirements" | "executionPaths"
  >,
  environmentChecks: Readonly<Record<string, boolean>>,
): ProjectExecutionPathReadiness[] {
  const requiredEnvironmentIds = new Set(
    project.environmentRequirements
      .filter(({ required }) => required)
      .map(({ id }) => id),
  );

  return project.executionPaths.map((path) => {
    const missingEnvironmentRequirementIds = path.requirementIds.filter(
      (requirementId) =>
        requiredEnvironmentIds.has(requirementId) &&
        environmentChecks[requirementId] !== true,
    );
    return {
      pathId: path.id,
      ready: missingEnvironmentRequirementIds.length === 0,
      missingEnvironmentRequirementIds,
    };
  });
}

export function getProjectReadiness(
  project: ProjectReadinessDefinition,
  state: LearningStateV2,
): ProjectReadiness {
  const knowledge = getProjectKnowledgeReadiness(
    project,
    state.conceptProgress,
  );
  const progress = state.projectProgress[project.id];
  const selectedExecutionPathId = progress?.selectedExecutionPathId;
  const pathReadiness = getProjectPathReadiness(
    project,
    progress?.environmentChecks ?? {},
  );
  const selectedPathReadiness = selectedExecutionPathId
    ? pathReadiness.find(({ pathId }) => pathId === selectedExecutionPathId)
    : undefined;

  return {
    knowledgeReady: knowledge.ready,
    environmentReady:
      selectedExecutionPathId === undefined
        ? null
        : (selectedPathReadiness?.ready ?? false),
    selectedExecutionPathId,
    missingHardConceptIds: knowledge.missingHard.map(({ conceptId }) => conceptId),
    missingRecommendedConceptIds: knowledge.missingRecommended.map(
      ({ conceptId }) => conceptId,
    ),
    missingEnvironmentRequirementIds:
      selectedPathReadiness?.missingEnvironmentRequirementIds ?? [],
    pathReadiness,
  };
}

export function getProjectCompletionEligibility(
  project: ProjectCompletionDefinition,
  progress: ProjectProgress | undefined,
): ProjectCompletionEligibility {
  const missingAcceptanceCriterionIds = project.acceptanceCriteria
    .filter(({ required }) => required)
    .map(({ id }) => id)
    .filter((criterionId) => progress?.acceptance[criterionId] !== true);
  const hasDeliverable = (progress?.deliverables.length ?? 0) > 0;
  const startedAndOpen =
    progress?.status === "in_progress" || progress?.status === "paused";

  return {
    eligible:
      startedAndOpen &&
      missingAcceptanceCriterionIds.length === 0 &&
      hasDeliverable,
    missingAcceptanceCriterionIds,
    hasDeliverable,
  };
}
