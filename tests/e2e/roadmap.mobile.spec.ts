import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("360px 下 Roadmap 无横向溢出且阶段内容可访问", async ({ page }) => {
  await page.goto("/roadmap/");

  const overview = page.locator("[data-roadmap-overview]");
  await expect(overview.locator("[data-track-id]")).toHaveCount(3);
  await expect(
    overview.locator('[data-overview-stage-id="stage.tooling-foundations"]'),
  ).toContainText("可学习");
  await expect(
    overview.locator('[data-overview-stage-id="stage.vision-math-immediate"]'),
  ).toContainText("已规划 · 尚未展开");

  const stage = page.locator('[data-stage-id="stage.tooling-foundations"]');
  await expect(stage.locator("[data-concept-id]")).toHaveCount(8);
  await expect(stage.getByRole("link", { name: /Pixel Lab/ })).toBeVisible();
  await expect(stage.getByRole("heading", { name: "Stage 出口标准" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
