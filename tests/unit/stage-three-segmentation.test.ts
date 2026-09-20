import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { mutateStageCriterion } from "@/features/progress/stage-lifecycle";
import { getRetestLifecycle } from "@/features/progress/stage-retest";
import { imageStage, stageCatalog, stageReadyInput, stageRef, stageTime } from "../fixtures/stage-lifecycle";

describe("Stage 3 segmentation slice", () => {
  const concept = contentManifest.concepts.find(c => c.id === "dip.segmentation")!;
  it("publishes exactly nine Stage 3 concepts with two constrained mastery criteria", () => {
    expect(contentManifest.concepts.filter(c => c.stageId === concept.stageId).map(c => c.id).sort()).toEqual([
      "dip.convolution-lsi", "dip.edge-detection", "dip.enhancement", "dip.frequency-domain", "dip.morphology", "dip.noise-models", "dip.sampling-quantization", "dip.segmentation", "dip.spatial-filtering",
    ]);
    expect(concept).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "master", slug: "dip-segmentation" });
    expect(concept.masteryCriteria).toHaveLength(2);
    expect(concept.masteryCriteria.every(c => c.required)).toBe(true);
    expect(getConceptStatus({}, concept.id)).toBe("not_started");
    expect(new Set(contentManifest.concepts.map(c => c.id)).size).toBe(contentManifest.concepts.length);
    expect(new Set(contentManifest.concepts.map(c => c.slug)).size).toBe(contentManifest.concepts.length);
  });
  it("keeps two hard edges and the published recommended prerequisite", async () => {
    expect(concept.dependencies.map(d => [d.conceptId,d.kind])).toEqual([
      ["dip.spatial-filtering","hard"], ["dip.enhancement","hard"], ["math.probability-statistics","recommended"],
    ]);
    expect(contentManifest.concepts.map(c => c.id)).toContain("math.probability-statistics");
    expect(concept.dependencies.every(d => contentManifest.concepts.some(c => c.id === d.conceptId))).toBe(true);
    const roadmap = await readFile("ROADMAP.md", "utf8");
    expect(roadmap.split("\n").find(l => l.startsWith("| `dip.segmentation`"))).toContain("`math.probability-statistics`");
  });
  it("allows understood prerequisites, recommends when prioritized, and blocks each missing hard", () => {
    const state = stageReadyInput();
    state.preferences.activeStageId = concept.stageId;
    delete state.conceptProgress[concept.id];
    const understood = structuredClone(state);
    for (const d of concept.dependencies) understood.conceptProgress[d.conceptId].status = "understood";
    expect(getConceptReadiness(concept, understood.conceptProgress)).toMatchObject({ ready: true, missingRecommended: [] });
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime })).toMatchObject({ targetId: concept.id });
    for (const d of concept.dependencies.filter(d => d.kind === "hard")) {
      const blocked = structuredClone(state);
      delete blocked.conceptProgress[d.conceptId];
      expect(getConceptReadiness(concept, blocked.conceptProgress).ready).toBe(false);
      expect(getNextStep({ catalog: contentManifest, state: blocked, now: stageTime })).not.toMatchObject({ targetId: concept.id });
    }
  });
  it("recommended does not block readiness", () => {
    const state = stageReadyInput();
    delete state.conceptProgress["math.probability-statistics"];
    expect(getConceptReadiness(concept, state.conceptProgress).ready).toBe(true);
  });
  it("does not use Stage 2 retention wait as a global Stage 3 gate", () => {
    let state = stageReadyInput();
    for (const criterion of imageStage.exitCriteria) {
      state = mutateStageCriterion(state, stageCatalog, imageStage.id, criterion.id,
        { kind: "evidence", evidenceRefs: [stageRef], explanation: "核对数据契约和批处理" }, stageTime);
      state = mutateStageCriterion(state, stageCatalog, imageStage.id, criterion.id,
        { kind: "confirm", confirmed: true }, stageTime);
    }
    expect(getRetestLifecycle(imageStage.id, state, stageCatalog, stageTime).status).toBe("wait");
    state.preferences.activeStageId = concept.stageId;
    delete state.conceptProgress[concept.id];
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime })).toMatchObject({ targetId: concept.id });
  });
  it("keeps stage exit/retest and draft Project unavailable for completion", () => {
    const stage = contentManifest.stages.find(s => s.id === concept.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(contentManifest.stageRetests.find(r => r.stageId === stage.id)?.contentStatus).toBe("planned");
    expect(contentManifest.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects,
      contentManifest.tracks, stageReadyInput(), stageTime).ready).toBe(false);
  });
  it("isolates resource scope and supplies prediction, checks and evidence", async () => {
    expect(concept.resourceIds).toEqual(["resource.opencv-segmentation-thresholds"]);
    expect(contentManifest.concepts.filter(c => c.resourceIds.some(id => id === concept.resourceIds[0])).map(c => c.id)).toEqual([concept.id]);
    const resource = contentManifest.resources.find(r => r.id === concept.resourceIds[0])!;
    expect(resource.verification).toBe("verified");
    const body = await readFile("content/concepts/image-processing/dip-segmentation.mdx", "utf8");
    for (const text of ["Active Recall", "Practice", "Mastery Evidence", "先预测", "truth", "IoU", "FP", "FN", "frozen", "None", "不改参数"])
      expect(body).toContain(text);
    expect(body.match(/```python/g)).toHaveLength(4);
  });
});
