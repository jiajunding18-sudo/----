import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import { buildKnowledgeView } from "@/features/knowledge/knowledge-model";
import type { ContentManifest } from "@/lib/content";

const stageZeroConceptIds = [
  "tooling.computer-files",
  "tooling.dev-environment",
  "tooling.python-core",
  "tooling.python-modules",
  "tooling.git-basics",
  "tooling.debugging",
  "tooling.linux-basics",
  "tooling.reproducibility",
] as const;

const stageOneAConceptIds = [
  "math.vectors-matrices",
  "math.linear-transforms",
  "math.calculus-gradients",
  "math.probability-statistics",
] as const;

const stageOneBConceptIds = [
  "math.coordinate-frames",
  "math.least-squares",
  "math.eigen-svd",
  "math.optimization",
  "math.numerical-stability",
] as const;

const stageTwoConceptIds = [
  "python.numpy-arrays",
  "python.numpy-dtypes",
  "image.digital-representation",
  "visualization.image-plots",
  "opencv.io-color",
  "opencv.roi-masks",
  "opencv.geometric-transforms",
  "opencv.filtering-basics",
  "opencv.threshold-morphology",
  "opencv.edges-contours",
] as const;

describe("Knowledge manifest 派生视图", () => {
  it("只纳入已发布 Concept，并按正式 Stage / Concept order 返回推荐序位", () => {
    const knowledge = buildKnowledgeView(contentManifest);

    expect(knowledge.concepts.map(({ concept }) => concept.id)).toEqual(
      [
        ...stageZeroConceptIds,
        ...stageOneAConceptIds,
        ...stageOneBConceptIds,
        ...stageTwoConceptIds,
      ],
    );
    expect(knowledge.concepts.map(({ recommendedSequence }) => recommendedSequence)).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 1),
    );
    expect(
      knowledge.concepts.every(
        ({ concept }) => concept.publicationStatus === "published",
      ),
    ).toBe(true);
  });

  it("从 catalog 派生全部 Stage / Track 筛选项并诚实保留 planned 覆盖", () => {
    const knowledge = buildKnowledgeView(contentManifest);
    const stageZero = knowledge.stages.find(
      ({ id }) => id === "stage.tooling-foundations",
    );
    const stageTwo = knowledge.stages.find(
      ({ id }) => id === "stage.image-computing",
    );
    const stageOneA = knowledge.stages.find(
      ({ id }) => id === "stage.vision-math-immediate",
    );
    const stageOneB = knowledge.stages.find(
      ({ id }) => id === "stage.vision-math-geometry-optimization",
    );

    expect(knowledge.stages).toHaveLength(17);
    expect(knowledge.tracks.map(({ id }) => id)).toEqual([
      "track.common",
      "track.industrial-3d",
      "track.computational-imaging",
    ]);
    expect(stageZero).toMatchObject({
      contentStatus: "available",
      publishedConceptCount: 8,
    });
    expect(stageOneA).toMatchObject({
      contentStatus: "available",
      publishedConceptCount: 4,
    });
    expect(stageOneB).toMatchObject({
      contentStatus: "available",
      publishedConceptCount: 5,
    });
    expect(stageTwo).toMatchObject({
      contentStatus: "available",
      publishedConceptCount: 10,
    });
    expect(knowledge.availableStageCount).toBe(4);
    expect(knowledge.plannedStageCount).toBe(13);
    expect(knowledge.tracks.map(({ publishedConceptCount }) => publishedConceptCount)).toEqual([
      27, 0, 0,
    ]);
  });

  it("区分 hard / recommended 前置，并从同一 dependency 数据派生后续 Concept", () => {
    const knowledge = buildKnowledgeView(contentManifest);
    const reproducibility = knowledge.concepts.find(
      ({ concept }) => concept.id === "tooling.reproducibility",
    );
    const pythonCore = knowledge.concepts.find(
      ({ concept }) => concept.id === "tooling.python-core",
    );

    expect(
      reproducibility?.prerequisites.map(({ concept, kind }) => [
        concept.id,
        kind,
      ]),
    ).toEqual([
      ["tooling.python-modules", "hard"],
      ["tooling.git-basics", "hard"],
      ["tooling.debugging", "recommended"],
    ]);
    expect(
      pythonCore?.prerequisites.map(({ concept, kind }) => [concept.id, kind]),
    ).toEqual([["tooling.computer-files", "recommended"]]);
    expect(
      pythonCore?.dependents.map(({ concept, kind }) => [concept.id, kind]),
    ).toEqual([
      ["tooling.python-modules", "hard"],
      ["tooling.debugging", "hard"],
      ["math.vectors-matrices", "hard"],
      ["math.calculus-gradients", "hard"],
      ["math.probability-statistics", "hard"],
      ["python.numpy-arrays", "hard"],
      ["tooling.dev-environment", "recommended"],
    ]);
  });

  it("依赖引用损坏时拒绝生成 Knowledge 视图", () => {
    const invalidManifest = {
      ...contentManifest,
      dependencies: [
        ...contentManifest.dependencies,
        {
          prerequisiteId: "tooling.missing",
          targetId: "tooling.python-core",
          kind: "hard",
          rationale: "测试坏引用",
        },
      ],
    } satisfies ContentManifest;

    expect(() => buildKnowledgeView(invalidManifest)).toThrow(
      "Dependency tooling.missing -> tooling.python-core 引用了不存在的 Concept tooling.missing",
    );
  });
});
