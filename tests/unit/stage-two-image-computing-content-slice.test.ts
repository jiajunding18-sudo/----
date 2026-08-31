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
] as const;

const stageTwoConceptIdSet = new Set<string>(stageTwoConceptIds);

const unpublishedStageTwoConceptIds = [
  "opencv.io-color",
  "opencv.roi-masks",
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

describe("Phase 9D-1 Stage 2 第一批图像计算基础", () => {
  it("只发布约定的四个 required/master Concept，并将 checkpoint 设为 available", () => {
    const concepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.image-computing")
      .toSorted((left, right) => left.order - right.order);
    const stage = contentManifest.stages.find(
      ({ id }) => id === "stage.image-computing",
    );

    expect(concepts.map(({ id }) => id)).toEqual(stageTwoConceptIds);
    expect(concepts.map(({ order }) => order)).toEqual([10, 20, 30, 40]);
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
    expect(dependencies.filter(({ kind }) => kind === "hard")).toHaveLength(6);
    expect(dependencies.filter(({ kind }) => kind === "recommended")).toHaveLength(2);
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

  it("四篇正文形成完整学习闭环，且教学支架覆盖 masteryCriteria", async () => {
    const concepts = await loadStageTwoConcepts();
    expect(concepts).toHaveLength(4);

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

  it("ROADMAP 同步发布边界，并明确剩余八个节点未发布", async () => {
    const roadmap = await readFile(resolve(process.cwd(), "ROADMAP.md"), "utf8");
    expect(roadmap).toContain(
      "`stage.vision-math-geometry-optimization` 与 `stage.image-computing` 为 `available`",
    );
    expect(roadmap).toContain(
      "Stage 2 当前只发布 S2-U1 / U2 的数组、dtype、数字图像表示与可信显示四个基础节点，其余八个节点仍未发布",
    );
    expect(roadmap).toContain(
      "| `python.numpy-arrays` | NumPy 数组、轴、切片与广播（Arrays, Axes, Broadcasting） | M | `tooling.dev-environment`, `tooling.python-core`, `math.vectors-matrices` | `tooling.debugging` |",
    );
  });
});
