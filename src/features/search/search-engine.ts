import Fuse, { type FuseResult, type FuseResultMatch } from "fuse.js";

import type { SearchDocument, SearchKind } from "@/lib/search/search-schema";
import { normalizeSearchText } from "@/lib/search/search-text";

const kindPriority: Record<SearchKind, number> = {
  concept: 0,
  formula: 1,
  tool: 2,
  project: 3,
  resource: 4,
};

const fieldPriority = [
  "title",
  "englishTitle",
  "aliases",
  "keywords",
  "tags",
  "headings.title",
  "goals",
  "stageTitles",
  "trackTitles",
  "relatedTitles",
  "summary",
  "authorOrOrganization",
  "body",
  "tokens",
] as const;

type SearchField = (typeof fieldPriority)[number];

const fieldLabels: Record<SearchField, string> = {
  title: "标题",
  englishTitle: "英文名",
  aliases: "别名",
  keywords: "关键词",
  tags: "标签",
  "headings.title": "正文标题",
  goals: "目标",
  stageTitles: "Stage",
  trackTitles: "Track",
  relatedTitles: "关联内容",
  summary: "摘要",
  authorOrOrganization: "作者 / 机构",
  body: "正文",
  tokens: "分词",
};

function getExactOrPrefixMatch(document: SearchDocument, query: string) {
  const title = normalizeSearchText(document.title);
  const englishTitle = normalizeSearchText(document.englishTitle ?? "");
  const aliases = document.aliases.map((alias) => ({
    normalized: normalizeSearchText(alias),
    value: alias,
  }));

  if (title === query) {
    return { tier: 0, field: "title", text: document.title } as const;
  }
  if (englishTitle === query) {
    return {
      tier: 1,
      field: "englishTitle",
      text: document.englishTitle ?? document.title,
    } as const;
  }
  const exactAlias = aliases.find(({ normalized }) => normalized === query);
  if (exactAlias) {
    return { tier: 2, field: "aliases", text: exactAlias.value } as const;
  }
  if (title.startsWith(query)) {
    return { tier: 3, field: "title", text: document.title } as const;
  }
  if (englishTitle.startsWith(query)) {
    return {
      tier: 3,
      field: "englishTitle",
      text: document.englishTitle ?? document.title,
    } as const;
  }
  const prefixAlias = aliases.find(({ normalized }) =>
    normalized.startsWith(query),
  );
  if (prefixAlias) {
    return { tier: 3, field: "aliases", text: prefixAlias.value } as const;
  }
  return undefined;
}

function getDocumentField(
  document: SearchDocument,
  field: SearchField,
  refIndex?: number,
) {
  if (field === "headings.title") {
    return document.headings[refIndex ?? 0]?.title ?? "";
  }
  const value = document[field];
  if (Array.isArray(value)) {
    return value[refIndex ?? 0] ?? value[0] ?? "";
  }
  return typeof value === "string" ? value : "";
}

function toExcerpt(text: string, match?: FuseResultMatch) {
  const normalizedText = text.replace(/\s+/gu, " ").trim();
  if (normalizedText.length <= 180) {
    return normalizedText;
  }

  const start = match?.indices[0]?.[0] ?? 0;
  const excerptStart = Math.max(0, start - 55);
  const excerptEnd = Math.min(normalizedText.length, excerptStart + 170);
  return `${excerptStart > 0 ? "…" : ""}${normalizedText.slice(excerptStart, excerptEnd)}${excerptEnd < normalizedText.length ? "…" : ""}`;
}

function getFuseMatch(
  document: SearchDocument,
  matches: readonly FuseResultMatch[] | undefined,
) {
  const match = [...(matches ?? [])].sort(
    (left, right) =>
      fieldPriority.indexOf(left.key as SearchField) -
      fieldPriority.indexOf(right.key as SearchField),
  )[0];
  const field = (match?.key as SearchField | undefined) ?? "summary";
  const text = getDocumentField(document, field, match?.refIndex);
  return { field, refIndex: match?.refIndex, text: toExcerpt(text, match) } as const;
}

function getResultHref(
  document: SearchDocument,
  field: SearchField,
  refIndex?: number,
) {
  if (
    document.kind === "concept" &&
    document.href &&
    field === "headings.title"
  ) {
    const heading = document.headings[refIndex ?? 0];
    return heading ? `${document.href}#${heading.anchor}` : document.href;
  }
  return document.href;
}

export interface SearchResult {
  readonly document: SearchDocument;
  readonly href?: string;
  readonly matchTier: number;
  readonly matchField: SearchField;
  readonly matchLabel: string;
  readonly matchedText: string;
  readonly score: number;
}

export function searchDocuments(
  documents: readonly SearchDocument[],
  rawQuery: string,
): SearchResult[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) {
    return [];
  }

  const fuse = new Fuse(documents, {
    includeMatches: true,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 2,
    shouldSort: false,
    threshold: 0.32,
    keys: [
      { name: "title", weight: 0.3 },
      { name: "englishTitle", weight: 0.22 },
      { name: "aliases", weight: 0.2 },
      { name: "keywords", weight: 0.08 },
      { name: "tags", weight: 0.06 },
      { name: "headings.title", weight: 0.05 },
      { name: "goals", weight: 0.025 },
      { name: "stageTitles", weight: 0.012 },
      { name: "trackTitles", weight: 0.012 },
      { name: "relatedTitles", weight: 0.012 },
      { name: "summary", weight: 0.012 },
      { name: "authorOrOrganization", weight: 0.008 },
      { name: "body", weight: 0.004 },
      { name: "tokens", weight: 0.003 },
    ],
  });
  const fuseResults = new Map<string, FuseResult<SearchDocument>>(
    fuse.search(query).map((result) => [result.item.id, result]),
  );

  documents.forEach((document) => {
    if (getExactOrPrefixMatch(document, query) && !fuseResults.has(document.id)) {
      fuseResults.set(document.id, {
        item: document,
        refIndex: 0,
        score: 0,
        matches: [],
      });
    }
  });

  return [...fuseResults.values()]
    .map((result): SearchResult => {
      const deterministicMatch = getExactOrPrefixMatch(result.item, query);
      const fuseMatch = getFuseMatch(result.item, result.matches);
      const matchField = deterministicMatch?.field ?? fuseMatch.field;
      return {
        document: result.item,
        href: getResultHref(result.item, matchField, fuseMatch.refIndex),
        matchTier: deterministicMatch?.tier ?? 4,
        matchField,
        matchLabel: fieldLabels[matchField],
        matchedText: deterministicMatch?.text ?? fuseMatch.text,
        score: result.score ?? 1,
      };
    })
    .sort(
      (left, right) =>
        left.matchTier - right.matchTier ||
        left.score - right.score ||
        kindPriority[left.document.kind] - kindPriority[right.document.kind] ||
        left.document.id.localeCompare(right.document.id, "en"),
    );
}
