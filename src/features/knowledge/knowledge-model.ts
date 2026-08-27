import { getConceptById } from "@/lib/content/manifest-reader";
import type { ContentManifest } from "@/lib/content/manifest-types";

type ManifestConcept = ContentManifest["concepts"][number];

function byOrderThenId<Ordered extends { readonly id: string; readonly order: number }>(
  left: Ordered,
  right: Ordered,
) {
  return left.order - right.order || left.id.localeCompare(right.id, "en");
}

function getRequiredStage(manifest: ContentManifest, stageId: string) {
  const stage = manifest.stages.find(({ id }) => id === stageId);
  if (!stage) {
    throw new Error(`Knowledge 引用了不存在的 Stage ${stageId}`);
  }
  return stage;
}

function getRequiredTrack(manifest: ContentManifest, trackId: string) {
  const track = manifest.tracks.find(({ id }) => id === trackId);
  if (!track) {
    throw new Error(`Knowledge 引用了不存在的 Track ${trackId}`);
  }
  return track;
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

function byConceptCatalogOrder(
  manifest: ContentManifest,
  left: ManifestConcept,
  right: ManifestConcept,
) {
  const leftStage = getRequiredStage(manifest, left.stageId);
  const rightStage = getRequiredStage(manifest, right.stageId);
  return (
    byOrderThenId(leftStage, rightStage) ||
    left.order - right.order ||
    left.id.localeCompare(right.id, "en")
  );
}

function toConceptReference(concept: ManifestConcept) {
  return {
    id: concept.id,
    slug: concept.slug,
    title: concept.title,
    englishTitle: concept.englishTitle,
    publicationStatus: concept.publicationStatus,
    href:
      concept.publicationStatus === "published"
        ? `/knowledge/${concept.slug}/`
        : undefined,
  } as const;
}

function getConceptRelations(
  manifest: ContentManifest,
  conceptId: string,
  direction: "incoming" | "outgoing",
) {
  const relations = manifest.dependencies
    .filter((dependency) =>
      direction === "incoming"
        ? dependency.targetId === conceptId
        : dependency.prerequisiteId === conceptId,
    )
    .map((dependency) => {
      const relatedConceptId =
        direction === "incoming"
          ? dependency.prerequisiteId
          : dependency.targetId;
      const relatedConcept = getRequiredConcept(
        manifest,
        relatedConceptId,
        `Dependency ${dependency.prerequisiteId} -> ${dependency.targetId}`,
      );

      return {
        kind: dependency.kind,
        rationale: dependency.rationale,
        concept: toConceptReference(relatedConcept),
        orderSource: relatedConcept,
      } as const;
    });

  return relations
    .toSorted((left, right) => {
      const leftKindOrder = left.kind === "hard" ? 0 : 1;
      const rightKindOrder = right.kind === "hard" ? 0 : 1;
      return (
        leftKindOrder - rightKindOrder ||
        byConceptCatalogOrder(manifest, left.orderSource, right.orderSource)
      );
    })
    .map(({ concept, kind, rationale }) => ({ concept, kind, rationale }));
}

export function buildKnowledgeView(manifest: ContentManifest) {
  const publishedConcepts = manifest.concepts
    .filter(({ publicationStatus }) => publicationStatus === "published")
    .toSorted((left, right) => byConceptCatalogOrder(manifest, left, right));

  const concepts = publishedConcepts.map((concept, index) => {
    const stage = getRequiredStage(manifest, concept.stageId);
    const tracks = concept.trackIds
      .map((trackId) => getRequiredTrack(manifest, trackId))
      .toSorted(byOrderThenId);
    const prerequisites = getConceptRelations(manifest, concept.id, "incoming");
    const dependents = getConceptRelations(manifest, concept.id, "outgoing");

    return {
      concept: {
        id: concept.id,
        slug: concept.slug,
        title: concept.title,
        englishTitle: concept.englishTitle,
        summary: concept.summary,
        order: concept.order,
        level: concept.level,
        targetDepth: concept.targetDepth,
        estimatedHours: concept.estimatedHours,
        learningOutcome: concept.learningOutcomes[0],
        publicationStatus: concept.publicationStatus,
      },
      recommendedSequence: index + 1,
      stage: {
        id: stage.id,
        title: stage.title,
        order: stage.order,
        contentStatus: stage.contentStatus,
      },
      tracks: tracks.map((track) => ({
        id: track.id,
        title: track.title,
        order: track.order,
      })),
      prerequisites,
      dependents,
    } as const;
  });

  const stages = [...manifest.stages].sort(byOrderThenId).map((stage) => ({
    id: stage.id,
    title: stage.title,
    order: stage.order,
    contentStatus: stage.contentStatus,
    publishedConceptCount: concepts.filter(
      ({ stage: conceptStage }) => conceptStage.id === stage.id,
    ).length,
  }));
  const tracks = [...manifest.tracks].sort(byOrderThenId).map((track) => ({
    id: track.id,
    title: track.title,
    order: track.order,
    publishedConceptCount: concepts.filter(({ tracks: conceptTracks }) =>
      conceptTracks.some(({ id }) => id === track.id),
    ).length,
  }));

  return {
    concepts,
    stages,
    tracks,
    availableStageCount: stages.filter(
      ({ contentStatus }) => contentStatus === "available",
    ).length,
    plannedStageCount: stages.filter(
      ({ contentStatus }) => contentStatus === "planned",
    ).length,
  } as const;
}

export type KnowledgeView = ReturnType<typeof buildKnowledgeView>;
export type KnowledgeConceptView = KnowledgeView["concepts"][number];
export type KnowledgeConceptRelation =
  KnowledgeConceptView["prerequisites"][number];
