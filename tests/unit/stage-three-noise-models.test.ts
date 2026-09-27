import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { stageReadyInput, stageTime } from "../fixtures/stage-lifecycle";

describe("Stage 3 noise models slice", () => {
  const concept = contentManifest.concepts.find(c => c.id === "dip.noise-models")!;
  it("retains the C2 concept with constrained master depth", () => {
    expect(contentManifest.concepts.filter(c => ["dip.convolution-lsi", "dip.noise-models", "dip.restoration", "dip.sampling-quantization"].includes(c.id)).map(c => c.id).sort())
      .toEqual(["dip.convolution-lsi", "dip.noise-models", "dip.restoration", "dip.sampling-quantization"]);
    expect(concept).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "master" });
    expect(concept.masteryCriteria).toHaveLength(2);
    expect(concept.masteryCriteria.every(c => c.required)).toBe(true);
    expect(getConceptStatus({}, concept.id)).toBe("not_started");
  });
  it("requires only probability and representation, with no placeholder edge", () => {
    expect(concept.dependencies.map(d => [d.conceptId, d.kind])).toEqual([
      ["math.probability-statistics", "hard"], ["image.digital-representation", "hard"],
    ]);
    expect(getConceptReadiness(concept, {}).missingHard).toHaveLength(2);
    expect(contentManifest.concepts.map(c => c.id)).not.toContain("sensor.noise-snr");
    const state = stageReadyInput();
    state.preferences.activeStageId = concept.stageId;
    delete state.conceptProgress[concept.id];
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime })).toMatchObject({ targetId: concept.id });
    for (const d of concept.dependencies) {
      const blocked = structuredClone(state);
      delete blocked.conceptProgress[d.conceptId];
      expect(getNextStep({ catalog: contentManifest, state: blocked, now: stageTime })).not.toMatchObject({ targetId: concept.id });
    }
  });
  it("does not publish a project, retest, or completion", () => {
    const stage = contentManifest.stages.find(s => s.id === concept.stageId)!;
    expect(stage.contentStatus).toBe("available");
    expect(contentManifest.stageRetests.find(r => r.stageId === stage.id)?.contentStatus).toBe("planned");
    expect(contentManifest.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("published");
    const state = stageReadyInput();
    expect(getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects,
      contentManifest.tracks, state, stageTime).ready).toBe(false);
    expect(state.stageCheckpoints[stage.id]?.historicalCompletion).toBeUndefined();
  });
  it("keeps random scope separate from Stage 2 and provides teaching scaffolding", async () => {
    expect(concept.resourceIds).toEqual(["resource.numpy-random-generator"]);
    const resource = contentManifest.resources.find(r => r.id === concept.resourceIds[0])!;
    expect(resource).toMatchObject({ verification: "verified", url: "https://numpy.org/doc/stable/reference/random/generator.html" });
    expect(contentManifest.resources.find(r => r.id === "resource.numpy-absolute-beginners")?.recommendedParts?.join(" ")).toContain("随机数");
    const body = await readFile("content/concepts/image-processing/dip-noise-models.mdx", "utf8");
    for (const text of ["预测", "Worked Example", "Active Recall", "Practice", "Mastery Evidence", "ddof=0", "不是已标定", "correction", "draft"])
      expect(body).toContain(text);
  });
});
