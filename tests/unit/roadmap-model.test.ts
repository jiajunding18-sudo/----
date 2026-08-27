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
  it("从正式 manifest 派生 Stage 0、推荐顺序、依赖、项目和出口", () => {
    const roadmap = buildRoadmapView(contentManifest);
    const stageZero = roadmap.stages[0];

    expect(roadmap.stages).toHaveLength(1);
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
      order: 100,
      title: "测试空 Stage",
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
