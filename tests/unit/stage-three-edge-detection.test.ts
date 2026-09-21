import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest as catalog } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { mutateStageCriterion } from "@/features/progress/stage-lifecycle";
import { getRetestLifecycle } from "@/features/progress/stage-retest";
import { stageReadyInput, stageTime, imageStage, stageCatalog, stageRef } from "../fixtures/stage-lifecycle";

describe("Stage 3 edge detection", () => {
  const c = catalog.concepts.find(c => c.id === "dip.edge-detection")!;
  it("publishes the ninth Concept with two required criteria", () => {
    expect(c).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "master", slug: "dip-edge-detection" });
    expect(catalog.concepts.filter(x => x.stageId === c.stageId)).toHaveLength(10);
    expect(c.masteryCriteria.map(x => x.id)).toEqual([
      "criterion.dip-edge-detection.interpret-gradient-edge-response",
      "criterion.dip-edge-detection.diagnose-edge-detection-tradeoffs",
    ]);
    expect(c.masteryCriteria.every(x => x.required)).toBe(true);
    expect(getConceptStatus({}, c.id)).toBe("not_started");
  });
  it("uses only the approved DAG and optional noise recommendation", () => {
    expect(c.dependencies.map(d => [d.conceptId, d.kind])).toEqual([
      ["dip.convolution-lsi", "hard"], ["math.calculus-gradients", "hard"], ["dip.noise-models", "recommended"],
    ]);
    const s = stageReadyInput();
    s.preferences.activeStageId = c.stageId;
    delete s.conceptProgress[c.id];
    expect(getNextStep({ catalog, state: s, now: stageTime })).toMatchObject({ targetId: c.id });
    const understood = structuredClone(s);
    for (const d of c.dependencies.filter(d => d.kind === "hard")) understood.conceptProgress[d.conceptId].status = "understood";
    delete understood.conceptProgress["dip.noise-models"];
    expect(getConceptReadiness(c, understood.conceptProgress).ready).toBe(true);
    for (const d of c.dependencies.filter(d => d.kind === "hard")) {
      const blocked = structuredClone(s);
      delete blocked.conceptProgress[d.conceptId];
      expect(getConceptReadiness(c, blocked.conceptProgress).ready).toBe(false);
      expect(getNextStep({ catalog, state: blocked, now: stageTime })).not.toMatchObject({ targetId: c.id });
    }
  });
  it("does not let Stage 2 retention wait globally block Stage 3", () => {
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
  it("does not publish future content or execute Stage 3 completion", () => {
    for (const id of ["dip.restoration", "dip.quality-metrics"])
      expect(catalog.concepts.some(x => x.id === id)).toBe(false);
    expect(catalog.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(catalog.stageRetests.find(r => r.stageId === c.stageId)?.contentStatus).toBe("planned");
    const stage = catalog.stages.find(s => s.id === c.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(getStageReadiness(stage, catalog.stages, catalog.concepts, catalog.projects,
      catalog.tracks, stageReadyInput(), stageTime).ready).toBe(false);
  });
  it("scopes resources and provides teaching/assessment scaffolding", async () => {
    const body = await readFile("content/concepts/image-processing/dip-edge-detection.mdx", "utf8");
    for (const text of ["Active Recall", "Practice", "Mastery Evidence", "先预测", "法向", "切向", "signed", "hysteresis", "strong seeds", "source", "边界"])
      expect(body).toContain(text);
    expect(body.match(/```python/g)).toHaveLength(5);
    expect(c.resourceIds).toEqual(["resource.opencv-image-gradients", "resource.opencv-canny-edges"]);
    for (const id of c.resourceIds) {
      expect(catalog.resources.find(r => r.id === id)?.verification).toBe("verified");
      expect(catalog.concepts.filter(x => x.resourceIds.some(r => r === id)).map(x => x.id)).toEqual([c.id]);
    }
  });
});
