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

test("360px 下可搜索多类型内容、清除查询并通过 axe", async ({ page }) => {
  await page.goto("/search/");
  const input = page.getByRole("searchbox", { name: "搜索词" });
  await input.fill("Python");
  await page.getByRole("button", { name: "搜索", exact: true }).click();

  await expect(page.locator('[data-search-group="knowledge"]')).toBeVisible();
  await expect(page.locator('[data-search-group="projects"]')).toBeVisible();
  await expect(page.locator('[data-search-group="resources"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "清除搜索" }).click();
  await expect(page).toHaveURL(/\/search\/$/);
  await expect(page.locator('[data-search-empty="initial"]')).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "搜索词" })).toHaveValue("");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
