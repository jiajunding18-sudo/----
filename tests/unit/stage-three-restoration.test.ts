import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest as catalog } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { mutateStageCriterion } from "@/features/progress/stage-lifecycle";
import { getRetestLifecycle } from "@/features/progress/stage-retest";
import { stageReadyInput, stageTime, imageStage, stageCatalog, stageRef } from "../fixtures/stage-lifecycle";

describe("Stage 3 restoration", () => {
  const c = catalog.concepts.find(c => c.id === "dip.restoration")!;
  it("publishes the eleventh Stage 3 Concept at understand depth", () => {
    expect(c).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "understand", slug: "dip-restoration" });
    expect(catalog.concepts.filter(x => x.stageId === c.stageId)).toHaveLength(11);
    expect(catalog.concepts.filter(x => x.id === c.id)).toHaveLength(1);
    expect(c.masteryCriteria.map(x => x.id)).toEqual([
      "criterion.dip-restoration.explain-degradation-and-inverse-instability",
      "criterion.dip-restoration.reason-about-restoration-tradeoffs",
    ]);
    expect(c.masteryCriteria.every(x => x.required)).toBe(true);
    expect(getConceptStatus({}, c.id)).toBe("not_started");
  });
  it("keeps both hard prerequisites and no placeholder recommendation", () => {
    expect(c.dependencies.map(d => [d.conceptId, d.kind])).toEqual([
      ["dip.frequency-domain", "hard"], ["dip.noise-models", "hard"],
    ]);
    const s = stageReadyInput();
    s.preferences.activeStageId = c.stageId;
    delete s.conceptProgress[c.id];
    delete s.conceptProgress["imaging.psf-mtf"];
    const understood = structuredClone(s);
    for (const d of c.dependencies.filter(d => d.kind === "hard")) understood.conceptProgress[d.conceptId].status = "understood";
    expect(getConceptReadiness(c, understood.conceptProgress).ready).toBe(true);
    expect(getNextStep({ catalog, state: s, now: stageTime })).toMatchObject({ targetId: c.id });
    for (const d of c.dependencies.filter(d => d.kind === "hard")) {
      const blocked = structuredClone(s);
      delete blocked.conceptProgress[d.conceptId];
      expect(getConceptReadiness(c, blocked.conceptProgress).ready).toBe(false);
      expect(getNextStep({ catalog, state: blocked, now: stageTime })).not.toMatchObject({ targetId: c.id });
    }
  });
  it("does not globally block Stage 3 on Stage 2 retention wait", () => {
    let s = stageReadyInput();
    for (const criterion of imageStage.exitCriteria) {
      s = mutateStageCriterion(s, stageCatalog, imageStage.id, criterion.id,
        { kind: "evidence", evidenceRefs: [stageRef], explanation: "核对数据契约和批处理" }, stageTime);
      s = mutateStageCriterion(s, stageCatalog, imageStage.id, criterion.id,
        { kind: "confirm", confirmed: true }, stageTime);
    }
    expect(getRetestLifecycle(imageStage.id, s, stageCatalog, stageTime).status).toBe("wait");
    s.preferences.activeStageId = c.stageId;
    delete s.conceptProgress[c.id];
    expect(getNextStep({ catalog, state: s, now: stageTime })).toMatchObject({ targetId: c.id });
  });
  it("does not publish the remaining Concepts, Project or retest", () => {
    for (const id of ["dip.quality-metrics", "imaging.psf-mtf"])
      expect(catalog.concepts.some(x => x.id === id)).toBe(false);
    expect(catalog.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(catalog.stageRetests.find(r => r.stageId === c.stageId)?.contentStatus).toBe("planned");
    const stage = catalog.stages.find(s => s.id === c.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(getStageReadiness(stage, catalog.stages, catalog.concepts, catalog.projects,
      catalog.tracks, stageReadyInput(), stageTime).ready).toBe(false);
  });
  it("reuses the resource without adding a curriculum or matching implementation", async () => {
    expect(c.resourceIds).toEqual(["resource.numpy-fft"]);
    expect(catalog.resources).toHaveLength(25);
    expect(catalog.resources.find(r => r.id === c.resourceIds[0])?.verification).toBe("verified");
    const body = await readFile("content/concepts/image-processing/dip-restoration.mdx", "utf8");
    for (const text of ["Active Recall", "Practice", "Mastery Evidence", "N/H", "full", "understand", "不要求从零", "clean_snapshot", "observed_snapshot", "跳过", "epsilon", "不是完整 Wiener", "同一观测"])
      expect(body).toContain(text);
    expect(body.match(/```python/g)).toHaveLength(4);
    const code = [...body.matchAll(/```python\n([\s\S]*?)```/g)].map(m => m[1]).join("\n");
    for (const token of ["BFMatcher", "FlannBasedMatcher", "knnMatch", "findHomography", "estimateAffine", "drawMatches", "PCA", "SIFT_create"])
      expect(code).not.toContain(token);
  });
});
