import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import {
  buildGlobalKnowledgeGraphCatalog,
  buildKnowledgeNeighborhood,
  selectGlobalKnowledgeGraphView,
  type GlobalKnowledgeGraphCatalog,
} from "@/features/knowledge/knowledge-graph-model";
import type { ContentManifest } from "@/lib/content";

describe("Knowledge Graph 一跳邻域模型", () => {
  it("只从正式 dependency DAG 派生当前、前置和直接后续，方向为前置到后续", () => {
    const neighborhood = buildKnowledgeNeighborhood(
      contentManifest,
      "tooling.debugging",
    );

    expect(neighborhood.hopCount).toBe(1);
    expect(neighborhood.current).toMatchObject({
      id: "tooling.debugging",
      isCurrent: true,
      publicationStatus: "published",
      stage: { id: "stage.tooling-foundations" },
      tracks: [{ id: "track.common" }],
    });
    expect(
      neighborhood.prerequisites.map(({ concept, edge }) => [
        concept.id,
        edge.kind,
        edge.source,
        edge.target,
      ]),
    ).toEqual([
      [
        "tooling.python-core",
        "hard",
        "tooling.python-core",
        "tooling.debugging",
      ],
      [
        "tooling.dev-environment",
        "recommended",
        "tooling.dev-environment",
        "tooling.debugging",
      ],
    ]);
    expect(
      neighborhood.dependents.map(({ concept, edge }) => [
        concept.id,
        edge.kind,
        edge.source,
        edge.target,
      ]),
    ).toEqual([
      [
        "tooling.reproducibility",
        "recommended",
        "tooling.debugging",
        "tooling.reproducibility",
      ],
      [
        "python.numpy-arrays",
        "recommended",
        "tooling.debugging",
        "python.numpy-arrays",
      ],
    ]);
  });

  it("节点去重，图边与等价前置/后续列表使用完全相同的 edge ID", () => {
    const neighborhood = buildKnowledgeNeighborhood(
      contentManifest,
      "tooling.python-core",
    );
    const nodeIds = neighborhood.nodes.map(({ id }) => id);
    const graphEdgeIds = neighborhood.edges.map(({ id }) => id).toSorted();
    const listEdgeIds = [
      ...neighborhood.prerequisites,
      ...neighborhood.dependents,
    ]
      .map(({ edge }) => edge.id)
      .toSorted();

    expect(nodeIds).toHaveLength(new Set(nodeIds).size);
    expect(graphEdgeIds).toEqual(listEdgeIds);
    expect(graphEdgeIds).toEqual([
      "tooling.computer-files->tooling.python-core:recommended",
      "tooling.python-core->math.calculus-gradients:hard",
      "tooling.python-core->math.probability-statistics:hard",
      "tooling.python-core->math.vectors-matrices:hard",
      "tooling.python-core->python.numpy-arrays:hard",
      "tooling.python-core->tooling.debugging:hard",
      "tooling.python-core->tooling.dev-environment:recommended",
      "tooling.python-core->tooling.python-modules:hard",
    ]);
  });

  it("非 published 正式实体只作为路线节点，不生成可点击学习页面", () => {
    const concepts = contentManifest.concepts.map((concept) =>
      concept.id === "tooling.debugging"
        ? { ...concept, publicationStatus: "draft" as const }
        : concept,
    );
    const manifest = { ...contentManifest, concepts } satisfies ContentManifest;
    const neighborhood = buildKnowledgeNeighborhood(
      manifest,
      "tooling.reproducibility",
    );
    const draftRelation = neighborhood.prerequisites.find(
      ({ concept }) => concept.id === "tooling.debugging",
    );

    expect(draftRelation?.concept).toMatchObject({
      publicationStatus: "draft",
      href: undefined,
    });
  });

  it("坏节点引用不会被图层静默忽略", () => {
    const manifest = {
      ...contentManifest,
      dependencies: [
        ...contentManifest.dependencies,
        {
          prerequisiteId: "tooling.missing",
          targetId: "tooling.debugging",
          kind: "hard",
          rationale: "测试坏引用",
        },
      ],
    } satisfies ContentManifest;

    expect(() =>
      buildKnowledgeNeighborhood(manifest, "tooling.debugging"),
    ).toThrow(
      "Dependency tooling.missing -> tooling.debugging 引用了不存在的 Concept tooling.missing",
    );
  });
});

