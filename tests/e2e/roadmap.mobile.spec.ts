import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("360px 下 Roadmap 无横向溢出且阶段内容可访问", async ({ page }) => {
  await page.goto("/roadmap/");

  const overview = page.locator("[data-roadmap-overview]");
  const focusedStageList = overview.locator("[data-focused-stage-list]");
  await expect(overview.locator("[data-track-focus]")).toHaveCount(4);
  await expect(
    focusedStageList.locator(":scope > [data-overview-stage-id]"),
  ).toHaveCount(17);
  await expect(
    overview.locator('[data-overview-stage-id="stage.tooling-foundations"]'),
  ).toContainText("可学习");
  await expect(
    overview.locator('[data-overview-stage-id="stage.vision-math-immediate"]'),
  ).toContainText("可学习");
  await expect(
    overview.locator('[data-overview-stage-id="stage.image-computing"]'),
  ).toContainText("可学习");

  await overview
    .getByRole("button", { name: "3D 工业视觉高级分支" })
    .click();
  await expect(
    focusedStageList.locator(":scope > [data-overview-stage-id]"),
  ).toHaveCount(2);
  const industrial3d = focusedStageList.locator(
    '[data-overview-stage-id="stage.industrial-3d"]',
  );
  await industrial3d.locator("summary").focus();
  await expect(industrial3d.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(industrial3d).toHaveAttribute("open", "");
  await expect(industrial3d).toContainText("以下条件都需要满足");

  await overview.getByRole("button", { name: "全部路线" }).click();
  await expect(
    focusedStageList.locator(":scope > [data-overview-stage-id]"),
  ).toHaveCount(17);

  const stage = page.locator('[data-stage-id="stage.tooling-foundations"]');
  await expect(stage.locator("[data-concept-id]")).toHaveCount(8);
  await expect(stage.getByRole("link", { name: /Pixel Lab/ })).toBeVisible();
  await expect(stage.getByRole("heading", { name: "Stage 出口标准" })).toBeVisible();
  const stageTwo = page.locator('[data-stage-id="stage.image-computing"]');
  await stageTwo.locator("summary").click();
  await expect(stageTwo.locator("[data-concept-id]")).toHaveCount(12);
  await expect(
    stageTwo.locator('[data-concept-id="pipeline.batch-images"]'),
  ).toBeVisible();
  await stageTwo.locator("summary").click();
  await expect(stageTwo.locator("details")).not.toHaveAttribute("open", "");
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
