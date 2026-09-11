import { describe, expect, it } from "vitest";
import { imageStage, stageCatalog, stageNow, stageReadyInput, stageRef, stageTime } from "../fixtures/stage-lifecycle";
import { mutateStageCriterion, reconcileStageEligibility, stageInspectionErrors } from "@/features/progress/stage-lifecycle";
import { getRetestLifecycle, mutateStageRetest } from "@/features/progress/stage-retest";
import { getHistoricalStageCompletion } from "@/features/progress/stage-history";
import { mergeStageCheckpoints } from "@/lib/storage/stage-checkpoint-merge";
import type { LearningStateV4 } from "@/types";
import { contentManifest } from "../../.generated/content-manifest";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { getNextStep } from "@/features/recommendations/next-step";
import { createLearningStore } from "@/features/progress/learning-store";
import { createExportEnvelope, createPersistedEnvelope } from "@/lib/storage/learning-state";
import { prepareLearningStateImport } from "@/lib/storage/learning-backup";
import { migrateLearningStateV3ToV4 } from "@/lib/storage/stage-completion-migration";
import { validateStageRetests } from "@/lib/content/retest-validator";
import { stages } from "../../content/catalog/stages";
import { stageRetests } from "../../content/catalog/stage-retests";
import { LocalStorageLearningStateAdapter, LEARNING_STATE_STORAGE_KEY } from "@/lib/storage";
import { conditionActive } from "@/features/progress/stage-evidence";
import { learningStateV4Schema } from "@/lib/validation/progress-schemas";

const id=imageStage.id;
const due=new Date(Date.parse(stageTime)+7*86400000).toISOString();
function eligible(stageId:string=id) {
  let state=stageReadyInput();
  const stage=stageCatalog.stages!.find(s=>s.id===stageId)!;
  for(const c of stage.exitCriteria) {
    state=mutateStageCriterion(state,stageCatalog,stageId,c.id,{kind:"evidence",evidenceRefs:[stageRef],explanation:"逐项核对实际运行记录"},stageTime);
    state=mutateStageCriterion(state,stageCatalog,stageId,c.id,{kind:"confirm",confirmed:true},stageTime);
  }
  return state;
}
function draft() {return mutateStageRetest(eligible(),stageCatalog,id,{kind:"start"},due);}
function passed(input=draft()) {
  let state=input;
  const a=Object.values(state.stageCheckpoints[id].attempts)[0];
  for(const p of a.requiredProbeIds) state=mutateStageRetest(state,stageCatalog,id,{kind:"edit",attemptId:a.id,probeId:p,status:"passed",explanation:"本次使用新输入，记录数值与身份集合，并检查失败及重跑"},due);
  return state;
}
function finish(state=passed()) {return mutateStageRetest(state,stageCatalog,id,{kind:"submit",attemptId:Object.keys(state.stageCheckpoints[id].attempts)[0],confirmed:true},due);}
function storeFor(input:LearningStateV4,failOnce=false) {
  let saved=createPersistedEnvelope(input,'test',1,stageTime);
  const writes:LearningStateV4[]=[];
  const adapter={load:async()=>({ok:true as const,value:saved}),save:async(e:typeof saved)=>{await Promise.resolve();if(failOnce){failOnce=false;throw new Error('disk failure');}saved=e;writes.push(e.payload);},saveRecovery:async()=> 'recovery',saveRawRecovery:async()=> 'recovery',clear:async()=>{}};
  return {store:createLearningStore({catalog:stageCatalog,contentVersion:'test',adapter,now:()=>stageNow}),adapter,writes};
}

