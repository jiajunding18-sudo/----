import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const stageZeroConceptIds = [
  "tooling.computer-files",
  "tooling.dev-environment",
  "tooling.python-core",
  "tooling.python-modules",
  "tooling.git-basics",
  "tooling.debugging",
  "tooling.linux-basics",
  "tooling.reproducibility",
] as const;

const stageOneAConceptIds = [
  "math.vectors-matrices",
  "math.linear-transforms",
  "math.calculus-gradients",
  "math.probability-statistics",
] as const;

const stageOneBConceptIds = [
  "math.coordinate-frames",
  "math.least-squares",
  "math.eigen-svd",
  "math.optimization",
  "math.numerical-stability",
] as const;

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectUniqueFocusedStages(list: Locator, expectedCount: number) {
  const stageIds = await list
    .locator(":scope > [data-overview-stage-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-overview-stage-id")),
    );
  expect(stageIds).toHaveLength(expectedCount);
  expect(new Set(stageIds).size).toBe(expectedCount);
}

test("Roadmap 从 manifest 展示 Stage 0 完整路线并支持键盘导航", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/roadmap/");
  await expect(page.getByRole("heading", { level: 1, name: "Roadmap" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stage 0：计算机与编程基础" }),
  ).toHaveCount(2);

  const overview = page.locator("[data-roadmap-overview]");
  const focusedStageList = overview.locator("[data-focused-stage-list]");
  const allRoutesButton = overview.getByRole("button", { name: "全部路线" });
  const commonButton = overview.getByRole("button", { name: "公共主干" });
  const industrialButton = overview.getByRole("button", {
    name: "3D 工业视觉高级分支",
  });
  const computationalButton = overview.getByRole("button", {
    name: "计算成像高级分支",
  });

  await expect(overview.locator("[data-track-focus]")).toHaveCount(4);
  await expect(allRoutesButton).toHaveAttribute("aria-pressed", "true");
  await expectUniqueFocusedStages(focusedStageList, 17);

  await commonButton.focus();
  await expect(commonButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(overview.locator("[data-active-track]")).toHaveAttribute(
    "data-active-track",
    "track.common",
  );
  await expectUniqueFocusedStages(focusedStageList, 14);
  await expect(
    focusedStageList.locator('[data-overview-stage-id="stage.industrial-3d"]'),
  ).toHaveCount(0);

  await industrialButton.click();
  await expectUniqueFocusedStages(focusedStageList, 2);
  await expect(
    focusedStageList.locator('[data-overview-stage-id="stage.industrial-3d"]'),
  ).toBeVisible();
  await expect(
    focusedStageList.locator('[data-overview-stage-id="stage.capstone"]'),
  ).toHaveAttribute("data-shared-checkpoint", "true");

  await computationalButton.click();
  await expectUniqueFocusedStages(focusedStageList, 3);
  await expect(
    focusedStageList.locator('[data-overview-stage-id="stage.imaging-quality-advanced"]'),
  ).toBeVisible();

  await allRoutesButton.click();
  await expectUniqueFocusedStages(focusedStageList, 17);

  const stageZeroOverview = overview.locator(
    '[data-overview-stage-id="stage.tooling-foundations"]',
  );
  await expect(stageZeroOverview).toHaveAttribute("data-content-status", "available");
  await expect(stageZeroOverview).toContainText("可学习");
  await expect(stageZeroOverview).toContainText("8 个 Concept");

  const stageOneAOverview = focusedStageList.locator(
    '[data-overview-stage-id="stage.vision-math-immediate"]',
  );
  await expect(stageOneAOverview).toHaveAttribute(
    "data-content-status",
    "available",
  );
  await expect(stageOneAOverview).toContainText("可学习");
  await expect(stageOneAOverview).toContainText("4 个 Concept");
  await stageOneAOverview.locator("summary").click();
  await expect(stageOneAOverview).toHaveAttribute("open", "");
  await expect(
    stageOneAOverview.locator("[data-exit-criterion-id]"),
  ).toHaveCount(2);

  const stageOneBOverview = focusedStageList.locator(
    '[data-overview-stage-id="stage.vision-math-geometry-optimization"]',
  );
  await expect(stageOneBOverview).toHaveAttribute(
    "data-content-status",
    "available",
  );
  await expect(stageOneBOverview).toContainText("可学习");
  await expect(stageOneBOverview).toContainText("5 个 Concept");
  await stageOneBOverview.locator("summary").click();
  await expect(stageOneBOverview).toHaveAttribute("open", "");
  await expect(
    stageOneBOverview.locator("[data-exit-criterion-id]"),
  ).toHaveCount(2);

  await industrialButton.click();
  const industrial3d = focusedStageList.locator(
    '[data-overview-stage-id="stage.industrial-3d"]',
  );
  await expect(industrial3d).toHaveAttribute("data-entry-gate-kind", "allOf");
  await industrial3d.locator("summary").click();
  await expect(industrial3d).toContainText("以下条件都需要满足");
  await expect(industrial3d.locator('[data-gate-operator="allOf"]')).toHaveCount(1);
  await expect(industrial3d.getByRole("button", { name: /Stage 6B/ })).toBeVisible();
  await expect(industrial3d.getByRole("button", { name: /Stage 8/ })).toBeVisible();

  await industrial3d.getByRole("button", { name: /Stage 6B/ }).click();
  await expect(overview.locator("[data-active-track]")).toHaveAttribute(
    "data-active-track",
    "all",
  );
  const depthReconstruction = focusedStageList.locator(
    '[data-overview-stage-id="stage.depth-reconstruction"]',
  );
  await expect(depthReconstruction).toHaveAttribute("open", "");
  await expect(depthReconstruction.locator("summary")).toBeFocused();

  const capstone = focusedStageList.locator(
    '[data-overview-stage-id="stage.capstone"]',
  );
  await capstone.locator("summary").click();
  await expect(capstone).toContainText("以下条件满足任意一项即可");
  await expect(capstone.locator('[data-gate-operator="anyOf"]')).toHaveCount(1);
  await expect(capstone).toContainText("主修掌握");

  if ((await stageOneBOverview.getAttribute("open")) === null) {
    await stageOneBOverview.locator("summary").click();
  }
  await expect(stageOneBOverview.locator("[data-project-gate-id]")).toHaveCount(1);
  await expect(stageOneBOverview).toContainText("项目已规划 · 正文未发布");
  const plannedProjectLink = stageOneBOverview.getByRole("link", { name: /视觉数学实验册/ });
  await expect(plannedProjectLink).toHaveAttribute(
    "href",
    "/projects/#project-math-vision-lab",
  );

  const stageTwo = focusedStageList.locator(
    '[data-overview-stage-id="stage.image-computing"]',
  );
  await stageTwo.locator("summary").click();
  await expect(stageTwo.locator('[data-project-gate-id="project.pixel-lab"]')).toBeVisible();
  await expect(stageTwo.getByRole("link", { name: /Pixel Lab/ })).toBeVisible();

  const stage = page.locator('[data-stage-id="stage.tooling-foundations"]');
  const conceptItems = stage.locator("[data-concept-id]");
  await expect(conceptItems).toHaveCount(8);
  expect(await conceptItems.evaluateAll((items) => items.map((item) => item.getAttribute("data-concept-id")))).toEqual(
    stageZeroConceptIds,
  );

  const stageOneA = page.locator(
    '[data-stage-id="stage.vision-math-immediate"]',
  );
  const stageOneAConcepts = stageOneA.locator("[data-concept-id]");
  await expect(stageOneAConcepts).toHaveCount(4);
  expect(
    await stageOneAConcepts.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-concept-id")),
    ),
  ).toEqual(stageOneAConceptIds);

  const stageOneB = page.locator(
    '[data-stage-id="stage.vision-math-geometry-optimization"]',
  );
  await stageOneB.locator("summary").click();
  await expect(stageOneB.locator("details")).toHaveAttribute("open", "");
  const stageOneBConcepts = stageOneB.locator("[data-concept-id]");
  await expect(stageOneBConcepts).toHaveCount(5);
  expect(
    await stageOneBConcepts.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-concept-id")),
    ),
  ).toEqual(stageOneBConceptIds);
  await expect(
    stageOneB.locator('[data-concept-id="math.coordinate-frames"]'),
  ).toBeVisible();
  await expect(stageOneB.locator('[data-dependency-kind="hard"]')).toHaveCount(7);
  await expect(
    stageOneB.locator('[data-dependency-kind="recommended"]'),
  ).toHaveCount(4);
  await expect(stage.locator('[data-dependency-kind="hard"]')).toHaveCount(7);
  await expect(stage.locator('[data-dependency-kind="recommended"]')).toHaveCount(5);
  await expect(stage.getByText("M · 必须掌握")).toHaveCount(7);
  await expect(stage.getByText("U · 理解即可")).toHaveCount(1);

  await expect(stage.locator('[data-project-id="project.pixel-lab"]')).toBeVisible();
  await expect(stage.getByRole("heading", { name: "Stage 出口标准" })).toBeVisible();
  await expect(
    stage.locator(
      'section[aria-labelledby="stage.tooling-foundations-exit"] ol > li',
    ),
  ).toHaveCount(5);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("我的学习进度")).toHaveCount(0);

  const disclosure = stage.locator("summary");
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press("Space");
  await expect(stage.locator("details")).not.toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(stage.locator("details")).toHaveAttribute("open", "");

  await stageZeroOverview.locator("summary").click();
  const stageZeroOverviewLink = stageZeroOverview.getByRole("link", {
    name: "进入正式 Stage 内容（8 个 Concept）",
  });
  await stageZeroOverviewLink.focus();
  await expect(stageZeroOverviewLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#stage\.tooling-foundations-detail$/);

  const pythonCoreLink = stage.getByRole("link", { name: "Python 核心语法" }).first();
  await pythonCoreLink.focus();
  await expect(pythonCoreLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/python-core\/$/);

  await page.goto("/roadmap/");
  await page.getByRole("link", { name: /Pixel Lab/ }).click();
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);

  await page.goto("/roadmap/");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
