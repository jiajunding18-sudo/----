import type { ProgressProjectDefinition } from "@/features/progress/progress-domain";
import type { LearningStateV2 } from "@/types";
import { addProjectDeliverable, completeProjectProgress, removeProjectDeliverable, setProjectAcceptanceCriterion, setProjectEnvironmentCheck, startProjectProgress, type ProjectDeliverableInput, type ProjectProgressMutationResult, type StartProjectInput } from "./project-progress";
import { getProjectScopeProgress, resolveProjectMilestone, scopeProjectState } from "./project-milestones";

export type MilestoneAction =
  | { kind: "start"; input: StartProjectInput }
  | { kind: "environment"; id: string; checked: boolean }
  | { kind: "acceptance"; id: string; checked: boolean }
  | { kind: "add-deliverable"; input: ProjectDeliverableInput }
  | { kind: "remove-deliverable"; id: string }
  | { kind: "complete"; confirmed: boolean };

export function mutateProjectMilestone(project: ProgressProjectDefinition, state: LearningStateV2, milestoneId: string, action: MilestoneAction, timestamp: string): ProjectProgressMutationResult {
  const scoped = resolveProjectMilestone(project, milestoneId);
  if (!scoped) return { ok: false, code: "project-not-published", message: "该 milestone 不存在或验收契约尚未发布，不能写入执行记录。" };
  const progress = getProjectScopeProgress(state, project.id, milestoneId);
  let result: ProjectProgressMutationResult;
  switch (action.kind) {
    case "start": result = startProjectProgress(scoped, scopeProjectState(state, project.id, milestoneId), action.input, timestamp); break;
    case "environment": result = setProjectEnvironmentCheck(scoped, progress, action.id, action.checked, timestamp); break;
    case "acceptance": result = setProjectAcceptanceCriterion(scoped, progress, action.id, action.checked, timestamp); break;
    case "add-deliverable": result = addProjectDeliverable(scoped, progress, action.input, timestamp); break;
    case "remove-deliverable": result = removeProjectDeliverable(scoped, progress, action.id, timestamp); break;
    case "complete": result = completeProjectProgress(scoped, progress, action.confirmed, timestamp); break;
  }
  if (!result.ok || !result.changed) return result;
  const parent = state.projectProgress[project.id] ?? {
    status: "not_started" as const, note: "", environmentChecks: {}, acceptance: {}, deliverables: [], unverifiedAssumptions: [], updatedAt: timestamp,
  };
  return { ...result, progress: { ...parent, updatedAt: timestamp, milestones: { ...parent.milestones, [milestoneId]: result.progress } } };
}
