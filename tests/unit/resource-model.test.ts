import { describe, expect, it } from "vitest";

import {
  getResourceHref,
  getResourceSlug,
} from "@/features/resources";
import {
  getConceptResourceGuidance,
  getProjectResourceGuidance,
  getResourceCatalogView,
  getResourceCatalogItemBySlug,
  getResourceSlugs,
} from "@/lib/content/site-content";

describe("正式 Resource 派生模型", () => {
  it("完整保留 15 个 catalog Resource 及学习指导字段", () => {
    const view = getResourceCatalogView();

    expect(view.resources).toHaveLength(15);
    expect(
      view.resources.every(
        ({ concepts, projects, resource }) =>
          resource.authorOrOrganization !== undefined &&
          resource.reason.length > 0 &&
          (resource.recommendedParts?.length ?? 0) > 0 &&
          concepts.length + projects.length > 0,
      ),
    ).toBe(true);
    expect(view.resources.map(({ resource }) => resource.id)).toEqual(
      expect.arrayContaining([
        "resource.python-tutorial",
        "resource.python-pathlib",
        "resource.python-venv",
        "resource.opencv-python-tutorials",
        "resource.pro-git",
        "resource.ubuntu-command-line",
        "resource.npm-package-lock",
        "resource.github-readme",
        "resource.mit-ocw-linear-algebra",
        "resource.mit-ocw-multivariable-calculus",
        "resource.mit-ocw-probability-statistics",
        "resource.numpy-linear-algebra",
        "resource.stanford-cs231n-optimization",
        "resource.numpy-absolute-beginners",
        "resource.matplotlib-image-tutorial",
      ]),
    );
  });

  it("从 Concept / Project 单向关系反推 Stage、Track 与关联实体", () => {
    const view = getResourceCatalogView();
    const pythonTutorial = view.resources.find(
      ({ resource }) => resource.id === "resource.python-tutorial",
    );
    const pythonVenv = view.resources.find(
      ({ resource }) => resource.id === "resource.python-venv",
    );
    const numpyBeginners = view.resources.find(
      ({ resource }) => resource.id === "resource.numpy-absolute-beginners",
    );
    const opencvTutorials = view.resources.find(
      ({ resource }) => resource.id === "resource.opencv-python-tutorials",
    );

    expect(view.stages.map(({ id }) => id)).toEqual([
      "stage.tooling-foundations",
      "stage.vision-math-immediate",
      "stage.vision-math-geometry-optimization",
      "stage.image-computing",
    ]);
    expect(view.tracks.map(({ id }) => id)).toEqual(["track.common"]);
    expect(pythonTutorial?.concepts.map(({ concept }) => concept.id)).toEqual(
      expect.arrayContaining([
        "tooling.dev-environment",
        "tooling.python-core",
        "tooling.python-modules",
        "tooling.debugging",
      ]),
    );
    expect(pythonVenv?.projects.map(({ project }) => project.id)).toEqual([
      "project.pixel-lab",
    ]);
    expect(numpyBeginners?.concepts.map(({ concept }) => concept.id)).toContain(
      "opencv.roi-masks",
    );
    expect(opencvTutorials?.concepts.map(({ concept }) => concept.id)).toContain(
      "opencv.roi-masks",
    );
  });

  it("从不可变 Resource ID 唯一派生 15 个站内详情路由", () => {
    const view = getResourceCatalogView();
    const slugs = getResourceSlugs();

    expect(slugs).toHaveLength(15);
    expect(new Set(slugs.map(({ slug }) => slug)).size).toBe(15);
    expect(view.resources.every(({ href }) => href.startsWith("/resources/"))).toBe(
      true,
    );
    expect(getResourceSlug("resource.python-tutorial")).toBe("python-tutorial");
    expect(getResourceHref("resource.python-tutorial")).toBe(
      "/resources/python-tutorial/",
    );
    expect(
      getResourceCatalogItemBySlug("python-tutorial")?.resource.id,
    ).toBe("resource.python-tutorial");
    expect(getResourceCatalogItemBySlug("not-a-resource")).toBeUndefined();
    expect(() => getResourceSlug("resource.Invalid Slug")).toThrow(
      /resource\.<kebab-case>/u,
    );
  });

  it("Concept 推荐顺序和 Project 角色保持各自正式作者输入", () => {
    const debugging = getConceptResourceGuidance("tooling.debugging");
    const pixelLab = getProjectResourceGuidance("project.pixel-lab");

    expect(
      debugging.map(({ item, relation }) => ({
        id: item.resource.id,
        order:
          relation.kind === "concept"
            ? relation.recommendationOrder
            : undefined,
      })),
    ).toEqual([
      { id: "resource.python-tutorial", order: 1 },
      { id: "resource.opencv-python-tutorials", order: 2 },
    ]);
    expect(pixelLab).toHaveLength(4);
    expect(
      pixelLab.every(
        ({ relation }) =>
          relation.kind === "project" && relation.reference.required,
      ),
    ).toBe(true);
    expect(
      pixelLab
        .filter(({ relation }) => relation.kind === "project")
        .map(({ relation }) =>
          relation.kind === "project" ? relation.reference.role : undefined,
        ),
    ).toEqual(["documentation", "documentation", "reference", "documentation"]);
  });
});
