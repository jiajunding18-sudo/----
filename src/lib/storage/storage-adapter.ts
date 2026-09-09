import { migratePersistedEnvelope } from "./migrations";
import {
  LEARNING_STATE_RECOVERY_KEY_PREFIX,
  LEARNING_STATE_STORAGE_KEY,
  persistedEnvelopeV2Schema,
  type PersistedEnvelopeV2,
} from "./learning-state";

export type StorageLoadResult =
  | {
      readonly ok: true;
      readonly value: PersistedEnvelopeV2 | null;
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
  save(value: PersistedEnvelopeV2): Promise<void>;
  saveRecovery(value: PersistedEnvelopeV2): Promise<string>;
  saveRawRecovery(raw: string, timestamp: string): Promise<string>;
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

function recoveryKey(
  storage: StringStorage,
  timestamp: string,
  kind: "state" | "raw",
) {
  const base = `${LEARNING_STATE_RECOVERY_KEY_PREFIX}${timestamp}:${kind}`;
  let candidate = base;
  let suffix = 1;
  while (storage.getItem(candidate) !== null) {
    candidate = `${base}:${suffix}`;
    suffix += 1;
  }
  return candidate;
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
      const message = `本地学习数据不是有效 JSON：${error instanceof Error ? error.message : String(error)}`;
      let backupMessage = "";
      try {
        await this.saveRawSnapshot(raw, "load:invalid-json");
      } catch (backupError) {
        backupMessage = `；原始备份失败，主数据仍保留：${backupError instanceof Error ? backupError.message : String(backupError)}`;
      }
      return {
        ok: false,
        reason: "corrupt",
        raw,
        message: message + backupMessage,
      };
    }

    const migrated = migratePersistedEnvelope(input);
    const inputVersion = typeof input === "object" && input !== null && "schemaVersion" in input ? input.schemaVersion : "unknown";
    if (!migrated.ok || inputVersion === 1) {
      try {
        // Preserve exact v1 bytes before any subsequent v2 save. A failed backup blocks writes.
        await this.saveRawSnapshot(raw, migrated.ok ? "migration:v1-to-v2" : `load:${String(inputVersion)}:${migrated.reason}:${migrated.message}`);
      } catch (error) {
        return { ok: false, reason: "corrupt", raw, message: `迁移前备份失败，保留旧数据：${error instanceof Error ? error.message : String(error)}` };
      }
    }
    return migrated.ok
      ? { ok: true, value: migrated.value, raw }
      : { ...migrated, raw };
  }

  async save(value: PersistedEnvelopeV2): Promise<void> {
    const parsed = persistedEnvelopeV2Schema.safeParse(value);
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

  async saveRecovery(value: PersistedEnvelopeV2): Promise<string> {
    const parsed = persistedEnvelopeV2Schema.safeParse(value);
    if (!parsed.success) {
      throw new LearningStateStorageError(
        `拒绝备份未通过校验的学习数据：${parsed.error.message}`,
      );
    }

    try {
      const storage = this.getStorage();
      if (!storage) {
        throw new LearningStateStorageError("当前环境没有可用的浏览器本地存储。");
      }
      const key = recoveryKey(storage, parsed.data.savedAt, "state");
      storage.setItem(key, JSON.stringify(parsed.data));
      return key;
    } catch (error) {
      if (error instanceof LearningStateStorageError) throw error;
      throw new LearningStateStorageError(
        `创建恢复快照失败：${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  async saveRawRecovery(raw: string, _timestamp: string): Promise<string> {
    void _timestamp; // Kept for adapter compatibility; time is not snapshot identity.
    return this.saveRawSnapshot(raw, "manual-recovery");
  }

  private async saveRawSnapshot(raw: string, reason: string): Promise<string> {
    try {
      const storage = this.getStorage();
      if (!storage) {
        throw new LearningStateStorageError("当前环境没有可用的浏览器本地存储。");
      }
      // Exact bytes + fixed source key + reason identify a snapshot. No timestamp-only
      // dedupe, hashing dependency, deletion, or overwrite of a different payload.
      const base = `${LEARNING_STATE_RECOVERY_KEY_PREFIX}raw:${encodeURIComponent(LEARNING_STATE_STORAGE_KEY)}:${encodeURIComponent(reason)}`;
      for (let index = 0; ; index += 1) {
        const key = `${base}:${index}`;
        const existing = storage.getItem(key);
        if (existing === raw) return key;
        if (existing === null) {
          storage.setItem(key, raw);
          return key;
        }
      }
    } catch (error) {
      if (error instanceof LearningStateStorageError) throw error;
      throw new LearningStateStorageError(
        `保留原始损坏数据失败：${
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
