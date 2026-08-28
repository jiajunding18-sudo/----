import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

test("360px 下可筛选 Project 并浏览未 ready 的 Pixel Lab", async ({ page }) => {
  await page.goto("/projects/");
  await expect(page.locator("[data-project-id]")).toHaveCount(13);
  await page.getByLabel("Status").selectOption("published");
  await expect(page.locator("[data-project-id]")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "查看正式项目内容" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Pixel Lab/ })).toBeVisible();
  await expect(page.getByText(/仍缺 7 项 hard requirement/)).toBeVisible();
  await expect(page.locator("[data-project-requirement]")).toHaveCount(8);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
