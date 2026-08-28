import {
  getConceptStatus,
  hasReachedRequiredStatus,
} from "@/features/progress/progress-domain";
import type { ConceptProgress, LearningStatus } from "@/types";

interface ProjectRequirements {
  readonly conceptRequirements: readonly {
    readonly conceptId: string;
    readonly kind: "hard" | "recommended";
    readonly minimumStatus: "understood" | "mastered";
  }[];
}

export interface ProjectRequirementReadiness {
  readonly conceptId: string;
  readonly kind: "hard" | "recommended";
  readonly minimumStatus: "understood" | "mastered";
  readonly actualStatus: LearningStatus;
  readonly satisfied: boolean;
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
