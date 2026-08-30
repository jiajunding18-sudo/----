import type { Metadata } from "next";

import { ContentState } from "@/components/content/content-state";
import { PageHeader } from "@/components/shell/page-header";
import { DashboardConsole } from "@/features/dashboard/dashboard-console";
import { buildDashboardCatalog } from "@/features/dashboard/dashboard-model";
import { DashboardNextStep } from "@/features/recommendations/dashboard-next-step";
import { getNextStepCatalog, getProgressCatalog } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Dashboard · 机器视觉 Learning OS",
};

function readDashboardData() {
  try {
    const nextStepCatalog = getNextStepCatalog();
    const progressCatalog = getProgressCatalog();
    return {
      status: "ready",
      dashboardCatalog: buildDashboardCatalog(nextStepCatalog, progressCatalog),
      nextStepCatalog,
    } as const;
  } catch (error) {
    return { error, status: "error" } as const;
  }
}

export default function DashboardPage() {
  const content = readDashboardData();
  if (content.status === "error") {
    console.error("Dashboard 读取内容失败", content.error);
    return (
      <div className="max-w-3xl">
        <PageHeader description="查看当前正式学习状态。" title="Dashboard" />
        <ContentState
          description="内容索引暂时无法读取。你的本地学习数据没有被修改。"
          title="学习内容暂时不可用"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        description="先执行唯一的正式下一步，再核对当前学习、Project、手动学习时长与路线进度。"
        title="Dashboard"
      />

      <DashboardNextStep catalog={content.nextStepCatalog} />
      <DashboardConsole catalog={content.dashboardCatalog} />
    </div>
  );
}
