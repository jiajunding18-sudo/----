import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Knowledge · 机器视觉 Learning OS",
};

export default function KnowledgePage() {
  return (
    <PageHeader
      description="浏览机器视觉概念、前置知识、练习方式与精选学习资源。"
      status={{
        label: "知识内容尚未发布",
        description:
          "本阶段不填充教程或资源列表。结构化知识内容与基础搜索将在后续阶段实现。",
      }}
      title="Knowledge"
    />
  );
}
