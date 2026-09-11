import { retestDefinitionSchema, type RetestDefinition } from "../validation/retest-schemas";
import type { StageDefinition } from "@/types";
export function validateStageRetests(definitions:readonly RetestDefinition[], stages:readonly StageDefinition[]) {
  const ids=new Set<string>(); const probes=new Set<string>();
  for(const raw of definitions) {
    const d=retestDefinitionSchema.parse(raw); const stage=stages.find(s=>s.id===d.stageId);
    if(!stage || stage.retestAfterDays===undefined || ids.has(d.id)) throw new Error(`复测 identity 无效 ${d.id}`);
    ids.add(d.id);
    for(const p of d.probes) {
      if(probes.has(p.id) || new Set(p.criterionIds).size!==p.criterionIds.length || p.criterionIds.some(id=>!stage.exitCriteria.some(c=>c.id===id))) throw new Error(`复测 probe 引用无效 ${p.id}`);
      probes.add(p.id);
    }
    if(d.contentStatus==='published' && (stage.contentStatus!=='available' || stage.exitCriteria.some(c=>c.required && !d.probes.some(p=>p.criterionIds.includes(c.id))))) throw new Error(`复测未覆盖出口 ${d.id}`);
  }
  for(const s of stages.filter(s=>s.retestAfterDays!==undefined)) if(definitions.filter(d=>d.stageId===s.id).length!==1) throw new Error(`复测定义必须唯一 ${s.id}`);
}
