import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import {
  buildProjectCatalogView,
  getNextProjects,
  getProjectsForConcept,
  getProjectKnowledgeReadiness,
} from "@/features/projects";
import type { ConceptProgress } from "@/types";

function understoodProgress(conceptIds: readonly string[]) {
  return Object.fromEntries(
    conceptIds.map((conceptId) => [
      conceptId,
      {
        status: "understood",
        note: "",
        favorite: false,
        updatedAt: "2026-08-29T00:00:00.000Z",
        evidence: [],
      } satisfies ConceptProgress,
    ]),
  );
}

describe("Phase 5A Project 能力目录", () => {
  it("从 manifest 建立 13 项目录并保持 published/draft 边界", () => {
    const catalog = buildProjectCatalogView(contentManifest);

    expect(catalog.projects).toHaveLength(13);
    expect(catalog.publishedCount).toBe(1);
    expect(catalog.draftCount).toBe(12);
    expect(
      catalog.projects.every(
        ({ project }) =>
          project.problemStatement.length > 0 &&
          project.capabilitySummary.length > 0 &&
          project.realWorldApplications.length > 0,
      ),
    ).toBe(true);

    const pixelLab = catalog.projects.find(
      ({ project }) => project.id === "project.pixel-lab",
    );
    expect(pixelLab?.href).toBe("/projects/pixel-lab/");
    expect(pixelLab?.stages.map(({ id }) => id)).toEqual([
      "stage.tooling-foundations",
      "stage.image-computing",
    ]);

    const planned = catalog.projects.find(
      ({ project }) => project.id === "project.classical-inspection",
    );
    expect(planned?.href).toBe("/projects/#project-classical-inspection");
    expect(planned?.project.conceptRequirements).toEqual([]);
  });

  it("只从 Project requirements 反向派生 Concept 使用关系", () => {
    const usage = getProjectsForConcept(
      contentManifest,
      "tooling.computer-files",
    );

    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      project: { id: "project.pixel-lab" },
      requirement: {
        kind: "hard",
        minimumStatus: "understood",
      },
    });
    expect(
      getProjectsForConcept(contentManifest, "concept.not-in-catalog"),
    ).toEqual([]);
  });

  it("readiness 复用 requirement minimumStatus，recommended 不阻塞开始", () => {
    const project = contentManifest.projects.find(
      ({ id }) => id === "project.pixel-lab",
    );
    if (!project) throw new Error("测试需要 Pixel Lab");

    const fiveSatisfied = project.conceptRequirements
      .filter(({ kind }) => kind === "hard")
      .slice(0, 5)
      .map(({ conceptId }) => conceptId);
    const partial = getProjectKnowledgeReadiness(
      project,
      understoodProgress(fiveSatisfied),
    );
    expect(partial).toMatchObject({
      ready: false,
      total: 8,
      satisfiedCount: 5,
    });
    expect(partial.missingHard).toHaveLength(2);
    expect(partial.missingRecommended).toHaveLength(1);

    const allHardSatisfied = project.conceptRequirements
      .filter(({ kind }) => kind === "hard")
      .map(({ conceptId }) => conceptId);
    const ready = getProjectKnowledgeReadiness(
      project,
      understoodProgress(allHardSatisfied),
    );
    expect(ready.ready).toBe(true);
    expect(ready.missingHard).toEqual([]);
    expect(ready.missingRecommended).toHaveLength(1);
  });

  it("Next Projects 只沿后续 Stage projectGates 派生", () => {
    expect(getNextProjects(contentManifest, "project.pixel-lab")).toEqual([
      expect.objectContaining({
        project: expect.objectContaining({
          id: "project.classical-inspection",
          publicationStatus: "draft",
        }),
        stage: expect.objectContaining({ id: "stage.digital-image-processing" }),
        href: "/projects/#project-classical-inspection",
      }),
    ]);
  });
});
