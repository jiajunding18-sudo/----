import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { seedAllPublishedConceptsMastered } from "./helpers/learning-state";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
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

test("Projects 从 manifest 浏览 13 项能力路线并按正式维度筛选", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/projects/");

  await expect(page.locator("[data-project-id]")).toHaveCount(13);
  await expect(
    page.locator('[data-project-id="project.pixel-lab"]'),
  ).toHaveAttribute("data-project-status", "published");
  await expect(
    page.locator('[data-project-id="project.classical-inspection"]'),
  ).toHaveAttribute("data-project-status", "draft");
  await expect(page.getByText("Published · 可执行", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Draft · Planned", { exact: true })).toHaveCount(13);

  const status = page.getByLabel("Status");
  await status.focus();
  await expect(status).toBeFocused();
  await status.selectOption("draft");
  await expect(page.locator("[data-project-id]")).toHaveCount(12);
  await expect(page.locator('[data-project-status="published"]')).toHaveCount(0);

  await status.selectOption("all");
  await page.getByLabel("Stage").selectOption("stage.planar-vision");
  await expect(page.locator("[data-project-id]")).toHaveCount(1);
  await expect(
    page.locator('[data-project-id="project.planar-localization"]'),
  ).toBeVisible();

  await page.getByLabel("Stage").selectOption("all");
  await page.getByLabel("Track").selectOption("track.computational-imaging");
  await expect(page.locator("[data-project-id]")).toHaveCount(2);

  await page.getByLabel("Track").selectOption("all");
  await page.getByLabel("Difficulty / Level").selectOption("beginner");
  await expect(page.locator('[data-project-level="beginner"]')).toHaveCount(3);

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Pixel Lab 显示能力、应用、Required Knowledge 与实时 readiness", async ({
  page,
}) => {
  await page.goto("/projects/pixel-lab/");

  await expect(page.locator("[data-project-capability-overview]")).toContainText(
    "从现实问题到能力证据",
  );
  await expect(page.getByRole("heading", { name: "Real-world Connection" })).toBeVisible();
  await expect(page.locator("[data-project-requirement]")).toHaveCount(8);
  await expect(
    page.getByRole("heading", { name: "Recommended / supportive" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-project-requirement="tooling.linux-basics"]'),
  ).toContainText("需要已理解");
  await expect(page.locator('[data-requirement-satisfied="false"]')).toHaveCount(8);
  await expect(page.getByText(/仍缺 7 项 hard requirement/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Pixel Lab/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next Projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: "经典零件与图形检测" })).toHaveAttribute(
    "href",
    "/projects/#project-classical-inspection",
  );

  await seedAllPublishedConceptsMastered(page);
  await page.reload();
  await expect(
    page.locator('[data-project-knowledge-readiness="ready"]'),
  ).toBeVisible();
  await expect(page.getByText("已具备开始条件", { exact: true })).toBeVisible();
  await expect(page.locator('[data-requirement-satisfied="true"]')).toHaveCount(8);
  await expectNoHorizontalOverflow(page);
});

test("Concept 与 Roadmap 都通过正式派生关系返回 Project", async ({ page }) => {
  await page.goto("/knowledge/computer-files-and-terminal/");
  const usage = page.locator("[data-concept-project-usage]");
  await expect(usage.locator('[data-concept-project-id="project.pixel-lab"]')).toBeVisible();
  await usage.getByRole("link", { name: /Pixel Lab/ }).click();
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);

  await page.goto("/roadmap/");
  const stageOneB = page.locator(
    '[data-overview-stage-id="stage.vision-math-geometry-optimization"]',
  );
  await stageOneB.locator("summary").click();
  const planned = stageOneB.getByRole("link", { name: "视觉数学实验册" });
  await planned.click();
  await expect(page).toHaveURL(/\/projects\/#project-math-vision-lab$/);
  await expect(
    page.locator('[data-project-id="project.math-vision-lab"]'),
  ).toBeVisible();
});
