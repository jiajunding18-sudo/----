import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { ResourceBrowser } from "@/features/resources";
import { getResourceCatalogView } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Resources · 机器视觉 Learning OS",
};

export default function ResourcesPage() {
  const view = getResourceCatalogView();

  return (
    <div className="max-w-5xl">
      <PageHeader
        description="按学习目标浏览正式精选资源，并在打开外链前查看来源、难度、推荐理由、建议范围与验证状态。"
        title="Resources"
      />
      <Suspense
        fallback={
          <p className="mt-10 text-sm text-[var(--color-muted)]">
            正在准备资源筛选…
          </p>
        }
      >
        <ResourceBrowser view={view} />
      </Suspense>
    </div>
  );
}
