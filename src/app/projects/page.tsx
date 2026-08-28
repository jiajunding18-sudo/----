import type { Metadata } from "next";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectCatalogExplorer, readProjectCatalogView } from "@/features/projects";

export const metadata: Metadata = {
  title: "Projects · 机器视觉 Learning OS",
  description: "从现实问题、能力与应用场景浏览正式机器视觉项目路线。",
};

export default function ProjectsPage() {
  const content = readProjectCatalogView();
  if (content.status === "error") {
    console.error("Projects 页面读取内容失败", content.error);
    return (
      <div className="max-w-5xl">
        <PageHeader description="从现实问题浏览能力验证项目。" title="Projects" />
        <ContentState
          description="项目 catalog 暂时无法读取。开发环境可运行 npm run content:check 获取具体诊断。"
          title="项目内容暂时不可用"
        />
      </div>
    );
  }

  const catalog = content.value;

  return (
    <div className="max-w-6xl">
      <PageHeader
        description={`${catalog.projects.length} 个 Project 均来自正式 manifest：${catalog.publishedCount} 个 published 可执行项目，${catalog.draftCount} 个 draft 只展示已规划的能力方向。`}
        title="Projects"
      />
      <section className="mt-8 max-w-4xl border-l-2 border-[var(--color-accent)] px-5 py-4">
        <h2 className="text-base font-semibold">从知识路线转向能力路线</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          每个 Project 先回答现实问题、能力产出与应用场景，再连接 Required Knowledge。Draft 不提供假正文、假验收或 0 项准备度结论。
        </p>
      </section>
      <ProjectCatalogExplorer catalog={catalog} />
    </div>
  );
}
