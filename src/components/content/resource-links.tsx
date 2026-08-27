import type { DeepReadonly } from "@/lib/content/manifest-types";
import type { Resource } from "@/types";

interface ResourceLinksProps {
  readonly resources: readonly DeepReadonly<Resource>[];
}

export function ResourceLinks({ resources }: ResourceLinksProps) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <aside
      aria-labelledby="verified-resources-title"
      className="mt-12 border-t border-[var(--color-border)] pt-8"
    >
      <h2 className="text-2xl font-semibold tracking-[-0.02em]" id="verified-resources-title">
        关联的已验证资源
      </h2>
      <ul className="mt-5 space-y-5">
        {resources.map((resource) => (
          <li key={resource.id}>
            {resource.verification === "verified" ? (
              <a
                className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                href={resource.url}
                rel="noreferrer"
                target="_blank"
              >
                {resource.title}
                <span className="sr-only">（在新窗口打开）</span>
              </a>
            ) : (
              <span className="font-semibold">{resource.title}</span>
            )}
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              {resource.reason}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
