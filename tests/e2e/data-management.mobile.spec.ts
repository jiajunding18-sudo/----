import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Settings/Data 在 360px 下无页面级横向溢出且可访问", async ({ page }) => {
  await page.goto("/settings/data/");
  await expect(page.getByRole("heading", { name: "Settings / Data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出 JSON 备份" })).toBeVisible();
  await expect(page.getByLabel("选择 Learning OS JSON 备份")).toBeVisible();
  await expect(page.getByRole("button", { name: "准备清空学习记录" })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
