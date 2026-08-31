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
