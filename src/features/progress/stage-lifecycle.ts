import type { LearningStateV4 } from "@/types";
import { getHistoricalStageCompletion } from "./stage-history";
import type { ProgressCatalog } from "./progress-domain";
import { getStageReadiness } from "./stage-readiness";
import { activeCycle, conditionActive, criterionSatisfied, emptyStageProgress, evidenceBasis, resolveStageEvidence, stageTemporalErrors, validPast } from "./stage-evidence";
import { stageEvidenceRefSchema, type StageEvidenceRef } from "@/lib/validation/stage-progress-schemas";

export type StageAction =
  | { kind: "evidence"; evidenceRefs: StageEvidenceRef[]; explanation: string }
  | { kind: "confirm"; confirmed: boolean }
  | { kind: "revoke" };
export function stageInspectionErrors(state: LearningStateV4, catalog: ProgressCatalog, now: string, strictReferences = false): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(Date.parse(now))) return ["无效的 now"];
  for (const [id, progress] of Object.entries(state.stageCheckpoints)) {
    if(progress.historicalCompletion && !getHistoricalStageCompletion(id,state,now)) errors.push(`${id}: historical completion 内部校验失败`);
    for(const [key,a] of Object.entries(progress.attempts)) {
      const cycle=progress.cycles[a.eligibilityCycleId];
      if(key!==a.id || a.stageId!==id || !cycle || Date.parse(a.createdAt)<Date.parse(cycle.eligibleAt)+a.retestDelayDays*86400000 || !validPast(a.createdAt,a.updatedAt) || !validPast(a.updatedAt,now) || (a.closedAt && (!validPast(a.closedAt,now)||a.closedAt<a.createdAt)) || (a.confirmedAt && (!validPast(a.confirmedAt,now)||!progress.historicalCompletion || progress.historicalCompletion.successfulAttemptId!==a.id))) errors.push(`${id}: retest attempt 时间或身份无效`);
      if(Object.entries(a.probeResults).some(([probeId,p])=>probeId!==p.probeId || !a.requiredProbeIds.includes(probeId) || !validPast(p.updatedAt,a.updatedAt) || p.updatedAt<a.createdAt)) errors.push(`${id}: probe 时间或身份无效`);
    }
    const stage = catalog.stages?.find(s => s.id === id);
    if (!stage) continue; // Preserve orphan data; never derive qualification from it.
    errors.push(...stageTemporalErrors(progress, now).map(e => `${id}: ${e}`));
    for (const [criterionId, r] of Object.entries(progress.criteria)) {
      if (!stage.exitCriteria.some(c => c.id === criterionId)) continue; // Archived orphan, never remapped.
      if (strictReferences && !getHistoricalStageCompletion(id,state,now) && !r.confirmationInvalidatedAt && r.evidenceRefs.some(ref => !resolveStageEvidence(ref, state, catalog))) errors.push(`${criterionId}: dangling evidence reference`);
      if (r.confirmedAt && (!r.evidenceRefs.length || !r.explanation.trim())) errors.push(`${criterionId}: empty confirmation`);
    }
    // Reserved completion is inert preservation data, not an executable contract.
  }
  return errors;
}
/** Pure, deterministic reconciliation. Call only on qualification-changing paths. */
export function reconcileStageEligibility(state: LearningStateV4, catalog: ProgressCatalog, now: string): LearningStateV4 {
  const errors = stageInspectionErrors(state, catalog, now);
  if (errors.length) throw new Error(errors.join("；"));
  const next = structuredClone(state);
  const concepts = catalog.concepts.map(c => ({ ...c, targetDepth: c.targetDepth ?? "master" as const }));
  for (const [stageId, progress] of Object.entries(next.stageCheckpoints)) {
    const stage = catalog.stages?.find(s => s.id === stageId);
    for (const [criterionId, record] of Object.entries(progress.criteria)) {
      if (!stage?.exitCriteria.some(c => c.id === criterionId)) continue;
      if (record.confirmedAt && !record.confirmationInvalidatedAt && (!record.evidenceBasis || JSON.stringify(record.evidenceBasis) !== JSON.stringify(evidenceBasis(record.evidenceRefs, next, catalog)))) {
        record.confirmationInvalidatedAt = now;
        record.updatedAt = now;
        progress.updatedAt = now;
      }
    }
  }
  for (const stage of [...(catalog.stages ?? [])].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    if (stage.contentStatus !== "available") continue;
    const existing = next.stageCheckpoints[stage.id];
    const readiness = getStageReadiness(stage, catalog.stages ?? [], concepts, catalog.projects, catalog.tracks, next, now);
    const cycle = activeCycle(existing, now);
    if (!readiness.currentEligibilityValid && cycle) {
      existing.cycles[cycle.id] = { ...cycle, invalidatedAt: now };
      existing.updatedAt = now;
    }
    if (!readiness.historicallyCompleted && readiness.nonRetestReady && !readiness.currentEligibilityValid && readiness.qualificationBasis) {
      if (!validPast(readiness.qualificationBasis.notBefore, now)) throw new Error("资格依据时间位于未来");
      const progress = existing ?? emptyStageProgress(now);
      const id = `eligibility.${stage.id}.${Date.parse(now)}.${Object.keys(progress.cycles).length + 1}`;
      if (Object.values(progress.cycles).some(c => c.invalidatedAt && Date.parse(c.invalidatedAt) > Date.parse(now))) throw new Error("Clock reversed before re-anchor");
      progress.cycles[id] = { id, eligibleAt: now, qualificationBasis: readiness.qualificationBasis };
      progress.updatedAt = now;
      next.stageCheckpoints[stage.id] = progress;
    }
  }
  return next;
}
export function mutateStageCriterion(state: LearningStateV4, catalog: ProgressCatalog, stageId: string, criterionId: string, action: StageAction, now: string): LearningStateV4 {
  const stage = catalog.stages?.find(s => s.id === stageId);
  const criterion = stage?.exitCriteria.find(c => c.id === criterionId);
  if (!stage || stage.contentStatus !== "available" || !criterion || !conditionActive(criterion.when, catalog.tracks, state)) throw new Error("criterion 不存在、未发布或当前不生效");
  const existing = state.stageCheckpoints[stageId];
  if (existing && (Object.keys(existing.criteria).length || Object.keys(existing.cycles).length) && !validPast(existing.updatedAt, now)) throw new Error("Clock reversed");
  const next = structuredClone(state);
  const progress = next.stageCheckpoints[stageId] ?? emptyStageProgress(now);
  const record = progress.criteria[criterionId] ?? { evidenceRefs: [], explanation: "", updatedAt: now };
  if (action.kind === "evidence") {
    const refs = action.evidenceRefs.map(ref => stageEvidenceRefSchema.parse(ref));
    if (refs.some(ref => !resolveStageEvidence(ref, state, catalog))) throw new Error("证据引用不存在或不属于指定来源");
    const unique = [...new Map(refs.map(ref => [JSON.stringify(ref), ref])).values()].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (JSON.stringify(unique) === JSON.stringify(record.evidenceRefs) && action.explanation === record.explanation) return state;
    progress.criteria[criterionId] = { evidenceRefs: unique, explanation: action.explanation, updatedAt: now };
  } else if (action.kind === "confirm") {
    if (!action.confirmed || !record.explanation.trim() || !record.evidenceRefs.length || record.evidenceRefs.some(ref => !resolveStageEvidence(ref, state, catalog))) throw new Error("确认需要合法证据、逐项解释和显式声明");
    if (criterionSatisfied(record, state, catalog, now)) return state;
    progress.criteria[criterionId] = { ...record, confirmedAt: now, confirmationInvalidatedAt: undefined, evidenceBasis: evidenceBasis(record.evidenceRefs, state, catalog), updatedAt: now };
  } else {
    if (!record.confirmedAt) return state;
    progress.criteria[criterionId] = { ...record, confirmedAt: undefined, confirmationInvalidatedAt: undefined, evidenceBasis: undefined, updatedAt: now };
  }
  progress.updatedAt = now;
  next.stageCheckpoints[stageId] = progress;
  return reconcileStageEligibility(next, catalog, now);
}
