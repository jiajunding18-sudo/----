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
    readonly contentStatus: ContentManifest["stages"][number]["contentStatus"];
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

export interface KnowledgeGraphData {
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
}

export type GlobalKnowledgeGraphScope =
  | { readonly kind: "stage"; readonly id: string }
  | { readonly kind: "track"; readonly id: string }
  | { readonly kind: "published" };

export interface GlobalKnowledgeGraphCatalog extends KnowledgeGraphData {
  readonly stages: readonly {
    readonly id: string;
    readonly title: string;
    readonly order: number;
    readonly contentStatus: ContentManifest["stages"][number]["contentStatus"];
    readonly conceptCount: number;
  }[];
  readonly tracks: readonly {
    readonly id: string;
    readonly title: string;
    readonly order: number;
    readonly conceptCount: number;
  }[];
  readonly defaultScope: GlobalKnowledgeGraphScope;
  readonly limits: {
    readonly maxNodes: number;
    readonly maxEdges: number;
  };
}

export interface GlobalKnowledgeGraphView extends KnowledgeGraphData {
  readonly scope: GlobalKnowledgeGraphScope;
  readonly scopeNodeCount: number;
  readonly scopeEdgeCount: number;
  readonly hiddenNodeCount: number;
  readonly hiddenEdgeCount: number;
  readonly density: {
    readonly status: "ready" | "too-dense";
    readonly maxNodes: number;
    readonly maxEdges: number;
  };
}

export interface GlobalKnowledgeGraphFilters {
  readonly scope: GlobalKnowledgeGraphScope;
  readonly dependencyKinds: ReadonlySet<DependencyKind>;
  readonly visibleConceptIds?: ReadonlySet<string>;
}

export const globalKnowledgeGraphLimits = {
  maxNodes: 24,
  maxEdges: 48,
} as const;

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
  currentConceptId?: string,
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

function toGraphEdge(
  dependency: ContentManifest["dependencies"][number],
): KnowledgeGraphEdge {
  return {
    id: createKnowledgeGraphEdgeId({
      kind: dependency.kind,
      prerequisiteId: dependency.prerequisiteId,
      targetId: dependency.targetId,
    }),
    source: dependency.prerequisiteId,
    target: dependency.targetId,
    kind: dependency.kind,
    rationale: dependency.rationale,
  };
}

export function buildGlobalKnowledgeGraphCatalog(
  manifest: ContentManifest,
): GlobalKnowledgeGraphCatalog {
  const concepts = [...manifest.concepts].toSorted((left, right) =>
    byConceptCatalogOrder(manifest, left, right),
  );
  const nodes = concepts.map((concept) => toGraphNode(manifest, concept));
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edges = manifest.dependencies
    .map((dependency) => {
      getRequiredConcept(
        manifest,
        dependency.prerequisiteId,
        `Dependency ${dependency.prerequisiteId} -> ${dependency.targetId}`,
      );
      getRequiredConcept(
        manifest,
        dependency.targetId,
        `Dependency ${dependency.prerequisiteId} -> ${dependency.targetId}`,
      );
      return toGraphEdge(dependency);
    })
    .toSorted((left, right) => left.id.localeCompare(right.id, "en"));
  const stages = [...manifest.stages].toSorted(byOrderThenId).map((stage) => ({
    id: stage.id,
    title: stage.title,
    order: stage.order,
    contentStatus: stage.contentStatus,
    conceptCount: nodes.filter((node) => node.stage.id === stage.id).length,
  }));
  const tracks = [...manifest.tracks].toSorted(byOrderThenId).map((track) => ({
    id: track.id,
    title: track.title,
    order: track.order,
    conceptCount: nodes.filter((node) =>
      node.tracks.some(({ id }) => id === track.id),
    ).length,
  }));
  const defaultStage = stages.find(
    ({ contentStatus, id }) =>
      contentStatus === "available" &&
      nodes.some(({ stage }) => stage.id === id),
  );

  if (nodeIds.size !== nodes.length) {
    throw new Error("Knowledge Graph 节点 ID 重复");
  }

  return {
    nodes,
    edges,
    stages,
    tracks,
    defaultScope: defaultStage
      ? { kind: "stage", id: defaultStage.id }
      : { kind: "published" },
    limits: globalKnowledgeGraphLimits,
  };
}

function isNodeInScope(
  node: KnowledgeGraphNode,
  scope: GlobalKnowledgeGraphScope,
) {
  if (scope.kind === "stage") return node.stage.id === scope.id;
  if (scope.kind === "track") {
    return node.tracks.some(({ id }) => id === scope.id);
  }
  return node.publicationStatus === "published";
}

export function selectGlobalKnowledgeGraphView(
  catalog: GlobalKnowledgeGraphCatalog,
  filters: GlobalKnowledgeGraphFilters,
): GlobalKnowledgeGraphView {
  const scopeNodes = catalog.nodes.filter((node) =>
    isNodeInScope(node, filters.scope),
  );
  const scopeNodeIds = new Set(scopeNodes.map(({ id }) => id));
  const scopeEdges = catalog.edges.filter(
    ({ source, target }) =>
      scopeNodeIds.has(source) && scopeNodeIds.has(target),
  );
  const nodes = filters.visibleConceptIds
    ? scopeNodes.filter(({ id }) => filters.visibleConceptIds?.has(id))
    : scopeNodes;
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edges = scopeEdges.filter(
    ({ kind, source, target }) =>
      filters.dependencyKinds.has(kind) &&
      nodeIds.has(source) &&
      nodeIds.has(target),
  );
  const tooDense =
    nodes.length > catalog.limits.maxNodes ||
    edges.length > catalog.limits.maxEdges;

  return {
    scope: filters.scope,
    nodes,
    edges,
    scopeNodeCount: scopeNodes.length,
    scopeEdgeCount: scopeEdges.length,
    hiddenNodeCount: scopeNodes.length - nodes.length,
    hiddenEdgeCount: scopeEdges.length - edges.length,
    density: {
      status: tooDense ? "too-dense" : "ready",
      maxNodes: catalog.limits.maxNodes,
      maxEdges: catalog.limits.maxEdges,
    },
  };
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
  const catalog = buildGlobalKnowledgeGraphCatalog(manifest);
  const baseCurrent = catalog.nodes.find(({ id }) => id === currentConceptId);
  if (!baseCurrent) {
    throw new Error(
      `Knowledge Graph current node 引用了不存在的 Concept ${currentConceptId}`,
    );
  }
  const neighborhoodDependencies = catalog.edges.filter(
    ({ source, target }) =>
      source === currentConceptId || target === currentConceptId,
  );
  const relatedIds = new Set<string>([currentConceptId]);

  for (const dependency of neighborhoodDependencies) {
    relatedIds.add(dependency.source);
    relatedIds.add(dependency.target);
  }

  const nodes = catalog.nodes
    .filter(({ id }) => relatedIds.has(id))
    .map((node) => ({ ...node, isCurrent: node.id === currentConceptId }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = neighborhoodDependencies;

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

  const current = nodesById.get(baseCurrent.id);
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
