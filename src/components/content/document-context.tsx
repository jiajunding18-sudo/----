import Link from "next/link";

interface DocumentContextProps {
  readonly backHref: string;
  readonly backLabel: string;
  readonly details: readonly string[];
  readonly eyebrow: string;
}

export function DocumentContext({
  backHref,
  backLabel,
  details,
  eyebrow,
}: DocumentContextProps) {
  return (
    <header className="mb-8 border-b border-[var(--color-border)] pb-6">
      <Link
        className="text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4"
        href={backHref}
      >
        ← {backLabel}
      </Link>
      <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-[var(--color-accent)] uppercase">
        {eyebrow}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {details.join(" · ")}
      </p>
    </header>
  );
}
