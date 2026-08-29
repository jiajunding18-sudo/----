# 机器视觉 Learning OS 技术架构

> 状态：Phase 0 架构基线  
> 适用范围：v1，中文、单用户、桌面优先、浏览器本地持久化  
> 本文中的“必须”“不得”是实现约束；变更这些约束时，应先更新本文并说明迁移方案。

## 1. 架构结论

本项目采用“构建期静态内容 + 浏览器端个人状态”的单体前端架构：

```text
MDX + 声明式 TypeScript catalog
              │
              ▼
      构建期内容流水线
  解析 → Zod 校验 → 交叉引用校验
       │          │          │
       ▼          ▼          ▼
  静态页面     搜索索引     依赖图数据
       │          │          │
       └──────────┴──────────┘
                  │
                  ▼
       Next.js static export
                  │
                  ▼
      浏览器中的 Learning OS
                  │
                  ▼
      Zustand → StorageAdapter
                  │
                  ▼
              LocalStorage
```

核心不变量如下：

- 正式学习内容属于仓库，由构建期读取；个人进度、笔记、证据和日志属于浏览器状态。
- v1 没有账号、运行时后端、数据库或跨设备同步。
- 内容实体使用不可变稳定 ID；标题、文件路径和 URL slug 都不是关联键。
- 依赖、后续知识、阶段进度和项目就绪度由单一事实来源推导，不双向重复维护。
- `understood` 已满足硬前置；`mastered` 必须同时具备覆盖要求的证据和用户手动确认，程序不得自动授予。
- 静态导出的每条内容路由必须在构建时已知；运行时不得依赖服务器能力。

## 2. 技术栈

### 2.1 锁定选择

| 层次 | 选择 | 约束 |
| --- | --- | --- |
| 运行时 | Node.js 当前 LTS | 开发与构建环境统一；版本记录在项目说明和 CI 中 |
| 包管理 | npm | 只提交 `package-lock.json`，不得混用其他 lockfile |
| 框架 | Next.js App Router | 使用 React Server/Client Component 边界，但最终输出纯静态站点 |
| UI | React + TypeScript strict | 禁止无理由使用 `any`；领域类型由 schema 推导或显式定义 |
| 样式 | Tailwind CSS + CSS variables | CSS variables 保存颜色、间距等设计 token；不引入第二套样式系统 |
| 内容 | `@next/mdx` + MDX + `remark-frontmatter` | 正文适合公式、代码、图示与受控交互组件；元数据仍由构建脚本统一校验 |
| 结构数据 | 声明式 TypeScript catalog | 只保存数据，不允许函数、网络请求或业务逻辑 |
| 校验 | Zod | frontmatter、catalog、持久化数据和导入文件共用 schema |
| 客户端状态 | Zustand | UI 只调用 store actions/selectors，不直接操作 LocalStorage |
| 搜索 | 构建期索引 + Fuse.js | 客户端按需加载，无搜索服务器 |
| 图谱 | 派生图模型；Phase 7 使用 `@xyflow/react` + Dagre | 只读浏览，不建设图编辑器或图数据库 |
| 单元测试 | Vitest + React Testing Library | 领域逻辑、schema、普通客户端组件 |
| 端到端测试 | Playwright | 静态构建、持久化、关键流程、响应式和基础无障碍 |

依赖使用创建项目时的稳定版本，并由 `package-lock.json` 固定。本文不把易过时的具体包版本写成架构约束。

### 2.2 Next.js 静态模式

`next.config.ts` 必须至少体现以下部署约束：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
```

- `output: "export"` 是 v1 的强约束。
- `trailingSlash: true` 让通用静态主机能够直接映射目录式 URL。
- 动态内容路由必须实现 `generateStaticParams()`，且不得允许未知参数在运行时生成。
- 不使用 Server Actions、依赖请求信息的 Route Handlers、Cookies、Headers、Rewrites、ISR、Draft Mode 或默认图片优化。
- 所有环境变量都会在构建时固化；客户端代码中不得放置秘密。
- 项目不能从 `file://` 直接打开，必须由本地或远程 HTTP 静态服务器提供。

## 3. 目录结构

项目采用根级 `content/` 隔离学习内容，应用代码放在 `src/`：

```text
/
├─ content/
│  ├─ concepts/
│  │  ├─ programming/
│  │  ├─ mathematics/
│  │  ├─ image-processing/
│  │  ├─ optics/
│  │  ├─ computer-vision/
│  │  ├─ three-d-vision/
│  │  ├─ deep-learning/
│  │  ├─ industrial-vision/
│  │  └─ computational-imaging/
│  ├─ projects/
│  │  ├─ beginner/
│  │  ├─ intermediate/
│  │  └─ advanced/
│  └─ catalog/
│     ├─ tracks.ts
│     ├─ stages.ts
│     └─ resources.ts
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ roadmap/page.tsx
│  │  ├─ roadmap/graph/page.tsx
│  │  ├─ knowledge/page.tsx
│  │  ├─ knowledge/[slug]/page.tsx
│  │  ├─ projects/page.tsx
│  │  ├─ projects/[slug]/page.tsx
│  │  ├─ resources/page.tsx
│  │  ├─ study-log/page.tsx
│  │  ├─ search/page.tsx
│  │  └─ settings/data/page.tsx
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ shell/
│  │  └─ mdx/
│  ├─ features/
│  │  ├─ progress/
│  │  ├─ recommendations/
│  │  ├─ projects/
│  │  ├─ resources/
│  │  ├─ search/
│  │  ├─ graph/
│  │  └─ study-log/
│  ├─ lib/
│  │  ├─ content/
│  │  ├─ graph/
│  │  ├─ search/
│  │  ├─ storage/
│  │  └─ validation/
│  └─ types/
├─ scripts/
│  ├─ build-content.ts
│  └─ check-links.ts
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ public/
│  ├─ media/
│  └─ _generated/
└─ .generated/
```

规则：

- 概念目录按稳定领域分类，不按可能调整的 Stage 编号分类。
- `content/` 中不得出现页面布局、状态读写或业务组件实现。
- `src/components/ui` 只放无领域语义的基础组件；带业务含义的组件放入对应 `features/`。
- `.generated/` 与 `public/_generated/` 是构建产物，不手工编辑，由内容脚本覆盖生成。
- 媒体文件使用稳定、可读的相对路径；不把二进制内容嵌入 frontmatter 或 LocalStorage。

## 4. Server、Client 与共享代码边界

### 4.1 构建期/Server Component 职责

以下工作只允许发生在 Node.js 构建环境或静态 Server Component 中：

- 扫描 `content/`、解析 MDX/frontmatter 和 catalog。
- 执行 Zod 校验、交叉引用校验、`hard` 子图环检测和内部链接检查。
- 生成内容 manifest、静态路由参数、页面 metadata、搜索索引和图谱基础数据。
- 渲染无交互的正文、目录、前置知识列表和资源列表。

