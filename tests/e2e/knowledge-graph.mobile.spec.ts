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

test("360px 优先提供等价列表，用户可用键盘按需展开邻域图", async ({
  page,
}) => {
  await page.goto("/knowledge/debugging-and-problem-localization/");

  const navigation = page.locator("[data-concept-navigation]");
  await expect(navigation.locator("[data-graph-edge-id]")).toHaveCount(3);
  const prerequisiteLink = navigation.getByRole("link", {
    name: "Python 核心语法",
  });
  await prerequisiteLink.focus();
  await expect(prerequisiteLink).toBeFocused();

  const disclosure = page.getByRole("button", { name: "展开 1 跳邻域图" });
  await expect(page.locator("[data-knowledge-graph-canvas]")).toHaveCount(0);
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.focus();
  await page.keyboard.press("Enter");

  const canvas = page.locator("[data-knowledge-graph-canvas]");
  await expect(canvas).toBeVisible();
  await expect(canvas.locator("[data-graph-concept-id]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "收起邻域图" })).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
