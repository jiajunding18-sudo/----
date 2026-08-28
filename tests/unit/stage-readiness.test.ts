import { describe, expect, it } from "vitest";

import { getStageReadiness } from "@/features/progress/stage-readiness";
import { createInitialLearningState } from "@/lib/storage";
import type {
  CheckpointGate,
  ConceptMeta,
  ConceptProgress,
  LearningStateV1,
  ProjectMeta,
  ProjectProgress,
  StageDefinition,
  TrackDefinition,
  TrackGoal,
} from "@/types";

const timestamp = "2026-08-29T01:00:00.000Z";
const retestTimestamp = "2026-08-06T01:00:00.000Z";

const tracks: readonly TrackDefinition[] = [
  {
    id: "track.common",
    order: 0,
    title: "公共主干",
    summary: "测试公共路线",
    kind: "common",
    defaultGoal: "master",
  },
  {
    id: "track.industrial-3d",
    order: 10,
    title: "3D 工业视觉",
    summary: "测试高级路线",
    kind: "advanced-branch",
    defaultGoal: "master",
    exclusiveMasteryGroup: "track-group.advanced",
  },
  {
    id: "track.computational-imaging",
    order: 20,
    title: "计算成像",
    summary: "测试高级路线",
    kind: "advanced-branch",
    defaultGoal: "understand",
    exclusiveMasteryGroup: "track-group.advanced",
  },
];

interface StageOptions {
  readonly entryGate?: CheckpointGate;
  readonly projectGates?: StageDefinition["projectGates"];
  readonly exitCriteria?: StageDefinition["exitCriteria"];
  readonly retestAfterDays?: number;
}

function stage(id: string, options: StageOptions = {}): StageDefinition {
  return {
    id,
    categoryOrder: 0,
    order: 0,
    title: `阶段 ${id}`,
    summary: "用于 Stage readiness 测试。",
    contentStatus: "available",
    trackIds: tracks.map(({ id: trackId }) => trackId),
    categoryExitForTrackIds: [],
    outcomes: ["完成测试"],
    estimatedHours: { min: 1, max: 2 },
    projectGates: [...(options.projectGates ?? [])],
    entryGate: options.entryGate,
    exitCriteria: options.exitCriteria ?? [exitCriterion(id)],
    retestAfterDays: options.retestAfterDays,
  };
}

function exitCriterion(
  stageId: string,
  when: StageDefinition["exitCriteria"][number]["when"] = { kind: "always" },
) {
  return {
    id: `stage-criterion.${stageId}.complete`,
    description: `完成 ${stageId} 的正式出口证据`,
    required: true,
    when,
  };
}

function concept(stageId: string): ConceptMeta {
  const id = `concept.${stageId.replace("stage.", "")}`;
  return {
    schemaVersion: 1,
    id,
    slug: id.replaceAll(".", "-"),
    title: `知识点 ${id}`,
    englishTitle: id,
    aliases: [],
    searchKeywords: [],
    summary: "测试知识点",
    why: "验证 checkpoint 使用正式 Concept 条件。",
    stageId,
    trackIds: ["track.common"],
    order: 0,
    level: "beginner",
    requiredness: "required",
    targetDepth: "understand",
    estimatedHours: { min: 1, max: 2 },
    dependencies: [],
    tags: [],
    learningOutcomes: ["完成测试"],
    masteryCriteria: [
      {
        id: `criterion.${id}.complete`,
        description: "完成知识点测试",
        evidenceHint: "保存证据",
        required: true,
      },
    ],
    resourceIds: [],
    publicationStatus: "published",
    contentVersion: "test.1",
  };
}

