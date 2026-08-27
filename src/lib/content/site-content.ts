import { contentManifest } from "../../../.generated/content-manifest";
import {
  conceptContentLoaders,
  projectContentLoaders,
} from "../../../.generated/content-modules";

import type {
  ConceptManifestEntry,
  ContentManifest,
  DeepReadonly,
  ProjectManifestEntry,
} from "./manifest-types";
import { getConceptById, getConceptBySlug, getProjectBySlug } from "./manifest-reader";
import type { Resource, StageDefinition, TrackDefinition } from "@/types";

export const stageZeroId = "stage.tooling-foundations";
export const pixelLabProjectId = "project.pixel-lab";

export class SiteContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteContentError";
  }
}

function hasOwnKey<ObjectType extends object>(
  value: ObjectType,
  key: PropertyKey,
): key is keyof ObjectType {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function byLearningOrder(
  left: ConceptManifestEntry,
  right: ConceptManifestEntry,
) {
  return left.order - right.order || left.title.localeCompare(right.title, "zh-CN");
}

export function getPublishedConcepts(
  manifest: ContentManifest = contentManifest,
) {
  return manifest.concepts
    .filter(({ publicationStatus }) => publicationStatus === "published")
    .toSorted(byLearningOrder);
}

export function getPublishedProjects(
  manifest: ContentManifest = contentManifest,
) {
  return manifest.projects.filter(
    ({ publicationStatus }) => publicationStatus === "published",
  );
}

export function getStageZeroSlice(
  manifest: ContentManifest = contentManifest,
) {
  const stage = manifest.stages.find(({ id }) => id === stageZeroId);
  if (!stage) {
    throw new SiteContentError(`manifest 缺少 ${stageZeroId}`);
  }

  const tracks = stage.trackIds.map((trackId) => {
    const track = manifest.tracks.find(({ id }) => id === trackId);
    if (!track) {
      throw new SiteContentError(
        `Stage ${stage.id} 引用了不存在的 Track ${trackId}`,
      );
    }
    return track;
  });
  const concepts = getPublishedConcepts(manifest).filter(
    ({ stageId }) => stageId === stage.id,
  );
  const project = getPublishedProjects(manifest).find(
    ({ id }) => id === pixelLabProjectId,
  );

  return { concepts, project, stage, tracks } as const;
}

export function readStageZeroSlice() {
  try {
    return { status: "ready", value: getStageZeroSlice() } as const;
  } catch (error) {
    return { error, status: "error" } as const;
  }
}

export function getPublishedConceptBySlug(slug: string) {
  const concept = getConceptBySlug(contentManifest, slug);
  return concept?.publicationStatus === "published" ? concept : undefined;
}

export function getPublishedProjectBySlug(slug: string) {
  const project = getProjectBySlug(contentManifest, slug);
  return project?.publicationStatus === "published" ? project : undefined;
}

export function getConceptsForProject(project: ProjectManifestEntry) {
  return project.conceptRequirements.map((requirement) => {
    const concept = getConceptById(contentManifest, requirement.conceptId);
    if (!concept) {
      throw new SiteContentError(
        `Project ${project.id} 引用了不存在的 Concept ${requirement.conceptId}`,
      );
    }
    return { concept, requirement } as const;
  });
}

export function getStage(stageId: string): DeepReadonly<StageDefinition> | undefined {
  return contentManifest.stages.find(({ id }) => id === stageId);
}

export function getTracks(trackIds: readonly string[]): readonly DeepReadonly<TrackDefinition>[] {
  return trackIds.flatMap((trackId) => {
    const track = contentManifest.tracks.find(({ id }) => id === trackId);
    return track ? [track] : [];
  });
}

export function getResources(resourceIds: readonly string[]): readonly DeepReadonly<Resource>[] {
  return resourceIds.flatMap((resourceId) => {
    const resource = contentManifest.resources.find(({ id }) => id === resourceId);
    return resource ? [resource] : [];
  });
}

export async function loadConceptContent(slug: string) {
  if (!hasOwnKey(conceptContentLoaders, slug)) {
    return undefined;
  }
  return conceptContentLoaders[slug]();
}

export async function loadProjectContent(slug: string) {
  if (!hasOwnKey(projectContentLoaders, slug)) {
    return undefined;
  }
  return projectContentLoaders[slug]();
}

export function getPublishedConceptSlugs() {
  return getPublishedConcepts().map(({ slug }) => ({ slug }));
}

export function getPublishedProjectSlugs() {
  return getPublishedProjects().map(({ slug }) => ({ slug }));
}
