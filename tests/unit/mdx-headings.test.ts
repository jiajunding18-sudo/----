import { describe, expect, it } from "vitest";

import {
  collectContentHeadings,
  extractMdxHeadings,
} from "@/lib/content/mdx-headings.mjs";

describe("MDX 正文目录与稳定 anchor", () => {
  it("从 h2/h3 自动提取中英文标题并忽略文章 h1", () => {
    expect(
      extractMdxHeadings(
        "# 页面标题\n\n## 中文章节\n\n### Camera Calibration `PnP`\n",
      ),
    ).toEqual([
      { depth: 2, title: "中文章节", anchor: "section-中文章节" },
      {
        depth: 3,
        title: "Camera Calibration PnP",
        anchor: "section-camera-calibration-pnp",
      },
    ]);
  });

  it("按正文顺序为重复标题和潜在后缀冲突稳定消歧", () => {
    const body = "## 重复标题\n\n## 重复标题\n\n## 重复标题-2\n\n## 重复标题\n";
    const firstBuild = extractMdxHeadings(body);
    const secondBuild = extractMdxHeadings(body);

    expect(firstBuild.map(({ anchor }) => anchor)).toEqual([
      "section-重复标题",
      "section-重复标题-2",
      "section-重复标题-2-2",
      "section-重复标题-3",
    ]);
    expect(secondBuild).toEqual(firstBuild);
  });

  it("正文含行内与块级数学公式时仍能提取稳定标题", () => {
    expect(
      extractMdxHeadings(
        String.raw`# 页面标题

向量 $p = [x, y]^T$。

## Worked Example

$$
\nabla f = \begin{bmatrix} \partial f / \partial x \\ \partial f / \partial y \end{bmatrix}
$$

## Mastery Evidence`,
      ),
    ).toEqual([
      {
        depth: 2,
        title: "Worked Example",
        anchor: "section-worked-example",
      },
      {
        depth: 2,
        title: "Mastery Evidence",
        anchor: "section-mastery-evidence",
      },
    ]);
  });

  it("MDX 编译插件使用同一结果写入 heading id", () => {
    const tree: {
      type: string;
      children: Array<{
        type: string;
        depth: number;
        children: Array<{ type: string; value: string }>;
        data?: { hProperties: { id: string } };
      }>;
    } = {
      type: "root",
      children: [
        { type: "heading", depth: 2, children: [{ type: "text", value: "章节 A" }] },
        { type: "heading", depth: 2, children: [{ type: "text", value: "章节 A" }] },
      ],
    };

    const headings = collectContentHeadings(tree, { applyIds: true });

    expect(headings.map(({ anchor }) => anchor)).toEqual([
      "section-章节-a",
      "section-章节-a-2",
    ]);
    expect(tree.children.map(({ data }) => data?.hProperties.id)).toEqual([
      "section-章节-a",
      "section-章节-a-2",
    ]);
  });
});
