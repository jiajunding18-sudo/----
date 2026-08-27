import Link from "next/link";

interface ContentStateProps {
  readonly description: string;
  readonly link?: {
    readonly href: string;
    readonly label: string;
  };
  readonly title: string;
}

export function ContentState({ description, link, title }: ContentStateProps) {
  return (
    <section
      aria-labelledby="content-state-title"
      className="mt-8 max-w-3xl border-l-2 border-[var(--color-accent)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-subtle)]"
    >
      <h2 className="text-base font-semibold" id="content-state-title">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        {description}
      </p>
      {link ? (
        <Link
          className="mt-4 inline-flex font-semibold text-[var(--color-accent)] underline decoration-1 underline-offset-4"
          href={link.href}
        >
          {link.label}
        </Link>
      ) : null}
    </section>
  );
}
