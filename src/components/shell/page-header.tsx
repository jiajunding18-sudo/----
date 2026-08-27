interface PageStatus {
  readonly label: string;
  readonly description: string;
}

interface PageHeaderProps {
  readonly description: string;
  readonly status?: PageStatus;
  readonly title: string;
}

export function PageHeader({ description, status, title }: PageHeaderProps) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-accent)] uppercase">
        Learning Workspace
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-[var(--color-ink)] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
        {description}
      </p>

      {status ? (
        <section
          aria-labelledby="page-status-title"
          className="mt-10 border-l-2 border-[var(--color-accent)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-subtle)]"
        >
          <h2
            className="text-sm font-semibold text-[var(--color-ink)]"
            id="page-status-title"
          >
            {status.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {status.description}
          </p>
        </section>
      ) : null}
    </div>
  );
}
