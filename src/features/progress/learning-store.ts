import { createStore, type StoreApi } from "zustand/vanilla";
import { mutateProjectMilestone, type MilestoneAction } from "@/features/projects/project-milestone-progress";

import {
  addProjectDeliverable as addProjectDeliverableMutation,
  completeProjectProgress,
  removeProjectDeliverable as removeProjectDeliverableMutation,
  setProjectAcceptanceCriterion as setProjectAcceptanceCriterionMutation,
  setProjectEnvironmentCheck as setProjectEnvironmentCheckMutation,
  startProjectProgress,
  type ProjectDeliverableInput,
  type ProjectProgressMutationResult,
  type StartProjectInput,
} from "@/features/projects/project-progress";
import {
  createStudyLog as createStudyLogMutation,
  updateStudyLog as updateStudyLogMutation,
  type StudyLogInput,
  type StudyLogMutationResult,
} from "@/features/study-log";

import {
  addMasteryEvidence,
  confirmConceptMastery,
  downgradeConcept,
  inspectLearningStateAgainstCatalog,
  markConceptUnderstood,
  setConceptFavorite,
  setConceptUserDifficulty,
  startConcept,
  updateConceptNote,
  type ProgressCatalog,
  type ProgressMutationResult,
} from "./progress-domain";
import {
  createLearningBackup,
  createInitialLearningState,
  createPersistedEnvelope,
  getLearningBackupFileName,
  prepareLearningStateImport,
  type ExportEnvelopeV2,
  type ImportMode,
  type LearningStateStorageAdapter,
  LocalStorageLearningStateAdapter,
  type PreparedLearningStateImport,
  type PrepareImportResult,
} from "@/lib/storage";
import { learningStateV2Schema } from "@/lib/validation/progress-schemas";
import type {
  LearningStateV2,
  MasteryEvidence,
  StudyLog,
  UserDifficulty,
} from "@/types";

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
      readonly code: "persistence-blocked" | "persistence-error";
      readonly message: string;
    };

export type ProjectLearningStoreActionResult =
  | ProjectProgressMutationResult
  | {
      readonly ok: false;
      readonly code:
        | "missing-project"
        | "persistence-blocked"
        | "persistence-error";
      readonly message: string;
    };

export type StudyLogLearningStoreActionResult =
  | StudyLogMutationResult
  | { readonly ok: true; readonly changed: true; readonly deletedId: string }
  | {
      readonly ok: false;
      readonly code:
        | "missing-study-log"
        | "duplicate-study-log"
        | "invalid-study-log-association"
        | "confirmation-required"
        | "persistence-blocked"
        | "persistence-error";
      readonly message: string;
    };

export type DataManagementActionResult =
  | { readonly ok: true; readonly recoveryKey?: string }
  | {
      readonly ok: false;
      readonly code:
        | "confirmation-required"
        | "invalid-import"
        | "recovery-failed"
        | "save-failed";
      readonly message: string;
    };

