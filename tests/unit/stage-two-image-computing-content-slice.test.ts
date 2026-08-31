import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import { buildGlobalKnowledgeGraphCatalog } from "@/features/knowledge/knowledge-graph-model";
import { buildKnowledgeView } from "@/features/knowledge/knowledge-model";
import { getConceptStatus } from "@/features/progress/progress-domain";
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
] as const;

const stageTwoConceptIdSet = new Set<string>(stageTwoConceptIds);

const unpublishedStageTwoConceptIds = [
  "opencv.geometric-transforms",
  "opencv.filtering-basics",
  "opencv.threshold-morphology",
  "opencv.edges-contours",
  "pipeline.batch-images",
  "opencv.features-preview",
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

describe("Phase 9D Stage 2 图像计算基础、OpenCV I/O 与 ROI/Mask", () => {
  it("只发布约定的六个 required/master Concept，并将 checkpoint 保持 available", () => {
    const concepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.image-computing")
      .toSorted((left, right) => left.order - right.order);
    const stage = contentManifest.stages.find(
      ({ id }) => id === "stage.image-computing",
    );

    expect(concepts.map(({ id }) => id)).toEqual(stageTwoConceptIds);
    expect(concepts.map(({ order }) => order)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(
      concepts.every(
        ({ publicationStatus, requiredness, targetDepth, trackIds }) =>
          publicationStatus === "published" &&
          requiredness === "required" &&
          targetDepth === "master" &&
          trackIds.includes("track.common"),
      ),
    ).toBe(true);
    expect(stage).toMatchObject({ contentStatus: "available" });
    expect(stage && "entryGate" in stage ? stage.entryGate : undefined).toBeUndefined();
    expect(stage?.exitCriteria).toHaveLength(2);
    expect(stage && "retestAfterDays" in stage ? stage.retestAfterDays : undefined).toBe(7);

    unpublishedStageTwoConceptIds.forEach((conceptId) => {
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
    expect(dependencies.filter(({ kind }) => kind === "hard")).toHaveLength(10);
    expect(dependencies.filter(({ kind }) => kind === "recommended")).toHaveLength(3);
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

  it("OpenCV 官方资源只保留当前 I/O 与通道转换范围", () => {
    const resource = contentManifest.resources.find(
      ({ id }) => id === "resource.opencv-python-tutorials",
    );

    expect(resource).toMatchObject({
      type: "official-doc",
      verification: "verified",
      url: "https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html",
      lastCheckedAt: "2026-08-31",
    });
    expect(resource?.recommendedParts).toEqual([
      expect.stringContaining("必看：Getting Started with Images"),
      expect.stringContaining("选看：IMREAD_UNCHANGED"),
      expect.stringContaining("跳过：GUI 深入"),
    ]);
    expect(resource?.recommendedParts?.[0]).toContain("Image ROI");
    expect(resource?.recommendedParts?.[2]).toContain("threshold");
  });

  it("六篇正文形成完整学习闭环，且教学支架覆盖 masteryCriteria", async () => {
    const concepts = await loadStageTwoConcepts();
    expect(concepts).toHaveLength(6);

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
  });

  it("ROADMAP 同步发布边界，并明确剩余六个节点未发布", async () => {
    const roadmap = await readFile(resolve(process.cwd(), "ROADMAP.md"), "utf8");
    expect(roadmap).toContain(
      "`stage.vision-math-geometry-optimization` 与 `stage.image-computing` 为 `available`",
    );
    expect(roadmap).toContain(
      "Stage 2 当前已发布 S2-U1 / U2 的数组、dtype、数字图像表示与可信显示四个基础节点、S2-U3 的 `opencv.io-color`，以及 S2-U4 的 `opencv.roi-masks`，共六个正式 Concept；其余六个节点仍未发布",
    );
    expect(roadmap).toContain(
      "| `python.numpy-arrays` | NumPy 数组、轴、切片与广播（Arrays, Axes, Broadcasting） | M | `tooling.dev-environment`, `tooling.python-core`, `math.vectors-matrices` | `tooling.debugging` |",
    );
  });
});
