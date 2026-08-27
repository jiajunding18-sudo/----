import { z } from "zod";

import {
  resourceSchema,
  stageDefinitionSchema,
  trackDefinitionSchema,
} from "@/lib/validation";
import type { Resource, StageDefinition, TrackDefinition } from "@/types";

import { ContentValidationError } from "./content-errors";
import type { ContentValidationIssue } from "./content-errors";

function getIdentity(value: unknown, key: "id" | "slug") {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  if (key === "id" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  if (key === "slug" && "slug" in value && typeof value.slug === "string") {
    return value.slug;
  }
  return undefined;
}

function parseCatalogEntries<Output>(
  entries: readonly unknown[],
  schema: z.ZodType<Output>,
  sourcePath: string,
) {
  const output: Output[] = [];
  const issues: ContentValidationIssue[] = [];

  entries.forEach((entry, index) => {
    const result = schema.safeParse(entry);
    if (result.success) {
      output.push(result.data);
      return;
    }

    result.error.issues.forEach((issue) => {
      issues.push({
        sourcePath,
        fieldPath: [String(index), ...issue.path.map(String)].join("."),
        entityId: getIdentity(entry, "id"),
        slug: getIdentity(entry, "slug"),
        message: issue.message,
      });
    });
  });

  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }

  return output;
}

export function parseRepositoryCatalog({
  tracks,
  stages,
  resources,
}: {
  readonly tracks: readonly unknown[];
  readonly stages: readonly unknown[];
  readonly resources: readonly unknown[];
}): {
  readonly tracks: readonly TrackDefinition[];
  readonly stages: readonly StageDefinition[];
  readonly resources: readonly Resource[];
} {
  return {
    tracks: parseCatalogEntries(
      tracks,
      trackDefinitionSchema,
      "content/catalog/tracks.ts",
    ),
    stages: parseCatalogEntries(
      stages,
      stageDefinitionSchema,
      "content/catalog/stages.ts",
    ),
    resources: parseCatalogEntries(
      resources,
      resourceSchema,
      "content/catalog/resources.ts",
    ),
  };
}
