import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { StudyLogExperience } from "@/features/study-log/study-log-experience";
import { getStudyLogCatalog } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Study Log · 机器视觉 Learning OS",
};

export default function StudyLogPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        description="手动记录实际学习时间、完成内容、遇到的问题，以及下一次学习的具体计划。"
        title="Study Log"
      />
      <StudyLogExperience catalog={getStudyLogCatalog()} />
    </div>
  );
}
