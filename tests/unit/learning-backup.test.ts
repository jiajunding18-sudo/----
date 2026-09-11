import { describe, expect, it } from "vitest";

import {
  createLearningStore,
  type LearningStoreApi,
} from "@/features/progress/learning-store";
import type { ProgressCatalog } from "@/features/progress/progress-domain";
import {
  createExportEnvelope,
  createInitialLearningState,
  createLearningBackup,
  exportEnvelopeV4Schema,
  LEARNING_STATE_APP_ID,
  LEARNING_STATE_RECOVERY_KEY_PREFIX,
  LEARNING_STATE_STORAGE_KEY,
  LocalStorageLearningStateAdapter,
  mergeLearningStates,
  prepareLearningStateImport,
  type StringStorage,
} from "@/lib/storage";
import type { LearningStateV4 } from "@/types";

const early = "2026-08-28T01:00:00.000Z";
const later = "2026-08-28T02:00:00.000Z";
const catalog: ProgressCatalog = {
  concepts: [
    {
      id: "concept.foundation",
      stageId: "stage.test",
      stageCategoryOrder: 0,
      trackIds: ["track.common"],
      requiredness: "required",
      publicationStatus: "published",
      dependencies: [],
      masteryCriteria: [
        {
          id: "criterion.concept-foundation.explain",
          description: "解释基础概念",
          evidenceHint: "保存书面解释。",
          required: true,
        },
      ],
    },
  ],
  projects: [
    {
      id: "project.fixture",
      publicationStatus: "published",
      conceptRequirements: [
        {
          conceptId: "concept.foundation",
          kind: "hard",
          minimumStatus: "understood",
        },
      ],
      environmentRequirements: [{ id: "environment.fixture", required: true }],
      executionPaths: [
        { id: "execution.fixture", requirementIds: ["environment.fixture"] },
      ],
      acceptanceCriteria: [
        { id: "acceptance.fixture", required: true },
      ],
    },
  ],
  stageIds: ["stage.test"],
  tracks: [
    { id: "track.common", kind: "common", defaultGoal: "master" },
    {
      id: "track.advanced-a",
      kind: "advanced-branch",
      defaultGoal: "master",
      exclusiveMasteryGroup: "advanced",
    },
    {
      id: "track.advanced-b",
      kind: "advanced-branch",
      defaultGoal: "understand",
      exclusiveMasteryGroup: "advanced",
    },
  ],
};

