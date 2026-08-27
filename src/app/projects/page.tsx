import type { Metadata } from "next";
import Link from "next/link";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { getConceptsForProject, readStageZeroSlice } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Projects · 机器视觉 Learning OS",
};

export default function ProjectsPage() {
  const content = readStageZeroSlice();
  if (content.status === "error") {
    console.error("Projects 页面读取内容失败", content.error);
    return (
      <div className="max-w-3xl">
        <PageHeader description="浏览当前已发布的实践项目。" title="Projects" />
        <ContentState
          description="项目索引暂时无法读取。开发环境可运行 npm run content:check 获取具体诊断。"
          title="项目内容暂时不可用"
        />
      </div>
    );
  }

  const { project } = content.value;

  return (
    <div className="max-w-5xl">
        <PageHeader
          description="当前只展示与 Stage 0 紧密关联的真实实践；不计算准备度、解锁或项目进度。"
          title="Projects"
        />
        {!project ? (
          <ContentState
            description="manifest 已成功读取，但当前没有已发布的项目。"
            title="当前没有可浏览的项目"
          />
        ) : (
          <article className="mt-10 border-y border-[var(--color-border)] py-8">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
              Stage 0 出口实践
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
              <Link
                className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                href={`/projects/${project.slug}/`}
              >
                {project.title}
              </Link>
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-[var(--color-muted)]">
              {project.resumeOutcome}
            </p>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold">预计时间</dt>
                <dd className="mt-1 text-sm text-[var(--color-muted)]">
                  {project.estimatedHours.min}–{project.estimatedHours.max} 小时
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold">所需 Concept</dt>
                <dd className="mt-1 text-sm text-[var(--color-muted)]">
                  {getConceptsForProject(project)
                    .map(({ concept }) => concept.title)
                    .join("、")}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-semibold">Stage 0 出口证据</dt>
                <dd className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                  {project.acceptanceCriteria.length} 项可检查的验收标准，以及与 {project.evidenceConceptIds.length} 个 Concept 对应的证据索引；完成文件不自动等于掌握。
                </dd>
              </div>
            </dl>
          </article>
        )}
    </div>
  );
}