describe("Phase 9E-B2 retention lifecycle",()=>{
  it("defines all 13 retest identities, only Stage 0 and 2 published",()=>{
    expect(stageCatalog.stageRetests).toHaveLength(13);
    expect(stageCatalog.stageRetests!.filter(d=>d.contentStatus==='published').map(d=>d.stageId).sort()).toEqual(['stage.image-computing','stage.tooling-foundations']);
  });
  it("waits a full 168 hours, due boundary does not complete",()=>{
    const state=eligible();
    expect(getRetestLifecycle(id,state,stageCatalog,new Date(Date.parse(due)-1).toISOString()).status).toBe('wait');
    expect(getRetestLifecycle(id,state,stageCatalog,due).status).toBe('due');
    expect(getHistoricalStageCompletion(id,state,stageNow)).toBeUndefined();
    expect(()=>mutateStageRetest(state,stageCatalog,id,{kind:'start'},stageTime)).toThrow();
    expect(()=>mutateStageRetest(state,stageCatalog,id,{kind:'start'},new Date(Date.parse(due)-1).toISOString())).toThrow();
  });
  it("fresh draft has no copied evidence and repeated start reuses it",()=>{
    const state=draft();const a=Object.values(state.stageCheckpoints[id].attempts)[0];
    expect(a.createdAt).toBe(due);expect(a.probeResults).toEqual({});
    expect(mutateStageRetest(state,stageCatalog,id,{kind:'start'},due)).toEqual(state);
  });
  it("incomplete or unconfirmed attempt cannot finalize",()=>{
    const state=draft();const attemptId=Object.keys(state.stageCheckpoints[id].attempts)[0];
    expect(()=>mutateStageRetest(state,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},due)).toThrow();
    expect(()=>mutateStageRetest(passed(state),stageCatalog,id,{kind:'submit',attemptId,confirmed:false},due)).toThrow();
  });
  it("atomically freezes completed attempt and contract",()=>{
    const before=passed();const after=finish(before);const completion=getHistoricalStageCompletion(id,after,due)!;
    expect(completion).toBeDefined();expect(completion.method).toBe('retention-retest');
    expect(completion.successfulAttemptSnapshot).toEqual(after.stageCheckpoints[id].attempts[completion.successfulAttemptId!]);
    expect(before.stageCheckpoints[id].historicalCompletion).toBeUndefined();
    expect(stageInspectionErrors(after,stageCatalog,stageNow,true)).toEqual([]);
    expect(()=>mutateStageRetest(after,stageCatalog,id,{kind:'start'},stageNow)).toThrow();
  });
  it("closed unsuccessful draft remains and permits another fresh attempt",()=>{
    const state=draft();const attemptId=Object.keys(state.stageCheckpoints[id].attempts)[0];
    const closed=mutateStageRetest(state,stageCatalog,id,{kind:'close',attemptId},due);
    const next=mutateStageRetest(closed,stageCatalog,id,{kind:'start'},stageNow);
    expect(Object.values(next.stageCheckpoints[id].attempts)).toHaveLength(2);
    expect(next.stageCheckpoints[id].attempts[attemptId].closedAt).toBe(due);
  });
  it("revoke invalidates current draft but preserves it",()=>{
    const state=passed();const attemptId=Object.keys(state.stageCheckpoints[id].attempts)[0];
    const revoked=mutateStageCriterion(state,stageCatalog,id,imageStage.exitCriteria[0].id,{kind:'revoke'},stageNow);
    expect(revoked.stageCheckpoints[id].attempts[attemptId]).toEqual(state.stageCheckpoints[id].attempts[attemptId]);
    expect(()=>mutateStageRetest(revoked,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},stageNow)).toThrow();
  });
  it("definition version change blocks old submission",()=>{
    const state=passed();const catalog={...stageCatalog,stageRetests:stageCatalog.stageRetests!.map(d=>d.stageId===id?{...d,version:d.version+1}:d)};
    expect(()=>mutateStageRetest(state,catalog,id,{kind:'submit',attemptId:Object.keys(state.stageCheckpoints[id].attempts)[0],confirmed:true},stageNow)).toThrow();
    expect(Object.values(mutateStageRetest(state,catalog,id,{kind:'start'},stageNow).stageCheckpoints[id].attempts)).toHaveLength(2);
  });
  it("history survives current evidence deletion without issuing another cycle",()=>{
    const completed=finish();const original=structuredClone(completed.stageCheckpoints[id].historicalCompletion);
    completed.projectProgress={};
    expect(stageInspectionErrors(completed,stageCatalog,stageNow,true)).toEqual([]);
    const next=reconcileStageEligibility(completed,stageCatalog,stageNow);
    expect(getHistoricalStageCompletion(id,next,stageNow)).toEqual(original);
    expect(Object.values(next.stageCheckpoints[id].cycles)).toHaveLength(1);
    expect(getRetestLifecycle(id,next,stageCatalog,stageNow).status).toBe('completed');
  });
  it.each(['fingerprint','future','attempt','snapshot'])("rejects malformed %s authority",kind=>{
    const state=finish();const c=state.stageCheckpoints[id].historicalCompletion!;
    if(kind==='fingerprint') c.fingerprint='forged';
    if(kind==='future') c.completedAt='2099-01-01T00:00:00.000Z';
    if(kind==='attempt') state.stageCheckpoints[id].attempts[c.successfulAttemptId!].probeResults={};
    if(kind==='snapshot') c.successfulAttemptSnapshot!.requiredProbeIds=[];
    expect(getHistoricalStageCompletion(id,state,stageNow)).toBeUndefined();
    expect(stageInspectionErrors(state,stageCatalog,stageNow).length).toBeGreaterThan(0);
  });
  it("completed checkpoint merges with its older unfinished version in both orders",()=>{
    const old=passed();const done=finish(old);
    for(const [a,b] of [[old,done],[done,old]]) {
      const merged:LearningStateV4={...done,stageCheckpoints:{...done.stageCheckpoints,[id]:mergeStageCheckpoints(a.stageCheckpoints[id],b.stageCheckpoints[id])}};
      expect(getHistoricalStageCompletion(id,merged,stageNow)).toBeDefined();
    }
  });
  it("full Stage 1A persisted lifecycle is explicit, no fake retest",async()=>{
    const stageId='stage.vision-math-immediate';const state=eligible(stageId);state.preferences.activeStageId=stageId;
    expect(getRetestLifecycle(stageId,state,stageCatalog,stageNow).status).toBe('no-retest');
    expect(getNextStep({catalog:contentManifest,state,now:stageNow}).kind).toBe('stage-complete');
    expect(reconcileStageEligibility(state,stageCatalog,stageNow).stageCheckpoints[stageId].historicalCompletion).toBeUndefined();
    const {store,adapter}=storeFor(state);await store.getState().hydrate();
    expect((await store.getState().mutateRetest(stageId,{kind:'complete',confirmed:false})).ok).toBe(false);
    expect((await store.getState().mutateRetest(stageId,{kind:'complete',confirmed:true})).ok).toBe(true);
    expect(getHistoricalStageCompletion(stageId,store.getState().learningState,stageNow)?.method).toBe('no-retest');
    expect(store.getState().learningState.stageCheckpoints[stageId].attempts).toEqual({});
    await store.getState().downgradeConcept('math.vectors-matrices','understood');
    const reload=createLearningStore({catalog:stageCatalog,contentVersion:'test',adapter,now:()=>stageNow});await reload.getState().hydrate();
    expect(getHistoricalStageCompletion(stageId,reload.getState().learningState,stageNow)).toBeDefined();
  });
  it("Stage 0 covers five criteria and completes only after three new probes",()=>{
    const stageId='stage.tooling-foundations';let state=eligible(stageId);
    expect(getRetestLifecycle(stageId,state,stageCatalog,stageTime).status).toBe('wait');
    state=mutateStageRetest(state,stageCatalog,stageId,{kind:'start'},due);
    const a=Object.values(state.stageCheckpoints[stageId].attempts)[0];expect(a.requiredProbeIds).toHaveLength(3);
    for(const probeId of a.requiredProbeIds) state=mutateStageRetest(state,stageCatalog,stageId,{kind:'edit',attemptId:a.id,probeId,status:'passed',explanation:'实际复现、诊断并解释版本与 README 交接'},due);
    state=mutateStageRetest(state,stageCatalog,stageId,{kind:'submit',attemptId:a.id,confirmed:true},due);
    expect(getHistoricalStageCompletion(stageId,state,due)?.contract.requiredCriterionIds).toHaveLength(5);
  });
  it.each(['add','remove','project','delay','route'])("history import survives live %s contract change",kind=>{
    const state=finish();const catalog=structuredClone(stageCatalog);
    const stage=catalog.stages!.find(s=>s.id===id)!;
    const changed={...stage};
    if(kind==='add') changed.exitCriteria=[...stage.exitCriteria,{...stage.exitCriteria[0],id:'stage-criterion.image-computing.extra'}];
    if(kind==='remove') changed.exitCriteria=[stage.exitCriteria[0]];
    if(kind==='project') changed.projectGates=[];
    if(kind==='delay') changed.retestAfterDays=30;
    if(kind==='route') {state.preferences.trackGoals['track.industrial-3d']='understand';state.preferences.trackGoals['track.computational-imaging']='master';}
    const nextCatalog={...catalog,stages:catalog.stages!.map(s=>s.id===id?changed:s)};
    const imported=prepareLearningStateImport({raw:JSON.stringify(createExportEnvelope(state,'old',1,due,stageNow)),currentState:stageReadyInput(),catalog:nextCatalog,mode:'replace',now:stageNow});
    expect(imported.ok).toBe(true);if(!imported.ok)throw new Error(imported.message);
    expect(getHistoricalStageCompletion(id,imported.value.nextState,stageNow)).toEqual(state.stageCheckpoints[id].historicalCompletion);
    expect(getStageReadiness(changed,nextCatalog.stages,contentManifest.concepts,contentManifest.projects,contentManifest.tracks,imported.value.nextState,stageNow).historicallyCompleted).toBe(true);
  });
  it("legal history imports without current evidence sources",()=>{
    const state=finish();state.projectProgress={};
    const r=prepareLearningStateImport({raw:JSON.stringify(createExportEnvelope(state,'old',1,due,stageNow)),currentState:stageReadyInput(),catalog:stageCatalog,mode:'replace',now:stageNow});
    expect(r.ok).toBe(true);if(!r.ok)throw new Error(r.message);
    expect(getHistoricalStageCompletion(id,r.value.nextState,stageNow)).toBeDefined();
    expect(r.value.nextState.stageCheckpoints[id].criteria[imageStage.exitCriteria[0].id].confirmationInvalidatedAt).toBe(stageNow);
  });
  it("v3 plausible completion and retest remain non-authoritative; B1 cycles survive",()=>{
    const state=eligible();const p=state.stageCheckpoints[id];const cycle=Object.values(p.cycles)[0];
    const legacy={eligibilityCycleId:cycle.id,completedAt:stageNow,evidenceSnapshot:p.criteria,retest:{eligibilityCycleId:cycle.id,retestedAt:stageNow,confirmedAt:stageNow,evidenceRefs:[stageRef],explanation:'旧占位'}};
    const old={...state,schemaVersion:3,stageCheckpoints:{[id]:{criteria:p.criteria,cycles:p.cycles,legacy:p.legacy,updatedAt:p.updatedAt,historicalCompletion:legacy}}};
    const migrated=migrateLearningStateV3ToV4(old);
    expect(migrated.stageCheckpoints[id].legacyV3Completions).toEqual([legacy]);
    expect(migrated.stageCheckpoints[id].cycles).toEqual(p.cycles);
    expect(migrated.stageCheckpoints[id].attempts).toEqual({});
    expect(getHistoricalStageCompletion(id,migrated,stageNow)).toBeUndefined();
  });
  it("downstream gate consumes sticky history after upstream loss; Stage 3 remains independent",()=>{
    const state=finish();state.conceptProgress['python.numpy-arrays'].status='understood';state.projectProgress={};
    const current=reconcileStageEligibility(state,stageCatalog,stageNow);
    const downstream={...imageStage,id:'stage.test-downstream',entryGate:{kind:'checkpoint' as const,stageId:id}};
    expect(getStageReadiness(downstream,[...contentManifest.stages,downstream],contentManifest.concepts,contentManifest.projects,contentManifest.tracks,current,stageNow).entryReady).toBe(true);
    expect(stageCatalog.stages!.find(s=>s.categoryOrder===3)?.entryGate).toBeUndefined();
  });
  it("clock-only NextStep moves wait to due, planned definition is unavailable, completion skips lifecycle",()=>{
    const state=eligible();const before=structuredClone(state);
    expect(getNextStep({catalog:contentManifest,state,now:new Date(Date.parse(due)-60000).toISOString()}).kind).toBe('stage-wait');
    expect(getNextStep({catalog:contentManifest,state,now:due}).kind).toBe('stage-retest');
    const catalog={...contentManifest,stageRetests:contentManifest.stageRetests!.map(d=>d.stageId===id?{...d,contentStatus:'planned' as const}:d)};
    expect(getNextStep({catalog,state,now:due}).kind).toBe('retest-unavailable');
    expect(['stage-exit','stage-wait','stage-retest','stage-complete']).not.toContain(getNextStep({catalog:contentManifest,state:finish(),now:stageNow}).kind);
    expect(state).toEqual(before);
  });
  it("a new cycle waits again and never inherits prior probe results",()=>{
    let state=passed();const oldId=Object.keys(state.stageCheckpoints[id].attempts)[0];
    const criterionId=imageStage.exitCriteria[0].id;
    state=mutateStageCriterion(state,stageCatalog,id,criterionId,{kind:'revoke'},stageNow);
    state=mutateStageCriterion(state,stageCatalog,id,criterionId,{kind:'confirm',confirmed:true},stageNow);
    expect(getRetestLifecycle(id,state,stageCatalog,stageNow).status).toBe('wait');
    const later=new Date(Date.parse(stageNow)+7*86400000).toISOString();
    expect(()=>mutateStageRetest(state,stageCatalog,id,{kind:'submit',attemptId:oldId,confirmed:true},later)).toThrow();
    const next=mutateStageRetest(state,stageCatalog,id,{kind:'start'},later);
    expect(Object.values(next.stageCheckpoints[id].attempts).find(a=>a.id!==oldId)?.probeResults).toEqual({});
  });
  it.each(['criterion','concept','project'])("queued %s invalidation before submit blocks completion",async kind=>{
    const state=passed();const attemptId=Object.keys(state.stageCheckpoints[id].attempts)[0];const {store}=storeFor(state);await store.getState().hydrate();
    const api=store.getState();
    const changed=structuredClone(state);
    const project=changed.projectProgress[stageRef.projectId].milestones![stageRef.milestoneId];
    project.status='in_progress';project.nextAction='重新核对报告';project.completionConfirmation=undefined;project.updatedAt=stageNow;
    const prepared=api.prepareImport(JSON.stringify(createExportEnvelope(changed,'test',2,stageNow,stageNow)),'replace');
    if(!prepared.ok)throw new Error(prepared.message);
    const invalidation=kind==='criterion'?api.mutateStage(id,imageStage.exitCriteria[0].id,{kind:'revoke'}):kind==='concept'?api.downgradeConcept('python.numpy-arrays','understood'):api.applyImport(prepared.value,true);
    const results=await Promise.all([invalidation,api.mutateRetest(id,{kind:'submit',attemptId,confirmed:true})]);
    expect(results[0].ok).toBe(true);expect(results[1].ok).toBe(false);
    expect(getHistoricalStageCompletion(id,store.getState().learningState,stageNow)).toBeUndefined();
  });
  it("submit ordered before later revoke keeps historical completion",async()=>{
    const state=passed();const attemptId=Object.keys(state.stageCheckpoints[id].attempts)[0];const {store}=storeFor(state);await store.getState().hydrate();
    const api=store.getState();const results=await Promise.all([api.mutateRetest(id,{kind:'submit',attemptId,confirmed:true}),api.mutateStage(id,imageStage.exitCriteria[0].id,{kind:'revoke'})]);
    expect(results.every(r=>r.ok)).toBe(true);expect(getHistoricalStageCompletion(id,store.getState().learningState,stageNow)).toBeDefined();
  });
  it("no-retest completion queued after invalidation cannot use old qualification",async()=>{
    const stageId='stage.vision-math-immediate';const {store}=storeFor(eligible(stageId));await store.getState().hydrate();
    const api=store.getState();const results=await Promise.all([api.downgradeConcept('math.vectors-matrices','understood'),api.mutateRetest(stageId,{kind:'complete',confirmed:true})]);
    expect(results.map(r=>r.ok)).toEqual([true,false]);
  });
  it("persist failure leaves the draft unchanged and retry writes once atomically",async()=>{
    const state=passed();const attemptId=Object.keys(state.stageCheckpoints[id].attempts)[0];const {store,writes}=storeFor(state,true);await store.getState().hydrate();
    expect((await store.getState().mutateRetest(id,{kind:'submit',attemptId,confirmed:true})).ok).toBe(false);
    expect(store.getState().learningState).toEqual(state);expect(writes).toHaveLength(0);
    expect((await store.getState().mutateRetest(id,{kind:'submit',attemptId,confirmed:true})).ok).toBe(true);
    expect(writes).toHaveLength(1);expect(getHistoricalStageCompletion(id,writes[0],stageNow)).toBeDefined();
  });
  it("merge dedupes exact completion, rejects differing completion, preserves newer current evidence",()=>{
    const p=finish().stageCheckpoints[id];expect(mergeStageCheckpoints(p,structuredClone(p))).toEqual(p);
    const reordered=structuredClone(p);reordered.historicalCompletion!.contract.criteria=Object.fromEntries(Object.entries(reordered.historicalCompletion!.contract.criteria).reverse());
    expect(mergeStageCheckpoints(p,reordered).historicalCompletion).toEqual(p.historicalCompletion);
    const conflict=structuredClone(p);conflict.historicalCompletion!.completedAt=stageNow;
    expect(()=>mergeStageCheckpoints(p,conflict)).toThrow(/completion conflict/);
    const newer=structuredClone(p);newer.criteria[imageStage.exitCriteria[0].id]={evidenceRefs:[],explanation:'当前待核对',updatedAt:stageNow};newer.updatedAt=stageNow;
    const merged=mergeStageCheckpoints(p,newer);expect(merged.historicalCompletion).toEqual(p.historicalCompletion);expect(merged.criteria).toEqual(newer.criteria);
  });
  it.each(['older','newer'])("closed attempt survives %s open draft in both merge directions",age=>{
    const base=passed();const attemptId=Object.keys(base.stageCheckpoints[id].attempts)[0];
    const closed=mutateStageRetest(base,stageCatalog,id,{kind:'close',attemptId},new Date(Date.parse(due)+60000).toISOString());
    const open=age==='older'?base:mutateStageRetest(base,stageCatalog,id,{kind:'edit',attemptId,probeId:base.stageCheckpoints[id].attempts[attemptId].requiredProbeIds[0],status:'needs_review',explanation:'另一副本的较晚修改'},stageNow);
    for(const [left,right] of [[closed,open],[open,closed]]) {
      const merged={...left,stageCheckpoints:{...left.stageCheckpoints,[id]:mergeStageCheckpoints(left.stageCheckpoints[id],right.stageCheckpoints[id])}};
      expect(merged.stageCheckpoints[id].attempts[attemptId]).toEqual(closed.stageCheckpoints[id].attempts[attemptId]);
      expect(()=>mutateStageRetest(merged,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},stageNow)).toThrow();
      expect(merged.stageCheckpoints[id].historicalCompletion).toBeUndefined();
      const retry=mutateStageRetest(merged,stageCatalog,id,{kind:'start'},stageNow);
      expect(Object.keys(retry.stageCheckpoints[id].attempts)).toHaveLength(2);
      expect(retry.stageCheckpoints[id].attempts[attemptId]).toEqual(closed.stageCheckpoints[id].attempts[attemptId]);
    }
  });
  it("closed duplicates dedupe but conflicting closure, results, binding or confirmed terminal reject",()=>{
    const base=passed();const attemptId=Object.keys(base.stageCheckpoints[id].attempts)[0];
    const closed=mutateStageRetest(base,stageCatalog,id,{kind:'close',attemptId},due).stageCheckpoints[id];
    const same=structuredClone(closed);same.attempts[attemptId].probeResults=Object.fromEntries(Object.entries(same.attempts[attemptId].probeResults).reverse());
    expect(mergeStageCheckpoints(closed,same)).toEqual(closed);
    const otherTime=structuredClone(closed);otherTime.attempts[attemptId].closedAt=stageNow;otherTime.attempts[attemptId].updatedAt=stageNow;
    const otherResult=structuredClone(closed);Object.values(otherResult.attempts[attemptId].probeResults)[0].explanation='不同关闭记录';
    const wrongBinding=structuredClone(base.stageCheckpoints[id]);wrongBinding.attempts[attemptId].eligibilityCycleId='eligibility.other';
    for(const conflict of [otherTime,otherResult,wrongBinding,finish(base).stageCheckpoints[id]]) {
      expect(()=>mergeStageCheckpoints(closed,conflict)).toThrow(/attempt conflict/);
      expect(()=>mergeStageCheckpoints(conflict,closed)).toThrow(/attempt conflict/);
    }
  });
  it("import/restore preserves closed history and subsequent backups cannot reopen it",()=>{
    const base=passed();const attemptId=Object.keys(base.stageCheckpoints[id].attempts)[0];
    const closed=mutateStageRetest(base,stageCatalog,id,{kind:'close',attemptId},due);
    const newer=mutateStageRetest(base,stageCatalog,id,{kind:'edit',attemptId,probeId:base.stageCheckpoints[id].attempts[attemptId].requiredProbeIds[0],status:'passed',explanation:'另一副本的新结果'},stageNow);
    let current=learningStateV4Schema.parse(base);
    for(const [incoming,mode] of [[closed,'replace'],[base,'merge'],[newer,'merge']] as const) {
      const restored=prepareLearningStateImport({raw:JSON.stringify(createExportEnvelope(incoming,'test',1,stageNow,stageNow)),currentState:current,catalog:stageCatalog,mode,now:stageNow});
      expect(restored.ok).toBe(true);if(!restored.ok)throw new Error(restored.message);
      current=restored.value.nextState;
      expect(current.stageCheckpoints[id].attempts[attemptId]).toEqual(closed.stageCheckpoints[id].attempts[attemptId]);
      expect(()=>mutateStageRetest(current,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},stageNow)).toThrow();
    }
  });
  it("R2 same snapshots merge preserves closed but replace restores open without hybrid history",()=>{
    const backup=passed();const attemptId=Object.keys(backup.stageCheckpoints[id].attempts)[0];
    const closed=mutateStageRetest(backup,stageCatalog,id,{kind:'close',attemptId},due);
    let current=mutateStageRetest(closed,stageCatalog,id,{kind:'start'},stageNow);
    const retry=Object.values(current.stageCheckpoints[id].attempts).find(a=>a.id!==attemptId)!;
    for(const probeId of retry.requiredProbeIds)current=mutateStageRetest(current,stageCatalog,id,{kind:'edit',attemptId:retry.id,probeId,status:'passed',explanation:'new attempt'},stageNow);
    current=mutateStageRetest(current,stageCatalog,id,{kind:'submit',attemptId:retry.id,confirmed:true},stageNow);
    for(const mode of ['merge','replace'] as const){
      const result=prepareLearningStateImport({raw:JSON.stringify(createExportEnvelope(backup,'test',1,due,stageNow)),currentState:learningStateV4Schema.parse(current),catalog:stageCatalog,mode,now:stageNow});
      expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.message);
      if(mode==='merge'){
        expect(result.value.nextState.stageCheckpoints[id].attempts[attemptId]).toEqual(closed.stageCheckpoints[id].attempts[attemptId]);
        expect(getHistoricalStageCompletion(id,result.value.nextState,stageNow)).toBeDefined();
      }else{
        expect(result.value.nextState).toEqual(learningStateV4Schema.parse(backup));
        expect(result.value.nextState.stageCheckpoints[id].historicalCompletion).toBeUndefined();
        expect(getHistoricalStageCompletion(id,finish(result.value.nextState),stageNow)).toBeDefined();
        expect(()=>mutateStageRetest(result.value.nextState,stageCatalog,id,{kind:'submit',attemptId,confirmed:false},stageNow)).toThrow();
        const revoked=mutateStageCriterion(result.value.nextState,stageCatalog,id,imageStage.exitCriteria[0].id,{kind:'revoke'},stageNow);
        expect(()=>mutateStageRetest(revoked,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},stageNow)).toThrow();
        expect(()=>mutateStageRetest(result.value.nextState,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},new Date(Date.parse(due)-1).toISOString())).toThrow();
      }
    }
  });
  it("R2 restored invalid cycle cannot submit or rewrite its attempt timestamps",()=>{
    const open=passed();const attemptId=Object.keys(open.stageCheckpoints[id].attempts)[0];
    const invalid=mutateStageCriterion(open,stageCatalog,id,imageStage.exitCriteria[0].id,{kind:'revoke'},stageNow);
    const result=prepareLearningStateImport({raw:JSON.stringify(createExportEnvelope(invalid,'test',1,stageNow,stageNow)),currentState:finish(),catalog:stageCatalog,mode:'replace',now:stageNow});
    expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.message);
    expect(result.value.nextState.stageCheckpoints[id].attempts[attemptId]).toEqual(open.stageCheckpoints[id].attempts[attemptId]);
    expect(()=>mutateStageRetest(result.value.nextState,stageCatalog,id,{kind:'submit',attemptId,confirmed:true},stageNow)).toThrow();
  });
  it.each([false,true])("R2 replace requires confirmation and recovery backup (backup failure=%s)",async failBackup=>{
    const backup=passed();const attemptId=Object.keys(backup.stageCheckpoints[id].attempts)[0];
    const current=finish();let saved=createPersistedEnvelope(current,'test',1,stageNow);
    const recoveries:typeof saved[]=[];const events:string[]=[];
    const adapter={load:async()=>({ok:true as const,value:saved}),save:async(value:typeof saved)=>{events.push('save');saved=value;},saveRecovery:async(value:typeof saved)=>{events.push('backup');if(failBackup)throw new Error('backup denied');recoveries.push(structuredClone(value));return 'recovery';},saveRawRecovery:async()=>{throw new Error('unexpected raw recovery');},clear:async()=>{}};
    const store=createLearningStore({catalog:stageCatalog,contentVersion:'test',adapter,now:()=>stageNow});await store.getState().hydrate();
    const before=structuredClone(store.getState().learningState);const prepared=store.getState().prepareImport(JSON.stringify(createExportEnvelope(backup,'test',1,due,stageNow)),'replace');
    if(!prepared.ok)throw new Error(prepared.message);
    expect((await store.getState().applyImport(prepared.value,false)).ok).toBe(false);expect(events).toEqual([]);
    const result=await store.getState().applyImport(prepared.value,true);
    if(failBackup){expect(result.ok).toBe(false);expect(events).toEqual(['backup']);expect(store.getState().learningState).toEqual(before);expect(saved.payload).toEqual(current);return;}
    expect(result.ok).toBe(true);expect(events).toEqual(['backup','save']);expect(recoveries[0].payload).toEqual(before);
    expect(store.getState().learningState.stageCheckpoints[id].historicalCompletion).toBeUndefined();
    expect(store.getState().learningState.stageCheckpoints[id].attempts[attemptId].confirmedAt).toBeUndefined();
    const recover=store.getState().prepareImport(JSON.stringify({...recoveries[0],exportedAt:stageNow}),'replace');
    expect(recover.ok).toBe(true);if(!recover.ok)throw new Error(recover.message);
    expect((await store.getState().applyImport(recover.value,true)).ok).toBe(true);
    expect(store.getState().learningState).toEqual(before);
  });
  it.each(['only-time','missing-snapshot','wrong-cycle','early','fingerprint','future'])("R2 replace rejects illegal %s completion",kind=>{
    const state=finish();const c=state.stageCheckpoints[id].historicalCompletion!;
    if(kind==='missing-snapshot')delete c.successfulAttemptSnapshot;
    if(kind==='wrong-cycle')state.stageCheckpoints[id].attempts[c.successfulAttemptId!].eligibilityCycleId='eligibility.wrong';
    if(kind==='early')state.stageCheckpoints[id].attempts[c.successfulAttemptId!].createdAt=stageTime;
    if(kind==='fingerprint')c.fingerprint='malformed';
    if(kind==='future')c.completedAt='2099-01-01T00:00:00.000Z';
    const p=state.stageCheckpoints[id];
    const payload={...state,stageCheckpoints:{...state.stageCheckpoints,[id]:{...p,historicalCompletion:kind==='only-time'?{completedAt:due}:c}}};
    const result=prepareLearningStateImport({raw:JSON.stringify({...createExportEnvelope(state,'test',1,due,stageNow),payload}),currentState:stageReadyInput(),catalog:stageCatalog,mode:'replace',now:stageNow});
    expect(result.ok).toBe(false);
  });
  it("R2 v3 placeholder remains non-authoritative after replace",()=>{
    const s=eligible();const p=s.stageCheckpoints[id];const cycle=Object.values(p.cycles)[0];
    const legacy={eligibilityCycleId:cycle.id,completedAt:stageNow,evidenceSnapshot:p.criteria};
    const raw=JSON.stringify({...createExportEnvelope(s,'v3',1,stageTime,stageNow),schemaVersion:3,payload:{...s,schemaVersion:3,stageCheckpoints:{[id]:{criteria:p.criteria,cycles:p.cycles,legacy:p.legacy,updatedAt:p.updatedAt,historicalCompletion:legacy}}}});
    const result=prepareLearningStateImport({raw,currentState:finish(),catalog:stageCatalog,mode:'replace',now:stageNow});
    expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.message);
    expect(result.value.nextState.stageCheckpoints[id].legacyV3Completions).toEqual([legacy]);
    expect(result.value.nextState.stageCheckpoints[id].attempts).toEqual({});
    expect(getHistoricalStageCompletion(id,result.value.nextState,stageNow)).toBeUndefined();
  });
  it.each(['missing','duplicate','uncovered','bad-reference','empty-published'])("catalog rejects %s retest contract",kind=>{
    const defs=structuredClone([...stageRetests]);
    if(kind==='missing')defs.pop();
    if(kind==='duplicate')defs.push(defs[0]);
    if(kind==='uncovered')defs[0].probes.pop();
    if(kind==='bad-reference')defs[0].probes[0].criterionIds=['stage-criterion.unknown'];
    if(kind==='empty-published')defs[0].probes=[];
    expect(()=>validateStageRetests(defs,stages)).toThrow();
  });
  it.each(['early','future-result','partial-completion','wrong-cycle'])("v4 import rejects %s instead of manufacturing authority",kind=>{
    const state=draft();const a=Object.values(state.stageCheckpoints[id].attempts)[0];
    const envelope=createExportEnvelope(state,'test',1,due,stageNow);
    if(kind==='early')a.createdAt=new Date(Date.parse(due)-1).toISOString();
    if(kind==='future-result')a.probeResults[a.requiredProbeIds[0]]={probeId:a.requiredProbeIds[0],status:'passed',explanation:'future',updatedAt:'2099-01-01T00:00:00.000Z',evidenceRefs:[]};
    if(kind==='wrong-cycle')a.eligibilityCycleId='eligibility.wrong';
    const checkpoint={...state.stageCheckpoints[id],...(kind==='partial-completion'?{historicalCompletion:{completedAt:due}}:{})};
    const raw=JSON.stringify({...envelope,payload:{...state,stageCheckpoints:{[id]:checkpoint}}});
    expect(prepareLearningStateImport({raw,currentState:finish(),catalog:stageCatalog,mode:'merge',now:stageNow}).ok).toBe(false);
  });
  it("v3 raw backup precedes any v4 write and backup failure blocks load",async()=>{
    const state=eligible();const p=state.stageCheckpoints[id];
    const old={...createPersistedEnvelope(state,'test',1,stageTime),schemaVersion:3,payload:{...state,schemaVersion:3,stageCheckpoints:{[id]:{criteria:p.criteria,cycles:p.cycles,legacy:p.legacy,updatedAt:p.updatedAt}}}};
    const raw=JSON.stringify(old);const entries=new Map<string,string>([[LEARNING_STATE_STORAGE_KEY,raw]]);
    const storage={getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{entries.set(key,value);},removeItem:(key:string)=>{entries.delete(key);},key:(index:number)=>[...entries.keys()][index]??null,get length(){return entries.size;}};
    const adapter=new LocalStorageLearningStateAdapter(()=>storage);const loaded=await adapter.load();
    expect(loaded.ok).toBe(true);expect(entries.get(LEARNING_STATE_STORAGE_KEY)).toBe(raw);expect(entries.size).toBe(2);
    await adapter.load();expect(entries.size).toBe(2);
    const blocked=new LocalStorageLearningStateAdapter(()=>({...storage,getItem:(key:string)=>key===LEARNING_STATE_STORAGE_KEY?raw:null,setItem:()=>{throw new Error('backup denied');}}));
    expect((await blocked.load()).ok).toBe(false);expect(entries.get(LEARNING_STATE_STORAGE_KEY)).toBe(raw);
  });
  it("future branch definition requires only probes for current active criteria",()=>{
    const formal=stages.find(s=>s.categoryOrder===9)!;
    const stage={...formal,contentStatus:'available' as const,entryGate:undefined,projectGates:[]};
    const definition={...stageRetests.find(d=>d.stageId===stage.id)!,contentStatus:'published' as const,probes:stage.exitCriteria.map((c,i)=>({id:`retest-probe.future.${i}`,title:'测试',criterionIds:[c.id],goal:'测试',inputRequirement:'测试',whatToRecord:'测试',selfCheck:'测试'}))};
    const catalog={...stageCatalog,stages:[stage],stageRetests:[definition]};let state=stageReadyInput();
    state.preferences.trackGoals['track.industrial-3d']='understand';state.preferences.trackGoals['track.computational-imaging']='master';
    const active=stage.exitCriteria.filter(c=>c.required&&conditionActive(c.when,catalog.tracks,state));
    for(const c of active) {
      state=mutateStageCriterion(state,catalog,stage.id,c.id,{kind:'evidence',evidenceRefs:[stageRef],explanation:'当前路线证据'},stageTime);
      state=mutateStageCriterion(state,catalog,stage.id,c.id,{kind:'confirm',confirmed:true},stageTime);
    }
    const life=getRetestLifecycle(stage.id,state,catalog,due);
    expect(life.status).toBe('due');expect(life.probes?.map(p=>p.criterionIds[0]).sort()).toEqual(active.map(c=>c.id).sort());
    expect(life.probes!.length).toBeLessThan(definition.probes.length);
  });
});
