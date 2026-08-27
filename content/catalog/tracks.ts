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
];