describe("Knowledge Graph 全局 scope 与密度模型", () => {
  const allKinds = new Set(["hard", "recommended"] as const);

  it("从同一正式 manifest 派生 Stage、Track 与 published scope", () => {
    const catalog = buildGlobalKnowledgeGraphCatalog(contentManifest);
    const stageView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "stage", id: "stage.tooling-foundations" },
      dependencyKinds: allKinds,
    });
    const commonTrackView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "track", id: "track.common" },
      dependencyKinds: allKinds,
    });
    const stageOneAView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "stage", id: "stage.vision-math-immediate" },
      dependencyKinds: allKinds,
    });
    const advancedTrackView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "track", id: "track.industrial-3d" },
      dependencyKinds: allKinds,
    });
    const stageTwoView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "stage", id: "stage.image-computing" },
      dependencyKinds: allKinds,
    });
    const publishedView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "published" },
      dependencyKinds: allKinds,
    });

    expect(catalog.defaultScope).toEqual({
      kind: "stage",
      id: "stage.tooling-foundations",
    });
    expect(stageView.nodes).toHaveLength(8);
    expect(stageView.edges).toHaveLength(12);
    expect(stageOneAView.nodes).toHaveLength(4);
    expect(stageOneAView.edges).toHaveLength(2);
    expect(commonTrackView.nodes).toHaveLength(22);
    expect(advancedTrackView.nodes).toEqual([]);
    expect(stageTwoView.nodes).toHaveLength(5);
    expect(stageTwoView.edges).toHaveLength(5);
    expect(publishedView.nodes).toHaveLength(22);
    expect(new Set(publishedView.nodes.map(({ id }) => id)).size).toBe(22);
  });

  it("dependency kind 与 Progress 筛选只改变视图，不修改正式依赖", () => {
    const catalog = buildGlobalKnowledgeGraphCatalog(contentManifest);
    const originalEdgeIds = catalog.edges.map(({ id }) => id);
    const hardView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "stage", id: "stage.tooling-foundations" },
      dependencyKinds: new Set(["hard"]),
    });
    const learningView = selectGlobalKnowledgeGraphView(catalog, {
      scope: { kind: "stage", id: "stage.tooling-foundations" },
      dependencyKinds: allKinds,
      visibleConceptIds: new Set([
        "tooling.python-core",
        "tooling.debugging",
      ]),
    });

    expect(hardView.edges).toHaveLength(7);
    expect(hardView.edges.every(({ kind }) => kind === "hard")).toBe(true);
    expect(learningView.nodes.map(({ id }) => id)).toEqual([
      "tooling.python-core",
      "tooling.debugging",
    ]);
    expect(learningView.edges).toMatchObject([
      {
        source: "tooling.python-core",
        target: "tooling.debugging",
        kind: "hard",
      },
    ]);
    expect(catalog.edges.map(({ id }) => id)).toEqual(originalEdgeIds);
  });

  it("非 published 节点不生成学习链接，全局图不会把 planned 伪装成正文", () => {
    const concepts = contentManifest.concepts.map((concept) =>
      concept.id === "tooling.debugging"
        ? { ...concept, publicationStatus: "draft" as const }
        : concept,
    );
    const manifest = { ...contentManifest, concepts } satisfies ContentManifest;
    const catalog = buildGlobalKnowledgeGraphCatalog(manifest);

    expect(
      catalog.nodes.find(({ id }) => id === "tooling.debugging"),
    ).toMatchObject({ publicationStatus: "draft", href: undefined });
  });

  it("超过节点上限时保留完整选择结果并拒绝渲染画布，不随机抽样", () => {
    const baseCatalog = buildGlobalKnowledgeGraphCatalog(contentManifest);
    const baseNode = baseCatalog.nodes[0];
    if (!baseNode) throw new Error("测试 manifest 缺少 Concept");
    const denseCatalog: GlobalKnowledgeGraphCatalog = {
      ...baseCatalog,
      nodes: Array.from({ length: 25 }, (_, index) => ({
        ...baseNode,
        id: `test.concept-${index}`,
        slug: `test-concept-${index}`,
      })),
      edges: [],
    };
    const view = selectGlobalKnowledgeGraphView(denseCatalog, {
      scope: { kind: "published" },
      dependencyKinds: allKinds,
    });

    expect(view.density.status).toBe("too-dense");
    expect(view.nodes).toHaveLength(25);
    expect(new Set(view.nodes.map(({ id }) => id)).size).toBe(25);
  });
});
