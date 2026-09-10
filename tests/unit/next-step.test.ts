import { describe, expect, it } from "vitest";
import { stageHistory } from "../fixtures/stage-history";

import { contentManifest } from "../../.generated/content-manifest";
import {
  getNextStep,
  type NextStepCatalog,
} from "@/features/recommendations";
import { createInitialLearningState } from "@/lib/storage";
import type {
  ConceptMeta,
  ConceptProgress,
  LearningStateV3,
  ProjectMeta,
  StageDefinition,
  TrackDefinition,
} from "@/types";

const timestamp = "2026-08-28T06:00:00.000Z";

const commonTrack: TrackDefinition = {
  id: "track.common",
  order: 0,
  title: "公共主干",
  summary: "测试路线",
  kind: "common",
  defaultGoal: "master",
};

function stage(
  id = "stage.available",
  order = 0,
  contentStatus: StageDefinition["contentStatus"] = "available",
  entryGate?: StageDefinition["entryGate"],
): StageDefinition {
  return {
    id,
    categoryOrder: 0,
    order,
    title: id,
    summary: "测试阶段",
    contentStatus,
    trackIds: [commonTrack.id],
    categoryExitForTrackIds: [],
    outcomes: ["完成测试路线"],
    estimatedHours: { min: 1, max: 2 },
    projectGates: [],
    entryGate,
    exitCriteria: [
      {
        id: `stage-criterion.${id}.complete`,
        description: "完成阶段测试",
        required: true,
        when: { kind: "always" },
      },
    ],
  };
}

interface ConceptOptions {
  readonly order?: number;
  readonly stageId?: string;
  readonly publicationStatus?: ConceptMeta["publicationStatus"];
  readonly requiredness?: ConceptMeta["requiredness"];
  readonly targetDepth?: ConceptMeta["targetDepth"];
  readonly dependencies?: ConceptMeta["dependencies"];
  readonly criteria?: readonly string[];
}

function concept(id: string, options: ConceptOptions = {}): ConceptMeta {
  const criteria = options.criteria ?? [`完成 ${id} 的正式标准`];
  return {
    schemaVersion: 1,
    id,
    slug: id.replaceAll(".", "-"),
    title: `知识点 ${id}`,
    englishTitle: id,
    aliases: [],
    searchKeywords: [],
    summary: "测试知识点",
    why: "用于验证确定性推荐规则。",
    stageId: options.stageId ?? "stage.available",
    trackIds: [commonTrack.id],
    order: options.order ?? 0,
    level: "beginner",
    requiredness: options.requiredness ?? "required",
    targetDepth: options.targetDepth ?? "master",
    estimatedHours: { min: 2, max: 4 },
    dependencies: [...(options.dependencies ?? [])],
    tags: [],
    learningOutcomes: [`解释 ${id}`],
    masteryCriteria: criteria.map((description, index) => ({
      id: `criterion.${id}.${index}`,
      description,
      evidenceHint: "保存可检查证据。",
      required: true,
    })),
    resourceIds: [],
    publicationStatus: options.publicationStatus ?? "published",
    contentVersion: "test.1",
  };
}

function project(
  publicationStatus: ProjectMeta["publicationStatus"],
  requirements: ProjectMeta["conceptRequirements"],
  id = "project.current",
): ProjectMeta {
  return {
    schemaVersion: 1,
    id,
    slug: id.replaceAll(".", "-"),
    title: `项目 ${id}`,
    level: "beginner",
    trackIds: [commonTrack.id],
    problemStatement: "验证推荐服务中的项目缺口。",
    capabilitySummary: ["识别并补齐项目知识要求。"],
    realWorldApplications: ["推荐服务测试。"],
    conceptRequirements: requirements,
    estimatedHours: { min: 4, max: 8 },
    techStack: [],
    resources: [],
    environmentRequirements: [],
    executionPaths: [
      {
        id: `execution.${id}.test`,
        title: "测试路径",
        mode: "simulation",
        requirementIds: [],
        evidenceBoundary: "只验证推荐测试。",
      },
    ],
    acceptanceCriteria: [
      {
        id: `acceptance.${id}.test`,
        description: "完成项目测试",
        required: true,
      },
    ],
    deliverableRequirements: ["测试产物"],
    evidenceConceptIds: requirements.map(({ conceptId }) => conceptId),
    resumeOutcome: "继续测试",
    tags: [],
    publicationStatus,
    contentVersion: "test.1",
  };
}

