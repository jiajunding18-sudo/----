"use client";

import { useSyncExternalStore } from "react";
import { useLearningStore } from "@/features/progress";
import type { DeepReadonly } from "@/lib/content/manifest-types";
import type { ProjectMeta } from "@/types";
import { ProjectExecutionPanel } from "./project-execution-panel";
import { ProjectCompletionPanel } from "./project-completion-panel";
import { ProjectKnowledgePanel } from "./project-knowledge-panel";
import { getProjectScopeProgress, resolveProjectMilestone } from "./project-milestones";

interface ConceptPresentation { readonly id: string; readonly slug: string; readonly title: string; readonly publicationStatus: "published" | "draft" | "hidden" | "retired" }

function subscribeMilestoneLocation(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

function getMilestoneLocation() {
  return new URLSearchParams(window.location.hash.slice(1)).get("milestone") ?? "";
}

export function ProjectMilestonePanel({ project, concepts }: { readonly project: DeepReadonly<ProjectMeta>; readonly concepts: readonly ConceptPresentation[] }) {
  const milestones = project.milestones ?? [];
  const requestedId = useSyncExternalStore(subscribeMilestoneLocation, getMilestoneLocation, () => "");
  const selectedId = milestones.some(({ id }) => id === requestedId) ? requestedId : milestones[0]?.id ?? "";
  const { learningState, hydrated } = useLearningStore((state) => state);
  const scoped = resolveProjectMilestone(project, selectedId);
  const selected = milestones.find(({ id }) => id === selectedId);
  return <section className="mt-8" aria-labelledby="project-milestones-title">
    <h2 id="project-milestones-title" className="text-2xl font-semibold">项目能力增量</h2>
    <p className="mt-2 text-sm">每个 milestone 独立验收；已完成增量保留历史，不代表未来增量已完成。</p>
    <ul className="my-4 space-y-2">
      {milestones.map((milestone) => <li key={milestone.id} data-milestone-id={milestone.id}>
        {milestone.title}：{!hydrated ? "正在读取…" : getProjectScopeProgress(learningState, project.id, milestone.id)?.status === "completed" ? "已完成" : "尚未完成"}
        {milestone.contract.kind === "planned" ? " · 验收契约尚未发布" : ""}
      </li>)}
    </ul>
    <label htmlFor="project-milestone-select" className="block text-sm font-semibold">查看能力增量</label>
    <select id="project-milestone-select" value={selectedId} onChange={(event) => { window.location.hash = `milestone=${encodeURIComponent(event.target.value)}`; }} className="mt-2 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      {milestones.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
    </select>
    {scoped ? <div key={selectedId}>
      <ProjectExecutionPanel project={scoped} concepts={concepts} milestoneId={selectedId} />
      <ProjectKnowledgePanel project={scoped} requirements={scoped.conceptRequirements.flatMap((requirement) => {
        const concept = concepts.find(({ id }) => id === requirement.conceptId);
        return concept ? [{ concept, requirement }] : [];
      })} />
      <ProjectCompletionPanel project={scoped} evidenceConcepts={concepts.filter(({ id }) => scoped.evidenceConceptIds.includes(id))} milestoneId={selectedId} />
    </div> : <p className="mt-4" role="status">{selected?.title}的正式验收与交付物契约尚未发布，当前不能开始或确认完成。历史完成不会满足此增量。</p>}
  </section>;
}
