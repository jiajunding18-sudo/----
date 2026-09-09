import type { ProgressProjectDefinition } from "@/features/progress/progress-domain";
import type {
  LearningStateV2,
  ProjectProgress,
} from "@/types";
import { projectProgressSchema } from "@/lib/validation/progress-schemas";

import {
  getProjectCompletionEligibility,
  getProjectReadiness,
} from "./project-readiness";

export interface StartProjectInput {
  readonly selectedExecutionPathId: string;
  readonly nextAction: string;
  readonly environmentChecks: Readonly<Record<string, boolean>>;
  readonly confirmPrerequisiteOverride: boolean;
}

export interface ProjectDeliverableInput {
  readonly id: string;
  readonly title: string;
  readonly reference?: string;
  readonly note?: string;
}

export type ProjectProgressMutationErrorCode =
  | "project-not-published"
  | "project-already-started"
  | "invalid-execution-path"
  | "invalid-environment-requirement"
  | "missing-next-action"
  | "confirmation-required"
  | "project-not-started"
  | "project-already-completed"
  | "invalid-acceptance-criterion"
  | "invalid-deliverable"
  | "completion-requirements-missing";

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
  state: LearningStateV2,
  input: StartProjectInput,
  timestamp: string,
): ProjectProgressMutationResult {
  if (project.publicationStatus !== "published" || project.milestones?.length) {
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
  if (project.milestones?.length || !progress || progress.status !== "in_progress") {
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

function getEditableProjectProgress(
  project: ProgressProjectDefinition,
  progress: ProjectProgress | undefined,
): ProjectProgressMutationResult | ProjectProgress {
  if (project.publicationStatus !== "published" || project.milestones?.length) {
    return {
      ok: false,
      code: "project-not-published",
      message: "该 Project 尚未发布，不能写入正式执行记录。",
    };
  }
  if (!progress || progress.status === "not_started") {
    return {
      ok: false,
      code: "project-not-started",
      message: "Project 必须先由用户主动开始。",
    };
  }
  if (progress.status === "completed") {
    return {
      ok: false,
      code: "project-already-completed",
      message: "已完成 Project 的完成快照不会被当前操作改写。",
    };
  }
  return progress;
}

export function setProjectAcceptanceCriterion(
  project: ProgressProjectDefinition,
  progress: ProjectProgress | undefined,
  criterionId: string,
  satisfied: boolean,
  timestamp: string,
): ProjectProgressMutationResult {
  const editable = getEditableProjectProgress(project, progress);
  if ("ok" in editable) return editable;
  if (!project.acceptanceCriteria.some(({ id }) => id === criterionId)) {
    return {
      ok: false,
      code: "invalid-acceptance-criterion",
      message: "只能更新当前 Project 正式定义的验收标准。",
      relatedIds: [criterionId],
    };
  }
  if (editable.acceptance[criterionId] === satisfied) {
    return { ok: true, progress: editable, changed: false };
  }

  return {
    ok: true,
    changed: true,
    progress: {
      ...editable,
      acceptance: { ...editable.acceptance, [criterionId]: satisfied },
      updatedAt: timestamp,
    },
  };
}

export function addProjectDeliverable(
  project: ProgressProjectDefinition,
  progress: ProjectProgress | undefined,
  input: ProjectDeliverableInput,
  timestamp: string,
): ProjectProgressMutationResult {
  const editable = getEditableProjectProgress(project, progress);
  if ("ok" in editable) return editable;
  if (editable.deliverables.some(({ id }) => id === input.id)) {
    return {
      ok: false,
      code: "invalid-deliverable",
      message: `交付物 ID ${input.id} 已存在。`,
    };
  }

  const candidate = projectProgressSchema.safeParse({
    ...editable,
    deliverables: [
      ...editable.deliverables,
      {
        id: input.id,
        title: input.title.trim(),
        reference: input.reference?.trim() || undefined,
        note: input.note?.trim() || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    updatedAt: timestamp,
  });
  if (!candidate.success) {
    return {
      ok: false,
      code: "invalid-deliverable",
      message: "交付物必须包含有效稳定 ID 和非空标题。",
    };
  }
  return { ok: true, changed: true, progress: candidate.data };
}

export function removeProjectDeliverable(
  project: ProgressProjectDefinition,
  progress: ProjectProgress | undefined,
  deliverableId: string,
  timestamp: string,
): ProjectProgressMutationResult {
  const editable = getEditableProjectProgress(project, progress);
  if ("ok" in editable) return editable;
  if (!editable.deliverables.some(({ id }) => id === deliverableId)) {
    return {
      ok: false,
      code: "invalid-deliverable",
      message: "当前 ProjectProgress 中不存在该交付物。",
      relatedIds: [deliverableId],
    };
  }
  return {
    ok: true,
    changed: true,
    progress: {
      ...editable,
      deliverables: editable.deliverables.filter(
        ({ id }) => id !== deliverableId,
      ),
      updatedAt: timestamp,
    },
  };
}

export function completeProjectProgress(
  project: ProgressProjectDefinition,
  progress: ProjectProgress | undefined,
  userConfirmed: boolean,
  timestamp: string,
): ProjectProgressMutationResult {
  const editable = getEditableProjectProgress(project, progress);
  if ("ok" in editable) return editable;
  if (!userConfirmed) {
    return {
      ok: false,
      code: "confirmation-required",
      message: "完成 Project 必须由用户主动确认。",
    };
  }

  const eligibility = getProjectCompletionEligibility(project, editable);
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: "completion-requirements-missing",
      message: eligibility.hasDeliverable
        ? "仍有必需 Acceptance Criteria 未确认。"
        : "完成前必须至少记录一个可检查交付物，并满足全部必需验收项。",
      relatedIds: eligibility.missingAcceptanceCriterionIds,
    };
  }

  const acceptanceCriterionIds = project.acceptanceCriteria
    .filter(({ id }) => editable.acceptance[id] === true)
    .map(({ id }) => id);
  const deliverableIds = editable.deliverables.map(({ id }) => id);
  const completed = projectProgressSchema.safeParse({
    ...editable,
    status: "completed",
    nextAction: undefined,
    completedAt: timestamp,
    updatedAt: timestamp,
    completionConfirmation: {
      confirmedAt: timestamp,
      acceptanceCriterionIds,
      deliverableIds,
    },
  });
  if (!completed.success) {
    return {
      ok: false,
      code: "completion-requirements-missing",
      message: "Project 完成快照未通过正式数据校验。",
    };
  }
  return { ok: true, changed: true, progress: completed.data };
}
