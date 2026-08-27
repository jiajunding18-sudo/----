import {
  getConceptById,
  getProjectById,
} from "@/lib/content/manifest-reader";
import type { ContentManifest } from "@/lib/content/manifest-types";

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
    const tracks = stage.trackIds.map((trackId) => {
      const track = manifest.tracks.find(({ id }) => id === trackId);
      if (!track) {
        throw new Error(
          `Stage ${stage.id} 引用了不存在的 Track ${trackId}`,
        );
      }
      return track;
    });

    return {
      stage,
      tracks,
      concepts,
      projects: getStageProjects(manifest, stageConceptIds, projectGateIds),
    } as const;
  });

  return {
    stages,
    publishedConceptCount: publishedConcepts.length,
    publishedProjectCount: manifest.projects.filter(
      ({ publicationStatus }) => publicationStatus === "published",
    ).length,
  } as const;
}

export type RoadmapView = ReturnType<typeof buildRoadmapView>;
export type RoadmapStageView = RoadmapView["stages"][number];
