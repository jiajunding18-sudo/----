import type {
  ConceptManifestEntry,
  ContentManifest,
  DeepReadonly,
  ProjectManifestEntry,
} from "@/lib/content/manifest-types";
import type {
  ProjectResourceRef,
  Resource,
  StageDefinition,
  TrackDefinition,
} from "@/types";

export interface ResourceConceptRelation {
  readonly concept: ConceptManifestEntry;
  readonly recommendationOrder: number;
}

export interface ResourceProjectRelation {
  readonly project: ProjectManifestEntry;
  readonly reference: DeepReadonly<ProjectResourceRef>;
}

export interface ResourceCatalogItem {
  readonly resource: DeepReadonly<Resource>;
  readonly slug: string;
  readonly href: string;
  readonly concepts: readonly ResourceConceptRelation[];
  readonly projects: readonly ResourceProjectRelation[];
  readonly stages: readonly DeepReadonly<StageDefinition>[];
  readonly tracks: readonly DeepReadonly<TrackDefinition>[];
}

export interface ResourceCatalogView {
  readonly resources: readonly ResourceCatalogItem[];
  readonly concepts: readonly ConceptManifestEntry[];
  readonly stages: readonly DeepReadonly<StageDefinition>[];
  readonly tracks: readonly DeepReadonly<TrackDefinition>[];
}

export type ResourceGuidanceItem =
  | {
      readonly item: ResourceCatalogItem;
      readonly relation: {
        readonly kind: "concept";
        readonly recommendationOrder: number;
      };
    }
  | {
      readonly item: ResourceCatalogItem;
      readonly relation: {
        readonly kind: "project";
        readonly reference: DeepReadonly<ProjectResourceRef>;
      };
    };

const priorityOrder = {
  essential: 0,
  recommended: 1,
  optional: 2,
} as const;

const resourceTypeOrder = {
  "official-doc": 0,
  course: 1,
  book: 2,
  repository: 3,
  video: 4,
  article: 5,
  paper: 6,
  dataset: 7,
} as const;

const resourceIdPrefix = "resource.";
const resourceSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function getResourceSlug(resourceId: string) {
  const slug = resourceId.startsWith(resourceIdPrefix)
    ? resourceId.slice(resourceIdPrefix.length)
    : "";
  if (!resourceSlugPattern.test(slug)) {
    throw new Error(
      `Resource ${resourceId} 必须使用 resource.<kebab-case> 稳定 ID 才能生成详情路由`,
    );
  }
  return slug;
}

export function getResourceHref(resourceId: string) {
  return `/resources/${getResourceSlug(resourceId)}/`;
}

function uniqueById<Item extends { readonly id: string }>(
  items: readonly Item[],
) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function getConceptById(manifest: ContentManifest, conceptId: string) {
  const conceptIndex = manifest.conceptIndexById[conceptId];
  return conceptIndex === undefined
    ? undefined
    : manifest.concepts[conceptIndex];
}

