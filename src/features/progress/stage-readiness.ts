import {
  getConceptStatus,
  getRouteRequiredStatus,
  hasReachedRequiredStatus,
  type RequiredConceptStatus,
} from "@/features/progress/progress-domain";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type {
  CheckpointGate,
  ConceptMeta,
  LearningStateV1,
  ProjectMeta,
  StageDefinition,
  TrackDefinition,
  TrackGoal,
  TrackGoalCondition,
} from "@/types";

export type CheckpointGateReadiness =
  | {
      readonly kind: "checkpoint";
      readonly ready: boolean;
      readonly stageId: string;
      readonly stageTitle?: string;
    }
  | {
      readonly kind: "track-goal-checkpoint";
      readonly ready: boolean;
      readonly stageId: string;
      readonly stageTitle?: string;
      readonly trackId: string;
      readonly trackTitle?: string;
      readonly minimumTrackGoal: TrackGoal;
      readonly actualTrackGoal?: TrackGoal;
      readonly checkpointReady: boolean;
      readonly trackGoalReady: boolean;
    }
  | {
      readonly kind: "allOf" | "anyOf";
      readonly ready: boolean;
      readonly gates: readonly CheckpointGateReadiness[];
    };

export type StageReadinessBlocker =
  | {
      readonly code: "entry-gate";
      readonly gate: CheckpointGateReadiness;
      readonly unmetStageIds: readonly string[];
    }
  | {
      readonly code: "concept-status";
      readonly conceptId: string;
      readonly conceptTitle: string;
      readonly requiredStatus: RequiredConceptStatus;
    }
  | {
      readonly code: "project-requirement";
      readonly projectId: string;
      readonly projectTitle: string;
      readonly conceptId: string;
      readonly conceptTitle: string;
      readonly requiredStatus: RequiredConceptStatus;
    }
  | {
      readonly code: "project-incomplete";
      readonly projectId: string;
      readonly projectTitle?: string;
    }
  | {
      readonly code: "exit-criterion";
      readonly criterionId: string;
      readonly description: string;
    }
  | {
      readonly code: "retest";
      readonly retestAfterDays: number;
      readonly initiallyEligibleAt?: string;
      readonly retestedAt?: string;
    };

export interface StageReadiness {
  readonly ready: boolean;
  readonly blocked: boolean;
  readonly entryReady: boolean;
  readonly entryGate?: CheckpointGateReadiness;
  readonly unmetEntryStageIds: readonly string[];
  readonly unmetMasterConceptIds: readonly string[];
  readonly unmetUnderstandConceptIds: readonly string[];
  readonly unmetProjectRequirementConceptIds: readonly string[];
  readonly effectiveRequiredProjectIds: readonly string[];
  readonly incompleteProjectIds: readonly string[];
  readonly unmetExitCriterionIds: readonly string[];
  readonly retestDue: boolean;
  readonly blockers: readonly StageReadinessBlocker[];
}

type ReadonlyStage = DeepReadonly<StageDefinition>;
type ReadonlyConcept = DeepReadonly<ConceptMeta>;
type ReadonlyProject = DeepReadonly<ProjectMeta>;
type ReadonlyTrack = DeepReadonly<TrackDefinition>;

interface StageReadinessContext {
  readonly stages: readonly ReadonlyStage[];
  readonly concepts: readonly ReadonlyConcept[];
  readonly projects: readonly ReadonlyProject[];
  readonly tracks: readonly ReadonlyTrack[];
  readonly state: LearningStateV1;
  readonly stagesById: ReadonlyMap<string, ReadonlyStage>;
  readonly projectsById: ReadonlyMap<string, ReadonlyProject>;
  readonly tracksById: ReadonlyMap<string, ReadonlyTrack>;
  readonly memo: Map<string, StageReadiness>;
  readonly evaluating: Set<string>;
}

