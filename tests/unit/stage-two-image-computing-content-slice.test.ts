import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import { buildGlobalKnowledgeGraphCatalog } from "@/features/knowledge/knowledge-graph-model";
import { buildKnowledgeView } from "@/features/knowledge/knowledge-model";
import {
  getConceptReadiness,
  getConceptStatus,
  getRouteRequiredStatus,
  startConcept,
} from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { buildRoadmapView } from "@/features/roadmap/roadmap-model";
import { loadMdxDirectory } from "@/lib/content";
import { createInitialLearningState } from "@/lib/storage";
import { conceptMetaSchema } from "@/lib/validation";

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

const stageTwoConceptIdSet = new Set<string>(stageTwoConceptIds);

const unpublishedFutureConceptIds = [
  "dip.feature-representation",
  "cv.corners-keypoints",
  "cv.local-descriptors",
  "cv.feature-matching",
] as const;

const expectedDependencies = [
  ["tooling.dev-environment", "python.numpy-arrays", "hard"],
  ["tooling.python-core", "python.numpy-arrays", "hard"],
  ["math.vectors-matrices", "python.numpy-arrays", "hard"],
  ["tooling.debugging", "python.numpy-arrays", "recommended"],
  ["python.numpy-arrays", "python.numpy-dtypes", "hard"],
  ["python.numpy-arrays", "image.digital-representation", "hard"],
  ["math.coordinate-frames", "image.digital-representation", "recommended"],
  ["python.numpy-arrays", "visualization.image-plots", "hard"],
  ["image.digital-representation", "opencv.io-color", "hard"],
  ["tooling.python-modules", "opencv.io-color", "hard"],
  ["visualization.image-plots", "opencv.io-color", "recommended"],
  ["python.numpy-arrays", "opencv.roi-masks", "hard"],
  ["opencv.io-color", "opencv.roi-masks", "hard"],
  ["math.linear-transforms", "opencv.geometric-transforms", "hard"],
  ["opencv.io-color", "opencv.geometric-transforms", "hard"],
  ["math.coordinate-frames", "opencv.geometric-transforms", "recommended"],
  ["python.numpy-arrays", "opencv.filtering-basics", "hard"],
  ["opencv.io-color", "opencv.filtering-basics", "hard"],
  ["opencv.io-color", "opencv.threshold-morphology", "hard"],
  ["opencv.roi-masks", "opencv.threshold-morphology", "hard"],
  ["opencv.filtering-basics", "opencv.edges-contours", "hard"],
  ["opencv.threshold-morphology", "opencv.edges-contours", "hard"],
  ["tooling.reproducibility", "pipeline.batch-images", "hard"],
  ["opencv.edges-contours", "pipeline.batch-images", "hard"],
  ["tooling.debugging", "pipeline.batch-images", "recommended"],
  ["opencv.edges-contours", "opencv.features-preview", "hard"],
] as const;

const requiredSectionHeadings = [
  "## 1. 这是什么",
  "## 2. 为什么机器视觉需要它",
  "## 3. 前置知识",
  "## 4. 核心概念",
  "## 5. 初学者直觉解释",
  "## 6. 必须掌握到什么程度",
  "## 7. 常见误区",
  "## 8. Worked Example",
  "## 9. Active Recall",
  "## 10. Practice",
  "## 11. 实际使用：Project / Capability / Application 映射",
  "## 12. Mastery Evidence",
  "## 13. 后续复用与复习",
  "## 14. 精选学习资源",
] as const;

async function loadStageTwoConcepts() {
  const workspaceRoot = process.cwd();
  const directories = ["programming", "image-processing"];
  const concepts = (
    await Promise.all(
      directories.map((directory) =>
        loadMdxDirectory({
          directoryPath: resolve(
            workspaceRoot,
            "content/concepts",
            directory,
          ),
          workspaceRoot,
          schema: conceptMetaSchema,
        }),
      ),
    )
  ).flat();

  return concepts.filter(({ meta }) => stageTwoConceptIdSet.has(meta.id));
}

