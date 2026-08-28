import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  createLearningStore,
  type LearningStoreApi,
} from "@/features/progress/learning-store";
import type { ProgressCatalog } from "@/features/progress/progress-domain";
import {
  applySequentialMigrations,
  createInitialLearningState,
  createPersistedEnvelope,
  LEARNING_STATE_APP_ID,
  LEARNING_STATE_STORAGE_KEY,
  LocalStorageLearningStateAdapter,
  type StringStorage,
} from "@/lib/storage";

const timestamp = "2026-08-28T01:00:00.000Z";
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
  projectIds: ["project.fixture"],
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

function makeStore(storage: MemoryStorage): LearningStoreApi {
  return createLearningStore({
    adapter: new LocalStorageLearningStateAdapter(() => storage),
    catalog,
    contentVersion: "2026.08.28",
    now: () => timestamp,
  });
}

describe("LocalStorage adapter 与 hydration", () => {
  it("当前 v1 正常加载，并在 store 重建后恢复状态", async () => {
    const storage = new MemoryStorage();
    const firstStore = makeStore(storage);
    await firstStore.getState().hydrate();
    await firstStore.getState().startConcept("concept.foundation");
    expect(firstStore.getState().learningState.conceptProgress["concept.foundation"])
      .toMatchObject({ status: "learning" });

    const refreshedStore = makeStore(storage);
    await refreshedStore.getState().hydrate();
    expect(refreshedStore.getState()).toMatchObject({
      hydrated: true,
      persistenceStatus: "ready",
      revision: 1,
      learningState: {
        conceptProgress: {
          "concept.foundation": { status: "learning" },
        },
      },
    });
  });

  it("坏 JSON 不抛出，并保留 raw 诊断信息", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEARNING_STATE_STORAGE_KEY, "{broken");
    const result = await new LocalStorageLearningStateAdapter(
      () => storage,
    ).load();

    expect(result).toMatchObject({
      ok: false,
      reason: "corrupt",
      raw: "{broken",
    });
  });

  it("非法 schema 被识别，且 hydration 后 action 不会覆盖原始数据", async () => {
    const storage = new MemoryStorage();
    const state = createInitialLearningState(catalog.tracks, timestamp);
    const invalid = createPersistedEnvelope(state, "2026.08.28", 1, timestamp);
    const raw = JSON.stringify({
      ...invalid,
      payload: {
        ...invalid.payload,
        conceptProgress: {
          "concept.foundation": {
            status: "illegal",
            note: "",
            favorite: false,
            updatedAt: timestamp,
            evidence: [],
          },
        },
      },
    });
    storage.setItem(LEARNING_STATE_STORAGE_KEY, raw);

    const store = makeStore(storage);
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({
      hydrated: true,
      persistenceStatus: "blocked",
      learningState: { conceptProgress: {} },
    });
    expect(await store.getState().startConcept("concept.foundation")).toMatchObject({
      ok: false,
      code: "persistence-blocked",
    });
    expect(storage.getItem(LEARNING_STATE_STORAGE_KEY)).toBe(raw);
  });

  it("未知 future version 进入安全写保护而不会被降级解析", async () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({
      app: LEARNING_STATE_APP_ID,
      schemaVersion: 2,
      payload: {},
    });
    storage.setItem(LEARNING_STATE_STORAGE_KEY, raw);

    const store = makeStore(storage);
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({
      hydrated: true,
      persistenceStatus: "blocked",
      rawRecoveryData: raw,
    });
    expect(storage.getItem(LEARNING_STATE_STORAGE_KEY)).toBe(raw);
  });

  it("orphan Concept 记录被保留和报告，不会被当作当前内容", async () => {
    const storage = new MemoryStorage();
    const state = createInitialLearningState(catalog.tracks, timestamp);
    const envelope = createPersistedEnvelope(
      {
        ...state,
        conceptProgress: {
          "concept.retired": {
            status: "learning",
            note: "历史记录",
            favorite: false,
            startedAt: timestamp,
            updatedAt: timestamp,
            evidence: [],
          },
        },
      },
      "2026.08.28",
      3,
      timestamp,
    );
    storage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(envelope));

    const store = makeStore(storage);
    await store.getState().hydrate();
    expect(store.getState().orphanConceptIds).toEqual(["concept.retired"]);
    expect(
      store.getState().learningState.conceptProgress["concept.retired"],
    ).toMatchObject({ status: "learning" });
    expect(
      store.getState().learningState.conceptProgress["concept.foundation"],
    ).toBeUndefined();
  });

  it("clear 精确删除固定 storage key", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEARNING_STATE_STORAGE_KEY, "value");
    await new LocalStorageLearningStateAdapter(() => storage).clear();
    expect(storage.getItem(LEARNING_STATE_STORAGE_KEY)).toBeNull();
  });

  it("同一时间戳的 recovery snapshot 使用不同 key，不覆盖先前快照", async () => {
    const storage = new MemoryStorage();
    const adapter = new LocalStorageLearningStateAdapter(() => storage);
    const envelope = createPersistedEnvelope(
      createInitialLearningState(catalog.tracks, timestamp),
      "2026.08.28",
      1,
      timestamp,
    );
    const firstKey = await adapter.saveRecovery(envelope);
    const secondKey = await adapter.saveRecovery(envelope);

    expect(secondKey).not.toBe(firstKey);
    expect(storage.getItem(firstKey)).toBe(JSON.stringify(envelope));
    expect(storage.getItem(secondKey)).toBe(JSON.stringify(envelope));
  });
});

describe("migration framework", () => {
  it("按 vN → vN+1 连续校验并迁移，入口可扩展", () => {
    const v1Schema = z.strictObject({ schemaVersion: z.literal(1), name: z.string() });
    const v2Schema = z.strictObject({
      schemaVersion: z.literal(2),
      name: z.string(),
      enabled: z.boolean(),
    });
    const result = applySequentialMigrations({
      input: { schemaVersion: 1, name: "fixture" },
      inputVersion: 1,
      targetVersion: 2,
      targetSchema: v2Schema,
      migrations: new Map([
        [
          1,
          {
            fromVersion: 1,
            fromSchema: v1Schema,
            migrate: (input) => ({
              ...(input as z.infer<typeof v1Schema>),
              schemaVersion: 2,
              enabled: true,
            }),
          },
        ],
      ]),
    });

    expect(result).toEqual({
      ok: true,
      value: { schemaVersion: 2, name: "fixture", enabled: true },
    });
  });
});
