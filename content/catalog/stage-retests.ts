import { stages } from "./stages";
import type { RetestDefinition } from "../../src/lib/validation/retest-schemas";

const published: Record<string, RetestDefinition["probes"]> = {
  "stage.image-computing": [
    { id:"retest-probe.image-computing.input", title:"Unfamiliar Input Retention Check：陌生输入", criterionIds:["stage-criterion.image-computing.data-contract"],
      goal:"8–12 分钟：七天后独立解释陌生图像，而非记住 fixture。",
      inputRequirement:"使用至少一张未用于原 Pixel Lab report 的合法真实图片；可以复用原代码和环境，不要求固定像素真值或新数据集。",
      whatToRecord:"实际运行并记录路径/decode guard、shape、dtype、actual min/max、channel、坐标约定和可信显示。面对 uint8 数组加法 np.array([250], dtype=np.uint8) + 20，先预测潜在溢出，再解释并验证先转为安全 dtype 后计算的方法，以及为何不能先溢出再转换。仅运行 Python 整数表达式 250 + 20 不算验证该数组运算。结果写在本 probe 内即可。",
      selfCheck:"确认读取失败不会访问 shape；dtype 不等于实际范围；解释 BGR/RGB 与 row/column；独立解释 overflow 和安全运算。本次确实使用新输入，不是仅引用旧报告。" },
    { id:"retest-probe.image-computing.batch", title:"Small Batch Reliability Retention Check：小批可靠性", criterionIds:["stage-criterion.image-computing.batch-pipeline"],
      goal:"10–18 分钟：实际复跑小批并解释可靠性，不重写程序。",
      inputRequirement:"复用 Pixel Lab 程序，准备 3–5 个小输入：至少一个成功输入、一个允许扩展名的坏文件、一个 unsupported extension。",
      whatToRecord:"执行一次小批，在新干净目录 rerun；记录参数、discovery identity 集合、success/failed/skipped、输出及 manifest 位置。解释 existing-output policy 和 source protection。可只引用自然生成的 manifest，不新建多份报告。",
      selfCheck:"核对每个发现文件有唯一身份且不漏不重；数量等式不是唯一证明；坏文件为 failed、unsupported 为 skipped；检查写出/reload/manifest 保存、干净目录 rerun 语义一致。实际执行，不只回答理论题。" },
  ],
  "stage.tooling-foundations": [
    { id:"retest-probe.tooling.run", title:"运行与环境解释", criterionIds:["stage-criterion.tooling-foundations.rebuild-environment","stage-criterion.tooling-foundations.explain-runtime-context"],
      goal:"7–10 分钟：从已有环境和 repo 独立运行最小程序。",
      inputRequirement:"复用 Stage 0 Pixel Lab checkpoint 和已安装环境；换一个工作目录，不重新安装 Python 或初始化仓库。",
      whatToRecord:"依据 README 选择解释器并运行；记录 cwd、输入输出解析路径、解释器与依赖记录。解释若环境丢失，从干净目录恢复所需的最小命令和检查。",
      selfCheck:"能区分路径、解释器、包、模块和进程；运行结果可核对，能说明恢复顺序而不是只复制命令。" },
    { id:"retest-probe.tooling.diagnose", title:"小故障诊断", criterionIds:["stage-criterion.tooling-foundations.diagnose-failure"],
      goal:"6–10 分钟：用最小验证排除错误假设。",
      inputRequirement:"在安全副本故意制造一个错误路径并实际诊断；另选原记录中的 Python 异常与解释器/依赖错误做独立解释。",
      whatToRecord:"记录假设、验证命令、实际现象、修正及正常案例回归；说明另外两类错误为何不能用同一种修复。",
      selfCheck:"能定位真实原因，修复后正常输入仍工作；不静默吞错、不改系统环境掩盖问题。" },
    { id:"retest-probe.tooling.handoff", title:"版本与 README 交接", criterionIds:["stage-criterion.tooling-foundations.version-small-changes","stage-criterion.tooling-foundations.readme-handoff"],
      goal:"7–10 分钟：验证七天后的自己能依据记录复现。",
      inputRequirement:"复用已有 Git 历史、README 和依赖记录，无需新 commit 或重新建 repo。",
      whatToRecord:"记录指定 commit，阅读一次小步 diff 并解释改动；说明一次冲突处理；依据 README 核对刚才运行能否由另一人重复，标记必要的说明缺口。",
      selfCheck:"能把版本、依赖、输入来源与结果对应；说明冲突处理和正常回归；不是凭记忆绕过 README。" },
  ],
};
export const stageRetests: readonly RetestDefinition[] = stages.filter(s=>s.retestAfterDays !== undefined).map(s=>({
  id:`retest.${s.id.slice(6)}`, stageId:s.id, version:1,
  contentStatus: published[s.id] ? "published" : "planned",
  estimatedMinutes: s.categoryOrder === 0 ? {min:20,max:35} : {min:20,max:40},
  probes:published[s.id] ?? [],
}));
