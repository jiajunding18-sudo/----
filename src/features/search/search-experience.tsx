"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  searchIndexSchema,
  type SearchDocument,
  type SearchKind,
} from "@/lib/search/search-schema";
import { normalizeSearchText } from "@/lib/search/search-text";

import type { SearchResult } from "./search-engine";

type SearchState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly results: readonly SearchResult[] };

const groupDefinitions: readonly {
  readonly id: string;
  readonly title: string;
  readonly kinds: readonly SearchKind[];
}[] = [
  {
    id: "knowledge",
    title: "Knowledge",
    kinds: ["concept", "formula", "tool"],
  },
  { id: "projects", title: "Projects", kinds: ["project"] },
  { id: "resources", title: "Resources", kinds: ["resource"] },
];

const kindLabels: Record<SearchKind, string> = {
  concept: "Concept",
  project: "Project",
  resource: "Resource",
  formula: "Formula",
  tool: "Tool",
};

const statusLabels = {
  available: "available · 正式内容",
  verified: "verified · 已核验资源",
  pending: "pending · 待核验资源",
  broken: "broken · 链接已失效",
} as const;

let searchRuntimePromise:
  | Promise<{
      readonly documents: readonly SearchDocument[];
      readonly search: typeof import("./search-engine").searchDocuments;
    }>
  | undefined;

function loadSearchRuntime() {
  if (!searchRuntimePromise) {
    searchRuntimePromise = Promise.all([
      fetch("/_generated/search-index.json", { cache: "force-cache" }).then(
        async (response) => {
          if (!response.ok) {
            throw new Error(`搜索索引加载失败（HTTP ${response.status}）`);
          }
          return searchIndexSchema.parse(await response.json());
        },
      ),
      import("./search-engine"),
    ])
      .then(([index, engine]) => ({
        documents: index.documents,
        search: engine.searchDocuments,
      }))
      .catch((error: unknown) => {
        searchRuntimePromise = undefined;
        throw error;
      });
  }
  return searchRuntimePromise;
}

function SearchResultLink({ result }: { readonly result: SearchResult }) {
  const content = (
    <>
      {result.document.title}
      {result.document.external ? (
        <span className="ml-2 text-xs font-normal">↗</span>
      ) : null}
    </>
  );
  const className =
    "text-lg font-semibold underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-accent)]";

  if (!result.document.href) {
    return <span className="text-lg font-semibold">{content}</span>;
  }
  if (result.document.external) {
    return (
      <a
        className={className}
        href={result.document.href}
        rel="noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }
  return (
    <Link className={className} href={result.document.href}>
      {content}
    </Link>
  );
}

function SearchResultItem({ result }: { readonly result: SearchResult }) {
  const context = [
    ...result.document.stageTitles,
    ...result.document.trackTitles,
  ];

  return (
    <li
      className="py-6"
      data-search-kind={result.document.kind}
      data-search-result-id={result.document.id}
    >
      <article className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
              {kindLabels[result.document.kind]}
            </span>
            <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)]">
              {statusLabels[result.document.status]}
            </span>
          </div>
          <h3 className="mt-3">
            <SearchResultLink result={result} />
          </h3>
          {result.document.englishTitle ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {result.document.englishTitle}
            </p>
          ) : null}
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            {result.document.summary}
          </p>
          {context.length > 0 ? (
            <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
              {context.join(" · ")}
            </p>
          ) : null}
        </div>
        <p className="max-w-xs text-xs leading-5 text-[var(--color-muted)] sm:text-right">
          <span className="font-semibold text-[var(--color-ink)]">
            命中{result.matchLabel}
          </span>
          <br />
          {result.matchedText || result.document.title}
        </p>
      </article>
    </li>
  );
}

