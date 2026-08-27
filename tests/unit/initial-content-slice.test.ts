import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadMdxDirectory,
  loadRepositoryContentManifest,
} from "@/lib/content";
import { conceptMetaSchema } from "@/lib/validation";

const conceptIds = [
  "tooling.computer-files",
  "tooling.dev-environment",
  "tooling.python-core",
  "tooling.python-modules",
  "tooling.debugging",
] as const;
const conceptIdSet = new Set<string>(conceptIds);

const resourceIds = [
  "resource.python-tutorial",
  "resource.python-pathlib",
  "resource.python-venv",
  "resource.opencv-python-tutorials",
] as const;

const requiredSectionHeadings = [
  "## 1. 这是什么",
  "## 2. 为什么机器视觉需要它",
  "## 3. 前置知识",
  "## 4. 核心概念",
  "## 5. 初学者直觉解释",
  "## 6. 必须掌握到什么程度",
  "## 7. 常见误区",
  "## 8. Worked Example",
  "## 9. Active Recall",
  "## 10. Practice",
  "## 11. 实际使用",
  "## 12. Mastery Evidence",
  "## 13. 后续复用与复习",
  "## 14. 精选学习资源",
] as const;

describe("第一批真实学习内容切片", () => {
  it("在 manifest 中保留规划的实体与有向依赖", async () => {
    const manifest = await loadRepositoryContentManifest();

    expect(manifest.tracks.some(({ id }) => id === "track.common")).toBe(true);
    expect(
      manifest.stages.some(({ id }) => id === "stage.tooling-foundations"),
    ).toBe(true);
    expect(manifest.projects.some(({ id }) => id === "project.pixel-lab")).toBe(
      true,
    );
    resourceIds.forEach((resourceId) => {
      expect(
        manifest.resources.find(({ id }) => id === resourceId)?.verification,
      ).toBe("verified");
    });

    const actualConceptIds = new Set(manifest.concepts.map(({ id }) => id));
    conceptIds.forEach((conceptId) => expect(actualConceptIds.has(conceptId)).toBe(true));

    expect(manifest.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prerequisiteId: "tooling.computer-files",
          targetId: "tooling.dev-environment",
          kind: "hard",
        }),
        expect.objectContaining({
          prerequisiteId: "tooling.python-core",
          targetId: "tooling.python-modules",
          kind: "hard",
        }),
        expect.objectContaining({
          prerequisiteId: "tooling.python-core",
          targetId: "tooling.debugging",
          kind: "hard",
        }),
      ]),
    );
  });

  it("每个 Concept 正文都包含完整学习闭环", async () => {
    const workspaceRoot = process.cwd();
    const concepts = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts"),
      workspaceRoot,
      schema: conceptMetaSchema,
    });
    const initialSlice = concepts.filter(({ meta }) =>
      conceptIdSet.has(meta.id),
    );

    expect(initialSlice).toHaveLength(conceptIds.length);
    initialSlice.forEach(({ body, meta }) => {
      requiredSectionHeadings.forEach((heading) => {
        expect(body, `${meta.id} 缺少 ${heading}`).toContain(heading);
      });
    });
  });

  it("Pixel Lab 关联全部五个 Concept、两条替代路径和必需证据", async () => {
    const manifest = await loadRepositoryContentManifest();
    const project = manifest.projects.find(({ id }) => id === "project.pixel-lab");

    expect(project).toBeDefined();
    expect(project?.conceptRequirements.map(({ conceptId }) => conceptId)).toEqual(
      conceptIds,
    );
    expect(project?.executionPaths.map(({ mode }) => mode)).toEqual([
      "consumer-hardware",
      "simulation",
    ]);
    expect(project?.acceptanceCriteria.every(({ required }) => required)).toBe(
      true,
    );
    expect(project?.evidenceConceptIds).toEqual(conceptIds);
  });
});
