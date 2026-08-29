import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import { buildKnowledgeNeighborhood } from "@/features/knowledge/knowledge-graph-model";
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
    ).toThrow("Knowledge Graph neighborhood for tooling.debugging 引用了不存在的 Concept tooling.missing");
  });
});
