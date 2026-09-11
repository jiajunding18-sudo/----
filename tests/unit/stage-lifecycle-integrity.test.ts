import { describe, expect, it } from "vitest";
import { stageReadyInput, stageCatalog, imageStage, stageRef, stageTime, stageNow } from "../fixtures/stage-lifecycle";
import { contentManifest } from "../../.generated/content-manifest";
import { mutateStageCriterion, reconcileStageEligibility } from "@/features/progress/stage-lifecycle";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { activeCycle, conditionActive } from "@/features/progress/stage-evidence";
import { createLearningStore } from "@/features/progress/learning-store";
import { createExportEnvelope, createPersistedEnvelope } from "@/lib/storage/learning-state";
import { prepareLearningStateImport } from "@/lib/storage/learning-backup";
import { mergeStageCheckpoints } from "@/lib/storage/stage-checkpoint-merge";
import { getNextStep } from "@/features/recommendations/next-step";
import type { LearningStateV4 } from "@/types";

const [first, second] = imageStage.exitCriteria;
const action = { kind: "evidence" as const, evidenceRefs: [stageRef], explanation: "逐项核对报告" };
const read = (s: LearningStateV4) => getStageReadiness(imageStage, contentManifest.stages, contentManifest.concepts, contentManifest.projects, contentManifest.tracks, s, stageNow);
function eligible(time = stageTime) {
  let s = stageReadyInput();
  for (const c of imageStage.exitCriteria) {
    s = mutateStageCriterion(s, stageCatalog, imageStage.id, c.id, action, time);
    s = mutateStageCriterion(s, stageCatalog, imageStage.id, c.id, { kind: "confirm", confirmed: true }, time);
  }
  return s;
}
function imported(s: LearningStateV4) {
  const result = prepareLearningStateImport({ raw: JSON.stringify(createExportEnvelope(s, "test", 1, stageNow, stageNow)), currentState: stageReadyInput(), catalog: stageCatalog, mode: "replace", now: stageNow });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.value.nextState;
}
function storeFor(s = stageReadyInput(), failOnce = false) {
  const writes: LearningStateV4[] = [];
  const adapter = {
    load: async () => ({ ok: true as const, value: createPersistedEnvelope(s, "test", 1, stageTime) }),
    save: async (e: ReturnType<typeof createPersistedEnvelope>) => {
      await Promise.resolve();
      if (failOnce) { failOnce = false; throw new Error("test disk failure"); }
      writes.push(e.payload);
    },
    saveRecovery: async () => "test", saveRawRecovery: async () => "test", clear: async () => {},
  };
  return { store: createLearningStore({ catalog: stageCatalog, adapter, contentVersion: "test", now: () => stageNow }), writes };
}

