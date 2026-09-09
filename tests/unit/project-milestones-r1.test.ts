import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { activeMilestoneProject, historyTime, legacyEnvelope, milestone0, milestone2, oldPixelRecord, pixelLab } from "../fixtures/project-milestones";
import { areAllProjectMilestonesCompleted, getProjectAggregateStatus, isProjectGateCompleted } from "@/features/projects/project-milestones";
import { mutateProjectMilestone, type MilestoneAction } from "@/features/projects/project-milestone-progress";
import { getNextStep } from "@/features/recommendations/next-step";
import { createLearningStore } from "@/features/progress/learning-store";
import { getProgressCatalog } from "@/lib/content/site-content";
import { migratePersistedEnvelope } from "@/lib/storage/migrations";
import { LocalStorageLearningStateAdapter, LEARNING_STATE_STORAGE_KEY } from "@/lib/storage";
import { plannedMilestoneProject } from "../fixtures/project-milestones";

function migrated() {
  const result = migratePersistedEnvelope(legacyEnvelope());
  if (!result.ok) throw new Error(result.message);
  return result.value.payload;
}

function storage(raw = JSON.stringify(legacyEnvelope()), failWrites = false) {
  const data = new Map([[LEARNING_STATE_STORAGE_KEY, raw]]);
  const adapter = new LocalStorageLearningStateAdapter(() => ({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error("quota fixture"); data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  }));
  const backups = () => [...data.entries()].filter(([key]) => key.startsWith("mv-learning-os:recovery:"));
  return { data, adapter, backups };
}

