import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import { z } from "zod";

import { ContentValidationError } from "./content-errors";
import type { LoadedMdxEntity } from "./manifest-types";

const mdxParser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter, ["yaml"]);

function toPortablePath(path: string) {
  return path.split(sep).join("/");
}

function getSourcePath(workspaceRoot: string, absolutePath: string) {
  const sourcePath = relative(workspaceRoot, absolutePath);
  if (sourcePath === "" || sourcePath.startsWith("..") || resolve(workspaceRoot, sourcePath) !== absolutePath) {
    throw new Error(`内容文件不在工作区内：${absolutePath}`);
  }
  return toPortablePath(sourcePath);
}

async function scanDirectory(directoryPath: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  const sortedEntries = entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  );
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await scanDirectory(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(entryPath);
    }
  }

  return files;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadMdxFile<Meta>(
  absolutePath: string,
  workspaceRoot: string,
  schema: z.ZodType<Meta>,
): Promise<LoadedMdxEntity<Meta>> {
  const sourcePath = getSourcePath(workspaceRoot, absolutePath);
  const source = await readFile(absolutePath, "utf8");
  const file = new VFile({ path: sourcePath, value: source });

  try {
    matter(file, { strip: true });
    const tree = mdxParser.parse(file);
    mdxParser.runSync(tree, file);
  } catch (error) {
    throw new ContentValidationError([
      {
        sourcePath,
        fieldPath: "<mdx>",
        message: `无法解析 MDX 或 YAML frontmatter：${errorMessage(error)}`,
      },
    ]);
  }

  const parsed = schema.safeParse(file.data.matter);
  if (!parsed.success) {
    throw new ContentValidationError(
      parsed.error.issues.map((issue) => ({
        sourcePath,
        fieldPath:
          issue.path.length === 0 ? "<frontmatter>" : issue.path.map(String).join("."),
        message: issue.message,
        entityId:
          typeof file.data.matter === "object" &&
          file.data.matter !== null &&
          "id" in file.data.matter &&
          typeof file.data.matter.id === "string"
            ? file.data.matter.id
            : undefined,
        slug:
          typeof file.data.matter === "object" &&
          file.data.matter !== null &&
          "slug" in file.data.matter &&
          typeof file.data.matter.slug === "string"
            ? file.data.matter.slug
            : undefined,
      })),
    );
  }

  return {
    meta: parsed.data,
    sourcePath,
    body: String(file),
  };
}

export async function loadMdxDirectory<Meta>({
  directoryPath,
  workspaceRoot,
  schema,
}: {
  readonly directoryPath: string;
  readonly workspaceRoot: string;
  readonly schema: z.ZodType<Meta>;
}): Promise<LoadedMdxEntity<Meta>[]> {
  const absoluteWorkspaceRoot = resolve(workspaceRoot);
  const absoluteDirectoryPath = resolve(directoryPath);
  const files = await scanDirectory(absoluteDirectoryPath);
  const loaded: LoadedMdxEntity<Meta>[] = [];

  for (const filePath of files) {
    loaded.push(await loadMdxFile(filePath, absoluteWorkspaceRoot, schema));
  }

  return loaded;
}
