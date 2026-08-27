import { describe, expect, it } from "vitest";

import {
  conceptMetaSchema,
  conceptProgressSchema,
  dependencySchema,
  deriveDependencies,
  parseDomainData,
  projectMetaSchema,
  resourceSchema,
  stageDefinitionSchema,
  trackDefinitionSchema,
} from "@/lib/validation";

const validConcept = {
  schemaVersion: 1,
  id: "testing.image-arrays",
  slug: "image-arrays",
  legacySlugs: ["pixel-arrays"],
  title: "图像数组",
  englishTitle: "Image Arrays",
  aliases: ["像素数组"],
  searchKeywords: ["array", "pixel"],
  summary: "理解图像的形状、类型和通道。",
  why: "这是检查机器视觉输入数据的基础。",
  stageId: "stage.image-computing",
  trackIds: ["track.common"],
  order: 10,
  level: "beginner",
  requiredness: "required",
  targetDepth: "master",
  estimatedHours: { min: 2, max: 4 },
  dependencies: [
    {
      conceptId: "testing.python-core",
      kind: "hard",
      reason: "需要先理解 Python 基础。",
    },
  ],
  relatedConceptIds: ["testing.image-io"],
  tags: ["Python", "Image"],
  learningOutcomes: ["能够解释图像数组的轴。"],
  masteryCriteria: [
    {
      id: "criterion.explain-axes",
      description: "解释图像数组各轴的含义。",
      evidenceHint: "提交带形状说明的最小实验。",
      required: true,
    },
  ],
  resourceIds: ["resource.numpy-docs"],
  searchEntries: [
    {
      id: "search.array-shape",
      kind: "tool",
      title: "shape",
      aliases: ["数组形状"],
      anchor: "array-shape",
    },
  ],
  publicationStatus: "published",
  contentVersion: "2026.08.27",
} as const;

const validStage = {
  id: "stage.image-computing",
  categoryOrder: 2,
  order: 20,
  title: "Stage 2",
  summary: "图像计算基础。",
  contentStatus: "available",
  trackIds: ["track.common"],
  categoryExitForTrackIds: ["track.common"],
  outcomes: ["能检查图像数据契约。"],
  estimatedHours: { min: 60, max: 75 },
  projectGates: [
    {
      projectId: "project.pixel-lab",
      when: { kind: "always" },
    },
  ],
  entryGate: { kind: "checkpoint", stageId: "stage.tooling-foundations" },
  exitCriteria: [
    {
      id: "criterion.reproducible-pipeline",
      description: "能够复现图像处理流水线。",
      required: true,
      when: { kind: "always" },
    },
  ],
  retestAfterDays: 7,
} as const;

const validProject = {
  schemaVersion: 1,
  id: "project.pixel-lab",
  slug: "pixel-lab",
  title: "像素实验室",
  level: "beginner",
  trackIds: ["track.common"],
  conceptRequirements: [
    {
      conceptId: "testing.image-arrays",
      kind: "hard",
      minimumStatus: "understood",
      reason: "项目需要正确读取图像数组。",
    },
  ],
  estimatedHours: { min: 12, max: 18 },
  techStack: ["Python", "NumPy"],
  resources: [
    {
      resourceId: "resource.numpy-docs",
      role: "documentation",
      required: true,
    },
  ],
  environmentRequirements: [
    {
      id: "environment.python",
      kind: "software",
      label: "Python 环境",
      required: true,
      details: "能够运行项目脚本。",
    },
    {
      id: "environment.sample-images",
      kind: "dataset",
      label: "示例图片",
      required: true,
      details: "使用自摄或合成图片。",
    },
  ],
  executionPaths: [
    {
      id: "path.preferred-camera",
      title: "普通摄像头路径",
      mode: "preferred-hardware",
      requirementIds: ["environment.python", "environment.sample-images"],
      evidenceBoundary: "只证明普通摄像头输入下的图像数据处理能力。",
    },
    {
      id: "path.simulation",
      title: "合成图片路径",
      mode: "simulation",
      requirementIds: ["environment.python", "environment.sample-images"],
      evidenceBoundary: "不外推真实相机性能。",
    },
  ],
  acceptanceCriteria: [
    {
      id: "acceptance.bad-file",
      description: "坏文件会显式失败。",
      required: true,
    },
  ],
  deliverableRequirements: ["README 与可运行脚本"],
  evidenceConceptIds: ["testing.image-arrays"],
  resumeOutcome: "能说明自己完成的输入检查与失败处理。",
  tags: ["Python", "Beginner"],
  publicationStatus: "published",
  contentVersion: "2026.08.27",
} as const;

