import type { Metadata } from "next";
import Link from "next/link";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { KnowledgeBrowser } from "@/features/knowledge/knowledge-browser";
import { readKnowledgeView } from "@/features/knowledge/knowledge-content";

export const metadata: Metadata = {
  title: "Knowledge · 机器视觉 Learning OS",
};

export default function KnowledgePage() {
  const content = readKnowledgeView();
  if (content.status === "error") {
    console.error("Knowledge 页面读取内容失败", content.error);
    return (
      <div className="max-w-3xl">
        <PageHeader
          description="浏览机器视觉概念、前置知识、练习方式与精选学习资源。"
          title="Knowledge"
        />
        <ContentState
          description="内容索引暂时无法读取。开发环境可运行 npm run content:check 查看具体文件与字段错误。"
          title="知识内容暂时不可用"
        />
      </div>
    );
  }

  const knowledge = content.value;

  return (
    <div className="max-w-5xl">
      <PageHeader
        description="浏览当前已发布的机器视觉学习单元；每篇正文都来自仓库中的正式 MDX 内容。"
        title="Knowledge"
      />
      <div className="mb-8 border-l-2 border-[var(--color-accent)] bg-[var(--color-surface-subtle)] px-4 py-3">
        <Link
          className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
          data-knowledge-graph-link
          href="/roadmap/graph/"
        >
          打开全局 Knowledge Graph
        </Link>
        <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
          按 Stage、Track、依赖类型与学习状态观察当前正式知识结构。
        </p>
      </div>
      {knowledge.concepts.length === 0 ? (
        <ContentState
          description="manifest 已成功读取，但当前没有已发布的 Concept。请先运行内容构建或检查 publicationStatus。"
          title="当前没有可浏览的知识内容"
        />
      ) : (
        <KnowledgeBrowser knowledge={knowledge} />
      )}
    </div>
  );
}
