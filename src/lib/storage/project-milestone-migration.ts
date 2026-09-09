import { learningStateV1Schema, learningStateV2Schema } from "@/lib/validation/progress-schemas";

// Frozen v1 contract identities. Do not derive migration history from live MDX.
const acceptanceIds = ["environment-rebuild", "valid-image", "invalid-path", "git-checkpoint", "stage-zero-diagnostics", "runtime-explanation", "reproducible-readme"].map((id) => `acceptance.pixel-lab.${id}`);
const pathIds = ["execution.pixel-lab.phone-photo", "execution.pixel-lab.generated-image"];
const environmentIds = ["environment.pixel-lab.python", "environment.pixel-lab.opencv", "environment.pixel-lab.phone-camera"];

export function migrateLearningStateV1ToV2(input: unknown) {
  const state = learningStateV1Schema.parse(input);
  const legacy = state.projectProgress["project.pixel-lab"];
  if (!legacy) return learningStateV2Schema.parse({ ...state, schemaVersion: 2 });
  const fail = () => { throw new Error("无法确认旧 Pixel Lab 属于已知 Stage 0 contract；原始记录须恢复核对。"); };
  if (Object.keys(legacy.acceptance).some((id) => !acceptanceIds.includes(id)) ||
      Object.keys(legacy.environmentChecks).some((id) => !environmentIds.includes(id)) ||
      (legacy.selectedExecutionPathId !== undefined && !pathIds.includes(legacy.selectedExecutionPathId))) fail();
  const deliverableIds = legacy.deliverables.map(({ id }) => id);
  if (new Set(deliverableIds).size !== deliverableIds.length) fail();
  const confirmation = legacy.completionConfirmation;
  if (confirmation) {
    if (new Set(confirmation.acceptanceCriterionIds).size !== confirmation.acceptanceCriterionIds.length ||
        new Set(confirmation.deliverableIds).size !== confirmation.deliverableIds.length ||
        confirmation.acceptanceCriterionIds.some((id) => !acceptanceIds.includes(id) || legacy.acceptance[id] !== true) ||
        confirmation.deliverableIds.some((id) => !deliverableIds.includes(id))) fail();
  }
  if (legacy.status === "completed" && (!confirmation || !deliverableIds.length || !confirmation.deliverableIds.length ||
      acceptanceIds.some((id) => legacy.acceptance[id] !== true || !confirmation.acceptanceCriterionIds.includes(id)))) fail();
  return learningStateV2Schema.parse({
    ...state, schemaVersion: 2,
    projectProgress: { ...state.projectProgress, "project.pixel-lab": {
      ...legacy,
      milestones: { "milestone.pixel-lab.tooling-foundations": legacy },
    } },
  });
}
