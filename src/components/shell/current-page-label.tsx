"use client";

import { usePathname } from "next/navigation";

import { resolveCurrentNavigationItem } from "./navigation";

export function CurrentPageLabel() {
  const pathname = usePathname();
  const currentItem = resolveCurrentNavigationItem(pathname);

  return (
    <span className="truncate text-sm font-semibold text-[var(--color-ink)]">
      {currentItem?.label ?? "Learning OS"}
    </span>
  );
}
