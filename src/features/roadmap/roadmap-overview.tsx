import type { RoadmapView } from "./roadmap-model";
import { RoadmapRouteExplorer } from "./roadmap-route-explorer";

export function RoadmapOverview({ roadmap }: { readonly roadmap: RoadmapView }) {
  return <RoadmapRouteExplorer overview={roadmap.overview} />;
}