class MemoryStorage implements StringStorage {
  readonly values = new Map<string, string>();
  failMainSave = false;
  failRecoverySave = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (key === LEARNING_STATE_STORAGE_KEY && this.failMainSave) {
      throw new Error("main save failed");
    }
    if (key.startsWith(LEARNING_STATE_RECOVERY_KEY_PREFIX) && this.failRecoverySave) {
      throw new Error("recovery save failed");
    }
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function makeStore(storage: MemoryStorage, now = () => later): LearningStoreApi {
  return createLearningStore({
    adapter: new LocalStorageLearningStateAdapter(() => storage),
    catalog,
    contentVersion: "2026.08.28",
    now,
  });
}

function learningStateWithConcept(timestamp = early) {
  const state = createInitialLearningState(catalog.tracks, timestamp);
  return {
    ...state,
    conceptProgress: {
      "concept.foundation": {
        status: "understood" as const,
        note: "已理解",
        favorite: false,
        startedAt: timestamp,
        understoodAt: timestamp,
        updatedAt: timestamp,
        evidence: [],
      },
    },
  };
}

function backupJson(state: LearningStateV4 = learningStateWithConcept()) {
  return createLearningBackup({
    state,
    contentVersion: "2026.08.28",
    revision: 3,
    savedAt: early,
    exportedAt: later,
  }).json;
}

describe("Learning OS JSON 备份", () => {
  it("正常数据可导出，且导出 JSON 通过正式 schema", () => {
    const backup = createLearningBackup({
      state: learningStateWithConcept(),
      contentVersion: "2026.08.28",
      revision: 3,
      savedAt: early,
      exportedAt: later,
    });

    expect(exportEnvelopeV4Schema.parse(JSON.parse(backup.json))).toEqual(
      backup.envelope,
    );
    expect(backup.envelope).toMatchObject({
      app: LEARNING_STATE_APP_ID,
      schemaVersion: 4,
      revision: 3,
      savedAt: early,
      exportedAt: later,
    });
  });

  it("正常备份可导入，并在 replace 模式恢复等价状态", () => {
    const incoming = learningStateWithConcept();
    const current = createInitialLearningState(catalog.tracks, later);
    const result = prepareLearningStateImport({
      raw: backupJson(incoming),
      currentState: current,
      catalog,
      mode: "replace",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        nextState: incoming,
        preview: { conceptRecordCount: 1, understoodCount: 1, masteredCount: 0 },
      },
    });
  });

  it("导出 → reset → 导入后可恢复 mastered、Evidence 与确认快照", async () => {
    const storage = new MemoryStorage();
    const source = makeStore(storage);
    await source.getState().hydrate();
    await source.getState().startConcept("concept.foundation");
    await source.getState().markUnderstood("concept.foundation");
    await source.getState().addEvidence("concept.foundation", {
      id: "evidence.concept-foundation.explain",
      conceptId: "concept.foundation",
      criterionIds: ["criterion.concept-foundation.explain"],
      kind: "written-explanation",
      title: "基础概念解释",
      note: "保存了逐步解释和一组反例。",
      result: "passed",
      completedAt: later,
      createdAt: later,
      updatedAt: later,
    });
    await source.getState().confirmMastery("concept.foundation", true);
    expect(
      await source.getState().createStudyLog({
        localDate: "2026-08-28",
        minutes: 75,
        conceptIds: ["concept.foundation"],
        projectIds: ["project.fixture"],
        learned: "复盘基础概念并整理证据",
        blockers: "解释边界条件仍不够清楚",
        completed: "完成书面解释",
        tomorrowPlan: "复测并补充反例",
      }),
    ).toMatchObject({ ok: true, changed: true });
    const backup = source.getState().createBackup("2026-08-28");
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(backup.envelope.payload.conceptProgress["concept.foundation"]).toMatchObject({
      status: "mastered",
      evidence: [{ id: "evidence.concept-foundation.explain" }],
      masteryConfirmation: {
        criterionIds: ["criterion.concept-foundation.explain"],
        evidenceIds: ["evidence.concept-foundation.explain"],
      },
    });
    expect(backup.envelope.payload.studyLogs).toMatchObject([
      {
        minutes: 75,
        conceptIds: ["concept.foundation"],
        projectIds: ["project.fixture"],
        learned: "复盘基础概念并整理证据",
      },
    ]);

    expect((await source.getState().resetLearningData(true)).ok).toBe(true);
    expect(source.getState().learningState.conceptProgress).toEqual({});
    expect(source.getState().learningState.studyLogs).toEqual([]);

    const prepared = source.getState().prepareImport(backup.json, "replace");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.preview.studyLogRecordCount).toBe(1);
    expect((await source.getState().applyImport(prepared.value, true)).ok).toBe(true);

    const refreshed = makeStore(storage);
    await refreshed.getState().hydrate();
    expect(
      refreshed.getState().learningState.conceptProgress["concept.foundation"],
    ).toMatchObject({
      status: "mastered",
      evidence: [{ id: "evidence.concept-foundation.explain" }],
      masteryConfirmation: {
        evidenceIds: ["evidence.concept-foundation.explain"],
      },
    });
    expect(refreshed.getState().learningState.studyLogs).toMatchObject([
      {
        minutes: 75,
        learned: "复盘基础概念并整理证据",
        conceptIds: ["concept.foundation"],
        projectIds: ["project.fixture"],
      },
    ]);
  });

