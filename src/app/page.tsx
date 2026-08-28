import type { Metadata } from "next";
import Link from "next/link";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { readKnowledgeView } from "@/features/knowledge/knowledge-content";
import { ProgressOverview } from "@/features/progress/progress-overview";
import { buildProgressOverviewView } from "@/features/progress/progress-overview-model";
import {
  getProgressCatalog,
  readStageZeroSlice,
} from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Dashboard · 机器视觉 Learning OS",
};

export default function DashboardPage() {
  const content = readStageZeroSlice();
  const knowledge = readKnowledgeView();
  if (content.status === "error" || knowledge.status === "error") {
    console.error(
      "Dashboard 读取内容失败",
      content.status === "error" ? content.error : knowledge.error,
    );
    return (
      <div className="max-w-3xl">
        <PageHeader description="查看当前已发布的学习路线。" title="Dashboard" />
        <ContentState
          description="内容索引暂时无法读取。你的本地学习数据没有被修改。"
          title="学习内容暂时不可用"
        />
      </div>
    );
  }

  const { concepts, project, stage } = content.value;
  const progressCatalog = getProgressCatalog();
  const progressOverview = buildProgressOverviewView(knowledge.value);

  return (
    <div className="max-w-5xl">
        <PageHeader
          description="从当前已发布的路线和内容开始学习；本地状态分别记录接触、理解与掌握，不合并成模糊完成率。"
          title="Dashboard"
        />

        <ProgressOverview catalog={progressCatalog} overview={progressOverview} />

        <section aria-labelledby="current-route-title" className="mt-10">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
            当前路线
          </p>
          <h2 className="mt-2 text-2xl font-semibold" id="current-route-title">
            {stage.title}
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-[var(--color-muted)]">
            这条最小真实路线包含 {concepts.length} 个 Concept，并以 Pixel Lab 的 Stage 0 出口证据收口。
          </p>
          <nav aria-label="当前路线快捷入口" className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
              href="/knowledge/"
            >
              浏览 {concepts.length} 个 Concept
            </Link>
            <Link
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold"
              href={project ? `/projects/${project.slug}/` : "/projects/"}
            >
              查看 Pixel Lab
            </Link>
          </nav>
        </section>
    </div>
  );
}
