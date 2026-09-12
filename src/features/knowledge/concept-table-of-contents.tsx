"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { ContentHeading } from "@/lib/content/mdx-headings.mjs";
import { useLearningStore } from "@/features/progress/learning-store-provider";

interface ConceptTableOfContentsProps {
  readonly headings: readonly ContentHeading[];
  readonly variant: "desktop" | "mobile";
}

function readHashAnchor() {
  const hash = window.location.hash.slice(1);
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function TocLinks({
  activeAnchor,
  headings,
  onNavigate,
}: {
  readonly activeAnchor?: string;
  readonly headings: readonly ContentHeading[];
  readonly onNavigate: (anchor: string) => void;
}) {
  return (
    <ol className="mt-3 space-y-1.5 text-sm leading-5">
      {headings.map((heading) => {
        const isActive = heading.anchor === activeAnchor;
        return (
          <li
            className={heading.depth === 3 ? "pl-4" : undefined}
            key={heading.anchor}
          >
            <a
              aria-current={isActive ? "location" : undefined}
              className={`block border-l-2 py-1 pl-3 transition-colors motion-reduce:transition-none ${
                isActive
                  ? "border-[var(--color-accent)] font-semibold text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-ink)]"
              }`}
              href={`#${heading.anchor}`}
              onClick={() => onNavigate(heading.anchor)}
            >
              {heading.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function ConceptTableOfContents({
  headings,
  variant,
}: ConceptTableOfContentsProps) {
  const [activeAnchor, setActiveAnchor] = useState(headings[0]?.anchor);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const hydrated = useLearningStore(({ hydrated }) => hydrated);

  useEffect(() => {
    // SSR placeholders above the article change height on hydration. Native
    // history restoration can otherwise apply that displacement twice.
    if (!hydrated || (window.matchMedia("(min-width: 1280px)").matches !== (variant === "desktop"))) return;
    const anchor = readHashAnchor();
    if (!headings.some(heading => heading.anchor === anchor)) return;
    let cancelled = false;
    const restore = async () => {
      await document.fonts.ready;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (!cancelled && readHashAnchor() === anchor) {
          document.getElementById(anchor)?.scrollIntoView({ block: "start", behavior: "instant" });
        }
      }));
    };
    if (document.readyState === "complete") void restore();
    else window.addEventListener("load", restore, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", restore);
    };
  }, [headings, hydrated, variant]);

  useEffect(() => {
    const elements = headings
      .map(({ anchor }) => document.getElementById(anchor))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) {
      return;
    }

    let animationFrame = 0;
    const updateActiveHeading = () => {
      animationFrame = 0;
      const hashAnchor = readHashAnchor();
      const hashTarget = elements.find(({ id }) => id === hashAnchor);
      const activationLine = 132;
      const passedHeadings = elements.filter(
        (element) => element.getBoundingClientRect().top <= activationLine,
      );
      const nextActive =
        passedHeadings.at(-1)?.id ?? hashTarget?.id ?? elements[0]?.id;
      if (nextActive) {
        setActiveAnchor((current) =>
          current === nextActive ? current : nextActive,
        );
      }
    };
    const scheduleUpdate = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateActiveHeading);
      }
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("hashchange", scheduleUpdate);
    scheduleUpdate();

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const navigateToHeading = (anchor: string) => {
    setActiveAnchor(anchor);
    if (variant === "mobile") {
      detailsRef.current?.removeAttribute("open");
    }
    window.requestAnimationFrame(() => {
      document.getElementById(anchor)?.focus({ preventScroll: true });
    });
  };

  const handleDetailsKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape" && detailsRef.current?.open) {
      detailsRef.current.open = false;
      summaryRef.current?.focus();
    }
  };

  if (variant === "mobile") {
    return (
      <details
        className="mt-8 border-y border-[var(--color-border)] py-3 xl:hidden"
        data-concept-toc="mobile"
        onKeyDown={handleDetailsKeyDown}
        ref={detailsRef}
      >
        <summary
          className="cursor-pointer py-1 font-semibold text-[var(--color-ink)]"
          ref={summaryRef}
        >
          本页目录
        </summary>
        <nav aria-label="本页目录">
          <TocLinks
            activeAnchor={activeAnchor}
            headings={headings}
            onNavigate={navigateToHeading}
          />
        </nav>
      </details>
    );
  }

  return (
    <aside
      aria-label="页面章节目录"
      className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto border-l border-[var(--color-border)] pl-5 xl:block"
      data-concept-toc="desktop"
    >
      <nav aria-label="本页目录">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
          本页目录
        </p>
        <TocLinks
          activeAnchor={activeAnchor}
          headings={headings}
          onNavigate={navigateToHeading}
        />
      </nav>
    </aside>
  );
}