  it("导出 → reset → 导入后完整恢复笔记、收藏与自评难度", async () => {
    const storage = new MemoryStorage();
    const source = makeStore(storage);
    await source.getState().hydrate();
    await source
      .getState()
      .updateConceptNote("concept.foundation", "备份里的个人笔记");
    await source.getState().setConceptFavorite("concept.foundation", true);
    await source.getState().setConceptUserDifficulty("concept.foundation", 5);

    const backup = source.getState().createBackup("2026-08-28");
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(
      backup.envelope.payload.conceptProgress["concept.foundation"],
    ).toMatchObject({
      status: "not_started",
      note: "备份里的个人笔记",
      favorite: true,
      userDifficulty: 5,
    });

    expect((await source.getState().resetLearningData(true)).ok).toBe(true);
    expect(source.getState().learningState.conceptProgress).toEqual({});

    const prepared = source.getState().prepareImport(backup.json, "replace");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect((await source.getState().applyImport(prepared.value, true)).ok).toBe(
      true,
    );

    const refreshed = makeStore(storage);
    await refreshed.getState().hydrate();
    expect(
      refreshed.getState().learningState.conceptProgress["concept.foundation"],
    ).toMatchObject({
      status: "not_started",
      note: "备份里的个人笔记",
      favorite: true,
      userDifficulty: 5,
    });
  });

  it("导出 → reset → 导入后恢复完整 Project 完成快照，且不改写 ConceptProgress", async () => {
    const storage = new MemoryStorage();
    const source = makeStore(storage);
    await source.getState().hydrate();

    expect(
      await source.getState().startProject("project.fixture", {
        selectedExecutionPathId: "execution.fixture",
        nextAction: "创建项目目录",
        environmentChecks: { "environment.fixture": true },
        confirmPrerequisiteOverride: true,
      }),
    ).toMatchObject({ ok: true, changed: true });
    expect(
      await source
        .getState()
        .setProjectAcceptanceCriterion(
          "project.fixture",
          "acceptance.fixture",
          true,
        ),
    ).toMatchObject({ ok: true, changed: true });
    expect(
      await source.getState().addProjectDeliverable("project.fixture", {
        id: "deliverable.fixture.backup",
        title: "备份中的项目交付物",
        reference: "evidence/backup.md",
      }),
    ).toMatchObject({ ok: true, changed: true });
    expect(
      await source.getState().completeProject("project.fixture", true),
    ).toMatchObject({ ok: true, changed: true });
    expect(source.getState().learningState.conceptProgress).toEqual({});

    const backup = source.getState().createBackup("2026-08-28");
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(
      backup.envelope.payload.projectProgress["project.fixture"],
    ).toMatchObject({
      status: "completed",
      selectedExecutionPathId: "execution.fixture",
      environmentChecks: { "environment.fixture": true },
      acceptance: { "acceptance.fixture": true },
      deliverables: [
        {
          id: "deliverable.fixture.backup",
          title: "备份中的项目交付物",
        },
      ],
      completionConfirmation: {
        acceptanceCriterionIds: ["acceptance.fixture"],
        deliverableIds: ["deliverable.fixture.backup"],
      },
      prerequisiteOverride: {
        missingRequirementConceptIds: ["concept.foundation"],
      },
    });

    expect((await source.getState().resetLearningData(true)).ok).toBe(true);
    expect(source.getState().learningState.projectProgress).toEqual({});

    const prepared = source.getState().prepareImport(backup.json, "replace");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect((await source.getState().applyImport(prepared.value, true)).ok).toBe(
      true,
    );

    const refreshed = makeStore(storage);
    await refreshed.getState().hydrate();
    expect(
      refreshed.getState().learningState.projectProgress["project.fixture"],
    ).toMatchObject({
      status: "completed",
      selectedExecutionPathId: "execution.fixture",
      deliverables: [{ id: "deliverable.fixture.backup" }],
      completionConfirmation: {
        deliverableIds: ["deliverable.fixture.backup"],
      },
    });
    expect(refreshed.getState().learningState.conceptProgress).toEqual({});
  });

