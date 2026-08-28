import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildContentManifest,
  ContentValidationError,
  getConceptBySlug,
  loadMdxDirectory,
  parseRepositoryCatalog,
  serializeContentModuleRegistry,
  serializeContentManifest,
} from "@/lib/content";
import {
  conceptMetaSchema,
  projectMetaSchema,
  resourceSchema,
  stageDefinitionSchema,
  trackDefinitionSchema,
} from "@/lib/validation";
import type {
  ConceptMeta,
  ProjectMeta,
  Resource,
  StageDefinition,
  TrackDefinition,
} from "@/types";
import type {
  ContentCatalogInput,
  LoadedConcept,
  LoadedProject,
} from "@/lib/content";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directoryPath) =>
      rm(directoryPath, { recursive: true, force: true }),
    ),
  );
});

function createConcept(
  id: string,
  slug: string,
  overrides: Partial<ConceptMeta> = {},
) {
  const fixtureOrder = [...id].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 1_000_003,
    0,
  );
  return conceptMetaSchema.parse({
    schemaVersion: 1,
    id,
    slug,
    legacySlugs: [`legacy-${slug}`],
    title: `测试概念 ${id}`,
    englishTitle: `Fixture ${id}`,
    aliases: [`alias-${slug}`],
    searchKeywords: [`keyword-${slug}`],
    summary: "仅供内容管线单元测试使用。",
    why: "用于验证结构化内容校验，不作为正式学习内容。",
    stageId: "stage.fixture",
    trackIds: ["track.common"],
    order: fixtureOrder,
    level: "beginner",
    requiredness: "required",
    targetDepth: "master",
    estimatedHours: { min: 1, max: 2 },
    dependencies: [],
    tags: ["Fixture"],
    learningOutcomes: ["验证内容管线。"],
    masteryCriteria: [
      {
        id: `criterion.${slug}`,
        description: "能够解释测试数据的结构。",
        evidenceHint: "运行对应的单元测试。",
        required: true,
      },
    ],
    resourceIds: ["resource.fixture"],
    publicationStatus: "published",
    contentVersion: "fixture-v1",
    ...overrides,
  });
}

function loadedConcept(
  meta: ConceptMeta,
  sourcePath = `content/concepts/fixtures/${meta.slug}.mdx`,
): LoadedConcept {
  return { meta, sourcePath, body: `# ${meta.title}` };
}

function createProject(
  overrides: Partial<ProjectMeta> = {},
): ProjectMeta {
  return projectMetaSchema.parse({
    schemaVersion: 1,
    id: "project.fixture",
    slug: "fixture-project",
    title: "测试项目",
    level: "beginner",
    trackIds: ["track.common"],
    problemStatement: "验证测试项目的结构化元数据。",
    capabilitySummary: ["验证内容管线中的项目能力摘要。"],
    realWorldApplications: ["内容管线测试。"],
    conceptRequirements: [],
    estimatedHours: { min: 1, max: 2 },
    techStack: [],
    resources: [],
    environmentRequirements: [],
    executionPaths: [],
    acceptanceCriteria: [],
    deliverableRequirements: [],
    evidenceConceptIds: [],
    resumeOutcome: "仅用于校验引用。",
    tags: ["Fixture"],
    publicationStatus: "draft",
    contentVersion: "fixture-v1",
    ...overrides,
  });
}

function loadedProject(meta: ProjectMeta): LoadedProject {
  return {
    meta,
    sourcePath: `content/projects/beginner/${meta.slug}.mdx`,
    body: `# ${meta.title}`,
  };
}

function createTrack(): TrackDefinition {
  return trackDefinitionSchema.parse({
    id: "track.common",
    order: 0,
    title: "公共主干",
    summary: "内容管线测试 Track。",
    kind: "common",
    defaultGoal: "master",
  });
}

