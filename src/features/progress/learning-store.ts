import { createStore, type StoreApi } from "zustand/vanilla";

import {
  addMasteryEvidence,
  confirmConceptMastery,
  downgradeConcept,
  inspectLearningStateAgainstCatalog,
  markConceptUnderstood,
  startConcept,
  type ProgressCatalog,
  type ProgressMutationResult,
} from "./progress-domain";
import {
  createInitialLearningState,
  createPersistedEnvelope,
  type LearningStateStorageAdapter,
  LocalStorageLearningStateAdapter,
} from "@/lib/storage";
import { learningStateV1Schema } from "@/lib/validation/progress-schemas";
import type { LearningStateV1, MasteryEvidence } from "@/types";

export type PersistenceStatus =
  | "pending"
  | "ready"
  | "blocked"
  | "unavailable"
  | "error";

export type LearningStoreActionResult =
  | ProgressMutationResult
  | {
      readonly ok: false;
      readonly code: "persistence-blocked";
      readonly message: string;
    };

export interface LearningStoreState {
  readonly learningState: LearningStateV1;
  readonly hydrated: boolean;
  readonly persistenceStatus: PersistenceStatus;
  readonly persistenceMessage?: string;
  readonly rawRecoveryData?: string;
  readonly orphanConceptIds: readonly string[];
  readonly orphanTrackIds: readonly string[];
  readonly revision: number;
  hydrate: () => Promise<void>;
  startConcept: (conceptId: string) => Promise<LearningStoreActionResult>;
  markUnderstood: (conceptId: string) => Promise<LearningStoreActionResult>;
  addEvidence: (
    conceptId: string,
    evidence: MasteryEvidence,
  ) => Promise<LearningStoreActionResult>;
  confirmMastery: (
    conceptId: string,
    userConfirmed: boolean,
  ) => Promise<LearningStoreActionResult>;
  downgradeConcept: (
    conceptId: string,
    targetStatus: "not_started" | "learning" | "understood",
  ) => Promise<LearningStoreActionResult>;
}

export type LearningStoreApi = StoreApi<LearningStoreState>;

export interface CreateLearningStoreOptions {
  readonly catalog: ProgressCatalog;
  readonly contentVersion: string;
  readonly adapter?: LearningStateStorageAdapter;
  readonly now?: () => string;
}

function missingConceptResult(conceptId: string): ProgressMutationResult {
  return {
    ok: false,
    code: "missing-concept",
    message: `当前内容 catalog 不存在 Concept ${conceptId}。`,
  };
}

export function createLearningStore({
  adapter = new LocalStorageLearningStateAdapter(),
  catalog,
  contentVersion,
  now = () => new Date().toISOString(),
}: CreateLearningStoreOptions): LearningStoreApi {
  const conceptsById = new Map(catalog.concepts.map((concept) => [concept.id, concept]));
  const initialState = () => createInitialLearningState(catalog.tracks, now());

  return createStore<LearningStoreState>()((set, get) => {
    async function persist(nextState: LearningStateV1) {
      const current = get();
      const nextRevision = current.revision + 1;
      set({ learningState: nextState });

      try {
        await adapter.save(
          createPersistedEnvelope(
            nextState,
            contentVersion,
            nextRevision,
            now(),
          ),
        );
        set({
          revision: nextRevision,
          persistenceStatus: "ready",
          persistenceMessage: undefined,
        });
      } catch (error) {
        set({
          persistenceStatus: "error",
          persistenceMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    async function commitConceptMutation(
      conceptId: string,
      mutation: ProgressMutationResult,
    ): Promise<LearningStoreActionResult> {
      if (!mutation.ok || !mutation.changed) return mutation;
      if (get().persistenceStatus === "blocked") {
        return {
          ok: false,
          code: "persistence-blocked",
          message: "原始本地数据需要恢复处理；为避免覆盖，当前已禁用持久化写入。",
        };
      }

      const current = get().learningState;
      const nextState = learningStateV1Schema.parse({
        ...current,
        conceptProgress: {
          ...current.conceptProgress,
          [conceptId]: mutation.progress,
        },
      });
      await persist(nextState);
      return mutation;
    }

    return {
      learningState: initialState(),
      hydrated: false,
      persistenceStatus: "pending",
      orphanConceptIds: [],
      orphanTrackIds: [],
      revision: 0,

      hydrate: async () => {
        const loaded = await adapter.load();
        if (!loaded.ok) {
          set({
            learningState: initialState(),
            hydrated: true,
            persistenceStatus:
              loaded.reason === "unavailable" ? "unavailable" : "blocked",
            persistenceMessage: loaded.message,
            rawRecoveryData: loaded.raw,
            orphanConceptIds: [],
            orphanTrackIds: [],
            revision: 0,
          });
          return;
        }

        if (loaded.value === null) {
          set({
            learningState: initialState(),
            hydrated: true,
            persistenceStatus: "ready",
            persistenceMessage: undefined,
            rawRecoveryData: undefined,
            orphanConceptIds: [],
            orphanTrackIds: [],
            revision: 0,
          });
          return;
        }

        const inspection = inspectLearningStateAgainstCatalog(
          loaded.value.payload,
          catalog,
        );
        if (inspection.errors.length > 0) {
          set({
            learningState: initialState(),
            hydrated: true,
            persistenceStatus: "blocked",
            persistenceMessage: `本地学习数据引用校验失败：${inspection.errors.join("；")}`,
            rawRecoveryData: loaded.raw ?? JSON.stringify(loaded.value),
            orphanConceptIds: inspection.orphanConceptIds,
            orphanTrackIds: inspection.orphanTrackIds,
            revision: 0,
          });
          return;
        }

        set({
          learningState: loaded.value.payload,
          hydrated: true,
          persistenceStatus: "ready",
          persistenceMessage: undefined,
          rawRecoveryData: undefined,
          orphanConceptIds: inspection.orphanConceptIds,
          orphanTrackIds: inspection.orphanTrackIds,
          revision: loaded.value.revision,
        });
      },

      startConcept: async (conceptId) => {
        if (!conceptsById.has(conceptId)) return missingConceptResult(conceptId);
        const current = get().learningState.conceptProgress[conceptId];
        return commitConceptMutation(conceptId, startConcept(current, now()));
      },

      markUnderstood: async (conceptId) => {
        const concept = conceptsById.get(conceptId);
        if (!concept) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          markConceptUnderstood(
            concept,
            get().learningState.conceptProgress,
            now(),
          ),
        );
      },

      addEvidence: async (conceptId, evidence) => {
        const concept = conceptsById.get(conceptId);
        if (!concept) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          addMasteryEvidence(
            concept,
            get().learningState.conceptProgress[conceptId],
            evidence,
            now(),
          ),
        );
      },

      confirmMastery: async (conceptId, userConfirmed) => {
        const concept = conceptsById.get(conceptId);
        if (!concept) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          confirmConceptMastery(
            concept,
            get().learningState.conceptProgress[conceptId],
            userConfirmed,
            now(),
          ),
        );
      },

      downgradeConcept: async (conceptId, targetStatus) => {
        if (!conceptsById.has(conceptId)) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          downgradeConcept(
            get().learningState.conceptProgress[conceptId],
            targetStatus,
            now(),
          ),
        );
      },
    };
  });
}
