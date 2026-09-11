import { historicalCompletionV4Schema, retestAttemptSchema, type HistoricalCompletion } from "@/lib/validation/stage-completion-schemas";
import type { LearningStateV4 } from "@/types";
import { stableSnapshot, validPast } from "./stage-evidence";
import { z } from "zod";
import { stageCriterionProgressSchema, stageEvidenceRefSchema } from "@/lib/validation/stage-progress-schemas";

// B1's frozen qualification fingerprint has this positional format. Validate its
// identities against B2's structured snapshot, not against today's catalog.
const conceptBasisSchema=z.tuple([z.string(),z.enum(['understood','mastered']),z.enum(['not_started','learning','understood','mastered']),z.string().nullable()]);
const basisSchema=z.tuple([
  z.string(),z.unknown(),z.array(conceptBasisSchema),
  z.array(z.tuple([z.string(),z.string().nullable(),z.literal('completed'),z.string().nullable(),z.unknown(),z.array(conceptBasisSchema).nullable()])),
  z.array(z.tuple([z.string(),stageCriterionProgressSchema])),
  z.array(z.tuple([z.string(),z.enum(['understand','master'])])),
]);
function frozenBasisMatches(c:HistoricalCompletion):boolean {
  try {
    const b=basisSchema.parse(JSON.parse(c.cycle.qualificationBasis!.fingerprint));
    const byId=(items:readonly {conceptId:string;minimumStatus:string}[])=>[...items].sort((a,b)=>a.conceptId.localeCompare(b.conceptId));
    if(b[0]!==c.stageId || stableSnapshot(byId(b[2].map(([conceptId,minimumStatus])=>({conceptId,minimumStatus}))))!==stableSnapshot(byId(c.contract.conceptTargets)) || stableSnapshot(Object.fromEntries(b[4]))!==stableSnapshot(c.contract.criteria) || stableSnapshot(Object.fromEntries(b[5]))!==stableSnapshot(c.contract.routeGoals)) return false;
    const gates=b[3].map(([projectId,milestoneId])=>({projectId,...(milestoneId?{milestoneId}:{})}));
    if(stableSnapshot(gates)!==stableSnapshot(c.contract.projectGates)) return false;
    for(const [,minimum,status,time] of [...b[2],...b[3].flatMap(p=>p[5] ?? [])]) if((minimum==='mastered'&&status!=='mastered') || (minimum==='understood'&&!['understood','mastered'].includes(status)) || (time&&!validPast(time,c.cycle.eligibleAt))) return false;
    for(const r of Object.values(c.contract.criteria)) for(const [i,serialized] of (r.evidenceBasis ?? []).entries()) {
      const pair=z.tuple([stageEvidenceRefSchema,z.object({id:z.string(),createdAt:z.string(),updatedAt:z.string()}).passthrough()]).parse(JSON.parse(serialized));
      const ref=r.evidenceRefs[i];
      if(stableSnapshot(pair[0])!==stableSnapshot(ref) || pair[1].id!==(ref.kind==='concept-evidence'?ref.evidenceId:ref.deliverableId) || !validPast(pair[1].createdAt,pair[1].updatedAt) || !validPast(pair[1].updatedAt,r.confirmedAt!)) return false;
    }
    return true;
  } catch {return false;}
}

export function completionFingerprint(c:Omit<HistoricalCompletion,"fingerprint">) { return stableSnapshot(c); }
const sameIds=(a:readonly string[],b:readonly string[])=>a.length===new Set(a).size && b.length===new Set(b).size && stableSnapshot([...a].sort())===stableSnapshot([...b].sort());
/** Frozen internal consistency only. Never resolve today's catalog or evidence sources. */
export function getHistoricalStageCompletion(stageId:string,state:Pick<LearningStateV4,"stageCheckpoints">,now:string):HistoricalCompletion|undefined {
  const progress=state.stageCheckpoints[stageId];
  const parsed=historicalCompletionV4Schema.safeParse(progress?.historicalCompletion);
  if(!parsed.success) return undefined;
  const c=parsed.data; const {fingerprint,...body}=c; const cycle=c.cycle; const contract=c.contract;
  if(c.stageId!==stageId || contract.stageId!==stageId || fingerprint!==completionFingerprint(body) || !validPast(c.completedAt,now) || !validPast(cycle.eligibleAt,c.completedAt) || cycle.invalidatedAt || !cycle.qualificationBasis || !validPast(cycle.qualificationBasis.notBefore,cycle.eligibleAt)) return undefined;
  const recorded=progress.cycles[cycle.id];
  if(!recorded || recorded.id!==cycle.id || recorded.eligibleAt!==cycle.eligibleAt || stableSnapshot(recorded.qualificationBasis)!==stableSnapshot(cycle.qualificationBasis) || (recorded.invalidatedAt && recorded.invalidatedAt<c.completedAt)) return undefined;
  if(!sameIds(contract.requiredCriterionIds,Object.keys(contract.criteria))) return undefined;
  if(!frozenBasisMatches(c)) return undefined;
  for(const r of Object.values(contract.criteria)) if(!r.confirmedAt || r.confirmationInvalidatedAt || !validPast(r.confirmedAt,cycle.eligibleAt) || !validPast(r.updatedAt,r.confirmedAt) || !r.explanation.trim() || !r.evidenceRefs.length || !r.evidenceBasis || r.evidenceBasis.length!==r.evidenceRefs.length) return undefined;
  if(c.method==='no-retest') return !contract.retest && !c.successfulAttemptId && !c.successfulAttemptSnapshot ? c : undefined;
  const policy=contract.retest;
  const attempt=retestAttemptSchema.safeParse(progress.attempts[c.successfulAttemptId ?? '']);
  if(!policy || !attempt.success) return undefined;
  const a=attempt.data; const threshold=new Date(Date.parse(cycle.eligibleAt)+policy.delayDays*86400000).toISOString();
  if(a.retestDelayDays!==policy.delayDays || stableSnapshot(a)!==stableSnapshot(c.successfulAttemptSnapshot)) return undefined;
  if(a.id!==c.successfulAttemptId || a.stageId!==stageId || a.eligibilityCycleId!==cycle.id || a.retestDefinitionId!==policy.definitionId || a.retestDefinitionVersion!==policy.definitionVersion || !sameIds(a.requiredProbeIds,policy.requiredProbeIds) || a.closedAt || a.confirmationVersion!==1 || !a.retestedAt || !a.confirmedAt || a.createdAt<threshold || !validPast(a.createdAt,a.updatedAt) || !validPast(a.updatedAt,a.retestedAt) || !validPast(a.retestedAt,a.confirmedAt) || !validPast(a.confirmedAt,c.completedAt)) return undefined;
  for(const id of a.requiredProbeIds) { const p=a.probeResults[id]; if(!p || p.probeId!==id || p.status!=='passed' || !p.explanation.trim() || p.updatedAt<a.createdAt || !validPast(p.updatedAt,a.confirmedAt)) return undefined; }
  return c;
}
export function isStageHistoricallyCompleted(stageId:string,state:Pick<LearningStateV4,"stageCheckpoints">,now:string) { return !!getHistoricalStageCompletion(stageId,state,now); }
