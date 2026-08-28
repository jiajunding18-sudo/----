import {
  masteryEvidenceSchema,
  type ConceptProgress,
  type LearningStateV1,
  type MasteryEvidence,
} from "@/lib/validation/progress-schemas";
import type {
  DependencyKind,
  LearningStatus,
  TrackDefinition,
} from "@/types";

export interface ProgressConceptDefinition {
  readonly id: string;
  readonly stageId: string;
  readonly trackIds: readonly string[];
  readonly requiredness: "required" | "optional";
  readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
  readonly dependencies: readonly {
    readonly conceptId: string;
    readonly kind: DependencyKind;
  }[];
  readonly masteryCriteria: readonly {
    readonly id: string;
    readonly description: string;
    readonly evidenceHint: string;
    readonly required: boolean;
  }[];
}

export interface ProgressCatalog {
  readonly concepts: readonly ProgressConceptDefinition[];
  readonly projectIds: readonly string[];
  readonly stageIds: readonly string[];
  readonly tracks: readonly Pick<
    TrackDefinition,
    "id" | "kind" | "defaultGoal" | "exclusiveMasteryGroup"
  >[];
}

export interface DependencyReadiness {
  readonly ready: boolean;
  readonly missingHard: string[];
  readonly missingRecommended: string[];
}

export interface MasteryEligibility {
  readonly eligible: boolean;
  readonly uncoveredRequiredCriteria: string[];
  readonly eligibleEvidenceIds: string[];
}

export type ProgressMutationErrorCode =
  | "missing-concept"
  | "missing-hard-prerequisite"
  | "status-not-understood"
  | "missing-mastery-evidence"
  | "confirmation-required"
  | "invalid-evidence"
  | "invalid-downgrade";

export type ProgressMutationResult =
  | {
      readonly ok: true;
      readonly progress: ConceptProgress;
      readonly changed: boolean;
    }
  | {
      readonly ok: false;
      readonly code: ProgressMutationErrorCode;
      readonly message: string;
      readonly relatedIds?: readonly string[];
    };

const statusOrder: Readonly<Record<LearningStatus, number>> = {
  not_started: 0,
  learning: 1,
  understood: 2,
  mastered: 3,
};

function createProgressRecord(timestamp: string): ConceptProgress {
  return {
    status: "not_started",
    note: "",
    favorite: false,
    updatedAt: timestamp,
    evidence: [],
  };
}

export function getConceptStatus(
  progress: Readonly<Record<string, ConceptProgress>>,
  conceptId: string,
): LearningStatus {
  return progress[conceptId]?.status ?? "not_started";
}

export function satisfiesHardPrerequisite(status: LearningStatus): boolean {
  return status === "understood" || status === "mastered";
}

export function getConceptReadiness(
  concept: ProgressConceptDefinition,
  progress: Readonly<Record<string, ConceptProgress>>,
): DependencyReadiness {
  const missingHard: string[] = [];
  const missingRecommended: string[] = [];

  for (const dependency of concept.dependencies) {
    if (satisfiesHardPrerequisite(getConceptStatus(progress, dependency.conceptId))) {
      continue;
    }
    (dependency.kind === "hard" ? missingHard : missingRecommended).push(
      dependency.conceptId,
    );
  }

  return {
    ready: missingHard.length === 0,
    missingHard,
    missingRecommended,
  };
}

export function startConcept(
  existing: ConceptProgress | undefined,
  timestamp: string,
): ProgressMutationResult {
  if (existing && existing.status !== "not_started") {
    return { ok: true, progress: existing, changed: false };
  }

  const base = existing ?? createProgressRecord(timestamp);
  return {
    ok: true,
    changed: true,
    progress: {
      ...base,
      status: "learning",
      startedAt: base.startedAt ?? timestamp,
      updatedAt: timestamp,
    },
  };
}

export function markConceptUnderstood(
  concept: ProgressConceptDefinition,
  allProgress: Readonly<Record<string, ConceptProgress>>,
  timestamp: string,
): ProgressMutationResult {
  const existing = allProgress[concept.id];
  if (existing?.status === "understood" || existing?.status === "mastered") {
    return { ok: true, progress: existing, changed: false };
  }

  const readiness = getConceptReadiness(concept, allProgress);
  if (!readiness.ready) {
    return {
      ok: false,
      code: "missing-hard-prerequisite",
      message: "仍有未达到 understood 的 hard 前置。",
      relatedIds: readiness.missingHard,
    };
  }

  const base = existing ?? createProgressRecord(timestamp);
  return {
    ok: true,
    changed: true,
    progress: {
      ...base,
      status: "understood",
      startedAt: base.startedAt ?? timestamp,
      understoodAt: base.understoodAt ?? timestamp,
      updatedAt: timestamp,
    },
  };
}

