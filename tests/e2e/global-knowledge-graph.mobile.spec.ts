import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

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

test("360px 优先展示等价列表，筛选和按需画布可由键盘操作", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/");
  const entry = page.getByRole("link", { name: "打开全局 Knowledge Graph" });
  await entry.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/roadmap\/graph\/$/);

  const graph = page.locator("[data-global-knowledge-graph]");
  const nodes = graph.locator("[data-global-graph-node-id]");
  const edges = graph.locator("[data-global-graph-edge-id]");
  await expect(nodes).toHaveCount(8);
  await expect(edges).toHaveCount(12);
  await expect(graph.locator("[data-knowledge-graph-canvas]")).toHaveCount(0);

  const recommended = graph.getByLabel("recommended · 虚线");
  await recommended.focus();
  await expect(recommended).toBeFocused();
  await page.keyboard.press("Space");
  await expect(edges).toHaveCount(7);

  const expandButton = graph.getByRole("button", {
    name: "展开当前 scope 图",
  });
  await expandButton.focus();
  await page.keyboard.press("Enter");
  await expect(graph.locator("[data-knowledge-graph-canvas]")).toBeVisible();
  await expect(
    graph.locator("[data-knowledge-graph-canvas] [data-graph-concept-id]"),
  ).toHaveCount(8);

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
