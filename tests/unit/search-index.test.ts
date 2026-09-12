import { beforeAll, describe, expect, it } from "vitest";

import { searchDocuments } from "@/features/search/search-engine";
import { loadRepositoryContent } from "@/lib/content";
import { extractMdxHeadings } from "@/lib/content/mdx-headings.mjs";
import {
  buildSearchIndex,
  extractMdxSearchText,
  normalizeSearchText,
  searchIndexSchema,
  segmentSearchText,
  serializeSearchIndex,
  type SearchIndex,
} from "@/lib/search";

let searchIndex: SearchIndex;

beforeAll(async () => {
  const { input, manifest } = await loadRepositoryContent();
  searchIndex = buildSearchIndex(input, manifest);
});

describe("构建期 SearchDocument", () => {
  it("只生成正式可搜索实体，并按稳定 ID 确定排序", () => {
    expect(searchIndex.documents).toHaveLength(49);
    expect(
      searchIndex.documents.filter(({ kind }) => kind === "concept"),
    ).toHaveLength(31);
    expect(
      searchIndex.documents
        .filter(({ kind }) => kind === "concept")
        .every(
          ({ headings }) =>
            headings.length >= 14 &&
            new Set(headings.map(({ anchor }) => anchor)).size ===
              headings.length,
        ),
    ).toBe(true);
    expect(
      searchIndex.documents.filter(({ kind }) => kind === "project"),
    ).toHaveLength(1);
    expect(
      searchIndex.documents.filter(({ kind }) => kind === "resource"),
    ).toHaveLength(17);
    expect(searchIndex.documents.some(({ id }) => id === "project.stereo-or-pnp")).toBe(
      false,
    );
    expect(searchIndex.documents.map(({ id }) => id)).toEqual(
      searchIndex.documents.map(({ id }) => id).toSorted((left, right) =>
        left.localeCompare(right, "en"),
      ),
    );
  });

  it("索引正文标题、学习目标、Stage / Track 与反向关联主题", () => {
    const debugging = searchIndex.documents.find(
      ({ id }) => id === "tooling.debugging",
    );
    const pixelLab = searchIndex.documents.find(
      ({ id }) => id === "project.pixel-lab",
    );
    const pythonTutorial = searchIndex.documents.find(
      ({ id }) => id === "resource.python-tutorial",
    );
    const roiMasks = searchIndex.documents.find(
      ({ id }) => id === "opencv.roi-masks",
    );
    const geometricTransforms = searchIndex.documents.find(
      ({ id }) => id === "opencv.geometric-transforms",
    );

    expect(debugging).toMatchObject({
      stageIds: ["stage.tooling-foundations"],
      trackIds: ["track.common"],
      aliases: ["系统化调试", "Systematic Debugging"],
    });
    expect(
      debugging?.headings.some(({ title }) =>
        title.startsWith("9. Active Recall"),
      ),
    ).toBe(true);
    expect(debugging?.goals[0]).toContain("最小复现");
    expect(pixelLab?.relatedTitles).toContain("Python 核心语法");
    expect(pixelLab?.headings).toContainEqual(
      expect.objectContaining({ title: "项目目标" }),
    );
    expect(pythonTutorial).toMatchObject({
      aliases: ["Python 官方教程"],
      authorOrOrganization: "Python Software Foundation",
      external: false,
      href: "/resources/python-tutorial/",
      resourceType: "official-doc",
      status: "verified",
    });
    expect(pythonTutorial?.summary).toContain("权威说明");
    expect(pythonTutorial?.body).toContain("More Control Flow Tools");
    expect(pythonTutorial?.keywords).toEqual(
      expect.arrayContaining(["official-doc", "beginner", "essential"]),
    );
    expect(pythonTutorial?.relatedTitles.length).toBeGreaterThan(0);

    const gradient = searchIndex.documents.find(
      ({ id }) => id === "math.calculus-gradients",
    );
    expect(gradient).toMatchObject({
      stageIds: ["stage.vision-math-immediate"],
      trackIds: ["track.common"],
      external: false,
      href: "/knowledge/calculus-and-gradients/",
    });
    expect(gradient?.body).toContain("为什么现在学");
    expect(roiMasks).toMatchObject({
      stageIds: ["stage.image-computing"],
      trackIds: ["track.common"],
      external: false,
      href: "/knowledge/opencv-roi-masks/",
    });
    expect(roiMasks?.body).toContain("source protection");
    expect(roiMasks?.headings).toContainEqual(
      expect.objectContaining({ title: "8. Worked Example" }),
    );
    expect(geometricTransforms).toMatchObject({
      stageIds: ["stage.image-computing"],
      trackIds: ["track.common"],
      external: false,
      href: "/knowledge/opencv-geometric-transforms/",
    });
    expect(geometricTransforms?.body).toContain("known-point");
    expect(geometricTransforms?.body).toContain("output canvas");
  });

  it("MDX 文本提取不执行代码，并保持确定性序列化", () => {
    expect(
      extractMdxHeadings("# 标题\n\n## Section `code`\n\n正文 **内容**"),
    ).toEqual([
      {
        depth: 2,
        title: "Section code",
        anchor: "section-section-code",
      },
    ]);
    expect(
      extractMdxSearchText("# 标题\n\n## Section `code`\n\n正文 **内容**").body,
    ).toContain("Section code");
    expect(serializeSearchIndex(searchIndex)).toBe(
      serializeSearchIndex(searchIndex),
    );
  });

  it("拒绝重复 SearchDocument ID", () => {
    const document = searchIndex.documents[0];
    expect(() =>
      searchIndexSchema.parse({
        schemaVersion: 2,
        documents: [document, document],
      }),
    ).toThrow("SearchDocument ID 必须唯一");
  });
});

