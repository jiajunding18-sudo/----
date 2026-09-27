import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import { getProjectCompletionEligibility, getProjectKnowledgeReadiness } from "@/features/projects";
import { addProjectDeliverable, completeProjectProgress, setProjectAcceptanceCriterion, startProjectProgress } from "@/features/projects/project-progress";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { createInitialLearningState } from "@/lib/storage";

const project = contentManifest.projects.find(({ id }) => id === "project.classical-inspection")!;
const stage = contentManifest.stages.find(({ id }) => id === "stage.digital-image-processing")!;
const stamp = "2026-09-27T10:00:00.000Z";
const hardIds = [
  "opencv.io-color", "opencv.roi-masks", "opencv.edges-contours", "pipeline.batch-images",
  "dip.segmentation", "dip.morphology", "dip.quality-metrics",
];
const acceptanceIds = [
  "task-truth-split", "input-batch-integrity", "segmentation-morphology-measurement",
  "nontrivial-rule-decision", "controlled-comparison", "frozen-unseen-degradation",
  "reproducibility-failure-analysis",
].map((suffix) => `acceptance.classical-inspection.${suffix}`);

function readyState() {
  const state = createInitialLearningState(contentManifest.tracks, stamp);
  for (const conceptId of hardIds) {
    state.conceptProgress[conceptId] = {
      status: "understood", note: "", favorite: false, updatedAt: stamp,
      startedAt: stamp, understoodAt: stamp, evidence: [],
    };
  }
  return state;
}

describe("Phase 9F-E1 Classical Inspection published Project contract", () => {
  it("publishes the same Project ID with seven understood hard and no milestone", () => {
    expect(contentManifest.projects).toHaveLength(13);
    expect(project.publicationStatus).toBe("published");
    expect(project.slug).toBe("classical-inspection");
    expect(project.estimatedHours).toEqual({ min: 25, max: 35 });
    expect("milestones" in project).toBe(false);
    expect(project.conceptRequirements.map(({ conceptId }) => conceptId)).toEqual(hardIds);
    expect(project.conceptRequirements.every(({ kind, minimumStatus }) => kind === "hard" && minimumStatus === "understood")).toBe(true);
    expect(project.evidenceConceptIds).toEqual([...hardIds, "visualization.image-plots"]);
    expect(project.resources).toEqual([]);
    expect(project.executionPaths).toHaveLength(1);
    expect(project.executionPaths[0]?.mode).toBe("simulation");
    expect(stage.projectGates.map(({ projectId }) => projectId)).toEqual([project.id]);
  });

  it("requires all seven hard but no historical Stage 2 completion", () => {
    const ready = readyState();
    expect(ready.stageCheckpoints["stage.image-computing"]).toBeUndefined();
    expect(getProjectKnowledgeReadiness(project, ready.conceptProgress).ready).toBe(true);
    for (const conceptId of hardIds) {
      const incomplete = structuredClone(ready);
      delete incomplete.conceptProgress[conceptId];
      expect(getProjectKnowledgeReadiness(project, incomplete.conceptProgress).missingHard.map(({ conceptId: id }) => id)).toEqual([conceptId]);
    }
    expect(ready.conceptProgress["visualization.image-plots"]).toBeUndefined();
  });

  it("uses exactly seven required evidence-bearing acceptance items and four human deliverable groups", () => {
    expect(project.acceptanceCriteria.map(({ id }) => id)).toEqual(acceptanceIds);
    expect(project.acceptanceCriteria.every(({ required, description }) => required && description.length > 50)).toBe(true);
    expect(project.deliverableRequirements.map((item) => item.slice(0, 2))).toEqual(["A.", "B.", "C.", "D."]);
    const body = readFileSync("content/projects/beginner/classical-inspection.mdx", "utf8");
    for (const phrase of ["truth", "unseen", "R<0.98", "contourArea", "succeeded / failed / skipped", "FP", "FN", "source", "manifest", "不会自动确认任何 Stage criterion"]) expect(body).toContain(phrase);
    expect(body).not.toMatch(/YOLO|BFMatcher|RANSAC|warpPerspective/);
  });

  it("does not confer readiness or Stage evidence merely by publishing content", () => {
    const state = readyState();
    expect(state.projectProgress[project.id]).toBeUndefined();
    const gate = getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects, contentManifest.tracks, state, stamp);
    expect(gate.incompleteProjectIds).toContain(project.id);
    expect(gate.ready).toBe(false);
    expect(state.stageCheckpoints[stage.id]).toBeUndefined();
    expect(contentManifest.stageRetests.find(({ stageId }) => stageId === stage.id)?.contentStatus).toBe("planned");
  });

  it("requires started + acceptance + one record + explicit confirmation; Project completion is not Stage completion", () => {
    const state = readyState();
    expect(completeProjectProgress(project, undefined, true, stamp).ok).toBe(false);
    const start = startProjectProgress(project, state, {
      selectedExecutionPathId: project.executionPaths[0]!.id,
      nextAction: "生成开发集并核对真值分离",
      environmentChecks: {}, confirmPrerequisiteOverride: false,
    }, stamp);
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    let progress = start.progress;
    expect(getProjectCompletionEligibility(project, progress).eligible).toBe(false);
    for (const id of acceptanceIds) {
      const result = setProjectAcceptanceCriterion(project, progress, id, true, stamp);
      expect(result.ok).toBe(true);
      if (result.ok) progress = result.progress;
    }
    expect(getProjectCompletionEligibility(project, progress).hasDeliverable).toBe(false);
    const add = addProjectDeliverable(project, progress, {
      id: "deliverable.classical-inspection.index", title: "人工验收索引", reference: "evidence/index.md",
    }, stamp);
    expect(add.ok).toBe(true);
    if (!add.ok) return;
    progress = add.progress;
    expect(getProjectCompletionEligibility(project, progress).eligible).toBe(true);
    expect(completeProjectProgress(project, progress, false, stamp).ok).toBe(false);
    const completed = completeProjectProgress(project, progress, true, stamp);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    state.projectProgress[project.id] = completed.progress;
    expect(completed.progress.status).toBe("completed");
    expect(state.stageCheckpoints[stage.id]).toBeUndefined();
    const gate = getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects, contentManifest.tracks, state, stamp);
    expect(gate.incompleteProjectIds).toEqual([]);
    expect(gate.ready).toBe(false);
  });
});
