import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
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

test("真实 Stage 0 内容可从 Knowledge、Roadmap 与 Projects 浏览", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/knowledge/");
  await expect(page.getByRole("heading", { level: 1, name: "Knowledge" })).toBeVisible();
  const knowledgeList = page.getByRole("main").locator("ol");
  await expect(knowledgeList.locator("[data-knowledge-concept-id] h2 a")).toHaveCount(12);
  await expect(page.getByText("Computer, Files, and Terminal")).toBeVisible();

  const firstConcept = page
    .locator('[data-knowledge-concept-id="tooling.computer-files"] h2')
    .getByRole("link", { name: "计算机、文件与终端" });
  await firstConcept.focus();
  await expect(firstConcept).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "计算机、文件与终端（Computer, Files, and Terminal）",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Worked Example/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Mastery Evidence/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "关联的已验证资源" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/roadmap/");
  await expect(
    page
      .locator('[data-overview-stage-id="stage.tooling-foundations"]')
      .getByRole("heading", { name: "Stage 0：计算机与编程基础" }),
  ).toBeVisible();
  await page
    .locator('[data-concept-id="tooling.python-core"]')
    .getByRole("link", { name: "Python 核心语法" })
    .click();
  await expect(page).toHaveURL(/\/knowledge\/python-core\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /Python 核心语法/ })).toBeVisible();

  await page.goto("/projects/");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  const pixelLabProject = page.locator('[data-project-id="project.pixel-lab"]');
  await expect(pixelLabProject).toContainText("8 项正式 requirement");
  await expect(pixelLabProject).toContainText("仍缺 7 项 hard 要求");
  await pixelLabProject.getByRole("link", { name: /Pixel Lab/ }).click();
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /Pixel Lab/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage 0 出口演练" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("不存在的内容返回可恢复的 404 页面", async ({ page }) => {
  const response = await page.goto("/knowledge/not-a-real-concept/");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "内容不存在" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Knowledge" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
