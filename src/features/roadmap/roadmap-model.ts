import {
  getConceptById,
  getProjectById,
} from "@/lib/content/manifest-reader";
import type { ContentManifest } from "@/lib/content/manifest-types";

type ManifestCheckpointGate = NonNullable<
  ContentManifest["stages"][number]["entryGate"]
>;
type ManifestTrackGoalCondition =
  ContentManifest["stages"][number]["exitCriteria"][number]["when"];

function byOrderThenId<Ordered extends { readonly id: string; readonly order: number }>(
  left: Ordered,
  right: Ordered,
) {
  return left.order - right.order || left.id.localeCompare(right.id, "en");
}

function getRequiredConcept(
  manifest: ContentManifest,
  conceptId: string,
  context: string,
) {
  const concept = getConceptById(manifest, conceptId);
  if (!concept) {
    throw new Error(`${context} 引用了不存在的 Concept ${conceptId}`);
  }
  return concept;
}

function getRequiredProject(
  manifest: ContentManifest,
  projectId: string,
  context: string,
) {
  const project = getProjectById(manifest, projectId);
  if (!project) {
    throw new Error(`${context} 引用了不存在的 Project ${projectId}`);
  }
  return project;
}

function getRequiredStage(
  manifest: ContentManifest,
  stageId: string,
  context: string,
) {
  const stage = manifest.stages.find(({ id }) => id === stageId);
  if (!stage) {
    throw new Error(`${context} 引用了不存在的 Stage ${stageId}`);
  }
  return stage;
}

function getRequiredTrack(
  manifest: ContentManifest,
  trackId: string,
  context: string,
) {
  const track = manifest.tracks.find(({ id }) => id === trackId);
  if (!track) {
    throw new Error(`${context} 引用了不存在的 Track ${trackId}`);
  }
  return track;
}

function resolveCheckpointGate(
  manifest: ContentManifest,
  gate: ManifestCheckpointGate,
): RoadmapCheckpointGateView {
  if (gate.kind === "checkpoint") {
    const stage = getRequiredStage(manifest, gate.stageId, "entryGate");
    return {
      kind: gate.kind,
      stage: {
        id: stage.id,
        title: stage.title,
        primaryOutcome: stage.outcomes[0],
      },
    };
  }

  if (gate.kind === "track-goal-checkpoint") {
    const stage = getRequiredStage(manifest, gate.stageId, "entryGate");
    const track = getRequiredTrack(manifest, gate.trackId, "entryGate");
    return {
      kind: gate.kind,
      stage: {
        id: stage.id,
        title: stage.title,
        primaryOutcome: stage.outcomes[0],
      },
      track: { title: track.title },
      minimumTrackGoal: gate.minimumTrackGoal,
    };
  }

  return {
    kind: gate.kind,
    gates: gate.gates.map((childGate) =>
      resolveCheckpointGate(manifest, childGate),
    ),
  };
}

function getCheckpointGateSummary(gate: RoadmapCheckpointGateView): string {
  if (gate.kind === "checkpoint") {
    return `通过「${gate.stage.title}」`;
  }

  if (gate.kind === "track-goal-checkpoint") {
    const minimumGoalLabel =
      gate.minimumTrackGoal === "master" ? "主修掌握" : "理解";
    return `通过「${gate.stage.title}」，且「${gate.track.title}」目标至少为${minimumGoalLabel}`;
  }

  const prefix = gate.kind === "allOf" ? "全部满足" : "满足其中一项";
  return `${prefix}：${gate.gates.map(getCheckpointGateSummary).join("；")}`;
}

function getTrackGoalConditionSummary(
  manifest: ContentManifest,
  condition: ManifestTrackGoalCondition,
) {
  if (condition.kind === "always") {
    return "所有路线目标下都要求";
  }

  const track = getRequiredTrack(
    manifest,
    condition.trackId,
    "Stage 条件",
  );
  const goalLabel =
    condition.minimumGoal === "master" ? "主修掌握" : "理解";
  return `当「${track.title}」目标至少为「${goalLabel}」时要求`;
}

function getStageProjectGates(
  manifest: ContentManifest,
  stageId: string,
  projectGates: ContentManifest["stages"][number]["projectGates"],
) {
  return projectGates.map((gate) => {
    const project = getRequiredProject(
      manifest,
      gate.projectId,
      `Stage ${stageId} projectGate`,
    );

    return {
      project: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        publicationStatus: project.publicationStatus,
      },
      conditionSummary: getTrackGoalConditionSummary(manifest, gate.when),
    } as const;
  });
}

function getStageProjects(
  manifest: ContentManifest,
  stageConceptIds: ReadonlySet<string>,
  projectGateIds: readonly string[],
) {
  const relatedProjectIds = new Set(projectGateIds);
  manifest.projects.forEach((project) => {
    if (
      project.publicationStatus === "published" &&
      project.conceptRequirements.some(({ conceptId }) =>
        stageConceptIds.has(conceptId),
      )
    ) {
      relatedProjectIds.add(project.id);
    }
  });

  return [...relatedProjectIds]
    .map((projectId) =>
      getRequiredProject(manifest, projectId, "Roadmap Stage"),
    )
    .filter(({ publicationStatus }) => publicationStatus === "published")
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((project) => ({
      project,
      requirements: project.conceptRequirements.map((requirement) => ({
        concept: getRequiredConcept(
          manifest,
          requirement.conceptId,
          `Project ${project.id}`,
        ),
        requirement,
      })),
      isStageGate: projectGateIds.includes(project.id),
    }));
}

