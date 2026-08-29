import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentContext } from "@/components/content/document-context";
import { ResourceSummary } from "@/features/resources";
import {
  getResourceCatalogItemBySlug,
  getResourceSlugs,
} from "@/lib/content/site-content";

interface ResourcePageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getResourceSlugs();
}

export async function generateMetadata({
  params,
}: ResourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getResourceCatalogItemBySlug(slug);

  return item
    ? {
        title: `${item.resource.title} · Resources · 机器视觉 Learning OS`,
        description: item.resource.reason,
      }
    : { title: "资源不存在 · 机器视觉 Learning OS" };
}

export default async function ResourcePage({ params }: ResourcePageProps) {
  const { slug } = await params;
  const item = getResourceCatalogItemBySlug(slug);

  if (!item) {
    notFound();
  }

  const { resource } = item;
  const relationDetails = [
    `${item.concepts.length} 个 Related Concept`,
    `${item.projects.length} 个 Related Project`,
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <DocumentContext
        backHref="/resources/"
        backLabel="返回 Resources"
        details={[
          resource.authorOrOrganization ?? "来源尚未记录",
          ...relationDetails,
        ]}
        eyebrow={`Resource · ${resource.verification}`}
      />
      <ResourceSummary displayMode="detail" item={item} />
    </div>
  );
}