export type BackupCreationResult =
  | {
      readonly ok: true;
      readonly envelope: ExportEnvelopeV2;
      readonly filename: string;
      readonly json: string;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export interface LearningStoreState {
  mutateMilestone: (projectId: string, milestoneId: string, action: MilestoneAction) => Promise<ProjectLearningStoreActionResult>;
  readonly learningState: LearningStateV2;
  readonly hydrated: boolean;
  readonly persistenceStatus: PersistenceStatus;
  readonly persistenceMessage?: string;
  readonly rawRecoveryData?: string;
  readonly orphanConceptIds: readonly string[];
  readonly orphanProjectIds: readonly string[];
  readonly orphanStageIds: readonly string[];
  readonly orphanTrackIds: readonly string[];
  readonly revision: number;
  readonly savedAt?: string;
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
  updateConceptNote: (
    conceptId: string,
    note: string,
  ) => Promise<LearningStoreActionResult>;
  setConceptFavorite: (
    conceptId: string,
    favorite: boolean,
  ) => Promise<LearningStoreActionResult>;
  setConceptUserDifficulty: (
    conceptId: string,
    userDifficulty: UserDifficulty | undefined,
  ) => Promise<LearningStoreActionResult>;
  startProject: (
    projectId: string,
    input: StartProjectInput,
  ) => Promise<ProjectLearningStoreActionResult>;
  setProjectEnvironmentCheck: (
    projectId: string,
    requirementId: string,
    checked: boolean,
  ) => Promise<ProjectLearningStoreActionResult>;
  setProjectAcceptanceCriterion: (
    projectId: string,
    criterionId: string,
    satisfied: boolean,
  ) => Promise<ProjectLearningStoreActionResult>;
  addProjectDeliverable: (
    projectId: string,
    input: ProjectDeliverableInput,
  ) => Promise<ProjectLearningStoreActionResult>;
  removeProjectDeliverable: (
    projectId: string,
    deliverableId: string,
  ) => Promise<ProjectLearningStoreActionResult>;
  completeProject: (
    projectId: string,
    userConfirmed: boolean,
  ) => Promise<ProjectLearningStoreActionResult>;
  createStudyLog: (
    input: StudyLogInput,
  ) => Promise<StudyLogLearningStoreActionResult>;
  updateStudyLog: (
    logId: string,
    input: StudyLogInput,
  ) => Promise<StudyLogLearningStoreActionResult>;
  deleteStudyLog: (
    logId: string,
    userConfirmed: boolean,
  ) => Promise<StudyLogLearningStoreActionResult>;
  createBackup: (localDate: string) => BackupCreationResult;
  recordBackupCreated: (timestamp: string) => Promise<DataManagementActionResult>;
  prepareImport: (raw: string, mode: ImportMode) => PrepareImportResult;
  applyImport: (
    prepared: PreparedLearningStateImport,
    userConfirmed: boolean,
  ) => Promise<DataManagementActionResult>;
  resetLearningData: (
    userConfirmed: boolean,
  ) => Promise<DataManagementActionResult>;
}

export type LearningStoreApi = StoreApi<LearningStoreState>;

export interface CreateLearningStoreOptions {
  readonly catalog: ProgressCatalog;
  readonly contentVersion: string;
  readonly adapter?: LearningStateStorageAdapter;
  readonly now?: () => string;
  readonly createStudyLogId?: () => string;
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
  createStudyLogId = () => `study-log.${globalThis.crypto.randomUUID()}`,
  now = () => new Date().toISOString(),
}: CreateLearningStoreOptions): LearningStoreApi {
  const conceptsById = new Map(catalog.concepts.map((concept) => [concept.id, concept]));
  const projectsById = new Map(catalog.projects.map((project) => [project.id, project]));
  const publishedConceptIds = new Set(
    catalog.concepts
      .filter(({ publicationStatus }) => publicationStatus === "published")
      .map(({ id }) => id),
  );
  const publishedProjectIds = new Set(
    catalog.projects
      .filter(({ publicationStatus }) => publicationStatus === "published")
      .map(({ id }) => id),
  );
  const initialState = () => createInitialLearningState(catalog.tracks, now());

  return createStore<LearningStoreState>()((set, get) => {
    async function persist(
      nextState: LearningStateV2,
    ): Promise<string | undefined> {
      const current = get();
      const nextRevision = current.revision + 1;
      const timestamp = now();

      try {
        await adapter.save(
          createPersistedEnvelope(
            nextState,
            contentVersion,
            nextRevision,
            timestamp,
          ),
        );
        const inspection = inspectLearningStateAgainstCatalog(nextState, catalog);
        set({
          learningState: nextState,
          revision: nextRevision,
          savedAt: timestamp,
          persistenceStatus: "ready",
          persistenceMessage: undefined,
          orphanConceptIds: inspection.orphanConceptIds,
          orphanProjectIds: inspection.orphanProjectIds,
          orphanStageIds: inspection.orphanStageIds,
          orphanTrackIds: inspection.orphanTrackIds,
        });
        return undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({
          persistenceStatus: "error",
          persistenceMessage: message,
        });
        return message;
      }
    }

    async function persistAtomically(
      nextState: LearningStateV2,
    ): Promise<DataManagementActionResult> {
      const parsed = learningStateV2Schema.safeParse(nextState);
      if (!parsed.success) {
        return {
          ok: false,
          code: "invalid-import",
          message: `拒绝写入未通过校验的学习数据：${parsed.error.message}`,
        };
      }

      const timestamp = now();
      const nextRevision = get().revision + 1;
      try {
        await adapter.save(
          createPersistedEnvelope(
            parsed.data,
            contentVersion,
            nextRevision,
            timestamp,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ persistenceStatus: "error", persistenceMessage: message });
        return { ok: false, code: "save-failed", message };
      }

      const inspection = inspectLearningStateAgainstCatalog(parsed.data, catalog);
      set({
        learningState: parsed.data,
        persistenceStatus: "ready",
        persistenceMessage: undefined,
        rawRecoveryData: undefined,
        orphanConceptIds: inspection.orphanConceptIds,
        orphanProjectIds: inspection.orphanProjectIds,
        orphanStageIds: inspection.orphanStageIds,
        orphanTrackIds: inspection.orphanTrackIds,
        revision: nextRevision,
        savedAt: timestamp,
      });
      return { ok: true };
    }

    async function preserveCurrentData(): Promise<DataManagementActionResult> {
      const current = get();
      const timestamp = now();
      try {
        const recoveryKey = current.rawRecoveryData
          ? await adapter.saveRawRecovery(current.rawRecoveryData, timestamp)
          : await adapter.saveRecovery(
              createPersistedEnvelope(
                current.learningState,
                contentVersion,
                Math.max(1, current.revision),
                current.savedAt ?? timestamp,
              ),
            );
        return { ok: true, recoveryKey };
      } catch (error) {
        return {
          ok: false,
          code: "recovery-failed",
          message: `未能创建恢复快照，操作已取消：${
            error instanceof Error ? error.message : String(error)
          }`,
        };
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
      const nextState = learningStateV2Schema.parse({
        ...current,
        conceptProgress: {
          ...current.conceptProgress,
          [conceptId]: mutation.progress,
        },
      });
      const persistenceError = await persist(nextState);
      if (persistenceError) {
        return {
          ok: false,
          code: "persistence-error",
          message: `未能保存到浏览器，当前学习数据没有改变：${persistenceError}`,
        };
      }
      return mutation;
    }

    async function commitProjectMutation(
      projectId: string,
      mutation: ProjectProgressMutationResult,
    ): Promise<ProjectLearningStoreActionResult> {
      if (!mutation.ok || !mutation.changed) return mutation;
      if (get().persistenceStatus === "blocked") {
        return {
          ok: false,
          code: "persistence-blocked",
          message: "原始本地数据需要恢复处理；为避免覆盖，当前已禁用持久化写入。",
        };
      }

      const current = get().learningState;
      const nextState = learningStateV2Schema.parse({
        ...current,
        projectProgress: {
          ...current.projectProgress,
          [projectId]: mutation.progress,
        },
      });
      const persistenceError = await persist(nextState);
      if (persistenceError) {
        return {
          ok: false,
          code: "persistence-error",
          message: `未能保存到浏览器，当前项目数据没有改变：${persistenceError}`,
        };
      }
      return mutation;
    }

    function invalidStudyLogAssociation(
      input: StudyLogInput,
      existing?: StudyLog,
    ): string | undefined {
      const retainedConceptIds = new Set(existing?.conceptIds ?? []);
      const retainedProjectIds = new Set(existing?.projectIds ?? []);
      const invalidConceptId = input.conceptIds.find(
        (conceptId) =>
          !publishedConceptIds.has(conceptId) && !retainedConceptIds.has(conceptId),
      );
      if (invalidConceptId) {
        return `不能新增当前未发布或不存在的 Concept 关联 ${invalidConceptId}。`;
      }
      const invalidProjectId = input.projectIds.find(
        (projectId) =>
          !publishedProjectIds.has(projectId) && !retainedProjectIds.has(projectId),
      );
      return invalidProjectId
        ? `不能新增当前未发布或不存在的 Project 关联 ${invalidProjectId}。`
        : undefined;
    }

    async function commitStudyLogs(
      nextLogs: readonly StudyLog[],
    ): Promise<string | undefined> {
      if (get().persistenceStatus === "blocked") {
        return "原始本地数据需要恢复处理；为避免覆盖，当前已禁用持久化写入。";
      }
      const current = get().learningState;
      const nextState = learningStateV2Schema.parse({
        ...current,
        studyLogs: nextLogs,
      });
      return persist(nextState);
    }

    return {
      mutateMilestone: async (projectId, milestoneId, action) => {
        const project = projectsById.get(projectId);
        if (!project) return { ok: false, code: "missing-project", message: `不存在 Project ${projectId}` };
        return commitProjectMutation(projectId, mutateProjectMilestone(project, get().learningState, milestoneId, action, now()));
      },
      learningState: initialState(),
      hydrated: false,
      persistenceStatus: "pending",
      orphanConceptIds: [],
      orphanProjectIds: [],
      orphanStageIds: [],
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
            orphanProjectIds: [],
            orphanStageIds: [],
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
            orphanProjectIds: [],
            orphanStageIds: [],
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
            orphanProjectIds: inspection.orphanProjectIds,
            orphanStageIds: inspection.orphanStageIds,
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
          orphanProjectIds: inspection.orphanProjectIds,
          orphanStageIds: inspection.orphanStageIds,
          orphanTrackIds: inspection.orphanTrackIds,
          revision: loaded.value.revision,
          savedAt: loaded.value.savedAt,
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

      updateConceptNote: async (conceptId, note) => {
        if (!conceptsById.has(conceptId)) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          updateConceptNote(
            get().learningState.conceptProgress[conceptId],
            note,
            now(),
          ),
        );
      },

      setConceptFavorite: async (conceptId, favorite) => {
        if (!conceptsById.has(conceptId)) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          setConceptFavorite(
            get().learningState.conceptProgress[conceptId],
            favorite,
            now(),
          ),
        );
      },

      setConceptUserDifficulty: async (conceptId, userDifficulty) => {
        if (!conceptsById.has(conceptId)) return missingConceptResult(conceptId);
        return commitConceptMutation(
          conceptId,
          setConceptUserDifficulty(
            get().learningState.conceptProgress[conceptId],
            userDifficulty,
            now(),
          ),
        );
      },

      startProject: async (projectId, input) => {
        const project = projectsById.get(projectId);
        if (!project) {
          return {
            ok: false,
            code: "missing-project",
            message: `当前内容 catalog 不存在 Project ${projectId}。`,
          };
        }
        const current = get().learningState;
        return commitProjectMutation(
          projectId,
          startProjectProgress(project, current, input, now()),
        );
      },

      setProjectEnvironmentCheck: async (
        projectId,
        requirementId,
        checked,
      ) => {
        const project = projectsById.get(projectId);
        if (!project) {
          return {
            ok: false,
            code: "missing-project",
            message: `当前内容 catalog 不存在 Project ${projectId}。`,
          };
        }
        return commitProjectMutation(
          projectId,
          setProjectEnvironmentCheckMutation(
            project,
            get().learningState.projectProgress[projectId],
            requirementId,
            checked,
            now(),
          ),
        );
      },

      setProjectAcceptanceCriterion: async (
        projectId,
        criterionId,
        satisfied,
      ) => {
        const project = projectsById.get(projectId);
        if (!project) {
          return {
            ok: false,
            code: "missing-project",
            message: `当前内容 catalog 不存在 Project ${projectId}。`,
          };
        }
        return commitProjectMutation(
          projectId,
          setProjectAcceptanceCriterionMutation(
            project,
            get().learningState.projectProgress[projectId],
            criterionId,
            satisfied,
            now(),
          ),
        );
      },

      addProjectDeliverable: async (projectId, input) => {
        const project = projectsById.get(projectId);
        if (!project) {
          return {
            ok: false,
            code: "missing-project",
            message: `当前内容 catalog 不存在 Project ${projectId}。`,
          };
        }
        return commitProjectMutation(
          projectId,
          addProjectDeliverableMutation(
            project,
            get().learningState.projectProgress[projectId],
            input,
            now(),
          ),
        );
      },

      removeProjectDeliverable: async (projectId, deliverableId) => {
        const project = projectsById.get(projectId);
        if (!project) {
          return {
            ok: false,
            code: "missing-project",
            message: `当前内容 catalog 不存在 Project ${projectId}。`,
          };
        }
        return commitProjectMutation(
          projectId,
          removeProjectDeliverableMutation(
            project,
            get().learningState.projectProgress[projectId],
            deliverableId,
            now(),
          ),
        );
      },

      completeProject: async (projectId, userConfirmed) => {
        const project = projectsById.get(projectId);
        if (!project) {
          return {
            ok: false,
            code: "missing-project",
            message: `当前内容 catalog 不存在 Project ${projectId}。`,
          };
        }
        return commitProjectMutation(
          projectId,
          completeProjectProgress(
            project,
            get().learningState.projectProgress[projectId],
            userConfirmed,
            now(),
          ),
        );
      },

      createStudyLog: async (input) => {
        const associationError = invalidStudyLogAssociation(input);
        if (associationError) {
          return {
            ok: false,
            code: "invalid-study-log-association",
            message: associationError,
          };
        }
        const id = createStudyLogId();
        if (get().learningState.studyLogs.some((log) => log.id === id)) {
          return {
            ok: false,
            code: "duplicate-study-log",
            message: `Study Log ID ${id} 已存在。`,
          };
        }
        const mutation = createStudyLogMutation(input, id, now());
        if (!mutation.ok) return mutation;
        const error = await commitStudyLogs([
          ...get().learningState.studyLogs,
          mutation.log,
        ]);
        return error
          ? {
              ok: false,
              code:
                get().persistenceStatus === "blocked"
                  ? "persistence-blocked"
                  : "persistence-error",
              message: `未能保存学习记录：${error}`,
            }
          : mutation;
      },

      updateStudyLog: async (logId, input) => {
        const existing = get().learningState.studyLogs.find(
          (log) => log.id === logId,
        );
        if (!existing) {
          return {
            ok: false,
            code: "missing-study-log",
            message: `Study Log ${logId} 不存在。`,
          };
        }
        const associationError = invalidStudyLogAssociation(input, existing);
        if (associationError) {
          return {
            ok: false,
            code: "invalid-study-log-association",
            message: associationError,
          };
        }
        const mutation = updateStudyLogMutation(existing, input, now());
        if (!mutation.ok || !mutation.changed) return mutation;
        const error = await commitStudyLogs(
          get().learningState.studyLogs.map((log) =>
            log.id === logId ? mutation.log : log,
          ),
        );
        return error
          ? {
              ok: false,
              code:
                get().persistenceStatus === "blocked"
                  ? "persistence-blocked"
                  : "persistence-error",
              message: `未能保存学习记录：${error}`,
            }
          : mutation;
      },

      deleteStudyLog: async (logId, userConfirmed) => {
        if (!userConfirmed) {
          return {
            ok: false,
            code: "confirmation-required",
            message: "删除学习记录前需要明确确认。",
          };
        }
        const currentLogs = get().learningState.studyLogs;
        if (!currentLogs.some((log) => log.id === logId)) {
          return {
            ok: false,
            code: "missing-study-log",
            message: `Study Log ${logId} 不存在。`,
          };
        }
        const error = await commitStudyLogs(
          currentLogs.filter((log) => log.id !== logId),
        );
        return error
          ? {
              ok: false,
              code:
                get().persistenceStatus === "blocked"
                  ? "persistence-blocked"
                  : "persistence-error",
              message: `未能删除学习记录：${error}`,
            }
          : { ok: true, changed: true, deletedId: logId };
      },

      createBackup: (localDate) => {
        const current = get();
        try {
          const exportedAt = now();
          const backup = createLearningBackup({
            state: current.learningState,
            contentVersion,
            revision: current.revision,
            savedAt: current.savedAt ?? exportedAt,
            exportedAt,
          });
          return {
            ok: true,
            ...backup,
            filename: getLearningBackupFileName(localDate),
          };
        } catch (error) {
          return {
            ok: false,
            message: `生成备份失败：${
              error instanceof Error ? error.message : String(error)
            }`,
          };
        }
      },

      recordBackupCreated: async (timestamp) => {
        const current = get().learningState;
        const nextState = learningStateV2Schema.parse({
          ...current,
          preferences: {
            ...current.preferences,
            lastBackupAt: timestamp,
            updatedAt: timestamp,
          },
        });
        return persistAtomically(nextState);
      },

      prepareImport: (raw, mode) =>
        prepareLearningStateImport({
          raw,
          currentState: get().learningState,
          catalog,
          mode,
        }),

      applyImport: async (prepared, userConfirmed) => {
        if (!userConfirmed) {
          return {
            ok: false,
            code: "confirmation-required",
            message: "请先明确确认导入操作。",
          };
        }

        const refreshed = prepareLearningStateImport({
          raw: JSON.stringify(prepared.envelope),
          currentState: get().learningState,
          catalog,
          mode: prepared.preview.mode,
        });
        if (!refreshed.ok) {
          return { ok: false, code: "invalid-import", message: refreshed.message };
        }

        if (
          refreshed.value.preview.mode === "replace" ||
          get().persistenceStatus === "blocked"
        ) {
          const recovery = await preserveCurrentData();
          if (!recovery.ok) return recovery;
          const saved = await persistAtomically(refreshed.value.nextState);
          return saved.ok ? { ...saved, recoveryKey: recovery.recoveryKey } : saved;
        }

        return persistAtomically(refreshed.value.nextState);
      },

      resetLearningData: async (userConfirmed) => {
        if (!userConfirmed) {
          return {
            ok: false,
            code: "confirmation-required",
            message: "请先明确确认清空学习记录。",
          };
        }

        const recovery = await preserveCurrentData();
        if (!recovery.ok) return recovery;
        const timestamp = now();
        const current = get().learningState;
        const nextState = learningStateV2Schema.parse({
          ...current,
          preferences: {
            ...current.preferences,
            currentConceptId: undefined,
            primaryProjectId: undefined,
            updatedAt: timestamp,
          },
          conceptProgress: {},
          projectProgress: {},
          stageCheckpoints: {},
          studyLogs: [],
        });
        const saved = await persistAtomically(nextState);
        return saved.ok ? { ...saved, recoveryKey: recovery.recoveryKey } : saved;
      },
    };
  });
}
