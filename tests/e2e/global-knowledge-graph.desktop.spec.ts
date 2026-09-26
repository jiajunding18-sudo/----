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

test("全局图按正式 Stage、Track 与 dependency kind 浏览，并保留完整关系", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/roadmap/");

  const roadmapGraphLink = page.getByRole("link", {
    name: "用 Knowledge Graph 查看路线关系",
  });
  await roadmapGraphLink.focus();
  await expect(roadmapGraphLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/roadmap\/graph\/$/);

  const graph = page.locator("[data-global-knowledge-graph]");
  const equivalentList = page.locator("[data-global-graph-equivalent-list]");
  const nodeItems = equivalentList.locator("[data-global-graph-node-id]");
  const edgeItems = equivalentList.locator("[data-global-graph-edge-id]");
  await expect(graph).toHaveAttribute("data-global-scope-kind", "stage");
  await expect(graph).toHaveAttribute("data-density-status", "ready");
  await expect(page.getByRole("heading", { name: "Stage 0：计算机与编程基础" })).toBeVisible();
  await expect(nodeItems).toHaveCount(8);
  await expect(edgeItems).toHaveCount(12);
  expect(
    new Set(
      await nodeItems.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-global-graph-node-id")),
      ),
    ).size,
  ).toBe(8);

  const filters = page.getByRole("form", {
    name: "全局 Knowledge Graph 筛选",
  });
  const recommended = filters.getByLabel("recommended · 虚线");
  await recommended.uncheck();
  await expect(edgeItems).toHaveCount(7);
  expect(
    await edgeItems.evaluateAll((items) =>
      items.every(
        (item) => item.getAttribute("data-dependency-kind") === "hard",
      ),
    ),
  ).toBe(true);
  await expect(graph).toContainText("正式数据未被修改");
  await recommended.check();
  await expect(edgeItems).toHaveCount(12);

  await filters.locator('[data-global-scope="track"]').click();
  await filters
    .getByLabel("Track")
    .selectOption("track.industrial-3d");
  await expect(nodeItems).toHaveCount(0);
  await expect(graph).toContainText("不会用占位节点伪造路线覆盖");
  await filters.getByLabel("Track").selectOption("track.common");
  await expect(nodeItems).toHaveCount(41);

  await filters.locator('[data-global-scope="published"]').click();
  await expect(nodeItems).toHaveCount(41);
  await filters.locator('[data-global-scope="stage"]').click();
  await filters
    .getByLabel("Stage")
    .selectOption("stage.vision-math-immediate");
  await expect(nodeItems).toHaveCount(4);
  await expect(
    nodeItems.filter({ hasText: "向量、矩阵与基本运算" }),
  ).toHaveCount(1);
  await filters
    .getByLabel("Stage")
    .selectOption("stage.vision-math-geometry-optimization");
  await expect(nodeItems).toHaveCount(5);
  await expect(edgeItems).toHaveCount(4);
  await expect(
    nodeItems.filter({ hasText: "最小二乘、残差与超定方程" }),
  ).toHaveCount(1);
  await filters.getByLabel("Stage").selectOption("stage.image-computing");
  await expect(nodeItems).toHaveCount(12);
  await expect(nodeItems.filter({ hasText: "局部特征预览" })).toHaveCount(1);
  await expect(edgeItems).toHaveCount(16);
  await expect(
    nodeItems.filter({ hasText: "NumPy 数组、轴、切片与广播" }),
  ).toHaveCount(1);
  await expect(
    nodeItems.filter({ hasText: "图像读写与色彩空间" }),
  ).toHaveCount(1);
  await expect(
    nodeItems.filter({ hasText: "感兴趣区域与掩膜" }),
  ).toHaveCount(1);
  await expect(
    nodeItems.filter({ hasText: "平滑、锐化与基础滤波" }),
  ).toHaveCount(1);
  await expect(
    nodeItems.filter({ hasText: "阈值与形态学" }),
  ).toHaveCount(1);
  await expect(
    nodeItems.filter({ hasText: "边缘、轮廓与区域测量" }),
  ).toHaveCount(1);
  await expect(
    nodeItems.filter({ hasText: "批处理、配置、结果保存与日志" }),
  ).toHaveCount(1);

  await filters.getByRole("button", { name: "恢复默认 Stage scope" }).click();
  await expect(nodeItems).toHaveCount(8);
  const listEdgeIds = (
    await edgeItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-global-graph-edge-id") ?? ""),
    )
  ).toSorted();
  const expandButton = page.getByRole("button", {
    name: "展开当前 scope 图",
  });
  await expandButton.focus();
  await page.keyboard.press("Enter");
  const canvas = page.locator(
    '[data-knowledge-graph-canvas][data-knowledge-graph-mode="global"]',
  );
  await expect(canvas).toBeVisible();
  await expect(canvas.locator("[data-graph-concept-id]")).toHaveCount(8);
  const canvasEdgeIds = ((await canvas.getAttribute("data-graph-edge-ids")) ?? "")
    .split("|")
    .filter(Boolean)
    .toSorted();
  expect(canvasEdgeIds).toEqual(listEdgeIds);

  await canvas.getByRole("link", { name: "调试与问题定位" }).click();
  await expect(page).toHaveURL(/\/knowledge\/debugging-and-problem-localization\/$/);
  const localGraphLink = page.getByRole("link", {
    name: "查看当前知识关系",
  });
  await localGraphLink.click();
  await expect(page).toHaveURL(/#concept-knowledge-graph-title$/);
  await expect(page.locator("#concept-knowledge-graph-title")).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Progress 筛选与当前学习位置从统一 store 映射到图和列表", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/debugging-and-problem-localization/");
  await page.getByRole("button", { name: "开始学习" }).click();

  await page.goto("/knowledge/");
  await page.getByRole("link", { name: "打开全局 Knowledge Graph" }).click();
  const graph = page.locator("[data-global-knowledge-graph]");
  const learningFilter = graph.locator('[data-global-status="learning"]');
  await expect(learningFilter).toBeEnabled();
  await learningFilter.click();

  const nodes = graph.locator("[data-global-graph-node-id]");
  await expect(nodes).toHaveCount(1);
  await expect(nodes.first()).toHaveAttribute(
    "data-global-graph-node-id",
    "tooling.debugging",
  );
  await expect(nodes.first()).toContainText("学习中");
  await expect(graph.locator("[data-global-graph-edge-id]")).toHaveCount(0);

  await graph.getByRole("button", { name: "展开当前 scope 图" }).click();
  const canvasNode = graph.locator(
    '[data-graph-concept-id="tooling.debugging"]',
  );
  await expect(canvasNode).toHaveAttribute("data-graph-learning-focus", "true");
  await expect(canvasNode).toHaveAttribute("data-graph-progress-status", "learning");
  const locateButton = graph.getByRole("button", {
    name: "定位当前学习位置：调试与问题定位",
  });
  await expect(locateButton).toBeEnabled();
  await locateButton.click();

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
