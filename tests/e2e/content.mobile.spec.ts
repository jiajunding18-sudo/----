import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("360px 下可浏览 Concept 与 Pixel Lab 正文", async ({ page }) => {
  await page.goto("/knowledge/");
  await expect(page.getByRole("link", { name: "计算机、文件与终端" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "计算机、文件与终端" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /计算机、文件与终端/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Practice/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/projects/pixel-lab/");
  await expect(page.getByRole("heading", { level: 1, name: /Pixel Lab/ })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
