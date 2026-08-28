import { migratePersistedEnvelope } from "./migrations";
import {
  LEARNING_STATE_STORAGE_KEY,
  persistedEnvelopeV1Schema,
  type PersistedEnvelopeV1,
} from "./learning-state";

export type StorageLoadResult =
  | {
      readonly ok: true;
      readonly value: PersistedEnvelopeV1 | null;
      readonly raw?: string;
    }
  | {
      readonly ok: false;
      readonly reason: "unavailable" | "corrupt" | "unsupported-newer-version";
      readonly raw?: string;
      readonly message: string;
    };

export interface LearningStateStorageAdapter {
  load(): Promise<StorageLoadResult>;
  save(value: PersistedEnvelopeV1): Promise<void>;
  clear(): Promise<void>;
}

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LearningStateStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LearningStateStorageError";
  }
}

function getBrowserStorage(): StringStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export class LocalStorageLearningStateAdapter
  implements LearningStateStorageAdapter
{
  constructor(
    private readonly getStorage: () => StringStorage | undefined =
      getBrowserStorage,
  ) {}

  async load(): Promise<StorageLoadResult> {
    let storage: StringStorage | undefined;
    try {
      storage = this.getStorage();
    } catch (error) {
      return {
        ok: false,
        reason: "unavailable",
        message: "浏览器本地存储不可访问。",
        raw: error instanceof Error ? error.message : String(error),
      };
    }

    if (!storage) {
      return {
        ok: false,
        reason: "unavailable",
        message: "当前环境没有可用的浏览器本地存储。",
      };
    }

    let raw: string | null;
    try {
      raw = storage.getItem(LEARNING_STATE_STORAGE_KEY);
    } catch (error) {
      return {
        ok: false,
        reason: "unavailable",
        message: `读取浏览器本地存储失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    if (raw === null) {
      return { ok: true, value: null };
    }

    let input: unknown;
    try {
      input = JSON.parse(raw) as unknown;
    } catch (error) {
      return {
        ok: false,
        reason: "corrupt",
        raw,
        message: `本地学习数据不是有效 JSON：${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    const migrated = migratePersistedEnvelope(input);
    return migrated.ok
      ? { ok: true, value: migrated.value, raw }
      : { ...migrated, raw };
  }

  async save(value: PersistedEnvelopeV1): Promise<void> {
    const parsed = persistedEnvelopeV1Schema.safeParse(value);
    if (!parsed.success) {
      throw new LearningStateStorageError(
        `拒绝保存未通过校验的学习数据：${parsed.error.message}`,
      );
    }

    let storage: StringStorage | undefined;
    try {
      storage = this.getStorage();
      if (!storage) {
        throw new LearningStateStorageError("当前环境没有可用的浏览器本地存储。");
      }
      storage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(parsed.data));
    } catch (error) {
      if (error instanceof LearningStateStorageError) throw error;
      throw new LearningStateStorageError(
        `保存浏览器本地学习数据失败：${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  async clear(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) {
      throw new LearningStateStorageError("当前环境没有可用的浏览器本地存储。");
    }
    storage.removeItem(LEARNING_STATE_STORAGE_KEY);
  }
}
