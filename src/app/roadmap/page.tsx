import type { Metadata } from "next";
import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { readRoadmapView } from "@/features/roadmap/roadmap-content";
import { RoadmapViewContent } from "@/features/roadmap/roadmap-view";

export const metadata: Metadata = {
  title: "Roadmap · 机器视觉 Learning OS",
};

export default function RoadmapPage() {
  const content = readRoadmapView();
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

  return (
    <div className="max-w-5xl">
      <PageHeader
        description="从正式内容系统查看 Stage 目标、推荐顺序、真实依赖、验证项目与出口标准。"
        title="Roadmap"
      />

      <RoadmapViewContent roadmap={content.value} />
    </div>
  );
}