function SearchResults({
  query,
  results,
}: {
  readonly query: string;
  readonly results: readonly SearchResult[];
}) {
  if (results.length === 0) {
    return (
      <section className="mt-8 border-y border-[var(--color-border)] py-10" data-search-empty="no-results">
        <h2 className="text-xl font-semibold">没有找到“{query}”</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
          尝试使用正式英文名、更短的关键词或已有 alias。搜索不会生成 AI 答案，也不会把 planned Concept 或 draft Project 伪装成可学习内容。
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-[var(--color-accent)]">
          <Link className="underline underline-offset-4" href="/knowledge/">
            浏览 Knowledge
          </Link>
          <Link className="underline underline-offset-4" href="/roadmap/">
            查看 Roadmap
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-8">
      <p aria-live="polite" className="text-sm text-[var(--color-muted)]" data-search-result-count={results.length}>
        找到 {results.length} 个结果；按可解释匹配强度排序，并按内容类型分组。
      </p>
      {groupDefinitions.map((group) => {
        const groupResults = results.filter(({ document }) =>
          group.kinds.includes(document.kind),
        );
        if (groupResults.length === 0) {
          return null;
        }
        return (
          <section className="mt-9" data-search-group={group.id} key={group.id}>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">
                {group.title}
              </h2>
              <p className="text-xs font-semibold text-[var(--color-muted)]">
                {groupResults.length} 项
              </p>
            </div>
            <ol className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {groupResults.map((result) => (
                <SearchResultItem key={result.document.id} result={result} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function SearchQueryResults({ query }: { readonly query: string }) {
  const [state, setState] = useState<SearchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadSearchRuntime()
      .then(({ documents, search }) => {
        if (!cancelled) {
          setState({ status: "ready", results: search(documents, query) });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (state.status === "loading") {
    return (
      <p aria-live="polite" className="mt-8 text-sm text-[var(--color-muted)]">
        正在加载本地搜索索引…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mt-8 border-y border-[var(--color-border)] py-9" role="alert">
        <h2 className="text-lg font-semibold">搜索索引暂时不可用</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {state.message}。开发环境可运行 npm run content:build 重新生成索引。
        </p>
      </div>
    );
  }
  return <SearchResults query={query} results={state.results} />;
}

export function SearchExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const normalizedQuery = normalizeSearchText(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = String(formData.get("q") ?? "").trim();
    router.push(nextQuery ? `/search/?q=${encodeURIComponent(nextQuery)}` : "/search/");
  }

  return (
    <section aria-labelledby="search-form-title" className="mt-10">
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold" id="search-form-title">
          搜索正式内容
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          支持中文、英文、正式 alias、缩写与正文标题。搜索完全在浏览器中运行，索引来自本次构建的正式内容。
        </p>
      </div>

      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch} role="search">
        <label className="min-w-0 flex-1 text-sm font-semibold" htmlFor="site-search-query">
          搜索词
          <input
            autoComplete="off"
            className="mt-2 block min-h-12 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            defaultValue={query}
            key={query}
            id="site-search-query"
            name="q"
            placeholder="例如：Python、Systematic Debugging、WSL"
            type="search"
          />
        </label>
        <button
          className="min-h-12 self-end rounded-md bg-[var(--color-accent)] px-6 text-sm font-semibold text-white hover:brightness-95"
          type="submit"
        >
          搜索
        </button>
      </form>

      {normalizedQuery ? (
        <button
          className="mt-3 text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4"
          onClick={() => router.push("/search/")}
          type="button"
        >
          清除搜索
        </button>
      ) : null}

      {!normalizedQuery ? (
        <div className="mt-8 border-y border-[var(--color-border)] py-9" data-search-empty="initial">
          <h2 className="text-lg font-semibold">输入一个真实术语开始查找</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            可以从中文标题、英文名称、alias、工具缩写或项目名开始。空搜索不会列出全部内容，避免把搜索页变成第二份 catalog。
          </p>
        </div>
      ) : null}
      {normalizedQuery ? <SearchQueryResults key={query} query={query} /> : null}
    </section>
  );
}
