"use client";

import { useEffect } from "react";

import { useLearningStore } from "@/features/progress/learning-store-provider";

/** Restore a Project section after progress panels hydrate above the article. */
export function ProjectAnchorRestorer() {
  const hydrated = useLearningStore(({ hydrated: ready }) => ready);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const restore = async () => {
      const raw = window.location.hash.slice(1);
      let anchor: string;
      try { anchor = decodeURIComponent(raw); } catch { return; }
      if (!anchor.startsWith("section-")) return;
      await document.fonts.ready;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (!cancelled && window.location.hash.slice(1) === raw) {
          document.getElementById(anchor)?.scrollIntoView({ block: "start", behavior: "instant" });
        }
      }));
    };
    if (document.readyState === "complete") void restore();
    else window.addEventListener("load", restore, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", restore); };
  }, [hydrated]);

  return null;
}