function buildResourceCatalogItem(
  manifest: ContentManifest,
  resource: DeepReadonly<Resource>,
): ResourceCatalogItem {
  const slug = getResourceSlug(resource.id);
  const concepts = manifest.concepts
    .filter(
      (concept) =>
        concept.publicationStatus === "published" &&
        concept.resourceIds.includes(resource.id),
    )
    .map((concept) => ({
      concept,
      recommendationOrder: concept.resourceIds.indexOf(resource.id) + 1,
    }))
    .sort(
      (left, right) =>
        left.concept.order - right.concept.order ||
        left.concept.id.localeCompare(right.concept.id, "en"),
    );

  const projects = manifest.projects
    .filter(({ publicationStatus }) => publicationStatus === "published")
    .flatMap((project) => {
      const reference = project.resources.find(
        ({ resourceId }) => resourceId === resource.id,
      );
      return reference ? [{ project, reference }] : [];
    })
    .sort((left, right) =>
      left.project.title.localeCompare(right.project.title, "zh-CN"),
    );

  const projectConcepts = projects.flatMap(({ project }) =>
    project.conceptRequirements.flatMap(({ conceptId }) => {
      const concept = getConceptById(manifest, conceptId);
      return concept?.publicationStatus === "published" ? [concept] : [];
    }),
  );
  const contextualConcepts = uniqueById([
    ...concepts.map(({ concept }) => concept),
    ...projectConcepts,
  ]);
  const stages = uniqueById(
    contextualConcepts.flatMap(({ stageId }) => {
      const stage = manifest.stages.find(({ id }) => id === stageId);
      return stage ? [stage] : [];
    }),
  ).sort((left, right) => left.order - right.order);
  const tracks = uniqueById(
    [
      ...contextualConcepts.flatMap(({ trackIds }) => trackIds),
      ...projects.flatMap(({ project }) => project.trackIds),
    ].flatMap((trackId) => {
      const track = manifest.tracks.find(({ id }) => id === trackId);
      return track ? [track] : [];
    }),
  ).sort((left, right) => left.order - right.order);

  return {
    resource,
    slug,
    href: getResourceHref(resource.id),
    concepts,
    projects,
    stages,
    tracks,
  };
}

export function buildResourceCatalogView(
  manifest: ContentManifest,
): ResourceCatalogView {
  const resources = manifest.resources
    .map((resource) => buildResourceCatalogItem(manifest, resource))
    .sort(
      (left, right) =>
        priorityOrder[left.resource.priority] -
          priorityOrder[right.resource.priority] ||
        resourceTypeOrder[left.resource.type] -
          resourceTypeOrder[right.resource.type] ||
        left.resource.title.localeCompare(right.resource.title, "en"),
    );

  return {
    resources,
    concepts: uniqueById(
      resources.flatMap((item) =>
        item.concepts.map(({ concept }) => concept),
      ),
    ).sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id, "en"),
    ),
    stages: uniqueById(resources.flatMap(({ stages }) => stages)).sort(
      (left, right) => left.order - right.order,
    ),
    tracks: uniqueById(resources.flatMap(({ tracks }) => tracks)).sort(
      (left, right) => left.order - right.order,
    ),
  };
}

export function getResourceCatalogItemBySlug(
  manifest: ContentManifest,
  slug: string,
) {
  return buildResourceCatalogView(manifest).resources.find(
    (item) => item.slug === slug,
  );
}

export function getResourceSlugs(manifest: ContentManifest) {
  return buildResourceCatalogView(manifest).resources.map(({ slug }) => ({
    slug,
  }));
}

export function getConceptResourceGuidance(
  manifest: ContentManifest,
  conceptId: string,
): readonly ResourceGuidanceItem[] {
  const concept = getConceptById(manifest, conceptId);
  if (!concept) {
    return [];
  }

  const catalogItems = new Map(
    buildResourceCatalogView(manifest).resources.map((item) => [
      item.resource.id,
      item,
    ]),
  );
  return concept.resourceIds.flatMap((resourceId, index) => {
    const item = catalogItems.get(resourceId);
    return item
      ? [
          {
            item,
            relation: {
              kind: "concept" as const,
              recommendationOrder: index + 1,
            },
          },
        ]
      : [];
  });
}

export function getProjectResourceGuidance(
  manifest: ContentManifest,
  projectId: string,
): readonly ResourceGuidanceItem[] {
  const project = manifest.projects.find(({ id }) => id === projectId);
  if (!project) {
    return [];
  }

  const catalogItems = new Map(
    buildResourceCatalogView(manifest).resources.map((item) => [
      item.resource.id,
      item,
    ]),
  );
  return project.resources.flatMap((reference) => {
    const item = catalogItems.get(reference.resourceId);
    return item
      ? [
          {
            item,
            relation: { kind: "project" as const, reference },
          },
        ]
      : [];
  });
}
