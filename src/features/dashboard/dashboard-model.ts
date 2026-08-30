import { getProjectReadiness } from "@/features/projects/project-readiness";
import {
  selectConceptIdsByStatus,
  summarizeProgress,
  type ProgressCatalog,
  type ProgressProjectDefinition,
} from "@/features/progress/progress-domain";
import type { NextStepCatalog } from "@/features/recommendations";
import { selectStudyLogSummary } from "@/features/study-log/study-log-domain";
import type { LearningStateV1 } from "@/types";

export interface DashboardConcept {
  readonly id: string;
  readonly order: number;
  readonly publicationStatus: "draft" | "published" | "hidden" | "retired";
  readonly slug: string;
  readonly stageId: string;
  readonly title: string;
}

export interface DashboardProject extends ProgressProjectDefinition {
  readonly slug: string;
  readonly title: string;
}

export interface DashboardCatalog {
  readonly concepts: readonly DashboardConcept[];
  readonly progress: ProgressCatalog;
  readonly projects: readonly DashboardProject[];
  readonly stages: readonly {
    readonly id: string;
    readonly order: number;
  }[];
}

export function buildDashboardCatalog(
  content: NextStepCatalog,
  progress: ProgressCatalog,
): DashboardCatalog {
  const progressProjects = new Map(
    progress.projects.map((project) => [project.id, project]),
  );

  return {
    concepts: content.concepts.map(
      ({ id, order, publicationStatus, slug, stageId, title }) => ({
        id,
        order,
        publicationStatus,
        slug,
        stageId,
        title,
      }),
    ),
    progress,
    projects: content.projects.flatMap(({ id, slug, title }) => {
      const definition = progressProjects.get(id);
      return definition ? [{ ...definition, slug, title }] : [];
    }),
    stages: content.stages.map(({ id, order }) => ({ id, order })),
  };
}

function sortConceptsByRoute(catalog: DashboardCatalog) {
  const stageOrder = new Map(
    catalog.stages.map(({ id, order }) => [id, order]),
  );

  return catalog.concepts
    .filter(({ publicationStatus }) => publicationStatus === "published")
    .toSorted(
      (left, right) =>
        (stageOrder.get(left.stageId) ?? Number.MAX_SAFE_INTEGER) -
          (stageOrder.get(right.stageId) ?? Number.MAX_SAFE_INTEGER) ||
        left.order - right.order ||
        left.id.localeCompare(right.id, "en"),
    );
}

export function selectDashboardLearningConcepts(
  catalog: DashboardCatalog,
  state: LearningStateV1,
) {
  const routeConcepts = sortConceptsByRoute(catalog);
  const learningIds = new Set(
    selectConceptIdsByStatus(
      routeConcepts.map(({ id }) => id),
      state.conceptProgress,
      "learning",
    ),
  );

  return routeConcepts.filter(({ id }) => learningIds.has(id));
}

export function selectDashboardCurrentProject(
  catalog: DashboardCatalog,
  state: LearningStateV1,
) {
  const inProgressProjects = catalog.projects.filter(
    (project) =>
      project.publicationStatus === "published" &&
      state.projectProgress[project.id]?.status === "in_progress",
  );
  const primaryProject = inProgressProjects.find(
    ({ id }) => id === state.preferences.primaryProjectId,
  );
  const project =
    primaryProject ??
    inProgressProjects.toSorted((left, right) => {
      const leftUpdatedAt = state.projectProgress[left.id]?.updatedAt ?? "";
      const rightUpdatedAt = state.projectProgress[right.id]?.updatedAt ?? "";
      return (
        rightUpdatedAt.localeCompare(leftUpdatedAt, "en") ||
        left.id.localeCompare(right.id, "en")
      );
    })[0];

  if (!project) return undefined;

  return {
    progress: state.projectProgress[project.id],
    project,
    readiness: getProjectReadiness(project, state),
  } as const;
}

export function selectDashboardSnapshot(
  catalog: DashboardCatalog,
  state: LearningStateV1,
  todayLocalDate: string,
) {
  return {
    currentProject: selectDashboardCurrentProject(catalog, state),
    learningConcepts: selectDashboardLearningConcepts(catalog, state),
    progress: summarizeProgress(catalog.progress.concepts, state.conceptProgress, {
      kind: "route",
    }),
    studyLog: selectStudyLogSummary(state.studyLogs, todayLocalDate, 3),
  } as const;
}
