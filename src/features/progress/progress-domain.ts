import {
  masteryEvidenceSchema,
  type ConceptProgress,
  type LearningStateV1,
  type MasteryEvidence,
  type UserDifficulty,
} from "@/lib/validation/progress-schemas";
import type {
  DependencyKind,
  LearningStatus,
  TrackDefinition,
  TrackGoal,
} from "@/types";

export interface DependencyConceptDefinition {
  readonly dependencies: readonly {
    readonly conceptId: string;
    readonly kind: DependencyKind;
  }[];
}

export interface ProgressConceptDefinition extends DependencyConceptDefinition {
  readonly id: string;
  readonly stageId: string;
  readonly stageCategoryOrder: number;
  readonly trackIds: readonly string[];
  readonly requiredness: "required" | "optional";
  readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
  readonly masteryCriteria: readonly {
    readonly id: string;
    readonly description: string;
    readonly evidenceHint: string;
    readonly required: boolean;
  }[];
}

export interface ProgressCatalog {
  readonly concepts: readonly ProgressConceptDefinition[];
  readonly projects: readonly ProgressProjectDefinition[];
  readonly stageIds: readonly string[];
  readonly tracks: readonly Pick<
    TrackDefinition,
    "id" | "kind" | "defaultGoal" | "exclusiveMasteryGroup"
  >[];
}

export interface ProgressProjectDefinition {
  readonly id: string;
  readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
  readonly conceptRequirements: readonly {
    readonly conceptId: string;
    readonly kind: "hard" | "recommended";
    readonly minimumStatus: "understood" | "mastered";
  }[];
  readonly environmentRequirements: readonly {
    readonly id: string;
    readonly required: boolean;
  }[];
  readonly executionPaths: readonly {
    readonly id: string;
    readonly requirementIds: readonly string[];
  }[];
  readonly acceptanceCriteria: readonly {
    readonly id: string;
    readonly required: boolean;
  }[];
}

export interface DependencyReadiness {
  readonly ready: boolean;
  readonly missingHard: string[];
  readonly missingRecommended: string[];
}

export type RequiredConceptStatus = "understood" | "mastered";

export interface RouteRequiredStatusConcept {
  readonly targetDepth: "master" | "understand" | "advanced";
  readonly trackIds: readonly string[];
}

export interface RouteRequiredStatusPreferences {
  readonly trackGoals: Readonly<Record<string, TrackGoal>>;
}

export type RouteRequiredStatusTrack = Readonly<
  Pick<TrackDefinition, "id" | "kind" | "defaultGoal">
>;

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

export function hasReachedRequiredStatus(
  status: LearningStatus,
  requiredStatus: RequiredConceptStatus,
): boolean {
  return statusOrder[status] >= statusOrder[requiredStatus];
}

export function getRouteRequiredStatus(
  concept: RouteRequiredStatusConcept,
  tracks: readonly RouteRequiredStatusTrack[],
  preferences: RouteRequiredStatusPreferences,
): RequiredConceptStatus {
  if (concept.targetDepth !== "master") return "understood";

  const tracksById = new Map(tracks.map((track) => [track.id, track]));
  for (const trackId of concept.trackIds) {
    const track = tracksById.get(trackId);
    if (!track) return "mastered";
    if (track.kind === "common") return "mastered";
    if (
      (preferences.trackGoals[track.id] ?? track.defaultGoal) === "master"
    ) {
      return "mastered";
    }
  }

  return "understood";
}

