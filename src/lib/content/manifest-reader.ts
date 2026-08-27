import type {
  ConceptManifestEntry,
  ContentManifest,
  ProjectManifestEntry,
} from "./manifest-types";

export function getConceptById(
  manifest: ContentManifest,
  conceptId: string,
): ConceptManifestEntry | undefined {
  const index = manifest.conceptIndexById[conceptId];
  return index === undefined ? undefined : manifest.concepts[index];
}

export function getConceptBySlug(
  manifest: ContentManifest,
  slug: string,
): ConceptManifestEntry | undefined {
  const conceptId = manifest.conceptIdBySlug[slug];
  return conceptId === undefined
    ? undefined
    : getConceptById(manifest, conceptId);
}

export function getProjectById(
  manifest: ContentManifest,
  projectId: string,
): ProjectManifestEntry | undefined {
  const index = manifest.projectIndexById[projectId];
  return index === undefined ? undefined : manifest.projects[index];
}

export function getProjectBySlug(
  manifest: ContentManifest,
  slug: string,
): ProjectManifestEntry | undefined {
  const projectId = manifest.projectIdBySlug[slug];
  return projectId === undefined
    ? undefined
    : getProjectById(manifest, projectId);
}
