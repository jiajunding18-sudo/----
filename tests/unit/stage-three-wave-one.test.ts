import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { mutateStageCriterion } from "@/features/progress/stage-lifecycle";
import { stageReadyInput, stageCatalog, stageRef, stageTime, imageStage } from "../fixtures/stage-lifecycle";

describe("Stage 3 Wave 1 publication boundary", () => {
  const concepts = contentManifest.concepts.filter(c => c.stageId === "stage.digital-image-processing");
  it("publishes only the two approved master concepts", () => {
    expect(concepts.map(c => c.id).sort()).toEqual(["dip.convolution-lsi", "dip.sampling-quantization"]);
    for (const c of concepts) {
      expect(c).toMatchObject({ publicationStatus: "published", requiredness: "required", targetDepth: "master" });
      expect(c.masteryCriteria).toHaveLength(2);
      expect(c.masteryCriteria.every(x => x.required)).toBe(true);
      expect(getConceptStatus({}, c.id)).toBe("not_started");
      expect(c.resourceIds).toHaveLength(1);
    }
  });
  it("keeps parallel hard paths and recommended math", () => {
    for (const c of concepts) {
      const hard = c.id === "dip.sampling-quantization"
        ? ["image.digital-representation"] : ["math.vectors-matrices", "python.numpy-arrays"];
      expect(c.dependencies.filter(d => d.kind === "hard").map(d => d.conceptId)).toEqual(hard);
      expect(c.dependencies.filter(d => d.kind === "recommended").map(d => d.conceptId)).toEqual(["math.linear-transforms"]);
      expect(getConceptReadiness(c, {}).missingHard).toEqual(hard);
      for (const d of c.dependencies) expect(contentManifest.concepts.some(p => p.id === d.conceptId)).toBe(true);
    }
  });
  it("changes maturity only, without executable retest or project publication", () => {
    const stage = contentManifest.stages.find(s => s.id === "stage.digital-image-processing");
    expect(stage).toMatchObject({ contentStatus: "available", retestAfterDays: 7 });
    expect(stage && "entryGate" in stage ? stage.entryGate : undefined).toBeUndefined();
    expect(stage?.exitCriteria).toHaveLength(2);
    expect(stage?.projectGates).toHaveLength(1);
    expect(contentManifest.projects.find(p => p.id === "project.classical-inspection")?.publicationStatus).toBe("draft");
  });
  it("teaches prediction, execution, limitations and meaningful evidence", async () => {
    for (const c of concepts) {
      const body = await readFile(resolve("content/concepts/image-processing", `${c.slug}.mdx`), "utf8");
      for (const text of ["预测", "Worked Example", "Active Recall", "Practice", "Mastery Evidence", "当前不学", "source", "assert", "correction", "draft"])
        expect(body, `${c.id}: ${text}`).toContain(text);
    }
  });
  it("allows each Wave 1 concept during Stage 2 wait without bypassing hard dependencies", () => {
    let state = stageReadyInput();
    for (const criterion of imageStage.exitCriteria) {
      state = mutateStageCriterion(state, stageCatalog, imageStage.id, criterion.id,
        { kind: "evidence", evidenceRefs: [stageRef], explanation: "fixture contract verified" }, stageTime);
      state = mutateStageCriterion(state, stageCatalog, imageStage.id, criterion.id,
        { kind: "confirm", confirmed: true }, stageTime);
    }
    expect(getNextStep({ catalog: contentManifest, state, now: stageTime }).kind).toBe("stage-wait");
    state.preferences.activeStageId = "stage.digital-image-processing";
    for (const concept of concepts) {
      const candidate = structuredClone(state);
      delete candidate.conceptProgress[concept.id];
      expect(getNextStep({ catalog: contentManifest, state: candidate, now: stageTime }))
        .toMatchObject({ kind: "recommendation", targetId: concept.id });
      for (const dependency of concept.dependencies.filter(d => d.kind === "hard")) {
        const blocked = structuredClone(candidate);
        delete blocked.conceptProgress[dependency.conceptId];
        expect(getNextStep({ catalog: contentManifest, state: blocked, now: stageTime }))
          .not.toMatchObject({ targetId: concept.id });
      }
    }
    const stage = contentManifest.stages.find(s => s.id === "stage.digital-image-processing")!;
    const readiness = getStageReadiness(stage, contentManifest.stages, contentManifest.concepts,
      contentManifest.projects, contentManifest.tracks, state, stageTime);
    expect(readiness.ready).toBe(false);
    expect(contentManifest.stageRetests.find(r => r.stageId === stage.id)?.contentStatus).toBe("planned");
    expect(state.stageCheckpoints[stage.id]?.historicalCompletion).toBeUndefined();
  });
});
