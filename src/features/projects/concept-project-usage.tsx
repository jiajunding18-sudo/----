import Link from "next/link";

import type { getConceptProjectUsage } from "./project-content";

type ConceptProjectUsageView = ReturnType<typeof getConceptProjectUsage>;

export function ConceptProjectUsage({
  projects,
}: {
  readonly projects: ConceptProjectUsageView;
}) {
  return (
    <section
      aria-labelledby="concept-project-usage-title"
      className="mb-10 border-y border-[var(--color-border)] py-6"
      data-concept-project-usage
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Concept → Project
      </p>
      <h2 className="mt-2 text-xl font-semibold" id="concept-project-usage-title">
        这项知识以后会用在哪里
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        下列关系只从 Project requirements 反向派生，不在 Concept 中维护第二份项目清单。
      </p>
      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          当前正式 Project requirements 尚未引用这项知识。
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {projects.map(({ href, project, requirement }) => (
            <li className="py-4" data-concept-project-id={project.id} key={project.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                  href={href}
                >
                  {project.title}
                </Link>
                <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold">
                  {requirement.kind} · 需要
                  {requirement.minimumStatus === "mastered" ? "已掌握" : "已理解"}
                </span>
                {project.publicationStatus === "draft" ? (
                  <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)]">
                    planned · 项目正文尚未发布
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                {requirement.reason}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                能力方向：{project.capabilitySummary[0]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