const passedEvidence = {
  id: "evidence.array-experiment",
  conceptId: "testing.image-arrays",
  criterionIds: ["criterion.explain-axes"],
  kind: "exercise",
  title: "数组轴实验",
  note: "独立解释并验证了各轴。",
  result: "passed",
  completedAt: "2026-08-27T01:00:00.000Z",
  reference: "artifacts/array-experiment.md",
  createdAt: "2026-08-27T01:10:00.000Z",
  updatedAt: "2026-08-27T01:10:00.000Z",
} as const;

const validMasteredProgress = {
  status: "mastered",
  note: "已完成独立实验。",
  favorite: true,
  userDifficulty: 2,
  startedAt: "2026-08-25T01:00:00.000Z",
  understoodAt: "2026-08-26T01:00:00.000Z",
  firstMasteredAt: "2026-08-27T02:00:00.000Z",
  lastMasteredAt: "2026-08-27T02:00:00.000Z",
  updatedAt: "2026-08-27T02:00:00.000Z",
  evidence: [passedEvidence],
  masteryConfirmation: {
    confirmedAt: "2026-08-27T02:00:00.000Z",
    criterionIds: ["criterion.explain-axes"],
    evidenceIds: ["evidence.array-experiment"],
    statementVersion: 1,
  },
} as const;

