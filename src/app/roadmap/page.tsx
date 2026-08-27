import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Roadmap · 机器视觉 Learning OS",
};

export default function RoadmapPage() {
  return (
    <PageHeader
      description="查看公共主干、方向分支、学习阶段及知识之间的先后关系。"
      status={{
        label: "路线数据尚未接入",
        description:
          "本阶段仅建立 Roadmap 的稳定入口。依赖 DAG、阶段详情和通过条件属于 Phase 2。",
      }}
      title="Roadmap"
    />
  );
}
