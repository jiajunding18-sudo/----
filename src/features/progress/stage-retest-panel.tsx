"use client";
import { useState } from "react";
import Link from "next/link";
import type { ProgressCatalog } from "./progress-domain";
import { useLearningStore } from "./learning-store-provider";
import { getRetestLifecycle } from "./stage-retest";
import { getHistoricalStageCompletion } from "./stage-history";
import { refreshDerivedClock } from "./derived-clock";
import type { RetestAction } from "./stage-retest";
const control="max-w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm";
export function StageRetestPanel({stageId,catalog,now}:{stageId:string;catalog:ProgressCatalog;now:string}) {
  const state=useLearningStore(s=>s.learningState);const mutate=useLearningStore(s=>s.mutateRetest);
  const [message,setMessage]=useState('');const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);
  const [dirtyProbes,setDirtyProbes]=useState<Record<string,boolean>>({});
  const life=getRetestLifecycle(stageId,state,catalog,now);const completion=getHistoricalStageCompletion(stageId,state,now);
  const attempts=Object.values(state.stageCheckpoints[stageId]?.attempts ?? {});
  const draft=life.draft;
  const run=async(action:RetestAction)=>{setBusy(true);const r=await mutate(stageId,action);setMessage(r.ok?'记录已保存。':r.message);setBusy(false);if(r.ok && (action.kind==='start'||action.kind==='close')){setDirtyProbes({});setConfirmed(false);}return r.ok;};
  if(completion) return <aside className="space-y-3" data-stage-history={stageId}><h5>该阶段检查点已完成</h5><p>完成时间：{completion.completedAt} · {completion.method==='retention-retest'?'已完成本阶段保留复测':'无复测检查点显式完成'}</p>{completion.successfulAttemptId?<p>复测时间：{state.stageCheckpoints[stageId].attempts[completion.successfulAttemptId].retestedAt}</p>:null}<p>当前证据变化不会改写完成时快照。</p><details><summary>完成时契约摘要</summary><p className="break-all">{completion.contract.requiredCriterionIds.join('、')}</p><p className="break-all">资格轮次：{completion.cycle.id}</p></details></aside>;
  return <div className="space-y-3" data-stage-retest={life.status}>
    <h5 className="font-semibold">保留复测与完成</h5>
    {life.status==='wait'?<><p>资格时间：{life.cycle?.eligibleAt}</p><p>最早复测：{life.earliestRetestAt}；剩余约 {Math.max(0,Math.ceil((Date.parse(life.earliestRetestAt!)-Date.parse(now))/60000))} 分钟。</p><p>等待用于检查延迟后的保留能力，不禁止继续其他已解锁学习。</p><Link className="underline" href="/knowledge/">查看其他可学习内容</Link></>:null}
    {life.status==='unavailable'?<p>当前复测内容尚未提供，不能提交。</p>:null}
    {life.status==='blocked'?<p>先满足当前知识、项目和出口证据要求。</p>:null}
    <button className={control} onClick={refreshDerivedClock}>刷新时间</button>
    {life.definition?.contentStatus==='published'?<details><summary>复测目标预览 · {life.definition.estimatedMinutes.min}–{life.definition.estimatedMinutes.max} 分钟</summary><p>预计时间包含简短记录，不作为限时考试标准。</p>{life.definition.probes.map(p=><p key={p.id}>{p.title}：{p.goal}</p>)}</details>:null}
    {life.status==='due'&&!draft?<button className={control} disabled={busy} onClick={()=>void run({kind:'start'})}>开始本次复测</button>:null}
    {life.status==='due'&&draft?<fieldset disabled={busy} className="min-w-0 space-y-4"><legend>本次复测</legend>{life.probes?.map(p=><ProbeEditor key={`${draft.id}:${p.id}`} title={p.title} instructions={[p.goal,p.inputRequirement,p.whatToRecord,p.selfCheck]} initial={draft.probeResults[p.id]} onDirty={dirty=>{setDirtyProbes(current=>({...current,[p.id]:dirty}));setConfirmed(false);}} save={(status,explanation)=>run({kind:'edit',attemptId:draft.id,probeId:p.id,status,explanation})}/>)}<button className={control} onClick={()=>void run({kind:'close',attemptId:draft.id})}>本次还需复习，关闭并保留记录</button><p>先保存每项本次结果，再作最终确认；这不是自动评分。</p><label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我已实际完成本次复测并核对全部结果，明确确认完成阶段。</label><button className={control} disabled={!confirmed||Object.values(dirtyProbes).some(Boolean)||draft.requiredProbeIds.some(id=>draft.probeResults[id]?.status!=='passed'||!draft.probeResults[id]?.explanation.trim())} onClick={()=>void run({kind:'submit',attemptId:draft.id,confirmed})}>确认复测并完成阶段</button></fieldset>:null}
    {life.status==='no-retest'?<><label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我已核对当前出口证据，明确确认完成检查点。</label><button className={control} disabled={!confirmed||busy} onClick={()=>void run({kind:'complete',confirmed})}>确认完成此检查点</button></>:null}
    {attempts.filter(a=>a!==draft).map(a=><details key={a.id}><summary className="break-all">历史尝试：{a.id}</summary><p>仅保留查看，不自动迁移到新轮次。</p>{Object.values(a.probeResults).map(p=><p className="break-words" key={p.probeId}>{p.status}：{p.explanation}</p>)}</details>)}
    <p role="status">{message}</p>
  </div>;
}
function ProbeEditor({title,instructions,initial,save,onDirty}:{title:string;instructions:string[];initial?:{status:'not_checked'|'needs_review'|'passed';explanation:string};save:(status:'not_checked'|'needs_review'|'passed',text:string)=>Promise<boolean>;onDirty:(dirty:boolean)=>void}){
  const [text,setText]=useState(initial?.explanation ?? '');const [status,setStatus]=useState(initial?.status ?? 'not_checked');
  return <fieldset className="min-w-0 space-y-2"><legend>{title}</legend>{instructions.map((s,i)=><p key={i}>{s}</p>)}<label className="block">本次结果与解释<textarea className={`${control} block min-h-24 w-full`} value={text} onChange={e=>{setText(e.target.value);onDirty(true);}}/></label><label>自检状态<select className={control} value={status} onChange={e=>{setStatus(e.target.value==='passed'?'passed':e.target.value==='needs_review'?'needs_review':'not_checked');onDirty(true);}}><option value="not_checked">未检查</option><option value="needs_review">仍需复习</option><option value="passed">已自检通过</option></select></label><button className={control} onClick={async()=>{if(await save(status,text))onDirty(false);}}>保存本项结果</button></fieldset>;
}
