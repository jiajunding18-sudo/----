import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { DataManagementPanel } from "@/features/progress/data-management-panel";

export const metadata: Metadata = {
  title: "Settings / Data · 机器视觉 Learning OS",
};

export default function SettingsDataPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        description="在当前浏览器中查看、备份与安全恢复个人学习数据。所有文件只在本地处理，不会上传。"
        title="Settings / Data"
      />
      <DataManagementPanel />
    </div>
  );
}
