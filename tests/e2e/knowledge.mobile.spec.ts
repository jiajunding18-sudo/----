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

test("360px 下折叠目录支持键盘、Escape 与章节定位", async ({ page }) => {
  await page.goto("/knowledge/reproducible-learning-projects/");

  const mobileToc = page.locator('[data-concept-toc="mobile"]');
  const desktopToc = page.locator('[data-concept-toc="desktop"]');
  await expect(mobileToc).toBeVisible();
  await expect(desktopToc).toBeHidden();

  const summary = mobileToc.getByText("本页目录", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(mobileToc).toHaveAttribute("open", "");
  await expect(mobileToc.getByRole("link")).toHaveCount(20);

  await page.keyboard.press("Escape");
  await expect(mobileToc).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();

  await page.keyboard.press("Enter");
  const pythonHeadingLink = mobileToc.getByRole("link", {
    name: "Python：Pixel Lab",
  });
  await pythonHeadingLink.focus();
  await page.keyboard.press("Enter");
  await expect(mobileToc).not.toHaveAttribute("open", "");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-python-pixel-lab");
  await expect(page.locator("#section-python-pixel-lab")).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
