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