function getConceptDependencies(
  manifest: ContentManifest,
  conceptId: string,
) {
  return manifest.dependencies
    .filter(({ targetId }) => targetId === conceptId)
    .map((dependency) => ({
      dependency,
      prerequisite: getRequiredConcept(
        manifest,
        dependency.prerequisiteId,
        `Dependency ${dependency.prerequisiteId} -> ${dependency.targetId}`,
      ),
    }))
    .sort((left, right) => {
      const kindOrder = left.dependency.kind === "hard" ? 0 : 1;
      const otherKindOrder = right.dependency.kind === "hard" ? 0 : 1;
      return (
        kindOrder - otherKindOrder ||
        byOrderThenId(left.prerequisite, right.prerequisite)
      );
    });
}

export function buildRoadmapView(manifest: ContentManifest) {
  const publishedConcepts = manifest.concepts.filter(
    ({ publicationStatus }) => publicationStatus === "published",
  );

  const stages = [...manifest.stages].sort(byOrderThenId).map((stage) => {
    const concepts = publishedConcepts
      .filter(({ stageId }) => stageId === stage.id)
      .sort(byOrderThenId)
      .map((concept) => ({
        concept,
        dependencies: getConceptDependencies(manifest, concept.id),
      }));
    const stageConceptIds = new Set(concepts.map(({ concept }) => concept.id));
    const projectGateIds = stage.projectGates.map(({ projectId }) => projectId);
    const tracks = stage.trackIds
      .map((trackId) => getRequiredTrack(manifest, trackId, `Stage ${stage.id}`))
      .sort(byOrderThenId);
    const entryGate = stage.entryGate
      ? resolveCheckpointGate(manifest, stage.entryGate)
      : undefined;
    const projectGates = getStageProjectGates(
      manifest,
      stage.id,
      stage.projectGates,
    );
    const exitCriteria = stage.exitCriteria.map((criterion) => ({
      criterion: {
        id: criterion.id,
        description: criterion.description,
        required: criterion.required,
      },
      conditionSummary: getTrackGoalConditionSummary(manifest, criterion.when),
    }));

    return {
      stage,
      tracks,
      entryGate,
      entryGateSummary: entryGate
        ? getCheckpointGateSummary(entryGate)
        : "无 checkpoint 级入口门槛；具体学习前置由 Concept hard dependency 决定。",
      concepts,
      projects: getStageProjects(manifest, stageConceptIds, projectGateIds),
      projectGates,
      exitCriteria,
      conditionalExitCriterionCount: stage.exitCriteria.filter(
        ({ when }) => when.kind !== "always",
      ).length,
    } as const;
  });

  const tracks = [...manifest.tracks].sort(byOrderThenId).map((track) => {
    const trackStages = stages.filter(({ stage }) =>
      stage.trackIds.includes(track.id),
    );

    return {
      track,
      stages: trackStages,
      availableStageCount: trackStages.filter(
        ({ stage }) => stage.contentStatus === "available",
      ).length,
      plannedStageCount: trackStages.filter(
        ({ stage }) => stage.contentStatus === "planned",
      ).length,
    } as const;
  });

  const overview = {
    tracks: tracks.map(({ track }) => ({ track })),
    stages: stages.map(
      ({
        stage,
        tracks: stageTracks,
        entryGate,
        concepts,
        projectGates,
        exitCriteria,
      }) => ({
        id: stage.id,
        title: stage.title,
        summary: stage.summary,
        contentStatus: stage.contentStatus,
        outcomes: stage.outcomes,
        estimatedHours: stage.estimatedHours,
        retestAfterDays: stage.retestAfterDays,
        tracks: stageTracks,
        entryGate,
        conceptCount: concepts.length,
        projectGates,
        exitCriteria,
      }),
    ),
  } as const;

  return {
    stages,
    tracks,
    overview,
    availableStages: stages.filter(
      ({ stage }) => stage.contentStatus === "available",
    ),
    plannedStageCount: stages.filter(
      ({ stage }) => stage.contentStatus === "planned",
    ).length,
    publishedConceptCount: publishedConcepts.length,
    publishedProjectCount: manifest.projects.filter(
      ({ publicationStatus }) => publicationStatus === "published",
    ).length,
  } as const;
}

export type RoadmapView = ReturnType<typeof buildRoadmapView>;
export type RoadmapStageView = RoadmapView["stages"][number];
export type RoadmapTrackView = RoadmapView["tracks"][number];
export type RoadmapOverviewView = RoadmapView["overview"];
export type RoadmapOverviewStageView = RoadmapOverviewView["stages"][number];

export type RoadmapCheckpointGateView =
  | {
      readonly kind: "checkpoint";
      readonly stage: {
        readonly id: string;
        readonly title: string;
        readonly primaryOutcome: string;
      };
    }
  | {
      readonly kind: "track-goal-checkpoint";
      readonly stage: {
        readonly id: string;
        readonly title: string;
        readonly primaryOutcome: string;
      };
      readonly track: { readonly title: string };
      readonly minimumTrackGoal: "understand" | "master";
    }
  | {
      readonly kind: "allOf" | "anyOf";
      readonly gates: readonly RoadmapCheckpointGateView[];
    };
