import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { contentManifest } from "../../.generated/content-manifest";

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test("Dashboard 完整学习状态在 360px 下可读、无溢出且支持键盘操作", async ({
  page,
}) => {
  const timestamp = "2026-08-29T08:00:00.000Z";
  const today = localDate(new Date());
  const project = contentManifest.projects.find(
    ({ id }) => id === "project.pixel-lab",
  );
  const path = project?.executionPaths.find(
    ({ id }) => id === "execution.pixel-lab.generated-image",
  );
  expect(project).toBeDefined();
  expect(path).toBeDefined();
  const trackGoals = Object.fromEntries(
    contentManifest.tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const contentVersion = [
    ...contentManifest.concepts.map(({ contentVersion }) => contentVersion),
    ...contentManifest.projects.map(({ contentVersion }) => contentVersion),
  ]
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .at(-1);
  const envelope = {
    app: "machine-vision-learning-os",
    contentVersion: contentVersion ?? "content-schema-1",
    payload: {
      conceptProgress: {
        "tooling.python-core": {
          evidence: [],
          favorite: false,
          note: "",
          startedAt: timestamp,
          status: "learning",
          updatedAt: timestamp,
        },
      },
      preferences: {
        focusedTrackIds: [],
        primaryProjectId: project!.id,
        trackGoals,
        updatedAt: timestamp,
        weeklyTargetMinutes: 540,
      },
      projectProgress: {
        [project!.id]: {
          acceptance: {},
          deliverables: [],
          environmentChecks: Object.fromEntries(
            path!.requirementIds.map((id) => [id, true]),
          ),
          nextAction: "创建项目目录并记录 Python 解释器路径",
          note: "",
          selectedExecutionPathId: path!.id,
          startedAt: timestamp,
          status: "in_progress",
          unverifiedAssumptions: [],
          updatedAt: timestamp,
        },
      },
      schemaVersion: 1,
      stageCheckpoints: {},
      studyLogs: [
        {
          blockers: "",
          completed: "",
          conceptIds: ["tooling.python-core"],
          createdAt: timestamp,
          id: "study-log.dashboard-mobile",
          learned: "在移动端核对一条由用户主动填写的真实学习记录摘要",
          localDate: today,
          minutes: 45,
          projectIds: [project!.id],
          tomorrowPlan: "",
          updatedAt: timestamp,
        },
      ],
    },
    revision: 1,
    savedAt: timestamp,
    schemaVersion: 1,
  };

  await page.addInitScript(
    ({ value }) =>
      window.localStorage.setItem("mv-learning-os:learning-state", value),
    { value: JSON.stringify(envelope) },
  );
  await page.goto("/");

  await expect(page.locator('[data-dashboard-console="ready"]')).toBeVisible();
  await expect(
    page.locator('[data-dashboard-learning-concept-id="tooling.python-core"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-dashboard-current-project="project.pixel-lab"]'),
  ).toBeVisible();
  await expect(page.locator("[data-dashboard-today-minutes]")).toHaveText(
    "45 分钟",
  );
  await expect(page.locator("[data-dashboard-week-minutes]")).toHaveText(
    "45 分钟",
  );
  await expect(page.locator("[data-dashboard-study-log-id]")).toHaveCount(1);

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);

  const projectLink = page.getByRole("link", { name: "进入 Project" });
  await projectLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);
});
