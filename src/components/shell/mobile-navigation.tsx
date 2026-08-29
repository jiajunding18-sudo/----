"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { NavigationList } from "./navigation-list";
import {
  primaryNavigation,
  resourcesNavigationItem,
  settingsNavigationItem,
} from "./navigation";

export function MobileNavigation() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [pathname]);

  const openNavigation = () => {
    dialogRef.current?.showModal();
  };

  const closeNavigation = () => {
    dialogRef.current?.close();
  };

  const restoreTriggerFocus = () => {
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        aria-controls="mobile-navigation-dialog"
        aria-haspopup="dialog"
        aria-label="打开导航"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-ink)] md:hidden"
        onClick={openNavigation}
        ref={triggerRef}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
        导航
      </button>

      <dialog
        aria-labelledby="mobile-navigation-title"
        className="mobile-navigation-dialog"
        id="mobile-navigation-dialog"
        onClose={restoreTriggerFocus}
        ref={dialogRef}
      >
        <div className="flex min-h-dvh flex-col bg-[var(--color-surface)] px-5 py-5">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-accent)] uppercase">
                Machine Vision
              </p>
              <h2
                className="mt-1 text-xl font-semibold text-[var(--color-ink)]"
                id="mobile-navigation-title"
              >
                Learning OS
              </h2>
            </div>
            <button
              aria-label="关闭导航"
              autoFocus
              className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink)]"
              onClick={closeNavigation}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>

          <div className="mt-6">
            <p className="mb-2 px-3 text-xs font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">
              Workspace
            </p>
            <NavigationList
              ariaLabel="移动端主导航"
              items={primaryNavigation}
              onNavigate={closeNavigation}
              tone="light"
            />
          </div>

          <div className="mt-auto border-t border-[var(--color-border)] pt-4">
            <NavigationList
              ariaLabel="移动端辅助导航"
              items={[resourcesNavigationItem, settingsNavigationItem]}
              onNavigate={closeNavigation}
              tone="light"
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
