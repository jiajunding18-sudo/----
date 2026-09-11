import type { ProgressProjectDefinition } from "@/features/progress/progress-domain";
import type { LearningStateV4, ProjectProgress } from "@/types";
import { getProjectCompletionEligibility, getProjectReadiness } from "./project-readiness";

export function getMilestoneReadiness(project: ProgressProjectDefinition, state: LearningStateV4, milestoneId: string) {
  const scoped = resolveProjectMilestone(project, milestoneId);
  return scoped ? { contractPublished: true, ...getProjectReadiness(scoped, scopeProjectState(state, project.id, milestoneId)) } : {
    contractPublished: false, knowledgeReady: false, environmentReady: null,
    missingHardConceptIds: [], missingRecommendedConceptIds: [], missingEnvironmentRequirementIds: [], pathReadiness: [],
  };
}

export function getMilestoneCompletionEligibility(project: ProgressProjectDefinition, state: LearningStateV4, milestoneId: string) {
  const scoped = resolveProjectMilestone(project, milestoneId);
  return scoped ? { contractPublished: true, ...getProjectCompletionEligibility(scoped, getProjectScopeProgress(state, project.id, milestoneId)) } : {
    contractPublished: false, eligible: false, missingAcceptanceCriterionIds: [], hasDeliverable: false,
  };
}

/** Resolve a single execution contract; never merge requirements across stages. */
export function resolveProjectMilestone<P extends ProgressProjectDefinition>(project: P, milestoneId?: string): P | undefined {
  if (!milestoneId) return project.milestones?.length ? undefined : project;
  const milestone = project.milestones?.find(({ id }) => id === milestoneId);
  if (!milestone || milestone.contract.kind === "planned") return undefined;
  return {
    ...project,
    ...(milestone.contract.kind === "inline" ? milestone.contract.definition : {}),
    milestones: undefined,
  };
}

export function getProjectScopeProgress(state: LearningStateV4, projectId: string, milestoneId?: string) {
  const record = state.projectProgress[projectId];
  return milestoneId ? record?.milestones?.[milestoneId] : record;
}

export function isProjectGateCompleted(project: ProgressProjectDefinition, state: LearningStateV4, milestoneId?: string): boolean {
  if (project.publicationStatus !== "published") return false;
  if (milestoneId) return !!resolveProjectMilestone(project, milestoneId) && getProjectScopeProgress(state, project.id, milestoneId)?.status === "completed";
  return state.projectProgress[project.id]?.status === "completed";
}

/** UI aggregate only. Never substitutes for a legacy projectId-only gate. */
export function areAllProjectMilestonesCompleted(project: ProgressProjectDefinition, state: LearningStateV4): boolean {
  return !!project.milestones?.length && project.milestones.every(({ id }) => isProjectGateCompleted(project, state, id));
}

export function getProjectAggregateStatus(project: ProgressProjectDefinition, state: LearningStateV4): ProjectProgress["status"] {
  if (!project.milestones?.length) return state.projectProgress[project.id]?.status ?? "not_started";
  if (areAllProjectMilestonesCompleted(project, state)) return "completed";
  const records = project.milestones.map(({ id }) => getProjectScopeProgress(state, project.id, id));
  if (records.some((record) => record?.status === "in_progress" || record?.status === "completed")) return "in_progress";
  return records.some((record) => record?.status === "paused") ? "paused" : "not_started";
}

export function scopeProjectState(state: LearningStateV4, projectId: string, milestoneId?: string): LearningStateV4 {
  if (!milestoneId) return state;
  const record = getProjectScopeProgress(state, projectId, milestoneId);
  const projectProgress = { ...state.projectProgress };
  if (record) projectProgress[projectId] = record;
  else delete projectProgress[projectId];
  return { ...state, projectProgress };
}
