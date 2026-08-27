import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Projects · 机器视觉 Learning OS",
};

export default function ProjectsPage() {
  return (
    <PageHeader
      description="把理论知识转化为具有验收标准、交付物和复现说明的实践成果。"
      status={{
        label: "项目系统尚未接入",
        description:
          "本阶段只建立 Projects 页面入口，不计算准备度、不显示项目状态，也不提供虚假项目数据。",
      }}
      title="Projects"
    />
  );
}