describe("ConceptMeta 与 Dependency schema", () => {
  it("接受符合规划契约的概念，并保留永久 ID 与 canonical slug", () => {
    const parsed = conceptMetaSchema.parse(validConcept);

    expect(parsed.id).toBe("testing.image-arrays");
    expect(parsed.slug).toBe("image-arrays");
    expect(parsed.schemaVersion).toBe(1);
  });

  it.each([
    ["大写 ID", { id: "Testing.ImageArrays" }],
    ["非 kebab-case slug", { slug: "image_arrays" }],
    [
      "advanced 必修节点",
      { targetDepth: "advanced", requiredness: "required" },
    ],
    [
      "自身依赖",
      {
        dependencies: [
          {
            conceptId: "testing.image-arrays",
            kind: "hard",
            reason: "错误的自引用。",
          },
        ],
      },
    ],
    [
      "重复依赖",
      {
        dependencies: [
          {
            conceptId: "testing.python-core",
            kind: "hard",
            reason: "第一条。",
          },
          {
            conceptId: "testing.python-core",
            kind: "recommended",
            reason: "重复维护。",
          },
        ],
      },
    ],
  ])("拒绝%s", (_label, override) => {
    const result = conceptMetaSchema.safeParse({ ...validConcept, ...override });
    expect(result.success).toBe(false);
  });

  it("要求已发布概念至少有一项必需掌握标准", () => {
    const result = conceptMetaSchema.safeParse({
      ...validConcept,
      masteryCriteria: [
        { ...validConcept.masteryCriteria[0], required: false },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("规范化 Dependency 明确包含 source、target 且拒绝自环", () => {
    expect(
      dependencySchema.parse({
        prerequisiteId: "testing.python-core",
        targetId: "testing.image-arrays",
        kind: "hard",
        rationale: "图像数组实验使用 Python。",
      }),
    ).toEqual({
      prerequisiteId: "testing.python-core",
      targetId: "testing.image-arrays",
      kind: "hard",
      rationale: "图像数组实验使用 Python。",
    });

    expect(
      dependencySchema.safeParse({
        prerequisiteId: "testing.image-arrays",
        targetId: "testing.image-arrays",
        kind: "hard",
        rationale: "错误自环。",
      }).success,
    ).toBe(false);
  });

  it("只从 ConceptMeta.dependencies 派生规范化依赖边", () => {
    const concept = conceptMetaSchema.parse(validConcept);

    expect(deriveDependencies([concept])).toEqual([
      {
        prerequisiteId: "testing.python-core",
        targetId: "testing.image-arrays",
        kind: "hard",
        rationale: "需要先理解 Python 基础。",
      },
    ]);
  });
});

describe("Stage、Track 与 Resource schema", () => {
  it("接受带 checkpoint 门槛、项目门槛和 7 天复测的 Stage", () => {
    expect(stageDefinitionSchema.parse(validStage).id).toBe(
      "stage.image-computing",
    );
  });

  it("拒绝不属于 Stage 的分类出口 Track 和 Stage 自引用", () => {
    expect(
      stageDefinitionSchema.safeParse({
        ...validStage,
        categoryExitForTrackIds: ["track.unknown"],
      }).success,
    ).toBe(false);
    expect(
      stageDefinitionSchema.safeParse({
        ...validStage,
        entryGate: {
          kind: "checkpoint",
          stageId: "stage.image-computing",
        },
      }).success,
    ).toBe(false);
  });

  it("固定公共 Track 的 master 目标，并要求高级分支声明互斥组", () => {
    expect(
      trackDefinitionSchema.safeParse({
        id: "track.common",
        order: 0,
        title: "公共主干",
        summary: "公共能力。",
        kind: "common",
        defaultGoal: "understand",
      }).success,
    ).toBe(false);
    expect(
      trackDefinitionSchema.safeParse({
        id: "track.industrial-3d",
        order: 1,
        title: "3D 工业",
        summary: "高级方向。",
        kind: "advanced-branch",
        defaultGoal: "master",
      }).success,
    ).toBe(false);
  });

  it("用判别联合约束资源验证状态", () => {
    const base = {
      id: "resource.numpy-docs",
      title: "NumPy Documentation",
      type: "official-doc",
      level: "beginner",
      priority: "essential",
      language: "en",
      reason: "官方数组文档。",
    } as const;

    expect(
      resourceSchema.safeParse({
        ...base,
        verification: "pending",
        verificationNote: "等待下一阶段联网核验。",
      }).success,
    ).toBe(true);
    expect(
      resourceSchema.safeParse({
        ...base,
        verification: "verified",
        url: "https://numpy.org/doc/",
        verifiedAt: "2026-08-27",
      }).success,
    ).toBe(false);
    expect(
      resourceSchema.safeParse({
        ...base,
        verification: "broken",
        url: "https://example.invalid/old",
        lastCheckedAt: "2026-08-27",
        verificationNote: "链接失效。",
        replacementResourceId: "resource.numpy-docs",
      }).success,
    ).toBe(false);
  });
});

describe("ProjectMeta schema", () => {
  it("接受具有可验收替代路径的项目元数据", () => {
    const parsed = projectMetaSchema.parse(validProject);
    expect(parsed.executionPaths.map((path) => path.mode)).toEqual([
      "preferred-hardware",
      "simulation",
    ]);
  });

  it("拒绝不存在的环境要求引用和缺少替代路径的已发布硬件项目", () => {
    const badReference = {
      ...validProject,
      executionPaths: [
        {
          ...validProject.executionPaths[0],
          requirementIds: ["environment.missing"],
        },
        validProject.executionPaths[1],
      ],
    };
    expect(projectMetaSchema.safeParse(badReference).success).toBe(false);

    const noAlternative = {
      ...validProject,
      executionPaths: [validProject.executionPaths[0]],
    };
    expect(projectMetaSchema.safeParse(noAlternative).success).toBe(false);
  });
});

describe("MasteryEvidence 与 ConceptProgress schema", () => {
  it("只在通过证据与手动确认快照一致时接受 mastered", () => {
    expect(conceptProgressSchema.parse(validMasteredProgress).status).toBe(
      "mastered",
    );
  });

  it("拒绝缺少确认、失败证据和未覆盖标准", () => {
    const withoutConfirmation = {
      ...validMasteredProgress,
      masteryConfirmation: undefined,
    };
    expect(
      conceptProgressSchema.safeParse(withoutConfirmation).success,
    ).toBe(false);

    const failedEvidenceProgress = {
      ...validMasteredProgress,
      evidence: [{ ...passedEvidence, result: "failed" }],
    };
    expect(
      conceptProgressSchema.safeParse(failedEvidenceProgress).success,
    ).toBe(false);

    const uncoveredProgress = {
      ...validMasteredProgress,
      masteryConfirmation: {
        ...validMasteredProgress.masteryConfirmation,
        criterionIds: ["criterion.not-covered"],
      },
    };
    expect(conceptProgressSchema.safeParse(uncoveredProgress).success).toBe(
      false,
    );
  });
});

describe("构建期错误接口", () => {
  it("拒绝 Schema 未声明的字段，避免拼写错误被静默忽略", () => {
    expect(
      conceptMetaSchema.safeParse({
        ...validConcept,
        unknowField: "typo",
      }).success,
    ).toBe(false);
  });

  it("错误消息包含来源路径、字段路径和原因", () => {
    expect(() =>
      parseDomainData(
        conceptMetaSchema,
        { ...validConcept, slug: "Bad_Slug" },
        "content/concepts/testing/image-arrays.mdx",
      ),
    ).toThrow(
      /content\/concepts\/testing\/image-arrays\.mdx:slug: 必须是小写 kebab-case slug/,
    );
  });
});
