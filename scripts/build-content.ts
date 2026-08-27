import { resolve } from "node:path";

import {
  loadRepositoryContent,
  writeContentManifest,
  writeContentModuleRegistry,
} from "../src/lib/content";
import { buildSearchIndex, writeSearchIndex } from "../src/lib/search";

async function main() {
  const supportedArguments = new Set(["--check"]);
  const argumentsFromCommandLine = process.argv.slice(2);
  const unknownArgument = argumentsFromCommandLine.find(
    (argument) => !supportedArguments.has(argument),
  );

  if (unknownArgument) {
    throw new Error(`未知参数：${unknownArgument}`);
  }

  const checkOnly = argumentsFromCommandLine.includes("--check");
  const workspaceRoot = process.cwd();
  const { input, manifest } = await loadRepositoryContent({ workspaceRoot });
  const searchIndex = buildSearchIndex(input, manifest);
  const summary = `${manifest.concepts.length} concepts, ${manifest.projects.length} projects, ${manifest.stages.length} stages, ${manifest.tracks.length} tracks, ${manifest.resources.length} resources, ${searchIndex.documents.length} search documents`;

  if (checkOnly) {
    console.log(`Content check passed: ${summary}`);
    return;
  }

  const [manifestResult, moduleRegistryResult, searchIndexResult] = await Promise.all([
    writeContentManifest(
      resolve(workspaceRoot, ".generated/content-manifest.ts"),
      manifest,
    ),
    writeContentModuleRegistry(
      resolve(workspaceRoot, ".generated/content-modules.ts"),
      manifest,
    ),
    writeSearchIndex(
      resolve(workspaceRoot, "public/_generated/search-index.json"),
      searchIndex,
    ),
  ]);
  console.log(
    `Content manifest ${manifestResult.changed ? "generated" : "unchanged"}; MDX registry ${moduleRegistryResult.changed ? "generated" : "unchanged"}; search index ${searchIndexResult.changed ? "generated" : "unchanged"}: ${summary}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
