import { deriveDependencies } from "@/lib/validation";

import { validateContentCatalog } from "./catalog-validator";
import { extractMdxHeadings } from "./mdx-headings.mjs";
import type {
  ConceptManifestEntry,
  ContentCatalogInput,
  ContentManifest,
  ProjectManifestEntry,
} from "./manifest-types";

function byId<Named extends { readonly id: string }>(
  left: Named,
  right: Named,
) {
  return left.id.localeCompare(right.id, "en");
}

function createIndexById<Named extends { readonly id: string }>(
  entries: readonly Named[],
) {
  return Object.fromEntries(entries.map((entry, index) => [entry.id, index]));
}

function createIdBySlug(
  entries: readonly {
    readonly id: string;
    readonly slug: string;
    readonly legacySlugs?: readonly string[];
  }[],
) {
  return Object.fromEntries(
    entries.flatMap((entry) => [
      [entry.slug, entry.id],
      ...(entry.legacySlugs ?? []).map((slug) => [slug, entry.id]),
    ]),
  );
}

export function buildContentManifest(
  input: ContentCatalogInput,
): ContentManifest {
  const concepts = [...input.concepts]
    .sort((left, right) => byId(left.meta, right.meta))
    .map(
      ({ body, meta, sourcePath }): ConceptManifestEntry => ({
        ...meta,
        sourcePath,
        headings: extractMdxHeadings(body),
      }),
    );
  const projects = [...input.projects]
    .sort((left, right) => byId(left.meta, right.meta))
    .map(
      ({ meta, sourcePath }): ProjectManifestEntry => ({
        ...meta,
        sourcePath,
      }),
    );
  const tracks = [...input.tracks].sort(byId);
  const stages = [...input.stages].sort(byId);
  const resources = [...input.resources].sort(byId);
  const dependencies = deriveDependencies(
    input.concepts.map((concept) => concept.meta),
  ).sort((left, right) =>
    `${left.prerequisiteId}:${left.targetId}`.localeCompare(
      `${right.prerequisiteId}:${right.targetId}`,
      "en",
    ),
  );

  validateContentCatalog(input, dependencies);

  return {
    schemaVersion: 1,
    concepts,
    projects,
    tracks,
    stages,
    resources,
    dependencies,
    conceptIndexById: createIndexById(concepts),
    conceptIdBySlug: createIdBySlug(concepts),
    projectIndexById: createIndexById(projects),
    projectIdBySlug: createIdBySlug(projects),
  };
}
