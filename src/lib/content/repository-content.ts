import { resolve } from "node:path";
import { stageRetests } from "../../../content/catalog/stage-retests";

import {
  resources as repositoryResources,
  stages as repositoryStages,
  tracks as repositoryTracks,
} from "../../../content/catalog";
import { conceptMetaSchema, projectMetaSchema } from "@/lib/validation";

import { parseRepositoryCatalog } from "./catalog-loader";
import { buildContentManifest } from "./manifest-builder";
import { loadMdxDirectory } from "./mdx-loader";

export async function loadRepositoryContent({
  workspaceRoot = process.cwd(),
}: {
  readonly workspaceRoot?: string;
} = {}) {
  const absoluteWorkspaceRoot = resolve(workspaceRoot);
  const [concepts, projects] = await Promise.all([
    loadMdxDirectory({
      directoryPath: resolve(absoluteWorkspaceRoot, "content/concepts"),
      workspaceRoot: absoluteWorkspaceRoot,
      schema: conceptMetaSchema,
    }),
    loadMdxDirectory({
      directoryPath: resolve(absoluteWorkspaceRoot, "content/projects"),
      workspaceRoot: absoluteWorkspaceRoot,
      schema: projectMetaSchema,
    }),
  ]);
  const catalog = parseRepositoryCatalog({
    tracks: repositoryTracks,
    stages: repositoryStages,
    resources: repositoryResources,
  });

  const input = { concepts, projects, ...catalog, stageRetests };
  return { input, manifest: buildContentManifest(input) } as const;
}

export async function loadRepositoryContentManifest(options: {
  readonly workspaceRoot?: string;
} = {}) {
  return (await loadRepositoryContent(options)).manifest;
}
