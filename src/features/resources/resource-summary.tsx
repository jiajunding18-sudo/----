import Link from "next/link";

import type {
  ResourceCatalogItem,
  ResourceGuidanceItem,
} from "./resource-model";

const typeLabels = {
  "official-doc": "官方文档",
  course: "公开课程",
  book: "教材 / 书籍",
  repository: "开源项目",
  video: "视频",
  article: "文章",
  paper: "论文",
  dataset: "Dataset",
} as const;

const levelLabels = {
  beginner: "入门",
  intermediate: "中级",
  advanced: "高级",
} as const;

const priorityLabels = {
  essential: "优先学习",
  recommended: "推荐学习",
  optional: "按需选读",
} as const;

const languageLabels = {
  "zh-CN": "中文",
  en: "英文",
  bilingual: "双语",
  other: "其他语言",
} as const;

const projectRoleLabels = {
  dataset: "Dataset",
  documentation: "环境 / API 文档",
  course: "相关教程",
  repository: "参考仓库",
  reference: "参考资料",
} as const;

function VerificationSummary({ item }: { readonly item: ResourceCatalogItem }) {
  const { resource } = item;
  if (resource.verification === "verified") {
    return (
      <span className="rounded-full border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
        已核验 · {resource.lastCheckedAt}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
      {resource.verification === "pending" ? "待核验" : "已失效"}
      {resource.lastCheckedAt ? ` · ${resource.lastCheckedAt}` : ""}
    </span>
  );
}

function RelationContext({ guidance }: { readonly guidance?: ResourceGuidanceItem }) {
  if (!guidance) {
    return null;
  }
  if (guidance.relation.kind === "concept") {
    return (
      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-accent)] uppercase">
        推荐顺序 {guidance.relation.recommendationOrder}
      </p>
    );
  }
  const { reference } = guidance.relation;
  return (
    <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-accent)] uppercase">
      {reference.required ? "项目必需" : "项目可选"} · {projectRoleLabels[reference.role]}
    </p>
  );
}

function ResourceAccess({ item }: { readonly item: ResourceCatalogItem }) {
  const { resource } = item;
  if (resource.verification === "verified") {
    return (
      <a
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:bg-[var(--color-accent-soft)]"
        href={resource.url}
        rel="noreferrer"
        target="_blank"
      >
        打开外部资源
        <span className="sr-only">（在新窗口打开）</span>
      </a>
    );
  }
  if (resource.verification === "pending" && resource.url) {
    return (
      <a
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-muted)] underline-offset-4"
        href={resource.url}
        rel="noreferrer"
        target="_blank"
      >
        查看待核验链接
        <span className="sr-only">（在新窗口打开）</span>
      </a>
    );
  }
  return null;
}

export function ResourceSummary({
  guidance,
  item,
}: {
  readonly guidance?: ResourceGuidanceItem;
  readonly item: ResourceCatalogItem;
}) {
  const { resource } = item;
  const verificationNote =
    resource.verification === "verified" ? undefined : resource.verificationNote;

  return (
    <article
      className="min-w-0 py-7"
      data-resource-id={resource.id}
      id={`resource-${resource.id}`}
    >
      <RelationContext guidance={guidance} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">
            {resource.verification === "verified" ? (
              <a
                className="text-[var(--color-accent)] underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                href={resource.url}
                rel="noreferrer"
                target="_blank"
              >
                {resource.title}
                <span className="sr-only">（在新窗口打开）</span>
              </a>
            ) : (
              resource.title
            )}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {resource.authorOrOrganization ?? "来源尚未记录"}
          </p>
        </div>
        <VerificationSummary item={item} />
      </div>

      <dl className="mt-4 grid gap-x-5 gap-y-3 text-xs leading-5 text-[var(--color-muted)] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-semibold text-[var(--color-ink)]">类型</dt>
          <dd>{typeLabels[resource.type]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--color-ink)]">难度</dt>
          <dd>{levelLabels[resource.level]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--color-ink)]">推荐程度</dt>
          <dd>{priorityLabels[resource.priority]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--color-ink)]">语言</dt>
          <dd>{languageLabels[resource.language]}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold">为什么推荐</h4>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {resource.reason}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">建议学习范围</h4>
          {resource.recommendedParts && resource.recommendedParts.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--color-muted)]">
              {resource.recommendedParts.map((part) => (
                <li key={part}>{part}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              当前未限定具体章节，使用前请先确认与学习目标相关的部分。
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-4 text-sm sm:grid-cols-2">
        <div>
          <h4 className="font-semibold">对应知识</h4>
          {item.concepts.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[var(--color-muted)]">
              {item.concepts.map(({ concept, recommendationOrder }) => (
                <li key={concept.id}>
                  <Link
                    className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                    href={`/knowledge/${concept.slug}/`}
                  >
                    {concept.title}
                  </Link>{" "}
                  · 顺序 {recommendationOrder}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[var(--color-muted)]">无正式 Concept 关系</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold">对应项目</h4>
          {item.projects.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[var(--color-muted)]">
              {item.projects.map(({ project, reference }) => (
                <li key={project.id}>
                  <Link
                    className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
                    href={`/projects/${project.slug}/`}
                  >
                    {project.title}
                  </Link>{" "}
                  · {projectRoleLabels[reference.role]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[var(--color-muted)]">无正式 Project 关系</p>
          )}
        </div>
      </div>

      {verificationNote ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]" role="note">
          链接状态说明：{verificationNote}
        </p>
      ) : null}
      <div className="mt-5">
        <ResourceAccess item={item} />
      </div>
    </article>
  );
}

export function ResourceGuidanceList({
  description,
  items,
  title = "精选学习资源",
}: {
  readonly description: string;
  readonly items: readonly ResourceGuidanceItem[];
  readonly title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside
      aria-labelledby="resource-guidance-title"
      className="mt-12 border-t border-[var(--color-border)] pt-8"
    >
      <h2 className="text-2xl font-semibold tracking-[-0.02em]" id="resource-guidance-title">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
        {description}
      </p>
      <div className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {items.map((guidance) => (
          <ResourceSummary
            guidance={guidance}
            item={guidance.item}
            key={guidance.item.resource.id}
          />
        ))}
      </div>
    </aside>
  );
}
