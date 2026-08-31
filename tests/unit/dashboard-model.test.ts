import { describe, expect, it } from "vitest";

import {
  buildDashboardCatalog,
  selectDashboardCurrentProject,
  selectDashboardLearningConcepts,
  selectDashboardSnapshot,
} from "@/features/dashboard/dashboard-model";
import { createInitialLearningState } from "@/lib/storage";
import {
  getNextStepCatalog,
  getProgressCatalog,
} from "@/lib/content/site-content";
import type { ConceptProgress, LearningStateV1, StudyLog } from "@/types";

const timestamp = "2026-08-29T08:00:00.000Z";

function learningProgress(updatedAt = timestamp): ConceptProgress {
  return {
    evidence: [],
    favorite: false,
    note: "",
    startedAt: updatedAt,
    status: "learning",
    updatedAt,
  };
}

function studyLog(
  id: string,
  localDate: string,
  minutes: number,
  createdAt: string,
): StudyLog {
  return {
    blockers: "",
    completed: "",
    conceptIds: [],
    createdAt,
    id,
    learned: id,
    localDate,
    minutes,
    projectIds: [],
    tomorrowPlan: "",
    updatedAt: createdAt,
  };
}

function setup() {
  const content = getNextStepCatalog();
  const catalog = buildDashboardCatalog(content, getProgressCatalog());
  const state = createInitialLearningState(content.tracks, timestamp);
  return { catalog, content, state };
}

describe("Dashboard 只读聚合 selector", () => {
  it("新用户只得到真实空状态与 published + required 路线分母", () => {
    const { catalog, state } = setup();
    const snapshot = selectDashboardSnapshot(catalog, state, "2026-08-29");
    const expectedTotal = catalog.progress.concepts.filter(
      ({ publicationStatus, requiredness }) =>
        publicationStatus === "published" && requiredness === "required",
    ).length;

    expect(snapshot.learningConcepts).toEqual([]);
    expect(snapshot.currentProject).toBeUndefined();
    expect(snapshot.studyLog).toMatchObject({
      lastStudyDate: undefined,
      recentLogs: [],
      todayMinutes: 0,
      weekMinutes: 0,
    });
    expect(snapshot.progress).toMatchObject({
      mastered: 0,
      started: 0,
      understood: 0,
      total: expectedTotal,
    });
  });

  it("learning Concept 按正式 Stage 与 Concept 顺序展示且排除未发布实体", () => {
    const { catalog, state } = setup();
    const earlierConcept = catalog.concepts.find(
      ({ id }) => id === "tooling.computer-files",
    );
    const laterConcept = catalog.concepts.find(
      ({ id }) => id === "math.coordinate-frames",
    );
    expect(earlierConcept).toBeDefined();
    expect(laterConcept).toBeDefined();
    const baseProgressDefinition = catalog.progress.concepts.find(
      ({ id }) => id === earlierConcept!.id,
    );
    expect(baseProgressDefinition).toBeDefined();
    const unpublished = {
      ...earlierConcept!,
      id: "concept.dashboard-planned-fixture",
      publicationStatus: "draft" as const,
    };
    const catalogWithDraft = {
      ...catalog,
      concepts: [...catalog.concepts, unpublished],
      progress: {
        ...catalog.progress,
        concepts: [
          ...catalog.progress.concepts,
          {
            ...baseProgressDefinition!,
            id: unpublished.id,
            publicationStatus: "draft" as const,
          },
        ],
      },
    };

    const changed: LearningStateV1 = {
      ...state,
      conceptProgress: {
        [laterConcept!.id]: learningProgress("2026-08-29T10:00:00.000Z"),
        [earlierConcept!.id]: learningProgress("2026-08-29T11:00:00.000Z"),
        [unpublished.id]: learningProgress("2026-08-29T12:00:00.000Z"),
      },
    };

    expect(
      selectDashboardLearningConcepts(catalogWithDraft, changed).map(({ id }) => id),
    ).toEqual([earlierConcept!.id, laterConcept!.id]);
    expect(
      selectDashboardSnapshot(catalogWithDraft, changed, "2026-08-29").progress
        .started,
    ).toBe(2);
  });

  it("当前 Project 只选择 published + in_progress，并复用正式 readiness", () => {
    const { catalog, state } = setup();
    const project = catalog.projects.find(
      ({ publicationStatus }) => publicationStatus === "published",
    );
    expect(project).toBeDefined();
    const path = project!.executionPaths[0];
    expect(path).toBeDefined();

    const changed: LearningStateV1 = {
      ...state,
      preferences: {
        ...state.preferences,
        primaryProjectId: project!.id,
      },
      projectProgress: {
        [project!.id]: {
          acceptance: {},
          deliverables: [],
          environmentChecks: Object.fromEntries(
            path.requirementIds.map((id) => [id, true]),
          ),
          nextAction: "创建可复现实验目录",
          note: "",
          selectedExecutionPathId: path.id,
          startedAt: timestamp,
          status: "in_progress",
          unverifiedAssumptions: [],
          updatedAt: timestamp,
        },
      },
    };

    const current = selectDashboardCurrentProject(catalog, changed);
    expect(current?.project.id).toBe(project!.id);
    expect(current?.progress.nextAction).toBe("创建可复现实验目录");
    expect(current?.readiness.environmentReady).toBe(true);
    expect(current?.readiness.missingHardConceptIds.length).toBeGreaterThan(0);
  });

  it("今日、本周、最近日志与最近学习日期全部来自 Study Log selector", () => {
    const { catalog, state } = setup();
    const changed: LearningStateV1 = {
      ...state,
      studyLogs: [
        studyLog("study-log.previous-week", "2026-08-23", 99, "2026-08-23T08:00:00.000Z"),
        studyLog("study-log.monday", "2026-08-24", 30, "2026-08-24T08:00:00.000Z"),
        studyLog("study-log.today-early", "2026-08-29", 20, "2026-08-29T08:00:00.000Z"),
        studyLog("study-log.today-late", "2026-08-29", 10, "2026-08-29T09:00:00.000Z"),
      ],
    };

    const summary = selectDashboardSnapshot(
      catalog,
      changed,
      "2026-08-29",
    ).studyLog;
    expect(summary.todayMinutes).toBe(30);
    expect(summary.weekMinutes).toBe(60);
    expect(summary.lastStudyDate).toBe("2026-08-29");
    expect(summary.recentLogs.map(({ id }) => id)).toEqual([
      "study-log.today-late",
      "study-log.today-early",
      "study-log.monday",
    ]);
  });
});
