import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import { buildRoadmapView } from "@/features/roadmap/roadmap-model";
import type { ContentManifest } from "@/lib/content";
import { stageDefinitionSchema } from "@/lib/validation";

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

describe("Roadmap manifest 派生视图", () => {
  it("按正式 Track 关系派生全局路线，并保留 entryGate 的 allOf / anyOf 语义", () => {
    const roadmap = buildRoadmapView(contentManifest);

    expect(roadmap.tracks.map(({ track }) => track.id)).toEqual([
      "track.common",
      "track.industrial-3d",
      "track.computational-imaging",
    ]);
    expect(roadmap.availableStages.map(({ stage }) => stage.id)).toEqual([
      "stage.tooling-foundations",
      "stage.vision-math-immediate",
      "stage.vision-math-geometry-optimization",
      "stage.image-computing",
    ]);
    expect(roadmap.plannedStageCount).toBe(13);
    expect(
      roadmap.tracks.find(({ track }) => track.id === "track.common")?.stages,
    ).toHaveLength(14);
    expect(
      roadmap.tracks.find(({ track }) => track.id === "track.industrial-3d")
        ?.stages.map(({ stage }) => stage.id),
    ).toEqual(["stage.industrial-3d", "stage.capstone"]);
    expect(
      roadmap.tracks.find(
        ({ track }) => track.id === "track.computational-imaging",
      )?.stages.map(({ stage }) => stage.id),
    ).toEqual([
      "stage.imaging-quality-advanced",
      "stage.computational-imaging",
      "stage.capstone",
    ]);

    const industrial3d = roadmap.stages.find(
      ({ stage }) => stage.id === "stage.industrial-3d",
    );
    const capstone = roadmap.stages.find(
      ({ stage }) => stage.id === "stage.capstone",
    );
    expect(industrial3d?.entryGate?.kind).toBe("allOf");
    expect(industrial3d?.entryGateSummary).toContain("全部满足");
    expect(capstone?.entryGate?.kind).toBe("allOf");
    expect(capstone?.entryGateSummary).toContain("满足其中一项");

    expect(roadmap.overview.stages).toHaveLength(17);
    expect(
      new Set(roadmap.overview.stages.map(({ id }) => id)).size,
    ).toBe(17);
    expect(roadmap.overview.tracks).toHaveLength(3);

    const industrial3dOverview = roadmap.overview.stages.find(
      ({ id }) => id === "stage.industrial-3d",
    );
    expect(industrial3dOverview?.entryGate?.kind).toBe("allOf");
    if (industrial3dOverview?.entryGate?.kind !== "allOf") {
      throw new Error("Stage 9 overview 缺少 allOf entryGate");
    }
    expect(
      industrial3dOverview.entryGate.gates.map((gate) =>
        gate.kind === "checkpoint" ? gate.stage.id : gate.kind,
      ),
    ).toEqual(["stage.depth-reconstruction", "stage.industrial-vision"]);
    expect(
      industrial3dOverview.entryGate.gates[0].kind === "checkpoint"
        ? industrial3dOverview.entryGate.gates[0].stage.primaryOutcome
        : undefined,
    ).toContain("深度");
  });

  it("为 available Stage 1B 派生正式 Concept、能力出口与 draft Project gate", () => {
    const roadmap = buildRoadmapView(contentManifest);
    const stageOneB = roadmap.overview.stages.find(
      ({ id }) => id === "stage.vision-math-geometry-optimization",
    );
    const stageTwo = roadmap.overview.stages.find(
      ({ id }) => id === "stage.image-computing",
    );

    expect(stageOneB?.contentStatus).toBe("available");
    expect(stageOneB?.conceptCount).toBe(5);
    expect(stageOneB?.outcomes).toHaveLength(2);
    expect(stageOneB?.exitCriteria).toHaveLength(2);
    expect(stageOneB?.retestAfterDays).toBe(7);
    expect(stageOneB?.projectGates).toEqual([
      expect.objectContaining({
        conditionSummary: "所有路线目标下都要求",
        project: expect.objectContaining({
          id: "project.math-vision-lab",
          publicationStatus: "draft",
        }),
      }),
    ]);
    expect(stageTwo?.projectGates[0].project).toEqual(
      expect.objectContaining({
        id: "project.pixel-lab",
        publicationStatus: "published",
      }),
    );
    expect(stageTwo).toMatchObject({
      contentStatus: "available",
      conceptCount: 12,
    });
  });

  it("从正式 manifest 派生 Stage 0、推荐顺序、依赖、项目和出口", () => {
    const roadmap = buildRoadmapView(contentManifest);
    const stageZero = roadmap.stages.find(
      ({ stage }) => stage.id === "stage.tooling-foundations",
    );
    if (!stageZero) {
      throw new Error("Roadmap 缺少 Stage 0");
    }

    expect(roadmap.stages).toHaveLength(17);
    expect(stageZero.stage.id).toBe("stage.tooling-foundations");
    expect(stageZero.concepts.map(({ concept }) => concept.id)).toEqual(
      stageZeroConceptIds,
    );
    expect(stageZero.concepts.map(({ concept }) => concept.order)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80,
    ]);

    const dependencyKinds = stageZero.concepts.flatMap(({ dependencies }) =>
      dependencies.map(({ dependency }) => dependency.kind),
    );
    expect(dependencyKinds.filter((kind) => kind === "hard")).toHaveLength(7);
    expect(
      dependencyKinds.filter((kind) => kind === "recommended"),
    ).toHaveLength(5);
    expect(
      stageZero.concepts
        .find(({ concept }) => concept.id === "tooling.reproducibility")
        ?.dependencies.map(({ prerequisite }) => prerequisite.id),
    ).toEqual([
      "tooling.python-modules",
      "tooling.git-basics",
      "tooling.debugging",
    ]);

    expect(stageZero.stage.projectGates).toEqual([]);
    expect(stageZero.projects.map(({ project }) => project.id)).toEqual([
      "project.pixel-lab",
    ]);
    expect(stageZero.projects[0].isStageGate).toBe(false);
    expect(stageZero.projects[0].requirements).toHaveLength(8);
    expect(stageZero.stage.exitCriteria).toHaveLength(5);
  });

  it("保留无已发布 Concept 的正式 Stage，并返回诚实空集合", () => {
    const emptyStage = stageDefinitionSchema.parse({
      ...contentManifest.stages[0],
      id: "stage.future-fixture",
      order: 1_000,
      title: "测试空 Stage",
      contentStatus: "planned",
    });
    const fixtureManifest = {
      ...contentManifest,
      stages: [...contentManifest.stages, emptyStage],
    } satisfies ContentManifest;

    const roadmap = buildRoadmapView(fixtureManifest);
    const futureStage = roadmap.stages.find(
      ({ stage }) => stage.id === emptyStage.id,
    );

    expect(futureStage).toBeDefined();
    expect(futureStage?.concepts).toEqual([]);
    expect(futureStage?.projects).toEqual([]);
  });
});
