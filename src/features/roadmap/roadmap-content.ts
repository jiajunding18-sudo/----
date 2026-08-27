import { contentManifest } from "../../../.generated/content-manifest";

import { buildRoadmapView } from "./roadmap-model";

export function readRoadmapView() {
  try {
    return {
      status: "ready",
      value: buildRoadmapView(contentManifest),
    } as const;
  } catch (error) {
    return { error, status: "error" } as const;
  }
}
