import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";

export interface ContentHeading {
  readonly depth: 2 | 3;
  readonly title: string;
  readonly anchor: string;
}

type UnknownRecord = Record<string, unknown>;

const headingParser = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getChildren(node: UnknownRecord) {
  return Array.isArray(node.children)
    ? node.children.filter(isRecord)
    : [];
}

function getHeadingText(node: UnknownRecord): string {
  if (
    (node.type === "text" || node.type === "inlineCode") &&
    typeof node.value === "string"
  ) {
    return node.value;
  }
  if (node.type === "image" && typeof node.alt === "string") {
    return node.alt;
  }
  return getChildren(node).map(getHeadingText).join("");
}

export function createHeadingAnchorBase(title: string) {
  const slug = title
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’']/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return `section-${slug || "untitled"}`;
}

function createUniqueAnchor(base: string, usedAnchors: Set<string>) {
  let candidate = base;
  let suffix = 2;

  while (usedAnchors.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedAnchors.add(candidate);
  return candidate;
}

function setHeadingId(node: UnknownRecord, anchor: string) {
  const data = isRecord(node.data) ? node.data : {};
  const hProperties = isRecord(data.hProperties) ? data.hProperties : {};
  hProperties.id = anchor;
  data.hProperties = hProperties;
  node.data = data;
}

export function collectContentHeadings(
  tree: unknown,
  { applyIds = false }: { readonly applyIds?: boolean } = {},
): ContentHeading[] {
  if (!isRecord(tree)) {
    return [];
  }

  const headings: ContentHeading[] = [];
  const usedAnchors = new Set<string>();

  function visit(node: UnknownRecord) {
    if (
      node.type === "heading" &&
      (node.depth === 2 || node.depth === 3)
    ) {
      const title = getHeadingText(node).replace(/\s+/gu, " ").trim();
      if (title) {
        const anchor = createUniqueAnchor(
          createHeadingAnchorBase(title),
          usedAnchors,
        );
        headings.push({ depth: node.depth, title, anchor });
        if (applyIds) {
          setHeadingId(node, anchor);
        }
      }
    }

    getChildren(node).forEach(visit);
  }

  visit(tree);
  return headings;
}

export function extractMdxHeadings(body: string) {
  const tree = headingParser.parse(body);
  return collectContentHeadings(tree);
}

function getMdxJsxHref(node: UnknownRecord) {
  if (
    (node.type !== "mdxJsxTextElement" && node.type !== "mdxJsxFlowElement") ||
    node.name !== "a" ||
    !Array.isArray(node.attributes)
  ) {
    return undefined;
  }

  const hrefAttribute = node.attributes.find(
    (attribute) =>
      isRecord(attribute) &&
      attribute.type === "mdxJsxAttribute" &&
      attribute.name === "href",
  );
  return isRecord(hrefAttribute) && typeof hrefAttribute.value === "string"
    ? hrefAttribute.value
    : undefined;
}

export function extractMdxLinks(body: string) {
  const tree = headingParser.parse(body);
  const links: string[] = [];

  function visit(node: UnknownRecord) {
    const href =
      node.type === "link" && typeof node.url === "string"
        ? node.url
        : getMdxJsxHref(node);
    if (href) links.push(href);
    getChildren(node).forEach(visit);
  }

  if (isRecord(tree)) visit(tree);
  return links;
}

export function remarkStableHeadingAnchors() {
  return (tree: unknown) => {
    collectContentHeadings(tree, { applyIds: true });
  };
}
