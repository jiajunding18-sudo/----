import Link from "next/link";

import { NavigationList } from "./navigation-list";
import {
  primaryNavigation,
  resourcesNavigationItem,
  settingsNavigationItem,
} from "./navigation";

export function DesktopSidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[var(--color-sidebar)] px-4 py-5 md:flex"
      data-testid="desktop-sidebar"
    >
      <Link
        className="rounded-lg px-3 py-2 text-white focus-visible:outline-white"
        href="/"
      >
        <span className="block text-xs font-semibold tracking-[0.16em] text-[var(--color-sidebar-muted)] uppercase">
          Machine Vision
        </span>
        <span className="mt-1 block text-lg font-semibold tracking-[-0.02em]">
          Learning OS
        </span>
      </Link>

      <div className="mt-8">
        <p className="mb-2 px-3 text-xs font-semibold tracking-[0.12em] text-[var(--color-sidebar-muted)] uppercase">
          Workspace
        </p>
        <NavigationList ariaLabel="主导航" items={primaryNavigation} />
      </div>

      <div className="mt-auto border-t border-white/10 pt-4">
        <NavigationList
          ariaLabel="辅助导航"
          items={[resourcesNavigationItem, settingsNavigationItem]}
        />
      </div>
    </aside>
  );
}
