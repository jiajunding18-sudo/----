import { contentManifest } from "../../../.generated/content-manifest";

import {
  buildProjectCatalogView,
  getNextProjects,
  getProjectsForConcept,
} from "./project-model";

export function readProjectCatalogView() {
  try {
    return {
      status: "ready",
      value: buildProjectCatalogView(contentManifest),
    } as const;
  } catch (error) {
    return { error, status: "error" } as const;
  }
}

export function getProjectCatalogItem(projectId: string) {
  return buildProjectCatalogView(contentManifest).projects.find(
    ({ project }) => project.id === projectId,
  );
}

export function getConceptProjectUsage(conceptId: string) {
  return getProjectsForConcept(contentManifest, conceptId);
}

export function getProjectNextProjects(projectId: string) {
  return getNextProjects(contentManifest, projectId);
}

