import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import type { ContentManifest } from "@/lib/content";

const checkpointIdsInRouteOrder = [
  "stage.tooling-foundations",
  "stage.vision-math-immediate",
  "stage.vision-math-geometry-optimization",
  "stage.image-computing",
  "stage.digital-image-processing",
  "stage.imaging-foundations",
  "stage.industrial-imaging",
  "stage.imaging-quality-advanced",
  "stage.planar-vision",
  "stage.geometric-vision",
  "stage.depth-reconstruction",
  "stage.deep-learning-foundations",
  "stage.modern-vision-tasks",
  "stage.industrial-vision",
  "stage.industrial-3d",
  "stage.computational-imaging",
  "stage.capstone",
] as const;

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
  "pipeline.batch-images",
  "opencv.features-preview",
] as const;

function getStage(stageId: string): ContentManifest["stages"][number] {
  const stage = contentManifest.stages.find(({ id }) => id === stageId);
  if (!stage) {
    throw new Error(`测试需要的 checkpoint 不存在：${stageId}`);
  }
  return stage;
}

describe("Phase 2B-1 路线 catalog", () => {
  it("只使用 ROADMAP 固定的 3 个 Track，并保留高级主副修默认值", () => {
    expect(contentManifest.tracks).toHaveLength(3);
    expect(contentManifest.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "track.common",
          kind: "common",
          defaultGoal: "master",
        }),
        expect.objectContaining({
          id: "track.industrial-3d",
          kind: "advanced-branch",
          defaultGoal: "master",
          exclusiveMasteryGroup: "track-group.advanced-major",
        }),
        expect.objectContaining({
          id: "track.computational-imaging",
          kind: "advanced-branch",
          defaultGoal: "understand",
          exclusiveMasteryGroup: "track-group.advanced-major",
        }),
      ]),
    );
    expect(new Set(contentManifest.tracks.map(({ id }) => id)).size).toBe(3);
  });

  it("将 Stage 0–11 表达为 17 个唯一 checkpoint，而非线性 12 节课", () => {
    const stagesByRouteOrder = [...contentManifest.stages].sort(
      (left, right) => left.order - right.order,
    );

    expect(stagesByRouteOrder.map(({ id }) => id)).toEqual(
      checkpointIdsInRouteOrder,
    );
    expect(new Set(stagesByRouteOrder.map(({ id }) => id)).size).toBe(17);
    expect(new Set(stagesByRouteOrder.map(({ categoryOrder }) => categoryOrder))).toEqual(
      new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    );
  });

  it("保留 Stage 0、Stage 1 与 Stage 2 首批正式 Concept，其余 checkpoint 不产生已发布 Concept", () => {
    const stageZeroConcepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.tooling-foundations")
      .sort((left, right) => left.order - right.order);

    expect(stageZeroConcepts.map(({ id }) => id)).toEqual(stageZeroConceptIds);
    expect(stageZeroConcepts.every(({ publicationStatus }) => publicationStatus === "published"))
      .toBe(true);

    const stageOneAConcepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.vision-math-immediate")
      .sort((left, right) => left.order - right.order);

    expect(stageOneAConcepts.map(({ id }) => id)).toEqual(stageOneAConceptIds);
    expect(stageOneAConcepts.every(({ publicationStatus }) => publicationStatus === "published"))
      .toBe(true);

    const stageOneBConcepts = contentManifest.concepts
      .filter(
        ({ stageId }) =>
          stageId === "stage.vision-math-geometry-optimization",
      )
      .sort((left, right) => left.order - right.order);

    expect(stageOneBConcepts.map(({ id }) => id)).toEqual(stageOneBConceptIds);
    expect(stageOneBConcepts.every(({ publicationStatus }) => publicationStatus === "published"))
      .toBe(true);

    const stageTwoConcepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.image-computing")
      .sort((left, right) => left.order - right.order);

    expect(stageTwoConcepts.map(({ id }) => id)).toEqual(stageTwoConceptIds);
    expect(stageTwoConcepts.every(({ publicationStatus }) => publicationStatus === "published"))
      .toBe(true);
    expect(
      contentManifest.concepts.filter(
        ({ stageId }) =>
          stageId !== "stage.tooling-foundations" &&
          stageId !== "stage.vision-math-immediate" &&
          stageId !== "stage.vision-math-geometry-optimization" &&
          stageId !== "stage.image-computing" &&
          stageId !== "stage.digital-image-processing",
      ),
    ).toEqual([]);
    expect(getStage("stage.tooling-foundations").contentStatus).toBe(
      "available",
    );
    expect(
      contentManifest.stages
        .filter(
          ({ id }) =>
            id !== "stage.tooling-foundations" &&
            id !== "stage.vision-math-immediate" &&
            id !== "stage.vision-math-geometry-optimization" &&
            id !== "stage.image-computing" &&
            id !== "stage.digital-image-processing",
        )
        .every(({ contentStatus }) => contentStatus === "planned"),
    ).toBe(true);
    expect(getStage("stage.vision-math-immediate").contentStatus).toBe(
      "available",
    );
    expect(
      getStage("stage.vision-math-geometry-optimization").contentStatus,
    ).toBe("available");
    expect(getStage("stage.image-computing").contentStatus).toBe("available");
  });

  it("保留 ROADMAP 声明的非线性 entryGate 与高级方向 OR 门槛", () => {
    expect(
      getStage("stage.vision-math-geometry-optimization").entryGate,
    ).toBeUndefined();
    expect(getStage("stage.industrial-imaging").entryGate).toEqual({
      kind: "checkpoint",
      stageId: "stage.imaging-foundations",
    });
    expect(getStage("stage.imaging-quality-advanced").entryGate).toEqual({
      kind: "checkpoint",
      stageId: "stage.imaging-foundations",
    });
    expect(getStage("stage.planar-vision").entryGate).toEqual({
      kind: "checkpoint",
      stageId: "stage.imaging-foundations",
    });
    expect(getStage("stage.depth-reconstruction").entryGate).toEqual({
      kind: "checkpoint",
      stageId: "stage.geometric-vision",
    });
    expect(getStage("stage.modern-vision-tasks").entryGate).toEqual({
      kind: "checkpoint",
      stageId: "stage.deep-learning-foundations",
    });
    expect(getStage("stage.industrial-3d").entryGate).toEqual({
      kind: "allOf",
      gates: [
        { kind: "checkpoint", stageId: "stage.depth-reconstruction" },
        { kind: "checkpoint", stageId: "stage.industrial-vision" },
      ],
    });
    expect(getStage("stage.computational-imaging").entryGate).toEqual({
      kind: "checkpoint",
      stageId: "stage.imaging-quality-advanced",
    });

    const capstoneGate = getStage("stage.capstone").entryGate;
    expect(capstoneGate?.kind).toBe("allOf");
    if (capstoneGate?.kind !== "allOf") {
      throw new Error("Stage 11 根 entryGate 必须是 allOf");
    }
    expect(capstoneGate.gates.slice(0, 9)).toEqual([
      { kind: "checkpoint", stageId: "stage.tooling-foundations" },
      {
        kind: "checkpoint",
        stageId: "stage.vision-math-geometry-optimization",
      },
      { kind: "checkpoint", stageId: "stage.image-computing" },
      { kind: "checkpoint", stageId: "stage.digital-image-processing" },
      { kind: "checkpoint", stageId: "stage.industrial-imaging" },
      { kind: "checkpoint", stageId: "stage.planar-vision" },
      { kind: "checkpoint", stageId: "stage.depth-reconstruction" },
      { kind: "checkpoint", stageId: "stage.modern-vision-tasks" },
      { kind: "checkpoint", stageId: "stage.industrial-vision" },
    ]);
    expect(capstoneGate.gates[9]).toEqual({
      kind: "anyOf",
      gates: [
        {
          kind: "track-goal-checkpoint",
          stageId: "stage.industrial-3d",
          trackId: "track.industrial-3d",
          minimumTrackGoal: "master",
        },
        {
          kind: "track-goal-checkpoint",
          stageId: "stage.computational-imaging",
          trackId: "track.computational-imaging",
          minimumTrackGoal: "master",
        },
      ],
    });
  });

  it("所有项目门槛、Track 和出口 criterion 引用均唯一且可解析", () => {
    const trackIds = new Set(contentManifest.tracks.map(({ id }) => id));
    const projectIds = new Set(contentManifest.projects.map(({ id }) => id));
    const criterionIds = contentManifest.stages.flatMap(({ exitCriteria }) =>
      exitCriteria.map(({ id }) => id),
    );

    contentManifest.stages.forEach((stage) => {
      stage.trackIds.forEach((trackId) => expect(trackIds.has(trackId)).toBe(true));
      stage.projectGates.forEach(({ projectId }) =>
        expect(projectIds.has(projectId)).toBe(true),
      );
    });
    expect(new Set(criterionIds).size).toBe(criterionIds.length);
    expect(contentManifest.projects.filter(({ publicationStatus }) => publicationStatus === "published"))
      .toHaveLength(1);
    expect(contentManifest.projects.filter(({ publicationStatus }) => publicationStatus === "draft"))
      .toHaveLength(12);
  });

  it("项目门槛与 ROADMAP 的 checkpoint 表一致", () => {
    const projectGateIdsByCheckpoint = Object.fromEntries(
      contentManifest.stages.map((stage) => [
        stage.id,
        stage.projectGates.map(({ projectId }) => projectId),
      ]),
    );

    expect(projectGateIdsByCheckpoint).toEqual({
      "stage.capstone": ["project.capstone"],
      "stage.computational-imaging": ["project.optics-algorithm"],
      "stage.deep-learning-foundations": [],
      "stage.depth-reconstruction": ["project.pointcloud-measurement"],
      "stage.digital-image-processing": ["project.classical-inspection"],
      "stage.geometric-vision": [
        "project.calibrated-metrology",
        "project.stereo-or-pnp",
      ],
      "stage.image-computing": ["project.pixel-lab"],
      "stage.imaging-foundations": [],
      "stage.imaging-quality-advanced": [],
      "stage.industrial-3d": ["project.industrial-3d-system"],
      "stage.industrial-imaging": ["project.imaging-quality-lab"],
      "stage.industrial-vision": ["project.industrial-vision-system"],
      "stage.modern-vision-tasks": ["project.learning-defect-inspection"],
      "stage.planar-vision": ["project.planar-localization"],
      "stage.tooling-foundations": [],
      "stage.vision-math-geometry-optimization": ["project.math-vision-lab"],
      "stage.vision-math-immediate": [],
    });
  });
});
