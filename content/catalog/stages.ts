import type { StageDefinition } from "../../src/types";

export const stages: readonly StageDefinition[] = [
  {
    id: "stage.tooling-foundations",
    categoryOrder: 0,
    order: 0,
    title: "Stage 0：计算机与编程基础",
    summary:
      "建立文件、终端、Python、版本控制、最小跨平台命令行、环境管理和调试的共同语言，能够独立重建并说明一个最小机器视觉实验。",
    contentStatus: "available",
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
  {
    id: "stage.vision-math-immediate",
    categoryOrder: 1,
    order: 10,
    title: "Stage 1A：即时视觉数学",
    summary:
      "先建立向量、矩阵、线性变换、梯度与概率统计的最小数学语言，为首次图像计算与数值检查提供工具。",
    contentStatus: "available",
    trackIds: ["track.common"],
    categoryExitForTrackIds: [],
    outcomes: [
      "能在运行代码前说明向量与矩阵形状，并检查运算是否合法。",
      "能把二维线性变换、简单梯度和随机噪声同视觉实验建立联系。",
    ],
    estimatedHours: { min: 30, max: 40 },
    projectGates: [],
    exitCriteria: [
      {
        id: "stage-criterion.vision-math-immediate.shape-check",
        description:
          "针对一个视觉计算写出向量和矩阵形状，在代码运行前检查乘法与变换是否合法。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.vision-math-immediate.numerical-check",
        description:
          "用数值梯度或采样统计检查一个小实验，记录假设、误差与不确定性。",
        required: true,
        when: { kind: "always" },
      },
    ],
  },
  {
    id: "stage.vision-math-geometry-optimization",
    categoryOrder: 1,
    order: 20,
    title: "Stage 1B：几何与优化数学",
    summary:
      "按后续几何、标定、重建与训练任务的需要，补齐坐标系、最小二乘、SVD、优化与数值稳定性。",
    contentStatus: "available",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能区分坐标点、方向向量、坐标系和变换，并完成往返验证。",
      "能用残差、SVD、梯度与条件数判断一个数值结果是否可信。",
    ],
    estimatedHours: { min: 40, max: 50 },
    projectGates: [
      {
        projectId: "project.math-vision-lab",
        when: { kind: "always" },
      },
    ],
    exitCriteria: [
      {
        id: "stage-criterion.vision-math-geometry-optimization.coordinate-roundtrip",
        description:
          "在两个坐标系间完成点与方向的往返变换，用数值误差验证闭环。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.vision-math-geometry-optimization.method-explanation",
        description:
          "结合数值实验解释最小二乘、SVD 和梯度为何会出现在标定、重建和训练中，并报告残差与失稳案例。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.image-computing",
    categoryOrder: 2,
    order: 30,
    title: "Stage 2：Python 科学计算与 OpenCV 图像实验",
    summary:
      "把图像视为带有类型、形状、通道和坐标约定的数值数据，构建可重复、可检查的二维图像处理流水线。",
    contentStatus: "available",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能从路径、shape、dtype、通道、数值范围和坐标约定检查陌生图像。",
      "能将交互试验整理为输入、参数、输出与失败都可追踪的批处理程序。",
    ],
    estimatedHours: { min: 60, max: 75 },
    projectGates: [
      { projectId: "project.pixel-lab", milestoneId: "milestone.pixel-lab.image-computing", when: { kind: "always" } },
    ],
    exitCriteria: [
      {
        id: "stage-criterion.image-computing.data-contract",
        description:
          "面对陌生图片先检查路径、形状、类型、通道、范围和方向，并解释 BGR/RGB、uint8 溢出和宽高/行列/坐标混淆。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.image-computing.batch-pipeline",
        description:
          "把一次交互式试验整理为批处理程序，保存参数、输入、输出、指标与失败清单。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.digital-image-processing",
    categoryOrder: 3,
    order: 40,
    title: "Stage 3：数字图像处理",
    summary:
      "理解数字图像的采样、噪声、卷积与频域机理，根据任务指标选择滤波、增强、分割与形态学方法。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能用采样、卷积、噪声和频率解释常见图像现象。",
      "能设计固定数据、单变量、保留参数和随机种子的公平对照。",
    ],
    estimatedHours: { min: 65, max: 85 },
    projectGates: [
      {
        projectId: "project.classical-inspection",
        when: { kind: "always" },
      },
    ],
    exitCriteria: [
      {
        id: "stage-criterion.digital-image-processing.explain-image-phenomena",
        description:
          "用采样、卷积、噪声和频域实验解释常见图像现象，不只罗列函数名。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.digital-image-processing.controlled-comparison",
        description:
          "固定数据并一次只改变一个主要因素，比较至少两种方案，保存指标、参数、随机种子和失败分析。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.imaging-foundations",
    categoryOrder: 4,
    order: 50,
    title: "Stage 4A：成像链基础",
    summary:
      "建立“物理世界 → 照明 → 镜头 → 传感器 → 数字图像 → 算法”的最小因果链，理解 FOV、采样、曝光与信噪比。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: [],
    outcomes: [
      "能画出完整成像链，并按照明、光学、传感器、数字化和算法定位现象。",
      "能使用目标尺寸、FOV、工作距离、像素当量和曝光建立最小成像约束。",
    ],
    estimatedHours: { min: 25, max: 35 },
    projectGates: [],
    exitCriteria: [
      {
        id: "stage-criterion.imaging-foundations.formation-chain",
        description:
          "针对一个采集案例画出成像链，记录目标尺寸、FOV、工作距离、像素当量、曝光与主要误差源。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.imaging-foundations.failure-classification",
        description:
          "对失焦、运动模糊、噪声、饱和与采样不足进行受控对照，说明现象所在的成像环节。",
        required: true,
        when: { kind: "always" },
      },
    ],
  },
  {
    id: "stage.industrial-imaging",
    categoryOrder: 4,
    order: 60,
    title: "Stage 4B：工业成像与采集设计",
    summary:
      "通过受控照明、镜头选择、曝光、动态范围与噪声诊断，把光电背景转化为工业采集设计能力。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能针对检测或测量任务选择照明方式、曝光与基本成像参数。",
      "能区分反光、噪声、饱和、模糊和采样不足，并按优先级提出修正。",
    ],
    estimatedHours: { min: 25, max: 35 },
    projectGates: [
      {
        projectId: "project.imaging-quality-lab",
        when: { kind: "always" },
      },
    ],
    entryGate: {
      kind: "checkpoint",
      stageId: "stage.imaging-foundations",
    },
    exitCriteria: [
      {
        id: "stage-criterion.industrial-imaging.imaging-design-sheet",
        description:
          "完成一张成像设计单：目标尺寸、FOV、工作距离、像素当量、曝光、照明和主要误差源。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.industrial-imaging.controlled-acquisition",
        description:
          "在固定场景中分别改变照明方向、曝光/增益、距离或运动条件，区分现象并给出修正优先级。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.imaging-quality-advanced",
    categoryOrder: 4,
    order: 70,
    title: "Stage 4C：高级成像质量",
    summary:
      "在数字图像处理之后回访 PSF、MTF、衍射、像差与退化模型，为计算成像建立物理前置。",
    contentStatus: "planned",
    trackIds: ["track.computational-imaging"],
    categoryExitForTrackIds: ["track.computational-imaging"],
    outcomes: [
      "能把 PSF/MTF 与卷积、频域和图像恢复联系起来。",
      "能通过受控实验区分真实采集结论与仿真假设。",
    ],
    estimatedHours: { min: 25, max: 35 },
    projectGates: [],
    entryGate: {
      kind: "checkpoint",
      stageId: "stage.imaging-foundations",
    },
    exitCriteria: [
      {
        id: "stage-criterion.imaging-quality-advanced.psf-mtf-evidence",
        description:
          "通过 PSF/MTF 或等价受控退化实验，验证光学传递、卷积、频率响应与图像恢复之间的关系。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.imaging-quality-advanced.resolution-claim",
        description:
          "基于采样、信噪比、PSF/MTF 和误差预算，解释为何更高传感器分辨率不自动等于更高测量精度。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.planar-vision",
    categoryOrder: 5,
    order: 80,
    title: "Stage 5：计算机视觉基础与二维几何",
    summary:
      "从像素处理进入对应建立、几何估计、离群点抵抗与跨帧跟踪的视觉推理。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能解释检测、描述、匹配、模型估计与验证的完整数据流。",
      "能用内点率、重投影误差、时延与退化场景评估平面定位。",
    ],
    estimatedHours: { min: 65, max: 85 },
    projectGates: [
      {
        projectId: "project.planar-localization",
        when: { kind: "always" },
      },
    ],
    entryGate: {
      kind: "checkpoint",
      stageId: "stage.imaging-foundations",
    },
    exitCriteria: [
      {
        id: "stage-criterion.planar-vision.pipeline-explanation",
        description:
          "从检测—描述—匹配—模型估计—验证解释完整数据流，并说明 Homography 的适用条件。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.planar-vision.quantitative-evaluation",
        description:
          "在平面定位实验中报告匹配数、内点率、重投影误差、运行时间和至少三类失败样例。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.geometric-vision",
    categoryOrder: 6,
    order: 90,
    title: "Stage 6A：相机模型、标定与多视图几何",
    summary:
      "建立坐标系、刚体变换、相机投影、标定、极几何、三角测量与 PnP 的几何主干。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: [],
    outcomes: [
      "能画出并实现世界、相机、物体、图像与像素坐标变换链。",
      "能用采集覆盖、重投影误差、异常图像和退化条件验证标定或位姿结果。",
    ],
    estimatedHours: { min: 75, max: 105 },
    projectGates: [
      {
        projectId: "project.calibrated-metrology",
        when: { kind: "always" },
      },
      {
        projectId: "project.stereo-or-pnp",
        when: { kind: "always" },
      },
    ],
    exitCriteria: [
      {
        id: "stage-criterion.geometric-vision.coordinate-chain",
        description:
          "画出并实现世界、相机、物体、图像和像素坐标之间的变换链，通过投影或往返误差检查。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.geometric-vision.calibration-evidence",
        description:
          "标定或 PnP/双目实验包含采集覆盖、重投影误差、异常图像与重拍/重算依据。",
        required: true,
        when: { kind: "always" },
      },
    ],
  },
  {
    id: "stage.depth-reconstruction",
    categoryOrder: 6,
    order: 100,
    title: "Stage 6B：深度、点云与重建",
    summary:
      "在标定、极几何和三角测量证据之上，完成深度估计、点云处理、几何测量与配准闭环。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能解释基线、焦距、标定误差、匹配误差和遮挡对深度的影响。",
      "能完成一个点云处理闭环，并以几何误差或重复性而非视觉观感验证。",
    ],
    estimatedHours: { min: 55, max: 75 },
    projectGates: [
      {
        projectId: "project.pointcloud-measurement",
        when: { kind: "always" },
      },
    ],
    entryGate: {
      kind: "checkpoint",
      stageId: "stage.geometric-vision",
    },
    exitCriteria: [
      {
        id: "stage-criterion.depth-reconstruction.depth-error-analysis",
        description:
          "用实验说明基线、焦距、标定误差、匹配误差和遮挡如何影响深度。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.depth-reconstruction.pointcloud-loop",
        description:
          "完成点云预处理、几何测量或配准闭环，报告真值/标准尺寸、误差、重复性和错误收敛案例。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.deep-learning-foundations",
    categoryOrder: 7,
    order: 110,
    title: "Stage 7A：深度学习训练基础",
    summary:
      "建立张量、自动微分、损失函数、优化、数据管道和可复现训练的最小能力。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: [],
    outcomes: [
      "能运行一个可复现的最小训练实验，记录数据划分、配置、随机种子与指标。",
      "能通过训练/验证曲线和对照实验诊断过拟合、类别不平衡与数据泄漏。",
    ],
    estimatedHours: { min: 50, max: 70 },
    projectGates: [],
    exitCriteria: [
      {
        id: "stage-criterion.deep-learning-foundations.reproducible-training",
        description:
          "在可用设备上完成一个最小训练或预训练模型评价实验，保存数据划分、配置、随机种子、环境与指标。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.deep-learning-foundations.training-diagnosis",
        description:
          "根据曲线、指标和受控对照诊断过拟合、类别不平衡或数据泄漏，并记录验证过程。",
        required: true,
        when: { kind: "always" },
      },
    ],
  },
  {
    id: "stage.modern-vision-tasks",
    categoryOrder: 7,
    order: 120,
    title: "Stage 7B：深度视觉任务与评价",
    summary:
      "在任务定义和正式评价前置上，完成分类、检测或分割的代表任务，并与传统基线公平比较。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能定义分类、检测或分割问题的输入、输出、标注、指标和数据划分。",
      "能比较传统基线与学习式方法，并按场景分组分析失败。",
    ],
    estimatedHours: { min: 60, max: 80 },
    projectGates: [
      {
        projectId: "project.learning-defect-inspection",
        when: { kind: "always" },
      },
    ],
    entryGate: {
      kind: "checkpoint",
      stageId: "stage.deep-learning-foundations",
    },
    exitCriteria: [
      {
        id: "stage-criterion.modern-vision-tasks.auditable-evaluation",
        description:
          "数据划分、标签质量、指标和实验配置可审计，最终测试集没有被反复调参污染。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.modern-vision-tasks.baseline-failure-analysis",
        description:
          "在一个分类、检测或分割任务中比较传统基线与学习式模型，提供消融/对照与按场景分组的失败分析。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.industrial-vision",
    categoryOrder: 8,
    order: 130,
    title: "Stage 8：工业机器视觉系统",
    summary:
      "把实际需求转为成像、算法、节拍、通信与质量指标，完成从需求分析到部署验证的二维工业闭环。",
    contentStatus: "planned",
    trackIds: ["track.common"],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能形成需求书、成像选型表、误差预算、状态图与验收报告。",
      "能在独立测试与重复采集中量化精度、误检/漏检、延迟和失败恢复。",
    ],
    estimatedHours: { min: 100, max: 140 },
    projectGates: [
      {
        projectId: "project.industrial-vision-system",
        when: { kind: "always" },
      },
    ],
    exitCriteria: [
      {
        id: "stage-criterion.industrial-vision.system-package",
        description:
          "交付需求书、成像选型表、误差预算、算法基线、时序/状态图和验收报告。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.industrial-vision.independent-validation",
        description:
          "在独立测试集与重复采集上报告精度、误检/漏检、延迟和失败恢复，对空帧、坏图、超时与越界结果显式处理。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.industrial-3d",
    categoryOrder: 9,
    order: 140,
    title: "Stage 9：3D 工业视觉",
    summary:
      "将 3D 几何、成像传感与工业验收结合，为测量、定位、抓取或缺陷任务选择并验证合适的 3D 技术。",
    contentStatus: "planned",
    trackIds: ["track.industrial-3d"],
    categoryExitForTrackIds: ["track.industrial-3d"],
    outcomes: [
      "能根据任务约束比较双目、结构光、激光三角与 ToF。",
      "能将算法、标定、传感与机械/时序误差分层，并报告物理量与重复性。",
    ],
    estimatedHours: { min: 90, max: 130 },
    projectGates: [
      {
        projectId: "project.industrial-3d-system",
        when: {
          kind: "track-goal",
          trackId: "track.industrial-3d",
          minimumGoal: "master",
        },
      },
    ],
    entryGate: {
      kind: "allOf",
      gates: [
        { kind: "checkpoint", stageId: "stage.depth-reconstruction" },
        { kind: "checkpoint", stageId: "stage.industrial-vision" },
      ],
    },
    exitCriteria: [
      {
        id: "stage-criterion.industrial-3d.method-selection",
        description:
          "根据任务而非技术热度比较双目、结构光、激光三角与 ToF，说明选择边界。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.industrial-3d.minimum-experiment",
        description:
          "用公开数据、仿真或可用设备完成最小实验，正确标注单位、坐标系、数据来源与不能外推的硬件结论。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.industrial-3d.master-system-loop",
        description:
          "完成从传感数据到物理量或位姿的闭环，报告偏差、重复性与遮挡、材质、弱纹理或多路径失败边界。",
        required: true,
        when: {
          kind: "track-goal",
          trackId: "track.industrial-3d",
          minimumGoal: "master",
        },
      },
      {
        id: "stage-criterion.industrial-3d.master-error-budget",
        description:
          "区分并量化算法误差、标定误差、传感误差和机械/时序误差。",
        required: true,
        when: {
          kind: "track-goal",
          trackId: "track.industrial-3d",
          minimumGoal: "master",
        },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.computational-imaging",
    categoryOrder: 10,
    order: 150,
    title: "Stage 10：智能成像与计算成像",
    summary:
      "理解光学前向模型与计算逆问题如何协同，在明确退化、噪声与先验的前提下完成可评价的成像恢复或感知任务。",
    contentStatus: "planned",
    trackIds: ["track.computational-imaging"],
    categoryExitForTrackIds: ["track.computational-imaging"],
    outcomes: [
      "能明确写出成像前向模型、噪声假设、先验、基线和评价指标。",
      "能识别恢复伪影、模型失配与仿真—真实差距，不把视觉锐利等同于信息真实。",
    ],
    estimatedHours: { min: 80, max: 120 },
    projectGates: [
      {
        projectId: "project.optics-algorithm",
        when: {
          kind: "track-goal",
          trackId: "track.computational-imaging",
          minimumGoal: "master",
        },
      },
    ],
    entryGate: {
      kind: "checkpoint",
      stageId: "stage.imaging-quality-advanced",
    },
    exitCriteria: [
      {
        id: "stage-criterion.computational-imaging.forward-model-baseline",
        description:
          "完成一个含明确前向模型、噪声假设、朴素基线和评价指标的最小实验。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.computational-imaging.prior-artifact-explanation",
        description:
          "解释先验与正则化的收益和伪影，不把视觉锐利等同于信息真实。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.computational-imaging.master-reproducible-comparison",
        description:
          "完成恢复方法与朴素基线的可复现对照，并至少进行一次模型失配或分布外测试。",
        required: true,
        when: {
          kind: "track-goal",
          trackId: "track.computational-imaging",
          minimumGoal: "master",
        },
      },
      {
        id: "stage-criterion.computational-imaging.master-physics-baseline",
        description:
          "若采用学习式方法，与物理或传统基线比较，并说明训练数据与真实成像链差异。",
        required: true,
        when: {
          kind: "track-goal",
          trackId: "track.computational-imaging",
          minimumGoal: "master",
        },
      },
    ],
    retestAfterDays: 7,
  },
  {
    id: "stage.capstone",
    categoryOrder: 11,
    order: 160,
    title: "Stage 11：综合项目、科研与作品集",
    summary:
      "将学习证据收束为完整、可复现、可答辩的机器视觉系统，形成面向科研、竞赛、实习或研究生阶段的可信作品。",
    contentStatus: "planned",
    trackIds: [
      "track.common",
      "track.industrial-3d",
      "track.computational-imaging",
    ],
    categoryExitForTrackIds: ["track.common"],
    outcomes: [
      "能从问题定义、成像/传感、数据、基线、系统接口到独立验收完成可复现闭环。",
      "能用测试证据说明设计取舍、误差来源、失败模式、能力边界与个人贡献。",
    ],
    estimatedHours: { min: 140, max: 200 },
    projectGates: [
      { projectId: "project.capstone", when: { kind: "always" } },
    ],
    entryGate: {
      kind: "allOf",
      gates: [
        { kind: "checkpoint", stageId: "stage.tooling-foundations" },
        {
          kind: "checkpoint",
          stageId: "stage.vision-math-geometry-optimization",
        },
        { kind: "checkpoint", stageId: "stage.image-computing" },
        {
          kind: "checkpoint",
          stageId: "stage.digital-image-processing",
        },
        { kind: "checkpoint", stageId: "stage.industrial-imaging" },
        { kind: "checkpoint", stageId: "stage.planar-vision" },
        { kind: "checkpoint", stageId: "stage.depth-reconstruction" },
        { kind: "checkpoint", stageId: "stage.modern-vision-tasks" },
        { kind: "checkpoint", stageId: "stage.industrial-vision" },
        {
          kind: "anyOf",
          gates: [
            {
              kind: "track-goal-checkpoint",
              stageId: "stage.industrial-3d",
              trackId: "track.industrial-3d",
              minimumTrackGoal: "master",
            },
            {
              kind: "track-goal-checkpoint",
              stageId: "stage.computational-imaging",
              trackId: "track.computational-imaging",
              minimumTrackGoal: "master",
            },
          ],
        },
      ],
    },
    exitCriteria: [
      {
        id: "stage-criterion.capstone.independent-reproduction",
        description:
          "新读者能在不询问作者的情况下，依据环境、配置、数据与运行说明复现核心流程和主要结果。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.capstone.evidence-boundary",
        description:
          "项目结论由独立测试证据支持，清楚区分真实硬件、普通摄像头、公开数据和仿真结果。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.capstone.frozen-acceptance",
        description:
          "完成至少一次冻结需求后的完整验收，不在最终测试集上持续调参。",
        required: true,
        when: { kind: "always" },
      },
      {
        id: "stage-criterion.capstone.defense",
        description:
          "在答辩中解释关键设计取舍、最大失败模式、误差来源、个人贡献和下一步改进。",
        required: true,
        when: { kind: "always" },
      },
    ],
    retestAfterDays: 7,
  },
];
