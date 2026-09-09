import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentManifest } from "../../.generated/content-manifest";
import { historyTime, legacyEnvelope, milestone0, milestone2, pixelLab } from "../fixtures/project-milestones";
import { migratePersistedEnvelope } from "@/lib/storage/migrations";
import { getMilestoneCompletionEligibility, getMilestoneReadiness, resolveProjectMilestone } from "@/features/projects/project-milestones";
import { mutateProjectMilestone, type MilestoneAction } from "@/features/projects/project-milestone-progress";
import { getStageReadiness } from "@/features/progress/stage-readiness";
import { learningStateV2Schema } from "@/lib/validation/progress-schemas";

const hardIds = ["python.numpy-arrays", "python.numpy-dtypes", "image.digital-representation", "opencv.io-color", "opencv.roi-masks", "pipeline.batch-images"];
const scoped = resolveProjectMilestone(pixelLab, milestone2)!;
function stateWithHistory() {
  const result = migratePersistedEnvelope(legacyEnvelope());
  if (!result.ok) throw new Error(result.message);
  return result.value.payload;
}
function readyState() {
  const state = stateWithHistory();
  for (const id of hardIds) state.conceptProgress[id] = { status: "understood", note: "", favorite: false, updatedAt: historyTime, startedAt: historyTime, understoodAt: historyTime, evidence: [] };
  return state;
}
function act(state: ReturnType<typeof readyState>, action: MilestoneAction) {
  const result = mutateProjectMilestone(pixelLab, state, milestone2, action, historyTime);
  expect(result.ok).toBe(true);
  if (result.ok) state.projectProgress[pixelLab.id] = result.progress;
}
function started() {
  const state = readyState();
  act(state, { kind: "start", input: { selectedExecutionPathId: pixelLab.executionPaths[0].id, nextAction: "Task 1 输入报告", environmentChecks: {}, confirmPrerequisiteOverride: false } });
  return state;
}
function accepted() {
  const state = started();
  for (const criterion of scoped.acceptanceCriteria) act(state, { kind: "acceptance", id: criterion.id, checked: true });
  return state;
}
const artifact = { kind: "add-deliverable" as const, input: { id: "deliverable.stage-two.index", title: "A/B/C 人工验收索引", reference: "evidence/index.md" } };