构建期模块可以读取文件系统，但不得被 Client Component 导入。

### 4.2 Client Component 职责

以下能力必须位于窄边界 Client Component 中：

- Zustand store 初始化与 hydration。
- 进度切换、笔记、收藏、难度、证据、项目状态和学习日志编辑。
- 搜索输入、Fuse.js 查询和结果快捷操作。
- 图谱平移、缩放、筛选和节点选择。
- 真正需要浏览器 API 的交互演示。

根 layout、正文和静态导航不得仅为读取进度而整体变成 Client Component。Server Component 向客户端岛只传递可序列化的最小数据。

### 4.3 共享纯逻辑

以下逻辑必须写成无 React、无文件系统、无浏览器 API 的纯函数，以便 Server、Client 和测试复用：

- 状态迁移与导入校验。
- 前置满足判断、阶段进度、方向进度和项目就绪度。
- 掌握证据覆盖判断。
- 搜索文本归一化。
- 图节点/边转换和环检测。

## 5. 内容加载与静态路由生成

### 5.1 内容流水线

`scripts/build-content.ts` 是唯一内容构建入口，按以下顺序执行：

1. 以稳定排序扫描所有概念和项目 MDX 文件。
2. 解析 frontmatter；导入只含声明式数据的 track/stage/resource catalog。
3. 使用 Zod 将源数据转换为规范化 `ContentCatalog`。
4. 校验唯一 ID、唯一 slug、方向/阶段/资源/项目引用、依赖引用、掌握标准引用、Advanced 必须为 optional、Track 目标约束、checkpoint/project gate、项目执行路径与环境要求、内部链接与锚点。
5. 对全部 dependency edge 检测缺失引用、自依赖和重复边，并只对 `hard` 子图检测有向环；recommended edge 不参与拓扑排序。无方向的关联必须使用 `relatedConceptIds`。
6. 生成 `.generated/content-manifest.ts`，其中只包含静态 MDX import、规范化 metadata 和 ID/slug 索引。
7. 生成 `public/_generated/search-index.json` 和图谱基础数据。
8. 任一错误都以“文件路径 + 字段路径 + 原因”终止构建；不得跳过坏内容继续发布。

MDX 由 Next.js 的本地 MDX 支持编译，frontmatter 通过 remark frontmatter 插件暴露给构建流程。MDX 文件是仓库内受信任内容，但仍只允许使用 `mdx-components.tsx` 中注册的组件；正文不得自行导入任意应用模块、发起网络请求或读写个人状态。

### 5.2 路由生成

- `/knowledge/[slug]` 的 `generateStaticParams()` 从 concept manifest 返回全部 canonical slug 与保留的 legacy slug。
- `/projects/[slug]` 使用同一模式。
- 页面首先按 slug 定位 manifest，再用稳定 ID 获取实体和关联数据。
- canonical slug 输出正常页面；legacy slug 输出静态迁移页，声明 canonical URL，并引导到新地址。静态模式不依赖服务器 redirect。
- 找不到的 slug 在构建数据中不存在，返回静态 404；不得回退到运行时文件读取。
- Dashboard、Roadmap、Projects 和 Graph 读取同一个规范化 catalog，不各自维护副本。

### 5.3 必需内容质量检查

概念页必须具备：初学者解释、学习原因、核心概念、学习深度、掌握标准、练习或验证方式。数学、代码、工业应用、常见错误和图示按主题适用性提供，禁止为了满足模板而生成空章节。

项目页必须具备：目标、所需知识、难度、时间范围、技术栈、步骤、数据来源、验收标准和可形成的作品/简历成果。

资源链接状态必须是 `verified`、`pending` 或 `broken`。`pending` 可以没有 URL，禁止用猜测 URL 填充；`broken` 必须保留最后已知 URL 和检查说明，有已验证替代时引用替代资源，暂时没有时在说明中明确记录，不能静默删除历史。

## 6. 稳定 ID 与 slug 规则

### 6.1 ID

- ID 使用小写 ASCII 语义命名，推荐格式为 `<domain>.<topic>`，例如 `geometry.camera-calibration`。
- ID 必须匹配 `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`。
- ID 一经发布永久不变、不得复用，即使标题、Stage、文件路径或 slug 改变。
- 所有依赖、资源、项目、进度和证据引用都使用 ID，不使用标题或 slug。
- Stage 使用语义 ID，如 `multiview-geometry`，不得把 `stage-6` 当永久身份；展示顺序由 `order` 决定。

### 6.2 slug

- slug 使用小写 kebab-case，匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。
- slug 是公开 URL，发布后原则上保持稳定。
- 必须改名时，将旧值加入 `legacySlugs`；同一内容的 canonical slug 和 legacy slug 均不得与其他内容冲突。
- 文件名建议与 canonical slug 一致，但文件名不是身份。

删除内容时，不直接删除对应用户进度。未知 ID 的历史状态作为 orphan record 保留，排除在当前进度计算之外，并可在数据管理页导出或清理。

## 7. 核心领域类型

以下类型表达架构契约；实现时应以 Zod schema 为运行时事实来源，并通过 `z.infer` 减少重复声明。

### 7.1 内容身份、依赖和掌握标准

```ts
type ConceptId = string;
type ProjectId = string;
type ResourceId = string;
type StageId = string;
type TrackId = string;
type MasteryCriterionId = string;
type EvidenceId = string;

type DependencyKind = "hard" | "recommended";
type TrackGoal = "understand" | "master";

interface ConceptDependency {
  conceptId: ConceptId;
  kind: DependencyKind;
  reason: string;
}

interface Dependency {
  prerequisiteId: ConceptId;
  targetId: ConceptId;
  kind: DependencyKind;
  rationale: string;
}

interface MasteryCriterion {
  id: MasteryCriterionId;
  description: string;
  evidenceHint: string;
  required: boolean;
}

interface EmbeddedSearchEntry {
  id: string;
  kind: "formula" | "tool";
  title: string;
  aliases: string[];
  anchor: string;
  summary?: string;
}

interface ConceptMeta {
  schemaVersion: 1;
  id: ConceptId;
  slug: string;
  legacySlugs?: string[];
  title: string;
  englishTitle: string;
  aliases: string[];
  searchKeywords: string[];
  summary: string;
  why: string;
  stageId: StageId;
  trackIds: TrackId[];
  order: number;
  level: "beginner" | "intermediate" | "advanced";
  requiredness: "required" | "optional";
  targetDepth: "master" | "understand" | "advanced";
  estimatedHours: { min: number; max: number };
  dependencies: ConceptDependency[];
  relatedConceptIds?: ConceptId[];
  tags: string[];
  learningOutcomes: string[];
  masteryCriteria: MasteryCriterion[];
  resourceIds: ResourceId[];
  searchEntries?: EmbeddedSearchEntry[];
  publicationStatus: "draft" | "published" | "hidden" | "retired";
  contentVersion: string;
}
```

