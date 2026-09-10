import { learningStateV2Schema, learningStateV3Schema } from "@/lib/validation/progress-schemas";

/** v2 IDs/times are unverified history, never new confirmation or qualification. */
export function migrateLearningStateV2ToV3(input: unknown) {
  const state = learningStateV2Schema.parse(input);
  return learningStateV3Schema.parse({
    ...state, schemaVersion: 3,
    stageCheckpoints: Object.fromEntries(Object.entries(state.stageCheckpoints).map(([id, checkpoint]) => [id, {
      criteria: {}, cycles: {}, legacy: [{ provenance: "v2-needs-review", checkpoint }], updatedAt: checkpoint.updatedAt,
    }])),
  });
}
