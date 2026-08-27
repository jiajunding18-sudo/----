import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
  await expect(overview.locator("[data-track-id]")).toHaveCount(3);
  await expect(
    overview.locator('[data-track-id="track.common"]'),
  ).toContainText("公共主干");
  await expect(
    overview.locator('[data-track-id="track.industrial-3d"]'),
  ).toContainText("3D 工业视觉高级分支");
  await expect(
    overview.locator('[data-track-id="track.computational-imaging"]'),
  ).toContainText("计算成像高级分支");

  const overviewStageIds = await overview
    .locator("[data-overview-stage-id]")
    .evaluateAll((items) => [
      ...new Set(items.map((item) => item.getAttribute("data-overview-stage-id"))),
    ]);
  expect(overviewStageIds).toHaveLength(17);

  const stageZeroOverview = overview.locator(
    '[data-overview-stage-id="stage.tooling-foundations"]',
  );
  await expect(stageZeroOverview).toHaveAttribute("data-content-status", "available");
  await expect(stageZeroOverview).toContainText("可学习");
  await expect(stageZeroOverview).toContainText("8 个 Concept");

  const plannedStage = overview.locator(
    '[data-overview-stage-id="stage.vision-math-immediate"]',
  );
  await expect(plannedStage).toHaveAttribute("data-content-status", "planned");
  await expect(plannedStage).toContainText("已规划 · 尚未展开");
  await expect(plannedStage).toContainText("0 个已发布 Concept");
  await expect(plannedStage.locator("[data-concept-id]")).toHaveCount(0);

  const industrial3d = overview.locator(
    '[data-overview-stage-id="stage.industrial-3d"]',
  );
  await expect(industrial3d).toHaveAttribute("data-entry-gate-kind", "allOf");
  await expect(industrial3d).toContainText("全部满足");
  const capstone = overview
    .locator('[data-overview-stage-id="stage.capstone"]')
    .first();
  await expect(capstone).toContainText("满足其中一项");

  const stage = page.locator('[data-stage-id="stage.tooling-foundations"]');
  const conceptItems = stage.locator("[data-concept-id]");
  await expect(conceptItems).toHaveCount(8);
  expect(await conceptItems.evaluateAll((items) => items.map((item) => item.getAttribute("data-concept-id")))).toEqual(
    stageZeroConceptIds,
  );
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

  const stageZeroOverviewLink = overview.getByRole("link", {
    name: "查看正式内容（8 个 Concept）",
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