`ConceptMeta.dependencies` 是作者维护的唯一依赖输入；内容构建把它规范化为 `Dependency[]`，补出 `targetId` 后供推荐、图谱和校验共用。正式项目与概念的关联从 `ProjectMeta` 派生，`ConceptMeta` 不再反向维护项目 ID。

发布状态语义固定为：`published` 进入路线、搜索、推荐和主进度；`hidden` 仅允许直接访问且排除在上述集合外；`draft` 不生成公开路由；`retired` 只保留稳定 ID、历史数据和迁移/说明页，不再作为可学习内容。

依赖语义：

- `hard`：进入该概念前应达到的最低条件。前置概念为 `understood` 或 `mastered` 时即满足。
- `recommended`：有帮助但不影响就绪判断，UI 仅给出建议；不参与拓扑排序或环阻塞。
- 硬前置未满足时仍允许打开和学习目标页面；系统显示“尚未就绪”及缺失项，不做强制锁页。
- `relatedConceptIds` 表示无方向关系，不参与就绪判断和进度顺序。
- schema 强制 `targetDepth: "advanced"` 与 `requiredness: "optional"` 同时出现；A 节点不得成为公共主进度的必修分母。
- 路线所称 DAG 专指 `hard` 子图；recommended edge 仍须通过引用、重复边和自依赖校验，但允许为交错学习形成互相参照。
- 路线目标先按 `master → mastered`、`understand → understood`、`advanced → understood` 映射；Track 的 `understand` 目标可把该分支 M 节点的当前要求降为 `understood`，同一节点属于多个当前 Track 时取较高要求；项目的 `minimumStatus` 可以再提高当前上下文门槛。

### 7.2 Stage、资源和项目

```ts
type TrackGoalCondition =
  | { kind: "always" }
  | { kind: "track-goal"; trackId: TrackId; minimumGoal: TrackGoal };

interface StageExitCriterion {
  id: string;
  description: string;
  required: boolean;
  when: TrackGoalCondition;
}

type StageCategoryOrder = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface TrackDefinition {
  id: TrackId;
  order: number;
  title: string;
  summary: string;
  kind: "common" | "advanced-branch";
  defaultGoal: TrackGoal;
  exclusiveMasteryGroup?: string;
}

interface StageProjectGate {
  projectId: ProjectId;
  when: TrackGoalCondition;
}

type CheckpointGate =
  | { kind: "checkpoint"; stageId: StageId }
  | {
      kind: "track-goal-checkpoint";
      stageId: StageId;
      trackId: TrackId;
      minimumTrackGoal: TrackGoal;
    }
  | { kind: "allOf"; gates: [CheckpointGate, ...CheckpointGate[]] }
  | { kind: "anyOf"; gates: [CheckpointGate, ...CheckpointGate[]] };

interface StageDefinition {
  id: StageId;
  categoryOrder: StageCategoryOrder;
  order: number;
  title: string;
  summary: string;
  contentStatus: "available" | "planned";
  trackIds: TrackId[];
  categoryExitForTrackIds: TrackId[];
  outcomes: string[];
  estimatedHours: { min: number; max: number };
  projectGates: StageProjectGate[];
  entryGate?: CheckpointGate;
  exitCriteria: StageExitCriterion[];
  retestAfterDays?: number;
}

type ResourceType =
  | "official-doc"
  | "course"
  | "book"
  | "repository"
  | "video"
  | "article"
  | "paper"
  | "dataset";

interface ResourceBase {
  id: ResourceId;
  title: string;
  authorOrOrganization?: string;
  type: ResourceType;
  level: "beginner" | "intermediate" | "advanced";
  priority: "essential" | "recommended" | "optional";
  language: "zh-CN" | "en" | "bilingual" | "other";
  reason: string;
  recommendedParts?: string[];
  aliases?: string[];
}

type Resource = ResourceBase &
  (
    | {
        verification: "verified";
        url: string;
        verifiedAt: string; // YYYY-MM-DD
        lastCheckedAt: string;
      }
    | {
        verification: "pending";
        url?: string;
        lastCheckedAt?: string;
        verificationNote: string;
      }
    | {
        verification: "broken";
        url: string;
        lastCheckedAt: string;
        verificationNote: string;
        replacementResourceId?: ResourceId;
      }
  );

interface ProjectConceptRequirement {
  conceptId: ConceptId;
  kind: DependencyKind;
  minimumStatus: "understood" | "mastered";
  reason: string;
}

interface ProjectAcceptanceCriterion {
  id: string;
  description: string;
  required: boolean;
}

interface ProjectResourceRef {
  resourceId: ResourceId;
  role: "dataset" | "documentation" | "course" | "repository" | "reference";
  required: boolean;
}

type EnvironmentRequirementKind = "software" | "dataset" | "hardware";

interface ProjectEnvironmentRequirement {
  id: string;
  kind: EnvironmentRequirementKind;
  label: string;
  required: boolean;
  details: string;
}

interface ProjectExecutionPath {
  id: string;
  title: string;
  mode: "preferred-hardware" | "consumer-hardware" | "public-data" | "simulation";
  requirementIds: string[];
  evidenceBoundary: string;
}

interface ProjectMeta {
  schemaVersion: 1;
  id: ProjectId;
  slug: string;
  legacySlugs?: string[];
  title: string;
  level: "beginner" | "intermediate" | "advanced";
  trackIds: TrackId[];
  problemStatement: string;
  capabilitySummary: string[];
  realWorldApplications: string[];
  conceptRequirements: ProjectConceptRequirement[];
  estimatedHours: { min: number; max: number };
  techStack: string[];
  resources: ProjectResourceRef[];
  environmentRequirements: ProjectEnvironmentRequirement[];
  executionPaths: ProjectExecutionPath[];
  acceptanceCriteria: ProjectAcceptanceCriterion[];
  deliverableRequirements: string[];
  evidenceConceptIds: ConceptId[];
  resumeOutcome: string;
  tags: string[];
  publicationStatus: "draft" | "published" | "hidden" | "retired";
  contentVersion: string;
}
```

概念之间的 `hard` 前置统一由 `understood` 或 `mastered` 满足；项目可以通过 `minimumStatus` 对个别知识要求 `mastered`。项目完成不能自动把关联概念设为 `mastered`，只能成为用户可选择引用的证据候选。

`capabilitySummary` 是 Project 级最小能力表达，不建立独立 Capability catalog、图或用户状态。`Concept → Project` 只从 `ProjectMeta.conceptRequirements` 建立反向索引；Project 所属 Stage 只从 `StageDefinition.projectGates` 与 requirement Concept 的 `stageId` 派生，不在 `ProjectMeta` 重复维护 `stageIds`。

