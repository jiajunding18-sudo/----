import type { StageProgressV4 as StageProgress } from "@/lib/validation/stage-completion-schemas";

/** Reserved future-B2 history fixture, NOT a B1 completion action. */
export function stageHistory(stageId: string, time: string, retest?: { initiallyEligibleAt?: string; retestedAt?: string }): StageProgress {
  const ref = { kind: "concept-evidence" as const, conceptId: `concept.${stageId.replace("stage.", "")}`, evidenceId: `evidence.${stageId}.complete` };
  const criteria = { [`stage-criterion.${stageId}.complete`]: { evidenceRefs: [ref], explanation: "已核对正式标准", confirmedAt: time, updatedAt: time } };
  const cycleId = `eligibility.${stageId}.fixture`;
  const eligibleAt = retest ? retest.initiallyEligibleAt : time;
  return { criteria, cycles: eligibleAt ? { [cycleId]: { id: cycleId, eligibleAt } } : {}, legacy: [], attempts:{}, updatedAt: time,
    legacyV3Completions: !retest || retest.retestedAt ? [{ eligibilityCycleId: cycleId, completedAt: time, evidenceSnapshot: criteria,
      ...(retest?.retestedAt ? { retest: { eligibilityCycleId: cycleId, retestedAt: retest.retestedAt, confirmedAt: retest.retestedAt, evidenceRefs: [ref], explanation: "完成复测" } } : {}) }] : [] };
}
