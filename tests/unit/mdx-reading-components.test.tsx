import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { evaluate } from "@mdx-js/mdx";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { describe, expect, it, vi } from "vitest";
import * as runtime from "react/jsx-runtime";
import type { MDXContent } from "mdx/types";

import { useMDXComponents } from "../../mdx-components";
import { remarkStableHeadingAnchors } from "../../src/lib/content/mdx-headings.mjs";

async function renderFixture() {
  const source = await readFile(
    resolve("tests/fixtures/technical-learning-elements.mdx"),
    "utf8",
  );
  const evaluatedMdx = await evaluate(source, {
    ...runtime,
    rehypePlugins: [rehypeHighlight, rehypeKatex],
    remarkPlugins: [remarkGfm, remarkMath, remarkStableHeadingAnchors],
  });
  const Fixture = evaluatedMdx.default;

  return render(<TestDocument Content={Fixture} />);
}

function TestDocument({ Content }: { readonly Content: MDXContent }) {
  const components = useMDXComponents({});
  return (
    <div className="learning-document">
      <Content components={components} />
    </div>
  );
}

describe("MDX 技术学习内容组件", () => {
  it("从同一编译管线生成公式、高亮代码、表格、图片和链接语义", async () => {
    const { container } = await renderFixture();

    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expect(container.querySelector(".katex-display")).toBeInTheDocument();
    expect(container.querySelector(".hljs-keyword")).toBeInTheDocument();
    expect(
      container.querySelectorAll("[data-code-language]").length,
    ).toBe(6);
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("PowerShell")).toBeInTheDocument();
    expect(screen.getByText("Shell")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Plain text")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveClass("table-scroll-container");
    expect(table.parentElement).toHaveAttribute("role", "group");
    expect(table.parentElement).toHaveAttribute("tabindex", "0");

    const markdownImage = screen.getByAltText("普通 Markdown 图片");
    expect(markdownImage).toHaveAttribute("loading", "lazy");
    expect(markdownImage).toHaveAttribute("decoding", "async");
    const figureImage = screen.getByAltText("相机坐标投影示意图");
    expect(figureImage).toHaveAttribute("loading", "lazy");
    expect(figureImage).toHaveAttribute("decoding", "async");
    expect(figureImage.closest("figure")).toBeInTheDocument();
    expect(screen.getByText("图 1：测试 fixture 的图注。")).toBeInTheDocument();

    const internalLink = screen.getByRole("link", { name: "已发布 Concept" });
    expect(internalLink).toHaveAttribute("data-link-kind", "internal");
    expect(internalLink).not.toHaveAttribute("target");
    const externalLink = screen.getByRole("link", {
      name: /MDX reference.*外部链接/,
    });
    expect(externalLink).toHaveAttribute("data-link-kind", "external");
    expect(externalLink).toHaveAttribute("rel", "noreferrer");
    expect(externalLink).toHaveAttribute("target", "_blank");
  });

  it("提供可通过键盘触发且有明确反馈的代码复制", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await renderFixture();

    const copyButton = screen.getAllByRole("button", { name: "复制代码" })[0];
    copyButton.focus();
    expect(copyButton).toHaveFocus();
    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(
      "def mean(values):\n    return sum(values) / len(values)",
    );
    expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();
    expect(screen.getByText("代码已复制到剪贴板")).toBeInTheDocument();
  });

  it("保留稳定锚点并标出学习闭环的阅读层级", async () => {
    const { container } = await renderFixture();

    expect(container.querySelector("#section-worked-example-技术元素")).toHaveAttribute(
      "data-learning-section",
      "example",
    );
    expect(container.querySelector("#section-active-recall-主动回忆")).toHaveAttribute(
      "data-learning-section",
      "recall",
    );
    expect(container.querySelector("#section-practice-练习")).toHaveAttribute(
      "data-learning-section",
      "practice",
    );
    expect(container.querySelector("#section-mastery-evidence-掌握证据")).toHaveAttribute(
      "data-learning-section",
      "evidence",
    );
  });
});