Stage→Track 关系只维护在 `StageDefinition.trackIds`；`TrackDefinition` 的阶段列表按 `stage.order` 派生，不双向保存。`categoryExitForTrackIds` 必须是 `trackIds` 的子集。资源关联也只从 `ConceptMeta.resourceIds` 与 `ProjectMeta.resources` 单向维护，`Resource` 不保存反向实体数组；Resources 页面和搜索索引使用构建期反向索引。

`StageDefinition.contentStatus` 只表示 checkpoint 内容是否已展开：`available` 必须至少有一个已发布 Concept，`planned` 不得包含已发布 Concept。该字段不是用户进度，也不代替 `ConceptMeta.publicationStatus`；高级分支仍由 Track 种类与 Stage→Track 关系表达。

这里的 `StageDefinition` 表示可执行 checkpoint，而不是把数字分类强行当作线性阶段。单波次分类只有一个 checkpoint；Stage 1/4/6/7 分别可有 A/B/C checkpoint，共享 `categoryOrder`，`ConceptMeta.stageId` 指向精确 checkpoint。`categoryExitForTrackIds` 标记它在哪些 Track 中是分类出口；非空的分类出口按 `ROADMAP.md` 配置 7 天复测，纯中间 checkpoint 可省略复测。

默认 Track catalog 使用 `track.common = master`、`track.industrial-3d = master`、`track.computational-imaging = understand`。所有 `kind: "common"` 的 Track 在 catalog 和用户偏好中都固定为 `master`，不能被设置、导入或迁移为 `understand`；两个高级 Track 共享同一 `exclusiveMasteryGroup`，catalog 默认值和 `UserPreferences.trackGoals` 都必须保证组内恰有一个当前目标为 `master`。用户交换主次只更新高级分支的 `trackGoals`，既有状态与证据不变；`focusedTrackIds` 只影响呈现和同层推荐顺序，不改变完整路线成员。

`CheckpointGate` 是无法只靠概念 hard edge 表达的阶段入口唯一事实来源：无条件 leaf 只含 checkpoint ID，条件 leaf 必须同时包含 Track ID 和最低目标；`allOf / anyOf` 至少各含一个子 gate。目标次序固定为 `understand < master`。条件 leaf 只有在所指 checkpoint 已通过且 Track 目标达到 `minimumTrackGoal` 时才满足；不满足 Track 条件时在 `anyOf` 中返回 false，而不是被忽略。

`ROADMAP.md` 第 1.5 节是 checkpoint gate 的 catalog 契约：1B 引用 1A；4B、4C 和 Stage 5 引用 4A；6B 引用 6A；7B 引用 7A；Stage 9 对 Stage 6B 与 Stage 8 使用 `allOf`。`stage.computational-imaging.entryGate` 必须直接引用 `stage.imaging-quality-advanced`，不能用“相关概念已理解”代替 Stage 4C 的出口证据和复测。

`stage.capstone.entryGate` 的根节点是 `allOf`：它包含公共出口 `stage.tooling-foundations`、`stage.vision-math-geometry-optimization`、`stage.image-computing`、`stage.digital-image-processing`、`stage.industrial-imaging`、`stage.planar-vision`、`stage.depth-reconstruction`、`stage.modern-vision-tasks`、`stage.industrial-vision`，并包含一个由“`stage.industrial-3d` 且对应 Track 目标为 `master`”与“`stage.computational-imaging` 且对应 Track 目标为 `master`”组成的 `anyOf`。因此以 Stage 9 为主修时不额外要求 Stage 4C；以 Stage 10 为主修时会通过 Stage 10 的入口门槛要求 Stage 4C。

`StageExitCriterion.when` 与 `StageProjectGate.when` 使用同一条件语义。公共 checkpoint 的必需出口标准为 `always`；高级副修 checkpoint 只执行 `always` 的 U/M 共同标准，目标达到 `master` 后才额外执行对应的主修级标准和项目门槛。

### 7.3 个人进度、证据和学习日志

```ts
type LearningStatus =
  | "not_started"
  | "learning"
  | "understood"
  | "mastered";

type EvidenceKind =
  | "exercise"
  | "mini-project"
  | "project"
  | "code-artifact"
  | "written-explanation"
  | "demonstration"
  | "other";

interface MasteryEvidence {
  id: EvidenceId;
  conceptId: ConceptId;
  criterionIds: MasteryCriterionId[];
  kind: EvidenceKind;
  title: string;
  note: string;
  result: "passed" | "failed";
  completedAt: string;
  reference?: string; // 项目 ID、仓库相对路径或外部 URL；不存文件本体
  createdAt: string;  // ISO 8601 UTC timestamp
  updatedAt: string;
}

interface MasteryConfirmation {
  confirmedAt: string;
  criterionIds: MasteryCriterionId[];
  evidenceIds: EvidenceId[];
  statementVersion: 1;
}

interface ConceptProgress {
  status: LearningStatus;
  note: string;
  favorite: boolean;
  userDifficulty?: 1 | 2 | 3 | 4 | 5;
  startedAt?: string;
  understoodAt?: string;
  firstMasteredAt?: string;
  lastMasteredAt?: string;
  updatedAt: string;
  evidence: MasteryEvidence[];
  masteryConfirmation?: MasteryConfirmation;
}

interface ProjectProgress {
  status: "not_started" | "in_progress" | "paused" | "completed";
  note: string;
  nextAction?: string;
  selectedExecutionPathId?: string;
  environmentChecks: Record<string, boolean>;
  prerequisiteOverride?: {
    confirmedAt: string;
    missingRequirementConceptIds: ConceptId[];
  };
  acceptance: Record<string, boolean>;
  deliverables: Array<{
    id: string;
    title: string;
    reference?: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  unverifiedAssumptions: string[];
  completionConfirmation?: {
    confirmedAt: string;
    acceptanceCriterionIds: string[];
    deliverableIds: string[];
  };
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

interface StudyLog {
  id: string;
  localDate: string; // 用户本地日期 YYYY-MM-DD
  minutes: number;
  conceptIds: ConceptId[];
  projectIds: ProjectId[];
  learned: string;
  blockers: string;
  completed: string;
  tomorrowPlan: string;
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  focusedTrackIds: TrackId[];
  trackGoals: Record<TrackId, TrackGoal>;
  activeStageId?: StageId;
  weeklyTargetMinutes: number;
  todayAvailableMinutes?: number;
  primaryProjectId?: ProjectId;
  currentConceptId?: ConceptId;
  lastBackupAt?: string;
  updatedAt: string;
}

interface StageCheckpoint {
  criterionEvidence: Record<string, string[]>;
  initiallyEligibleAt?: string;
  retestedAt?: string;
  updatedAt: string;
}

interface LearningStateV1 {
  schemaVersion: 1;
  preferences: UserPreferences;
  conceptProgress: Record<ConceptId, ConceptProgress>;
  projectProgress: Record<ProjectId, ProjectProgress>;
  stageCheckpoints: Record<StageId, StageCheckpoint>;
  studyLogs: StudyLog[];
}
```

### 7.4 状态规则