const trackGoalOrder: Readonly<Record<TrackGoal, number>> = {
  understand: 0,
  master: 1,
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function getEffectiveTrackGoal(
  context: StageReadinessContext,
  trackId: string,
): TrackGoal | undefined {
  const track = context.tracksById.get(trackId);
  if (!track) return undefined;
  if (track.kind === "common") return "master";
  return context.state.preferences.trackGoals[trackId] ?? track.defaultGoal;
}

function meetsTrackGoal(actual: TrackGoal | undefined, minimum: TrackGoal) {
  return actual !== undefined && trackGoalOrder[actual] >= trackGoalOrder[minimum];
}

function isConditionActive(
  context: StageReadinessContext,
  condition: DeepReadonly<TrackGoalCondition>,
) {
  return (
    condition.kind === "always" ||
    meetsTrackGoal(
      getEffectiveTrackGoal(context, condition.trackId),
      condition.minimumGoal,
    )
  );
}

function collectUnmetEntryStageIds(gate: CheckpointGateReadiness): string[] {
  if (gate.ready) return [];
  if (gate.kind === "checkpoint") {
    return [gate.stageId];
  }
  if (gate.kind === "track-goal-checkpoint") {
    return gate.checkpointReady ? [] : [gate.stageId];
  }
  return unique(gate.gates.flatMap(collectUnmetEntryStageIds));
}

function evaluateEntryGate(
  gate: DeepReadonly<CheckpointGate>,
  context: StageReadinessContext,
): CheckpointGateReadiness {
  if (gate.kind === "checkpoint") {
    const referencedStage = context.stagesById.get(gate.stageId);
    const ready = referencedStage
      ? evaluateStage(referencedStage, context).ready
      : false;
    return {
      kind: "checkpoint",
      ready,
      stageId: gate.stageId,
      stageTitle: referencedStage?.title,
    };
  }

  if (gate.kind === "track-goal-checkpoint") {
    const referencedStage = context.stagesById.get(gate.stageId);
    const track = context.tracksById.get(gate.trackId);
    const actualTrackGoal = getEffectiveTrackGoal(context, gate.trackId);
    const checkpointReady = referencedStage
      ? evaluateStage(referencedStage, context).ready
      : false;
    const trackGoalReady = meetsTrackGoal(
      actualTrackGoal,
      gate.minimumTrackGoal,
    );
    return {
      kind: "track-goal-checkpoint",
      ready: checkpointReady && trackGoalReady,
      stageId: gate.stageId,
      stageTitle: referencedStage?.title,
      trackId: gate.trackId,
      trackTitle: track?.title,
      minimumTrackGoal: gate.minimumTrackGoal,
      actualTrackGoal,
      checkpointReady,
      trackGoalReady,
    };
  }

  const gates = gate.gates.map((child) => evaluateEntryGate(child, context));
  return {
    kind: gate.kind,
    ready:
      gate.kind === "allOf"
        ? gates.every(({ ready }) => ready)
        : gates.some(({ ready }) => ready),
    gates,
  };
}

function hasValidRetest(
  initiallyEligibleAt: string | undefined,
  retestedAt: string | undefined,
  retestAfterDays: number,
) {
  if (!initiallyEligibleAt || !retestedAt) return false;
  const eligibleAt = Date.parse(initiallyEligibleAt);
  const retestAt = Date.parse(retestedAt);
  return retestAt >= eligibleAt + retestAfterDays * 24 * 60 * 60 * 1_000;
}

function evaluateStage(
  stage: ReadonlyStage,
  context: StageReadinessContext,
): StageReadiness {
  const memoized = context.memo.get(stage.id);
  if (memoized) return memoized;

  // The catalog validator rejects entry-gate cycles. Keep the selector safe for
  // synthetic or corrupted catalogs without inventing a second recovery rule.
  if (context.evaluating.has(stage.id)) {
    return {
      ready: false,
      blocked: true,
      entryReady: false,
      unmetEntryStageIds: [stage.id],
      unmetMasterConceptIds: [],
      unmetUnderstandConceptIds: [],
      unmetProjectRequirementConceptIds: [],
      effectiveRequiredProjectIds: [],
      incompleteProjectIds: [],
      unmetExitCriterionIds: [],
      retestDue: false,
      blockers: [],
    };
  }

  context.evaluating.add(stage.id);

  const entryGate = stage.entryGate
    ? evaluateEntryGate(stage.entryGate, context)
    : undefined;
  const entryReady = entryGate?.ready ?? true;
  const unmetEntryStageIds = entryGate
    ? collectUnmetEntryStageIds(entryGate)
    : [];
  const unmetMasterConceptIds: string[] = [];
  const unmetUnderstandConceptIds: string[] = [];
  const conceptBlockers: StageReadinessBlocker[] = [];

  for (const concept of context.concepts) {
    if (
      concept.stageId !== stage.id ||
      concept.publicationStatus !== "published" ||
      concept.requiredness !== "required"
    ) {
      continue;
    }
    const requiredStatus = getRouteRequiredStatus(
      concept,
      context.tracks,
      context.state.preferences,
    );
    if (
      hasReachedRequiredStatus(
        getConceptStatus(context.state.conceptProgress, concept.id),
        requiredStatus,
      )
    ) {
      continue;
    }
    (requiredStatus === "mastered"
      ? unmetMasterConceptIds
      : unmetUnderstandConceptIds
    ).push(concept.id);
    conceptBlockers.push({
      code: "concept-status",
      conceptId: concept.id,
      conceptTitle: concept.title,
      requiredStatus,
    });
  }

  const effectiveProjectGates = stage.projectGates.filter(({ when }) =>
    isConditionActive(context, when),
  );
  const effectiveRequiredProjectIds = unique(
    effectiveProjectGates.map(({ projectId }) => projectId),
  );
  const incompleteProjectIds: string[] = [];
  const unmetProjectRequirementConceptIds: string[] = [];
  const projectBlockers: StageReadinessBlocker[] = [];

  for (const projectId of effectiveRequiredProjectIds) {
    const project = context.projectsById.get(projectId);
    if (
      !project ||
      project.publicationStatus !== "published" ||
      context.state.projectProgress[projectId]?.status !== "completed"
    ) {
      incompleteProjectIds.push(projectId);
      projectBlockers.push({
        code: "project-incomplete",
        projectId,
        projectTitle: project?.title,
      });
    }

    if (!project) continue;
    for (const requirement of project.conceptRequirements) {
      if (requirement.kind !== "hard") continue;
      const concept = context.concepts.find(
        ({ id }) => id === requirement.conceptId,
      );
      const status = getConceptStatus(
        context.state.conceptProgress,
        requirement.conceptId,
      );
      if (hasReachedRequiredStatus(status, requirement.minimumStatus)) continue;

      unmetProjectRequirementConceptIds.push(requirement.conceptId);
      projectBlockers.push({
        code: "project-requirement",
        projectId,
        projectTitle: project.title,
        conceptId: requirement.conceptId,
        conceptTitle: concept?.title ?? requirement.conceptId,
        requiredStatus: requirement.minimumStatus,
      });
    }
  }

  const checkpoint = context.state.stageCheckpoints[stage.id];
  const unmetExitCriteria = stage.exitCriteria.filter(
    (criterion) =>
      criterion.required &&
      isConditionActive(context, criterion.when) &&
      (checkpoint?.criterionEvidence[criterion.id]?.length ?? 0) === 0,
  );
  const unmetExitCriterionIds = unmetExitCriteria.map(({ id }) => id);
  const exitBlockers: StageReadinessBlocker[] = unmetExitCriteria.map(
    ({ id, description }) => ({
      code: "exit-criterion",
      criterionId: id,
      description,
    }),
  );

  const baseReady =
    entryReady &&
    unmetMasterConceptIds.length === 0 &&
    unmetUnderstandConceptIds.length === 0 &&
    unmetProjectRequirementConceptIds.length === 0 &&
    incompleteProjectIds.length === 0 &&
    unmetExitCriterionIds.length === 0;
  const retestDue =
    baseReady &&
    stage.retestAfterDays !== undefined &&
    !hasValidRetest(
      checkpoint?.initiallyEligibleAt,
      checkpoint?.retestedAt,
      stage.retestAfterDays,
    );
  const ready = baseReady && !retestDue;
  const blockers: StageReadinessBlocker[] = [
    ...(entryGate && !entryReady
      ? [
          {
            code: "entry-gate" as const,
            gate: entryGate,
            unmetStageIds: unmetEntryStageIds,
          },
        ]
      : []),
    ...conceptBlockers,
    ...projectBlockers,
    ...exitBlockers,
    ...(retestDue && stage.retestAfterDays !== undefined
      ? [
          {
            code: "retest" as const,
            retestAfterDays: stage.retestAfterDays,
            initiallyEligibleAt: checkpoint?.initiallyEligibleAt,
            retestedAt: checkpoint?.retestedAt,
          },
        ]
      : []),
  ];

  const result: StageReadiness = {
    ready,
    blocked: !ready,
    entryReady,
    entryGate,
    unmetEntryStageIds,
    unmetMasterConceptIds: unique(unmetMasterConceptIds),
    unmetUnderstandConceptIds: unique(unmetUnderstandConceptIds),
    unmetProjectRequirementConceptIds: unique(
      unmetProjectRequirementConceptIds,
    ),
    effectiveRequiredProjectIds,
    incompleteProjectIds: unique(incompleteProjectIds),
    unmetExitCriterionIds,
    retestDue,
    blockers,
  };

  context.evaluating.delete(stage.id);
  context.memo.set(stage.id, result);
  return result;
}

export function getStageReadiness(
  stage: DeepReadonly<StageDefinition>,
  stages: readonly DeepReadonly<StageDefinition>[],
  concepts: readonly DeepReadonly<ConceptMeta>[],
  projects: readonly DeepReadonly<ProjectMeta>[],
  tracks: readonly DeepReadonly<TrackDefinition>[],
  state: LearningStateV1,
): StageReadiness {
  const context: StageReadinessContext = {
    stages,
    concepts,
    projects,
    tracks,
    state,
    stagesById: new Map(stages.map((item) => [item.id, item])),
    projectsById: new Map(projects.map((project) => [project.id, project])),
    tracksById: new Map(tracks.map((track) => [track.id, track])),
    memo: new Map(),
    evaluating: new Set(),
  };
  return evaluateStage(stage, context);
}