function createStage(
  overrides: Partial<StageDefinition> = {},
): StageDefinition {
  return stageDefinitionSchema.parse({
    id: "stage.fixture",
    categoryOrder: 0,
    order: 0,
    title: "测试 Stage",
    summary: "内容管线测试 checkpoint。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: ["验证 manifest。"],
    estimatedHours: { min: 1, max: 2 },
    projectGates: [],
    exitCriteria: [
      {
        id: "criterion.fixture-stage-exit",
        description: "内容管线测试通过。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
    ...overrides,
  });
}

function createResource(
  overrides: Partial<Resource> = {},
): Resource {
  return resourceSchema.parse({
    id: "resource.fixture",
    title: "测试资源",
    type: "official-doc",
    level: "beginner",
    priority: "optional",
    language: "zh-CN",
    reason: "仅验证资源引用。",
    verification: "pending",
    verificationNote: "fixture 不设置真实 URL。",
    ...overrides,
  });
}

function createCatalogInput({
  concepts,
  projects = [],
  tracks = [createTrack()],
  stages,
  resources = [createResource()],
}: {
  readonly concepts: readonly LoadedConcept[];
  readonly projects?: readonly LoadedProject[];
  readonly tracks?: readonly TrackDefinition[];
  readonly stages?: readonly StageDefinition[];
  readonly resources?: readonly Resource[];
}): ContentCatalogInput {
  const resolvedStages =
    stages ??
    [
      createStage({
        contentStatus: concepts.some(
          ({ meta }) =>
            meta.stageId === "stage.fixture" &&
            meta.publicationStatus === "published",
        )
          ? "available"
          : "planned",
      }),
    ];
  return { concepts, projects, tracks, stages: resolvedStages, resources };
}

function toMdx(frontmatter: object, body = "# Fixture body") {
  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n${body}\n`;
}

describe("MDX 扫描与 frontmatter 加载", () => {
  it("递归扫描并以稳定路径返回通过 Schema 的正文和元数据", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "mv-content-pipeline-"));
    temporaryDirectories.push(workspaceRoot);
    const conceptDirectory = resolve(
      workspaceRoot,
      "content/concepts/fixtures",
    );
    await mkdir(conceptDirectory, { recursive: true });
    const concept = createConcept("fixture.alpha", "fixture-alpha");
    await writeFile(
      resolve(conceptDirectory, "fixture-alpha.mdx"),
      toMdx(concept),
      "utf8",
    );

    const loaded = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/concepts"),
      workspaceRoot,
      schema: conceptMetaSchema,
    });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.meta.id).toBe("fixture.alpha");
    expect(loaded[0]?.sourcePath).toBe(
      "content/concepts/fixtures/fixture-alpha.mdx",
    );
    expect(loaded[0]?.body).toBe("\n# Fixture body\n");
  });

  it("非法或未知 frontmatter 字段会指出文件、字段和实体", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "mv-content-pipeline-"));
    temporaryDirectories.push(workspaceRoot);
    const conceptDirectory = resolve(workspaceRoot, "content/concepts");
    await mkdir(conceptDirectory, { recursive: true });
    const concept = {
      ...createConcept("fixture.invalid", "fixture-invalid"),
      unknownField: "must fail",
    };
    await writeFile(
      resolve(conceptDirectory, "invalid.mdx"),
      toMdx(concept),
      "utf8",
    );

    await expect(
      loadMdxDirectory({
        directoryPath: conceptDirectory,
        workspaceRoot,
        schema: conceptMetaSchema,
      }),
    ).rejects.toThrow(
      /content\/concepts\/invalid\.mdx:<frontmatter> \[id=fixture\.invalid slug=fixture-invalid\]: Unrecognized key: "unknownField"/,
    );
  });

  it("使用同一扫描器和 ProjectMeta Schema 加载 Project MDX", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "mv-content-pipeline-"));
    temporaryDirectories.push(workspaceRoot);
    const projectDirectory = resolve(workspaceRoot, "content/projects/beginner");
    await mkdir(projectDirectory, { recursive: true });
    const project = createProject();
    await writeFile(
      resolve(projectDirectory, "fixture-project.mdx"),
      toMdx(project, "# Fixture project body"),
      "utf8",
    );

    const loaded = await loadMdxDirectory({
      directoryPath: resolve(workspaceRoot, "content/projects"),
      workspaceRoot,
      schema: projectMetaSchema,
    });

    expect(loaded[0]).toMatchObject({
      sourcePath: "content/projects/beginner/fixture-project.mdx",
      meta: { id: "project.fixture", slug: "fixture-project" },
    });
  });

  it("catalog 同样使用严格 Schema，未知字段不会被剔除后继续", () => {
    expect(() =>
      parseRepositoryCatalog({
        tracks: [{ ...createTrack(), unknownField: true }],
        stages: [],
        resources: [],
      }),
    ).toThrow(
      /content\/catalog\/tracks\.ts:0 .* Unrecognized key: "unknownField"/,
    );
  });
});

describe("manifest 与跨实体校验", () => {
  it("生成稳定排序、规范化依赖以及 ID/canonical/legacy slug 索引", () => {
    const alpha = createConcept("fixture.alpha", "fixture-alpha");
    const beta = createConcept("fixture.beta", "fixture-beta", {
      dependencies: [
        {
          conceptId: "fixture.alpha",
          kind: "hard",
          reason: "Beta 需要 Alpha。",
        },
      ],
    });
    const manifest = buildContentManifest(
      createCatalogInput({
        concepts: [loadedConcept(beta), loadedConcept(alpha)],
      }),
    );

    expect(manifest.concepts.map((concept) => concept.id)).toEqual([
      "fixture.alpha",
      "fixture.beta",
    ]);
    expect(manifest.concepts[0]).toMatchObject({
      sourcePath: "content/concepts/fixtures/fixture-alpha.mdx",
      headings: [],
      stageId: "stage.fixture",
      trackIds: ["track.common"],
      masteryCriteria: [{ id: "criterion.fixture-alpha", required: true }],
    });
    expect(manifest.dependencies).toEqual([
      {
        prerequisiteId: "fixture.alpha",
        targetId: "fixture.beta",
        kind: "hard",
        rationale: "Beta 需要 Alpha。",
      },
    ]);
    expect(getConceptBySlug(manifest, "legacy-fixture-beta")?.id).toBe(
      "fixture.beta",
    );
    expect(serializeContentManifest(manifest)).toBe(
      serializeContentManifest(manifest),
    );
    expect(serializeContentModuleRegistry(manifest)).toContain(
      '"fixture-alpha": () => import("../content/concepts/fixtures/fixture-alpha.mdx")',
    );
  });

  it("重复 ID 会失败并指出第二个文件与原始声明", () => {
    const first = createConcept("fixture.duplicate", "first-slug");
    const second = createConcept("fixture.duplicate", "second-slug", {
      masteryCriteria: [
        {
          id: "criterion.second-slug",
          description: "独立标准。",
          evidenceHint: "独立证据。",
          required: true,
        },
      ],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [
            loadedConcept(first, "content/concepts/first.mdx"),
            loadedConcept(second, "content/concepts/second.mdx"),
          ],
        }),
      ),
    ).toThrow(
      /content\/concepts\/second\.mdx:id \[id=fixture\.duplicate slug=second-slug\]: Concept ID "fixture\.duplicate" 与 content\/concepts\/first\.mdx:id 重复/,
    );
  });

  it("重复 Track ID 会失败", () => {
    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          tracks: [
            createTrack(),
            trackDefinitionSchema.parse({
              ...createTrack(),
              title: "重复 Track",
              order: 10,
            }),
          ],
        }),
      ),
    ).toThrow(/Track at index 1 ID "track\.common" .* 重复/);
  });

  it("重复 Stage checkpoint ID 会失败", () => {
    const duplicateStage = createStage({
      order: 10,
      exitCriteria: [
        {
          id: "criterion.fixture-stage-exit-duplicate",
          description: "独立的测试出口。",
          required: true,
          when: { kind: "always" },
        },
      ],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          stages: [createStage(), duplicateStage],
        }),
      ),
    ).toThrow(/Stage at index 1 ID "stage\.fixture" .* 重复/);
  });

  it("出口 criterion ID 必须在全局唯一", () => {
    const secondStage = createStage({
      id: "stage.fixture-second",
      order: 10,
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          stages: [createStage(), secondStage],
        }),
      ),
    ).toThrow(
      /Stage exit criterion ID "criterion\.fixture-stage-exit" .* 重复/,
    );
  });

  it("重复 canonical slug 会失败", () => {
    const first = createConcept("fixture.first", "duplicate-slug");
    const second = createConcept("fixture.second", "duplicate-slug", {
      legacySlugs: ["legacy-second"],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [loadedConcept(first), loadedConcept(second)],
        }),
      ),
    ).toThrow(/Concept slug "duplicate-slug" .* 重复/);
  });

  it("同一 Stage 内重复 Concept order 会失败", () => {
    const first = createConcept("fixture.first", "fixture-first", { order: 10 });
    const second = createConcept("fixture.second", "fixture-second", {
      order: 10,
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [loadedConcept(first), loadedConcept(second)],
        }),
      ),
    ).toThrow(
      /Stage "stage\.fixture" 内的 Concept order 10 .* 重复，推荐路线顺序不唯一/,
    );
  });

  it("不存在的依赖 ID 会失败并给出精确字段", () => {
    const concept = createConcept("fixture.missing-dependency", "missing-dependency", {
      dependencies: [
        {
          conceptId: "fixture.does-not-exist",
          kind: "hard",
          reason: "故意制造坏引用。",
        },
      ],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [loadedConcept(concept)] }),
      ),
    ).toThrow(
      /dependencies\.0\.conceptId .* Dependency 引用不存在的 ID "fixture\.does-not-exist"/,
    );
  });

  it("Concept 正文内部链接只允许已发布页面与真实章节锚点", () => {
    const source = createConcept("fixture.source", "fixture-source");
    const target = createConcept("fixture.target", "fixture-target");
    const sourceWithLink: LoadedConcept = {
      ...loadedConcept(source),
      body: "# Source\n\n[进入目标](/knowledge/fixture-target/#section-真实章节)",
    };
    const targetWithHeading: LoadedConcept = {
      ...loadedConcept(target),
      body: "# Target\n\n## 真实章节",
    };

    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [sourceWithLink, targetWithHeading] }),
      ),
    ).not.toThrow();
  });

  it("Concept 正文链接拒绝 planned/draft 页面与不存在的锚点", () => {
    const source = createConcept("fixture.source", "fixture-source");
    const draftTarget = createConcept("fixture.draft", "fixture-draft", {
      publicationStatus: "draft",
    });
    const invalidTarget = createConcept("fixture.target", "fixture-target");
    const sourceWithInvalidLinks: LoadedConcept = {
      ...loadedConcept(source),
      body: [
        "# Source",
        "",
        "[草稿](/knowledge/fixture-draft/)",
        "[坏锚点](/knowledge/fixture-target/#section-not-found)",
      ].join("\n"),
    };

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [
            sourceWithInvalidLinks,
            loadedConcept(draftTarget),
            loadedConcept(invalidTarget),
          ],
        }),
      ),
    ).toThrow(
      /内部链接不得指向 draft 内容[\s\S]*内部链接引用不存在的章节锚点/,
    );
  });

  it("hard dependency 环会失败并输出完整环路径", () => {
    const alpha = createConcept("fixture.alpha", "fixture-alpha", {
      dependencies: [
        {
          conceptId: "fixture.beta",
          kind: "hard",
          reason: "故意形成测试环。",
        },
      ],
    });
    const beta = createConcept("fixture.beta", "fixture-beta", {
      dependencies: [
        {
          conceptId: "fixture.alpha",
          kind: "hard",
          reason: "故意形成测试环。",
        },
      ],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [loadedConcept(alpha), loadedConcept(beta)],
        }),
      ),
    ).toThrow(
      /hard dependency 形成有向环：fixture\.alpha -> fixture\.beta -> fixture\.alpha/,
    );
  });

  it("recommended 环不参与 DAG 阻塞", () => {
    const alpha = createConcept("fixture.alpha", "fixture-alpha", {
      dependencies: [
        {
          conceptId: "fixture.beta",
          kind: "recommended",
          reason: "允许交错参照。",
        },
      ],
    });
    const beta = createConcept("fixture.beta", "fixture-beta", {
      dependencies: [
        {
          conceptId: "fixture.alpha",
          kind: "recommended",
          reason: "允许交错参照。",
        },
      ],
    });

    expect(
      buildContentManifest(
        createCatalogInput({
          concepts: [loadedConcept(alpha), loadedConcept(beta)],
        }),
      ).dependencies,
    ).toHaveLength(2);
  });

  it("交叉校验 Concept 的 Stage/Track/Resource 引用", () => {
    const concept = createConcept("fixture.bad-cross-reference", "bad-cross-reference", {
      stageId: "stage.missing",
      trackIds: ["track.missing"],
      resourceIds: ["resource.missing"],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [loadedConcept(concept)] }),
      ),
    ).toThrow(/stageId .* Stage 引用不存在的 ID "stage\.missing"/);
  });

  it("Stage 引用不存在的 Track 会失败", () => {
    const stage = createStage({
      trackIds: ["track.missing"],
      categoryExitForTrackIds: ["track.missing"],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [], stages: [stage] }),
      ),
    ).toThrow(/trackIds\.0 .* Stage Track 引用不存在的 ID "track\.missing"/);
  });

  it("空 allOf 不是合法 entryGate", () => {
    expect(() =>
      stageDefinitionSchema.parse({
        ...createStage(),
        entryGate: { kind: "allOf", gates: [] },
      }),
    ).toThrow(/"entryGate"[\s\S]*"gates"/);
  });

  it("entryGate 引用不存在的 checkpoint 会失败", () => {
    const stage = createStage({
      entryGate: { kind: "checkpoint", stageId: "stage.missing" },
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [], stages: [stage] }),
      ),
    ).toThrow(/entryGate\.stageId .* Checkpoint 引用不存在的 ID "stage\.missing"/);
  });

  it("含 Track 条件的 checkpoint 环会失败", () => {
    const alpha = createStage({
      id: "stage.alpha",
      order: 0,
      entryGate: { kind: "checkpoint", stageId: "stage.beta" },
      exitCriteria: [
        {
          id: "criterion.stage-alpha",
          description: "Alpha 出口。",
          required: true,
          when: { kind: "always" },
        },
      ],
    });
    const beta = createStage({
      id: "stage.beta",
      order: 10,
      entryGate: {
        kind: "track-goal-checkpoint",
        stageId: "stage.alpha",
        trackId: "track.common",
        minimumTrackGoal: "master",
      },
      exitCriteria: [
        {
          id: "criterion.stage-beta",
          description: "Beta 出口。",
          required: true,
          when: { kind: "always" },
        },
      ],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [], stages: [alpha, beta] }),
      ),
    ).toThrow(/Stage entryGate 形成有向环/);
  });

  it("孤立 checkpoint 和没有 Stage 的 Track 会失败", () => {
    const isolatedStage = createStage({
      categoryExitForTrackIds: [],
    });
    expect(() =>
      buildContentManifest(
        createCatalogInput({ concepts: [], stages: [isolatedStage] }),
      ),
    ).toThrow(/形成孤立 checkpoint/);

    const orphanTrack = trackDefinitionSchema.parse({
      id: "track.orphan",
      order: 10,
      title: "孤立 Track",
      summary: "用于校验孤立 Track。",
      kind: "common",
      defaultGoal: "master",
    });
    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          tracks: [createTrack(), orphanTrack],
        }),
      ),
    ).toThrow(/没有任何 Stage 引用，形成孤立 Track/);
  });

  it("contentStatus 必须与已发布 Concept 一致", () => {
    const concept = createConcept("fixture.published", "fixture-published");
    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [loadedConcept(concept)],
          stages: [createStage({ contentStatus: "planned" })],
        }),
      ),
    ).toThrow(/planned，但存在 1 个已发布 Concept/);

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          stages: [createStage({ contentStatus: "available" })],
        }),
      ),
    ).toThrow(/available，但没有已发布 Concept/);
  });

  it("交叉校验 Project 知识要求和 Stage 项目门槛", () => {
    const project = createProject({
      conceptRequirements: [
        {
          conceptId: "fixture.missing",
          kind: "hard",
          minimumStatus: "understood",
          reason: "故意制造坏引用。",
        },
      ],
    });
    const stage = createStage({
      projectGates: [
        {
          projectId: "project.missing",
          when: { kind: "always" },
        },
      ],
    });

    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          projects: [loadedProject(project)],
          stages: [stage],
        }),
      ),
    ).toThrow(ContentValidationError);
    expect(() =>
      buildContentManifest(
        createCatalogInput({
          concepts: [],
          projects: [loadedProject(project)],
          stages: [stage],
        }),
      ),
    ).toThrow(/projectGates\.0\.projectId .* "project\.missing"/);
  });
});
