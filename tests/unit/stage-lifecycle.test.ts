import { describe, expect, it } from "vitest";
import { migrateLearningStateV3ToV4 } from "@/lib/storage/stage-completion-migration";
import { contentManifest } from "../../.generated/content-manifest";
import { imageStage, stageCatalog, stageNow, stageReadyInput, stageRef, stageTime } from "../fixtures/stage-lifecycle";
import { milestone2, pixelLab } from "../fixtures/project-milestones";
import { stageHistory } from "../fixtures/stage-history";
import { activeCycle, criterionSatisfied, historicalStageCompleted, legacyReviewReasons, resolveStageEvidence, validRetestTime } from "@/features/progress/stage-evidence";
import { mutateStageCriterion, reconcileStageEligibility, stageInspectionErrors } from "@/features/progress/stage-lifecycle";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { getNextStep } from "@/features/recommendations/next-step";
import { migrateLearningStateV2ToV3 } from "@/lib/storage/stage-progress-migration";
import { migratePersistedEnvelope } from "@/lib/storage/migrations";
import { mergeStageCheckpoints } from "@/lib/storage/stage-checkpoint-merge";
import { createExportEnvelope, createInitialLearningState, createPersistedEnvelope, LEARNING_STATE_STORAGE_KEY, LocalStorageLearningStateAdapter } from "@/lib/storage";
import { prepareLearningStateImport } from "@/lib/storage/learning-backup";
import { createLearningStore } from "@/features/progress/learning-store";
import { learningStateV4Schema } from "@/lib/validation/progress-schemas";
import { stageEvidenceRefSchema } from "@/lib/validation/stage-progress-schemas";
import type { LearningStateV4 } from "@/types";

const [first, second] = imageStage.exitCriteria;
function read(state: LearningStateV4, now = stageNow) { return getStageReadiness(imageStage, contentManifest.stages, contentManifest.concepts, contentManifest.projects, contentManifest.tracks, state, now); }
function edit(state: LearningStateV4, id: string = first.id, now = stageTime) { return mutateStageCriterion(state, stageCatalog, imageStage.id, id, { kind: "evidence", evidenceRefs: [stageRef], explanation: "报告核对 dtype / actual range、uint8 溢出、ROI 坐标与 batch 身份" }, now); }
function confirm(state: LearningStateV4, id: string = first.id, now = stageTime) { return mutateStageCriterion(state, stageCatalog, imageStage.id, id, { kind: "confirm", confirmed: true }, now); }
function eligible() {
  let state = stageReadyInput();
  for (const criterion of imageStage.exitCriteria) state = confirm(edit(state, criterion.id), criterion.id);
  return state;
}
function importState(incoming: LearningStateV4, currentState = createInitialLearningState(contentManifest.tracks, stageTime)) {
  return prepareLearningStateImport({ raw: JSON.stringify(createExportEnvelope(incoming, "test", 1, stageTime, stageNow)), currentState, catalog: stageCatalog, mode: "merge", now: stageNow });
}

