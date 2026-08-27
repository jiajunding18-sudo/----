import type { TrackDefinition } from "../../src/types";

export const tracks: readonly TrackDefinition[] = [
  {
    id: "track.common",
    order: 0,
    title: "公共主干",
    summary:
      "所有方向共同需要的编程、数学、成像、图像处理与视觉基础；先建立可复现的实验能力，再逐步分流。",
    kind: "common",
    defaultGoal: "master",
  },
  {
    id: "track.industrial-3d",
    order: 10,
    title: "3D 工业视觉高级分支",
    summary:
      "在公共几何视觉、深度重建与工业系统能力之上，面向 3D 测量、位姿、抓取和缺陷任务形成主修深度。",
    kind: "advanced-branch",
    defaultGoal: "master",
    exclusiveMasteryGroup: "track-group.advanced-major",
  },
  {
    id: "track.computational-imaging",
    order: 20,
    title: "计算成像高级分支",
    summary:
      "在高级成像质量、退化模型与优化基础上，研究光学前向模型、逆问题和光学—算法协同设计。",
    kind: "advanced-branch",
    defaultGoal: "understand",
    exclusiveMasteryGroup: "track-group.advanced-major",
  },
];
