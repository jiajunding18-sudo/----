import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { SearchExperience } from "@/features/search/search-experience";

export const metadata: Metadata = {
  title: "Search · 机器视觉 Learning OS",
};

export default function SearchPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        description="使用构建期本地索引统一查找已发布 Concept、Project 与正式 Resource。"
        title="Search"
      />
      <Suspense
        fallback={
          <p className="mt-10 text-sm text-[var(--color-muted)]">
            正在准备搜索界面…
          </p>
        }
      >
        <SearchExperience />
      </Suspense>
    </div>
  );
}