describe("基础搜索匹配与排序", () => {
  it("支持中文标题、英文名、alias 与真实缩写", () => {
    expect(searchDocuments(searchIndex.documents, "调试与问题定位")[0]).toMatchObject({
      document: { id: "tooling.debugging" },
      matchTier: 0,
      matchLabel: "标题",
    });
    expect(
      searchDocuments(
        searchIndex.documents,
        "Debugging and Problem Localization",
      )[0],
    ).toMatchObject({
      document: { id: "tooling.debugging" },
      matchTier: 1,
      matchLabel: "英文名",
    });
    expect(searchDocuments(searchIndex.documents, "Systematic Debugging")[0]).toMatchObject({
      document: { id: "tooling.debugging" },
      matchTier: 2,
      matchLabel: "别名",
    });
    expect(
      searchDocuments(searchIndex.documents, "WSL").some(
        ({ document }) => document.id === "tooling.linux-basics",
      ),
    ).toBe(true);
  });

  it("跨 Concept、Project、Resource 搜索并保持标题精确匹配优先", () => {
    const pythonResults = searchDocuments(searchIndex.documents, "Python");
    expect(new Set(pythonResults.map(({ document }) => document.kind))).toEqual(
      new Set(["concept", "project", "resource"]),
    );

    const pixelLabResults = searchDocuments(searchIndex.documents, "Pixel Lab");
    expect(pixelLabResults[0]).toMatchObject({
      document: { id: "project.pixel-lab" },
      matchTier: 3,
    });

    const resourceAliasResults = searchDocuments(
      searchIndex.documents,
      "Python 官方教程",
    );
    expect(resourceAliasResults[0]).toMatchObject({
      document: { id: "resource.python-tutorial" },
      matchTier: 2,
    });
  });

  it("正文标题命中复用 manifest anchor，其他实体仍保持原导航", () => {
    const headingResult = searchDocuments(
      searchIndex.documents,
      "9. Active Recall 主动回忆",
    ).find(({ document }) => document.id === "tooling.debugging");
    expect(headingResult).toMatchObject({
      href: "/knowledge/debugging-and-problem-localization/#section-9-active-recall-主动回忆",
      matchLabel: "正文标题",
    });

    expect(searchDocuments(searchIndex.documents, "调试与问题定位")[0]?.href).toBe(
      "/knowledge/debugging-and-problem-localization/",
    );
    expect(searchDocuments(searchIndex.documents, "Pixel Lab")[0]?.href).toBe(
      "/projects/pixel-lab/",
    );
    expect(
      searchDocuments(searchIndex.documents, "Python 官方教程")[0]?.href,
    ).toBe("/resources/python-tutorial/");
  });

  it("不返回 draft Project，也能安全处理空白和特殊字符", () => {
    expect(searchDocuments(searchIndex.documents, "PnP")).toEqual([]);
    expect(searchDocuments(searchIndex.documents, "   ")).toEqual([]);
    expect(() => searchDocuments(searchIndex.documents, "[]()^$\\")).not.toThrow();
  });

  it("统一规范大小写、Unicode、空白与常见连字符", () => {
    expect(normalizeSearchText("  OpenCV—PYTHON  ")).toBe("opencv python");
    expect(segmentSearchText("Python 核心语法")).toEqual(
      expect.arrayContaining(["python 核心语法", "python", "核心", "语法"]),
    );
  });
});
