"use client";

import { useEffect, useState } from "react";
import type { StageDefinition } from "@/types";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type { StageCriterionProgress, StageEvidenceRef } from "@/lib/validation/stage-progress-schemas";
import type { ProgressCatalog } from "./progress-domain";
import { useLearningStore } from "./learning-store-provider";
import { conditionActive, criterionSatisfied, legacyReviewReasons, refKey, resolveStageEvidence } from "./stage-evidence";
import { getStageReadiness } from "./stage-readiness";
import { useDerivedClock } from "./derived-clock";
import { StageRetestPanel } from "./stage-retest-panel";

const control = "max-w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const localTime = (timestamp: string) => new Date(timestamp).toLocaleString("zh-CN", { timeZoneName: "short" });
interface EvidenceOption { ref: StageEvidenceRef; label: string }

function CriterionEditor({ stageId, criterion, record, options, satisfied, disabled, onMessage }: {
  stageId: string; criterion: DeepReadonly<StageDefinition["exitCriteria"][number]>;
  record?: StageCriterionProgress; options: EvidenceOption[]; satisfied: boolean; disabled: boolean; onMessage:(text:string)=>void;
}) {
  const mutate = useLearningStore(s => s.mutateStage);
  const [refs, setRefs] = useState(record?.evidenceRefs ?? []);
  const [explanation, setExplanation] = useState(record?.explanation ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = explanation !== (record?.explanation ?? "") || JSON.stringify(refs) !== JSON.stringify(record?.evidenceRefs ?? []);
  const run = async (kind: "evidence" | "confirm" | "revoke") => {
    setBusy(true);
    const result = await mutate(stageId, criterion.id, kind === "evidence" ? { kind, evidenceRefs: refs, explanation } : kind === "confirm" ? { kind, confirmed } : { kind });
    onMessage(result.ok ? (kind === "confirm" ? "该出口标准已确认。" : kind === "revoke" ? "确认已撤销，需要再次核对并确认。" : "证据已更新，请重新确认。") : result.message);
    setBusy(false);
  };
  return <fieldset disabled={disabled || busy} className="min-w-0 space-y-3 border-t border-[var(--color-border)] py-5" data-stage-criterion={criterion.id}>
    <legend className="max-w-full break-words text-sm font-semibold">{criterion.description}</legend>
    <p className="text-sm">{satisfied ? "已确认且引用有效" : record?.confirmationInvalidatedAt ? "来源变化，原确认已失效；请重新核对并确认" : "待证据 / 待确认"} · {criterion.required ? "必需" : "可选"}</p>
    <p className="text-sm text-[var(--color-muted)]">选择已有真实记录，并逐项解释如何满足上述标准。若标准包含 uint8 溢出，需要解释该现象或引用相关 Concept 证据，不能只用项目完成代替。</p>
    {options.length ? <details><summary className="cursor-pointer text-sm">选择已有证据（{options.length}）</summary><div className="mt-3 space-y-2">{options.map(option => <label className="flex min-w-0 items-start gap-2 break-all text-sm" key={refKey(option.ref)}>
      <input type="checkbox" checked={refs.some(r => refKey(r) === refKey(option.ref))} onChange={e => setRefs(e.target.checked ? [...refs, option.ref] : refs.filter(r => refKey(r) !== refKey(option.ref)))} />
      <span>{option.label}</span>
    </label>)}</div></details> : <p className="text-sm">尚无可引用记录。先在 Concept 登记通过的证据，或在项目对应 milestone 登记交付物。</p>}
    <p className="text-sm">已选择 {refs.length} 条证据。勾选只建立引用，不会自动通过标准。</p>
    {refs.filter(ref => !options.some(o => refKey(o.ref) === refKey(ref))).map(ref => <p className="break-all text-sm" key={refKey(ref)}>引用失效：{refKey(ref)} <button className={control} type="button" onClick={() => setRefs(refs.filter(r => refKey(r) !== refKey(ref)))}>移除失效引用</button></p>)}
    <label className="block text-sm">逐项证据解释
      <textarea className={`${control} mt-2 block min-h-24 w-full`} value={explanation} onChange={e => setExplanation(e.target.value)} />
    </label>
    <div className="flex flex-wrap gap-3">
      <button className={control} type="button" onClick={() => void run("evidence")}>保存证据与解释</button>
      <button className={control} type="button" disabled={!record?.confirmedAt} onClick={() => void run("revoke")}>撤销确认</button>
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已核对证据，明确确认本条标准；不是系统自动验收。</label>
    <button className={control} type="button" disabled={!confirmed || dirty || !refs.length || !explanation.trim()} onClick={() => void run("confirm")}>确认本条标准</button>
    {dirty ? <p className="text-sm">先保存修改，再确认。任何证据修改都会清除原确认。</p> : null}
  </fieldset>;
}

export function StageExitPanel({ stage, catalog }: { stage: DeepReadonly<StageDefinition>; catalog: ProgressCatalog }) {
  const now=useDerivedClock();
  const [message,setMessage]=useState('');
  const hydrated = useLearningStore(s => s.hydrated);
  const state = useLearningStore(s => s.learningState);
  const persistenceStatus = useLearningStore(s => s.persistenceStatus);
  const id = `stage-exit-${stage.id}`;
  useEffect(() => {
    const reveal = () => {
      if (decodeURIComponent(window.location.hash.slice(1)) !== id) return;
      const element = document.getElementById(id);
      const details = element?.closest("details");
      if (details) details.open = true;
      element?.scrollIntoView();
    };
    reveal(); window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [id]);
  if (!hydrated) return <div id={id} className="mt-6" role="status">正在恢复出口证据…</div>;
  const progress = state.stageCheckpoints[stage.id];
  const concepts = catalog.concepts.map(c => ({ ...c, targetDepth: c.targetDepth ?? "master" as const }));
  const readiness = getStageReadiness(stage, catalog.stages ?? [], concepts, catalog.projects, catalog.tracks, state, now);
  const options: EvidenceOption[] = [];
  for (const [conceptId, record] of Object.entries(state.conceptProgress)) for (const evidence of record.evidence) {
    const ref: StageEvidenceRef = { kind: "concept-evidence", conceptId, evidenceId: evidence.id };
    const label = resolveStageEvidence(ref, state, catalog);
    if (label) options.push({ ref, label: `${conceptId} · ${label}` });
  }
  for (const project of catalog.projects) {
    const record = state.projectProgress[project.id];
    const scopes = project.milestones?.length ? project.milestones.map(m => ({ milestoneId: m.id, progress: record?.milestones?.[m.id] })) : [{ milestoneId: undefined, progress: record }];
    for (const scope of scopes) for (const d of scope.progress?.deliverables ?? []) {
      const ref: StageEvidenceRef = { kind: "project-deliverable", projectId: project.id, ...(scope.milestoneId ? { milestoneId: scope.milestoneId } : {}), deliverableId: d.id };
      const label = resolveStageEvidence(ref, state, catalog);
      if (label) options.push({ ref, label: `${project.id} / ${scope.milestoneId ?? "legacy"} · ${label}` });
    }
  }
  return <section id={id} aria-label={`${stage.title} 出口证据登记`} className="mt-6 min-w-0 space-y-4 break-words" data-stage-exit={stage.id}>
    <h4 className="text-lg font-semibold">出口证据与当前资格</h4>
    <StageRetestPanel stageId={stage.id} catalog={catalog} now={now}/>
    <h5>当前证据（独立于完成时快照）</h5>
    <p role="status">{message}</p>
    <p>当前非复测条件：{readiness.nonRetestReady ? "已满足" : "尚未满足"}。历史完成：{readiness.historicallyCompleted ? "已记录" : "尚无"}。</p>
    <p className="text-sm">自我确认不是自动文件审查。Project 完成不会自动确认这些标准，也不会自动完成 Stage。</p>
    {progress?.legacyV3Completions.length ? <aside aria-label="旧完成占位记录" className="space-y-2 text-sm"><p>保留了 {progress.legacyV3Completions.length} 条旧版本完成占位记录；仅供追溯，不授予当前资格或历史完成。</p><details><summary>查看旧完成记录</summary><pre className="max-w-full overflow-auto text-xs">{JSON.stringify(progress.legacyV3Completions,null,2)}</pre></details></aside>:null}
    {progress?.legacy.length ? <aside className="space-y-2 border-l-2 border-[var(--color-border)] pl-3" aria-label="旧数据待复核">
      <h5 className="font-semibold">Legacy needs-review</h5>
      {legacyReviewReasons(progress, now).map((reason, i) => <p key={i} className="text-sm">{reason}</p>)}
      <details><summary className="cursor-pointer">查看保留的旧 ID 与时间</summary><pre className="max-w-full overflow-auto text-xs">{JSON.stringify(progress.legacy, null, 2)}</pre></details>
    </aside> : null}
    {stage.exitCriteria.filter(c => conditionActive(c.when, catalog.tracks, state)).map(criterion => <CriterionEditor onMessage={setMessage} key={`${criterion.id}:${progress?.criteria[criterion.id]?.updatedAt ?? "new"}:${progress?.criteria[criterion.id]?.confirmedAt ?? "none"}`} stageId={stage.id} criterion={criterion} record={progress?.criteria[criterion.id]} options={options} satisfied={criterionSatisfied(progress?.criteria[criterion.id], state, catalog, now)} disabled={!["ready", "error"].includes(persistenceStatus) || stage.contentStatus !== "available"} />)}
    {Object.keys(progress?.criteria ?? {}).filter(id => !stage.exitCriteria.some(c => c.id === id)).map(id => <p className="break-all text-sm" key={id}>已归档标准：{id}。原记录保留，不参与当前出口。</p>)}
    <p className="text-sm">当前资格：{readiness.currentEligibilityValid ? "有效" : "尚未建立或需复核"}。导入后新建的轮次表示本次核验建立资格，不是历史首次达标时间。</p>
    <p className="text-sm">资格轮次：{readiness.activeEligibility ? `${readiness.activeEligibility.id} · ${localTime(readiness.activeEligibility.eligibleAt)}` : "无有效轮次"}</p>
    <ul className="space-y-2 text-sm">{Object.values(progress?.cycles ?? {}).filter(c => c.invalidatedAt).map(c => <li key={c.id}>已失效：{c.id} · {localTime(c.invalidatedAt!)}。恢复条件后从新轮次重新计时。</li>)}</ul>
    {!readiness.historicallyCompleted?<p className="text-sm">{stage.retestAfterDays === undefined ? "本阶段没有额外复测等待天数，仍需最终出口确认。" : `首次出口条件满足后，需要在连续 ${stage.retestAfterDays * 24} 小时后完成保留复测；未来时间不能满足等待要求。`}当前资格不等于 Stage completed。</p>:<p className="text-sm">当前证据可重新核对；不会撤销历史完成，也不会重新启动毕业轮次。</p>}
  </section>;
}
