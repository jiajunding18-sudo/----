import Link from "next/link";

import type { ProjectCatalogItemView } from "./project-model";

export function ProjectCapabilityOverview({
  item,
}: {
  readonly item: ProjectCatalogItemView;
}) {
  return (
    <section
      aria-labelledby="project-capability-title"
      className="mb-10 border-y border-[var(--color-border)] py-7"
      data-project-capability-overview
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
        Capability map
      </p>
      <h2 className="mt-2 text-2xl font-semibold" id="project-capability-title">
        从现实问题到能力证据
      </h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="project-problem-title">
          <h3 className="text-base font-semibold" id="project-problem-title">
            要解决的现实问题
          </h3>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            {item.project.problemStatement}
          </p>
        </section>
        <section aria-labelledby="project-capabilities-title">
          <h3 className="text-base font-semibold" id="project-capabilities-title">
            做完后证明的能力
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
            {item.project.capabilitySummary.map((capability) => (
              <li className="flex gap-3" key={capability}>
                <span aria-hidden="true" className="text-[var(--color-accent)]">—</span>
                <span>{capability}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="project-applications-title">
          <h3 className="text-base font-semibold" id="project-applications-title">
            Real-world Connection
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
            {item.project.realWorldApplications.map((application) => (
              <li className="flex gap-3" key={application}>
                <span aria-hidden="true" className="text-[var(--color-accent)]">—</span>
                <span>{application}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="project-route-title">
          <h3 className="text-base font-semibold" id="project-route-title">
            所属路线
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
            {item.stages.map((stage) => (
              <li key={stage.id}>
                <Link
                  className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                  href={`/roadmap/#roadmap-stage-${stage.id}`}
                >
                  {stage.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

