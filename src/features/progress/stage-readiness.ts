import {
  getConceptStatus,
  getRouteRequiredStatus,
  hasReachedRequiredStatus,
  type RequiredConceptStatus,
} from "@/features/progress/progress-domain";
import { getProjectScopeProgress, isProjectGateCompleted, resolveProjectMilestone } from "@/features/projects/project-milestones";
import { activeCycle, criterionSatisfied, historicalStageCompleted, stableSnapshot } from "./stage-evidence";
import type { ProgressProjectDefinition } from "./progress-domain";
import type { EligibilityCycle, StageProgress } from "@/lib/validation/stage-progress-schemas";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type {
  CheckpointGate,
  ConceptMeta,
  LearningStateV3,
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
  readonly nonRetestReady: boolean;
  readonly currentEligibilityValid: boolean;
  readonly qualificationBasis?: NonNullable<EligibilityCycle["qualificationBasis"]>;
  readonly activeEligibility?: EligibilityCycle;
  readonly historicalCompletion?: StageProgress["historicalCompletion"];
  readonly retestRequired: boolean;
  readonly temporalRetestValid: boolean;
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
type ReadonlyConcept = DeepReadonly<Pick<ConceptMeta, "id" | "stageId" | "publicationStatus" | "requiredness" | "targetDepth" | "trackIds">> & { readonly title?: string };
type ReadonlyProject = ProgressProjectDefinition & { readonly title?: string };
type ReadonlyTrack = Pick<TrackDefinition, "id" | "kind" | "defaultGoal"> & { readonly title?: string };

interface StageReadinessContext {
  readonly now: string;
  readonly stages: readonly ReadonlyStage[];
  readonly concepts: readonly ReadonlyConcept[];
  readonly projects: readonly ReadonlyProject[];
  readonly tracks: readonly ReadonlyTrack[];
  readonly state: LearningStateV3;
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
      nonRetestReady: false, currentEligibilityValid: false, retestRequired: stage.retestAfterDays !== undefined, temporalRetestValid: false,
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
      conceptTitle: concept.title ?? concept.id,
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

  for (const { projectId, milestoneId } of effectiveProjectGates) {
    const project = context.projectsById.get(projectId);
    if (
      !project ||
      project.publicationStatus !== "published" ||
      !isProjectGateCompleted(project, context.state, milestoneId)
    ) {
      incompleteProjectIds.push(projectId);
      projectBlockers.push({
        code: "project-incomplete",
        projectId,
        projectTitle: project?.title,
      });
    }

    if (!project) continue;
    const scopedProject = milestoneId ? resolveProjectMilestone(project, milestoneId) : project;
    for (const requirement of scopedProject?.conceptRequirements ?? []) {
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
        projectTitle: project.title ?? project.id,
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
      !criterionSatisfied(checkpoint?.criteria[criterion.id], context.state, context, context.now),
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
    stage.contentStatus === "available" &&
    entryReady &&
    unmetMasterConceptIds.length === 0 &&
    unmetUnderstandConceptIds.length === 0 &&
    unmetProjectRequirementConceptIds.length === 0 &&
    incompleteProjectIds.length === 0 &&
    unmetExitCriterionIds.length === 0;
  const requiredCriteria = stage.exitCriteria.filter(c => c.required && isConditionActive(context, c.when)).toSorted((a,b) => a.id.localeCompare(b.id));
  const criterionBasis = requiredCriteria.map(c => [c.id, checkpoint?.criteria[c.id]]);
  const floors = requiredCriteria.map(c => checkpoint?.criteria[c.id]?.confirmedAt).filter((t): t is string => !!t);
  function conceptRequirementBasis(id: string, required: RequiredConceptStatus) {
    const progress = context.state.conceptProgress[id];
    // understoodAt is only a known lower bound, not the latest reacquisition.
    // lastMasteredAt is the existing explicit mastery transition; notes do not change it.
    const transition = required === "mastered" ? progress?.lastMasteredAt : progress?.understoodAt;
    if (transition) floors.push(transition);
    return [id, required, getConceptStatus(context.state.conceptProgress, id), transition];
  }
  const conceptBasis = context.concepts.filter(c => c.stageId === stage.id && c.publicationStatus === "published" && c.requiredness === "required").map(c => conceptRequirementBasis(c.id, getRouteRequiredStatus(c, context.tracks, context.state.preferences))).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  const projectBasis = effectiveProjectGates.map(g => {
    const project = context.projectsById.get(g.projectId);
    const scoped = project && resolveProjectMilestone(project, g.milestoneId);
    const progress = getProjectScopeProgress(context.state, g.projectId, g.milestoneId);
    return [g.projectId, g.milestoneId, progress?.status, progress?.completedAt, progress?.completionConfirmation, scoped?.conceptRequirements.filter(r => r.kind === "hard").map(r => conceptRequirementBasis(r.conceptId, r.minimumStatus))];
  });
  for (const gate of effectiveProjectGates) {
    const projectProgress = getProjectScopeProgress(context.state, gate.projectId, gate.milestoneId);
    const time = projectProgress?.completedAt;
    if (time) floors.push(time);
    if (projectProgress?.completionConfirmation?.confirmedAt) floors.push(projectProgress.completionConfirmation.confirmedAt);
  }
  // Status snapshots cover prerequisites without a reliable latest transition date.
  // Never guess first qualification from Concept updatedAt (also changed by notes).
  const qualificationBasis = baseReady ? {
    fingerprint: stableSnapshot([stage.id, stage.entryGate, conceptBasis, projectBasis, criterionBasis, Object.entries(context.state.preferences.trackGoals).sort(([a],[b]) => a.localeCompare(b))]),
    notBefore: floors.sort().at(-1) ?? "1970-01-01T00:00:00.000Z",
  } : undefined;
  const candidate = activeCycle(checkpoint, context.now);
  const eligibility = candidate && qualificationBasis && JSON.stringify(candidate.qualificationBasis) === JSON.stringify(qualificationBasis) && Date.parse(candidate.eligibleAt) >= Date.parse(qualificationBasis.notBefore) ? candidate : undefined;
  const completion = undefined;
  const temporalRetestValid = false;
  const ready = historicalStageCompleted(stage, checkpoint, context.now);
  const retestDue = baseReady && stage.retestAfterDays !== undefined && !ready;
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
            initiallyEligibleAt: eligibility?.eligibleAt,
            retestedAt: undefined,
          },
        ]
      : []),
  ];

  const result: StageReadiness = {
    nonRetestReady: baseReady,
    currentEligibilityValid: !!eligibility,
    qualificationBasis,
    activeEligibility: baseReady ? eligibility : undefined,
    historicalCompletion: ready ? completion : undefined,
    retestRequired: stage.retestAfterDays !== undefined,
    temporalRetestValid,
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
  concepts: readonly ReadonlyConcept[],
  projects: readonly ReadonlyProject[],
  tracks: readonly ReadonlyTrack[],
  state: LearningStateV3,
  now: string = new Date().toISOString(),
): StageReadiness {
  const context: StageReadinessContext = {
    now,
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