- `not_started → learning → understood → mastered` 是推荐顺序，但用户可以手动回退。
- 首次进入 `learning` 时记录 `startedAt`；首次达到 `understood` 时记录 `understoodAt`。
- `understood` 不要求证据，并已满足所有 hard dependency。
- `mastered` 的准入条件是：每个 `required: true` 的 mastery criterion 至少被一条有效证据覆盖，并且用户在确认界面主动勾选声明后提交。
- 达到证据覆盖条件只产生“可以确认掌握”，不得自动改变状态。
- 自动化测试、项目完成或练习完成都不得绕过手动确认。
- 保存 `mastered` 时必须生成 `MasteryConfirmation`，其中引用当时覆盖标准的证据快照；缺少证据或确认时 action 必须拒绝转换。
- 已 `mastered` 的概念不得直接删除导致必需标准失去覆盖的最后一条证据。用户必须先撤销掌握，或在同一确认事务中接受降级到 `understood`。
- 从 `mastered` 回退时保留证据、`firstMasteredAt` 和 `lastMasteredAt`，但清除当前 `masteryConfirmation`；以后需重新手动确认。再次掌握只更新 `lastMasteredAt`。
- 只有 `result: "passed"` 的证据参与必需标准覆盖判断；失败证据保留用于反思，但不授予掌握资格。
- 进度汇总必须分别计算覆盖、理解、掌握三类数量与比例；三类主进度始终对去重后的已发布必修概念等权计数，不得合并成单一“完成率”或加权。
- 路线目标状态由 `getRouteRequiredStatus` 基于学习深度和 `trackGoals` 统一计算；同一概念跨 Track 时取较高要求，项目要求可以再提高门槛。U 节点或副修 Track 中被降为 U 要求的 M 节点达到 `understood` 后不再作为普通路线任务重复推荐，但若当前项目要求 `mastered`，仍作为该项目缺口推荐。
- `in_progress` 项目必须保存去除首尾空白后非空的 `nextAction`；转为 `paused` 时保留最近下一动作，`not_started` 或 `completed` 可以省略。开始 action 必须同时保存有效的 `selectedExecutionPathId`。
- 项目环境准备度只由所选执行路径引用且标记为必需的环境要求计算；未选择路径时为 `null` 并返回每条路径的独立准备度。首选硬件路径的缺口不得污染消费级设备、公开数据或仿真路径。
- Stage 通过由 `getStageReadiness` 统一判断：`entryGate` 已满足；checkpoint 内已发布必修节点达到当前 Track 的有效目标；当前 Track 下生效的 `projectGates` 已完成；这些项目的 hard `conceptRequirements` 也达到各自 `minimumStatus`；当前 Track 下生效的必需出口标准有通过证据；若配置复测则间隔已满足。项目通过覆盖操作开始或完成，不能绕过阶段的项目知识门槛；A 节点仅在生效项目以 hard 要求提升时参与。页面不得仅凭节点百分比宣告阶段通过。
- 前述条件首次同时成立时写入 `initiallyEligibleAt`；任一条件失效时该锚点失效。配置 `retestAfterDays` 时，只有 `retestedAt >= initiallyEligibleAt + retestAfterDays` 才通过。`ROADMAP.md` 的完整 Stage 0–11 最终 checkpoint 统一使用 7 天，中间波次可省略或单独配置。

## 8. 派生服务接口

组件不得自行重复实现业务判断。至少提供以下纯函数：

```ts
interface DependencyReadiness {
  ready: boolean;
  missingHard: ConceptId[];
  missingRecommended: ConceptId[];
}

type RequiredConceptStatus = "understood" | "mastered";

function getRouteRequiredStatus(
  concept: ConceptMeta,
  tracks: TrackDefinition[],
  preferences: UserPreferences,
): RequiredConceptStatus;

function hasReachedRequiredStatus(
  status: LearningStatus,
  requiredStatus: RequiredConceptStatus,
): boolean;

function getConceptReadiness(
  concept: ConceptMeta,
  progress: Record<ConceptId, ConceptProgress>,
): DependencyReadiness;

interface MasteryEligibility {
  eligible: boolean;
  uncoveredRequiredCriteria: MasteryCriterionId[];
  eligibleEvidenceIds: EvidenceId[];
}

function getMasteryEligibility(
  concept: ConceptMeta,
  progress: ConceptProgress,
): MasteryEligibility;

interface ProjectReadiness {
  knowledgeReady: boolean;
  environmentReady: boolean | null; // 未选择路径时为 null
  selectedExecutionPathId?: string;
  missingHardConceptIds: ConceptId[];
  missingRecommendedConceptIds: ConceptId[];
  missingEnvironmentRequirementIds: string[]; // 只含所选路径的缺口
  pathReadiness: ProjectExecutionPathReadiness[];
}

interface ProjectExecutionPathReadiness {
  pathId: string;
  ready: boolean;
  missingEnvironmentRequirementIds: string[];
}

function getProjectReadiness(
  project: ProjectMeta,
  state: LearningStateV1,
): ProjectReadiness;

interface ProjectCompletionEligibility {
  eligible: boolean;
  missingAcceptanceCriterionIds: string[];
  hasDeliverable: boolean;
}

function getProjectCompletionEligibility(
  project: ProjectMeta,
  progress: ProjectProgress,
): ProjectCompletionEligibility;

interface ProgressSummary {
  scope:
    | { kind: "route" }
    | { kind: "stage"; stageId: StageId }
    | { kind: "stage-category"; categoryOrder: StageCategoryOrder }
    | { kind: "track"; trackId: TrackId };
  total: number;
  notStarted: number;
  learning: number;
  understoodOnly: number;
  started: number;
  understood: number;
  mastered: number;
  coverageRatio: number | null;
  understandingRatio: number | null;
  masteryRatio: number | null;
}

function summarizeProgress(
  concepts: ConceptMeta[],
  progress: Record<ConceptId, ConceptProgress>,
  scope: ProgressSummary["scope"],
): ProgressSummary;

interface StageReadiness {
  ready: boolean;
  entryReady: boolean;
  unmetEntryStageIds: StageId[];
  unmetMasterConceptIds: ConceptId[];
  unmetUnderstandConceptIds: ConceptId[];
  unmetProjectRequirementConceptIds: ConceptId[];
  effectiveRequiredProjectIds: ProjectId[];
  incompleteProjectIds: ProjectId[];
  unmetExitCriterionIds: string[];
  retestDue: boolean;
}

function getStageReadiness(
  stage: StageDefinition,
  stages: StageDefinition[],
  concepts: ConceptMeta[],
  projects: ProjectMeta[],
  tracks: TrackDefinition[],
  state: LearningStateV1,
): StageReadiness;

interface RecommendationTaskBase {
  reason: string;
  relatedGoal: string;
  estimatedMinutes: number;
  completionCriteria: string[];
  blockingConceptIds: ConceptId[];
}

type RecommendationTask = RecommendationTaskBase &
  (
    | {
        kind: "concept";
        targetId: ConceptId;
        requiredStatus: RequiredConceptStatus;
      }
    | { kind: "project"; targetId: ProjectId }
    | { kind: "stage-transition"; targetId: StageId }
    | { kind: "review"; targetId?: StageId }
  );

type RecommendationResult =
  | {
      kind: "tasks";
      activeStageId?: StageId;
      primary: RecommendationTask;
      alternatives: RecommendationTask[]; // 最多 3 项
    }
  | { kind: "data-error"; errors: string[] }
  | { kind: "route-complete"; primary?: RecommendationTask };
```

