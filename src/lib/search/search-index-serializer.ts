import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { SearchIndex } from "./search-schema";

export function serializeSearchIndex(index: SearchIndex) {
  return `${JSON.stringify(index, null, 2)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")}\n`;
}

export async function writeSearchIndex(
  outputPath: string,
  index: SearchIndex,
) {
  const nextContent = serializeSearchIndex(index);
  let currentContent: string | undefined;

  try {
    currentContent = await readFile(outputPath, "utf8");
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }

  if (currentContent === nextContent) {
    return { changed: false, outputPath } as const;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextContent, "utf8");
  return { changed: true, outputPath } as const;
}
