import type { Metadata } from "next";
import Link from "next/link";

import { GlobalKnowledgeGraph } from "@/features/knowledge/global-knowledge-graph";
import { getGlobalKnowledgeGraphCatalog } from "@/features/knowledge/knowledge-content";

export const metadata: Metadata = {
  title: "Knowledge Graph · 机器视觉 Learning OS",
  description: "按 Stage、Track、依赖类型和学习状态浏览正式 Concept 依赖图。",
};

export default function GlobalKnowledgeGraphPage() {
  const catalog = getGlobalKnowledgeGraphCatalog();

  return (
    <div className="max-w-6xl min-w-0">
      <nav
        aria-label="Knowledge Graph 页面上下文"
        className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
      >
        <Link
          className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
          href="/roadmap/"
        >
          返回 Roadmap
        </Link>
        <Link
          className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4"
          href="/knowledge/"
        >
          返回 Knowledge
        </Link>
      </nav>

      <GlobalKnowledgeGraph catalog={catalog} />
    </div>
  );
}
