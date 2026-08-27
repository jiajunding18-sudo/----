import { resolve } from "node:path";

import {
  loadRepositoryContentManifest,
  writeContentManifest,
  writeContentModuleRegistry,
} from "../src/lib/content";

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
  const manifest = await loadRepositoryContentManifest({ workspaceRoot });
  const summary = `${manifest.concepts.length} concepts, ${manifest.projects.length} projects, ${manifest.stages.length} stages, ${manifest.tracks.length} tracks, ${manifest.resources.length} resources`;

  if (checkOnly) {
    console.log(`Content check passed: ${summary}`);
    return;
  }

  const [manifestResult, moduleRegistryResult] = await Promise.all([
    writeContentManifest(
      resolve(workspaceRoot, ".generated/content-manifest.ts"),
      manifest,
    ),
    writeContentModuleRegistry(
      resolve(workspaceRoot, ".generated/content-modules.ts"),
      manifest,
    ),
  ]);
  console.log(
    `Content manifest ${manifestResult.changed ? "generated" : "unchanged"}; MDX registry ${moduleRegistryResult.changed ? "generated" : "unchanged"}: ${summary}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