describe("B1-R1 lifecycle integrity counterexamples", () => {
  it("partial/future reserved completion is inert across import, runtime and downstream gate", () => {
    const s = eligible(); const p = s.stageCheckpoints[imageStage.id]; const cycle = Object.values(p.cycles)[0];
    p.legacyV3Completions[0] = { eligibilityCycleId: cycle.id, completedAt: "2099-01-01T00:00:00.000Z", evidenceSnapshot: { [first.id]: p.criteria[first.id] } };
    const restored = imported(s);
    expect(read(restored)).toMatchObject({ nonRetestReady: true, currentEligibilityValid: true, ready: false, historicalCompletion: undefined });
    const downstream = { ...imageStage, id: "stage.test-next", entryGate: { kind: "checkpoint" as const, stageId: imageStage.id } };
    expect(getStageReadiness(downstream, [imageStage, downstream], contentManifest.concepts, contentManifest.projects, contentManifest.tracks, restored, stageNow).entryReady).toBe(false);
    expect(getStageReadiness({ ...imageStage, retestAfterDays: 30 }, contentManifest.stages, contentManifest.concepts, contentManifest.projects, contentManifest.tracks, restored, stageNow).ready).toBe(false);
  });
  it("trusted export/import preserves exact cycle and anchor", () => {
    const s = eligible();
    expect(imported(s).stageCheckpoints).toEqual(s.stageCheckpoints);
  });
  it("a later explicit mastery transition cannot inherit an earlier anchor", () => {
    const s = eligible();
    s.conceptProgress["python.numpy-arrays"].lastMasteredAt = stageNow;
    expect(read(s).currentEligibilityValid).toBe(false);
    expect(read(imported(s)).activeEligibility?.eligibleAt).toBe(stageNow);
  });
  it("planned checkpoint has no executable base qualification or exit recommendation", () => {
    const s = eligible(); const stage = { ...imageStage, contentStatus: "planned" as const };
    expect(getStageReadiness(stage, [stage], contentManifest.concepts, contentManifest.projects, contentManifest.tracks, s, stageNow)).toMatchObject({ nonRetestReady: false, currentEligibilityValid: false, ready: false });
    expect(() => mutateStageCriterion(s, { ...stageCatalog, stages: [stage] }, stage.id, first.id, action, stageNow)).toThrow();
    expect(getNextStep({ catalog: { ...contentManifest, stages: [stage] }, state: s, now: stageNow }).kind).not.toBe("stage-exit");
  });
  it.each(["missing", "backdated", "mismatch"])("untrusted %s anchor is retained as invalidated history and re-established now", kind => {
    const s = eligible(stageNow); const cycle = Object.values(s.stageCheckpoints[imageStage.id].cycles)[0]; const id = cycle.id;
    if (kind === "missing") delete cycle.qualificationBasis;
    if (kind === "backdated") cycle.eligibleAt = stageTime;
    if (kind === "mismatch") cycle.qualificationBasis!.fingerprint = "other contract";
    expect(read(s).currentEligibilityValid).toBe(false);
    const next = imported(s); const current = read(next).activeEligibility!;
    expect(current.id).not.toBe(id); expect(current.eligibleAt).toBe(stageNow);
    expect(next.stageCheckpoints[imageStage.id].cycles[id].invalidatedAt).toBe(stageNow);
  });
  it.each(["eligibleAt", "invalidatedAt", "reversed", "multiple"])("runtime %s separates base conditions from valid current eligibility", kind => {
    const s = eligible(); const p = s.stageCheckpoints[imageStage.id]; const cycle = Object.values(p.cycles)[0];
    if (kind === "eligibleAt" || kind === "invalidatedAt") cycle[kind] = "2099-01-01T00:00:00.000Z";
    if (kind === "reversed") cycle.invalidatedAt = "2026-01-01T00:00:00.000Z";
    if (kind === "multiple") p.cycles["eligibility.other"] = { ...cycle, id: "eligibility.other" };
    expect(read(s)).toMatchObject({ nonRetestReady: true, currentEligibilityValid: false, ready: false });
  });
  it("source deleted/restored does not revive confirmation; explicit reconfirm does", () => {
    let s = eligible(); const scope = s.projectProgress[stageRef.projectId].milestones![stageRef.milestoneId]; const saved = structuredClone(scope.deliverables);
    scope.deliverables = []; s = reconcileStageEligibility(s, stageCatalog, stageNow);
    expect(s.stageCheckpoints[imageStage.id].criteria[first.id].confirmationInvalidatedAt).toBe(stageNow);
    s.projectProgress[stageRef.projectId].milestones![stageRef.milestoneId].deliverables = saved;
    s = reconcileStageEligibility(s, stageCatalog, stageNow);
    expect(read(s).nonRetestReady).toBe(false);
    for (const c of imageStage.exitCriteria) s = mutateStageCriterion(s, stageCatalog, imageStage.id, c.id, { kind: "confirm", confirmed: true }, stageNow);
    expect(read(s).currentEligibilityValid).toBe(true);
  });
  it("same-ID deliverable edit and passed evidence replacement stale confirmations", () => {
    let s = eligible();
    s.projectProgress[stageRef.projectId].milestones![stageRef.milestoneId].deliverables[0].title = "changed evidence";
    s = reconcileStageEligibility(s, stageCatalog, stageNow);
    expect(read(s).nonRetestReady).toBe(false);
    const ref = { kind: "concept-evidence" as const, conceptId: "python.numpy-dtypes", evidenceId: "evidence.fixture.python.numpy-dtypes" };
    s = mutateStageCriterion(s, stageCatalog, imageStage.id, first.id, { ...action, evidenceRefs: [ref] }, stageNow);
    s = mutateStageCriterion(s, stageCatalog, imageStage.id, first.id, { kind: "confirm", confirmed: true }, stageNow);
    s.conceptProgress[ref.conceptId].evidence[0].result = "failed";
    s = reconcileStageEligibility(s, stageCatalog, stageNow);
    s.conceptProgress[ref.conceptId].evidence[0].result = "passed";
    s = reconcileStageEligibility(s, stageCatalog, stageNow);
    expect(s.stageCheckpoints[imageStage.id].criteria[first.id].confirmationInvalidatedAt).toBe(stageNow);
  });
  it("concurrent different criteria/stages preserve all successful writes", async () => {
    const { store } = storeFor(); await store.getState().hydrate();
    const tooling = contentManifest.stages.find(s => s.id === "stage.tooling-foundations")!;
    const results = await Promise.all([
      store.getState().mutateStage(imageStage.id, first.id, action),
      store.getState().mutateStage(imageStage.id, second.id, action),
      store.getState().mutateStage(tooling.id, tooling.exitCriteria[0].id, action),
    ]);
    expect(results.every(r => r.ok)).toBe(true);
    expect(Object.keys(store.getState().learningState.stageCheckpoints[imageStage.id].criteria)).toHaveLength(2);
    expect(store.getState().learningState.stageCheckpoints[tooling.id]).toBeDefined();
  });
  it("queued edit/confirm sees latest evidence; confirm followed by edit clears it", async () => {
    const { store } = storeFor(); await store.getState().hydrate();
    const run = store.getState().mutateStage;
    await Promise.all([run(imageStage.id, first.id, action), run(imageStage.id, first.id, { kind: "confirm", confirmed: true })]);
    expect(store.getState().learningState.stageCheckpoints[imageStage.id].criteria[first.id].confirmedAt).toBe(stageNow);
    await Promise.all([run(imageStage.id, first.id, { kind: "confirm", confirmed: true }), run(imageStage.id, first.id, { ...action, explanation: "changed" })]);
    expect(store.getState().learningState.stageCheckpoints[imageStage.id].criteria[first.id].confirmedAt).toBeUndefined();
  });
  it("revoke and source-changing Concept mutation cannot overwrite each other", async () => {
    const { store } = storeFor(eligible()); await store.getState().hydrate();
    const results = await Promise.all([store.getState().mutateStage(imageStage.id, first.id, { kind: "revoke" }), store.getState().downgradeConcept("python.numpy-arrays", "understood")]);
    expect(results.every(r => r.ok)).toBe(true);
    expect(store.getState().learningState.conceptProgress["python.numpy-arrays"].status).toBe("understood");
    expect(store.getState().learningState.stageCheckpoints[imageStage.id].criteria[first.id].confirmedAt).toBeUndefined();
    expect(read(store.getState().learningState).currentEligibilityValid).toBe(false);
  });
  it("persist failure releases queue without committing failed edit", async () => {
    const { store } = storeFor(stageReadyInput(), true); await store.getState().hydrate();
    const results = await Promise.all([store.getState().mutateStage(imageStage.id, first.id, action), store.getState().mutateStage(imageStage.id, second.id, action)]);
    expect(results.map(r => r.ok)).toEqual([false, true]);
    expect(Object.keys(store.getState().learningState.stageCheckpoints[imageStage.id].criteria)).toEqual([second.id]);
  });
  it("removed criterion remains orphan; added required criterion invalidates", () => {
    const s = eligible(); const orphan = structuredClone(s.stageCheckpoints[imageStage.id].criteria[first.id]);
    const removed = { ...stageCatalog, stages: stageCatalog.stages!.map(st => st.id === imageStage.id ? { ...st, exitCriteria: [second] } : st) };
    const next = reconcileStageEligibility(s, removed, stageNow);
    expect(next.stageCheckpoints[imageStage.id].criteria[first.id]).toEqual(orphan);
    const added = { ...stageCatalog, stages: stageCatalog.stages!.map(st => st.id === imageStage.id ? { ...st, exitCriteria: [...st.exitCriteria, { ...first, id: "stage-criterion.image-computing.new" }] } : st) };
    expect(activeCycle(reconcileStageEligibility(s, added, stageNow).stageCheckpoints[imageStage.id], stageNow)).toBeUndefined();
  });
  it("formal Stage 9 track criterion IDs switch without deleting inactive evidence", () => {
    const formal = contentManifest.stages.find(s => s.categoryOrder === 9)!;
    const stage = { ...formal, contentStatus: "available" as const, entryGate: undefined, projectGates: [] };
    const catalog = { ...stageCatalog, stages: [stage] };
    let s = stageReadyInput();
    s.preferences.trackGoals["track.industrial-3d"] = "understand";
    s.preferences.trackGoals["track.computational-imaging"] = "master";
    const initialIds = stage.exitCriteria.filter(c => conditionActive(c.when, catalog.tracks, s)).map(c => c.id);
    for (const id of initialIds) { s = mutateStageCriterion(s, catalog, stage.id, id, action, stageTime); s = mutateStageCriterion(s, catalog, stage.id, id, { kind: "confirm", confirmed: true }, stageTime); }
    expect(activeCycle(s.stageCheckpoints[stage.id], stageNow)).toBeDefined();
    s.preferences.trackGoals["track.industrial-3d"] = "master";
    s.preferences.trackGoals["track.computational-imaging"] = "understand";
    s = reconcileStageEligibility(s, catalog, stageNow);
    expect(activeCycle(s.stageCheckpoints[stage.id], stageNow)).toBeUndefined();
    expect(Object.keys(s.stageCheckpoints[stage.id].criteria)).toEqual(initialIds);
  });
  it("legal v3 waiting state has valid cycle and explicit retest blocker, never completion", () => {
    expect(read(eligible())).toMatchObject({ nonRetestReady: true, currentEligibilityValid: true, ready: false, retestDue: true });
    expect(read(eligible()).blockers).toContainEqual(expect.objectContaining({ code: "retest", retestAfterDays: 7, initiallyEligibleAt: stageTime }));
  });
  it("focus Stage exit outranks unrelated learning, but own Concept/Project gaps precede exit", () => {
    const s = stageReadyInput(); s.conceptProgress["math.numerical-stability"].status = "learning";
    const next = () => getNextStep({ catalog: contentManifest, state: s, now: stageNow });
    expect(next().kind).toBe("stage-exit");
    s.projectProgress[stageRef.projectId].milestones![stageRef.milestoneId].status = "in_progress";
    expect(next().kind).toBe("project-milestone");
    s.conceptProgress["python.numpy-arrays"].status = "understood";
    expect(next()).toMatchObject({ kind: "recommendation", targetId: "python.numpy-arrays" });
  });
  it("stale/orphan merge stays stale and cycle provenance conflicts fail safely", () => {
    const s = eligible(); const p = s.stageCheckpoints[imageStage.id]; const changed = structuredClone(p);
    changed.criteria[first.id] = { ...changed.criteria[first.id], confirmationInvalidatedAt: stageNow, updatedAt: stageNow };
    changed.criteria["stage-criterion.orphan"] = { evidenceRefs: [], explanation: "history", updatedAt: stageTime };
    expect(mergeStageCheckpoints(p, changed).criteria[first.id].confirmationInvalidatedAt).toBe(stageNow);
    expect(mergeStageCheckpoints(p, changed).criteria["stage-criterion.orphan"]).toBeDefined();
    Object.values(changed.cycles)[0].qualificationBasis!.fingerprint = "mismatch";
    expect(() => mergeStageCheckpoints(p, changed)).toThrow(/basis conflict/);
  });
});