export function getMasteryEligibility(
  concept: ProgressConceptDefinition,
  progress: ConceptProgress,
): MasteryEligibility {
  const requiredCriterionIds = concept.masteryCriteria
    .filter(({ required }) => required)
    .map(({ id }) => id);
  const requiredCriterionIdSet = new Set(requiredCriterionIds);
  const covered = new Set<string>();
  const eligibleEvidenceIds: string[] = [];

  for (const evidence of progress.evidence) {
    if (evidence.result !== "passed" || evidence.conceptId !== concept.id) {
      continue;
    }

    const contributes = evidence.criterionIds.some((criterionId) =>
      requiredCriterionIdSet.has(criterionId),
    );
    if (!contributes) continue;

    eligibleEvidenceIds.push(evidence.id);
    evidence.criterionIds.forEach((criterionId) => {
      if (requiredCriterionIdSet.has(criterionId)) covered.add(criterionId);
    });
  }

  const uncoveredRequiredCriteria = requiredCriterionIds.filter(
    (criterionId) => !covered.has(criterionId),
  );

  return {
    eligible: uncoveredRequiredCriteria.length === 0,
    uncoveredRequiredCriteria,
    eligibleEvidenceIds,
  };
}

export function addMasteryEvidence(
  concept: ProgressConceptDefinition,
  existing: ConceptProgress | undefined,
  evidenceInput: MasteryEvidence,
  timestamp: string,
): ProgressMutationResult {
  const evidence = masteryEvidenceSchema.safeParse(evidenceInput);
  const criterionIds = new Set(concept.masteryCriteria.map(({ id }) => id));
  if (
    !evidence.success ||
    evidence.data.conceptId !== concept.id ||
    evidence.data.criterionIds.some((criterionId) => !criterionIds.has(criterionId))
  ) {
    return {
      ok: false,
      code: "invalid-evidence",
      message: "证据未通过 schema、Concept 或 mastery criterion 引用校验。",
    };
  }

  const base = existing ?? createProgressRecord(timestamp);
  const duplicate = base.evidence.some(({ id }) => id === evidence.data.id);
  if (duplicate) {
    return {
      ok: false,
      code: "invalid-evidence",
      message: `证据 ID ${evidence.data.id} 已存在。`,
    };
  }

  return {
    ok: true,
    changed: true,
    progress: {
      ...base,
      evidence: [...base.evidence, evidence.data],
      updatedAt: timestamp,
    },
  };
}

export function confirmConceptMastery(
  concept: ProgressConceptDefinition,
  existing: ConceptProgress | undefined,
  userConfirmed: boolean,
  timestamp: string,
): ProgressMutationResult {
  if (!existing || existing.status !== "understood") {
    return {
      ok: false,
      code: "status-not-understood",
      message: "Concept 必须先达到 understood 才能确认 mastered。",
    };
  }
  if (!userConfirmed) {
    return {
      ok: false,
      code: "confirmation-required",
      message: "mastered 必须由用户主动确认。",
    };
  }

  const eligibility = getMasteryEligibility(concept, existing);
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: "missing-mastery-evidence",
      message: "仍有必需 mastery criteria 未被通过证据覆盖。",
      relatedIds: eligibility.uncoveredRequiredCriteria,
    };
  }

  const requiredCriterionIds = concept.masteryCriteria
    .filter(({ required }) => required)
    .map(({ id }) => id);
  return {
    ok: true,
    changed: true,
    progress: {
      ...existing,
      status: "mastered",
      firstMasteredAt: existing.firstMasteredAt ?? timestamp,
      lastMasteredAt: timestamp,
      updatedAt: timestamp,
      masteryConfirmation: {
        confirmedAt: timestamp,
        criterionIds: requiredCriterionIds,
        evidenceIds: eligibility.eligibleEvidenceIds,
        statementVersion: 1,
      },
    },
  };
}

export function downgradeConcept(
  existing: ConceptProgress | undefined,
  targetStatus: Exclude<LearningStatus, "mastered">,
  timestamp: string,
): ProgressMutationResult {
  if (!existing || statusOrder[targetStatus] >= statusOrder[existing.status]) {
    return {
      ok: false,
      code: "invalid-downgrade",
      message: "回退目标必须低于当前状态。",
    };
  }

  return {
    ok: true,
    changed: true,
    progress: {
      ...existing,
      status: targetStatus,
      updatedAt: timestamp,
      masteryConfirmation: undefined,
    },
  };
}

