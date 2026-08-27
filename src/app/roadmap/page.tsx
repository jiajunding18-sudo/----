import type { Metadata } from "next";
import Link from "next/link";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { readStageZeroSlice } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Roadmap · 机器视觉 Learning OS",
};

export default function RoadmapPage() {
  const content = readStageZeroSlice();
  if (content.status === "error") {
    console.error("Roadmap 页面读取内容失败", content.error);
    return (
      <div className="max-w-3xl">
        <PageHeader description="查看当前已发布的学习路线。" title="Roadmap" />
        <ContentState
          description="路线索引暂时无法读取。开发环境可运行 npm run content:check 获取具体诊断。"
          title="路线内容暂时不可用"
        />
      </div>
    );
  }

  const { concepts, project, stage, tracks } = content.value;

  return (
    <div className="max-w-5xl">
        <PageHeader
          description="当前只展示已经发布的 Stage 0 真实切片；完整依赖 DAG、推荐与解锁逻辑仍属于后续阶段。"
          title="Roadmap"
        />

        <section className="mt-10" aria-labelledby="stage-zero-title">
          <p className="text-sm font-semibold text-[var(--color-accent)]">
            {tracks.map(({ title }) => title).join(" / ")}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]" id="stage-zero-title">
            {stage.title}
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-[var(--color-muted)]">
            {stage.summary}
          </p>

          {concepts.length === 0 ? (
            <ContentState
              description="Stage 已存在，但当前没有已发布的 Concept。"
              title="Stage 0 内容为空"
            />
          ) : (
            <ol className="mt-8 border-l border-[var(--color-border)] pl-6">
              {concepts.map((concept, index) => (
                <li className="relative pb-7 last:pb-0" key={concept.id}>
                  <span
                    aria-hidden="true"
                    className="absolute -left-[1.78rem] top-1.5 size-3 rounded-full border-2 border-[var(--color-background)] bg-[var(--color-accent)]"
                  />
                  <p className="text-xs font-semibold tabular-nums text-[var(--color-muted)]">
                    学习顺序 {String(index + 1).padStart(2, "0")} · order {concept.order}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    <Link
                      className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                      href={`/knowledge/${concept.slug}/`}
                    >
                      {concept.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {concept.englishTitle}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {project ? (
          <section
            aria-labelledby="stage-zero-project-title"
            className="mt-10 border-t border-[var(--color-border)] pt-8"
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
              Stage 0 出口实践
            </p>
            <h2 className="mt-2 text-2xl font-semibold" id="stage-zero-project-title">
              <Link
                className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                href={`/projects/${project.slug}/`}
              >
                {project.title}
              </Link>
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-[var(--color-muted)]">
              {project.resumeOutcome}
            </p>
          </section>
        ) : (
          <ContentState
            description="Stage 0 路线可以浏览，但当前没有已发布的出口实践。"
            title="项目内容暂不可用"
          />
        )}
    </div>
  );
}