  it("缺少可选 userDifficulty 的旧正式 v1 备份仍可安全恢复", () => {
    const oldV1State = learningStateWithConcept();
    const oldV1Json = createLearningBackup({
      state: oldV1State,
      contentVersion: "2026.08.28",
      revision: 2,
      savedAt: early,
      exportedAt: later,
    }).json;
    const result = prepareLearningStateImport({
      raw: oldV1Json,
      currentState: createInitialLearningState(catalog.tracks, later),
      catalog,
      mode: "replace",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        nextState: {
          conceptProgress: {
            "concept.foundation": {
              note: "已理解",
              favorite: false,
            },
          },
        },
      },
    });
    if (result.ok) {
      expect(
        result.value.nextState.conceptProgress["concept.foundation"]
          .userDifficulty,
      ).toBeUndefined();
    }
  });

  it.each([
    ["非法 JSON", "{broken", "invalid-json"],
    [
      "错误 app",
      JSON.stringify({
        ...createExportEnvelope(
          learningStateWithConcept(),
          "2026.08.28",
          1,
          early,
          later,
        ),
        app: "another-app",
      }),
      "wrong-app",
    ],
    [
      "非法 schema",
      JSON.stringify({
        app: LEARNING_STATE_APP_ID,
        schemaVersion: 1,
        contentVersion: "2026.08.28",
        revision: 1,
        savedAt: early,
        exportedAt: later,
        payload: { schemaVersion: 1 },
      }),
      "invalid-schema",
    ],
    [
      "unknown future version",
      JSON.stringify({
        app: LEARNING_STATE_APP_ID,
        schemaVersion: 99,
      }),
      "unsupported-newer-version",
    ],
  ])("%s 被拒绝", (_label, raw, code) => {
    const current = learningStateWithConcept();
    const result = prepareLearningStateImport({
      raw,
      currentState: current,
      catalog,
      mode: "replace",
    });
    expect(result).toMatchObject({ ok: false, code });
    expect(current.conceptProgress["concept.foundation"].status).toBe("understood");
  });

  it("merge 以 updatedAt 为准，保留较新的主动回退", () => {
    const current = learningStateWithConcept(later);
    const olderIncoming = learningStateWithConcept(early);
    const merged = mergeLearningStates(current, olderIncoming);
    expect(merged.conceptProgress["concept.foundation"]).toStrictEqual(
      current.conceptProgress["concept.foundation"],
    );
  });

  it("Study Log merge 按稳定 ID 与 updatedAt 选择，并报告变化摘要", () => {
    const base = createInitialLearningState(catalog.tracks, early);
    const olderLog = {
      id: "study-log.shared",
      localDate: "2026-08-27",
      minutes: 30,
      conceptIds: ["concept.foundation"],
      projectIds: [],
      learned: "旧内容",
      blockers: "",
      completed: "",
      tomorrowPlan: "",
      createdAt: early,
      updatedAt: early,
    };
    const current = {
      ...base,
      studyLogs: [{ ...olderLog, minutes: 60, learned: "较新内容", updatedAt: later }],
    };
    const incoming = {
      ...base,
      studyLogs: [
        olderLog,
        { ...olderLog, id: "study-log.new", learned: "新增内容" },
      ],
    };

    expect(mergeLearningStates(current, incoming).studyLogs).toMatchObject([
      { id: "study-log.new", learned: "新增内容" },
      { id: "study-log.shared", minutes: 60, learned: "较新内容" },
    ]);
    const prepared = prepareLearningStateImport({
      raw: backupJson(incoming),
      currentState: current,
      catalog,
      mode: "merge",
    });
    expect(prepared).toMatchObject({
      ok: true,
      value: {
        preview: {
          studyLogRecordCount: 2,
          studyLogChanges: { added: 1, updated: 0, unchanged: 1 },
        },
      },
    });
  });

  it("Concept / Project / Stage / Track orphan 原样保留并进入预览", () => {
    const state = learningStateWithConcept();
    const withOrphans = {
      ...state,
      preferences: {
        ...state.preferences,
        trackGoals: { ...state.preferences.trackGoals, "track.retired": "understand" as const },
      },
      conceptProgress: {
        ...state.conceptProgress,
        "concept.retired": {
          status: "learning" as const,
          note: "历史",
          favorite: false,
          startedAt: early,
          updatedAt: early,
          evidence: [],
        },
      },
      projectProgress: {
        "project.retired": {
          status: "not_started" as const,
          note: "",
          environmentChecks: {},
          acceptance: {},
          deliverables: [],
          unverifiedAssumptions: [],
          updatedAt: early,
        },
      },
      stageCheckpoints: {
        "stage.retired": { criteria: {}, cycles: {}, legacy: [], attempts:{}, legacyV3Completions:[], updatedAt: early },
      },
      studyLogs: [
        {
          id: "study-log.orphan",
          localDate: "2026-08-28",
          minutes: 20,
          conceptIds: ["concept.log-retired"],
          projectIds: ["project.log-retired"],
          learned: "保留历史关联",
          blockers: "",
          completed: "",
          tomorrowPlan: "",
          createdAt: early,
          updatedAt: early,
        },
      ],
    };
    const result = prepareLearningStateImport({
      raw: backupJson(withOrphans),
      currentState: createInitialLearningState(catalog.tracks, later),
      catalog,
      mode: "replace",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        preview: {
          orphanConceptIds: ["concept.retired", "concept.log-retired"],
          orphanProjectIds: ["project.retired", "project.log-retired"],
          orphanStageIds: ["stage.retired"],
          orphanTrackIds: ["track.retired"],
        },
      },
    });
    if (result.ok) {
      expect(result.value.nextState.conceptProgress["concept.retired"]).toBeDefined();
      expect(result.value.nextState.studyLogs[0]?.learned).toBe("保留历史关联");
    }
  });
});

