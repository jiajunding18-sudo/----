import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentContext } from "@/components/content/document-context";
import { ResourceLinks } from "@/components/content/resource-links";
import {
  getConceptsForProject,
  getPublishedProjectBySlug,
  getPublishedProjectSlugs,
  getResources,
  getTracks,
  loadProjectContent,
} from "@/lib/content/site-content";

interface ProjectPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedProjectSlugs();
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getPublishedProjectBySlug(slug);

  return project
    ? {
        title: `${project.title} · Projects · 机器视觉 Learning OS`,
        description: project.resumeOutcome,
      }
    : { title: "项目不存在 · 机器视觉 Learning OS" };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getPublishedProjectBySlug(slug);
  const contentModule = await loadProjectContent(slug);

  if (!project || !contentModule) {
    notFound();
  }

  const ProjectContent = contentModule.default;
  const tracks = getTracks(project.trackIds);
  const concepts = getConceptsForProject(project);
  const resources = getResources(project.resources.map(({ resourceId }) => resourceId));

  return (
    <article className="mx-auto max-w-4xl">
      <DocumentContext
        backHref="/projects/"
        backLabel="返回 Projects"
        details={[
          tracks.map(({ title }) => title).join(" / ") || project.trackIds.join(" / "),
          `${concepts.length} 个关联 Concept`,
          `预计 ${project.estimatedHours.min}–${project.estimatedHours.max} 小时`,
        ]}
        eyebrow="Project · Stage 0 出口实践"
      />
      <div className="learning-document">
        <ProjectContent />
      </div>
      <ResourceLinks resources={resources} />
    </article>
  );
}