`summarizeProgress` 先按 scope 筛选 `published + required` 概念并按稳定 ID 去重；`notStarted`、`learning`、`understoodOnly`、`mastered` 是四种互斥状态计数，`started`、`understood`、`mastered` 分别表达累计接触、理解与掌握。`total === 0` 时三个 ratio 都返回 `null`，UI 显示“暂无必修内容”，不得伪装成 0% 或 100%。

推荐服务必须按 `PRODUCT_SPEC.md` 的确定顺序解析 `activeStageId`，并输出一个主任务和最多三个备选。每个概念候选先按推荐上下文计算 `requiredStatus`：普通路线使用 `getRouteRequiredStatus(concept, tracks, preferences)`，主项目缺口再以 `minimumStatus` 提高门槛；达到该门槛的候选必须排除。候选所属 Stage 的 `entryGate` 必须先满足；未满足时沿 gate 返回第一个未通过 checkpoint 的可执行知识或项目，不能把 Stage 11 内容提前推荐。排序严格遵循：当前焦点且状态为 `learning` → 其他学习中节点 → 主项目的必需知识或首个可执行前置 → 当前阶段必修 → 当前重点方向必修 → 选修；同层再按 recommended 缺口、可用时间、路线优先级、`hard` 子图拓扑顺序和稳定 ID 排序。recommended 缺口只能成为提示或备选补充任务，不能抢占已就绪主任务。没有显式主项目时按 `updatedAt` 降序选择进行中项目，并以稳定 `Project.id` 字典序打破同时间戳平局。没有普通候选时依次处理数据/门槛错误、未满足的阶段入口、阶段项目、下一阶段、综合项目/周回顾和选修内容。v1 不使用 AI、随机数或黑盒评分。

## 9. Zustand 与持久化适配器

### 9.1 Store 边界

使用一个逻辑 Learning Store，按 feature 文件拆分 actions 和 selectors。持久化数据与瞬时 UI 状态分开：

- 持久化：`LearningStateV1`。
- 不持久化：action、selector、hydration 状态、当前弹窗、搜索输入、临时错误。
- UI 只能调用 `startConcept`、`markUnderstood`、`confirmMastery`、`addEvidence`、`updateNote` 等领域 action。
- action 必须先验证不变量，再一次性提交新状态；组件不能直接写任意 status。

Next.js 预渲染期间没有 LocalStorage。Zustand persist 必须使用手动 hydration（如 `skipHydration`），在根部的窄 Client Provider 挂载后调用 `rehydrate()`。hydration 完成前，进度相关 UI 显示中性占位，不得先渲染错误的 0%。

### 9.2 StorageAdapter

```ts
const LEARNING_STATE_STORAGE_KEY = "mv-learning-os:learning-state";

interface PersistedEnvelopeV1 {
  app: "machine-vision-learning-os";
  schemaVersion: 1;
  contentVersion: string;
  revision: number;
  savedAt: string;
  payload: LearningStateV1;
}

interface ExportEnvelopeV1 {
  app: "machine-vision-learning-os";
  schemaVersion: 1;
  contentVersion: string;
  revision: number;
  savedAt: string;
  exportedAt: string;
  payload: LearningStateV1;
}

type ImportMode = "merge" | "replace";

interface ImportReport {
  mode: ImportMode;
  added: number;
  updated: number;
  unchanged: number;
  orphanConceptIds: ConceptId[];
  orphanProjectIds: ProjectId[];
  orphanStageIds: StageId[];
  orphanTrackIds: TrackId[];
  trackGoalConflicts: Array<{
    exclusiveMasteryGroup: string;
    activeTrackIds: TrackId[];
    storedMasterTrackIds: TrackId[];
    reason: "missing-master" | "multiple-masters" | "restored-orphan";
  }>;
}

type StorageLoadResult =
  | { ok: true; value: PersistedEnvelopeV1 | null }
  | {
      ok: false;
      reason: "unavailable" | "corrupt" | "unsupported-newer-version";
      raw?: string;
      message: string;
    };

interface LearningStateStorageAdapter {
  load(): Promise<StorageLoadResult>;
  save(value: PersistedEnvelopeV1): Promise<void>;
  clear(): Promise<void>;
}
```

LocalStorage 实现是 v1 默认实现。Store 不依赖 `window.localStorage` 的具体 API，未来可在不改变领域 action 的情况下替换为 IndexedDB 或云端 adapter。

### 9.3 schema 版本和迁移

- storage key 保持稳定，版本放在 envelope 内，避免更换 key 后找不到旧数据。
- 每次破坏性 schema 变化增加版本，并实现连续、可单测的 `vN → vN+1` 迁移；不得跨版本猜测转换。
- 迁移前先 Zod 校验旧 schema，迁移后再校验新 schema。
- 读到比当前应用更新的版本时进入只读恢复状态，绝不降级覆盖。
- 内容中已不存在的 Concept、Project、Stage 或 Track ID 不是损坏数据：记录继续保留为 orphan，排除在当前统计、目标计算或 readiness 之外，并在数据管理页列出。内容新增 Track 时，缺失目标只有在结果仍满足组约束时才用 catalog `defaultGoal` 补入有效视图；删除 Track 时保留未知 `trackGoals` 键但不生效。公共 Track 的有效目标始终强制为 `master`；导入文件若显式违反该不变量则校验失败，而不是静默改写。
- Track 被删除、恢复或跨内容版本导入后，若活动 `exclusiveMasteryGroup` 出现零个或多个 `master`，孤立键不得自动重新生效。已知内容升级必须携带可测试的 Track goal 迁移并在结果摘要中说明继任主修；未知组合进入“路线偏好待修复”状态，`ImportReport.trackGoalConflicts` 列出冲突，catalog 默认值只作为建议。用户确认恰一主修前不得写回偏好或生成依赖该路线的推荐，但全部原始目标仍可导出恢复。

### 9.4 导入、导出和损坏恢复

