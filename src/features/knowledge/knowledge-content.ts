import { contentManifest } from "../../../.generated/content-manifest";

import {
  buildGlobalKnowledgeGraphCatalog,
  buildKnowledgeNeighborhood,
} from "./knowledge-graph-model";
import { buildKnowledgeView } from "./knowledge-model";

export function getKnowledgeView() {
  return buildKnowledgeView(contentManifest);
}

export function readKnowledgeView() {
  try {
    return { status: "ready", value: getKnowledgeView() } as const;
  } catch (error) {
    return { error, status: "error" } as const;
  }
}

export function getKnowledgeConceptView(conceptId: string) {
  return getKnowledgeView().concepts.find(
    ({ concept }) => concept.id === conceptId,
  );
}

export function getKnowledgeNeighborhood(conceptId: string) {
  return buildKnowledgeNeighborhood(contentManifest, conceptId);
}

export function getGlobalKnowledgeGraphCatalog() {
  return buildGlobalKnowledgeGraphCatalog(contentManifest);
}
