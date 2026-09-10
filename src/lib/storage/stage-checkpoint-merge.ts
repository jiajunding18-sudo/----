import type { StageProgress } from "@/lib/validation/stage-progress-schemas";

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
  if (left.historicalCompletion && right.historicalCompletion && JSON.stringify(left.historicalCompletion) !== JSON.stringify(right.historicalCompletion)) throw new Error("Stage historical completion conflict");
  return { criteria, cycles,
    legacy: [...new Map([...left.legacy, ...right.legacy].map(item => [JSON.stringify(item), item])).values()],
    historicalCompletion: left.historicalCompletion ?? right.historicalCompletion,
    updatedAt: left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt,
  };
}