function catalog(
  concepts: readonly ConceptMeta[],
  projects: readonly ProjectMeta[] = [],
  stages: readonly StageDefinition[] = [stage()],
): NextStepCatalog {
  return { concepts, projects, stages, tracks: [commonTrack] };
}

function conceptProgress(
  status: ConceptProgress["status"],
  conceptId = "concept.test",
): ConceptProgress {
  const base = {
    status,
    note: "",
    favorite: false,
    updatedAt: timestamp,
    evidence: [],
  } satisfies ConceptProgress;

  if (status === "not_started") return base;
  if (status === "learning") return { ...base, startedAt: timestamp };
  if (status === "understood") {
    return { ...base, startedAt: timestamp, understoodAt: timestamp };
  }

  const evidenceId = `evidence.${conceptId}`;
  const criterionId = `criterion.${conceptId}.0`;
  return {
    ...base,
    startedAt: timestamp,
    understoodAt: timestamp,
    firstMasteredAt: timestamp,
    lastMasteredAt: timestamp,
    evidence: [
      {
        id: evidenceId,
        conceptId,
        criterionIds: [criterionId],
        kind: "exercise",
        title: "测试证据",
        note: "",
        result: "passed",
        completedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    masteryConfirmation: {
      confirmedAt: timestamp,
      criterionIds: [criterionId],
      evidenceIds: [evidenceId],
      statementVersion: 1,
    },
  };
}

function state(
  progress: Readonly<Record<string, ConceptProgress>> = {},
): LearningStateV3 {
  return {
    ...createInitialLearningState([commonTrack], timestamp),
    conceptProgress: { ...progress },
  };
}

function hardRequirement(conceptId: string) {
  return {
    conceptId,
    kind: "hard" as const,
    minimumStatus: "understood" as const,
    reason: "项目必须具备该能力。",
  };
}

describe("Phase 4C-1 确定性 Next Step 推荐", () => {
  it("存在 learning Concept 时优先继续，不被 Project gap 抢占", () => {
    const foundation = concept("concept.foundation", { order: 10 });
    const learning = concept("concept.learning", { order: 20 });
    const result = getNextStep({
      catalog: catalog(
        [foundation, learning],
        [project("published", [hardRequirement(foundation.id)])],
      ),
      state: state({ [learning.id]: conceptProgress("learning", learning.id) }),
    });

    expect(result).toMatchObject({
      kind: "recommendation",
      targetId: learning.id,
      reasonCode: "continue-learning",
    });
  });

  it("多个 learning Concept 使用 Stage、Concept order 与 ID 的稳定路线顺序", () => {
    const earlier = concept("concept.earlier", { order: 10 });
    const later = concept("concept.later", { order: 20 });
    const result = getNextStep({
      catalog: catalog([later, earlier]),
      state: state({
        [later.id]: conceptProgress("learning", later.id),
        [earlier.id]: conceptProgress("learning", earlier.id),
      }),
    });

    expect(result).toMatchObject({ targetId: earlier.id });
  });

  it("没有 learning 时识别当前 published Project 的首个 hard 知识缺口", () => {
    const foundation = concept("concept.foundation");
    const currentProject = project("published", [hardRequirement(foundation.id)]);
    const result = getNextStep({
      catalog: catalog([foundation], [currentProject]),
      state: state(),
    });

    expect(result).toMatchObject({
      kind: "recommendation",
      targetId: foundation.id,
      reasonCode: "project-gap",
      relatedProject: { projectId: currentProject.id },
    });
  });

  it("draft Project 不参与 Project gap 推荐", () => {
    const foundation = concept("concept.foundation");
    const result = getNextStep({
      catalog: catalog(
        [foundation],
        [project("draft", [hardRequirement(foundation.id)])],
      ),
      state: state(),
    });

    expect(result).toMatchObject({
      targetId: foundation.id,
      reasonCode: "next-unlocked",
    });
  });

  it("hard prerequisite 未满足时绝不推荐被阻塞目标，而返回首个可执行前置", () => {
    const foundation = concept("concept.foundation", { order: 10 });
    const blocked = concept("concept.blocked", {
      order: 20,
      dependencies: [
        {
          conceptId: foundation.id,
          kind: "hard",
          reason: "先完成基础。",
        },
      ],
    });
    const result = getNextStep({
      catalog: catalog(
        [blocked, foundation],
        [project("published", [hardRequirement(blocked.id)])],
      ),
      state: state(),
    });

    expect(result).toMatchObject({
      targetId: foundation.id,
      reasonCode: "hard-prerequisite",
      requiredStatus: "understood",
    });
    expect(result).not.toMatchObject({ targetId: blocked.id });
  });

  it("recommended prerequisite 未满足不阻塞，只产生可解释提示", () => {
    const recommended = concept("concept.recommended", {
      order: 20,
      requiredness: "optional",
    });
    const target = concept("concept.target", {
      order: 10,
      dependencies: [
        {
          conceptId: recommended.id,
          kind: "recommended",
          reason: "先看直觉会更顺畅。",
        },
      ],
    });
    const result = getNextStep({
      catalog: catalog([recommended, target]),
      state: state(),
    });

    expect(result).toMatchObject({
      targetId: target.id,
      reasonCode: "next-unlocked",
      unmetRecommendedDependencies: [
        {
          conceptId: recommended.id,
          reason: "先看直觉会更顺畅。",
        },
      ],
    });
  });

  it("下一 unlocked 必修 Concept 按稳定路线顺序推荐", () => {
    const foundation = concept("concept.foundation", { order: 10 });
    const unlocked = concept("concept.unlocked", {
      order: 20,
      dependencies: [
        { conceptId: foundation.id, kind: "hard", reason: "需要基础。" },
      ],
    });
    const result = getNextStep({
      catalog: catalog([unlocked, foundation]),
      state: state({
        [foundation.id]: conceptProgress("understood", foundation.id),
      }),
    });

    expect(result).toMatchObject({
      targetId: unlocked.id,
      reasonCode: "next-unlocked",
    });
  });

  it("mastered Concept 不会重新推荐", () => {
    const mastered = concept("concept.mastered", { order: 10 });
    const next = concept("concept.next", { order: 20 });
    const result = getNextStep({
      catalog: catalog([mastered, next]),
      state: state({
        [mastered.id]: conceptProgress("mastered", mastered.id),
      }),
    });

    expect(result).toMatchObject({ targetId: next.id });
  });

  it("understood Concept 不会被当作新的 not_started 路线任务", () => {
    const understood = concept("concept.understood", { order: 10 });
    const next = concept("concept.next", { order: 20 });
    const result = getNextStep({
      catalog: catalog([understood, next]),
      state: state({
        [understood.id]: conceptProgress("understood", understood.id),
      }),
    });

    expect(result).toMatchObject({ targetId: next.id });
    expect(result).not.toMatchObject({ targetId: understood.id });
  });

  it("planned Stage 的 Concept 不进入推荐", () => {
    const complete = concept("concept.complete", {
      stageId: "stage.available",
      targetDepth: "understand",
    });
    const planned = concept("concept.planned", {
      stageId: "stage.planned",
    });
    const result = getNextStep({
      catalog: catalog(
        [complete, planned],
        [],
        [stage("stage.available", 0), stage("stage.planned", 10, "planned")],
      ),
      state: state({
        [complete.id]: conceptProgress("understood", complete.id),
      }),
    });

    expect(result).toMatchObject({ kind: "stage-exit", stageId: "stage.available" });
  });

  it("reasonCode 与确定性理由模板一致", () => {
    const target = concept("concept.target");
    const currentProject = project("published", [hardRequirement(target.id)]);
    const result = getNextStep({
      catalog: catalog([target], [currentProject]),
      state: state(),
    });

    expect(result).toMatchObject({
      reasonCode: "project-gap",
      reasonText: `「${currentProject.title}」需要「${target.title}」达到已理解，这是当前项目尚缺少的能力。`,
    });
  });

  it("completion criteria 与 estimatedTime 直接来自正式 Concept", () => {
    const criteria = ["独立解释输入输出", "完成带失败样例的实验"];
    const target = concept("concept.target", { criteria });
    const result = getNextStep({
      catalog: catalog([target]),
      state: state(),
    });

    expect(result).toMatchObject({
      completionCriteria: criteria,
      estimatedTime: { minHours: 2, maxHours: 4 },
    });
  });

  it("相同 catalog 与 Progress 重复计算得到完全相同结果且不修改输入", () => {
    const target = concept("concept.target");
    const input = { catalog: catalog([target]), state: state() };
    const snapshot = JSON.stringify(input);

    expect(getNextStep(input)).toEqual(getNextStep(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("个人笔记、收藏与自评难度不改变 NextStep 派生结果", () => {
    const target = concept("concept.target");
    const currentProject = project("published", [hardRequirement(target.id)]);
    const baseState = state();
    const baseline = getNextStep({
      catalog: catalog([target], [currentProject]),
      state: baseState,
    });
    const personalState = state({
      [target.id]: {
        ...conceptProgress("not_started", target.id),
        note: "只属于我的笔记",
        favorite: true,
        userDifficulty: 5,
      },
    });

    expect(
      getNextStep({
        catalog: catalog([target], [currentProject]),
        state: personalState,
      }),
    ).toEqual(baseline);
  });

  it("Stage entryGate 不消费 B1 reserved history，不越过门槛", () => {
    const sourceStage = stage("stage.source", 0);
    const gatedStage = stage("stage.gated", 10, "available", {
      kind: "checkpoint",
      stageId: sourceStage.id,
    });
    const source = concept("concept.source", {
      stageId: sourceStage.id,
      targetDepth: "understand",
    });
    const gated = concept("concept.gated", { stageId: gatedStage.id });
    const sourceUnderstood = state({
      [source.id]: conceptProgress("understood", source.id),
    });

    expect(
      getNextStep({
        catalog: catalog([source, gated], [], [sourceStage, gatedStage]),
        state: sourceUnderstood,
      }),
    ).toMatchObject({ kind: "stage-exit", stageId: sourceStage.id });

    const gateSatisfied: LearningStateV3 = {
      ...sourceUnderstood,
      stageCheckpoints: {
        [sourceStage.id]: stageHistory(sourceStage.id, timestamp),
      },
    };
    expect(
      getNextStep({
        catalog: catalog([source, gated], [], [sourceStage, gatedStage]),
        state: gateSatisfied,
      }),
    ).toMatchObject({
      kind: "stage-exit",
      stageId: sourceStage.id,
    });
  });

  it("Project gap 不跨越未满足的 Stage entryGate", () => {
    const sourceStage = stage("stage.source", 0);
    const gatedStage = stage("stage.gated", 10, "available", {
      kind: "checkpoint",
      stageId: sourceStage.id,
    });
    const source = concept("concept.source", {
      stageId: sourceStage.id,
      targetDepth: "understand",
    });
    const gated = concept("concept.gated", { stageId: gatedStage.id });
    const currentProject = project("published", [hardRequirement(gated.id)]);
    const result = getNextStep({
      catalog: catalog(
        [source, gated],
        [currentProject],
        [sourceStage, gatedStage],
      ),
      state: state({
        [source.id]: conceptProgress("understood", source.id),
      }),
    });

    expect(result).toMatchObject({ kind: "stage-exit", stageId: sourceStage.id });
    expect(result).not.toMatchObject({ targetId: gated.id });
  });

  it("后续 gate 变化时不继续推荐已处于 learning 的非法 Stage Concept", () => {
    const sourceStage = stage("stage.source", 0);
    const gatedStage = stage("stage.gated", 10, "available", {
      kind: "checkpoint",
      stageId: sourceStage.id,
    });
    const source = concept("concept.source", {
      stageId: sourceStage.id,
      targetDepth: "understand",
    });
    const gated = concept("concept.gated", { stageId: gatedStage.id });
    const result = getNextStep({
      catalog: catalog([source, gated], [], [sourceStage, gatedStage]),
      state: state({
        [gated.id]: conceptProgress("learning", gated.id),
      }),
    });

    expect(result).toMatchObject({
      kind: "recommendation",
      targetId: source.id,
      reasonCode: "next-unlocked",
    });
    expect(result).not.toMatchObject({ targetId: gated.id });
  });

  it("全部 published Concept 达标后仍须处理出口证据", () => {
    const first = concept("concept.first", { order: 10 });
    const second = concept("concept.second", { order: 20 });
    const result = getNextStep({
      catalog: catalog(
        [first, second],
        [project("published", [hardRequirement(first.id)])],
      ),
      state: state({
        [first.id]: conceptProgress("mastered", first.id),
        [second.id]: conceptProgress("mastered", second.id),
      }),
    });

    expect(result).toMatchObject({ kind: "stage-exit", stageId: "stage.available" });
  });

  it("当前仓库初始状态确定性推荐 Pixel Lab 的首个 Stage 0 缺口", () => {
    const initialState = createInitialLearningState(
      contentManifest.tracks,
      timestamp,
    );
    const result = getNextStep({
      catalog: contentManifest,
      state: initialState,
    });

    expect(result).toMatchObject({
      kind: "recommendation",
      targetId: "tooling.computer-files",
      reasonCode: "project-gap",
      relatedProject: { projectId: "project.pixel-lab" },
    });
  });
});
