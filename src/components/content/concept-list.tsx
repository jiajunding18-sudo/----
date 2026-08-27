import Link from "next/link";

import type { ConceptManifestEntry, DeepReadonly } from "@/lib/content/manifest-types";
import type { StageDefinition, TrackDefinition } from "@/types";

interface ConceptListProps {
  readonly concepts: readonly ConceptManifestEntry[];
  readonly stages: readonly DeepReadonly<StageDefinition>[];
  readonly tracks: readonly DeepReadonly<TrackDefinition>[];
}

export function ConceptList({ concepts, stages, tracks }: ConceptListProps) {
  const stageTitles = new Map(stages.map((stage) => [stage.id, stage.title]));
  const trackTitles = new Map(tracks.map((track) => [track.id, track.title]));

  return (
    <ol className="mt-8 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
      {concepts.map((concept, index) => (
        <li className="py-6" key={concept.id}>
          <article className="grid gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-start">
            <p className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">
              {String(index + 1).padStart(2, "0")}
            </p>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                <Link
                  className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                  href={`/knowledge/${concept.slug}/`}
                >
                  {concept.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {concept.englishTitle}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                {concept.summary}
              </p>
              <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
                {stageTitles.get(concept.stageId) ?? concept.stageId}
                {" · "}
                {concept.trackIds
                  .map((trackId) => trackTitles.get(trackId) ?? trackId)
                  .join(" / ")}
                {" · 顺序 "}
                {concept.order}
              </p>
            </div>
            <span className="w-fit rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
              可访问
            </span>
          </article>
        </li>
      ))}
    </ol>
  );
}