- 导出使用 `ExportEnvelopeV1`，其中 `revision` 与 `savedAt` 记录被导出状态的本地持久化位置，`exportedAt` 记录备份生成时间；文件名包含本地日期和 schema 版本；不得只导出当前页面的一部分状态。成功生成备份后更新 `lastBackupAt`。
- 导入先解析、识别 app、迁移、Zod 校验，再显示 `ImportReport`；用户确认前不得写入主 storage key。
- 默认 `merge`：`UserPreferences` 整体按 `updatedAt` 选择；Concept、Project 与 StageCheckpoint 记录按其 Record key 和 `updatedAt` 合并，不能按状态高低合并，因此用户主动降级会被保留；证据、交付物和日志再按自身稳定 ID 与 `updatedAt` 合并。
- 可选 `replace`：完全替换现有用户状态。提交前必须先成功生成可下载的 `ExportEnvelopeV1` 或写入独立 recovery key，再进行二次确认；备份生成/持久化失败时 action 必须拒绝替换。
- 合并和替换完成后都要再次校验，并重新计算进度、阶段/项目就绪度和推荐。
- JSON 解析失败、schema 不合法或版本过新时，不得向主 storage key 写入任何内容。
- 若主数据损坏，应用保留原始字符串于内存并提供“下载原始数据”“导入备份”“明确清空并重新开始”三种动作；用户做出选择前禁用持久化写入。
- 如浏览器允许且空间足够，可额外复制到 `mv-learning-os:recovery:<timestamp>`；复制失败不能影响原始主 key。
- `QuotaExceededError` 或隐私模式导致的写入失败必须显示持久错误；内存状态可继续使用，并立即允许导出。
- 笔记输入可短延迟批量保存，但必须在 blur/pagehide 时 flush；一次 envelope 使用单次 `setItem`，避免部分写入。

## 10. 搜索架构

### 10.1 索引模型

```ts
type SearchKind = "concept" | "project" | "resource" | "formula" | "tool";

interface SearchDocument {
  id: string;
  kind: SearchKind;
  title: string;
  englishTitle?: string;
  aliases: string[];
  keywords: string[];
  authorOrOrganization?: string;
  summary: string;
  body: string;
  tags: string[];
  href: string;
  anchor?: string;
  stageId?: StageId;
}
```

- 概念、项目和资源各生成一个主文档。
- `ConceptMeta.searchEntries` 为重要公式和工具生成带锚点的子文档，使“公式/工具搜索”可直接定位，而不是引入独立页面体系。
- MDX 标题、正文、LaTeX 文本和代码标识符被抽取为低权重 `body`；不执行 MDX 中的代码来生成索引。
- 索引按稳定 ID 排序后输出，确保相同内容生成一致结果。

### 10.2 查询与排序

- 查询文本先做 Unicode NFKC、ASCII 小写化、空白归一化。
- 中文使用 `Intl.Segmenter("zh-CN", { granularity: "word" })`；英文、缩写和数学符号保留可搜索 token。
- 排序优先级为：规范化后的中文标题精确匹配、规范英文名精确匹配、别名精确匹配、标题/别名前缀匹配、Fuse.js 加权模糊匹配。
- Fuse 权重顺序固定为：`title/englishTitle/aliases > keywords/tags > summary/authorOrOrganization > body`。
- 搜索页首次使用时懒加载 Fuse.js 和 `/_generated/search-index.json`，不增加 Dashboard 首屏负担。
- 无结果时提供按类型筛选清除和相关 Stage 入口，不调用网络搜索。

若索引日后明显影响加载，再按 kind 或 Stage 拆分；v1 不预先分片，不引入 Algolia、Meilisearch、Elasticsearch、向量数据库或语义 embedding。

## 11. 知识图谱

### 11.1 图模型

```ts
interface KnowledgeGraphNode {
  id: ConceptId;
  title: string;
  slug: string;
  stageId: StageId;
  order: number;
}

interface KnowledgeGraphEdge {
  id: string;
  source: ConceptId; // prerequisite
  target: ConceptId; // dependent concept
  kind: DependencyKind;
  reason: string;
}
```

- 图节点来自 `ConceptMeta`，边只来自 `dependencies`，方向固定为“前置 → 后续”。
- `dependent concepts` 通过反向邻接表派生，内容中不得再维护一份。
- 个人状态只在运行时叠加到节点视图，不写回静态图数据。
- build-time 校验全部边的缺失节点、自环和重复边，并校验 `hard` 子图无有向环；recommended edge 可形成不阻塞的交错参照。

### 11.2 展示策略

- 概念页先提供可访问的 DOM 前置/后续列表，图谱不是唯一导航。
- Phase 7 使用动态加载的 `@xyflow/react` 和 Dagre 只读布局；不实现拖拽保存、连线编辑或协作。
- 默认显示当前节点一至两跳，支持按 Stage、dependency kind 和掌握状态筛选；全局图是辅助总览，不默认展示无法阅读的全部节点。
- 图中的颜色不能是状态的唯一表达，节点同时显示文字/图标；键盘用户可通过等价列表完成导航。

不引入 Neo4j、图数据库、GraphQL、D3 自研布局或 ELK 高级布局。

## 12. 测试策略

### 12.1 构建与内容测试

必须覆盖：

- frontmatter 和 catalog schema 成功/失败样例。
- 重复 ID、重复 slug、坏引用、self dependency、重复 dependency edge、`hard` dependency cycle。
- mastery criterion ID 唯一性、证据引用不存在标准。
- `advanced + required`、不存在的 Track/Stage、`categoryExitForTrackIds` 不是 `trackIds` 子集等不合法组合。
- `projectGates`、条件出口标准与 `entryGate` 的坏引用；checkpoint leaf 的字段组合、空 `allOf / anyOf`、自引用和间接 gate 环；Stage 10/11 的门槛与 `ROADMAP.md` 的永久 checkpoint ID 一致。
- 所有 common Track 的 catalog/用户目标固定为 `master`；每个 `exclusiveMasteryGroup` 恰有一个高级 Track 目标为 `master`；主/副方向交换不改变实体 ID。
- 项目执行路径只引用本项目存在的环境要求；每个已发布项目至少有一条完整执行路径，涉及专业硬件时至少有一条 `consumer-hardware`、`public-data` 或 `simulation` 替代路径，并声明可验收的 `evidenceBoundary`。
- 内部页面链接和锚点存在；资源判别联合的状态组合有效，`replacementResourceId` 引用存在且不自指；外部链接只做 URL 格式校验，在线可达性由独立命令检查，避免构建受网络波动影响。
- 所有 `published` 与 `hidden` 内容产生静态内容路由；`retired` 产生迁移/说明页，`draft` 不产生公开路由。

### 12.2 领域单元测试

必须覆盖：

