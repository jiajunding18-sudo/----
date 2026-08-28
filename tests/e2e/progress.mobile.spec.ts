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

test("Progress 总览在 360px 下可筛选、继续学习且无页面级横向溢出", async ({
  page,
}) => {
  await page.goto("/knowledge/python-core/");
  await page.locator("[data-concept-progress]").getByRole("button", { name: "开始学习" }).click();

  await page.goto("/");
  const overview = page.locator("[data-progress-overview]");
  await expect(overview.locator('[data-continue-concept-id="tooling.python-core"]')).toBeVisible();
  const learningFilter = overview.locator('[data-progress-filter="learning"]');
  await learningFilter.focus();
  await page.keyboard.press("Enter");
  await expect(learningFilter).toHaveAttribute("aria-pressed", "true");
  await expect(overview.locator("[data-progress-concept-results]")).toContainText(
    "Python 核心语法",
  );

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
