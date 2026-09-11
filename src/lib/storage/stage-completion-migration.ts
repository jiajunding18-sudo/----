import { learningStateV3Schema, learningStateV4Schema } from "../validation/progress-schemas";
export function migrateLearningStateV3ToV4(input:unknown) {
  const state=learningStateV3Schema.parse(input);
  return learningStateV4Schema.parse({...state,schemaVersion:4,stageCheckpoints:Object.fromEntries(Object.entries(state.stageCheckpoints).map(([id,p])=>{
    const {historicalCompletion,...rest}=p;
    return [id,{...rest,attempts:{},legacyV3Completions:historicalCompletion ? [historicalCompletion] : []}];
  }))});
}
