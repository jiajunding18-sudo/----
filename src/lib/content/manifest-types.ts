import type {
  ConceptMeta,
  Dependency,
  ProjectMeta,
  Resource,
  StageDefinition,
  TrackDefinition,
} from "@/types";

import type { ContentHeading } from "./mdx-headings.mjs";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ConceptManifestEntry = DeepReadonly<
  ConceptMeta & { sourcePath: string; headings: ContentHeading[] }
>;
export type ProjectManifestEntry = DeepReadonly<
  ProjectMeta & { sourcePath: string }
>;

export interface ContentManifest {
  readonly schemaVersion: 1;
  readonly concepts: readonly ConceptManifestEntry[];
  readonly projects: readonly ProjectManifestEntry[];
  readonly tracks: readonly DeepReadonly<TrackDefinition>[];
  readonly stages: readonly DeepReadonly<StageDefinition>[];
  readonly resources: readonly DeepReadonly<Resource>[];
  readonly dependencies: readonly DeepReadonly<Dependency>[];
  readonly conceptIndexById: Readonly<Record<string, number>>;
  readonly conceptIdBySlug: Readonly<Record<string, string>>;
  readonly projectIndexById: Readonly<Record<string, number>>;
  readonly projectIdBySlug: Readonly<Record<string, string>>;
}

export interface LoadedMdxEntity<Meta> {
  readonly meta: Meta;
  readonly sourcePath: string;
  readonly body: string;
}

export type LoadedConcept = LoadedMdxEntity<ConceptMeta>;
export type LoadedProject = LoadedMdxEntity<ProjectMeta>;

export interface ContentCatalogInput {
  readonly concepts: readonly LoadedConcept[];
  readonly projects: readonly LoadedProject[];
  readonly tracks: readonly TrackDefinition[];
  readonly stages: readonly StageDefinition[];
  readonly resources: readonly Resource[];
}