function project(conceptId: string): ProjectMeta {
  return {
    schemaVersion: 1,
    id: "project.checkpoint",
    slug: "checkpoint-project",
    title: "Checkpoint 项目",
    level: "beginner",
    trackIds: ["track.common"],
    problemStatement: "验证 Stage 项目门槛。",
    capabilitySummary: ["识别项目知识与完成门槛。"],
    realWorldApplications: ["Stage readiness 测试。"],
    conceptRequirements: [
      {
        conceptId,
        kind: "hard",
        minimumStatus: "understood",
        reason: "项目需要该能力。",
      },
    ],
    estimatedHours: { min: 1, max: 2 },
    techStack: [],
    resources: [],
    environmentRequirements: [],
    executionPaths: [
      {
        id: "execution.checkpoint.simulation",
        title: "仿真路径",
        mode: "simulation",
        requirementIds: [],
        evidenceBoundary: "仅用于测试。",
      },
    ],
    acceptanceCriteria: [
      {
        id: "acceptance.checkpoint.complete",
        description: "完成项目",
        required: true,
      },
    ],
    deliverableRequirements: ["测试交付物"],
    evidenceConceptIds: [conceptId],
    resumeOutcome: "继续测试",
    tags: [],
    publicationStatus: "published",
    contentVersion: "test.1",
  };
}

function progress(status: ConceptProgress["status"]): ConceptProgress {
  return {
    status,
    note: "",
    favorite: false,
    startedAt: status === "not_started" ? undefined : timestamp,
    understoodAt:
      status === "understood" || status === "mastered" ? timestamp : undefined,
    updatedAt: timestamp,
    evidence: [],
  };
}

function completedProjectProgress(): ProjectProgress {
  return {
    status: "completed",
    note: "",
    environmentChecks: {},
    acceptance: { "acceptance.checkpoint.complete": true },
    deliverables: [],
    unverifiedAssumptions: [],
    startedAt: timestamp,
    completedAt: timestamp,
    updatedAt: timestamp,
    completionConfirmation: {
      confirmedAt: timestamp,
      acceptanceCriterionIds: ["acceptance.checkpoint.complete"],
      deliverableIds: [],
    },
  };
}

interface StateOptions {
  readonly conceptProgress?: Readonly<Record<string, ConceptProgress>>;
  readonly completedProject?: boolean;
  readonly evidenceStageIds?: readonly string[];
  readonly trackGoals?: Readonly<Record<string, TrackGoal>>;
  readonly retest?: {
    readonly stageId: string;
    readonly initiallyEligibleAt?: string;
    readonly retestedAt?: string;
  };
}

function state(options: StateOptions = {}): LearningStateV1 {
  const initial = createInitialLearningState(tracks, timestamp);
  const stageIds = new Set(options.evidenceStageIds ?? []);
  if (options.retest) stageIds.add(options.retest.stageId);

  return {
    ...initial,
    preferences: {
      ...initial.preferences,
      trackGoals: {
        ...initial.preferences.trackGoals,
        ...options.trackGoals,
      },
    },
    conceptProgress: { ...options.conceptProgress },
    projectProgress: options.completedProject
      ? { "project.checkpoint": completedProjectProgress() }
      : {},
    stageCheckpoints: Object.fromEntries(
      [...stageIds].map((stageId) => [
        stageId,
        {
          criterionEvidence: {
            [`stage-criterion.${stageId}.complete`]: [
              `evidence.${stageId}.complete`,
            ],
          },
          initiallyEligibleAt:
            options.retest?.stageId === stageId
              ? options.retest.initiallyEligibleAt
              : undefined,
          retestedAt:
            options.retest?.stageId === stageId
              ? options.retest.retestedAt
              : undefined,
          updatedAt: timestamp,
        },
      ]),
    ),
  };
}

function readiness(
  target: StageDefinition,
  stages: readonly StageDefinition[],
  concepts: readonly ConceptMeta[],
  projects: readonly ProjectMeta[],
  learningState: LearningStateV1,
) {
  return getStageReadiness(
    target,
    stages,
    concepts,
    projects,
    tracks,
    learningState,
  );
}

