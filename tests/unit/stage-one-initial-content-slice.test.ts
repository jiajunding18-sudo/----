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

const stageOneAConceptIds = [
  "math.vectors-matrices",
  "math.linear-transforms",
  "math.calculus-gradients",
  "math.probability-statistics",
] as const;
const stageOneAConceptIdSet = new Set<string>(stageOneAConceptIds);

const stageOneAResourceIds = [
  "resource.mit-ocw-linear-algebra",
  "resource.mit-ocw-multivariable-calculus",
  "resource.mit-ocw-probability-statistics",
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

describe("Phase 9A Stage 1A 第一批正式学习内容", () => {
  it("保留约定的四个 Stage 1A Concept 与原 targetDepth", () => {
    const stageOneAConcepts = contentManifest.concepts
      .filter(({ stageId }) => stageId === "stage.vision-math-immediate")
      .toSorted((left, right) => left.order - right.order);
    const stageOneA = contentManifest.stages.find(
      ({ id }) => id === "stage.vision-math-immediate",
    );
    const stageOneB = contentManifest.stages.find(
      ({ id }) => id === "stage.vision-math-geometry-optimization",
    );

    expect(stageOneAConcepts.map(({ id }) => id)).toEqual(stageOneAConceptIds);
    expect(
      stageOneAConcepts.every(
        ({ publicationStatus, requiredness, targetDepth, trackIds }) =>
          publicationStatus === "published" &&
          requiredness === "required" &&
          targetDepth === "master" &&
          trackIds.includes("track.common"),
      ),
    ).toBe(true);
    expect(stageOneAConcepts.map(({ order }) => order)).toEqual([
      10, 20, 30, 40,
    ]);
    expect(stageOneA).toMatchObject({ contentStatus: "available" });
    expect(
      stageOneA && "entryGate" in stageOneA
        ? stageOneA.entryGate
        : undefined,
    ).toBeUndefined();
    expect(stageOneA?.exitCriteria).toHaveLength(2);
    expect(stageOneB && "entryGate" in stageOneB ? stageOneB.entryGate : undefined).toBeUndefined();
  });

  it("Stage 1B 依靠 Concept hard dependency 交错进入，不再等待完整 Stage 1A checkpoint", () => {
    const stageOneB = contentManifest.stages.find(
      ({ id }) => id === "stage.vision-math-geometry-optimization",
    );

    expect(
      stageOneB && "entryGate" in stageOneB
        ? stageOneB.entryGate
        : undefined,
    ).toBeUndefined();
    expect(stageOneB?.contentStatus).toBe("available");
  });

  it("建立最小 hard / recommended DAG，不让后续 NumPy 节点成为 Stage 1A 前置", () => {
    const dependencies = contentManifest.dependencies.filter(({ targetId }) =>
      stageOneAConceptIdSet.has(targetId),
    );

    expect(dependencies).toHaveLength(5);
    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prerequisiteId: "tooling.python-core",
          targetId: "math.vectors-matrices",
          kind: "hard",
        }),
        expect.objectContaining({
          prerequisiteId: "math.vectors-matrices",
          targetId: "math.linear-transforms",
          kind: "hard",
        }),
        expect.objectContaining({
          prerequisiteId: "tooling.python-core",
          targetId: "math.calculus-gradients",
          kind: "hard",
        }),
        expect.objectContaining({
          prerequisiteId: "math.vectors-matrices",
          targetId: "math.calculus-gradients",
          kind: "recommended",
        }),
        expect.objectContaining({
          prerequisiteId: "tooling.python-core",
          targetId: "math.probability-statistics",
          kind: "hard",
        }),
      ]),
    );
    expect(contentManifest.concepts.map(({ id }) => String(id))).toContain(
      "python.numpy-arrays",
    );
    expect(
      dependencies.flatMap(({ prerequisiteId, targetId }) => [
        String(prerequisiteId),
        String(targetId),
      ]),
    ).not.toContain("python.numpy-arrays");
  });

  it("每篇正文形成完整学习闭环，并明确当前用途、深度与非目标", async () => {
    const workspaceRoot = process.cwd();
    const concepts = (await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts/math"),
      workspaceRoot,
      schema: conceptMetaSchema,
    })).filter(({ meta }) => stageOneAConceptIdSet.has(meta.id));

    expect(concepts).toHaveLength(stageOneAConceptIds.length);
    concepts.forEach(({ body, meta }) => {
      requiredSectionHeadings.forEach((heading) => {
        expect(body, `${meta.id} 缺少 ${heading}`).toContain(heading);
      });
      expect(body).toContain("### 为什么现在学");
      expect(body).toContain("### 在机器视觉中会在哪里使用");
      expect(body).toContain("### 理解检查");
      expect(body).toContain("### 简单应用");
      expect(body).toContain("### 视觉小练习");
      expect(body).toContain("当前不要求");
      expect(body).toContain("project.math-vision-lab");
      expect(body).toContain("planned");
      expect(meta.masteryCriteria).toHaveLength(2);
      expect(meta.masteryCriteria.every(({ required }) => required)).toBe(true);
      expect(meta.resourceIds.length).toBeGreaterThanOrEqual(1);
      expect(meta.resourceIds.length).toBeLessThanOrEqual(2);
    });
  });

  it("三个新增 Resource 均为 verified，并提供明确阅读范围", () => {
    stageOneAResourceIds.forEach((resourceId) => {
      const resource = contentManifest.resources.find(
        ({ id }) => id === resourceId,
      );

      expect(resource).toMatchObject({
        verification: "verified",
        lastCheckedAt: "2026-08-30",
      });
      expect(resource?.url).toMatch(/^https:\/\//u);
      expect(resource?.reason.length).toBeGreaterThan(0);
      expect(resource?.recommendedParts?.length).toBeGreaterThan(0);
      expect(resource?.recommendedParts?.some((part) => part.startsWith("必看"))).toBe(true);
      expect(resource?.recommendedParts?.some((part) => part.startsWith("选看") || part.startsWith("可选"))).toBe(true);
      expect(resource?.recommendedParts?.some((part) => part.startsWith("跳过"))).toBe(true);
    });
  });

  it("R1 教学桥梁覆盖逆变换、基向量、两类梯度与样本方差直觉", async () => {
    const workspaceRoot = process.cwd();
    const concepts = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts/math"),
      workspaceRoot,
      schema: conceptMetaSchema,
    });
    const bodyById = new Map(concepts.map(({ body, meta }) => [meta.id, body]));

    expect(bodyById.get("math.vectors-matrices")).toContain(
      "x\\rightarrow Ax\\rightarrow A^{-1}(Ax)",
    );
    expect(bodyById.get("math.linear-transforms")).toContain(
      "T(u+v)",
    );
    expect(bodyById.get("math.linear-transforms")).toContain(
      "逆时针 90° 后",
    );
    expect(bodyById.get("math.calculus-gradients")).toContain(
      "图像空间梯度",
    );
    expect(bodyById.get("math.calculus-gradients")).toContain(
      "参数梯度",
    );
    expect(bodyById.get("math.probability-statistics")).toContain(
      "少一个独立自由度",
    );
    expect(bodyById.get("math.probability-statistics")).toContain(
      "rng.gauss(mean, standard_deviation)",
    );
  });

  it("math-vision-lab 仍为 draft，只补 requirement、evidence、capability 与 application 映射", () => {
    const project = contentManifest.projects.find(
      ({ id }) => id === "project.math-vision-lab",
    );

    expect(project).toMatchObject({
      publicationStatus: "draft",
      techStack: [],
      resources: [],
      environmentRequirements: [],
      executionPaths: [],
      acceptanceCriteria: [],
      deliverableRequirements: [],
    });
    expect(project?.conceptRequirements.slice(0, 4)).toEqual(
      stageOneAConceptIds.map((conceptId) => ({
        conceptId,
        kind: "hard",
        minimumStatus: "understood",
        reason: expect.any(String),
      })),
    );
    expect(project?.evidenceConceptIds.slice(0, 4)).toEqual(stageOneAConceptIds);
    expect(project?.capabilitySummary).toHaveLength(1);
    expect(project?.realWorldApplications).toHaveLength(1);
  });

  it("新 Concept 自动进入 Knowledge、Roadmap、Graph，初始进度与 NextStep 不越过 readiness", () => {
    const knowledge = buildKnowledgeView(contentManifest);
    const roadmap = buildRoadmapView(contentManifest);
    const graph = buildGlobalKnowledgeGraphCatalog(contentManifest);
    const initialState = createInitialLearningState(
      contentManifest.tracks,
      "2026-08-30T00:00:00.000Z",
    );
    const nextStep = getNextStep({ catalog: contentManifest, state: initialState });

    stageOneAConceptIds.forEach((conceptId) => {
      expect(
        knowledge.concepts.some(({ concept }) => concept.id === conceptId),
      ).toBe(true);
      expect(graph.nodes.some(({ id }) => id === conceptId)).toBe(true);
      expect(getConceptStatus(initialState.conceptProgress, conceptId)).toBe(
        "not_started",
      );
    });
    expect(
      roadmap.availableStages.some(
        ({ stage }) => stage.id === "stage.vision-math-immediate",
      ),
    ).toBe(true);
    expect(nextStep).toMatchObject({
      kind: "recommendation",
      targetId: "tooling.computer-files",
      reasonCode: "project-gap",
    });
  });
});
