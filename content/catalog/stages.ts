import type { StageDefinition } from "../../src/types";

export const stages: readonly StageDefinition[] = [
  {
    id: "stage.tooling-foundations",
    categoryOrder: 0,
    order: 0,
    title: "Stage 0：计算机与编程基础",
    summary:
      "建立文件、终端、Python、版本控制、最小跨平台命令行、环境管理和调试的共同语言，能够独立重建并说明一个最小机器视觉实验。",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能够解释路径、解释器、包、模块和进程之间的关系，并运行一个小型 Python 程序。",
      "能够创建隔离环境、安装依赖，并留下他人可复现的环境说明。",
      "能够用最小实验定位路径、解释器、导入和数据类型问题。",
      "能够用 Git 保存小步修改，并从差异中说明自己改变了什么。",
      "能够阅读早期视觉项目所需的最小 Linux 命令，并把复现步骤交接给另一环境。",
    ],
    estimatedHours: { min: 35, max: 45 },
    projectGates: [],
    exitCriteria: [
      {
        id: "stage-criterion.tooling-foundations.rebuild-environment",
        description:
          "在 30 分钟内从干净目录重建隔离环境并运行 Pixel Lab，记录 commit、解释器、依赖和输入文件来源。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.tooling-foundations.diagnose-failure",
        description:
          "分别定位一个路径错误、一个 Python 异常和一个依赖/解释器错误，记录假设、验证、修复和正常案例回归。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.tooling-foundations.version-small-changes",
        description:
          "用 Git 保存语义清楚的小步修改，并能从差异中解释改动和一次冲突处理。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.tooling-foundations.explain-runtime-context",
        description:
          "解释路径、解释器、包、模块和进程的关系，并在未知工作目录中定位实际输入与输出。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.tooling-foundations.readme-handoff",
        description:
          "让另一位初学者或七天后的自己只依据 README 和已提交依赖记录，从指定 checkpoint 复现 Pixel Lab 核心结果。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
];