describe("Phase 9E-A1-R1 architecture regression probes", () => {
  it("legacy gate, scoped gate and aggregate remain independent (six cases)", () => {
    const state = migrated();
    const project = activeMilestoneProject();
    expect(isProjectGateCompleted(project, state)).toBe(true);
    expect(isProjectGateCompleted(project, state, milestone2)).toBe(false);
    expect(isProjectGateCompleted(project, state, milestone0)).toBe(true);
    expect(areAllProjectMilestonesCompleted(project, state)).toBe(false);
    expect(getProjectAggregateStatus(project, state)).toBe("in_progress");
    // A valid synthetic completion snapshot for the independent test contract.
    state.projectProgress[project.id].milestones![milestone2] = {
      ...oldPixelRecord(), acceptance: { "acceptance.fixture.increment": true },
      completionConfirmation: { confirmedAt: historyTime, acceptanceCriterionIds: ["acceptance.fixture.increment"], deliverableIds: ["deliverable.history"] },
    };
    expect(isProjectGateCompleted(project, state, milestone2)).toBe(true);
    expect(areAllProjectMilestonesCompleted(project, state)).toBe(true);
    expect(getProjectAggregateStatus(project, state)).toBe("completed");
    expect(isProjectGateCompleted({ ...project, milestones: undefined }, state)).toBe(true);
    state.projectProgress[project.id].status = "not_started";
    expect(isProjectGateCompleted(project, state)).toBe(false);
    expect(areAllProjectMilestonesCompleted(project, state)).toBe(true);
  });

  it.each([false, true])("scoped in_progress beats other project (other ready=%s)", (otherReady) => {
    const state = migrated();
    const project = activeMilestoneProject();
    for (const { id } of contentManifest.concepts) state.conceptProgress[id] = { status: "understood", note: "", favorite: false, updatedAt: historyTime, evidence: [] };
    delete state.conceptProgress["python.numpy-arrays"];
    delete state.conceptProgress["tooling.python-modules"];
    state.projectProgress[project.id].milestones![milestone2] = oldPixelRecord("in_progress");
    const other = { ...pixelLab, id: "project.other", milestones: undefined, conceptRequirements: otherReady ? [] : [{ conceptId: "tooling.python-modules", kind: "hard" as const, minimumStatus: "understood" as const, reason: "test" }] };
    const catalog = { ...contentManifest, projects: [project, other] };
    expect(getNextStep({ catalog, state })).toMatchObject({ targetId: "python.numpy-arrays", relatedProject: { projectId: project.id } });
    if (!otherReady) {
      // Completed or unpublished increments cannot retain execution priority.
      state.projectProgress[project.id].milestones![milestone2].status = "completed";
      expect(getNextStep({ catalog, state })).toMatchObject({ relatedProject: { projectId: other.id } });
      expect(getNextStep({ catalog: { ...catalog, projects: [plannedMilestoneProject(), other] }, state })).toMatchObject({ relatedProject: { projectId: other.id } });
    }
  });

  it.each([false, true])("repeated hydrate dedupes raw v1 (malformed=%s), without touching primary", async (malformed) => {
    const input = legacyEnvelope();
    if (malformed) input.payload.projectProgress[pixelLab.id].acceptance["acceptance.unknown"] = true;
    const raw = JSON.stringify(input);
    const { data, adapter, backups } = storage(raw);
    for (let count = 0; count < 3; count += 1) {
      const store = createLearningStore({ adapter, catalog: getProgressCatalog(), contentVersion: "test" });
      await store.getState().hydrate();
      expect(store.getState().persistenceStatus).toBe(malformed ? "blocked" : "ready");
    }
    expect(backups()).toHaveLength(1);
    expect(backups()[0][1]).toBe(raw);
    expect(data.get(LEARNING_STATE_STORAGE_KEY)).toBe(raw);
    input.payload.projectProgress[pixelLab.id].note = "different original bytes";
    const changed = JSON.stringify(input);
    data.set(LEARNING_STATE_STORAGE_KEY, changed);
    await adapter.load();
    expect(backups()).toHaveLength(2);
    expect(backups().map(([, value]) => value)).toEqual([raw, changed]);
    await adapter.saveRawRecovery(changed, historyTime); // same raw, different reason
    expect(backups()).toHaveLength(3);
    await adapter.saveRawRecovery(changed, "2026-09-09T00:00:00.000Z");
    expect(backups()).toHaveLength(3);
  });

  it("first recovery write failure blocks upgrade and mutations, retains v1", async () => {
    const raw = JSON.stringify(legacyEnvelope());
    const { data, adapter, backups } = storage(raw, true);
    const store = createLearningStore({ adapter, catalog: getProgressCatalog(), contentVersion: "test" });
    await store.getState().hydrate();
    expect(store.getState().persistenceStatus).toBe("blocked");
    expect(store.getState().rawRecoveryData).toBe(raw);
    expect((await store.getState().startConcept("tooling.computer-files")).ok).toBe(false);
    expect(backups()).toEqual([]);
    expect(data.get(LEARNING_STATE_STORAGE_KEY)).toBe(raw);
  });

  it("third milestone completes through store and survives persist/reload with earlier history intact", async () => {
    const project = activeMilestoneProject();
    const third = structuredClone(project.milestones![1]);
    third.id = "milestone.fixture.third";
    third.stageId = "stage.imaging-foundations";
    project.milestones!.push(third);
    const { adapter } = storage();
    const catalog = { ...getProgressCatalog(), projects: [project] };
    const store = createLearningStore({ adapter, catalog, contentVersion: "test", now: () => "2026-09-09T00:00:00.000Z" });
    await store.getState().hydrate();
    const history = structuredClone(store.getState().learningState.projectProgress[project.id]);
    const concepts = structuredClone(store.getState().learningState.conceptProgress);
    const actions: MilestoneAction[] = [
      { kind: "start", input: { selectedExecutionPathId: project.executionPaths[0].id, nextAction: "第三增量", environmentChecks: {}, confirmPrerequisiteOverride: true } },
      { kind: "acceptance", id: "acceptance.fixture.increment", checked: true },
      { kind: "add-deliverable", input: { id: "deliverable.third", title: "第三增量成果" } },
      { kind: "complete", confirmed: true },
    ];
    for (const action of actions) expect((await store.getState().mutateMilestone(project.id, third.id, action)).ok).toBe(true);
    const reload = createLearningStore({ adapter, catalog, contentVersion: "test" });
    await reload.getState().hydrate();
    expect(reload.getState().persistenceStatus).toBe("ready");
    const restored = reload.getState().learningState;
    expect(restored).toEqual(store.getState().learningState);
    expect(restored.projectProgress[project.id].milestones![third.id].status).toBe("completed");
    expect(restored.projectProgress[project.id].milestones![milestone0]).toEqual(history.milestones![milestone0]);
    expect(restored.projectProgress[project.id].milestones![milestone2]).toBeUndefined();
    expect(restored.conceptProgress).toEqual(concepts);
  });

  it("planned rejects every execution mutation at domain boundary", () => {
    const pixelLab = plannedMilestoneProject();
    const actions: MilestoneAction[] = [
      { kind: "start", input: { selectedExecutionPathId: pixelLab.executionPaths[0].id, nextAction: "test", environmentChecks: {}, confirmPrerequisiteOverride: true } },
      { kind: "acceptance", id: "acceptance.test", checked: true },
      { kind: "add-deliverable", input: { id: "deliverable.test", title: "test" } },
      { kind: "complete", confirmed: true },
    ];
    const state = migrated();
    const before = structuredClone(state);
    for (const action of actions) expect(mutateProjectMilestone(pixelLab, state, milestone2, action, historyTime).ok).toBe(false);
    expect(state).toEqual(before);
    expect(isProjectGateCompleted(pixelLab, state, milestone2)).toBe(false);
  });
});
