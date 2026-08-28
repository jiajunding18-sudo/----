import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentContext } from "@/components/content/document-context";
import { ResourceLinks } from "@/components/content/resource-links";
import {
  getProjectCatalogItem,
  getProjectNextProjects,
  ProjectCapabilityOverview,
  ProjectKnowledgePanel,
} from "@/features/projects";
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
  const projectItem = getProjectCatalogItem(project.id);
  if (!projectItem) {
    notFound();
  }
  const tracks = getTracks(project.trackIds);
  const concepts = getConceptsForProject(project);
  const resources = getResources(project.resources.map(({ resourceId }) => resourceId));
  const nextProjects = getProjectNextProjects(project.id);

  return (
    <article className="mx-auto max-w-4xl">
      <DocumentContext
        backHref="/projects/"
        backLabel="返回 Projects"
        details={[
          projectItem.stages.map(({ title }) => title).join(" / "),
          tracks.map(({ title }) => title).join(" / ") || project.trackIds.join(" / "),
          `${concepts.length} 个关联 Concept`,
          `预计 ${project.estimatedHours.min}–${project.estimatedHours.max} 小时`,
        ]}
        eyebrow="Project · published（正式内容）"
      />
      <ProjectCapabilityOverview item={projectItem} />
      <ProjectKnowledgePanel project={project} requirements={concepts} />
      <div className="learning-document">
        <ProjectContent />
      </div>
      <ResourceLinks resources={resources} />
      {nextProjects.length > 0 ? (
        <section
          aria-labelledby="next-projects-title"
          className="mt-10 border-t border-[var(--color-border)] pt-7"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
            Route continuation
          </p>
          <h2 className="mt-2 text-2xl font-semibold" id="next-projects-title">
            Next Projects
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            仅从后续 Stage 的正式 projectGates 派生，不在项目正文中手工维护顺序。
          </p>
          <ul className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {nextProjects.map(({ href, project: nextProject, stage }) => (
              <li className="py-4" key={nextProject.id}>
                <Link
                  className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                  href={href}
                >
                  {nextProject.title}
                </Link>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {stage.title} · {nextProject.publicationStatus === "published" ? "已发布" : "已规划，正文未发布"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