describe("Phase 9E-1 real Pixel Lab Stage 2 contract", () => {
  it("publishes only the scoped contract, with six understood hard and seven evidence IDs", () => {
    expect(pixelLab.milestones![0].contract).toEqual({ kind: "project" });
    expect(pixelLab.milestones![1].contract.kind).toBe("inline");
    expect(scoped.conceptRequirements.map(({ conceptId }) => conceptId)).toEqual(hardIds);
    expect(scoped.conceptRequirements.every(({ kind, minimumStatus }) => kind === "hard" && minimumStatus === "understood")).toBe(true);
    expect(scoped.evidenceConceptIds).toEqual([...hardIds, "visualization.image-plots"]);
    expect(scoped.acceptanceCriteria.map(({ id }) => id.split(".").at(-1))).toEqual(["unfamiliar-input-contract", "roi-mask-contract", "source-protection", "batch-identity-integrity", "output-manifest-integrity", "failure-reproducibility"]);
    expect(scoped.acceptanceCriteria.every(({ required }) => required)).toBe(true);
    expect(scoped.deliverableRequirements).toHaveLength(3);
    expect(pixelLab.estimatedHours).toEqual({ min: 12, max: 18 });
    expect(contentManifest.concepts.filter(({ stageId }) => stageId === "stage.image-computing")).toHaveLength(12);
  });
  it.each(hardIds)("missing hard %s blocks even with completed Stage 0", (id) => {
    const state = readyState();
    delete state.conceptProgress[id];
    expect(getMilestoneReadiness(pixelLab, state, milestone2)).toMatchObject({ contractPublished: true, knowledgeReady: false, missingHardConceptIds: [id] });
  });
  it("six understood suffice; evidence-only plots not_started does not block", () => {
    const state = readyState();
    expect(state.conceptProgress["visualization.image-plots"]).toBeUndefined();
    expect(getMilestoneReadiness(pixelLab, state, milestone2).knowledgeReady).toBe(true);
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2).eligible).toBe(false);
  });
  it.each(scoped.acceptanceCriteria.map(({ id }) => id))("missing acceptance %s blocks", (id) => {
    const state = accepted();
    act(state, artifact);
    act(state, { kind: "acceptance", id, checked: false });
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2)).toMatchObject({ eligible: false, missingAcceptanceCriterionIds: [id] });
    expect(mutateProjectMilestone(pixelLab, state, milestone2, { kind: "complete", confirmed: true }, historyTime).ok).toBe(false);
  });
  it("no deliverable blocks; a record grants eligibility but not completion without confirmation", () => {
    const state = accepted();
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2)).toMatchObject({ eligible: false, hasDeliverable: false });
    act(state, artifact);
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2).eligible).toBe(true);
    expect(mutateProjectMilestone(pixelLab, state, milestone2, { kind: "complete", confirmed: false }, historyTime).ok).toBe(false);
    expect(state.projectProgress[pixelLab.id].milestones![milestone2].status).toBe("in_progress");
    act(state, { kind: "complete", confirmed: true });
    expect(state.projectProgress[pixelLab.id].milestones![milestone2].status).toBe("completed");
  });
  it("not started cannot complete even if acceptance and a record are present", () => {
    const state = accepted();
    act(state, artifact);
    state.projectProgress[pixelLab.id].milestones![milestone2].status = "not_started";
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2).eligible).toBe(false);
  });
  it("completion passes only scoped project gate, never writes Concepts or Stage exit/retest", () => {
    const state = accepted();
    for (const concept of contentManifest.concepts.filter(({ stageId }) => stageId === "stage.image-computing")) {
      const criterionIds = concept.masteryCriteria.map(({ id }) => id);
      const evidenceId = `evidence.stage-two.${concept.id}`;
      state.conceptProgress[concept.id] = {
        status: "mastered", note: "test target state", favorite: false, updatedAt: historyTime,
        startedAt: historyTime, understoodAt: historyTime, firstMasteredAt: historyTime, lastMasteredAt: historyTime,
        evidence: [{ id: evidenceId, conceptId: concept.id, criterionIds, kind: "exercise", title: "validated fixture", note: "test", result: "passed", completedAt: historyTime, createdAt: historyTime, updatedAt: historyTime }],
        masteryConfirmation: { confirmedAt: historyTime, criterionIds, evidenceIds: [evidenceId], statementVersion: 1 },
      };
    }
    const before = structuredClone(state);
    expect(learningStateV2Schema.safeParse(state).success).toBe(true);
    const stage = contentManifest.stages.find(({ id }) => id === "stage.image-computing")!;
    const gate = () => getStageReadiness(stage, contentManifest.stages, contentManifest.concepts, contentManifest.projects, contentManifest.tracks, state);
    expect(gate().incompleteProjectIds).toContain(pixelLab.id);
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2).eligible).toBe(false);
    act(state, artifact);
    act(state, { kind: "complete", confirmed: true });
    expect(gate().incompleteProjectIds).toEqual([]);
    expect(gate().ready).toBe(false);
    expect(gate().unmetExitCriterionIds).toHaveLength(2);
    expect(state.stageCheckpoints).toEqual(before.stageCheckpoints);
    expect(state.conceptProgress).toEqual(before.conceptProgress);
    expect(state.projectProgress[pixelLab.id].milestones![milestone0]).toEqual(before.projectProgress[pixelLab.id].milestones![milestone0]);
  });
  it("v1 migration after publication preserves history without inventing Stage 2 completion", () => {
    const state = stateWithHistory();
    expect(state.projectProgress[pixelLab.id].status).toBe("completed");
    expect(state.projectProgress[pixelLab.id].milestones![milestone0].status).toBe("completed");
    expect(state.projectProgress[pixelLab.id].milestones![milestone2]).toBeUndefined();
    expect(getMilestoneReadiness(pixelLab, state, milestone2).contractPublished).toBe(true);
    expect(getMilestoneCompletionEligibility(pixelLab, state, milestone2).eligible).toBe(false);
  });
  it("teaches three integrated tasks, approved machine/manual boundary and no detection assignment", () => {
    const body = readFileSync("content/projects/beginner/pixel-lab.mdx", "utf8").split("## Stage 2 Goal")[1].split("</details>")[0];
    expect(body.match(/### Task [123]：/g)).toHaveLength(3);
    for (const phrase of ["6–8 小时", "Input Contract Report", "ROI / Mask Processing Record", "source.copy()", "np.array_equal(source, original)", "result[~mask] = 0", "identity set", "error-on-existing", "不逐组识别 A/B/C", "不自动检查磁盘", "不写 stageCheckpoints", "不代替 Concept", "PPM 不在 batch 教材的默认 allowlist"]) expect(body).toContain(phrase);
    expect(body).not.toMatch(/cv2\.(threshold|findContours|ORB_create|warpAffine)/);
  });
  it("connects one config and the single-image operation to the existing batch", () => {
    const body = readFileSync("content/projects/beginner/pixel-lab.mdx", "utf8").split("## Stage 2 Goal")[1].split("</details>")[0];
    for (const key of ["allowed_suffixes", "roi", "output_extension", "continue_on_error", "output_policy"]) expect(body).toContain(`"${key}"`);
    expect(body).toContain('config["roi"][key]');
    expect(body).toContain("process_one(input_path, output_path, config):");
    for (const step of ["input_contract", "output_contract", "parameters.roi", "reload", "snapshot"]) expect(body).toContain(step);
    expect(body).toMatch(/删除 threshold/);
    expect(body).toMatch(/不再验证二维 binary/);
    expect(body).toMatch(/删除 contour count\/area/);
    expect(body).toContain("不是可以直接复制运行的完整答案");
  });
  it("distinguishes shared real-image obligations and fixed-window size failures", () => {
    const body = readFileSync("content/projects/beginner/pixel-lab.mdx", "utf8").split("## Stage 2 Goal")[1].split("</details>")[0];
    expect(body).toContain("无论当时选哪条");
    expect(body).toContain("不强制相机或网络下载");
    expect(body).toContain("普通照片不要求预先知道像素真值");
    expect(body).toContain("坐标/像素探针");
    expect(body).toContain("不会检测目标或自动对齐");
    expect(body).toContain("尺寸不足记为 item contract failure");
    expect(body).toContain("不为让它成功而暗中改变逐图 ROI");
  });
  it("keeps a short execution path and one representative human report", () => {
    const body = readFileSync("content/projects/beginner/pixel-lab.mdx", "utf8").split("## Stage 2 Goal")[1].split("</details>")[0];
    const path = body.split("先按这条短路径执行")[1].split("**目标**")[0];
    expect(path.match(/^\d\. /gm)).toHaveLength(8);
    for (const section of ["Input Contract Report", "ROI / Mask Processing Record", "source protection", "failure records", "rerun"]) expect(body).toContain(section);
    expect(body).toContain("唯一人工验证报告");
    expect(body).toContain("不为 10–20 项手填卡片");
    expect(body).toContain("不复制整个 JSON");
    expect(body).toContain("input | expected | actual | reason | correction");
  });
});
