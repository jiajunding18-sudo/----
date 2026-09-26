import { describe, expect, it } from "vitest";

import {
  getConceptsForProject,
  getPublishedConceptBySlug,
  getPublishedConceptSlugs,
  getPublishedProjectBySlug,
  getStageZeroSlice,
} from "@/lib/content/site-content";

describe("网站只读内容接口", () => {
  it("按正式 order 返回 Stage 0 的八个已发布 Concept", () => {
    const slice = getStageZeroSlice();

    expect(slice.stage.id).toBe("stage.tooling-foundations");
    expect(slice.concepts).toHaveLength(8);
    expect(slice.concepts.map(({ order }) => order)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80,
    ]);
    expect(slice.project?.id).toBe("project.pixel-lab");
  });

  it("通过 canonical slug 读取 Concept 与 Project", () => {
    expect(getPublishedConceptBySlug("python-core")?.id).toBe(
      "tooling.python-core",
    );
    expect(getPublishedConceptBySlug("vectors-and-matrices")?.id).toBe(
      "math.vectors-matrices",
    );
    expect(getPublishedConceptBySlug("opencv-roi-masks")?.id).toBe(
      "opencv.roi-masks",
    );
    expect(
      getPublishedConceptBySlug("opencv-geometric-transforms")?.id,
    ).toBe("opencv.geometric-transforms");
    expect(getPublishedConceptBySlug("opencv-filtering-basics")?.id).toBe(
      "opencv.filtering-basics",
    );
    expect(
      getPublishedConceptBySlug("opencv-threshold-morphology")?.id,
    ).toBe("opencv.threshold-morphology");
    expect(getPublishedConceptBySlug("pipeline-batch-images")?.id).toBe(
      "pipeline.batch-images",
    );
    expect(getPublishedProjectBySlug("pixel-lab")?.id).toBe(
      "project.pixel-lab",
    );
    expect(getPublishedConceptBySlug("does-not-exist")).toBeUndefined();
  });

  it("静态参数和 Pixel Lab 知识要求均来自 manifest", () => {
    const slice = getStageZeroSlice();
    if (!slice.project) {
      throw new Error("测试需要已发布的 Pixel Lab");
    }

    expect(getPublishedConceptSlugs()).toHaveLength(41);
    expect(getConceptsForProject(slice.project)).toHaveLength(8);
  });
});
