import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { imageStage, stageCatalog, stageReadyInput, stageRef, stageTime } from "../fixtures/stage-lifecycle";
import { mutateStageCriterion } from "@/features/progress/stage-lifecycle";
import { getRetestLifecycle } from "@/features/progress/stage-retest";

describe("Stage 3 frequency domain", () => {
  const concept = contentManifest.concepts.find(c => c.id === "dip.frequency-domain")!;
  it("includes frequency domain in the six published Stage 3 concepts with constrained master depth", () => {
    expect(contentManifest.concepts.filter(c => c.stageId === concept.stageId).map(c => c.id).sort()).toEqual([
      "dip.convolution-lsi", "dip.enhancement", "dip.frequency-domain", "dip.noise-models", "dip.sampling-quantization", "dip.spatial-filtering",
    ]);
    expect(concept).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "master" });
    expect(concept.masteryCriteria).toHaveLength(2);
    expect(concept.masteryCriteria.every(c => c.required)).toBe(true);
    expect(getConceptStatus({}, concept.id)).toBe("not_started");
  });
  it("respects the formal DAG and NextStep without optional-topic gates", () => {
    expect(concept.dependencies.map(d => [d.conceptId,d.kind])).toEqual([
      ["dip.convolution-lsi","hard"], ["math.vectors-matrices","hard"], ["math.calculus-gradients","recommended"],
    ]);
    const state = stageReadyInput();
    state.preferences.activeStageId = concept.stageId;
    delete state.conceptProgress[concept.id];
    delete state.conceptProgress["math.calculus-gradients"];
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime })).toMatchObject({ targetId: concept.id });
    for (const d of concept.dependencies.filter(d => d.kind === "hard")) {
      const blocked = structuredClone(state);
      delete blocked.conceptProgress[d.conceptId];
      expect(getNextStep({ catalog: contentManifest, state: blocked, now: stageTime })).not.toMatchObject({ targetId: concept.id });
    }
    expect(concept.dependencies.every(d => contentManifest.concepts.some(c => c.id === d.conceptId))).toBe(true);
  });
  it("keeps completion, retest and Classical Inspection unpublished", () => {
    const stage = contentManifest.stages.find(s => s.id === concept.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(contentManifest.stageRetests.find(r => r.stageId === stage.id)?.contentStatus).toBe("planned");
    expect(contentManifest.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects,
      contentManifest.tracks, stageReadyInput(), stageTime).ready).toBe(false);
  });
  it("does not turn Stage 2 retention waiting into a global learning gate", () => {
    let state = stageReadyInput();
    for (const criterion of imageStage.exitCriteria) {
      state = mutateStageCriterion(state, stageCatalog, imageStage.id, criterion.id,
        { kind: "evidence", evidenceRefs: [stageRef], explanation: "核对本次批处理与数据契约产物" }, stageTime);
      state = mutateStageCriterion(state, stageCatalog, imageStage.id, criterion.id,
        { kind: "confirm", confirmed: true }, stageTime);
    }
    expect(getRetestLifecycle(imageStage.id, state, stageCatalog, stageTime).status).toBe("wait");
    state.preferences.activeStageId = concept.stageId;
    delete state.conceptProgress[concept.id];
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime })).toMatchObject({ targetId: concept.id });
  });
  it("uses an isolated FFT resource and supplies full teaching scaffolding", async () => {
    expect(concept.resourceIds).toEqual(["resource.numpy-fft"]);
    expect(contentManifest.concepts.filter(c => c.resourceIds.some(id => id === "resource.numpy-fft")).map(c => c.id)).toEqual([concept.id]);
    const resource = contentManifest.resources.find(r => r.id === "resource.numpy-fft")!;
    expect(resource.verification).toBe("verified");
    expect(resource.recommendedParts?.join(" ")).toContain("跳过");
    const body = await readFile("content/concepts/image-processing/dip-frequency-domain.mdx", "utf8");
    for (const text of ["Active Recall", "Practice", "Mastery Evidence", "real_checked", "ifftshift", "circular convolution", "不是矩阵", "相位", "不等于噪声"])
      expect(body).toContain(text);
    expect(body.match(/```python/g)).toHaveLength(4);
  });
});
