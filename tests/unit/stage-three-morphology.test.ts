import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { contentManifest as catalog } from "../../.generated/content-manifest";
import { getConceptReadiness, getConceptStatus } from "@/features/progress/progress-domain";
import { getNextStep } from "@/features/recommendations/next-step";
import { stageReadyInput, stageTime } from "../fixtures/stage-lifecycle";

describe("Stage 3 morphology", () => {
  const c = catalog.concepts.find(c => c.id === "dip.morphology")!;
  it("publishes one master with exactly two required criteria", () => {
    expect(c).toMatchObject({publicationStatus:"published",requiredness:"required",targetDepth:"master"});
    expect(catalog.concepts.filter(x=>x.stageId===c.stageId)).toHaveLength(11);
    expect(c.masteryCriteria.map(x=>x.id)).toEqual(["criterion.dip-morphology.explain-structuring-element-effects","criterion.dip-morphology.diagnose-morphology-tradeoffs"]);
    expect(c.masteryCriteria.every(x=>x.required)).toBe(true);
    expect(getConceptStatus({},c.id)).toBe("not_started");
  });
  it("only segmentation blocks; recommendation remains optional",()=>{
    expect(c.dependencies.map(x=>[x.conceptId,x.kind])).toEqual([["dip.segmentation","hard"],["opencv.threshold-morphology","recommended"]]);
    const s=stageReadyInput();
    delete s.conceptProgress["opencv.threshold-morphology"];
    expect(getConceptReadiness(c,s.conceptProgress).ready).toBe(true);
    delete s.conceptProgress["dip.segmentation"];
    expect(getConceptReadiness(c,s.conceptProgress).ready).toBe(false);
    s.preferences.activeStageId=c.stageId;
    delete s.conceptProgress[c.id];
    expect(getNextStep({catalog,state:s,now:stageTime})).not.toMatchObject({targetId:c.id});
  });
  it("keeps later content and Project/retest unpublished",()=>{
    for(const id of ["dip.quality-metrics"])
      expect(catalog.concepts.some(x=>x.id===id)).toBe(false);
    expect(catalog.projects.find(x=>x.id==="project.classical-inspection")?.publicationStatus).toBe("draft");
    expect(catalog.stageRetests.find(x=>x.stageId===c.stageId)?.contentStatus).toBe("planned");
  });
  it("provides controlled experiments and an isolated official resource",async()=>{
    const body=await readFile("content/concepts/image-processing/dip-morphology.mdx","utf8");
    for(const text of ["Active Recall","Practice","Mastery Evidence","先预测","truth","FP","FN","IoU","BORDER_CONSTANT","连通","understand"])
      expect(body).toContain(text);
    expect(body.match(/```python/g)).toHaveLength(4);
    expect(c.resourceIds).toEqual(["resource.opencv-morphology"]);
    expect(catalog.resources.find(x=>x.id===c.resourceIds[0])?.verification).toBe("verified");
    expect(catalog.concepts.filter(x=>x.resourceIds.some(id=>id===c.resourceIds[0])).map(x=>x.id)).toEqual([c.id]);
  });
});
