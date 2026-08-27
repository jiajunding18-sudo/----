"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavigationItemActive,
  type NavigationItem,
} from "./navigation";

interface NavigationListProps {
  readonly ariaLabel: string;
  readonly items: readonly NavigationItem[];
  readonly onNavigate?: () => void;
  readonly tone?: "dark" | "light";
}

export function NavigationList({
  ariaLabel,
  items,
  onNavigate,
  tone = "dark",
}: NavigationListProps) {
  const pathname = usePathname();
  const descriptionClassName =
    tone === "dark"
      ? "text-[var(--color-sidebar-muted)]"
      : "text-[var(--color-muted)]";

  return (
    <nav aria-label={ariaLabel}>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = isNavigationItemActive(pathname, item);
          const toneClassName =
            tone === "dark"
              ? isActive
                ? "border-white/80 bg-white/12 text-white"
                : "border-transparent text-[var(--color-sidebar-muted)] hover:bg-white/7 hover:text-white"
              : isActive
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]";

          return (
            <li key={item.href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-lg border-l-2 px-3 py-2.5 transition-colors ${toneClassName}`}
                href={item.href}
                onClick={onNavigate}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span
                  className={`mt-0.5 block text-xs ${descriptionClassName}`}
                >
                  {item.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
