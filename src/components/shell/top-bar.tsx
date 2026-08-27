import Link from "next/link";

import { CurrentPageLabel } from "./current-page-label";
import { MobileNavigation } from "./mobile-navigation";
import { searchNavigationItem } from "./navigation";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[92rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <MobileNavigation />
          <CurrentPageLabel />
        </div>

        <Link
          aria-label="Search / 搜索"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-ink)] sm:min-w-40 sm:justify-start"
          href={searchNavigationItem.href}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
          <span>Search</span>
        </Link>
      </div>
    </header>
  );
}
