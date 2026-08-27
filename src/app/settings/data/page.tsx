import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Settings / Data · 机器视觉 Learning OS",
};

export default function SettingsDataPage() {
  return (
    <PageHeader
      description="管理重点方向、目标深度，以及浏览器中的个人学习数据。"
      status={{
        label: "设置与数据操作尚未接入",
        description:
          "本阶段不提供尚未生效的设置、导入、导出或清除按钮。数据安全流程将在持久化阶段实现。",
      }}
      title="Settings / Data"
    />
  );
}
