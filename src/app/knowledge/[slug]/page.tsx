import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentContext } from "@/components/content/document-context";
import { ResourceLinks } from "@/components/content/resource-links";
import { ConceptNavigation } from "@/features/knowledge/concept-navigation";
import { ConceptTableOfContents } from "@/features/knowledge/concept-table-of-contents";
import { ConceptProgressPanel } from "@/features/progress/concept-progress-panel";
import { ConceptPersonalPanel } from "@/features/progress/concept-personal-panel";
import {
  ConceptProjectUsage,
  getConceptProjectUsage,
} from "@/features/projects";
import { getKnowledgeConceptView } from "@/features/knowledge/knowledge-content";
import {
  getPublishedConceptBySlug,
  getPublishedConceptSlugs,
  getProgressConceptDefinition,
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
  const progressConcept = getProgressConceptDefinition(concept.id);
  if (!progressConcept) {
    notFound();
  }
  const ConceptContent = contentModule.default;
  const projects = getConceptProjectUsage(concept.id);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="items-start gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="min-w-0">
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
          <ConceptProjectUsage projects={projects} />
          <ConceptProgressPanel
            concept={progressConcept}
            prerequisites={knowledgeConcept.prerequisites.map(
              ({ concept: prerequisite, kind }) => ({
                id: prerequisite.id,
                title: prerequisite.title,
                href: prerequisite.href,
                kind,
              }),
            )}
          />
          <ConceptPersonalPanel conceptId={concept.id} />
          <ConceptTableOfContents headings={concept.headings} variant="mobile" />
          <div className="learning-document">
            <ConceptContent />
          </div>
          <ResourceLinks resources={resources} />
        </article>
        <ConceptTableOfContents headings={concept.headings} variant="desktop" />
      </div>
    </div>
  );
}