- `understood` 和 `mastered` 都满足 hard dependency；其他状态不满足。
- recommended dependency 不阻断就绪。
- U/A 路线节点达到 `understood` 后不再重复推荐；副修 Track 的 M 节点按 U 要求判断，主/副方向交换后节点、项目与出口标准要求随之交换，common Track 不能被降级；高级组因 Track 删除/恢复出现零个或多个主修时进入待确认修复且不生成路线推荐；项目 `minimumStatus: mastered` 能在相同节点上提高当前任务和阶段门槛。
- hard dependency 未满足时仍可访问，但 readiness 返回缺失项。
- 证据未覆盖全部 required criterion 时不能确认掌握。
- `result: "failed"` 的证据不计入覆盖，降级后保留首次/最近掌握历史时间戳。
- 证据覆盖后仍必须显式确认，不能自动进入 `mastered`。
- 删除最后覆盖证据时拒绝操作或在已确认事务中降级。
- 三类等权进度、零分母的 `null`、条件出口标准、Stage 10 的 4C 门槛、Stage 11 的公共 `allOf` 加高级方向 `anyOf` 门槛；`entryGate` 未满足时不得写入 `initiallyEligibleAt`，并覆盖锚点失效重记与复测间隔边界。
- 项目知识就绪度；选择不同执行路径时环境缺口隔离；`in_progress` 缺少非空 `nextAction` 或有效路径时拒绝保存。
- 项目覆盖开始记录当时缺口；只有必需验收项、至少一个交付物和手动确认同时满足时才能完成。
- 每个持久化 schema 迁移、未知新版本、orphan 记录和坏 JSON。
- 导出/导入 round trip 保持语义一致；默认 merge 覆盖 preferences、Concept/Project/StageCheckpoint、证据、交付物与日志，并保留 `updatedAt` 较新的主动降级；orphan Stage/Track 被保留且不参与当前计算，新增、删除与恢复 Track 覆盖无冲突回落和待确认修复分支；replace 必须在备份成功后走二次确认分支。

### 12.3 Playwright 关键流程

必须在构建后的静态产物上验证：

1. 首次访问为空状态，不出现 hydration error 或 console error。
2. 修改概念状态、刷新页面后仍存在；新浏览器 context 保持独立空状态。
3. 达到 `understood` 后，下游 hard prerequisite 变为满足。
4. 未覆盖全部必需标准不能掌握；补齐通过证据并手动确认后才成为 `mastered`。
5. 默认合并导入、显式替换导入和导出恢复均符合预览摘要；损坏文件不会覆盖已有数据。
6. 中文、英文缩写、公式和工具搜索能进入正确页面/锚点。
7. 项目显示已满足和缺失的 hard/recommended 知识、各执行路径的环境检查及替代路径；选择公开数据/仿真路径不会被首选硬件缺口阻塞；覆盖开始、下一动作和手动完成确认可追溯。
8. Graph 节点可导航，并存在等价文本列表。
9. 1440px 桌面与 390px 移动视口没有阻断性布局问题。
10. 核心流程可用键盘操作，关键页面通过自动化基础无障碍检查。

异步 Server Component 和完整 MDX 页面优先使用 E2E，而不是对框架实现做脆弱快照测试。

## 13. npm scripts 契约

`package.json` 至少提供以下稳定入口：

```json
{
  "scripts": {
    "dev": "next dev",
    "predev": "npm run content:build",
    "content:check": "tsx scripts/build-content.ts --check",
    "content:build": "tsx scripts/build-content.ts",
    "prebuild": "npm run content:build",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "links:check": "tsx scripts/check-links.ts",
    "check": "npm run content:check && npm run typecheck && npm run lint && npm run test:unit && npm run build",
    "check:full": "npm run check && npm run test:e2e"
  }
}
```

具体命令可随工具主版本做机械调整，但这些脚本名称和语义是开发阶段的公共接口。Playwright 的 `webServer` 必须启动 `out/` 的本地静态服务器，以验证真实 static export，而不只验证 `next dev`。

Phase 0 不初始化应用，也不运行尚不存在的 npm 脚本；它以文档结构、术语、内部引用、`hard` 依赖 DAG 和已写入外链检查作为验收。从 Phase 1 项目脚本建立后，每个应用开发 Phase 至少运行 `npm run check:full`，检查浏览器 console、桌面和移动关键页面，并记录失败与修复结果。外链在线检查可单独运行，不因第三方临时不可用阻断所有本地开发；确认失效的链接必须标记为 `broken` 并保留历史，或新增已验证的替代资源。

## 14. 部署与数据边界

- `next build` 的 `out/` 是唯一部署产物，可部署到 Vercel、Cloudflare Pages 或任何正确处理目录式 URL 的静态主机。
- 部署前必须用与目标主机等价的静态服务器测试直接打开深层 URL、刷新、404、资源路径和中文内容。
- 若部署在子路径，统一通过 Next.js `basePath`/asset path 配置生成链接，禁止在组件中硬编码站点根路径。
- 正式课程内容会包含在静态产物中；公开 URL 意味着任何能访问该 URL 的人都能读取内容。
- “私人定制”在 v1 表示单用户个性化，不包含应用内身份认证。若内容必须访问受限，优先使用静态主机/CDN 的访问门禁；不要在客户端伪造密码保护。
- 进度、笔记、证据和日志不会上传，只存在当前 origin 的浏览器 LocalStorage。更换域名、端口或浏览器等同于新的存储空间，迁移前必须导出备份。
- v1 不保证离线可用；没有 Service Worker/PWA。网络不可用时，仅浏览器已缓存资源可能打开。
- 不收集 analytics、telemetry 或个人学习数据。

## 15. 明确排除的过度设计

以下能力不属于 v1，也不得以“以后可能需要”为理由提前搭建：

- 账号、应用内认证、数据库、API 层、微服务、消息队列。
- 自动跨设备同步及其多主冲突合并、CRDT、事件溯源；不影响本地 JSON 导入的确定性 merge。
- Headless CMS、所见即所得正式内容编辑器、运行时远程 MDX。
- Redux、复杂领域框架、依赖注入容器、多 package monorepo。
- Neo4j、图数据库、GraphQL、可编辑图谱和复杂自动布局。
- Algolia、Meilisearch、Elasticsearch、向量数据库、RAG 或 AI 搜索。
- AI 自动规划、自动判定掌握、自动生成并直接发布学习内容。
- PWA、offline-first、Service Worker 和本地二进制附件库。
- Storybook、全量视觉回归平台、第二套 UI 框架和过早抽象的设计系统。
- 实时外链抓取、在线代码执行、Notebook 托管和训练任务调度。

未来需求出现时，先用真实数据证明现有边界不足，再通过 ADR 更新架构。优先替换已有适配器或派生服务，不推翻内容 ID、领域状态和构建期 catalog 三项核心契约。

## 16. 官方参考

以下链接最后核验日期为 **2026-08-26**：

- [Next.js：Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js：MDX](https://nextjs.org/docs/app/guides/mdx)
- [Next.js：Testing](https://nextjs.org/docs/app/guides/testing)
- [MDX：What is MDX?](https://mdxjs.com/docs/what-is-mdx/)
- [Playwright：Installation](https://playwright.dev/docs/intro)
- [Playwright：Accessibility testing](https://playwright.dev/docs/accessibility-testing)
