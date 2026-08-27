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

test("360px 下 Knowledge 筛选、诚实空状态与 Concept 关系均可读", async ({
  page,
}) => {
  await page.goto("/knowledge/");
  await expect(page.locator("[data-knowledge-concept-id]")).toHaveCount(8);
  await expectNoHorizontalOverflow(page);

  await page
    .getByLabel("按 Track 浏览")
    .selectOption("track.computational-imaging");
  await expect(page.locator("[data-knowledge-empty-state]")).toContainText(
    "目前没有已发布 Concept",
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "返回全部知识" }).click();
  await page
    .locator('[data-knowledge-concept-id="tooling.python-core"] h2')
    .getByRole("link", { name: "Python 核心语法" })
    .click();
  await expect(page.locator("[data-concept-navigation]")).toBeVisible();
  await expect(
    page.locator(
      '[data-related-concept-id="tooling.python-modules"][data-dependency-kind="hard"]',
    ),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
