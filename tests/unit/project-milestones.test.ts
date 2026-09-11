import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { activeMilestoneProject, historyTime, legacyEnvelope, milestone0, milestone2, oldPixelRecord, pixelLab } from "../fixtures/project-milestones";
import { migratePersistedEnvelope } from "@/lib/storage/migrations";
import { createInitialLearningState, createPersistedEnvelope, LocalStorageLearningStateAdapter, LEARNING_STATE_STORAGE_KEY, mergeLearningStates } from "@/lib/storage";
import { getMilestoneCompletionEligibility, getMilestoneReadiness, isProjectGateCompleted } from "@/features/projects/project-milestones";
import { mutateProjectMilestone, type MilestoneAction } from "@/features/projects/project-milestone-progress";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { getNextStep } from "@/features/recommendations/next-step";
import { getProgressCatalog } from "@/lib/content/site-content";
import { inspectLearningStateAgainstCatalog } from "@/features/progress/progress-domain";
import { createLearningStore } from "@/features/progress/learning-store";
import { projectMetaSchema } from "@/lib/validation/content-schemas";
import { learningStateV4Schema } from "@/lib/validation/progress-schemas";
import { plannedMilestoneProject } from "../fixtures/project-milestones";

function migrated() {
  const result = migratePersistedEnvelope(legacyEnvelope());
  if (!result.ok) throw new Error(result.message);
  return result.value;
}
function stateForGate() {
  const state = migrated().payload;
  for (const concept of contentManifest.concepts.filter(({ stageId }) => stageId === "stage.image-computing")) {
    const ids = concept.masteryCriteria.map(({ id }) => id);
    const evidenceId = `evidence.${concept.id}.test`;
    state.conceptProgress[concept.id] = {
      status: "mastered", note: "", favorite: false, updatedAt: historyTime, startedAt: historyTime, understoodAt: historyTime, firstMasteredAt: historyTime, lastMasteredAt: historyTime,
      evidence: [{ id: evidenceId, conceptId: concept.id, criterionIds: ids, kind: "exercise", title: "fixture evidence", note: "test", result: "passed", completedAt: historyTime, createdAt: historyTime, updatedAt: historyTime }],
      masteryConfirmation: { confirmedAt: historyTime, criterionIds: ids, evidenceIds: [evidenceId], statementVersion: 1 },
    };
  }
  return learningStateV4Schema.parse(state);
}
const stage = contentManifest.stages.find(({ id }) => id === "stage.image-computing")!;
function readiness(state = stateForGate(), project = pixelLab) {
  return getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, [project], contentManifest.tracks, state);
}

