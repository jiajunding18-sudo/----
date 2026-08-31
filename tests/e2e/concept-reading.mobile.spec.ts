import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("360px 下代码独立滚动且不会撑宽 Concept 页面", async ({ page }) => {
  await page.goto("/knowledge/reproducible-learning-projects/");

  const document = page.locator(".learning-document");
  const codeBlocks = document.locator(".code-block");
  await expect(codeBlocks).toHaveCount(3);
  await expect(document.locator('[data-code-language="powershell"]')).toHaveCount(2);
  await expect(document.locator('[data-code-language="text"]')).toHaveCount(1);
  expect(
    await codeBlocks.locator("pre").evaluateAll((blocks) =>
      blocks.some((block) => block.scrollWidth > block.clientWidth),
    ),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("360px 下宽表格独立滚动，图片和长标识符保持在正文宽度内", async ({
  page,
}) => {
  await page.goto("/knowledge/linux-command-line-basics/");

  const tableContainer = page.locator(".table-scroll-container");
  await expect(tableContainer).toBeVisible();
  expect(
    await tableContainer.evaluate(
      (container) => container.scrollWidth > container.clientWidth,
    ),
  ).toBe(true);

  const document = page.locator(".learning-document");
  await document.evaluate((element) => {
    const figure = window.document.createElement("figure");
    const image = window.document.createElement("img");
    image.alt = "响应式测试图";
    image.width = 1200;
    image.height = 300;
    image.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='300'%3E%3Crect width='1200' height='300' fill='%23dce3de'/%3E%3C/svg%3E";
    const caption = window.document.createElement("figcaption");
    caption.textContent = "移动端图注";
    figure.append(image, caption);
    element.append(figure);
  });
  const image = page.getByAltText("响应式测试图");
  await expect(image).toBeVisible();
  const imageWidth = await image.evaluate((element) => element.getBoundingClientRect().width);
  const documentWidth = await document.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(imageWidth).toBeLessThanOrEqual(documentWidth);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("360px 下 Stage 2 图像数据契约的代码、表格与 TOC 不撑宽页面", async ({
  page,
}) => {
  await page.goto("/knowledge/digital-image-representation/");

  const document = page.locator(".learning-document");
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(3);
  await expect(document.getByRole("table")).toBeVisible();
  await expect(page.locator('[data-concept-toc="mobile"]')).toBeVisible();
  await expect(document).toContainText("image[row, column]");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("360px 下 OpenCV I/O 的长代码、表格、TOC 与键盘链接保持可访问", async ({
  page,
}) => {
  await page.goto("/knowledge/opencv-io-color/");

  const document = page.locator(".learning-document");
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(8);
  await expect(document.getByRole("table")).toBeVisible();
  await expect(page.locator('[data-concept-toc="mobile"]')).toBeVisible();
  await expect(document).toContainText("cv2.COLOR_BGR2RGB");
  await expect(document).toContainText("actual range");
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 1/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 2/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 3/u }),
  ).toBeVisible();

  const resourceLink = page.getByRole("link", {
    name: "OpenCV-Python Tutorials",
    exact: true,
  });
  await resourceLink.focus();
  await expect(resourceLink).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("360px 下 ROI/Mask 的代码、表格、TOC、深链接与键盘保持可访问", async ({
  page,
}) => {
  await page.goto("/knowledge/opencv-roi-masks/");

  const document = page.locator(".learning-document");
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(16);
  await expect(document.getByRole("table")).toHaveCount(2);
  await expect(document).toContainText("image[y1:y2, x1:x2]");
  await expect(document).toContainText("selected.shape == (N, C)");
  await expect(document).toContainText("selected_gray.shape == (true_count,)");
  await expect(document).toContainText(
    "input → expected → actual → reason → correction",
  );
  await expect(document).toContainText("mask shape mismatch");

  const mobileToc = page.locator('[data-concept-toc="mobile"]');
  await expect(mobileToc).toBeVisible();
  const summary = mobileToc.getByText("本页目录", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  const workedExampleLink = mobileToc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await workedExampleLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example");

  const resourceLink = page.getByRole("link", {
    name: "OpenCV-Python Tutorials",
    exact: true,
  });
  await resourceLink.focus();
  await expect(resourceLink).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("360px 下几何变换的公式、代码、表格、TOC 与键盘保持可访问", async ({
  page,
}) => {
  await page.goto("/knowledge/opencv-geometric-transforms/");

  const document = page.locator(".learning-document");
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(9);
  await expect(document.getByRole("table")).toHaveCount(2);
  await expect(document).toContainText("rotation_matrix.shape == (2, 3)");
  await expect(document).toContainText("same_canvas");
  await expect(document).toContainText("known-point");

  const mobileToc = page.locator('[data-concept-toc="mobile"]');
  await expect(mobileToc).toBeVisible();
  const summary = mobileToc.getByText("本页目录", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  const masteryLink = mobileToc.getByRole("link", {
    name: /12\. Mastery Evidence/u,
  });
  await masteryLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-12-mastery-evidence");

  const resourceLink = page.getByRole("link", {
    name: "OpenCV-Python Tutorials",
    exact: true,
  });
  await resourceLink.focus();
  await expect(resourceLink).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