export function getConceptReadiness(
  concept: DependencyConceptDefinition,
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

export function updateConceptNote(
  existing: ConceptProgress | undefined,
  note: string,
  timestamp: string,
): ProgressMutationResult {
  const base = existing ?? createProgressRecord(timestamp);
  if (base.note === note) {
    return { ok: true, progress: base, changed: false };
  }

  return {
    ok: true,
    changed: true,
    progress: { ...base, note, updatedAt: timestamp },
  };
}

export function setConceptFavorite(
  existing: ConceptProgress | undefined,
  favorite: boolean,
  timestamp: string,
): ProgressMutationResult {
  const base = existing ?? createProgressRecord(timestamp);
  if (base.favorite === favorite) {
    return { ok: true, progress: base, changed: false };
  }

  return {
    ok: true,
    changed: true,
    progress: { ...base, favorite, updatedAt: timestamp },
  };
}

export function setConceptUserDifficulty(
  existing: ConceptProgress | undefined,
  userDifficulty: UserDifficulty | undefined,
  timestamp: string,
): ProgressMutationResult {
  const base = existing ?? createProgressRecord(timestamp);
  if (base.userDifficulty === userDifficulty) {
    return { ok: true, progress: base, changed: false };
  }

  return {
    ok: true,
    changed: true,
    progress: { ...base, userDifficulty, updatedAt: timestamp },
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
  readonly scope: ProgressSummaryScope;
  readonly total: number;
  readonly notStarted: number;
  readonly learning: number;
  readonly understoodOnly: number;
  readonly started: number;
  readonly understood: number;
  readonly mastered: number;
  readonly coverageRatio: number | null;
  readonly understandingRatio: number | null;
  readonly masteryRatio: number | null;
}

export type ProgressStatusFilter = LearningStatus | "all";

export type ProgressSummaryScope =
  | { readonly kind: "route" }
  | { readonly kind: "stage"; readonly stageId: string }
  | { readonly kind: "stage-category"; readonly categoryOrder: number }
  | { readonly kind: "track"; readonly trackId: string };

export function selectConceptIdsByStatus(
  conceptIds: readonly string[],
  progress: Readonly<Record<string, ConceptProgress>>,
  status: ProgressStatusFilter,
): string[] {
  const seen = new Set<string>();

  return conceptIds.filter((conceptId) => {
    if (seen.has(conceptId)) return false;
    seen.add(conceptId);
    return status === "all" || getConceptStatus(progress, conceptId) === status;
  });
}

export function summarizeProgress(
  concepts: readonly ProgressConceptDefinition[],
  progress: Readonly<Record<string, ConceptProgress>>,
  scope: ProgressSummaryScope,
): ProgressSummary {
  const seen = new Set<string>();
  const scoped = concepts.filter((concept) => {
    const inScope =
      scope.kind === "route" ||
      (scope.kind === "stage" && concept.stageId === scope.stageId) ||
      (scope.kind === "stage-category" &&
        concept.stageCategoryOrder === scope.categoryOrder) ||
      (scope.kind === "track" && concept.trackIds.includes(scope.trackId));
    if (
      concept.publicationStatus !== "published" ||
      concept.requiredness !== "required" ||
      !inScope ||
      seen.has(concept.id)
    ) {
      return false;
    }
    seen.add(concept.id);
    return true;
  });
  const statuses = scoped.map(({ id }) => getConceptStatus(progress, id));
  const total = statuses.length;
  const notStarted = statuses.filter((status) => status === "not_started").length;
  const learning = statuses.filter((status) => status === "learning").length;
  const understoodOnly = statuses.filter((status) => status === "understood").length;
  const mastered = statuses.filter((status) => status === "mastered").length;
  const started = learning + understoodOnly + mastered;
  const understood = understoodOnly + mastered;

  return {
    scope,
    total,
    notStarted,
    learning,
    understoodOnly,
    started,
    understood,
    mastered,
    coverageRatio: total === 0 ? null : started / total,
    understandingRatio: total === 0 ? null : understood / total,
    masteryRatio: total === 0 ? null : mastered / total,
  };
}

export function summarizeStageProgress(
  concepts: readonly ProgressConceptDefinition[],
  progress: Readonly<Record<string, ConceptProgress>>,
  stageId: string,
): ProgressSummary {
  return summarizeProgress(concepts, progress, { kind: "stage", stageId });
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
  const projectsById = new Map(catalog.projects.map((project) => [project.id, project]));
  const projectIds = new Set(catalog.projects.map(({ id }) => id));
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

  for (const [projectId, progress] of Object.entries(state.projectProgress)) {
    const project = projectsById.get(projectId);
    if (!project) continue;
    const executionPathIds = new Set(
      project.executionPaths.map(({ id }) => id),
    );
    const environmentRequirementIds = new Set(
      project.environmentRequirements.map(({ id }) => id),
    );
    const acceptanceCriterionIds = new Set(
      project.acceptanceCriteria.map(({ id }) => id),
    );
    const deliverableIds = new Set<string>();

    if (
      progress.selectedExecutionPathId !== undefined &&
      !executionPathIds.has(progress.selectedExecutionPathId)
    ) {
      errors.push(
        `${projectId} 引用了不存在的执行路径 ${progress.selectedExecutionPathId}`,
      );
    }
    for (const requirementId of Object.keys(progress.environmentChecks)) {
      if (!environmentRequirementIds.has(requirementId)) {
        errors.push(`${projectId} 引用了不存在的环境要求 ${requirementId}`);
      }
    }
    for (const criterionId of Object.keys(progress.acceptance)) {
      if (!acceptanceCriterionIds.has(criterionId)) {
        errors.push(`${projectId} 引用了不存在的验收标准 ${criterionId}`);
      }
    }
    for (const deliverable of progress.deliverables) {
      if (deliverableIds.has(deliverable.id)) {
        errors.push(`${projectId} 的交付物 ID ${deliverable.id} 重复`);
      }
      deliverableIds.add(deliverable.id);
    }

    if (progress.status === "completed") {
      const missingRequiredAcceptanceIds = project.acceptanceCriteria
        .filter(({ required }) => required)
        .map(({ id }) => id)
        .filter((criterionId) => progress.acceptance[criterionId] !== true);
      if (missingRequiredAcceptanceIds.length > 0) {
        errors.push(
          `${projectId} 的 completed 状态缺少必需验收项 ${missingRequiredAcceptanceIds.join(", ")}`,
        );
      }
      if (progress.deliverables.length === 0) {
        errors.push(`${projectId} 的 completed 状态没有可检查交付物`);
      }
      const confirmation = progress.completionConfirmation;
      if (confirmation) {
        const confirmedAcceptanceIds = new Set<string>();
        for (const criterionId of confirmation.acceptanceCriterionIds) {
          if (confirmedAcceptanceIds.has(criterionId)) {
            errors.push(`${projectId} 的完成确认重复引用验收标准 ${criterionId}`);
          }
          confirmedAcceptanceIds.add(criterionId);
          if (
            !acceptanceCriterionIds.has(criterionId) ||
            progress.acceptance[criterionId] !== true
          ) {
            errors.push(`${projectId} 的完成确认引用了无效验收标准 ${criterionId}`);
          }
        }
        for (const criterionId of project.acceptanceCriteria
          .filter(({ required }) => required)
          .map(({ id }) => id)) {
          if (!confirmedAcceptanceIds.has(criterionId)) {
            errors.push(`${projectId} 的完成确认未引用必需验收标准 ${criterionId}`);
          }
        }

        const confirmedDeliverableIds = new Set<string>();
        for (const deliverableId of confirmation.deliverableIds) {
          if (confirmedDeliverableIds.has(deliverableId)) {
            errors.push(`${projectId} 的完成确认重复引用交付物 ${deliverableId}`);
          }
          confirmedDeliverableIds.add(deliverableId);
          if (!deliverableIds.has(deliverableId)) {
            errors.push(`${projectId} 的完成确认引用了不存在的交付物 ${deliverableId}`);
          }
        }
        if (confirmation.deliverableIds.length === 0) {
          errors.push(`${projectId} 的完成确认没有引用交付物`);
        }
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