describe("Phase 9E-A1 milestone contract and migration", () => {
  it.each(["completed", "in_progress", "not_started"] as const)("migrates %s without rewriting history", (status) => {
    const original = legacyEnvelope(status);
    const result = migratePersistedEnvelope(original);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.value.payload.projectProgress[pixelLab.id];
    expect(record.milestones?.[milestone0]).toEqual(original.payload.projectProgress[pixelLab.id]);
    expect(record.milestones?.[milestone2]).toBeUndefined();
    expect(result.value.savedAt).toBe(historyTime);
    expect(migratePersistedEnvelope(result.value)).toEqual(result);
  });
  it("untouched and unrelated project records survive", () => {
    const old = legacyEnvelope();
    const unrelated = oldPixelRecord("in_progress");
    const input = { ...old, payload: { ...old.payload, projectProgress: { "project.unrelated": unrelated } } };
    const result = migratePersistedEnvelope(input);
    expect(result.ok && result.value.payload.projectProgress).toEqual({ "project.unrelated": unrelated });
  });
  it("unknown acceptance, malformed confirmation and future schema are rejected", () => {
    const old = legacyEnvelope();
    old.payload.projectProgress[pixelLab.id].acceptance["acceptance.unknown"] = true;
    expect(migratePersistedEnvelope(old).ok).toBe(false);
    const malformed = legacyEnvelope();
    malformed.payload.projectProgress[pixelLab.id].completionConfirmation!.deliverableIds = ["deliverable.missing"];
    expect(migratePersistedEnvelope(malformed).ok).toBe(false);
    expect(migratePersistedEnvelope({ ...old, schemaVersion: 99 }).ok).toBe(false);
  });
  it("CASE 1: full Stage 2 Concept targets cannot reuse Stage 0 completion", () => {
    const result = readiness();
    expect(result.unmetMasterConceptIds).toEqual([]);
    expect(result.unmetUnderstandConceptIds).toEqual([]);
    expect(result.incompleteProjectIds).toEqual([pixelLab.id]);
    expect(result.ready).toBe(false);
  });
  it("planned contract is neither ready nor completable, even with forged completed progress", () => {
    const pixelLab = plannedMilestoneProject();
    const state = stateForGate();
    state.projectProgress[pixelLab.id].milestones![milestone2] = oldPixelRecord();
    expect(getMilestoneReadiness(pixelLab, state, milestone2).contractPublished).toBe(false);
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2).eligible).toBe(false);
    expect(isProjectGateCompleted(pixelLab, state, milestone2)).toBe(false);
    expect(inspectLearningStateAgainstCatalog(state, { ...getProgressCatalog(), projects: [pixelLab] }).errors.join()).toContain("未发布契约");
    expect(mutateProjectMilestone(pixelLab, state, milestone2, { kind: "complete", confirmed: true }, historyTime).ok).toBe(false);
  });
  it("CASE 2: independently finish future published contract; history does not freeze it", () => {
    const project = activeMilestoneProject();
    const state = stateForGate();
    const beforeConcepts = structuredClone(state.conceptProgress);
    const original = structuredClone(state.projectProgress[project.id]);
    const run = (action: MilestoneAction) => {
      const result = mutateProjectMilestone(project, state, milestone2, action, "2026-09-08T00:00:00.000Z");
      expect(result.ok).toBe(true);
      if (result.ok) state.projectProgress[project.id] = result.progress;
    };
    run({ kind: "start", input: { selectedExecutionPathId: project.executionPaths[0].id, nextAction: "test increment", environmentChecks: {}, confirmPrerequisiteOverride: false } });
    expect(getMilestoneCompletionEligibility(project, state, milestone2).eligible).toBe(false);
    run({ kind: "acceptance", id: "acceptance.fixture.increment", checked: true });
    run({ kind: "add-deliverable", input: { id: "deliverable.increment", title: "test evidence" } });
    expect(mutateProjectMilestone(project, state, milestone2, { kind: "complete", confirmed: false }, historyTime).ok).toBe(false);
    run({ kind: "complete", confirmed: true });
    expect(readiness(state, project).incompleteProjectIds).toEqual([]);
    expect(state.projectProgress[project.id].milestones![milestone0]).toEqual(original.milestones![milestone0]);
    expect(state.projectProgress[project.id].completedAt).toBe(original.completedAt);
    expect(state.conceptProgress).toEqual(beforeConcepts);
  });
  it("CASE 3: legacy gate still reads legacy completion", () => {
    const project = { ...pixelLab, milestones: undefined };
    expect(isProjectGateCompleted(project, migrated().payload)).toBe(true);
    const legacyStage = { ...stage, projectGates: [{ projectId: project.id, when: { kind: "always" as const } }] };
    expect(getStageReadiness(legacyStage, [legacyStage], [], [project], contentManifest.tracks, migrated().payload).incompleteProjectIds).toEqual([]);
  });
  it("CASE 4/5: only the selected milestone's hard requirements block readiness", () => {
    const project = activeMilestoneProject();
    const state = migrated().payload;
    expect(getMilestoneReadiness(project, state, milestone2).knowledgeReady).toBe(false);
    state.conceptProgress["python.numpy-arrays"] = { status: "understood", note: "", favorite: false, updatedAt: historyTime, evidence: [] };
    expect(getMilestoneReadiness(project, state, milestone2).knowledgeReady).toBe(true);
    expect(getMilestoneReadiness(project, state, milestone2).missingRecommendedConceptIds).toEqual(["visualization.image-plots"]);
  });
  it("schema rejects duplicate milestones and empty executable contracts", () => {
    expect(projectMetaSchema.safeParse(pixelLab).success).toBe(true);
    expect(projectMetaSchema.safeParse({ ...pixelLab, milestones: [pixelLab.milestones![0], pixelLab.milestones![0]] }).success).toBe(false);
    const project = activeMilestoneProject();
    const contract = project.milestones![1].contract;
    if (contract.kind === "inline") contract.definition.acceptanceCriteria = [];
    expect(projectMetaSchema.safeParse(project).success).toBe(false);
  });
  it("NextStep does not hide pending milestone behind historical completed", () => {
    const state = stateForGate();
    state.preferences.activeStageId = stage.id;
    const catalog = { ...contentManifest, concepts: contentManifest.concepts.filter(({ stageId }) => stageId === stage.id), projects: [pixelLab] };
    expect(getNextStep({ catalog, state })).toMatchObject({ kind: "project-milestone", milestoneId: milestone2, contractPublished: true });
    const project = activeMilestoneProject();
    state.conceptProgress["python.numpy-arrays"].status = "not_started";
    for (const prerequisite of ["tooling.dev-environment", "tooling.python-core", "math.vectors-matrices"]) {
      state.conceptProgress[prerequisite] = { status: "understood", note: "", favorite: false, updatedAt: historyTime, evidence: [] };
    }
    expect(getNextStep({ catalog: { ...contentManifest, projects: [project] }, state })).toMatchObject({ kind: "recommendation", targetId: "python.numpy-arrays", reasonCode: "next-unlocked" }); // Current checkpoint target precedes its project task.
  });
  it("migration → persist → hydrate is idempotent and backs up original bytes", async () => {
    const data = new Map<string, string>([[LEARNING_STATE_STORAGE_KEY, JSON.stringify(legacyEnvelope())]]);
    const raw = data.get(LEARNING_STATE_STORAGE_KEY);
    const adapter = new LocalStorageLearningStateAdapter(() => ({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } }));
    const store = createLearningStore({ catalog: getProgressCatalog(), contentVersion: "test", adapter });
    await store.getState().hydrate();
    expect(store.getState().persistenceStatus).toBe("ready");
    expect([...data.entries()].some(([key, value]) => key.startsWith("mv-learning-os:recovery:") && value === raw)).toBe(true);
    const state = store.getState().learningState;
    await adapter.save(createPersistedEnvelope(state, "test", 4, historyTime));
    const again = createLearningStore({ catalog: getProgressCatalog(), contentVersion: "test", adapter });
    await again.getState().hydrate();
    expect(again.getState().learningState).toEqual(state);
    expect(mergeLearningStates(state, migrated().payload)).toEqual(state);
  });
  it("fresh state is v2 and contains no invented milestone completion", () => {
    expect(createInitialLearningState(contentManifest.tracks, historyTime).projectProgress).toEqual({});
  });
});
