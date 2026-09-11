import type { LearningStateV4, StageDefinition, TrackDefinition } from "@/types";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type { ProgressProjectDefinition } from "./progress-domain";
import { getProjectScopeProgress, resolveProjectMilestone } from "@/features/projects/project-milestones";
import type { StageCriterionProgress, StageEvidenceRef } from "@/lib/validation/stage-progress-schemas";
import type { StageProgressV4 as StageProgress } from "@/lib/validation/stage-completion-schemas";

export interface StageReferenceCatalog {
  readonly concepts: readonly { readonly id: string }[];
  readonly projects: readonly ProgressProjectDefinition[];
}
export function validPast(timestamp: string | undefined, now: string): boolean {
  return !!timestamp && Number.isFinite(Date.parse(timestamp)) && Number.isFinite(Date.parse(now)) && Date.parse(timestamp) <= Date.parse(now);
}
export function validRetestTime(anchor: string | undefined, retest: string | undefined, days: number, now: string): boolean {
  return validPast(anchor, now) && validPast(retest, now) && Date.parse(retest!) >= Date.parse(anchor!) + days * 86_400_000;
}
export function refKey(ref: StageEvidenceRef) { return JSON.stringify(ref); }
export function stableSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, part: unknown) => part !== null && typeof part === "object" && !Array.isArray(part)
    ? Object.fromEntries(Object.entries(part).sort(([a], [b]) => a.localeCompare(b))) : part);
}
/** Existing record identity/version only; never a filesystem/content inspection. */
export function evidenceBasis(refs: readonly StageEvidenceRef[], state: LearningStateV4, catalog: StageReferenceCatalog): string[] | undefined {
  if (refs.some(ref => !resolveStageEvidence(ref, state, catalog))) return undefined;
  return refs.map(ref => stableSnapshot([ref, ref.kind === "concept-evidence"
    ? state.conceptProgress[ref.conceptId]?.evidence.find(e => e.id === ref.evidenceId)
    : getProjectScopeProgress(state, ref.projectId, ref.milestoneId)?.deliverables.find(d => d.id === ref.deliverableId)]));
}
export function resolveStageEvidence(ref: StageEvidenceRef, state: LearningStateV4, catalog: StageReferenceCatalog): string | undefined {
  if (ref.kind === "concept-evidence") {
    if (!catalog.concepts.some(({ id }) => id === ref.conceptId)) return undefined;
    const evidence = state.conceptProgress[ref.conceptId]?.evidence.find(({ id, conceptId, result }) => id === ref.evidenceId && conceptId === ref.conceptId && result === "passed");
    return evidence?.title;
  }
  const project = catalog.projects.find(({ id }) => id === ref.projectId);
  if (!project || project.publicationStatus !== "published" || !resolveProjectMilestone(project, ref.milestoneId)) return undefined;
  const record = getProjectScopeProgress(state, project.id, ref.milestoneId)?.deliverables.find(({ id }) => id === ref.deliverableId);
  return record ? `${record.title}${record.reference ? ` · ${record.reference}` : ""}` : undefined;
}
export function criterionSatisfied(record: StageCriterionProgress | undefined, state: LearningStateV4, catalog: StageReferenceCatalog, now: string): boolean {
  return !!record && !record.confirmationInvalidatedAt && !!record.evidenceBasis && record.explanation.trim().length > 0 && validPast(record.confirmedAt, now) && validPast(record.updatedAt, now) && Date.parse(record.confirmedAt!) >= Date.parse(record.updatedAt) && record.evidenceRefs.length > 0 && new Set(record.evidenceRefs.map(refKey)).size === record.evidenceRefs.length && JSON.stringify(record.evidenceBasis) === JSON.stringify(evidenceBasis(record.evidenceRefs, state, catalog));
}
export function conditionActive(condition: DeepReadonly<StageDefinition["exitCriteria"][number]["when"]>, tracks: readonly Pick<TrackDefinition, "id" | "kind" | "defaultGoal">[], state: LearningStateV4) {
  if (condition.kind === "always") return true;
  const track = tracks.find(({ id }) => id === condition.trackId);
  const goal = track?.kind === "common" ? "master" : state.preferences.trackGoals[condition.trackId] ?? track?.defaultGoal;
  return goal === "master" || (goal === "understand" && condition.minimumGoal === "understand");
}
export function activeCycle(progress: StageProgress | undefined, now: string) {
  if (progress && stageTemporalErrors(progress, now).length) return undefined;
  const cycles = Object.values(progress?.cycles ?? {}).filter(c => !c.invalidatedAt);
  return cycles.length === 1 && validPast(cycles[0].eligibleAt, now) ? cycles[0] : undefined;
}
/** B1 has no authoritative completion producer. Reserved snapshots are inert. */
export function historicalStageCompleted(...reserved: [DeepReadonly<StageDefinition>, StageProgress | undefined, string]): boolean { void reserved; return false; }
export function emptyStageProgress(now: string): StageProgress { return { criteria: {}, cycles: {}, legacy: [], attempts:{}, legacyV3Completions:[], updatedAt: now }; }
export function stageTemporalErrors(progress: StageProgress, now: string): string[] {
  const errors: string[] = [];
  // Raw legacy dates are review material, never a qualification clock.
  const hasCurrentData = Object.keys(progress.criteria).length || Object.keys(progress.cycles).length || progress.historicalCompletion;
  if (hasCurrentData && !validPast(progress.updatedAt, now)) errors.push("checkpoint updatedAt 位于未来或无效");
  for (const [id, r] of Object.entries(progress.criteria)) {
    if (!validPast(r.updatedAt, now) || (r.confirmedAt && (!validPast(r.confirmedAt, now) || (!r.confirmationInvalidatedAt && Date.parse(r.confirmedAt) < Date.parse(r.updatedAt)))) || (r.confirmationInvalidatedAt && (!validPast(r.confirmationInvalidatedAt, now) || !r.confirmedAt || Date.parse(r.confirmationInvalidatedAt) < Date.parse(r.confirmedAt)))) errors.push(`${id} confirmation 时间无效`);
  }
  for (const [id, c] of Object.entries(progress.cycles)) {
    if (id !== c.id || !validPast(c.eligibleAt, now) || (c.invalidatedAt && (!validPast(c.invalidatedAt, now) || Date.parse(c.invalidatedAt) < Date.parse(c.eligibleAt)))) errors.push(`${id} cycle 时间或身份无效`);
  }
  if (Object.values(progress.cycles).filter(c => !c.invalidatedAt).length > 1) errors.push("存在多个 active cycle");
  return errors;
}
export function legacyReviewReasons(progress: StageProgress, now: string): string[] {
  return progress.legacy.flatMap(({ checkpoint }) => [
    "v2 evidence IDs / timestamps preserved · needs-review：旧 ID 未验证，不授予资格",
    ...([checkpoint.initiallyEligibleAt, checkpoint.retestedAt, checkpoint.updatedAt].some(t => t && !validPast(t, now)) ? ["旧时间位于未来或无效"] : []),
    ...(checkpoint.initiallyEligibleAt && checkpoint.retestedAt && Date.parse(checkpoint.retestedAt) < Date.parse(checkpoint.initiallyEligibleAt) ? ["旧复测时间早于资格时间"] : []),
  ]);
}
