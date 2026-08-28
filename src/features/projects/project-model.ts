import { getConceptById } from "@/lib/content/manifest-reader";
import type { ContentManifest } from "@/lib/content/manifest-types";

type ManifestProject = ContentManifest["projects"][number];

function byOrderThenId<Ordered extends { readonly id: string; readonly order: number }>(
  left: Ordered,
  right: Ordered,
) {
  return left.order - right.order || left.id.localeCompare(right.id, "en");
}

function getRequiredTrack(manifest: ContentManifest, trackId: string) {
  const track = manifest.tracks.find(({ id }) => id === trackId);
  if (!track) {
    throw new Error(`Project 引用了不存在的 Track ${trackId}`);
  }
  return track;
}

function getProjectStages(
  manifest: ContentManifest,
  project: ManifestProject,
) {
  const requirementStageIds = new Set(
    project.conceptRequirements.map(({ conceptId }) => {
      const concept = getConceptById(manifest, conceptId);
      if (!concept) {
        throw new Error(`Project ${project.id} 引用了不存在的 Concept ${conceptId}`);
      }
      return concept.stageId;
    }),
  );

  return manifest.stages
    .filter(
      (stage) =>
        requirementStageIds.has(stage.id) ||
        stage.projectGates.some(({ projectId }) => projectId === project.id),
    )
    .toSorted(byOrderThenId);
}

export function getProjectHref(project: ManifestProject) {
  return project.publicationStatus === "published"
    ? `/projects/${project.slug}/`
    : `/projects/#project-${project.slug}`;
}

export function buildProjectCatalogView(manifest: ContentManifest) {
  const projects = manifest.projects
    .map((project) => {
      const stages = getProjectStages(manifest, project);
      const tracks = project.trackIds
        .map((trackId) => getRequiredTrack(manifest, trackId))
        .toSorted(byOrderThenId);

      return {
        project,
        stages,
        tracks,
        href: getProjectHref(project),
      } as const;
    })
    .toSorted((left, right) => {
      const leftStageOrder = left.stages[0]?.order ?? Number.MAX_SAFE_INTEGER;
      const rightStageOrder = right.stages[0]?.order ?? Number.MAX_SAFE_INTEGER;
      return (
        leftStageOrder - rightStageOrder ||
        left.project.id.localeCompare(right.project.id, "en")
      );
    });

  return {
    projects,
    stages: [...manifest.stages].sort(byOrderThenId),
    tracks: [...manifest.tracks].sort(byOrderThenId),
    publishedCount: projects.filter(
      ({ project }) => project.publicationStatus === "published",
    ).length,
    draftCount: projects.filter(
      ({ project }) => project.publicationStatus === "draft",
    ).length,
  } as const;
}

export function getProjectsForConcept(
  manifest: ContentManifest,
  conceptId: string,
) {
  return buildProjectCatalogView(manifest).projects
    .flatMap((view) => {
      const requirement = view.project.conceptRequirements.find(
        (item) => item.conceptId === conceptId,
      );
      return requirement ? [{ ...view, requirement }] : [];
    })
    .toSorted((left, right) => {
      const kindOrder = left.requirement.kind === "hard" ? 0 : 1;
      const otherKindOrder = right.requirement.kind === "hard" ? 0 : 1;
      return (
        kindOrder - otherKindOrder ||
        left.project.id.localeCompare(right.project.id, "en")
      );
    });
}

export function getNextProjects(
  manifest: ContentManifest,
  projectId: string,
) {
  const currentProject = manifest.projects.find(({ id }) => id === projectId);
  if (!currentProject) return [];

  const currentStages = getProjectStages(manifest, currentProject);
  const lastCurrentOrder = currentStages.at(-1)?.order;
  if (lastCurrentOrder === undefined) return [];

  const nextStage = [...manifest.stages]
    .filter(
      (stage) => stage.order > lastCurrentOrder && stage.projectGates.length > 0,
    )
    .sort(byOrderThenId)[0];
  if (!nextStage) return [];

  return nextStage.projectGates.flatMap(({ projectId: nextProjectId }) => {
    const project = manifest.projects.find(({ id }) => id === nextProjectId);
    return project
      ? [{ project, stage: nextStage, href: getProjectHref(project) }]
      : [];
  });
}

export type ProjectCatalogView = ReturnType<typeof buildProjectCatalogView>;
export type ProjectCatalogItemView = ProjectCatalogView["projects"][number];