export interface ProgressSummary {
  readonly total: number;
  readonly started: number;
  readonly understood: number;
  readonly mastered: number;
  readonly coverageRatio: number | null;
  readonly understandingRatio: number | null;
  readonly masteryRatio: number | null;
}

export function summarizeStageProgress(
  concepts: readonly ProgressConceptDefinition[],
  progress: Readonly<Record<string, ConceptProgress>>,
  stageId: string,
): ProgressSummary {
  const scoped = concepts.filter(
    (concept) =>
      concept.stageId === stageId &&
      concept.publicationStatus === "published" &&
      concept.requiredness === "required",
  );
  const statuses = scoped.map(({ id }) => getConceptStatus(progress, id));
  const total = statuses.length;
  const started = statuses.filter((status) => status !== "not_started").length;
  const understood = statuses.filter(satisfiesHardPrerequisite).length;
  const mastered = statuses.filter((status) => status === "mastered").length;

  return {
    total,
    started,
    understood,
    mastered,
    coverageRatio: total === 0 ? null : started / total,
    understandingRatio: total === 0 ? null : understood / total,
    masteryRatio: total === 0 ? null : mastered / total,
  };
}

export interface LearningStateCatalogInspection {
  readonly errors: string[];
  readonly orphanConceptIds: string[];
  readonly orphanProjectIds: string[];
  readonly orphanStageIds: string[];
  readonly orphanTrackIds: string[];
}

export function inspectLearningStateAgainstCatalog(
  state: LearningStateV1,
  catalog: ProgressCatalog,
): LearningStateCatalogInspection {
  const conceptsById = new Map(catalog.concepts.map((concept) => [concept.id, concept]));
  const tracksById = new Map(catalog.tracks.map((track) => [track.id, track]));
  const projectIds = new Set(catalog.projectIds);
  const stageIds = new Set(catalog.stageIds);
  const errors: string[] = [];
  const orphanConceptIds = Object.keys(state.conceptProgress).filter(
    (conceptId) => !conceptsById.has(conceptId),
  );
  const orphanTrackIds = Object.keys(state.preferences.trackGoals).filter(
    (trackId) => !tracksById.has(trackId),
  );
  const orphanProjectIds = Object.keys(state.projectProgress).filter(
    (projectId) => !projectIds.has(projectId),
  );
  const orphanStageIds = Object.keys(state.stageCheckpoints).filter(
    (stageId) => !stageIds.has(stageId),
  );

  for (const [conceptId, progress] of Object.entries(state.conceptProgress)) {
    const concept = conceptsById.get(conceptId);
    if (!concept) continue;
    const criterionIds = new Set(concept.masteryCriteria.map(({ id }) => id));

    for (const evidence of progress.evidence) {
      if (evidence.conceptId !== conceptId) {
        errors.push(`${conceptId} 的证据 ${evidence.id} 引用了其他 Concept`);
      }
      for (const criterionId of evidence.criterionIds) {
        if (!criterionIds.has(criterionId)) {
          errors.push(`${conceptId} 的证据 ${evidence.id} 引用了不存在的标准 ${criterionId}`);
        }
      }
    }

    if (progress.status === "mastered") {
      const eligibility = getMasteryEligibility(concept, progress);
      if (!eligibility.eligible) {
        errors.push(`${conceptId} 的 mastered 状态缺少完整通过证据`);
      }
    }
  }

  for (const track of catalog.tracks) {
    const storedGoal = state.preferences.trackGoals[track.id];
    if (track.kind === "common" && storedGoal === "understand") {
      errors.push(`公共 Track ${track.id} 不得降为 understand`);
    }
  }

  const groupNames = new Set(
    catalog.tracks.flatMap(({ exclusiveMasteryGroup }) =>
      exclusiveMasteryGroup ? [exclusiveMasteryGroup] : [],
    ),
  );
  for (const groupName of groupNames) {
    const groupTracks = catalog.tracks.filter(
      ({ exclusiveMasteryGroup }) => exclusiveMasteryGroup === groupName,
    );
    const masterCount = groupTracks.filter(
      (track) =>
        (state.preferences.trackGoals[track.id] ?? track.defaultGoal) === "master",
    ).length;
    if (masterCount !== 1) {
      errors.push(`高级 Track 组 ${groupName} 必须恰有一个 master`);
    }
  }

  return {
    errors,
    orphanConceptIds,
    orphanProjectIds,
    orphanStageIds,
    orphanTrackIds,
  };
}
