import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import katex from "katex";

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
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function renderTechnicalFixture(page: Page) {
  await page.goto("/knowledge/python-core/");
  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLLinkElement).href),
  );
  const inlineMath = katex.renderToString("I(x, y) = R(x, y) + G(x, y)", {
    throwOnError: true,
  });
  const displayMath = katex.renderToString(
    String.raw`\mathbf{p}' = \mathbf{K}[\mathbf{R}\mid\mathbf{t}]\mathbf{P}`,
    { displayMode: true, throwOnError: true },
  );
  await page.setContent(
    `<!doctype html><html lang="zh-CN"><head><title>技术元素测试 fixture</title>${stylesheets
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join("")}</head><body><main><div class="learning-document">
        <h1>技术元素测试 fixture</h1>
        <p>行内公式 ${inlineMath} 应与中文基线协调。</p>
        ${displayMath}
        <div class="table-scroll-container" role="group" aria-label="可横向滚动的数据表" tabindex="0">
          <table><thead><tr><th>输入条件</th><th>预期结果</th><th>验证方式</th><th>误差说明</th></tr></thead>
          <tbody><tr><td>标准曝光</td><td>灰度稳定</td><td>重复测量三次</td><td>报告均值与极差</td></tr></tbody></table>
        </div>
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='300'/%3E" alt="普通 Markdown 图片" width="1200" height="300">
        <figure><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'/%3E" alt="相机坐标投影示意图" width="640" height="360"><figcaption>图 1：测试 fixture 的图注。</figcaption></figure>
      </div></main></body></html>`,
  );
}

test("Concept 技术正文提供高亮代码、复制反馈与学习环节层级", async ({
  context,
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
  await page.goto("/knowledge/python-core/");

  const document = page.locator(".learning-document");
  await expect(document.locator(":not(pre) > code").first()).toBeVisible();
  const pythonBlock = document.locator('[data-code-language="python"]');
  await expect(pythonBlock).toBeVisible();
  await expect(pythonBlock.locator(".code-language-label")).toHaveText("Python");
  await expect(pythonBlock.locator(".hljs-keyword").first()).toBeVisible();

  const copyButton = pythonBlock.getByRole("button", { name: "复制代码" });
  await copyButton.focus();
  await expect(copyButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(pythonBlock.getByRole("button", { name: "已复制" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("def summarize(items, dark_threshold):");

  await expect(
    document.locator('[data-learning-section="example"]'),
  ).toContainText("Worked Example");
  await expect(
    document.locator('[data-learning-section="recall"]'),
  ).toContainText("Active Recall");
  await expect(
    document.locator('[data-learning-section="practice"]'),
  ).toContainText("Practice");
  await expect(
    document.locator('[data-learning-section="evidence"]'),
  ).toContainText("Mastery Evidence");

  const resourceLink = page.getByRole("link", { name: /The Python Tutorial/ });
  await expect(resourceLink).toHaveAttribute(
    "href",
    "/resources/python-tutorial/",
  );
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Stage 1A 数学正文渲染公式、正式资源与 planned Project 映射", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/vectors-and-matrices/");

  const document = page.locator(".learning-document");
  await expect(document.locator(".katex-display").first()).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /为什么现在学/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", {
      level: 3,
      name: /在机器视觉中会在哪里使用/u,
    }),
  ).toBeVisible();
  await expect(document.getByText("当前不要求", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "18.06SC Linear Algebra" }),
  ).toHaveAttribute("href", "/resources/mit-ocw-linear-algebra/");

  const projectUsage = page.locator(
    '[data-concept-project-id="project.math-vision-lab"]',
  );
  await expect(projectUsage).toContainText("hard · 需要已理解");
  await expect(projectUsage).toContainText("planned · 项目正文尚未发布");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("真实 GFM 表格保留语义并由独立容器承载", async ({ page }) => {
  await page.goto("/knowledge/linux-command-line-basics/");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const scrollContainer = table.locator("xpath=..");
  await expect(scrollContainer).toHaveClass(/table-scroll-container/);
  await scrollContainer.focus();
  await expect(scrollContainer).toBeFocused();
  await expect(page.getByRole("columnheader")).toHaveCount(4);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("最小 fixture 在 360px 浏览器中正确呈现公式、表格与带图注图片", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await renderTechnicalFixture(page);

  await expect(page.locator("p .katex").first()).toBeVisible();
  const displayMath = page.locator(".katex-display");
  await expect(displayMath).toBeVisible();
  expect(await displayMath.evaluate((element) => getComputedStyle(element).overflowX)).toBe(
    "auto",
  );
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByAltText("普通 Markdown 图片")).toBeVisible();
  await expect(page.getByAltText("相机坐标投影示意图")).toBeVisible();
  await expect(page.getByText("图 1：测试 fixture 的图注。")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
