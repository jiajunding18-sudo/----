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

test("Concept 一跳图与等价列表共享正式 DAG，展示状态并可导航", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/debugging-and-problem-localization/");

  const navigation = page.locator("[data-concept-navigation]");
  const listEdgeIds = (
    await navigation.locator("[data-graph-edge-id]").evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-graph-edge-id") ?? ""),
    )
  ).toSorted();
  expect(listEdgeIds).toEqual([
    "tooling.debugging->pipeline.batch-images:recommended",
    "tooling.debugging->python.numpy-arrays:recommended",
    "tooling.debugging->tooling.reproducibility:recommended",
    "tooling.dev-environment->tooling.debugging:recommended",
    "tooling.python-core->tooling.debugging:hard",
  ]);
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.python-core"][data-dependency-kind="hard"]',
    ),
  ).toContainText("hard · 必须前置");
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.dev-environment"][data-dependency-kind="recommended"]',
    ),
  ).toContainText("recommended · 建议前置");
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.reproducibility"][data-dependency-kind="recommended"]',
    ),
  ).toContainText("本知识是其 recommended 参考");

  await page.getByRole("button", { name: "开始学习" }).click();
  const disclosure = page
    .locator("[data-knowledge-graph-disclosure]")
    .getByRole("button");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");

  const canvas = page.locator("[data-knowledge-graph-canvas]");
  await expect(canvas).toBeVisible();
  const graphEdgeIds = ((await canvas.getAttribute("data-graph-edge-ids")) ?? "")
    .split("|")
    .filter(Boolean)
    .toSorted();
  expect(graphEdgeIds).toEqual(listEdgeIds);
  await expect(canvas.locator("[data-graph-concept-id]")).toHaveCount(6);
  await expect(
    canvas.locator('[data-graph-concept-id="tooling.debugging"]'),
  ).toHaveAttribute("data-graph-current", "true");
  await expect(
    canvas.locator('[data-graph-concept-id="tooling.debugging"]'),
  ).toHaveAttribute("data-graph-progress-status", "learning");
  await expect(canvas.getByText("当前 Concept", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow__edge-text")).toHaveText([
    "recommended",
    "recommended",
    "recommended",
    "recommended",
    "hard",
  ]);

  const pythonCoreLink = canvas.getByRole("link", { name: "Python 核心语法" });
  await pythonCoreLink.focus();
  await expect(pythonCoreLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/python-core\/$/);

  await page.goto(
    "/knowledge/debugging-and-problem-localization/#section-9-active-recall-%E4%B8%BB%E5%8A%A8%E5%9B%9E%E5%BF%86",
  );
  await expect(page.locator("#section-9-active-recall-主动回忆")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
