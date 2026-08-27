import type { Metadata } from "next";
import Link from "next/link";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { readStageZeroSlice } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Dashboard · 机器视觉 Learning OS",
};

export default function DashboardPage() {
  const content = readStageZeroSlice();
  if (content.status === "error") {
    console.error("Dashboard 读取内容失败", content.error);
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

  return (
    <div className="max-w-5xl">
        <PageHeader
          description="从当前已发布的路线和内容开始学习；本阶段只呈现真实静态结构，不推测你的学习进度。"
          status={{
            label: "尚未记录个人学习状态",
            description:
              "当前没有完成率、今日推荐或解锁判断。你可以先浏览 Stage 0 内容与 Pixel Lab，进度交互将在后续阶段实现。",
          }}
          title="Dashboard"
        />

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