describe("Phase 9E-B1 Stage evidence and qualification", () => {
  it("Project complete is not criterion confirmation; both criteria independently required", () => {
    const initial = stageReadyInput();
    expect(read(initial).incompleteProjectIds).toEqual([]);
    expect(read(initial).unmetExitCriterionIds).toHaveLength(2);
    expect(read(edit(initial)).unmetExitCriterionIds).toHaveLength(2);
    expect(read(confirm(edit(initial))).unmetExitCriterionIds).toEqual([second.id]);
    expect(read(eligible())).toMatchObject({ nonRetestReady: true, ready: false });
  });
  it("requires references, explanation and explicit confirmation", () => {
    expect(() => confirm(stageReadyInput())).toThrow();
    const state = edit(stageReadyInput());
    expect(() => mutateStageCriterion(state, stageCatalog, imageStage.id, first.id, { kind: "confirm", confirmed: false }, stageTime)).toThrow();
    state.stageCheckpoints[imageStage.id].criteria[first.id].explanation = " ";
    expect(() => confirm(state)).toThrow();
  });
  it("resolves owned milestone deliverables and passed Concept evidence only", () => {
    const state = stageReadyInput();
    expect(resolveStageEvidence(stageRef, state, stageCatalog)).toContain("Stage 2 验证报告");
    expect(resolveStageEvidence({ ...stageRef, milestoneId: undefined }, state, stageCatalog)).toBeUndefined();
    expect(resolveStageEvidence({ ...stageRef, milestoneId: "milestone.other" }, state, stageCatalog)).toBeUndefined();
    expect(resolveStageEvidence({ ...stageRef, deliverableId: "deliverable.missing" }, state, stageCatalog)).toBeUndefined();
    const ref = { kind: "concept-evidence" as const, conceptId: "python.numpy-dtypes", evidenceId: "evidence.fixture.python.numpy-dtypes" };
    expect(resolveStageEvidence(ref, state, stageCatalog)).toBeTruthy();
    state.conceptProgress[ref.conceptId].evidence[0].result = "failed";
    expect(resolveStageEvidence(ref, state, stageCatalog)).toBeUndefined();
    expect(stageEvidenceRefSchema.safeParse({ ...ref, evidenceId: "C:/fake/file.md" }).success).toBe(false);
    expect(() => mutateStageCriterion(state, stageCatalog, imageStage.id, first.id, { kind: "evidence", evidenceRefs: [ref], explanation: "test" }, stageTime)).toThrow();
  });
  it("edit clears confirmation, invalidates old cycle, new confirmation gets a new anchor", () => {
    const initial = eligible(); const old = activeCycle(initial.stageCheckpoints[imageStage.id], stageNow)!;
    let state = mutateStageCriterion(initial, stageCatalog, imageStage.id, first.id, { kind: "evidence", evidenceRefs: [stageRef], explanation: "修改后的逐项解释" }, stageNow);
    expect(state.stageCheckpoints[imageStage.id].criteria[first.id].confirmedAt).toBeUndefined();
    expect(state.stageCheckpoints[imageStage.id].cycles[old.id].invalidatedAt).toBe(stageNow);
    state = confirm(state, first.id, stageNow);
    const cycle = activeCycle(state.stageCheckpoints[imageStage.id], stageNow)!;
    expect(cycle.id).not.toBe(old.id); expect(cycle.eligibleAt).toBe(stageNow);
    expect(reconcileStageEligibility(state, stageCatalog, stageNow)).toEqual(state);
  });
  it("revoke retains evidence and invalidated cycle", () => {
    const original = eligible();
    expect(confirm(original, first.id, stageNow)).toEqual(original);
    const state = mutateStageCriterion(eligible(), stageCatalog, imageStage.id, first.id, { kind: "revoke" }, stageNow);
    expect(state.stageCheckpoints[imageStage.id].criteria[first.id].evidenceRefs).toEqual([stageRef]);
    expect(read(state).nonRetestReady).toBe(false);
    expect(Object.values(state.stageCheckpoints[imageStage.id].cycles)[0].invalidatedAt).toBe(stageNow);
    expect(mutateStageCriterion(state, stageCatalog, imageStage.id, first.id, { kind: "revoke" }, stageNow)).toEqual(state);
  });
  it.each(["concept", "project", "reference"])("%s loss invalidates qualification without discarding evidence", kind => {
    const state = eligible();
    if (kind === "concept") state.conceptProgress["python.numpy-arrays"].status = "understood";
    if (kind === "project") state.projectProgress[pixelLab.id].milestones![milestone2].status = "in_progress";
    if (kind === "reference") state.projectProgress[pixelLab.id].milestones![milestone2].deliverables = [];
    const next = reconcileStageEligibility(state, stageCatalog, stageNow);
    expect(read(next).nonRetestReady).toBe(false);
    expect(activeCycle(next.stageCheckpoints[imageStage.id], stageNow)).toBeUndefined();
    expect(next.stageCheckpoints[imageStage.id].criteria[first.id].evidenceRefs).toEqual([stageRef]);
  });
  it("future P0 / reversed / malformed timestamps fail closed; 168h is exact elapsed time", () => {
    const anchor = "2026-08-29T01:00:00.000Z";
    expect(validRetestTime(anchor, "2099-01-01T00:00:00.000Z", 7, stageNow)).toBe(false);
    expect(validRetestTime("2099-01-01T00:00:00.000Z", "2099-01-09T00:00:00.000Z", 7, stageNow)).toBe(false);
    expect(validRetestTime(anchor, "2026-09-05T00:59:59.999Z", 7, stageNow)).toBe(false);
    expect(validRetestTime(anchor, "2026-09-05T01:00:00.000Z", 7, stageNow)).toBe(true);
    expect(validRetestTime(anchor, "2026-08-28T01:00:00.000Z", 7, stageNow)).toBe(false);
    expect(validRetestTime("invalid", stageNow, 7, stageNow)).toBe(false);
    expect(validRetestTime(anchor, stageNow, 7, "invalid")).toBe(false);
  });
  it.each(["cycle", "criterion", "invalidation"])("future %s is rejected on import", kind => {
    const state = eligible(); const p = state.stageCheckpoints[imageStage.id];
    if (kind === "cycle") Object.values(p.cycles)[0].eligibleAt = "2099-01-01T00:00:00.000Z";
    if (kind === "criterion") p.criteria[first.id].confirmedAt = "2099-01-01T00:00:00.000Z";
    if (kind === "invalidation") Object.values(p.cycles)[0].invalidatedAt = "2099-01-01T00:00:00.000Z";
    if (kind === "completion") p.legacyV3Completions[0] = { eligibilityCycleId: Object.keys(p.cycles)[0], completedAt: "2099-01-01T00:00:00.000Z", evidenceSnapshot: p.criteria };
    expect(importState(state).ok).toBe(false);
  });
  it("invalidated cycle cannot be reused by a completion snapshot", () => {
    const state = eligible(); const p = state.stageCheckpoints[imageStage.id]; const cycle = Object.values(p.cycles)[0];
    cycle.invalidatedAt = stageNow;
    p.legacyV3Completions[0] = { eligibilityCycleId: cycle.id, completedAt: stageNow, evidenceSnapshot: p.criteria };
    expect(historicalStageCompleted(imageStage, p, stageNow)).toBe(false);
  });
  it("B1 reserved history grants nothing and does not disable current lifecycle", () => {
    const state = eligible(); const p = state.stageCheckpoints[imageStage.id]; const cycle = Object.values(p.cycles)[0];
    p.legacyV3Completions[0] = { eligibilityCycleId: cycle.id, completedAt: stageNow, evidenceSnapshot: structuredClone(p.criteria), retest: { eligibilityCycleId: cycle.id, retestedAt: stageNow, confirmedAt: stageNow, explanation: "reserved future lifecycle snapshot", evidenceRefs: [stageRef] } };
    state.conceptProgress["python.numpy-arrays"].status = "understood";
    const next = reconcileStageEligibility(state, stageCatalog, stageNow);
    expect(read(next)).toMatchObject({ ready: false, nonRetestReady: false });
    expect(next.stageCheckpoints[imageStage.id].legacyV3Completions[0]).toEqual(p.legacyV3Completions[0]);
    expect(activeCycle(next.stageCheckpoints[imageStage.id], stageNow)).toBeUndefined();
    expect(() => edit(next, first.id, stageNow)).not.toThrow();
  });
  it("v2 IDs and future legacy dates survive migration, grant nothing and can be reviewed", () => {
    const initial = stageReadyInput();
    const checkpoint = { criterionEvidence: { [first.id]: ["evidence.nonexistent"] }, initiallyEligibleAt: "2099-01-02T00:00:00.000Z", retestedAt: "2099-01-01T00:00:00.000Z", updatedAt: "2099-01-03T00:00:00.000Z" };
    const old = { ...initial, schemaVersion: 2, stageCheckpoints: { [imageStage.id]: checkpoint } };
    const migrated = migrateLearningStateV3ToV4(migrateLearningStateV2ToV3(old));
    expect(migrated.stageCheckpoints[imageStage.id]).toMatchObject({ criteria: {}, cycles: {}, legacy: [{ provenance: "v2-needs-review", checkpoint }] });
    expect(stageInspectionErrors(migrated, stageCatalog, stageNow)).toEqual([]);
    expect(legacyReviewReasons(migrated.stageCheckpoints[imageStage.id], stageNow).join()).toContain("早于");
    expect(read(migrated)).toMatchObject({ ready: false, nonRetestReady: false });
    expect(edit(migrated, first.id, stageNow).stageCheckpoints[imageStage.id].legacy[0].checkpoint).toEqual(checkpoint);
    const envelope = createPersistedEnvelope(migrated, "test", 1, stageNow);
    expect(migratePersistedEnvelope(envelope)).toEqual({ ok: true, value: envelope });
    expect(() => migrateLearningStateV2ToV3({ ...old, stageCheckpoints: { [imageStage.id]: { ...checkpoint, updatedAt: "malformed" } } })).toThrow();
  });
  it("criterion-aware merge preserves disjoint edits, legacy and cycles; refuses ambiguity", () => {
    const left = edit(stageReadyInput()).stageCheckpoints[imageStage.id];
    const right = edit(stageReadyInput(), second.id).stageCheckpoints[imageStage.id];
    expect(Object.keys(mergeStageCheckpoints(left, right).criteria)).toEqual([first.id, second.id]);
    const conflict = structuredClone(left); conflict.criteria[first.id].explanation = "conflict";
    expect(() => mergeStageCheckpoints(left, conflict)).toThrow(/conflict/);
    const anchored = eligible().stageCheckpoints[imageStage.id]; const invalid = structuredClone(anchored);
    Object.values(invalid.cycles)[0].invalidatedAt = stageNow;
    expect(Object.values(mergeStageCheckpoints(invalid, anchored).cycles)[0].invalidatedAt).toBe(stageNow);
    const two = structuredClone(anchored); two.cycles["eligibility.other"] = { id: "eligibility.other", eligibleAt: stageNow };
    const state = stageReadyInput(); state.stageCheckpoints[imageStage.id] = two;
    expect(importState(state).ok).toBe(false);
  });
  it("import merge reconciles full predicate; dangling incoming reference rejected without mutation", () => {
    const incoming = confirm(edit(stageReadyInput())); const current = confirm(edit(stageReadyInput(), second.id), second.id);
    const snapshot = JSON.stringify(current); const result = importState(incoming, current);
    expect(result.ok).toBe(true);
    if (result.ok) expect(activeCycle(result.value.nextState.stageCheckpoints[imageStage.id], stageNow)?.eligibleAt).toBe(stageNow);
    expect(JSON.stringify(current)).toBe(snapshot);
    incoming.stageCheckpoints[imageStage.id].criteria[first.id].evidenceRefs = [{ ...stageRef, deliverableId: "deliverable.missing" }];
    expect(importState(incoming, current).ok).toBe(false);
  });
  it("NextStep distinguishes Concept, Project, exit and eligibility pending", () => {
    const state = stageReadyInput();
    expect(getNextStep({ catalog: contentManifest, state, now: stageNow }).kind).toBe("stage-exit");
    expect(getNextStep({ catalog: contentManifest, state: eligible(), now: stageNow }).kind).toBe("stage-retest");
    state.projectProgress[pixelLab.id].milestones![milestone2].status = "in_progress";
    expect(getNextStep({ catalog: contentManifest, state, now: stageNow }).kind).toBe("project-milestone");
    state.conceptProgress["python.numpy-arrays"].status = "not_started";
    expect(getNextStep({ catalog: contentManifest, state, now: stageNow })).toMatchObject({ kind: "recommendation", targetId: "python.numpy-arrays" });
  });
  it("Stage 1A no retest delay; generic conditional goals activate only relevant criteria", () => {
    const s = contentManifest.stages.find(s => s.id === "stage.vision-math-immediate")!;
    expect("retestAfterDays" in s).toBe(false);
    const fresh = stageReadyInput();
    const criterion = imageStage.exitCriteria[0];
    const stage = { ...imageStage, projectGates: [], exitCriteria: [{ ...criterion, when: { kind: "track-goal" as const, trackId: "track.computational-imaging", minimumGoal: "master" as const } }] };
    fresh.preferences.trackGoals["track.computational-imaging"] = "understand";
    const r = getStageReadiness(stage, [stage], [], [], contentManifest.tracks, fresh, stageNow);
    expect(r.nonRetestReady).toBe(true);
    fresh.preferences.trackGoals["track.computational-imaging"] = "master";
    expect(getStageReadiness(stage, [stage], [], [], contentManifest.tracks, fresh, stageNow).nonRetestReady).toBe(false);
  });
  it("B1 snapshot selector never promotes reserved completion to entry authority", () => {
    const source = { ...imageStage, id: "stage.fixture", projectGates: [], exitCriteria: [{ ...first, id: "stage-criterion.stage.fixture.complete" }], retestAfterDays: undefined };
    const target = { ...source, id: "stage.target", entryGate: { kind: "checkpoint" as const, stageId: source.id } };
    const state = stageReadyInput();
    state.stageCheckpoints[source.id] = stageHistory(source.id, stageTime);
    expect(getStageReadiness(target, [source, target], [], [], contentManifest.tracks, state, stageNow).entryReady).toBe(false);
    state.stageCheckpoints[source.id].historicalCompletion = undefined;
    expect(getStageReadiness(target, [source, target], [], [], contentManifest.tracks, state, stageNow).entryReady).toBe(false);
  });
  it("store hydrate / reload idempotent; note does not touch cycle, status loss does", async () => {
    const state = eligible(); const data = new Map([[LEARNING_STATE_STORAGE_KEY, JSON.stringify(createPersistedEnvelope(state, "test", 1, stageTime))]]);
    const adapter = new LocalStorageLearningStateAdapter(() => ({ getItem: k => data.get(k) ?? null, setItem: (k,v) => { data.set(k,v); }, removeItem: k => { data.delete(k); } }));
    const store = createLearningStore({ catalog: stageCatalog, contentVersion: "test", adapter, now: () => stageNow });
    await store.getState().hydrate();
    expect(store.getState().persistenceStatus).toBe("ready");
    expect(store.getState().learningState.stageCheckpoints).toEqual(state.stageCheckpoints);
    expect(learningStateV4Schema.safeParse(store.getState().learningState).success).toBe(true);
    const reload = createLearningStore({ catalog: stageCatalog, contentVersion: "test", adapter, now: () => stageNow });
    await reload.getState().hydrate();
    expect(reload.getState().learningState).toEqual(store.getState().learningState);
    await store.getState().updateConceptNote("python.numpy-arrays", "new personal note");
    expect(store.getState().learningState.stageCheckpoints).toEqual(state.stageCheckpoints);
    await store.getState().setConceptFavorite("python.numpy-arrays", true);
    expect(store.getState().learningState.stageCheckpoints).toEqual(state.stageCheckpoints);
    await store.getState().createStudyLog({ localDate: "2026-09-09", minutes: 10, conceptIds: [], projectIds: [], learned: "review", blockers: "", completed: "", tomorrowPlan: "" });
    expect(store.getState().learningState.stageCheckpoints).toEqual(state.stageCheckpoints);
    expect((await store.getState().downgradeConcept("python.numpy-arrays", "understood")).ok).toBe(true);
    expect(activeCycle(store.getState().learningState.stageCheckpoints[imageStage.id], stageNow)).toBeUndefined();
  });
  it("criterionSatisfied refuses empty, duplicate and future confirmations", () => {
    const state = eligible(); const r = state.stageCheckpoints[imageStage.id].criteria[first.id];
    expect(criterionSatisfied({ ...r, evidenceRefs: [] }, state, stageCatalog, stageNow)).toBe(false);
    expect(criterionSatisfied({ ...r, evidenceRefs: [stageRef, stageRef] }, state, stageCatalog, stageNow)).toBe(false);
    expect(criterionSatisfied({ ...r, confirmedAt: "2099-01-01T00:00:00.000Z" }, state, stageCatalog, stageNow)).toBe(false);
  });
  it("Day 0 → Day 3 invalidation → Day 6 creates a distinct cycle", () => {
    const day3 = "2026-09-01T01:00:00.000Z", day6 = "2026-09-04T01:00:00.000Z";
    const initial = eligible(); const id = activeCycle(initial.stageCheckpoints[imageStage.id], day3)!.id;
    const lost = mutateStageCriterion(initial, stageCatalog, imageStage.id, first.id, { kind: "revoke" }, day3);
    const restored = confirm(lost, first.id, day6);
    const cycle = activeCycle(restored.stageCheckpoints[imageStage.id], day6)!;
    expect(cycle.id).not.toBe(id); expect(cycle.eligibleAt).toBe(day6);
    expect(restored.stageCheckpoints[imageStage.id].cycles[id]).toMatchObject({ eligibleAt: stageTime, invalidatedAt: day3 });
  });
  it("planned checkpoint rejects evidence actions and creates no eligibility", () => {
    const planned = { ...imageStage, contentStatus: "planned" as const };
    const catalog = { ...stageCatalog, stages: [planned] };
    expect(() => mutateStageCriterion(stageReadyInput(), catalog, imageStage.id, first.id, { kind: "confirm", confirmed: true }, stageNow)).toThrow();
    const state = stageReadyInput();
    expect(reconcileStageEligibility(state, catalog, stageNow)).toEqual(state);
  });
  it("legacy 2099 retest import grants neither current nor historical readiness", () => {
    for (const retestedAt of ["2099-01-01T00:00:00.000Z", "2026-09-05T01:00:00.000Z"]) {
      const state = stageReadyInput();
      const old = { ...createExportEnvelope(state, "test", 1, stageTime, stageNow), schemaVersion: 2, payload: { ...state, schemaVersion: 2, stageCheckpoints: { [imageStage.id]: { criterionEvidence: { [first.id]: ["evidence.invalid"], [second.id]: ["evidence.invalid"] }, initiallyEligibleAt: stageTime, retestedAt, updatedAt: stageTime } } } };
      const result = prepareLearningStateImport({ raw: JSON.stringify(old), currentState: state, catalog: stageCatalog, mode: "replace", now: stageNow });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(read(result.value.nextState)).toMatchObject({ ready: false, nonRetestReady: false });
        expect(result.value.nextState.stageCheckpoints[imageStage.id].cycles).toEqual({});
      }
    }
  });
  it("failed persistence cannot leave criterion confirmed without its cycle transaction", async () => {
    const state = confirm(edit(stageReadyInput()));
    const prepared = edit(state, second.id);
    const adapter = { load: async () => ({ ok: true as const, value: createPersistedEnvelope(prepared, "test", 1, stageTime) }), save: async () => { throw new Error("disk unavailable"); }, saveRecovery: async () => "recovery", saveRawRecovery: async () => "recovery", clear: async () => {} };
    const store = createLearningStore({ catalog: stageCatalog, adapter, contentVersion: "test", now: () => stageNow });
    await store.getState().hydrate();
    const before = structuredClone(store.getState().learningState);
    expect((await store.getState().mutateStage(imageStage.id, second.id, { kind: "confirm", confirmed: true })).ok).toBe(false);
    expect(store.getState().learningState).toEqual(before);
    expect(store.getState().learningState.stageCheckpoints[imageStage.id].cycles).toEqual({});
  });
});
