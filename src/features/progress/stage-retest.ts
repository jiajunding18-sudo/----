import type { LearningStateV4 } from "@/types";
import type { ProgressCatalog } from "./progress-domain";
import type { RetestAttempt, HistoricalCompletion } from "@/lib/validation/stage-completion-schemas";
import { conditionActive, resolveStageEvidence, stableSnapshot, validPast } from "./stage-evidence";
import { getStageReadiness } from "./stage-readiness";
import { getRouteRequiredStatus } from "./progress-domain";
import { getHistoricalStageCompletion, completionFingerprint } from "./stage-history";

export type RetestAction = {kind:"start"}|{kind:"edit";attemptId:string;probeId:string;status:"not_checked"|"needs_review"|"passed";explanation:string}|{kind:"close";attemptId:string}|{kind:"submit";attemptId:string;confirmed:boolean}|{kind:"complete";confirmed:boolean};
export function getRetestLifecycle(stageId:string,state:LearningStateV4,catalog:ProgressCatalog,now:string) {
  const stage=catalog.stages?.find(s=>s.id===stageId);
  const definition=catalog.stageRetests?.find(d=>d.stageId===stageId);
  if(!stage) return {status:"unavailable" as const,definition};
  const r=getStageReadiness(stage,catalog.stages ?? [],catalog.concepts.map(c=>({...c,targetDepth:c.targetDepth ?? "master"})),catalog.projects,catalog.tracks,state,now);
  if(getHistoricalStageCompletion(stageId,state,now)) return {status:"completed" as const,definition};
  if(stage.contentStatus!=='available' || !r.currentEligibilityValid || !r.activeEligibility) return {status:"blocked" as const,definition};
  const cycle=r.activeEligibility;
  if(stage.retestAfterDays===undefined) return {status:"no-retest" as const,definition,cycle};
  const earliestRetestAt=new Date(Date.parse(cycle.eligibleAt)+stage.retestAfterDays*86400000).toISOString();
  const activeIds=stage.exitCriteria.filter(c=>c.required && conditionActive(c.when,catalog.tracks,state)).map(c=>c.id);
  const probes=definition?.probes.filter(p=>p.criterionIds.some(id=>activeIds.includes(id))) ?? [];
  const draft=Object.values(state.stageCheckpoints[stageId]?.attempts ?? {}).find(a=>!a.closedAt&&!a.confirmedAt&&a.stageId===stageId&&a.eligibilityCycleId===cycle.id&&a.retestDefinitionId===definition?.id&&a.retestDefinitionVersion===definition?.version&&a.retestDelayDays===stage.retestAfterDays&&a.createdAt>=earliestRetestAt&&stableSnapshot(a.requiredProbeIds)===stableSnapshot(probes.map(p=>p.id)));
  return {status:now<earliestRetestAt ? "wait" as const : definition?.contentStatus==='published' && activeIds.every(id=>probes.some(p=>p.criterionIds.includes(id))) ? "due" as const : "unavailable" as const,definition,cycle,earliestRetestAt,probes,draft};
}
export function mutateStageRetest(state:LearningStateV4,catalog:ProgressCatalog,stageId:string,action:RetestAction,now:string):LearningStateV4 {
  if(!validPast(now,now)) throw new Error("无效时钟");
  const stage=catalog.stages?.find(s=>s.id===stageId);
  if(!stage || stage.contentStatus!=='available') throw new Error("检查点未开放");
  if(getHistoricalStageCompletion(stageId,state,now)) throw new Error("检查点已完成，不能重复提交");
  const life=getRetestLifecycle(stageId,state,catalog,now);
  const next=structuredClone(state); const progress=next.stageCheckpoints[stageId];
  if(!progress || !validPast(progress.updatedAt,now)) throw new Error("无当前资格或时钟回退");
  if(action.kind==='complete') {
    if(life.status!=='no-retest' || !action.confirmed) throw new Error("需要无复测资格与显式确认");
  } else {
    if(life.status!=='due' || !life.cycle || !life.definition) throw new Error("复测尚未到期、内容未开放或资格已失效");
    const ids=life.probes?.map(p=>p.id) ?? [];
    if(action.kind==='start') {
      if(life.draft) return state;
      const id=`retest-attempt.${stageId}.${Date.parse(now)}.${Object.keys(progress.attempts).length+1}`;
      progress.attempts[id]={id,stageId,eligibilityCycleId:life.cycle.id,retestDefinitionId:life.definition.id,retestDefinitionVersion:life.definition.version,retestDelayDays:stage.retestAfterDays!,requiredProbeIds:ids,createdAt:now,updatedAt:now,probeResults:{}};
      progress.updatedAt=now; return next;
    }
    const a=progress.attempts[action.attemptId];
    if(!a || a.closedAt || a.confirmedAt || a.stageId!==stageId || a.eligibilityCycleId!==life.cycle.id || a.retestDefinitionId!==life.definition.id || a.retestDefinitionVersion!==life.definition.version || a.retestDelayDays!==stage.retestAfterDays || stableSnapshot(a.requiredProbeIds)!==stableSnapshot(ids) || a.createdAt<life.earliestRetestAt! || !validPast(a.createdAt,a.updatedAt) || !validPast(a.updatedAt,now)) throw new Error("尝试绑定、定义或时间已失效；请保留旧记录并新建尝试");
    if(action.kind==='close') { a.closedAt=now;a.updatedAt=now;progress.updatedAt=now;return next; }
    if(action.kind==='edit') {
      if(!ids.includes(action.probeId)) throw new Error("未知 probe");
      a.probeResults[action.probeId]={probeId:action.probeId,status:action.status,explanation:action.explanation,updatedAt:now,evidenceRefs:[]};
      a.updatedAt=now;progress.updatedAt=now;return next;
    }
    if(!action.confirmed || ids.some(id=>{const p=a.probeResults[id];return !p || p.status!=='passed' || !p.explanation.trim() || !validPast(p.updatedAt,now) || p.updatedAt<a.createdAt || p.evidenceRefs.some(ref=>!resolveStageEvidence(ref,state,catalog));})) throw new Error("需要本次完整结果、全部自检通过和显式确认");
    a.confirmedAt=now;a.retestedAt=now;a.updatedAt=now;a.confirmationVersion=1;
  }
  const cycle=life.cycle!;
  const required=stage.exitCriteria.filter(c=>c.required && conditionActive(c.when,catalog.tracks,state));
  const contract:HistoricalCompletion["contract"]={stageId,routeGoals:structuredClone(state.preferences.trackGoals),
    conceptTargets:catalog.concepts.filter(c=>c.stageId===stageId && c.publicationStatus==='published' && c.requiredness==='required').map(c=>({conceptId:c.id,minimumStatus:getRouteRequiredStatus({...c,targetDepth:c.targetDepth ?? 'master'},catalog.tracks,state.preferences)})),
    requiredCriterionIds:required.map(c=>c.id),criteria:Object.fromEntries(required.map(c=>[c.id,structuredClone(progress.criteria[c.id])])),
    projectGates:stage.projectGates.filter(g=>conditionActive(g.when,catalog.tracks,state)).map(g=>({projectId:g.projectId,...(g.milestoneId ? {milestoneId:g.milestoneId}:{})})),
  };
  let attempt:RetestAttempt|undefined;
  if(action.kind==='submit') {attempt=progress.attempts[action.attemptId];contract.retest={delayDays:stage.retestAfterDays!,definitionId:attempt.retestDefinitionId,definitionVersion:attempt.retestDefinitionVersion,requiredProbeIds:attempt.requiredProbeIds};}
  const body:Omit<HistoricalCompletion,"fingerprint">={id:`stage-completion.${stageId}.${Date.parse(now)}`,modelVersion:1,stageId,method:attempt ? 'retention-retest':'no-retest',completedAt:now,confirmationVersion:1,cycle:structuredClone(cycle),contract,...(attempt ? {successfulAttemptId:attempt.id}:{})};
  if(attempt) body.successfulAttemptSnapshot=structuredClone(attempt);
  progress.historicalCompletion={...body,fingerprint:completionFingerprint(body)};progress.updatedAt=now;
  if(!getHistoricalStageCompletion(stageId,next,now)) throw new Error("完成快照内部校验失败");
  return next;
}
