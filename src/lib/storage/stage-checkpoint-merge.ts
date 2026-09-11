import type { StageProgressV4 as StageProgress } from "@/lib/validation/stage-completion-schemas";
import { stableSnapshot } from "@/features/progress/stage-evidence";

export function mergeStageCheckpoints(left: StageProgress, right: StageProgress): StageProgress {
  const criteria = { ...left.criteria };
  for (const [id, value] of Object.entries(right.criteria)) {
    const old = criteria[id];
    if (old && old.updatedAt === value.updatedAt && JSON.stringify(old) !== JSON.stringify(value)) throw new Error(`Stage criterion conflict: ${id}`);
    if (!old || value.updatedAt > old.updatedAt) criteria[id] = value;
  }
  const cycles = { ...left.cycles };
  for (const [id, value] of Object.entries(right.cycles)) {
    const old = cycles[id];
    if (old && old.eligibleAt !== value.eligibleAt) throw new Error(`Stage cycle identity conflict: ${id}`);
    if (old && JSON.stringify(old.qualificationBasis) !== JSON.stringify(value.qualificationBasis)) throw new Error(`Stage cycle basis conflict: ${id}`);
    if (old?.invalidatedAt && value.invalidatedAt && old.invalidatedAt !== value.invalidatedAt) throw new Error(`Stage invalidation conflict: ${id}`);
    cycles[id] = old?.invalidatedAt ? old : value;
  }
  if (left.historicalCompletion && right.historicalCompletion && stableSnapshot(left.historicalCompletion) !== stableSnapshot(right.historicalCompletion)) throw new Error("Stage historical completion conflict");
  const attempts={...left.attempts};
  for(const [id,a] of Object.entries(right.attempts)) {
    const old=attempts[id];
    if(old && stableSnapshot(old)!==stableSnapshot(a)) {
      if(old.closedAt || a.closedAt) {
        if((old.closedAt && a.closedAt) || old.confirmedAt || a.confirmedAt) throw new Error(`Retest attempt conflict: ${id}`);
        const closed=old.closedAt ? old : a;
        const open=old.closedAt ? a : old;
        if(closed.id!==open.id || closed.stageId!==open.stageId || closed.createdAt!==open.createdAt || closed.eligibilityCycleId!==open.eligibilityCycleId || closed.retestDefinitionId!==open.retestDefinitionId || closed.retestDefinitionVersion!==open.retestDefinitionVersion || closed.retestDelayDays!==open.retestDelayDays || stableSnapshot(closed.requiredProbeIds)!==stableSnapshot(open.requiredProbeIds)) throw new Error(`Retest attempt conflict: ${id}`);
        // Closing is terminal. Preserve the entire closed record, including its
        // results; never splice newer draft results into the closed history.
        attempts[id]=closed;
        continue;
      }
      if(old.confirmedAt && a.confirmedAt) throw new Error(`Retest attempt conflict: ${id}`);
      const finalized=old.confirmedAt ? old : a.confirmedAt ? a : undefined;
      const draft=old.confirmedAt ? a : old;
      if(finalized) {
        if(draft.closedAt || draft.updatedAt>finalized.updatedAt || draft.createdAt!==finalized.createdAt || draft.eligibilityCycleId!==finalized.eligibilityCycleId || draft.retestDefinitionId!==finalized.retestDefinitionId || draft.retestDefinitionVersion!==finalized.retestDefinitionVersion || draft.retestDelayDays!==finalized.retestDelayDays || draft.stageId!==finalized.stageId || JSON.stringify(draft.requiredProbeIds)!==JSON.stringify(finalized.requiredProbeIds)) throw new Error(`Retest attempt conflict: ${id}`);
        attempts[id]=finalized;
        continue;
      }
      if(old.updatedAt===a.updatedAt) throw new Error(`Retest attempt conflict: ${id}`);
    }
    if(!old || a.updatedAt>old.updatedAt) attempts[id]=a;
  }
  return { criteria, cycles, attempts,
    legacyV3Completions:[...new Map([...left.legacyV3Completions,...right.legacyV3Completions].map(c=>[JSON.stringify(c),c])).values()],
    legacy: [...new Map([...left.legacy, ...right.legacy].map(item => [JSON.stringify(item), item])).values()],
    historicalCompletion: left.historicalCompletion ?? right.historicalCompletion,
    updatedAt: left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt,
  };
}
