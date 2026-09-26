import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest as catalog } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { mutateStageCriterion } from "@/features/progress/stage-lifecycle";
import { getRetestLifecycle } from "@/features/progress/stage-retest";
import { imageStage, stageCatalog, stageReadyInput, stageRef, stageTime } from "../fixtures/stage-lifecycle";

describe("Stage 3 quality metrics", () => {
  const concept = catalog.concepts.find(c => c.id === "dip.quality-metrics")!;

  it("publishes the twelfth required Stage 3 Concept at master depth", () => {
    expect(concept).toMatchObject({
      slug: "dip-quality-metrics", publicationStatus: "published",
      requiredness: "required", targetDepth: "master",
    });
    expect(catalog.concepts.filter(c => c.stageId === concept.stageId)).toHaveLength(12);
    expect(catalog.concepts.filter(c => c.id === concept.id)).toHaveLength(1);
    expect(concept.masteryCriteria.map(c => c.id)).toEqual([
      "criterion.dip-quality-metrics.compute-and-interpret-reference-metrics",
      "criterion.dip-quality-metrics.diagnose-metric-limitations-and-task-fit",
    ]);
    expect(concept.masteryCriteria.every(c => c.required)).toBe(true);
    expect(getConceptStatus({}, concept.id)).toBe("not_started");
  });

  it("keeps only the ROADMAP's two published hard prerequisites", () => {
    expect(concept.dependencies.map(d => [d.conceptId, d.kind])).toEqual([
      ["math.probability-statistics", "hard"], ["dip.noise-models", "hard"],
    ]);
    const publishedIds = new Set<string>(catalog.concepts.map(c => c.id));
    expect(publishedIds.has("cv.evaluation-basics")).toBe(false);
    expect(publishedIds.has("sensor.dynamic-range")).toBe(false);
    const ready = stageReadyInput();
    ready.preferences.activeStageId = concept.stageId;
    delete ready.conceptProgress[concept.id];
    const understood = structuredClone(ready);
    for (const dep of concept.dependencies) understood.conceptProgress[dep.conceptId].status = "understood";
    expect(getConceptReadiness(concept, understood.conceptProgress).ready).toBe(true);
    expect(getNextStep({ catalog, state: ready, now: stageTime })).toMatchObject({ targetId: concept.id });
    for (const dep of concept.dependencies) {
      const blocked = structuredClone(ready);
      delete blocked.conceptProgress[dep.conceptId];
      expect(getConceptReadiness(concept, blocked.conceptProgress).ready).toBe(false);
      expect(getNextStep({ catalog, state: blocked, now: stageTime })).not.toMatchObject({ targetId: concept.id });
    }
  });

  it("does not publish the draft Project, retest, or learner Stage completion", () => {
    const stage = catalog.stages.find(s => s.id === concept.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(catalog.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(catalog.stageRetests.find(r => r.stageId === concept.stageId)?.contentStatus).toBe("planned");
    expect(getStageReadiness(stage, catalog.stages, catalog.concepts, catalog.projects,
      catalog.tracks, stageReadyInput(), stageTime).ready).toBe(false);
  });

  it("does not globally block Stage 3 recommendation during Stage 2 retention wait", () => {
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
    expect(getNextStep({ catalog, state, now: stageTime })).toMatchObject({ targetId: concept.id });
  });

  it("keeps a narrow verified reference and complete learning contract", async () => {
    expect(concept.resourceIds).toEqual(["resource.skimage-image-metrics"]);
    expect(catalog.resources).toHaveLength(26);
    const resource = catalog.resources.find(r => r.id === concept.resourceIds[0]);
    expect(resource).toMatchObject({ verification: "verified", url: "https://scikit-image.org/docs/stable/api/skimage.metrics.html" });
    expect(resource?.recommendedParts.join(" ")).toContain("跳过");
    const body = await readFile("content/concepts/image-processing/dip-quality-metrics.mdx", "utf8");
    for (const marker of ["Active Recall", "Practice", "Mastery Evidence", "data_range", "masked_mse",
      "空 mask", "0.0025", "0.022148", "target_lost", "+∞", "不新增运行依赖"])
      expect(body).toContain(marker);
    expect(body.match(/```python/g)).toHaveLength(4);
    expect(body).not.toContain("skimage.metrics import");
  });
});
