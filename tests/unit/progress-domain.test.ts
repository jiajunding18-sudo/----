import { describe, expect, it } from "vitest";

import {
  addMasteryEvidence,
  confirmConceptMastery,
  downgradeConcept,
  getConceptReadiness,
  getConceptStatus,
  markConceptUnderstood,
  startConcept,
  summarizeStageProgress,
  type ProgressConceptDefinition,
} from "@/features/progress/progress-domain";
import type { ConceptProgress, MasteryEvidence } from "@/types";

const firstTimestamp = "2026-08-28T01:00:00.000Z";
const secondTimestamp = "2026-08-28T02:00:00.000Z";
const thirdTimestamp = "2026-08-28T03:00:00.000Z";

function concept(
  id: string,
  dependencies: ProgressConceptDefinition["dependencies"] = [],
): ProgressConceptDefinition {
  return {
    id,
    stageId: "stage.test",
    trackIds: ["track.common"],
    requiredness: "required",
    publicationStatus: "published",
    dependencies,
    masteryCriteria: [
      {
        id: `criterion.${id}.explain`,
        description: "能够解释核心概念",
        evidenceHint: "保存一份可检查的解释。",
        required: true,
      },
      {
        id: `criterion.${id}.apply`,
        description: "能够完成代表性练习",
        evidenceHint: "保存输入、输出与核对过程。",
        required: true,
      },
    ],
  };
}

const foundation = concept("concept.foundation");
const hardDependent = concept("concept.hard-dependent", [
  { conceptId: foundation.id, kind: "hard" },
]);
const recommendedDependent = concept("concept.recommended-dependent", [
  { conceptId: foundation.id, kind: "recommended" },
]);

function requireProgress(result: ReturnType<typeof startConcept>) {
  if (!result.ok) throw new Error(result.message);
  return result.progress;
}

function understoodProgress(target = foundation) {
  const learning = requireProgress(startConcept(undefined, firstTimestamp));
  const result = markConceptUnderstood(
    target,
    { [target.id]: learning },
    secondTimestamp,
  );
  if (!result.ok) throw new Error(result.message);
  return result.progress;
}

function evidence(
  target: ProgressConceptDefinition,
  id: string,
  criterionIds: string[],
  result: "passed" | "failed" = "passed",
): MasteryEvidence {
  return {
    id,
    conceptId: target.id,
    criterionIds,
    kind: "exercise",
    title: "可检查实验",
    note: "保存了输入、输出和解释。",
    result,
    completedAt: secondTimestamp,
    createdAt: secondTimestamp,
    updatedAt: secondTimestamp,
  };
}