describe("原子恢复与 reset 保护", () => {
  it("用户未确认导入时不修改当前状态", async () => {
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    await store.getState().hydrate();
    const before = store.getState().learningState;
    const prepared = store.getState().prepareImport(backupJson(), "replace");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    expect(await store.getState().applyImport(prepared.value, false)).toMatchObject({
      ok: false,
      code: "confirmation-required",
    });
    expect(store.getState().learningState).toBe(before);
    expect(storage.getItem(LEARNING_STATE_STORAGE_KEY)).toBeNull();
  });

  it("recovery 失败时 replace 不覆盖主数据或内存状态", async () => {
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    await store.getState().hydrate();
    await store.getState().startConcept("concept.foundation");
    const beforeState = store.getState().learningState;
    const beforeRaw = storage.getItem(LEARNING_STATE_STORAGE_KEY);
    const prepared = store.getState().prepareImport(backupJson(), "replace");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    storage.failRecoverySave = true;
    expect(await store.getState().applyImport(prepared.value, true)).toMatchObject({
      ok: false,
      code: "recovery-failed",
    });
    expect(store.getState().learningState).toBe(beforeState);
    expect(storage.getItem(LEARNING_STATE_STORAGE_KEY)).toBe(beforeRaw);
  });

  it("主 key 写入失败时 import 不改变内存或原主数据", async () => {
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    await store.getState().hydrate();
    await store.getState().startConcept("concept.foundation");
    const beforeState = store.getState().learningState;
    const beforeRaw = storage.getItem(LEARNING_STATE_STORAGE_KEY);
    const prepared = store.getState().prepareImport(backupJson(), "merge");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    storage.failMainSave = true;
    expect(await store.getState().applyImport(prepared.value, true)).toMatchObject({
      ok: false,
      code: "save-failed",
    });
    expect(store.getState().learningState).toBe(beforeState);
    expect(storage.getItem(LEARNING_STATE_STORAGE_KEY)).toBe(beforeRaw);
  });

  it("reset 必须确认，只清除学习数据并保留路线设置", async () => {
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    await store.getState().hydrate();
    await store.getState().startConcept("concept.foundation");
    const trackGoals = store.getState().learningState.preferences.trackGoals;

    expect(await store.getState().resetLearningData(false)).toMatchObject({
      ok: false,
      code: "confirmation-required",
    });
    expect(store.getState().learningState.conceptProgress).not.toEqual({});

    expect((await store.getState().resetLearningData(true)).ok).toBe(true);
    expect(store.getState().learningState).toMatchObject({
      preferences: { trackGoals },
      conceptProgress: {},
      projectProgress: {},
      stageCheckpoints: {},
      studyLogs: [],
    });
    expect(
      [...storage.values.keys()].some((key) =>
        key.startsWith(LEARNING_STATE_RECOVERY_KEY_PREFIX),
      ),
    ).toBe(true);
  });

  it("导入后新增 catalog Concept 仍因缺少记录而默认为 not_started", () => {
    const result = prepareLearningStateImport({
      raw: backupJson(),
      currentState: createInitialLearningState(catalog.tracks, later),
      catalog: {
        ...catalog,
        concepts: [
          ...catalog.concepts,
          { ...catalog.concepts[0], id: "concept.new" },
        ],
      },
      mode: "replace",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextState.conceptProgress["concept.new"]).toBeUndefined();
    }
  });
});