describe("Phase 4D-2 Stage readiness", () => {
  it("checkpoint 使用被引用 Stage 的完整 Concept、Project 与 exit 条件", () => {
    const source = stage("stage.source", {
      projectGates: [
        { projectId: "project.checkpoint", when: { kind: "always" } },
      ],
    });
    const target = stage("stage.target", {
      entryGate: { kind: "checkpoint", stageId: source.id },
    });
    const requiredConcept = concept(source.id);
    const requiredProject = project(requiredConcept.id);
    const baseState = state({
      conceptProgress: {
        [requiredConcept.id]: progress("understood"),
      },
      evidenceStageIds: [source.id],
    });

    const blocked = readiness(
      target,
      [source, target],
      [requiredConcept],
      [requiredProject],
      baseState,
    );
    expect(blocked).toMatchObject({
      entryReady: false,
      unmetEntryStageIds: [source.id],
    });
    expect(blocked.blockers).toContainEqual(
      expect.objectContaining({ code: "entry-gate" }),
    );

    const ready = readiness(
      target,
      [source, target],
      [requiredConcept],
      [requiredProject],
      state({
        conceptProgress: {
          [requiredConcept.id]: progress("understood"),
        },
        completedProject: true,
        evidenceStageIds: [source.id],
      }),
    );
    expect(ready.entryReady).toBe(true);
  });

  it("allOf 要求全部 checkpoint，anyOf 只要求至少一个", () => {
    const first = stage("stage.first");
    const second = stage("stage.second");
    const allTarget = stage("stage.all", {
      entryGate: {
        kind: "allOf",
        gates: [
          { kind: "checkpoint", stageId: first.id },
          { kind: "checkpoint", stageId: second.id },
        ],
      },
    });
    const anyTarget = stage("stage.any", {
      entryGate: {
        kind: "anyOf",
        gates: [
          { kind: "checkpoint", stageId: first.id },
          { kind: "checkpoint", stageId: second.id },
        ],
      },
    });
    const oneReady = state({ evidenceStageIds: [first.id] });

    expect(
      readiness(allTarget, [first, second, allTarget], [], [], oneReady),
    ).toMatchObject({
      entryReady: false,
      unmetEntryStageIds: [second.id],
    });
    expect(
      readiness(anyTarget, [first, second, anyTarget], [], [], oneReady)
        .entryReady,
    ).toBe(true);
    expect(
      readiness(
        allTarget,
        [first, second, allTarget],
        [],
        [],
        state({ evidenceStageIds: [first.id, second.id] }),
      ).entryReady,
    ).toBe(true);
  });

  it("track-goal checkpoint 同时要求共享 checkpoint 与当前全局 Track goal", () => {
    const source = stage("stage.branch-source");
    const target = stage("stage.branch-target", {
      entryGate: {
        kind: "track-goal-checkpoint",
        stageId: source.id,
        trackId: "track.industrial-3d",
        minimumTrackGoal: "master",
      },
    });
    const sourceReady = [source, target];

    const blocked = readiness(
      target,
      sourceReady,
      [],
      [],
      state({
        evidenceStageIds: [source.id],
        trackGoals: {
          "track.industrial-3d": "understand",
          "track.computational-imaging": "master",
        },
      }),
    );
    expect(blocked.entryGate).toMatchObject({
      kind: "track-goal-checkpoint",
      checkpointReady: true,
      trackGoalReady: false,
      actualTrackGoal: "understand",
      minimumTrackGoal: "master",
    });

    expect(
      readiness(
        target,
        sourceReady,
        [],
        [],
        state({
          evidenceStageIds: [source.id],
          trackGoals: {
            "track.industrial-3d": "master",
            "track.computational-imaging": "understand",
          },
        }),
      ).entryReady,
    ).toBe(true);
  });

  it("Stage 11 形式的公共 allOf 与高级方向 anyOf 会随主副 Track 交换", () => {
    const common = stage("stage.common-exit");
    const industrial = stage("stage.industrial-exit");
    const computational = stage("stage.computational-exit");
    const capstone = stage("stage.capstone", {
      entryGate: {
        kind: "allOf",
        gates: [
          { kind: "checkpoint", stageId: common.id },
          {
            kind: "anyOf",
            gates: [
              {
                kind: "track-goal-checkpoint",
                stageId: industrial.id,
                trackId: "track.industrial-3d",
                minimumTrackGoal: "master",
              },
              {
                kind: "track-goal-checkpoint",
                stageId: computational.id,
                trackId: "track.computational-imaging",
                minimumTrackGoal: "master",
              },
            ],
          },
        ],
      },
    });
    const stages = [common, industrial, computational, capstone];
    const evidenceStageIds = [common.id, industrial.id, computational.id];

    const industrialMajor = readiness(
      capstone,
      stages,
      [],
      [],
      state({
        evidenceStageIds,
        trackGoals: {
          "track.industrial-3d": "master",
          "track.computational-imaging": "understand",
        },
      }),
    );
    expect(industrialMajor.entryReady).toBe(true);

    const computationalMajor = readiness(
      capstone,
      stages,
      [],
      [],
      state({
        evidenceStageIds,
        trackGoals: {
          "track.industrial-3d": "understand",
          "track.computational-imaging": "master",
        },
      }),
    );
    expect(computationalMajor.entryReady).toBe(true);

    const noMasterBranch = readiness(
      capstone,
      stages,
      [],
      [],
      state({
        evidenceStageIds,
        trackGoals: {
          "track.industrial-3d": "understand",
          "track.computational-imaging": "understand",
        },
      }),
    );
    expect(noMasterBranch).toMatchObject({
      entryReady: false,
      unmetEntryStageIds: [],
    });
    expect(noMasterBranch.entryGate).toMatchObject({
      kind: "allOf",
      gates: [
        { kind: "checkpoint", ready: true },
        { kind: "anyOf", ready: false },
      ],
    });
  });

  it("Track condition 只激活当前目标要求的 Project gate 与 exit criterion", () => {
    const conditional = stage("stage.conditional", {
      projectGates: [
        {
          projectId: "project.checkpoint",
          when: {
            kind: "track-goal",
            trackId: "track.computational-imaging",
            minimumGoal: "master",
          },
        },
      ],
      exitCriteria: [
        exitCriterion("stage.conditional", {
          kind: "track-goal",
          trackId: "track.computational-imaging",
          minimumGoal: "master",
        }),
      ],
    });
    const requiredProject = project("concept.external");

    const inactive = readiness(
      conditional,
      [conditional],
      [],
      [requiredProject],
      state({
        trackGoals: { "track.computational-imaging": "understand" },
      }),
    );
    expect(inactive).toMatchObject({
      ready: true,
      effectiveRequiredProjectIds: [],
      unmetExitCriterionIds: [],
    });

    const active = readiness(
      conditional,
      [conditional],
      [],
      [requiredProject],
      state({
        trackGoals: { "track.computational-imaging": "master" },
      }),
    );
    expect(active).toMatchObject({
      ready: false,
      effectiveRequiredProjectIds: [requiredProject.id],
      incompleteProjectIds: [requiredProject.id],
      unmetExitCriterionIds: ["stage-criterion.stage.conditional.complete"],
    });
  });

  it("嵌套 gate 中重复引用的共享 checkpoint 只报告一次", () => {
    const shared = stage("stage.shared");
    const target = stage("stage.target", {
      entryGate: {
        kind: "allOf",
        gates: [
          { kind: "checkpoint", stageId: shared.id },
          {
            kind: "anyOf",
            gates: [
              { kind: "checkpoint", stageId: shared.id },
              { kind: "checkpoint", stageId: shared.id },
            ],
          },
        ],
      },
    });

    expect(
      readiness(target, [shared, target], [], [], state()).unmetEntryStageIds,
    ).toEqual([shared.id]);
  });

  it("分类出口只有在满足正式复测间隔后才形成 ready checkpoint", () => {
    const retested = stage("stage.retested", { retestAfterDays: 7 });
    const beforeRetest = readiness(
      retested,
      [retested],
      [],
      [],
      state({
        evidenceStageIds: [retested.id],
        retest: {
          stageId: retested.id,
          initiallyEligibleAt: retestTimestamp,
        },
      }),
    );
    expect(beforeRetest).toMatchObject({
      ready: false,
      retestDue: true,
      blockers: [{ code: "retest", retestAfterDays: 7 }],
    });

    const afterRetest = readiness(
      retested,
      [retested],
      [],
      [],
      state({
        evidenceStageIds: [retested.id],
        retest: {
          stageId: retested.id,
          initiallyEligibleAt: retestTimestamp,
          retestedAt: "2026-08-13T01:00:00.000Z",
        },
      }),
    );
    expect(afterRetest).toMatchObject({ ready: true, retestDue: false });
  });

  it("相同 catalog、Track 与 Progress 输入产生完全相同的结构化结果", () => {
    const source = stage("stage.deterministic-source");
    const target = stage("stage.deterministic-target", {
      entryGate: { kind: "checkpoint", stageId: source.id },
    });
    const learningState = state();
    const input = [target, [source, target], [], [], learningState] as const;
    const snapshot = JSON.stringify(input);

    expect(readiness(...input)).toEqual(readiness(...input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