describe("Concept progress 状态规则", () => {
  it("新用户与新增 Concept 在缺少记录时都默认为 not_started", () => {
    expect(getConceptStatus({}, foundation.id)).toBe("not_started");
    expect(getConceptStatus({}, "concept.added-later")).toBe("not_started");
  });

  it("支持 not_started → learning，并只记录首次开始时间", () => {
    const started = startConcept(undefined, firstTimestamp);
    expect(started).toMatchObject({
      ok: true,
      changed: true,
      progress: { status: "learning", startedAt: firstTimestamp },
    });

    const repeated = startConcept(requireProgress(started), secondTimestamp);
    expect(repeated).toMatchObject({ ok: true, changed: false });
    if (repeated.ok) expect(repeated.progress.startedAt).toBe(firstTimestamp);
  });

  it("支持 learning → understood", () => {
    expect(understoodProgress().status).toBe("understood");
  });

  it("hard 前置未满足时拒绝 understood", () => {
    const learning = requireProgress(startConcept(undefined, firstTimestamp));
    const result = markConceptUnderstood(
      hardDependent,
      { [hardDependent.id]: learning },
      secondTimestamp,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "missing-hard-prerequisite",
      relatedIds: [foundation.id],
    });
  });

  it("recommended 前置不形成硬阻塞，但仍在 readiness 中报告", () => {
    const readiness = getConceptReadiness(recommendedDependent, {});
    expect(readiness).toEqual({
      ready: true,
      missingHard: [],
      missingRecommended: [foundation.id],
    });

    const learning = requireProgress(startConcept(undefined, firstTimestamp));
    expect(
      markConceptUnderstood(
        recommendedDependent,
        { [recommendedDependent.id]: learning },
        secondTimestamp,
      ),
    ).toMatchObject({ ok: true, progress: { status: "understood" } });
  });

  it("understood 未满足时不能 mastered", () => {
    const learning = requireProgress(startConcept(undefined, firstTimestamp));
    expect(
      confirmConceptMastery(foundation, learning, true, secondTimestamp),
    ).toMatchObject({ ok: false, code: "status-not-understood" });
  });

  it("缺少 Mastery Evidence 时不能 mastered", () => {
    expect(
      confirmConceptMastery(
        foundation,
        understoodProgress(),
        true,
        thirdTimestamp,
      ),
    ).toMatchObject({ ok: false, code: "missing-mastery-evidence" });
  });

  it("全部 required criteria 有 passed evidence 且用户确认后可以 mastered", () => {
    const progress = understoodProgress();
    const added = addMasteryEvidence(
      foundation,
      progress,
      evidence(
        foundation,
        "evidence.foundation",
        foundation.masteryCriteria.map(({ id }) => id),
      ),
      thirdTimestamp,
    );
    if (!added.ok) throw new Error(added.message);
    expect(
      confirmConceptMastery(foundation, added.progress, false, thirdTimestamp),
    ).toMatchObject({ ok: false, code: "confirmation-required" });
    const mastered = confirmConceptMastery(
      foundation,
      added.progress,
      true,
      thirdTimestamp,
    );
    expect(mastered).toMatchObject({
      ok: true,
      progress: {
        status: "mastered",
        firstMasteredAt: thirdTimestamp,
        lastMasteredAt: thirdTimestamp,
      },
    });
  });

  it("failed evidence 不授予掌握资格", () => {
    const progress = understoodProgress();
    const added = addMasteryEvidence(
      foundation,
      progress,
      evidence(
        foundation,
        "evidence.failed",
        foundation.masteryCriteria.map(({ id }) => id),
        "failed",
      ),
      thirdTimestamp,
    );
    if (!added.ok) throw new Error(added.message);
    expect(
      confirmConceptMastery(foundation, added.progress, true, thirdTimestamp),
    ).toMatchObject({ ok: false, code: "missing-mastery-evidence" });
  });

  it("主动回退保留证据与历史时间戳，并清除当前掌握确认", () => {
    const progress = understoodProgress();
    const added = addMasteryEvidence(
      foundation,
      progress,
      evidence(
        foundation,
        "evidence.foundation",
        foundation.masteryCriteria.map(({ id }) => id),
      ),
      thirdTimestamp,
    );
    if (!added.ok) throw new Error(added.message);
    const mastered = confirmConceptMastery(
      foundation,
      added.progress,
      true,
      thirdTimestamp,
    );
    if (!mastered.ok) throw new Error(mastered.message);

    const downgraded = downgradeConcept(
      mastered.progress,
      "understood",
      "2026-08-28T04:00:00.000Z",
    );
    expect(downgraded).toMatchObject({
      ok: true,
      progress: {
        status: "understood",
        firstMasteredAt: thirdTimestamp,
        evidence: [{ id: "evidence.foundation" }],
      },
    });
    if (downgraded.ok) {
      expect(downgraded.progress.masteryConfirmation).toBeUndefined();
    }
  });
});

describe("Stage 三类派生进度", () => {
  it("分别计算接触、understood 与 mastered，并排除 orphan", () => {
    const concepts = [
      foundation,
      hardDependent,
      recommendedDependent,
      { ...concept("concept.optional"), requiredness: "optional" as const },
      { ...concept("concept.draft"), publicationStatus: "draft" as const },
    ];
    const learning = requireProgress(startConcept(undefined, firstTimestamp));
    const understood = understoodProgress(recommendedDependent);
    const mastered = {
      ...understoodProgress(),
      status: "mastered",
    } as ConceptProgress;
    const progress = {
      [foundation.id]: learning,
      [recommendedDependent.id]: understood,
      [hardDependent.id]: mastered,
      "concept.orphan": learning,
    };

    expect(summarizeStageProgress(concepts, progress, "stage.test")).toEqual({
      total: 3,
      started: 3,
      understood: 2,
      mastered: 1,
      coverageRatio: 1,
      understandingRatio: 2 / 3,
      masteryRatio: 1 / 3,
    });
  });
});
