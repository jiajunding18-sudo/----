import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Study Log · 机器视觉 Learning OS",
};

export default function StudyLogPage() {
  return (
    <PageHeader
      description="记录学习时间、完成内容、遇到的问题，以及下一次学习的具体计划。"
      status={{
        label: "日志数据功能尚未接入",
        description:
          "本阶段不创建日志表单或本地记录。可编辑日志和周统计将在后续阶段实现。",
      }}
      title="Study Log"
    />
  );
}
