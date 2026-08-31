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

const stageOneBConceptIds = [
  "math.coordinate-frames",
  "math.least-squares",
  "math.eigen-svd",
  "math.optimization",
  "math.numerical-stability",
] as const;
const stageOneBConceptIdSet = new Set<string>(stageOneBConceptIds);

const unpublishedStageOneBConceptIds = ["math.lie-groups"] as const;

const expectedDependencies = [
  ["math.linear-transforms", "math.coordinate-frames", "hard"],
  ["math.vectors-matrices", "math.least-squares", "hard"],
  ["math.probability-statistics", "math.least-squares", "recommended"],
  ["math.linear-transforms", "math.eigen-svd", "hard"],
  ["math.least-squares", "math.eigen-svd", "recommended"],
  ["math.calculus-gradients", "math.optimization", "hard"],
  ["math.least-squares", "math.optimization", "hard"],
  ["math.probability-statistics", "math.optimization", "recommended"],
  ["math.least-squares", "math.numerical-stability", "hard"],
  ["math.eigen-svd", "math.numerical-stability", "hard"],
  ["math.probability-statistics", "math.numerical-stability", "recommended"],
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

describe("Phase 9 Stage 1B 正式学习内容", () => {
  it("发布五个 Stage 1B 必修 Concept，并保持 checkpoint 为 available", () => {
    const concepts = contentManifest.concepts
      .filter(
        ({ stageId }) =>
          stageId === "stage.vision-math-geometry-optimization",
      )
      .toSorted((left, right) => left.order - right.order);
    const stage = contentManifest.stages.find(
      ({ id }) => id === "stage.vision-math-geometry-optimization",
    );

    expect(concepts.map(({ id }) => id)).toEqual(stageOneBConceptIds);
    expect(concepts.map(({ order }) => order)).toEqual([10, 20, 30, 40, 50]);
    expect(
      concepts.every(
        ({ publicationStatus, requiredness, trackIds }) =>
          publicationStatus === "published" &&
          requiredness === "required" &&
          trackIds.includes("track.common"),
      ),
    ).toBe(true);
    expect(concepts.slice(0, 4).every(({ targetDepth }) => targetDepth === "master")).toBe(
      true,
    );
    expect(concepts[4]).toMatchObject({
      id: "math.numerical-stability",
      targetDepth: "understand",
    });
    expect(stage).toMatchObject({ contentStatus: "available" });
    expect(stage && "entryGate" in stage ? stage.entryGate : undefined).toBeUndefined();
    expect(stage?.exitCriteria).toHaveLength(2);
    expect(
      stage && "retestAfterDays" in stage ? stage.retestAfterDays : undefined,
    ).toBe(7);

    unpublishedStageOneBConceptIds.forEach((conceptId) => {
      expect(contentManifest.concepts.map(({ id }) => String(id))).not.toContain(
        conceptId,
      );
    });
  });

  it("依赖与 ROADMAP 一致，保持七条 hard 与四条 recommended 边", () => {
    const dependencies = contentManifest.dependencies.filter(({ targetId }) =>
      stageOneBConceptIdSet.has(targetId),
    );

    expect(
      dependencies.map(({ prerequisiteId, targetId, kind }) => [
        prerequisiteId,
        targetId,
        kind,
      ]),
    ).toEqual(expect.arrayContaining([...expectedDependencies]));
    expect(dependencies).toHaveLength(expectedDependencies.length);
    expect(dependencies.filter(({ kind }) => kind === "hard")).toHaveLength(7);
    expect(
      dependencies.filter(({ kind }) => kind === "recommended"),
    ).toHaveLength(4);
    expect(
      dependencies.flatMap(({ prerequisiteId, targetId }) => [
        String(prerequisiteId),
        String(targetId),
      ]),
    ).not.toContain("python.numpy-arrays");
  });

  it("五篇正文形成完整学习闭环，且 mastery 要求均有正文支架", async () => {
    const workspaceRoot = process.cwd();
    const concepts = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts/math"),
      workspaceRoot,
      schema: conceptMetaSchema,
    });
    const stageOneBConcepts = concepts.filter(({ meta }) =>
      stageOneBConceptIdSet.has(meta.id),
    );

    expect(stageOneBConcepts).toHaveLength(stageOneBConceptIds.length);
    stageOneBConcepts.forEach(({ body, meta }) => {
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

    const bodyById = new Map(
      stageOneBConcepts.map(({ body, meta }) => [meta.id, body]),
    );
    expect(bodyById.get("math.coordinate-frames")).toContain("[P]_A");
    expect(bodyById.get("math.coordinate-frames")).toContain("往返误差");
    expect(bodyById.get("math.least-squares")).toContain("numpy.linalg.lstsq");
    expect(bodyById.get("math.least-squares")).toContain("异常值");
    expect(bodyById.get("math.eigen-svd")).toContain("U, s, Vh");
    expect(bodyById.get("math.eigen-svd")).toContain("rank-1");
    expect(bodyById.get("math.optimization")).toContain("central_difference");
    expect(bodyById.get("math.optimization")).toContain("L2 regularization");
    expect(bodyById.get("math.numerical-stability")).toContain(
      "conditioning",
    );
    expect(bodyById.get("math.numerical-stability")).toContain(
      "residual 不等于 reliability",
    );
  });

  it("Phase 9B-R1 的定点教学支架与数学边界保持一致", async () => {
    const workspaceRoot = process.cwd();
    const concepts = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts/math"),
      workspaceRoot,
      schema: conceptMetaSchema,
    });
    const bodyById = new Map(
      concepts
        .filter(({ meta }) => stageOneBConceptIdSet.has(meta.id))
        .map(({ body, meta }) => [meta.id, body]),
    );

    const coordinateFrames = bodyById.get("math.coordinate-frames");
    expect(coordinateFrames).toContain(
      "R_{A\\leftarrow C}=R_{A\\leftarrow B}R_{B\\leftarrow C}",
    );
    expect(coordinateFrames).toContain(
      "t_{A\\leftarrow C}=R_{A\\leftarrow B}t_{B\\leftarrow C}+t_{A\\leftarrow B}",
    );
    expect(coordinateFrames).toContain("必须先用 $R_{A\\leftarrow B}$");
    expect(coordinateFrames).toContain("最小三坐标系复合");

    const leastSquares = bodyById.get("math.least-squares");
    expect(leastSquares).toContain("不是最小目标值本身");
    expect(leastSquares).toContain("残差向量每一项平方后相加");
    expect(leastSquares).toContain("pixel²");
    expect(leastSquares).toContain("满列秩的最低限度直觉");
    expect(leastSquares).toContain("rank == design.shape[1]");
    expect(leastSquares).toContain("本页不要求解释 singular values");
    expect(leastSquares).not.toContain("指出哪个点影响最大");

    const eigenSvd = bodyById.get("math.eigen-svd");
    expect(eigenSvd).toContain("两者不是同一种分解");
    expect(eigenSvd).toContain("k=\\min(m,n)");
    expect(eigenSvd).toContain("一维奇异值向量");
    expect(eigenSvd).toContain("带尺度的样本 scores / 坐标是 $U\\Sigma$");
    expect(eigenSvd).toContain("sigma = np.diag(s)");
    expect(eigenSvd).toContain("`U` 是 $4\\times2$");
    expect(eigenSvd).not.toContain("点在各模式上的系数");

    const optimization = bodyById.get("math.optimization");
    expect(optimization).toContain("不是最小目标值本身");
    expect(optimization).toContain("$\\lambda\\ge 0$");
    expect(optimization).toContain("越大，把参数向 0 收缩的作用越强");
    expect(optimization).toContain("图像空间梯度 $\\nabla I(x,y)$");
    expect(optimization).toContain("参数梯度 $\\nabla_\\theta L$");

    const roadmap = await readFile(resolve(workspaceRoot, "ROADMAP.md"), "utf8");
    expect(roadmap).toContain(
      "`stage.vision-math-geometry-optimization` 与 `stage.image-computing` 为 `available`",
    );
    expect(roadmap).toContain(
      "其中包括 `math.numerical-stability`；A 级选修 `math.lie-groups` 仍未发布",
    );
  });

  it("Phase 9C 数值可靠性正文保持 understand 深度与正确边界", async () => {
    const workspaceRoot = process.cwd();
    const concepts = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts/math"),
      workspaceRoot,
      schema: conceptMetaSchema,
    });
    const concept = concepts.find(
      ({ meta }) => meta.id === "math.numerical-stability",
    );

    expect(concept?.meta).toMatchObject({
      targetDepth: "understand",
      publicationStatus: "published",
      dependencies: [
        { conceptId: "math.least-squares", kind: "hard" },
        { conceptId: "math.eigen-svd", kind: "hard" },
        { conceptId: "math.probability-statistics", kind: "recommended" },
      ],
      resourceIds: ["resource.numpy-linear-algebra"],
    });
    expect(concept?.body).toContain(
      "条件性（conditioning）**描述问题本身对输入扰动有多敏感",
    );
    expect(concept?.body).toContain(
      "数值稳定性（numerical stability）**描述计算过程是否",
    );
    expect(concept?.body).toContain(
      "\\kappa_2(A)=\\frac{\\sigma_{\\max}}{\\sigma_{\\min}}",
    );
    expect(concept?.body).toContain("若矩阵 rank-deficient");
    expect(concept?.body).toContain("residual 不等于 reliability");
    expect(concept?.body).toContain("parameter change norm");
    expect(concept?.body).toContain("这不是 `numpy.linalg.lstsq` 的程序错误");
    expect(concept?.body).toContain("正确映射回原单位");
    expect(concept?.body).toContain("不能修复结构性列相关或退化几何");
    expect(concept?.body).toContain("$\\hat x$ 是估计值或计算值");
    expect(concept?.body).toContain(
      "condition indicator 就是 `numpy.linalg.cond(A)` 默认返回的二范数条件数",
    );
    expect(concept?.body).toContain("各分量平方、相加、再开根号");
    expect(concept?.body).toContain("也就是 `0.002%`");
    expect(concept?.body).toContain("position_um / 1000.0");
    expect(concept?.body).toContain("约 `6708.20`");
    expect(concept?.body).toContain("约 `7.47`");
    expect(concept?.body).toContain("x_from_scaled = np.array([z[0] / 1000.0, z[1]])");
    expect(concept?.body).toContain("两种表示描述的是同一个物理问题");
    expect(concept?.body).toContain("数据并没有因此获得新的独立信息");
    expect(concept?.body).toContain("不能根治结构性病态");
    expect(concept?.body).toContain("可以直接使用本页代码骨架");
    expect(concept?.body).toContain("不要求独立设计完整数值分析流程");
    expect(concept?.body).not.toContain("求逆永远错误");
    expect(concept?.body).not.toContain("backward error 完整理论");
  });

  it("资源少而精、URL 已验证且阅读范围包含必看、选看与跳过", () => {
    const resourceIds = [
      "resource.mit-ocw-linear-algebra",
      "resource.numpy-linear-algebra",
      "resource.stanford-cs231n-optimization",
    ] as const;

    resourceIds.forEach((resourceId) => {
      const resource = contentManifest.resources.find(
        ({ id }) => id === resourceId,
      );
      expect(resource).toMatchObject({
        verification: "verified",
        lastCheckedAt: "2026-08-30",
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

    const mitScope = contentManifest.resources
      .find(({ id }) => id === "resource.mit-ocw-linear-algebra")
      ?.recommendedParts.join(" ");
    const numpyScope = contentManifest.resources
      .find(({ id }) => id === "resource.numpy-linear-algebra")
      ?.recommendedParts.join(" ");

    expect(mitScope).toContain("projection matrix");
    expect(mitScope).toContain("A^T A");
    expect(mitScope).toContain("谱定理");
    expect(numpyScope).toContain("只记录 rank 是否等于参数数目");
    expect(numpyScope).toContain("singular values 留给 eigen/SVD Concept");
    expect(numpyScope).toContain("numpy.linalg.cond");
    expect(numpyScope).toContain("矩阵范数证明");
  });

  it("math-vision-lab 保持 draft，只扩充正式 requirement 与 evidence 映射", () => {
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
    expect(project?.conceptRequirements.map(({ conceptId }) => conceptId)).toEqual([
      "math.vectors-matrices",
      "math.linear-transforms",
      "math.calculus-gradients",
      "math.probability-statistics",
      ...stageOneBConceptIds,
    ]);
    expect(project?.conceptRequirements.slice(-5)).toEqual(
      stageOneBConceptIds.map((conceptId) => ({
        conceptId,
        kind: "hard",
        minimumStatus: "understood",
        reason: expect.any(String),
      })),
    );
    expect(project?.evidenceConceptIds.slice(-5)).toEqual(stageOneBConceptIds);
    expect(project?.capabilitySummary).toHaveLength(1);
    expect(project?.realWorldApplications).toHaveLength(1);
  });

  it("新内容自动进入 Knowledge、Roadmap、Graph，初始状态与 NextStep 保持正确", () => {
    const knowledge = buildKnowledgeView(contentManifest);
    const roadmap = buildRoadmapView(contentManifest);
    const graph = buildGlobalKnowledgeGraphCatalog(contentManifest);
    const initialState = createInitialLearningState(
      contentManifest.tracks,
      "2026-08-30T00:00:00.000Z",
    );
    const nextStep = getNextStep({ catalog: contentManifest, state: initialState });

    stageOneBConceptIds.forEach((conceptId) => {
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
        ({ stage }) =>
          stage.id === "stage.vision-math-geometry-optimization",
      ),
    ).toBe(true);
    expect(nextStep).toMatchObject({
      kind: "recommendation",
      targetId: "tooling.computer-files",
      reasonCode: "project-gap",
    });
  });
});
