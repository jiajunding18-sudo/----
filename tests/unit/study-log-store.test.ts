import { describe, expect, it } from "vitest";

import {
  createLearningStore,
  type LearningStoreApi,
} from "@/features/progress/learning-store";
import type { ProgressCatalog } from "@/features/progress/progress-domain";
import {
  createInitialLearningState,
  createPersistedEnvelope,
  LEARNING_STATE_STORAGE_KEY,
  LocalStorageLearningStateAdapter,
  type StringStorage,
} from "@/lib/storage";

const timestamps = [
  "2026-08-29T01:00:00.000Z",
  "2026-08-29T02:00:00.000Z",
  "2026-08-29T03:00:00.000Z",
  "2026-08-29T04:00:00.000Z",
];

const catalog: ProgressCatalog = {
  concepts: [
    {
      id: "concept.published",
      stageId: "stage.test",
      stageCategoryOrder: 0,
      trackIds: ["track.common"],
      requiredness: "required",
      publicationStatus: "published",
      dependencies: [],
      masteryCriteria: [],
    },
    {
      id: "concept.draft",
      stageId: "stage.test",
      stageCategoryOrder: 0,
      trackIds: ["track.common"],
      requiredness: "required",
      publicationStatus: "draft",
      dependencies: [],
      masteryCriteria: [],
    },
  ],
  projects: [
    {
      id: "project.published",
      publicationStatus: "published",
      conceptRequirements: [],
      environmentRequirements: [],
      executionPaths: [],
      acceptanceCriteria: [],
    },
    {
      id: "project.draft",
      publicationStatus: "draft",
      conceptRequirements: [],
      environmentRequirements: [],
      executionPaths: [],
      acceptanceCriteria: [],
    },
  ],
  stageIds: ["stage.test"],
  tracks: [{ id: "track.common", kind: "common", defaultGoal: "master" }],
};

class MemoryStorage implements StringStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

function createStore(storage: MemoryStorage): LearningStoreApi {
  return createLearningStore({
    adapter: new LocalStorageLearningStateAdapter(() => storage),
    catalog,
    contentVersion: "2026.08.29",
    createStudyLogId: () => "study-log.fixture",
    now: () => timestamps[3],
  });
}

const input = {
  localDate: "2026-08-29",
  minutes: 45,
  conceptIds: ["concept.published"],
  projectIds: ["project.published"],
  learned: "学习了正式内容",
  blockers: "",
  completed: "完成练习",
  tomorrowPlan: "继续复现",
} as const;

describe("Study Log Learning Store", () => {
  it("创建、编辑、确认删除均通过统一 envelope 持久化，刷新后保留", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    await store.getState().hydrate();

    expect(await store.getState().createStudyLog(input)).toMatchObject({
      ok: true,
      changed: true,
      log: { id: "study-log.fixture", minutes: 45 },
    });
    expect(JSON.parse(storage.values.get(LEARNING_STATE_STORAGE_KEY) ?? "")).toMatchObject({
      payload: { studyLogs: [{ id: "study-log.fixture", minutes: 45 }] },
    });

    const reloaded = createStore(storage);
    await reloaded.getState().hydrate();
    expect(reloaded.getState().learningState.studyLogs).toHaveLength(1);

    expect(
      await reloaded.getState().updateStudyLog("study-log.fixture", {
        ...input,
        minutes: 60,
        learned: "编辑后的真实学习内容",
      }),
    ).toMatchObject({ ok: true, changed: true, log: { minutes: 60 } });
    expect(
      await reloaded.getState().deleteStudyLog("study-log.fixture", false),
    ).toMatchObject({ ok: false, code: "confirmation-required" });
    expect(reloaded.getState().learningState.studyLogs).toHaveLength(1);
    expect(
      await reloaded.getState().deleteStudyLog("study-log.fixture", true),
    ).toEqual({ ok: true, changed: true, deletedId: "study-log.fixture" });
    expect(reloaded.getState().learningState.studyLogs).toEqual([]);
  });

  it("日志 CRUD 不改变 ConceptProgress、ProjectProgress 或 preferences", async () => {
    const storage = new MemoryStorage();
    const state = createInitialLearningState(catalog.tracks, timestamps[0]);
    const seeded = {
      ...state,
      preferences: { ...state.preferences, currentConceptId: "concept.published" },
      conceptProgress: {
        "concept.published": {
          status: "learning" as const,
          note: "保留",
          favorite: true,
          startedAt: timestamps[0],
          updatedAt: timestamps[0],
          evidence: [],
        },
      },
      projectProgress: {
        "project.published": {
          status: "not_started" as const,
          note: "保留",
          environmentChecks: {},
          acceptance: {},
          deliverables: [],
          unverifiedAssumptions: [],
          updatedAt: timestamps[0],
        },
      },
    };
    storage.setItem(
      LEARNING_STATE_STORAGE_KEY,
      JSON.stringify(createPersistedEnvelope(seeded, "2026.08.29", 1, timestamps[0])),
    );
    const store = createStore(storage);
    await store.getState().hydrate();
    const before = store.getState().learningState;

    expect((await store.getState().createStudyLog(input)).ok).toBe(true);
    const after = store.getState().learningState;
    expect(after.conceptProgress).toEqual(before.conceptProgress);
    expect(after.projectProgress).toEqual(before.projectProgress);
    expect(after.preferences).toEqual(before.preferences);
  });

  it("只允许新增 published 关联，但保留并可移除历史 orphan/draft 关联", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    await store.getState().hydrate();
    expect(
      await store.getState().createStudyLog({
        ...input,
        conceptIds: ["concept.draft"],
      }),
    ).toMatchObject({ ok: false, code: "invalid-study-log-association" });

    const state = createInitialLearningState(catalog.tracks, timestamps[0]);
    const orphanState = {
      ...state,
      studyLogs: [
        {
          id: "study-log.fixture",
          localDate: "2026-08-28",
          minutes: 30,
          conceptIds: ["concept.removed", "concept.draft"],
          projectIds: ["project.removed", "project.draft"],
          learned: "旧日志",
          blockers: "",
          completed: "",
          tomorrowPlan: "",
          createdAt: timestamps[0],
          updatedAt: timestamps[0],
        },
      ],
    };
    storage.setItem(
      LEARNING_STATE_STORAGE_KEY,
      JSON.stringify(
        createPersistedEnvelope(orphanState, "2026.08.29", 1, timestamps[0]),
      ),
    );
    const restored = createStore(storage);
    await restored.getState().hydrate();
    expect(restored.getState().orphanConceptIds).toEqual(["concept.removed"]);
    expect(restored.getState().orphanProjectIds).toEqual(["project.removed"]);
    expect(restored.getState().learningState.studyLogs[0]?.conceptIds).toEqual([
      "concept.removed",
      "concept.draft",
    ]);

    expect(
      await restored.getState().updateStudyLog("study-log.fixture", {
        ...input,
        localDate: "2026-08-28",
        conceptIds: ["concept.removed", "concept.draft"],
        projectIds: ["project.removed", "project.draft"],
        learned: "旧日志已编辑",
      }),
    ).toMatchObject({ ok: true, changed: true });
    expect(
      await restored.getState().updateStudyLog("study-log.fixture", {
        ...input,
        localDate: "2026-08-28",
        conceptIds: [],
        projectIds: [],
        learned: "移除失效关联",
      }),
    ).toMatchObject({ ok: true, changed: true });
    expect(restored.getState().orphanConceptIds).toEqual([]);
    expect(restored.getState().orphanProjectIds).toEqual([]);
  });
});
