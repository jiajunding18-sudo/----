import type { ProgressProjectDefinition } from "@/features/progress/progress-domain";
import type {
  LearningStateV1,
  ProjectProgress,
} from "@/types";

import { getProjectReadiness } from "./project-readiness";

export interface StartProjectInput {
  readonly selectedExecutionPathId: string;
  readonly nextAction: string;
  readonly environmentChecks: Readonly<Record<string, boolean>>;
  readonly confirmPrerequisiteOverride: boolean;
}

export type ProjectProgressMutationErrorCode =
  | "project-not-published"
  | "project-already-started"
  | "invalid-execution-path"
  | "invalid-environment-requirement"
  | "missing-next-action"
  | "confirmation-required"
  | "project-not-started";

export type ProjectProgressMutationResult =
  | {
      readonly ok: true;
      readonly progress: ProjectProgress;
      readonly changed: boolean;
    }
  | {
      readonly ok: false;
      readonly code: ProjectProgressMutationErrorCode;
      readonly message: string;
      readonly relatedIds?: readonly string[];
    };

export function startProjectProgress(
  project: ProgressProjectDefinition,
  state: LearningStateV1,
  input: StartProjectInput,
  timestamp: string,
): ProjectProgressMutationResult {
  if (project.publicationStatus !== "published") {
    return {
      ok: false,
      code: "project-not-published",
      message: "该 Project 尚未发布，不能建立正式执行记录。",
    };
  }

  const current = state.projectProgress[project.id];
  if (current && current.status !== "not_started") {
    return {
      ok: false,
      code: "project-already-started",
      message: "该 Project 已有执行记录，本次不会重复开始。",
    };
  }

  const selectedPath = project.executionPaths.find(
    ({ id }) => id === input.selectedExecutionPathId,
  );
  if (!selectedPath) {
    return {
      ok: false,
      code: "invalid-execution-path",
      message: "请选择当前 Project 正式定义的一条执行路径。",
    };
  }

  const environmentRequirementIds = new Set(
    project.environmentRequirements.map(({ id }) => id),
  );
  const invalidEnvironmentRequirementIds = Object.keys(
    input.environmentChecks,
  ).filter((requirementId) => !environmentRequirementIds.has(requirementId));
  if (invalidEnvironmentRequirementIds.length > 0) {
    return {
      ok: false,
      code: "invalid-environment-requirement",
      message: "环境检查包含当前 Project 未定义的要求。",
      relatedIds: invalidEnvironmentRequirementIds,
    };
  }

  const nextAction = input.nextAction.trim();
  if (!nextAction) {
    return {
      ok: false,
      code: "missing-next-action",
      message: "开始 Project 前必须填写一项明确的下一动作。",
    };
  }

  const readiness = getProjectReadiness(project, state);
  if (
    readiness.missingHardConceptIds.length > 0 &&
    !input.confirmPrerequisiteOverride
  ) {
    return {
      ok: false,
      code: "confirmation-required",
      message: "仍有 hard knowledge requirement 未满足，请先确认带缺口开始。",
      relatedIds: readiness.missingHardConceptIds,
    };
  }

  return {
    ok: true,
    changed: true,
    progress: {
      status: "in_progress",
      note: current?.note ?? "",
      nextAction,
      selectedExecutionPathId: selectedPath.id,
      environmentChecks: { ...input.environmentChecks },
      prerequisiteOverride:
        readiness.missingHardConceptIds.length > 0
          ? {
              confirmedAt: timestamp,
              missingRequirementConceptIds: [
                ...readiness.missingHardConceptIds,
              ],
            }
          : undefined,
      acceptance: current?.acceptance ?? {},
      deliverables: current?.deliverables ?? [],
      unverifiedAssumptions: current?.unverifiedAssumptions ?? [],
      startedAt: current?.startedAt ?? timestamp,
      updatedAt: timestamp,
    },
  };
}

export function setProjectEnvironmentCheck(
  project: ProgressProjectDefinition,
  progress: ProjectProgress | undefined,
  requirementId: string,
  checked: boolean,
  timestamp: string,
): ProjectProgressMutationResult {
  if (!progress || progress.status !== "in_progress") {
    return {
      ok: false,
      code: "project-not-started",
      message: "只有正在执行的 Project 可以更新环境检查。",
    };
  }

  const selectedPath = project.executionPaths.find(
    ({ id }) => id === progress.selectedExecutionPathId,
  );
  if (!selectedPath?.requirementIds.includes(requirementId)) {
    return {
      ok: false,
      code: "invalid-environment-requirement",
      message: "只能更新当前执行路径引用的环境要求。",
      relatedIds: [requirementId],
    };
  }

  if (progress.environmentChecks[requirementId] === checked) {
    return { ok: true, progress, changed: false };
  }

  return {
    ok: true,
    changed: true,
    progress: {
      ...progress,
      environmentChecks: {
        ...progress.environmentChecks,
        [requirementId]: checked,
      },
      updatedAt: timestamp,
    },
  };
}
