import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Search · 机器视觉 Learning OS",
};

export default function SearchPage() {
  return (
    <PageHeader
      description="统一查找知识点、项目、资源、公式名称与常用工具。"
      status={{
        label: "搜索逻辑尚未接入",
        description:
          "顶部 Search 入口已经可达，但本阶段不提供无效输入框。索引与查询能力将在后续阶段实现。",
      }}
      title="Search"
    />
  );
}
