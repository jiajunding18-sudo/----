import { getConceptById } from "@/lib/content/manifest-reader";
import type {
  ConceptManifestEntry,
  ContentManifest,
} from "@/lib/content/manifest-types";
import type { DependencyKind } from "@/types";

type ManifestConcept = ContentManifest["concepts"][number];

export interface KnowledgeGraphNode {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly stage: {
    readonly id: string;
    readonly title: string;
    readonly order: number;
    readonly contentStatus: "planned" | "available" | "complete";
  };
  readonly tracks: readonly {
    readonly id: string;
    readonly title: string;
    readonly order: number;
  }[];
  readonly order: number;
  readonly publicationStatus: ConceptManifestEntry["publicationStatus"];
  readonly href?: string;
  readonly isCurrent: boolean;
}

export interface KnowledgeGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: DependencyKind;
  readonly rationale: string;
}

export interface KnowledgeGraphRelation {
  readonly edge: KnowledgeGraphEdge;
  readonly concept: KnowledgeGraphNode;
}

export interface KnowledgeNeighborhood {
  readonly current: KnowledgeGraphNode;
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
  readonly prerequisites: readonly KnowledgeGraphRelation[];
  readonly dependents: readonly KnowledgeGraphRelation[];
  readonly hopCount: 1;
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

function getRequiredStage(manifest: ContentManifest, stageId: string) {
  const stage = manifest.stages.find(({ id }) => id === stageId);
  if (!stage) {
    throw new Error(`Knowledge Graph 引用了不存在的 Stage ${stageId}`);
  }
  return stage;
}

function getRequiredTrack(manifest: ContentManifest, trackId: string) {
  const track = manifest.tracks.find(({ id }) => id === trackId);
  if (!track) {
    throw new Error(`Knowledge Graph 引用了不存在的 Track ${trackId}`);
  }
  return track;
}

function byOrderThenId<Ordered extends { readonly id: string; readonly order: number }>(
  left: Ordered,
  right: Ordered,
) {
  return left.order - right.order || left.id.localeCompare(right.id, "en");
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

function toGraphNode(
  manifest: ContentManifest,
  concept: ManifestConcept,
  currentConceptId: string,
): KnowledgeGraphNode {
  const stage = getRequiredStage(manifest, concept.stageId);
  const tracks = concept.trackIds
    .map((trackId) => getRequiredTrack(manifest, trackId))
    .toSorted(byOrderThenId);

  return {
    id: concept.id,
    title: concept.title,
    slug: concept.slug,
    stage: {
      id: stage.id,
      title: stage.title,
      order: stage.order,
      contentStatus: stage.contentStatus,
    },
    tracks: tracks.map(({ id, order, title }) => ({ id, order, title })),
    order: concept.order,
    publicationStatus: concept.publicationStatus,
    href:
      concept.publicationStatus === "published"
        ? `/knowledge/${concept.slug}/`
        : undefined,
    isCurrent: concept.id === currentConceptId,
  };
}

export function createKnowledgeGraphEdgeId({
  kind,
  prerequisiteId,
  targetId,
}: {
  readonly prerequisiteId: string;
  readonly targetId: string;
  readonly kind: DependencyKind;
}) {
  return `${prerequisiteId}->${targetId}:${kind}`;
}

/**
 * Builds the read-only, direct neighborhood around one formal Concept.
 * Authoring stays in ConceptMeta.dependencies; downstream relationships are
 * derived exclusively from the normalized manifest dependency list.
 */
export function buildKnowledgeNeighborhood(
  manifest: ContentManifest,
  currentConceptId: string,
): KnowledgeNeighborhood {
  getRequiredConcept(
    manifest,
    currentConceptId,
    "Knowledge Graph current node",
  );
  const neighborhoodDependencies = manifest.dependencies.filter(
    ({ prerequisiteId, targetId }) =>
      prerequisiteId === currentConceptId || targetId === currentConceptId,
  );
  const relatedIds = new Set<string>([currentConceptId]);

  for (const dependency of neighborhoodDependencies) {
    relatedIds.add(dependency.prerequisiteId);
    relatedIds.add(dependency.targetId);
  }

  const concepts = [...relatedIds]
    .map((conceptId) =>
      getRequiredConcept(
        manifest,
        conceptId,
        `Knowledge Graph neighborhood for ${currentConceptId}`,
      ),
    )
    .toSorted((left, right) => byConceptCatalogOrder(manifest, left, right));
  const nodes = concepts.map((concept) =>
    toGraphNode(manifest, concept, currentConceptId),
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = neighborhoodDependencies
    .map(
      ({ kind, prerequisiteId, rationale, targetId }): KnowledgeGraphEdge => ({
        id: createKnowledgeGraphEdgeId({ kind, prerequisiteId, targetId }),
        source: prerequisiteId,
        target: targetId,
        kind,
        rationale,
      }),
    )
    .toSorted((left, right) => left.id.localeCompare(right.id, "en"));

  const toRelation = (
    edge: KnowledgeGraphEdge,
    relatedConceptId: string,
  ): KnowledgeGraphRelation => {
    const concept = nodesById.get(relatedConceptId);
    if (!concept) {
      throw new Error(`Knowledge Graph edge ${edge.id} 缺少邻域节点 ${relatedConceptId}`);
    }
    return { edge, concept };
  };
  const byRelation = (
    left: KnowledgeGraphRelation,
    right: KnowledgeGraphRelation,
  ) => {
    const kindOrder = (kind: DependencyKind) => (kind === "hard" ? 0 : 1);
    return (
      kindOrder(left.edge.kind) - kindOrder(right.edge.kind) ||
      left.concept.stage.order - right.concept.stage.order ||
      left.concept.order - right.concept.order ||
      left.concept.id.localeCompare(right.concept.id, "en")
    );
  };

  const current = nodesById.get(currentConceptId);
  if (!current) {
    throw new Error(`Knowledge Graph 缺少 current node ${currentConceptId}`);
  }

  return {
    current,
    nodes,
    edges,
    prerequisites: edges
      .filter(({ target }) => target === currentConceptId)
      .map((edge) => toRelation(edge, edge.source))
      .toSorted(byRelation),
    dependents: edges
      .filter(({ source }) => source === currentConceptId)
      .map((edge) => toRelation(edge, edge.target))
      .toSorted(byRelation),
    hopCount: 1,
  };
}
