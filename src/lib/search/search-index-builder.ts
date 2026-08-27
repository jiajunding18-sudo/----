import type {
  ContentCatalogInput,
  ContentManifest,
  LoadedConcept,
  LoadedProject,
} from "@/lib/content/manifest-types";

import { searchIndexSchema, type SearchDocument } from "./search-schema";
import { buildSearchTokens } from "./search-text";

function byId<Identified extends { readonly id: string }>(
  left: Identified,
  right: Identified,
) {
  return left.id.localeCompare(right.id, "en");
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[`*_~>#|$]/gu, " ")
    .replace(/\\([\\`*_[\]{}()#+.!-])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

export function extractMdxSearchText(body: string) {
  const headings = [...body.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gmu)]
    .map((match) => cleanMarkdownText(match[1] ?? ""))
    .filter(Boolean);

  return {
    headings: uniqueSorted(headings),
    body: cleanMarkdownText(body),
  } as const;
}

function getRequiredStage(manifest: ContentManifest, stageId: string) {
  const stage = manifest.stages.find(({ id }) => id === stageId);
  if (!stage) {
    throw new Error(`Search index 引用了不存在的 Stage ${stageId}`);
  }
  return stage;
}

function getRequiredTrack(manifest: ContentManifest, trackId: string) {
  const track = manifest.tracks.find(({ id }) => id === trackId);
  if (!track) {
    throw new Error(`Search index 引用了不存在的 Track ${trackId}`);
  }
  return track;
}

function getRequiredConcept(manifest: ContentManifest, conceptId: string) {
  const conceptIndex = manifest.conceptIndexById[conceptId];
  const concept =
    conceptIndex === undefined ? undefined : manifest.concepts[conceptIndex];
  if (!concept) {
    throw new Error(`Search index 引用了不存在的 Concept ${conceptId}`);
  }
  return concept;
}

function getStageContext(
  manifest: ContentManifest,
  stageIds: readonly string[],
) {
  const stages = uniqueSorted(stageIds).map((stageId) =>
    getRequiredStage(manifest, stageId),
  );
  return {
    stageIds: stages.map(({ id }) => id),
    stageTitles: stages.map(({ title }) => title),
  } as const;
}

function getTrackContext(
  manifest: ContentManifest,
  trackIds: readonly string[],
) {
  const tracks = uniqueSorted(trackIds).map((trackId) =>
    getRequiredTrack(manifest, trackId),
  );
  return {
    trackIds: tracks.map(({ id }) => id),
    trackTitles: tracks.map(({ title }) => title),
  } as const;
}

function withTokens(
  document: Omit<SearchDocument, "tokens">,
): SearchDocument {
  return {
    ...document,
    tokens: buildSearchTokens([
      document.title,
      document.englishTitle ?? "",
      ...document.aliases,
      ...document.keywords,
      ...document.headings,
      ...document.goals,
      ...document.tags,
      ...document.stageTitles,
      ...document.trackTitles,
      ...document.relatedTitles,
    ]),
  };
}

function buildConceptDocuments(
  concepts: readonly LoadedConcept[],
  manifest: ContentManifest,
) {
  return concepts
    .filter(({ meta }) => meta.publicationStatus === "published")
    .flatMap(({ body, meta }) => {
      const text = extractMdxSearchText(body);
      const stageContext = getStageContext(manifest, [meta.stageId]);
      const trackContext = getTrackContext(manifest, meta.trackIds);
      const common = {
        aliases: meta.aliases,
        keywords: uniqueSorted([
          meta.id,
          meta.slug,
          ...meta.searchKeywords,
          ...stageContext.stageTitles,
          ...trackContext.trackTitles,
        ]),
        stageIds: stageContext.stageIds,
        stageTitles: stageContext.stageTitles,
        trackIds: trackContext.trackIds,
        trackTitles: trackContext.trackTitles,
        relatedTitles: [] as string[],
        external: false,
        status: "available" as const,
      };
      const mainDocument = withTokens({
        ...common,
        id: meta.id,
        kind: "concept",
        title: meta.title,
        englishTitle: meta.englishTitle,
        headings: text.headings,
        goals: meta.learningOutcomes,
        summary: meta.summary,
        body: text.body,
        tags: meta.tags,
        href: `/knowledge/${meta.slug}/`,
      });
      const embeddedDocuments = (meta.searchEntries ?? []).map((entry) =>
        withTokens({
          ...common,
          id: `${meta.id}:${entry.id}`,
          kind: entry.kind,
          title: entry.title,
          aliases: entry.aliases,
          headings: [],
          goals: [],
          summary: entry.summary ?? meta.summary,
          body: "",
          tags: meta.tags,
          href: `/knowledge/${meta.slug}/#${entry.anchor}`,
        }),
      );

      return [mainDocument, ...embeddedDocuments];
    });
}

function buildProjectDocuments(
  projects: readonly LoadedProject[],
  manifest: ContentManifest,
) {
  return projects
    .filter(({ meta }) => meta.publicationStatus === "published")
    .map(({ body, meta }) => {
      const concepts = meta.conceptRequirements.map(({ conceptId }) =>
        getRequiredConcept(manifest, conceptId),
      );
      const stageContext = getStageContext(
        manifest,
        concepts.map(({ stageId }) => stageId),
      );
      const trackContext = getTrackContext(manifest, meta.trackIds);
      const text = extractMdxSearchText(body);

      return withTokens({
        id: meta.id,
        kind: "project",
        title: meta.title,
        aliases: [],
        keywords: uniqueSorted([
          meta.id,
          meta.slug,
          ...meta.techStack,
          ...stageContext.stageTitles,
          ...trackContext.trackTitles,
        ]),
        headings: text.headings,
        goals: [meta.resumeOutcome],
        summary: meta.resumeOutcome,
        body: text.body,
        tags: meta.tags,
        href: `/projects/${meta.slug}/`,
        external: false,
        status: "available",
        stageIds: stageContext.stageIds,
        stageTitles: stageContext.stageTitles,
        trackIds: trackContext.trackIds,
        trackTitles: trackContext.trackTitles,
        relatedTitles: concepts.map(({ title }) => title),
      });
    });
}

function buildResourceDocuments(manifest: ContentManifest) {
  const publishedConcepts = manifest.concepts.filter(
    ({ publicationStatus }) => publicationStatus === "published",
  );
  const publishedProjects = manifest.projects.filter(
    ({ publicationStatus }) => publicationStatus === "published",
  );

  return manifest.resources.map((resource) => {
    const concepts = publishedConcepts.filter(({ resourceIds }) =>
      resourceIds.includes(resource.id),
    );
    const projects = publishedProjects.filter(({ resources }) =>
      resources.some(({ resourceId }) => resourceId === resource.id),
    );
    const projectConcepts = projects.flatMap(({ conceptRequirements }) =>
      conceptRequirements.map(({ conceptId }) =>
        getRequiredConcept(manifest, conceptId),
      ),
    );
    const relatedConcepts = [...concepts, ...projectConcepts];
    const stageContext = getStageContext(
      manifest,
      relatedConcepts.map(({ stageId }) => stageId),
    );
    const trackContext = getTrackContext(
      manifest,
      uniqueSorted([
        ...relatedConcepts.flatMap(({ trackIds }) => trackIds),
        ...projects.flatMap(({ trackIds }) => trackIds),
      ]),
    );

    return withTokens({
      id: resource.id,
      kind: "resource",
      title: resource.title,
      aliases: [...(resource.aliases ?? [])],
      keywords: uniqueSorted([
        resource.id,
        resource.type,
        resource.level,
        resource.priority,
        resource.language,
        ...(resource.recommendedParts ?? []),
      ]),
      headings: [],
      goals: [],
      authorOrOrganization: resource.authorOrOrganization,
      summary: resource.reason,
      body: (resource.recommendedParts ?? []).join(" "),
      tags: [],
      href: resource.url,
      external: true,
      status: resource.verification,
      resourceType: resource.type,
      stageIds: stageContext.stageIds,
      stageTitles: stageContext.stageTitles,
      trackIds: trackContext.trackIds,
      trackTitles: trackContext.trackTitles,
      relatedTitles: uniqueSorted([
        ...concepts.map(({ title }) => title),
        ...projects.map(({ title }) => title),
      ]),
    });
  });
}

export function buildSearchIndex(
  input: ContentCatalogInput,
  manifest: ContentManifest,
) {
  const index = {
    schemaVersion: 1,
    documents: [
      ...buildConceptDocuments(input.concepts, manifest),
      ...buildProjectDocuments(input.projects, manifest),
      ...buildResourceDocuments(manifest),
    ].sort(byId),
  } as const;

  return searchIndexSchema.parse(index);
}
