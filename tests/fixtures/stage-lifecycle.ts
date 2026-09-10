import { contentManifest } from "../../.generated/content-manifest";
import { createInitialLearningState } from "../../src/lib/storage/learning-state";
import { getProgressCatalog } from "../../src/lib/content/site-content";
import { milestone2, pixelLab, oldPixelRecord } from "./project-milestones";
import { resolveProjectMilestone } from "../../src/features/projects/project-milestones";
import type { StageEvidenceRef } from "../../src/lib/validation/stage-progress-schemas";

export const stageTime = "2026-08-29T01:00:00.000Z";
export const stageNow = "2026-09-09T01:00:00.000Z";
export const imageStage = contentManifest.stages.find(s => s.id === "stage.image-computing")!;
export const stageCatalog = getProgressCatalog();
export const stageRef = { kind: "project-deliverable", projectId: pixelLab.id, milestoneId: milestone2, deliverableId: "deliverable.stage-two" } satisfies StageEvidenceRef;
export function stageReadyInput() {
  const state = createInitialLearningState(contentManifest.tracks, stageTime);
  state.preferences.activeStageId = imageStage.id;
  for (const c of contentManifest.concepts) {
    const criterionIds = c.masteryCriteria.filter(m => m.required).map(m => m.id);
    const evidenceId = `evidence.fixture.${c.id}`;
    state.conceptProgress[c.id] = { status: "mastered", note: "", favorite: false, updatedAt: stageTime, startedAt: stageTime, understoodAt: stageTime, firstMasteredAt: stageTime, lastMasteredAt: stageTime,
      evidence: [{ id: evidenceId, conceptId: c.id, criterionIds, kind: "exercise", title: "正式测试证据", note: "test", result: "passed", createdAt: stageTime, updatedAt: stageTime, completedAt: stageTime }],
      masteryConfirmation: { confirmedAt: stageTime, criterionIds, evidenceIds: [evidenceId], statementVersion: 1 } };
  }
  const scoped = resolveProjectMilestone(pixelLab, milestone2)!;
  const ids = scoped.acceptanceCriteria.filter(a => a.required).map(a => a.id);
  const record = { ...oldPixelRecord(), acceptance: Object.fromEntries(ids.map(id => [id, true])), deliverables: [{ id: "deliverable.stage-two", title: "Stage 2 验证报告", reference: "reports/validation.md", createdAt: stageTime, updatedAt: stageTime }], completionConfirmation: { confirmedAt: stageTime, acceptanceCriterionIds: ids, deliverableIds: ["deliverable.stage-two"] } };
  state.projectProgress[pixelLab.id] = { ...oldPixelRecord(), milestones: { "milestone.pixel-lab.tooling-foundations": oldPixelRecord(), [milestone2]: record } };
  return state;
}
