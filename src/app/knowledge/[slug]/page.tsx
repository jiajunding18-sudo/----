import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentContext } from "@/components/content/document-context";
import { ResourceLinks } from "@/components/content/resource-links";
import { ConceptNavigation } from "@/features/knowledge/concept-navigation";
import { getKnowledgeConceptView } from "@/features/knowledge/knowledge-content";
import {
  getPublishedConceptBySlug,
  getPublishedConceptSlugs,
  getResources,
  loadConceptContent,
} from "@/lib/content/site-content";

interface ConceptPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedConceptSlugs();
}

export async function generateMetadata({ params }: ConceptPageProps): Promise<Metadata> {
  const { slug } = await params;
  const concept = getPublishedConceptBySlug(slug);

  return concept
    ? {
        title: `${concept.title} · Knowledge · 机器视觉 Learning OS`,
        description: concept.summary,
      }
    : { title: "知识内容不存在 · 机器视觉 Learning OS" };
}

export default async function ConceptPage({ params }: ConceptPageProps) {
  const { slug } = await params;
  const concept = getPublishedConceptBySlug(slug);
  const contentModule = await loadConceptContent(slug);

  if (!concept || !contentModule) {
    notFound();
  }

  const knowledgeConcept = getKnowledgeConceptView(concept.id);
  if (!knowledgeConcept) {
    notFound();
  }
  const resources = getResources(concept.resourceIds);
  const ConceptContent = contentModule.default;

  return (
    <article className="mx-auto max-w-4xl">
      <DocumentContext
        backHref="/knowledge/"
        backLabel="返回 Knowledge"
        details={[
          knowledgeConcept.stage.title,
          knowledgeConcept.tracks.map(({ title }) => title).join(" / "),
          `推荐序位 ${String(knowledgeConcept.recommendedSequence).padStart(2, "0")}`,
          `预计 ${concept.estimatedHours.min}–${concept.estimatedHours.max} 小时`,
        ]}
        eyebrow="Concept · available（正式内容）"
      />
      <ConceptNavigation concept={knowledgeConcept} />
      <div className="learning-document">
        <ConceptContent />
      </div>
      <ResourceLinks resources={resources} />
    </article>
  );
}
