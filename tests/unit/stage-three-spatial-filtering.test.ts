import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { stageReadyInput, stageTime } from "../fixtures/stage-lifecycle";

describe("Stage 3 spatial filtering", () => {
  const concept = contentManifest.concepts.find(c => c.id === "dip.spatial-filtering")!;
  it("retains the four approved C3 concepts", () => {
    expect(contentManifest.concepts.filter(c => c.stageId === concept.stageId && !["dip.frequency-domain", "dip.enhancement", "dip.segmentation", "dip.morphology", "dip.edge-detection", "dip.feature-representation"].includes(c.id)).map(c => c.id).sort())
      .toEqual(["dip.convolution-lsi", "dip.noise-models", "dip.sampling-quantization", "dip.spatial-filtering"]);
    expect(concept).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "master" });
    expect(concept.masteryCriteria).toHaveLength(2);
    expect(concept.masteryCriteria.every(c => c.required)).toBe(true);
    expect(getConceptStatus({}, concept.id)).toBe("not_started");
  });
  it("enforces the two hard prerequisites but not recommended", () => {
    expect(concept.dependencies.map(d => [d.conceptId, d.kind])).toEqual([
      ["dip.convolution-lsi", "hard"], ["dip.noise-models", "hard"], ["opencv.filtering-basics", "recommended"],
    ]);
    const state = stageReadyInput();
    state.preferences.activeStageId = concept.stageId;
    delete state.conceptProgress[concept.id];
    delete state.conceptProgress["opencv.filtering-basics"];
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime })).toMatchObject({ targetId: concept.id });
    for (const dep of concept.dependencies.filter(d => d.kind === "hard")) {
      const blocked = structuredClone(state);
      delete blocked.conceptProgress[dep.conceptId];
      expect(getNextStep({ catalog: contentManifest, state: blocked, now: stageTime })).not.toMatchObject({ targetId: concept.id });
    }
  });
  it("does not publish Stage completion, retest, or Classical Inspection", () => {
    const stage = contentManifest.stages.find(s => s.id === concept.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(stage).not.toHaveProperty("entryGate");
    expect(contentManifest.stageRetests.find(r => r.stageId === stage.id)?.contentStatus).toBe("planned");
    expect(contentManifest.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects,
      contentManifest.tracks, stageReadyInput(), stageTime).ready).toBe(false);
  });
  it("isolates the resource and supplies experiment/evidence scaffolding", async () => {
    expect(concept.resourceIds).toEqual(["resource.opencv-spatial-filtering"]);
    const old = contentManifest.resources.find(r => r.id === "resource.opencv-python-tutorials")!;
    expect(old.recommendedParts?.find(p => p.startsWith("跳过"))).toContain("median、bilateral");
    const referring = contentManifest.concepts.filter(c => c.resourceIds.some(id => id === "resource.opencv-spatial-filtering"));
    expect(referring.map(c => c.id)).toEqual([concept.id]);
    const body = await readFile("content/concepts/image-processing/dip-spatial-filtering.mdx", "utf8");
    for (const text of ["Worked Example", "Active Recall", "Practice", "Mastery Evidence", "非线性", "不是卷积", "sigmaColor", "profile", "source", "correction"])
      expect(body).toContain(text);
  });
});
