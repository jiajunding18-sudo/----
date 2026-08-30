import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Concept Progress 在 360px 下可操作、无页面级横向溢出且可访问", async ({
  page,
}) => {
  await page.goto("/knowledge/python-core/");
  const progress = page.locator("[data-concept-progress]");
  await expect(progress).toContainText("当前：未开始");

  const start = progress.getByRole("button", { name: "开始学习" });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(progress).toContainText("当前：学习中");
  await expect(progress.getByRole("form", { name: "记录一条通过证据" })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("Dashboard Progress 在 360px 下可继续学习且无页面级横向溢出", async ({
  page,
}) => {
  await page.goto("/knowledge/python-core/");
  await page.locator("[data-concept-progress]").getByRole("button", { name: "开始学习" }).click();

  await page.goto("/");
  const dashboard = page.locator('[data-dashboard-console="ready"]');
  const learningLink = dashboard.locator(
    '[data-dashboard-learning-concept-id="tooling.python-core"]',
  );
  await expect(learningLink).toBeVisible();
  await expect(dashboard.locator('[data-dashboard-progress-kind="started"]')).toHaveText(
    "1 / 8",
  );

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);

  await learningLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/python-core\/$/);
});
