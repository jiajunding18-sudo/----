import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Dashboard NextStep 在 360px 下无页面级溢出且可用键盘进入 Concept", async ({
  page,
}) => {
  await page.goto("/");
  const nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-target-id",
    "tooling.computer-files",
  );

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);

  const action = nextStep.getByRole("link", { name: "开始学习" });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/computer-files-and-terminal\/$/);
});
