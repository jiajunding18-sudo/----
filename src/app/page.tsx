import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Dashboard · 机器视觉 Learning OS",
};

export default function DashboardPage() {
  return (
    <PageHeader
      description="集中查看当前学习任务、阶段进展与项目下一步的个人学习控制台。"
      status={{
        label: "Phase 1B · 应用壳层已建立",
        description:
          "当前页面只提供真实的导航与页面结构。任务推荐、进度和项目状态将在后续阶段接入，不展示虚构学习数据。",
      }}
      title="Dashboard"
    />
  );
}
