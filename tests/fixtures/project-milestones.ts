import { contentManifest } from "../../.generated/content-manifest";
import { createInitialLearningState } from "../../src/lib/storage/learning-state";
import type { ProjectProgress, ProjectMeta } from "../../src/types";
import { projectMetaSchema } from "../../src/lib/validation/content-schemas";

export const historyTime = "2026-08-29T00:00:00.000Z";
export const milestone0 = "milestone.pixel-lab.tooling-foundations";
export const milestone2 = "milestone.pixel-lab.image-computing";
const pixel = contentManifest.projects.find(({ id }) => id === "project.pixel-lab");
if (!pixel) throw new Error("Pixel Lab missing");
export const pixelLab: ProjectMeta = projectMetaSchema.parse(Object.fromEntries(Object.entries(pixel).filter(([key]) => key !== "sourcePath")));

export function oldPixelRecord(status: ProjectProgress["status"] = "completed"): ProjectProgress {
  const acceptanceIds = pixelLab.acceptanceCriteria.map(({ id }) => id);
  return {
    status, note: "Stage 0 history", environmentChecks: {},
    selectedExecutionPathId: "execution.pixel-lab.generated-image",
    nextAction: status === "in_progress" ? "继续 Stage 0 复现" : undefined,
    acceptance: Object.fromEntries(acceptanceIds.map((id) => [id, status === "completed"])),
    deliverables: [{ id: "deliverable.history", title: "原始交付物", reference: "evidence/readme.md", createdAt: historyTime, updatedAt: historyTime }],
    unverifiedAssumptions: [], startedAt: status === "not_started" ? undefined : historyTime,
    completedAt: status === "completed" ? historyTime : undefined, updatedAt: historyTime,
    completionConfirmation: status === "completed" ? { confirmedAt: historyTime, acceptanceCriterionIds: acceptanceIds, deliverableIds: ["deliverable.history"] } : undefined,
  };
}

export function legacyEnvelope(status: ProjectProgress["status"] = "completed") {
  const state = createInitialLearningState(contentManifest.tracks, historyTime);
  const projectProgress: Record<string, ProjectProgress> = { "project.pixel-lab": oldPixelRecord(status) };
  return { app: "machine-vision-learning-os", schemaVersion: 1, contentVersion: "2026.08.29.1", revision: 3, savedAt: historyTime,
    payload: { ...state, schemaVersion: 1, projectProgress } };
}

// Test-only published future contract; never written to content/catalog or manifest.
export function activeMilestoneProject(): ProjectMeta {
  return { ...structuredClone(pixelLab), milestones: [pixelLab.milestones![0], {
    id: milestone2, title: "Test-only image computing increment", stageId: "stage.image-computing",
    contract: { kind: "inline", definition: {
      conceptRequirements: [
        { conceptId: "python.numpy-arrays", kind: "hard", minimumStatus: "understood", reason: "test required" },
        { conceptId: "visualization.image-plots", kind: "recommended", minimumStatus: "mastered", reason: "test advisory" },
      ],
      acceptanceCriteria: [{ id: "acceptance.fixture.increment", description: "test independent evidence", required: true }],
      deliverableRequirements: ["test artifact"], evidenceConceptIds: ["python.numpy-arrays"],
    } },
  }] };
}