describe("Phase 9D Stage 2 图像计算基础与 OpenCV 实验", () => {
  it("发布十二个 required Concept（十一 M、一 U），并将 checkpoint 保持 available", () => {
    const concepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.image-computing")
      .toSorted((left, right) => left.order - right.order);
    const stage = contentManifest.stages.find(
      ({ id }) => id === "stage.image-computing",
    );

    expect(concepts.map(({ id }) => id)).toEqual(stageTwoConceptIds);
    expect(concepts.map(({ order }) => order)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
    ]);
    expect(
      concepts.every(
        ({ id, publicationStatus, requiredness, targetDepth, trackIds }) =>
          publicationStatus === "published" &&
          requiredness === "required" &&
          targetDepth === (id === "opencv.features-preview" ? "understand" : "master") &&
          trackIds.includes("track.common"),
      ),
    ).toBe(true);
    expect(stage).toMatchObject({ contentStatus: "available" });
    expect(stage && "entryGate" in stage ? stage.entryGate : undefined).toBeUndefined();
    expect(stage?.exitCriteria).toHaveLength(2);
    expect(stage && "retestAfterDays" in stage ? stage.retestAfterDays : undefined).toBe(7);

    unpublishedFutureConceptIds.forEach((conceptId) => {
      expect(contentManifest.concepts.map(({ id }) => String(id))).not.toContain(
        conceptId,
      );
    });
    expect(contentManifest.concepts.map(({ id }) => String(id))).not.toContain(
      "math.lie-groups",
    );
  });

  it("依赖与 ROADMAP 一致，不强制串行 U2 节点", () => {
    const dependencies = contentManifest.dependencies.filter(({ targetId }) =>
      stageTwoConceptIdSet.has(targetId),
    );

    expect(
      dependencies.map(({ prerequisiteId, targetId, kind }) => [
        prerequisiteId,
        targetId,
        kind,
      ]),
    ).toEqual(expect.arrayContaining([...expectedDependencies]));
    expect(dependencies).toHaveLength(expectedDependencies.length);
    expect(dependencies.filter(({ kind }) => kind === "hard")).toHaveLength(21);
    expect(dependencies.filter(({ kind }) => kind === "recommended")).toHaveLength(5);
    const dependencyPairs = dependencies.map(
      ({ prerequisiteId, targetId }) => `${String(prerequisiteId)}->${String(targetId)}`,
    );
    expect(dependencyPairs).not.toContain(
      "image.digital-representation->visualization.image-plots",
    );
    expect(dependencyPairs).not.toContain(
      "visualization.image-plots->image.digital-representation",
    );
  });

  it("opencv.io-color 保持正式依赖、master 边界与完整教学闭环", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(({ meta }) => meta.id === "opencv.io-color");

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      resourceIds: ["resource.opencv-python-tutorials"],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({
        conceptId: "image.digital-representation",
        kind: "hard",
      }),
      expect.objectContaining({
        conceptId: "tooling.python-modules",
        kind: "hard",
      }),
      expect.objectContaining({
        conceptId: "visualization.image-plots",
        kind: "recommended",
      }),
    ]);
    expect(concept?.meta.dependencies.map(({ conceptId }) => conceptId)).not.toContain(
      "python.numpy-dtypes",
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(concept?.body, `opencv.io-color 缺少 ${heading}`).toContain(heading);
    });
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.body).toContain("resolve path");
    expect(concept?.body).toContain("if image is None:");
    expect(concept?.body).toContain("cv2.COLOR_BGR2RGB");
    expect(concept?.body).toContain("assert bgr[0, 0].tolist() == [0, 0, 255]");
    expect(concept?.body).toContain("assert rgb[0, 0].tolist() == [255, 0, 0]");
    expect(concept?.body).toContain("cv2.IMREAD_GRAYSCALE");
    expect(concept?.body).toContain("cv2.IMREAD_UNCHANGED");
    expect(concept?.body).toContain("write_succeeded = cv2.imwrite");
    expect(concept?.body).toContain("np.array_equal(reloaded, bgr)");
    expect(concept?.body).toContain("JPEG 等有损格式");
    expect(concept?.body).toContain("PPM 不是本篇要掌握的文件格式");
    expect(concept?.body).toContain("actual_min = image.min().item()");
    expect(concept?.body).toContain("actual_max = image.max().item()");
    expect(concept?.body).not.toContain("int(image.min())");
    expect(concept?.body).not.toContain("int(image.max())");
    expect(concept?.body).toContain(
      "float_image = np.array([[0.1, 0.4], [0.7, 0.9]], dtype=np.float32)",
    );
    expect(concept?.body).toContain("dtype=uint8");
    expect(concept?.body).toContain("actual min/max");
    expect(concept?.body).toContain("不透明度、透明程度或覆盖程度");
    expect(concept?.body).toContain("不能武断断言任意四通道数组一定是 BGRA");
    expect(concept?.body).toContain("它不是 H×W×3 且三个颜色通道机械相等");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain('inspect_image("reloaded BGR", reloaded)');
    expect(concept?.body).toContain("自选图片诊断卡");
    expect(concept?.body).toContain("普通照片不要求提供预先已知的像素真值");
    expect(concept?.meta.masteryCriteria[0]).toMatchObject({
      required: true,
      description: expect.stringContaining("仓库 fixture"),
      evidenceHint: expect.stringContaining("自选图片"),
    });
  });

  it("opencv.roi-masks 保持两条 hard dependency、master 边界与完整教学支架", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(({ meta }) => meta.id === "opencv.roi-masks");

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      estimatedHours: { min: 4, max: 5 },
      resourceIds: [
        "resource.numpy-absolute-beginners",
        "resource.opencv-python-tutorials",
      ],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({
        conceptId: "python.numpy-arrays",
        kind: "hard",
      }),
      expect.objectContaining({
        conceptId: "opencv.io-color",
        kind: "hard",
      }),
    ]);
    expect(concept?.meta.dependencies).toHaveLength(2);
    expect(concept?.meta.dependencies.map(({ conceptId }) => conceptId)).not.toEqual(
      expect.arrayContaining([
        "python.numpy-dtypes",
        "image.digital-representation",
        "visualization.image-plots",
      ]),
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(concept?.body, `opencv.roi-masks 缺少 ${heading}`).toContain(heading);
    });
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.body).toContain("image[y1:y2, x1:x2]");
    expect(concept?.body).toContain("0 <= x1 < x2 <= width");
    expect(concept?.body).toContain("roi.size == 0");
    expect(concept?.body).toContain("np.shares_memory(working, roi_view)");
    expect(concept?.body).toContain("not np.shares_memory(working, roi_copy)");
    expect(concept?.body).toContain("assert np.array_equal(source, original)");
    expect(concept?.body).toContain(
      "NumPy `ndarray` 不会因为变量名叫 `source` 就自动变成只读",
    );
    expect(concept?.body).toContain(
      "它不是 NumPy 提供的 write protection",
    );
    ["`source`", "`original`", "`working`", "`result`"].forEach((role) => {
      expect(concept?.body).toContain(role);
    });
    expect(concept?.body).toContain("assert mask.shape == source.shape[:2]");
    expect(concept?.body).toContain("assert mask.dtype == np.bool_");
    expect(concept?.body).toContain("image.shape == (H, W, C)");
    expect(concept?.body).toContain("selected.shape == (N, C)");
    expect(concept?.body).toContain("selected_color.shape == (true_count, 3)");
    expect(concept?.body).toContain("selected_gray.shape == (true_count,)");
    expect(concept?.body).toContain("masked_result[~mask] = 0");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain("### Checkpoint 4");
    expect(concept?.body).toContain("silent clipping");
    expect(concept?.body).toContain("mask shape mismatch");
    expect(concept?.body?.match(/report_diagnosis\(/gu)).toHaveLength(5);
    ["input:", "expected:", "actual:", "reason:", "correction:"].forEach(
      (field) => {
        expect(concept?.body).toContain(field);
      },
    );
    expect(concept?.body).toContain(
      "expected/actual shape 都含 0 也不能算成功",
    );
    expect(concept?.body).toContain("cv2.COLOR_BGR2RGB");
    expect(concept?.meta.masteryCriteria[0]?.evidenceHint).toContain(
      "input、expected、actual、reason、correction",
    );
    expect(concept?.meta.masteryCriteria[1]?.evidenceHint).toContain(
      "input、expected、actual、reason、correction",
    );
  });

  it("opencv.geometric-transforms 保持正式依赖、master 边界与坐标验证闭环", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(
      ({ meta }) => meta.id === "opencv.geometric-transforms",
    );

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      estimatedHours: { min: 6, max: 8 },
      resourceIds: ["resource.opencv-python-tutorials"],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({
        conceptId: "math.linear-transforms",
        kind: "hard",
      }),
      expect.objectContaining({ conceptId: "opencv.io-color", kind: "hard" }),
      expect.objectContaining({
        conceptId: "math.coordinate-frames",
        kind: "recommended",
      }),
    ]);
    expect(concept?.meta.dependencies.map(({ conceptId }) => conceptId)).not.toContain(
      "opencv.roi-masks",
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(
        concept?.body,
        `opencv.geometric-transforms 缺少 ${heading}`,
      ).toContain(heading);
    });
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria.every(({ required }) => required)).toBe(
      true,
    );
    expect(concept?.body).toContain("矩阵主要描述**位置和坐标之间的关系**");
    expect(concept?.body).toContain("不是把像素颜色直接乘了一下");
    expect(concept?.body).toContain("image.shape[:2]");
    expect(concept?.body).toContain("(new_width, new_height)");
    expect(concept?.body).toContain("assert resized.shape[:2]");
    expect(concept?.body).toContain("round(width * scale_x)");
    expect(concept?.body).toContain("assert (new_width, new_height) == (12, 10)");
    expect(concept?.body).toContain(
      "assert explicit_probe.shape == implicit_probe.shape == (10, 12)",
    );
    expect(concept?.body).toContain("INTER_NEAREST");
    expect(concept?.body).toContain("INTER_LINEAR");
    expect(concept?.body).toContain("INTER_AREA");
    expect(concept?.body).toContain("nearest_probe[1, 1] == 0");
    expect(concept?.body).toContain("linear_probe[1, 1] == 46");
    expect(concept?.body).toContain(
      "np.count_nonzero(nearest_probe != linear_probe) == 21",
    );
    expect(concept?.body).toContain(
      "np.array_equal(area_probe, np.full((2, 2), 128",
    );
    expect(concept?.body).toContain("cv2.getRotationMatrix2D");
    expect(concept?.body).toContain("rotation_matrix.shape == (2, 3)");
    expect(concept?.body).toContain("scaled_rotation_matrix");
    expect(concept?.body).toContain("cv2.getRotationMatrix2D(center, 90.0, 0.5)");
    expect(concept?.body).toContain("scaled_rotated.shape == (height, width, 3)");
    expect(concept?.body).toContain("resize scale");
    expect(concept?.body).toContain("rotation scale");
    expect(concept?.body).toContain("cv2.warpAffine");
    expect(concept?.body).toContain("[1, 0, tx]");
    expect(concept?.body).toContain("assert np.allclose(translated_point, [7.0, 3.0])");
    expect(concept?.body).toContain(
      "assert same_canvas[3, 7].tolist() == [0, 0, 255]",
    );
    expect(concept?.body).toContain("negative_prediction");
    expect(concept?.body).toContain("assert np.allclose(negative_prediction, [-2.0, 1.0])");
    expect(concept?.body).toContain("negative_larger");
    expect(concept?.body).toContain("visible_result[1, 0]");
    expect(concept?.body).toContain("扩大画布**与**调整输出坐标位置");
    expect(concept?.body).toContain("**clipping**");
    expect(concept?.body).toContain("**border fill**");
    expect(concept?.body).toContain("borderValue=(0,0,0)");
    expect(concept?.body).toContain("不是原图自带黑像素");
    expect(concept?.body).toContain("src_points.shape == dst_points.shape == (3, 2)");
    expect(concept?.body).toContain("src_points.dtype == dst_points.dtype == np.float32");
    expect(concept?.body).toContain("cv2.getAffineTransform");
    expect(concept?.body).toContain("collinear_points");
    expect(concept?.body).toContain("valid_triangle");
    expect(concept?.body).toContain("signed_twice_area");
    expect(concept?.body).toContain("三个非共线点提供二维中的两个独立方向");
    expect(concept?.body).toContain("一般 affine 保持直线与平行");
    expect(concept?.body).toContain("$Av_1=(4,0)$、$Av_2=(8,0)$");
    expect(concept?.body).toContain(
      "forward point mapping 与 image reverse sampling",
    );
    expect(concept?.body).toContain("same_canvas");
    expect(concept?.body).toContain("larger_canvas");
    expect(concept?.body).toContain("np.array_equal(source, original)");
    expect(concept?.body).toContain("cv2.COLOR_BGR2RGB");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain("### Checkpoint 4");
    expect(concept?.body?.match(/report_diagnosis\(/gu)).toHaveLength(7);
    ["input:", "expected:", "actual:", "reason:", "correction:"].forEach(
      (field) => expect(concept?.body).toContain(field),
    );
    expect(concept?.body).toContain(
      "**当前不学习**：Perspective Transformation、homography、`warpPerspective`",
    );
    expect(concept?.meta.masteryCriteria[0]?.description).not.toMatch(
      /perspective|homography/iu,
    );
    expect(concept?.meta.masteryCriteria[1]?.description).not.toMatch(
      /perspective|homography/iu,
    );
    expect(concept?.meta.masteryCriteria[0]?.evidenceHint).toContain(
      "非整数 resize scale",
    );
    expect(concept?.meta.masteryCriteria[0]?.evidenceHint).toContain(
      "负坐标对照",
    );
    expect(concept?.meta.masteryCriteria[1]?.evidenceHint).toContain(
      "非共线 float32",
    );
    expect(concept?.meta.masteryCriteria[1]?.evidenceHint).toContain(
      "affine 保持性质判断",
    );

    const linearTransforms = await readFile(
      resolve(process.cwd(), "content/concepts/math/linear-transforms.mdx"),
      "utf8",
    );
    expect(linearTransforms).toContain(
      "已发布的 `opencv.geometric-transforms` 也把它作为 hard 前置",
    );
    expect(linearTransforms).not.toContain(
      "planned 的 `opencv.geometric-transforms`",
    );
  });

  it("opencv.filtering-basics 保持两条 hard dependency、master 边界与数值诊断闭环", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(
      ({ meta }) => meta.id === "opencv.filtering-basics",
    );

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      estimatedHours: { min: 6, max: 8 },
      resourceIds: ["resource.opencv-python-tutorials"],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({ conceptId: "python.numpy-arrays", kind: "hard" }),
      expect.objectContaining({ conceptId: "opencv.io-color", kind: "hard" }),
    ]);
    expect(concept?.meta.dependencies).toHaveLength(2);
    expect(concept?.meta.dependencies.map(({ conceptId }) => conceptId)).not.toEqual(
      expect.arrayContaining([
        "dip.convolution-lsi",
        "python.numpy-dtypes",
        "image.digital-representation",
        "opencv.geometric-transforms",
        "math.numerical-stability",
      ]),
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(
        concept?.body,
        `opencv.filtering-basics 缺少 ${heading}`,
      ).toContain(heading);
    });
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria.every(({ required }) => required)).toBe(
      true,
    );
    expect(concept?.body).toContain("Geometry asks:");
    expect(concept?.body).toContain("Filtering asks:");
    expect(concept?.body).toContain("cv2.blur");
    expect(concept?.body).toContain("总共有 9 个位置");
    expect(concept?.body).toContain("每个权重都是 $1/9$");
    expect(concept?.body).toContain("cv2.GaussianBlur");
    expect(concept?.body).toContain("sigmaX=1.0");
    expect(concept?.body).toContain("sigmaY=1.0");
    expect(concept?.body).toContain("cv2.filter2D");
    expect(concept?.body).toContain("cv2.CV_32F");
    expect(concept?.body).toContain("correlation（相关）");
    expect(concept?.body).toContain("它不会自动翻转 kernel");
    expect(concept?.body).toContain("ROADMAP recommended：`dip.convolution-lsi`");
    expect(concept?.body).toContain("暂不进入正式 manifest/DAG");
    expect(concept?.body).toContain("BORDER_CONSTANT");
    expect(concept?.body).toContain("BORDER_REPLICATE");
    expect(concept?.body).toContain("12.0 / 9.0");
    expect(concept?.body).toContain("21.0 / 9.0");
    expect(concept?.body).toContain("np.random.default_rng(20260901)");
    expect(concept?.body).toContain("source.shape == (9, 15)");
    expect(concept?.body).toContain("hand_center == 5.0");
    expect(concept?.body).toContain("mean_3[4, 6] == 88");
    expect(concept?.body).toContain("mean_5[4, 6] == 95");
    expect(concept?.body).toContain("gaussian[4, 6] == 79");
    expect(concept?.body).toContain("gaussian[4, 7] == 142");
    expect(concept?.body).toContain("image[2:7, 2:5]");
    expect(concept?.body).toContain("standard deviation，标准差");
    expect(concept?.body).toContain("≈ 4.2531");
    expect(concept?.body).toContain("≈ 1.6193");
    expect(concept?.body).toContain("≈ 0.7180");
    expect(concept?.body).toContain("≈ 1.8427");
    expect(concept?.body).toContain("flat_region_variation");
    expect(concept?.body).toContain("edge_contrast");
    expect(concept?.body).toContain("smoothing_axes");
    expect(concept?.body).toContain('cmap="gray", vmin=0, vmax=255');
    expect(concept?.body).toContain("sharp_float.min().item()");
    expect(concept?.body).toContain("(-116.0, 542.0)");
    expect(concept?.body).toContain("5 * 40 - 36 - 48 - 35 - 183 == -102");
    expect(concept?.body).toContain("5 * 183 - 183 - 179 - 40 - 175 == 338");
    expect(concept?.body).toContain("sharp_float[4, 6] == -102.0");
    expect(concept?.body).toContain("sharp_float[4, 7] == 338.0");
    expect(concept?.body).toContain("sharp_uint8_direct[4, 6] == 0");
    expect(concept?.body).toContain("sharp_uint8_direct[4, 7] == 255");
    expect(concept?.body).toContain("np.clip(sharp_float, 0.0, 255.0)");
    expect(concept?.body).toContain("vmin=-128, vmax=560");
    expect(concept?.body).toContain("inspect raw float → clip if output contract requires → rint → astype(uint8)");
    expect(concept?.body).toContain("小图像中的大 kernel 与 border 耦合");
    expect(concept?.body).toContain("Practice calculations / diagnostics → Evidence summary");
    expect(concept?.body).toContain("np.array_equal(source, original)");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain("### Checkpoint 4");
    expect(concept?.body?.match(/report_diagnosis\(/gu)).toHaveLength(6);
    ["input:", "expected:", "actual:", "reason:", "correction:"].forEach(
      (field) => expect(concept?.body).toContain(field),
    );
    expect(concept?.body).not.toContain("cv2.medianBlur");
    expect(concept?.body).not.toContain("cv2.bilateralFilter");
    expect(concept?.body).not.toContain("cv2.threshold");
    expect(concept?.body).not.toContain("cv2.Canny");
    expect(concept?.meta.masteryCriteria[0]?.evidenceHint).toContain(
      "flat-region variation",
    );
    expect(concept?.meta.masteryCriteria[1]?.evidenceHint).toContain(
      "uint8 saturation",
    );
  });

  it("opencv.threshold-morphology 保持两条 hard dependency、master 边界与结构诊断闭环", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(
      ({ meta }) => meta.id === "opencv.threshold-morphology",
    );

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      estimatedHours: { min: 7, max: 9 },
      resourceIds: ["resource.opencv-python-tutorials"],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({ conceptId: "opencv.io-color", kind: "hard" }),
      expect.objectContaining({ conceptId: "opencv.roi-masks", kind: "hard" }),
    ]);
    expect(concept?.meta.dependencies).toHaveLength(2);
    expect(concept?.meta.dependencies.map(({ conceptId }) => conceptId)).not.toEqual(
      expect.arrayContaining([
        "dip.morphology",
        "opencv.filtering-basics",
        "python.numpy-dtypes",
        "image.digital-representation",
      ]),
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(
        concept?.body,
        `opencv.threshold-morphology 缺少 ${heading}`,
      ).toContain(heading);
    });
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria.every(({ required }) => required)).toBe(
      true,
    );
    expect(concept?.body).toContain("pixel > T  → maxval");
    expect(concept?.body).toContain("pixel <= T → 0");
    expect(concept?.body).toContain("ret == 127.0");
    expect(concept?.body).toContain("pixel == T");
    expect(concept?.body).toContain("THRESH_BINARY_INV");
    expect(concept?.body).toContain("mask_bool.astype(np.uint8) * 255");
    expect(concept?.body).toContain("ROADMAP 把 `dip.morphology` 列为 recommended");
    expect(concept?.body).toContain("暂不建立正式 edge");
    expect(concept?.body).toContain("Structuring element 不是 averaging kernel");
    expect(concept?.body).toContain("erosion（腐蚀）");
    expect(concept?.body).toContain("dilation（膨胀）");
    expect(concept?.body).toContain("opening（开运算）");
    expect(concept?.body).toContain("closing（闭运算）");
    expect(concept?.body).toContain('borderType=cv2.BORDER_CONSTANT');
    expect(concept?.body).toContain("并不等价于“默认外部全是 0”");
    expect(concept?.body).toContain("source.shape == (9, 13)");
    expect(concept?.body).toContain('"dark": {"ret": 127.0, "foreground": 2, "target": 0}');
    expect(concept?.body).toContain('"nominal": {"ret": 127.0, "foreground": 36, "target": 34}');
    expect(concept?.body).toContain('"bright": {"ret": 127.0, "foreground": 117, "target": 35}');
    expect(concept?.body).toContain("180 - 70 = 110 < 127");
    expect(concept?.body).toContain("220 - 70 = 150 > 127");
    expect(concept?.body).toContain("30 + 110 = 140 > 127");
    expect(concept?.body).toContain("illumination failure");
    expect(concept?.body).toContain("输入不变而 threshold 参数变化");
    expect(concept?.body).toContain("mask.sum() = 255 × foreground_count");
    expect(concept?.body).toContain("`uint8` 无法表示负数");
    expect(concept?.body).toContain("中心位置 `[2,2]`");
    expect(concept?.body).toContain("原中心附近的八个位置");
    expect(concept?.body).toContain('inspect_binary("opened", opened, source.shape) == 30');
    expect(concept?.body).toContain('inspect_binary("cleaned", cleaned, source.shape) == 35');
    expect(concept?.body).toContain("一个原始 hole 与四个 opening-induced loss");
    expect(concept?.body).toContain("不能称为 ground-truth recovery");
    expect(concept?.body).toContain("当前项目所验证的 OpenCV 环境");
    expect(concept?.body).toContain("不把这一行为泛化为所有未来绑定版本");
    expect(concept?.body).toContain("np.count_nonzero(aggressive_open) == 0");
    expect(concept?.body).toContain("np.array_equal(source, original)");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain("### Checkpoint 4");
    ["input:", "expected:", "actual:", "reason:", "correction:"].forEach(
      (field) => expect(concept?.body).toContain(field),
    );
    expect(concept?.body).not.toContain("cv2.adaptiveThreshold");
    expect(concept?.body).not.toContain("cv2.findContours");
    expect(concept?.body).not.toContain("cv2.Canny");
  });

  it("opencv.edges-contours 保持两条 hard dependency、master 边界与已知几何闭环", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(
      ({ meta }) => meta.id === "opencv.edges-contours",
    );

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      estimatedHours: { min: 7, max: 9 },
      resourceIds: ["resource.opencv-python-tutorials"],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({
        conceptId: "opencv.filtering-basics",
        kind: "hard",
      }),
      expect.objectContaining({
        conceptId: "opencv.threshold-morphology",
        kind: "hard",
      }),
    ]);
    expect(concept?.meta.dependencies).toHaveLength(2);
    expect(concept?.meta.dependencies.map(({ conceptId }) => conceptId)).not.toContain(
      "dip.segmentation",
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(concept?.body, `opencv.edges-contours 缺少 ${heading}`).toContain(
        heading,
      );
    });
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria.every(({ required }) => required)).toBe(
      true,
    );
    expect(concept?.body).toContain("edge map 的 255 是边界证据，不是目标区域内部");
    expect(concept?.body).toContain("ROADMAP 把 `dip.segmentation` 列为 recommended");
    expect(concept?.body).toContain("暂不建立正式 edge");
    expect(concept?.body).toContain("cv2.CV_32F");
    expect(concept?.body).toContain("760.0");
    expect(concept?.body).toContain("-760.0");
    expect(concept?.body).toContain("4×190=760");
    expect(concept?.body).toContain("运行前只需预测");
    expect(concept?.body).toContain(
      '{"total": 403, "known main": 25, "off": 359}',
    );
    expect(concept?.body).toContain(
      '{"total": 26, "known main": 25, "off": 0}',
    );
    expect(concept?.body).toContain(
      '{"total": 25, "known main": 25, "off": 0}',
    );
    expect(concept?.body).toContain("cv2.RETR_EXTERNAL");
    expect(concept?.body).toContain("cv2.CHAIN_APPROX_SIMPLE");
    expect(concept?.body).toContain("contour.shape == (4, 1, 2)");
    expect(concept?.body).toContain("foreground_pixels == 40");
    expect(concept?.body).toContain("area == 28.0");
    expect(concept?.body).toContain("perimeter == 22.0");
    expect(concept?.body).toContain("(x, y, w, h) == (3, 2, 8, 5)");
    expect(concept?.body).toContain("2×(7+4)=22");
    expect(concept?.body).toContain("polygon coordinate span `7×4` 不等于 raster coverage `8×5`");
    expect(concept?.body).toContain("image[2:7, 3:11]");
    expect(concept?.body).toContain("image[y:y+h,x:x+w]");
    expect(concept?.body).toContain('(0.0, (14, 8, 1, 1))');
    expect(concept?.body).toContain("单个 contour point 无法围成二维区域");
    expect(concept?.body).toContain("area=0` 不一定是噪声");
    expect(concept?.body).toContain("stored contour points");
    expect(concept?.body).toContain("raster boundary pixels");
    expect(concept?.body).toContain("不会修改输入 binary mask");
    expect(concept?.body).toContain("assert mask_with_hole[4, 6] == 0");
    expect(concept?.body).toContain("Morphology 会改变 binary region geometry");
    expect(concept?.body).toContain("cumulative checkpoint");
    expect(concept?.body).toContain("result = source_bgr.copy()");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain("### Checkpoint 4");
    ["input:", "expected:", "actual:", "reason:", "correction:"].forEach(
      (field) => expect(concept?.body).toContain(field),
    );
    expect(concept?.body?.match(/report_diagnosis\(/gu)).toHaveLength(13);
    expect(concept?.body).toContain("下面共 10 个任务");
    expect(concept?.body).toContain("Canny 完整推导与 trackbar demo");
    expect(concept?.body).not.toContain("cv2.HoughLines");
    expect(concept?.body).not.toContain("cv2.watershed");
    expect(concept?.body).not.toContain("cv2.connectedComponents");
  });

  it("pipeline.batch-images 保持正式 dependency、master 边界与可靠 batch 闭环", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(
      ({ meta }) => meta.id === "pipeline.batch-images",
    );

    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "master",
      estimatedHours: { min: 7, max: 9 },
      resourceIds: [
        "resource.python-pathlib",
        "resource.opencv-python-tutorials",
      ],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({
        conceptId: "tooling.reproducibility",
        kind: "hard",
      }),
      expect.objectContaining({
        conceptId: "opencv.edges-contours",
        kind: "hard",
      }),
      expect.objectContaining({
        conceptId: "tooling.debugging",
        kind: "recommended",
      }),
    ]);
    expect(concept?.meta.dependencies).toHaveLength(3);
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria.every(({ required }) => required)).toBe(
      true,
    );

    requiredSectionHeadings.forEach((heading) => {
      expect(concept?.body, `pipeline.batch-images 缺少 ${heading}`).toContain(
        heading,
      );
    });
    expect(concept?.body).toContain(
      "discover → sort → preflight → process one → record → summarize → verify",
    );
    expect(concept?.body).toContain("Path.iterdir()");
    expect(concept?.body).toContain(
      "key=lambda path: (path.name.casefold(), path.name)",
    );
    expect(concept?.body).toContain("process_one(input_path, output_path, config)");
    expect(concept?.body).toContain("continue-on-item-error");
    expect(concept?.body).toContain("error-on-existing");
    expect(concept?.body).toContain("processed == succeeded + failed");
    expect(concept?.body).toContain("discovered == processed + skipped");
    expect(concept?.body).toContain('"schema_version": 1');
    expect(concept?.body).toContain("sample__jpg.png");
    expect(concept?.body).toContain("sample__png.png");
    expect(concept?.body).toContain("### Checkpoint 1");
    expect(concept?.body).toContain("### Checkpoint 2");
    expect(concept?.body).toContain("### Checkpoint 3");
    expect(concept?.body).toContain("### Checkpoint 4");
    expect(concept?.body).toContain("### Checkpoint 5");
    expect(concept?.body).toContain("discovered = 7");
    expect(concept?.body).toContain("succeeded = 4");
    expect(concept?.body).toContain("failed = 2");
    expect(concept?.body).toContain("skipped = 1");
    expect(concept?.body).toContain("下面五个 checkpoint");
    expect(concept?.body).toContain("当前不学习：multiprocessing");
    expect(concept?.body).not.toContain("concurrent.futures");
    expect(concept?.body).not.toContain("import multiprocessing");
  });

  it("batch R1 区分计数与身份，并用真实输出支撑两种 rerun 证据", async () => {
    const concept = (await loadStageTwoConcepts()).find(
      ({ meta }) => meta.id === "pipeline.batch-images",
    );
    const body = concept?.body ?? "";
    for (const text of [
      "counts consistent ≠ records complete",
      "len(set(record_names)) == len(record_names)",
      "set(record_names) == set(discovered_names)",
      "validate_record_identities(discovered_names, item_records)",
      "validate_record_identities(discovered_names, manifest_a",
      "counts alone must not accept duplicate/missing records",
      "np.array_equal(pixels_a, pixels_b)",
      "assert before_rerun == after_rerun",
      "不是要求所有 JPEG",
      "不落盘的候选名称",
      "稳定的第二层排序",
      "它不是算法、Python、OpenCV 或模型版本",
      "JSON encode（编码）",
      "不要求独立设计 class inheritance",
      "不会读取 output 子目录里的文件",
    ]) expect(body).toContain(text);
    const practice = body.split("## 10. Practice")[1]?.split("## 11.")[0];
    expect(practice).toContain("a.png 重复／b.png 漏记");
    expect(practice).toContain("pixel arrays");
    expect(practice).toContain("bytes 快照一致");
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria[0].evidenceHint).toContain("input_path 完整性");
    expect(concept?.meta.masteryCriteria[1].evidenceHint).toContain("PNG 像素");
    expect(concept?.meta.masteryCriteria[1].evidenceHint).toContain("bytes 快照");
  });

  it("稳定 fixture 的像素、尺寸与正文数值契约一致", async () => {
    const fixture = await readFile(
      resolve(process.cwd(), "public/media/opencv-io-color-fixture.ppm"),
      "utf8",
    );
    const tokens = fixture
      .split(/\r?\n/u)
      .filter((line) => !line.trimStart().startsWith("#"))
      .join(" ")
      .trim()
      .split(/\s+/u);

    expect(tokens.slice(0, 4)).toEqual(["P3", "3", "2", "255"]);
    expect(tokens.slice(4).map(Number)).toEqual([
      255, 0, 0,
      0, 255, 0,
      0, 0, 255,
      255, 255, 0,
      0, 255, 255,
      255, 0, 255,
    ]);
  });

  it("OpenCV 官方资源覆盖 I/O、ROI、affine、filtering、threshold、morphology 与 edges/contours，并保持后续边界", () => {
    const resource = contentManifest.resources.find(
      ({ id }) => id === "resource.opencv-python-tutorials",
    );

    expect(resource).toMatchObject({
      type: "official-doc",
      verification: "verified",
      url: "https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html",
      lastCheckedAt: "2026-09-07",
    });
    expect(resource?.recommendedParts).toEqual([
      expect.stringContaining("必看：Getting Started with Images"),
      expect.stringContaining("选看：IMREAD_UNCHANGED"),
      expect.stringContaining("跳过：GUI 深入"),
    ]);
    expect(resource?.recommendedParts?.[0]).toContain("Image ROI");
    expect(resource?.recommendedParts?.[0]).toContain(
      "Scaling、Translation、Rotation 与 Affine Transformation",
    );
    expect(resource?.recommendedParts?.[0]).toContain("Averaging、Gaussian Blurring");
    expect(resource?.recommendedParts?.[0]).toContain(
      "blur、GaussianBlur、filter2D、ddepth 与 borderType",
    );
    expect(resource?.recommendedParts?.[0]).toContain("THRESH_BINARY、THRESH_BINARY_INV");
    expect(resource?.recommendedParts?.[0]).toContain(
      "Erosion、Dilation、Opening、Closing",
    );
    expect(resource?.recommendedParts?.[0]).toContain("Sobel 与 output depth");
    expect(resource?.recommendedParts?.[0]).toContain(
      "Canny Edge Detection 中 low/high threshold",
    );
    expect(resource?.recommendedParts?.[0]).toContain(
      "findContours、RETR_EXTERNAL、CHAIN_APPROX_SIMPLE",
    );
    expect(resource?.recommendedParts?.[0]).toContain(
      "area、perimeter 与 bounding rectangle",
    );
    expect(resource?.recommendedParts?.[1]).toContain("reverse sampling");
    expect(resource?.recommendedParts?.[1]).toContain("sharpening mask");
    expect(resource?.recommendedParts?.[1]).toContain("getStructuringElement");
    expect(resource?.recommendedParts?.[2]).toContain("warpPerspective");
    expect(resource?.recommendedParts?.[2]).toContain("homography");
    expect(resource?.recommendedParts?.[2]).toContain("median");
    expect(resource?.recommendedParts?.[2]).toContain("bilateral");
    expect(resource?.recommendedParts?.[2]).toContain("Canny 完整推导");
    expect(resource?.recommendedParts?.[2]).toContain("adaptive threshold");
    expect(resource?.recommendedParts?.[2]).toContain("Otsu");
    expect(resource?.recommendedParts?.[2]).toContain("top-hat");
  });

  it("features-preview 只做 understand 级 ORB 预览，三段正文与两个证据对齐", async () => {
    const concepts = await loadStageTwoConcepts();
    const concept = concepts.find(({ meta }) => meta.id === "opencv.features-preview");
    expect(concept?.meta).toMatchObject({
      publicationStatus: "published",
      requiredness: "required",
      targetDepth: "understand",
      estimatedHours: { min: 2, max: 3 },
      resourceIds: ["resource.opencv-python-tutorials"],
    });
    expect(concept?.meta.dependencies).toEqual([
      expect.objectContaining({ conceptId: "opencv.edges-contours", kind: "hard" }),
    ]);
    const body = concept?.body ?? "";
    expect(body.match(/^### Checkpoint /gmu)).toHaveLength(3);
    expect(body.match(/```python/gu)).toHaveLength(3);
    expect(concept?.meta.masteryCriteria).toHaveLength(2);
    expect(concept?.meta.masteryCriteria.every(({ description }) =>
      description.includes("帮助下"),
    )).toBe(true);
    [
      "稀疏候选位置", "不是 corner 的通用同义词", "不是原始 pixel patch",
      "浮点", "image[y,x]", "不是物体真实尺寸", "不是跨图、跨算法",
      "if description is None:", "len(points) == description.shape[0]",
      "orb.descriptorSize()", "description.dtype == np.uint8",
      "不是灰度 intensity", "cv2.COLOR_BGR2RGB",
      "assert np.array_equal(source, snapshot)", "模糊不保证点数单调减少",
      "不是 invariance proof", "Stage 5", "dip.feature-representation",
      "达到 understood 即满足本节点路线目标",
    ].forEach((text) => expect(body).toContain(text));
    const pythonCode = [...body.matchAll(/```python\n([\s\S]*?)```/gu)]
      .map((match) => match[1]).join("\n");
    expect(pythonCode).not.toMatch(/BFMatcher|FlannBasedMatcher|findHomography|SIFT_create/u);
    expect(pythonCode).not.toMatch(/(?:len\(keypoints\)|count)\s*==\s*(?:112|329|175)/u);
    const resource = contentManifest.resources.find(({ id }) => id === "resource.opencv-python-tutorials");
    expect(resource?.recommendedParts?.[0]).toContain("ORB in OpenCV");
    expect(resource?.recommendedParts?.[2]).toContain("除 ORB 最小预览外的 features");
    expect(resource?.recommendedParts?.[2]).toContain("BFMatcher");
  });

  it("features-preview 仅由 edges 解锁，understood 已达目标且发布不通过 Stage gate", () => {
    expect(contentManifest.concepts).toHaveLength(36);
    const preview = contentManifest.concepts.find(({ id }) => id === "opencv.features-preview");
    if (!preview) throw new Error("missing feature preview");
    const state = createInitialLearningState(contentManifest.tracks, "2026-09-07T00:00:00.000Z");
    expect(getConceptStatus(state.conceptProgress, preview.id)).toBe("not_started");
    expect(getConceptReadiness(preview, state.conceptProgress)).toEqual({
      ready: false, missingHard: ["opencv.edges-contours"], missingRecommended: [],
    });
    const started = startConcept(undefined, "2026-09-07T00:00:00.000Z");
    if (!started.ok) throw new Error(started.message);
    const understood = { ...started.progress, status: "understood" as const };
    expect(getConceptReadiness(preview, { "opencv.edges-contours": understood })).toEqual({
      ready: true, missingHard: [], missingRecommended: [],
    });
    expect(getRouteRequiredStatus(preview, contentManifest.tracks, state.preferences)).toBe("understood");
    const focused = { ...state, preferences: { ...state.preferences, activeStageId: preview.stageId } };
    const blocked = getNextStep({ catalog: contentManifest, state: focused });
    if (blocked.kind === "recommendation") expect(blocked.targetId).not.toBe(preview.id);
    const reached = {
      ...focused,
      conceptProgress: { [preview.id]: understood, "opencv.edges-contours": understood },
    };
    const next = getNextStep({ catalog: contentManifest, state: reached });
    if (next.kind === "recommendation") expect(next.targetId).not.toBe(preview.id);
    const stage = contentManifest.stages.find(({ id }) => id === preview.stageId);
    expect(stage?.projectGates).toEqual([
      { projectId: "project.pixel-lab", milestoneId: "milestone.pixel-lab.image-computing", when: { kind: "always" } },
    ]);
    expect(stage?.exitCriteria).toHaveLength(2);
    expect(stage && "retestAfterDays" in stage ? stage.retestAfterDays : undefined).toBe(7);
  });

  it("十二篇正文形成完整学习闭环，且教学支架覆盖 masteryCriteria", async () => {
    const concepts = await loadStageTwoConcepts();
    expect(concepts).toHaveLength(12);

    concepts.forEach(({ body, meta }) => {
      requiredSectionHeadings.forEach((heading) => {
        expect(body, `${meta.id} 缺少 ${heading}`).toContain(heading);
      });
      expect(body).toContain("### 为什么现在学");
      expect(body).toContain("### 在机器视觉中会在哪里使用");
      expect(body).toContain("### 理解检查");
      expect(body).toContain("### 数值练习");
      expect(body).toContain("### 视觉小练习");
      expect(body).toContain("当前不学习");
      expect(meta.masteryCriteria).toHaveLength(2);
      expect(meta.masteryCriteria.every(({ required }) => required)).toBe(true);
      expect(meta.resourceIds.length).toBeGreaterThanOrEqual(1);
      expect(meta.resourceIds.length).toBeLessThanOrEqual(2);
    });

    const bodyById = new Map(concepts.map(({ body, meta }) => [meta.id, body]));
    expect(bodyById.get("python.numpy-arrays")).toContain("boolean mask");
    expect(bodyById.get("python.numpy-arrays")).toContain("roundtrip equal");
    expect(bodyById.get("python.numpy-dtypes")).toContain("wrong_bright");
    expect(bodyById.get("python.numpy-dtypes")).toContain("np.shares_memory");
    expect(bodyById.get("image.digital-representation")).toContain(
      "image[row, column]",
    );
    expect(bodyById.get("image.digital-representation")).toContain(
      "gray[y, x] == 160",
    );
    expect(bodyById.get("visualization.image-plots")).toContain(
      "vmin=0, vmax=255",
    );
    expect(bodyById.get("visualization.image-plots")).toContain("plt.hist");
  });

  it("R1 补齐 RGB 构造、表示往返与可信显示的教学支架", async () => {
    const concepts = await loadStageTwoConcepts();
    const bodyById = new Map(concepts.map(({ body, meta }) => [meta.id, body]));
    const arraysBody = bodyById.get("python.numpy-arrays") ?? "";
    const dtypesBody = bodyById.get("python.numpy-dtypes") ?? "";
    const representationBody =
      bodyById.get("image.digital-representation") ?? "";
    const plotsBody = bodyById.get("visualization.image-plots") ?? "";

    expect(arraysBody).toContain("mean(axis=2)");
    expect(arraysBody).toContain("H×W×C");
    expect(arraysBody).toContain("不是通用的图像旋转");

    expect(dtypesBody).toContain(
      "不会替你执行合理的 clipping 或 rounding",
    );
    expect(dtypesBody).toContain("模 256 类回绕，得到 14");
    expect(dtypesBody).toContain("对应 251");

    expect(representationBody).not.toContain("np.stack(");
    expect(representationBody).not.toContain("np.zeros_like(");
    expect(representationBody).toContain("rgb[:, :, 0] = red");
    expect(representationBody).toContain("rgb[:, :, 1] = green");
    expect(representationBody).toContain("rgb[:, :, 2] = blue");
    expect(representationBody).toContain(
      "red.shape == green.shape == blue.shape == (height, width)",
    );
    expect(representationBody).toContain(
      "np.rint(np.clip(gray_float, 0.0, 1.0) * 255.0)",
    );
    expect(representationBody).toContain(
      "gray_restored.astype(np.int16) - gray.astype(np.int16)",
    );
    expect(representationBody).toContain("float quantization max error");
    expect(representationBody).toContain("0.5 / 255.0");

    expect(plotsBody).toContain("二维标量图");
    expect(plotsBody).toContain("H×W×3");
    expect(plotsBody).toContain("不能把单一 scalar colormap");
    expect(plotsBody).toContain("真实文件与 OpenCV 的 BGR/RGB");
    expect(plotsBody).toContain("rgb_axis.imshow(rgb)");
    expect(plotsBody).toContain("axes_grid.ravel()");
    expect(plotsBody).toContain("不保留像素的空间位置");
    expect(plotsBody).toContain("gray.reshape(-1)");
  });

  it("资源只新增两个官方入口，并明确必看、选看与跳过范围", () => {
    const resourceIds = [
      "resource.numpy-absolute-beginners",
      "resource.matplotlib-image-tutorial",
    ] as const;

    resourceIds.forEach((resourceId) => {
      const resource = contentManifest.resources.find(({ id }) => id === resourceId);
      expect(resource).toMatchObject({
        type: "official-doc",
        verification: "verified",
        verifiedAt: "2026-08-31",
        lastCheckedAt: "2026-08-31",
      });
      expect(resource?.url).toMatch(/^https:\/\//u);
      expect(resource?.recommendedParts?.some((part) => part.startsWith("必看"))).toBe(
        true,
      );
      expect(resource?.recommendedParts?.some((part) => part.startsWith("选看"))).toBe(
        true,
      );
      expect(resource?.recommendedParts?.some((part) => part.startsWith("跳过"))).toBe(
        true,
      );
    });
  });

  it("pathlib 资源最小覆盖 batch discovery，并保持非递归边界", () => {
    const resource = contentManifest.resources.find(
      ({ id }) => id === "resource.python-pathlib",
    );

    expect(resource?.recommendedParts).toEqual([
      expect.stringContaining("必看："),
      expect.stringContaining("选看："),
      expect.stringContaining("跳过："),
    ]);
    expect(resource?.recommendedParts?.[0]).toContain("Path.iterdir");
    expect(resource?.recommendedParts?.[0]).toContain("Path.stem");
    expect(resource?.recommendedParts?.[1]).toContain("非递归");
    expect(resource?.recommendedParts?.[2]).toContain("Path.rglob");
  });

  it("不扩展 Pixel Lab 或后续 draft Project", () => {
    const pixelLab = contentManifest.projects.find(
      ({ id }) => id === "project.pixel-lab",
    );
    const classicalInspection = contentManifest.projects.find(
      ({ id }) => id === "project.classical-inspection",
    );
    const stageZeroIds = [
      "tooling.computer-files",
      "tooling.dev-environment",
      "tooling.python-core",
      "tooling.python-modules",
      "tooling.git-basics",
      "tooling.debugging",
      "tooling.linux-basics",
      "tooling.reproducibility",
    ];

    expect(pixelLab?.publicationStatus).toBe("published");
    expect(pixelLab?.conceptRequirements.map(({ conceptId }) => conceptId)).toEqual(
      stageZeroIds,
    );
    expect(pixelLab?.evidenceConceptIds).toEqual(stageZeroIds);
    expect(classicalInspection).toMatchObject({
      publicationStatus: "draft",
      conceptRequirements: [],
      evidenceConceptIds: [],
    });
  });

  it("自动进入 Knowledge、Roadmap、Graph 与 Search，并保持初始状态和 NextStep", () => {
    const knowledge = buildKnowledgeView(contentManifest);
    const roadmap = buildRoadmapView(contentManifest);
    const graph = buildGlobalKnowledgeGraphCatalog(contentManifest);
    const initialState = createInitialLearningState(
      contentManifest.tracks,
      "2026-08-31T00:00:00.000Z",
    );
    const nextStep = getNextStep({ catalog: contentManifest, state: initialState });
    const geometricTransforms = contentManifest.concepts.find(
      ({ id }) => id === "opencv.geometric-transforms",
    );
    const filteringBasics = contentManifest.concepts.find(
      ({ id }) => id === "opencv.filtering-basics",
    );
    const thresholdMorphology = contentManifest.concepts.find(
      ({ id }) => id === "opencv.threshold-morphology",
    );
    const edgesContours = contentManifest.concepts.find(
      ({ id }) => id === "opencv.edges-contours",
    );
    const batchImages = contentManifest.concepts.find(
      ({ id }) => id === "pipeline.batch-images",
    );

    stageTwoConceptIds.forEach((conceptId) => {
      expect(knowledge.concepts.some(({ concept }) => concept.id === conceptId)).toBe(
        true,
      );
      expect(graph.nodes.some(({ id }) => id === conceptId)).toBe(true);
      expect(getConceptStatus(initialState.conceptProgress, conceptId)).toBe(
        "not_started",
      );
    });
    expect(
      roadmap.availableStages.some(
        ({ stage }) => stage.id === "stage.image-computing",
      ),
    ).toBe(true);
    expect(nextStep).toMatchObject({
      kind: "recommendation",
      targetId: "tooling.computer-files",
      reasonCode: "project-gap",
    });
    expect(
      geometricTransforms &&
        getConceptReadiness(
          geometricTransforms,
          initialState.conceptProgress,
        ),
    ).toEqual({
      ready: false,
      missingHard: ["math.linear-transforms", "opencv.io-color"],
      missingRecommended: ["math.coordinate-frames"],
    });
    expect(
      filteringBasics &&
        getConceptReadiness(filteringBasics, initialState.conceptProgress),
    ).toEqual({
      ready: false,
      missingHard: ["python.numpy-arrays", "opencv.io-color"],
      missingRecommended: [],
    });
    expect(
      thresholdMorphology &&
        getConceptReadiness(thresholdMorphology, initialState.conceptProgress),
    ).toEqual({
      ready: false,
      missingHard: ["opencv.io-color", "opencv.roi-masks"],
      missingRecommended: [],
    });
    expect(
      edgesContours &&
        getConceptReadiness(edgesContours, initialState.conceptProgress),
    ).toEqual({
      ready: false,
      missingHard: ["opencv.filtering-basics", "opencv.threshold-morphology"],
      missingRecommended: [],
    });
    expect(
      batchImages &&
        getConceptReadiness(batchImages, initialState.conceptProgress),
    ).toEqual({
      ready: false,
      missingHard: ["tooling.reproducibility", "opencv.edges-contours"],
      missingRecommended: ["tooling.debugging"],
    });
  });

  it("batch 只由两个 hard 解锁，debugging 推荐知识不阻塞", () => {
    const batch = contentManifest.concepts.find(({ id }) => id === "pipeline.batch-images");
    if (!batch) throw new Error("missing batch concept");
    const started = startConcept(undefined, "2026-09-07T00:00:00.000Z");
    if (!started.ok) throw new Error(started.message);
    const understood = { ...started.progress, status: "understood" as const };
    const hardIds = ["tooling.reproducibility", "opencv.edges-contours"];
    for (const id of hardIds) {
      expect(getConceptReadiness(batch, { [id]: understood }).ready).toBe(false);
    }
    expect(getConceptReadiness(batch, {
      "tooling.reproducibility": understood,
      "opencv.edges-contours": understood,
    })).toEqual({ ready: true, missingHard: [], missingRecommended: ["tooling.debugging"] });
  });

  it("ROADMAP 同步十二篇发布，但不等于阶段完成", async () => {
    const roadmap = await readFile(resolve(process.cwd(), "ROADMAP.md"), "utf8");
    expect(roadmap).toContain("| `opencv.features-preview` | 局部特征预览（Feature Preview） | U | `opencv.edges-contours` | `dip.feature-representation` |");
    expect(roadmap).toContain(
      "`stage.vision-math-geometry-optimization` 与 `stage.image-computing` 为 `available`",
    );
    expect(roadmap).toContain(
      "Stage 2 十二个规划 Concept 均已正式发布；checkpoint 保持 available。内容发布不代表个人学习、Pixel Lab gate、exit evidence 或复测已经完成",
    );
    expect(roadmap).toContain(
      "| `opencv.geometric-transforms` | 缩放、旋转与仿射变换（Geometric Transforms） | M |",
    );
    expect(roadmap).not.toContain("缩放、旋转、仿射与透视变换");
    expect(roadmap).not.toContain("透视校正小实验");
    expect(roadmap).toContain(
      "| `opencv.filtering-basics` | 平滑、锐化与基础滤波（Filtering） | M | `python.numpy-arrays`, `opencv.io-color` | `dip.convolution-lsi` |",
    );
    expect(roadmap).toContain(
      "| `opencv.threshold-morphology` | 阈值与形态学（Thresholding & Morphology） | M | `opencv.io-color`, `opencv.roi-masks` | `dip.morphology` |",
    );
    expect(roadmap).toContain(
      "| `opencv.edges-contours` | 边缘、轮廓与区域测量（Edges & Contours） | M | `opencv.filtering-basics`, `opencv.threshold-morphology` | `dip.segmentation` |",
    );
    expect(roadmap).toContain(
      "| `python.numpy-arrays` | NumPy 数组、轴、切片与广播（Arrays, Axes, Broadcasting） | M | `tooling.dev-environment`, `tooling.python-core`, `math.vectors-matrices` | `tooling.debugging` |",
    );
  });
});
