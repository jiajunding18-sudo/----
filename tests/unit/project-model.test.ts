import { describe, expect, it } from "vitest";

import { contentManifest } from "../../.generated/content-manifest";
import {
  buildProjectCatalogView,
  getNextProjects,
  getProjectsForConcept,
  getProjectCompletionEligibility,
  getProjectKnowledgeReadiness,
  getProjectReadiness,
} from "@/features/projects";
import {
  createInitialLearningState,
} from "@/lib/storage";
import { getProgressCatalog } from "@/lib/content/site-content";
import type { ConceptProgress, ProjectProgress } from "@/types";

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
    expect(catalog.publishedCount).toBe(2);
    expect(catalog.draftCount).toBe(11);
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

    const classical = catalog.projects.find(
      ({ project }) => project.id === "project.classical-inspection",
    );
    expect(classical?.href).toBe("/projects/classical-inspection/");
    expect(classical?.project.conceptRequirements).toHaveLength(7);
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

  it("Knowledge 与 Environment readiness 分离，并按执行路径隔离必需环境", () => {
    const project = contentManifest.projects.find(
      ({ id }) => id === "project.pixel-lab",
    );
    if (!project) throw new Error("测试需要 Pixel Lab");
    const state = createInitialLearningState(
      getProgressCatalog().tracks,
      "2026-08-29T00:00:00.000Z",
    );

    expect(getProjectReadiness(project, state)).toMatchObject({
      knowledgeReady: false,
      environmentReady: null,
      missingHardConceptIds: expect.arrayContaining([
        "tooling.computer-files",
        "tooling.reproducibility",
      ]),
      missingRecommendedConceptIds: ["tooling.linux-basics"],
      pathReadiness: [
        {
          pathId: "execution.pixel-lab.phone-photo",
          ready: false,
          missingEnvironmentRequirementIds: [
            "environment.pixel-lab.python",
            "environment.pixel-lab.opencv",
          ],
        },
        {
          pathId: "execution.pixel-lab.generated-image",
          ready: false,
          missingEnvironmentRequirementIds: [
            "environment.pixel-lab.python",
            "environment.pixel-lab.opencv",
          ],
        },
      ],
    });

    const inProgress: ProjectProgress = {
      status: "in_progress",
      note: "",
      nextAction: "安装 OpenCV",
      selectedExecutionPathId: "execution.pixel-lab.phone-photo",
      environmentChecks: {
        "environment.pixel-lab.python": true,
        "environment.pixel-lab.phone-camera": false,
      },
      acceptance: {},
      deliverables: [],
      unverifiedAssumptions: [],
      startedAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    };
    const selected = getProjectReadiness(project, {
      ...state,
      projectProgress: { [project.id]: inProgress },
    });
    expect(selected).toMatchObject({
      environmentReady: false,
      selectedExecutionPathId: "execution.pixel-lab.phone-photo",
      missingEnvironmentRequirementIds: ["environment.pixel-lab.opencv"],
    });
    expect(selected.missingEnvironmentRequirementIds).not.toContain(
      "environment.pixel-lab.phone-camera",
    );
  });

  it("完成资格只由 required acceptance、交付物和已开始状态决定", () => {
    const project = contentManifest.projects.find(
      ({ id }) => id === "project.pixel-lab",
    );
    if (!project) throw new Error("测试需要 Pixel Lab");
    const base: ProjectProgress = {
      status: "in_progress",
      note: "",
      nextAction: "完成验收",
      selectedExecutionPathId: "execution.pixel-lab.generated-image",
      environmentChecks: {},
      acceptance: {},
      deliverables: [],
      unverifiedAssumptions: [],
      startedAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    };

    expect(getProjectCompletionEligibility(project, undefined)).toMatchObject({
      eligible: false,
      hasDeliverable: false,
      missingAcceptanceCriterionIds: expect.arrayContaining([
        "acceptance.pixel-lab.environment-rebuild",
        "acceptance.pixel-lab.reproducible-readme",
      ]),
    });
    const acceptance = Object.fromEntries(
      project.acceptanceCriteria.map(({ id }) => [id, true]),
    );
    expect(
      getProjectCompletionEligibility(project, {
        ...base,
        acceptance,
        deliverables: [
          {
            id: "deliverable.pixel-lab.result",
            title: "Pixel Lab 项目结果",
            createdAt: "2026-08-29T00:00:00.000Z",
            updatedAt: "2026-08-29T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      eligible: true,
      hasDeliverable: true,
      missingAcceptanceCriterionIds: [],
    });
  });

  it("Next Projects 只沿后续 Stage projectGates 派生", () => {
    expect(getNextProjects(contentManifest, "project.pixel-lab")).toEqual([
      expect.objectContaining({
        project: expect.objectContaining({
          id: "project.classical-inspection",
          publicationStatus: "published",
        }),
        stage: expect.objectContaining({ id: "stage.digital-image-processing" }),
        href: "/projects/classical-inspection/",
      }),
    ]);
  });
});
