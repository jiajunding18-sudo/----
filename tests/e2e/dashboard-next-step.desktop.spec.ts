import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { seedAllPublishedConceptsMastered } from "./helpers/learning-state";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("新用户看到唯一的 Stage 0 Project gap NextStep 及正式完成信息", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/");

  const nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveCount(1);
  await expect(nextStep).toHaveAttribute(
    "data-next-step-target-id",
    "tooling.computer-files",
  );
  await expect(nextStep).toHaveAttribute(
    "data-next-step-reason-code",
    "project-gap",
  );
  await expect(nextStep.getByRole("heading", { level: 3 })).toHaveText(
    "计算机、文件与终端",
  );
  await expect(nextStep).toContainText("Computer, Files, and Terminal");
  await expect(nextStep).toContainText("Stage 0：计算机与编程基础");
  await expect(nextStep.locator('[data-concept-status="not_started"]')).toHaveText(
    "未开始",
  );
  await expect(nextStep.locator("[data-next-step-reason]")).toHaveText(
    "「Pixel Lab：可复现的第一次图像读写实验」需要「计算机、文件与终端」达到已理解，这是当前项目尚缺少的能力。",
  );
  await expect(nextStep.locator("[data-next-step-estimated-time]")).toHaveText(
    "3–4 小时",
  );
  await expect(
    nextStep.locator("[data-next-step-completion-criteria]"),
  ).toContainText("能从两个不同工作目录定位同一文件");
  await expect(nextStep.locator("[data-next-step-related-project]")).toContainText(
    "Pixel Lab：可复现的第一次图像读写实验",
  );
  const action = nextStep.getByRole("link", { name: "开始学习" });
  await expect(action).toHaveCount(1);
  await expect(action).toHaveAttribute(
    "href",
    "/knowledge/computer-files-and-terminal/",
  );

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("learning Concept 优先继续，刷新后保持且 recommended 前置只提示", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  await page
    .locator("[data-concept-progress]")
    .getByRole("button", { name: "开始学习" })
    .click();

  await page.goto("/");
  let nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-target-id",
    "tooling.python-core",
  );
  await expect(nextStep).toHaveAttribute(
    "data-next-step-reason-code",
    "continue-learning",
  );
  await expect(nextStep.locator("[data-next-step-reason]")).toContainText(
    "你已经开始学习「Python 核心语法」",
  );
  await expect(
    nextStep.locator("[data-next-step-recommended-prerequisites]"),
  ).toContainText("建议同时了解（不阻止开始）");
  await expect(
    nextStep.locator("[data-next-step-recommended-prerequisites]"),
  ).toContainText("计算机、文件与终端");
  await expect(nextStep.getByRole("link", { name: "继续学习" })).toHaveAttribute(
    "href",
    "/knowledge/python-core/",
  );

  await page.reload();
  nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-target-id",
    "tooling.python-core",
  );
  await expect(nextStep.getByRole("link", { name: "继续学习" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("learning 目标缺 hard 前置时只推荐可执行前置", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-modules-files-exceptions/");
  await page
    .locator("[data-concept-progress]")
    .getByRole("button", { name: "开始学习" })
    .click();

  await page.goto("/");
  const nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-target-id",
    "tooling.python-core",
  );
  await expect(nextStep).toHaveAttribute(
    "data-next-step-reason-code",
    "hard-prerequisite",
  );
  await expect(nextStep.locator("[data-next-step-reason]")).toContainText(
    "Python 函数、模块、文件与异常",
  );
  await expect(nextStep.getByRole("heading", { level: 3 })).toHaveText(
    "Python 核心语法",
  );
  await expect(nextStep.getByRole("link", { name: "开始学习" })).toHaveAttribute(
    "href",
    "/knowledge/python-core/",
  );
  expect(browserErrors).toEqual([]);
});

test("Concept 状态变化后 Dashboard 重新派生并可进入新目标", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/computer-files-and-terminal/");
  const progress = page.locator("[data-concept-progress]");
  await progress.getByRole("button", { name: "开始学习" }).click();

  await page.goto("/");
  let nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-reason-code",
    "continue-learning",
  );
  await expect(nextStep.getByRole("link", { name: "继续学习" })).toBeVisible();

  await nextStep.getByRole("link", { name: "继续学习" }).click();
  await expect(page).toHaveURL(/\/knowledge\/computer-files-and-terminal\/$/);
  await progress.getByRole("button", { name: "确认已理解" }).click();

  await page.goto("/");
  nextStep = page.locator('[data-dashboard-next-step="recommendation"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-target-id",
    "tooling.dev-environment",
  );
  await expect(nextStep).toHaveAttribute(
    "data-next-step-reason-code",
    "project-gap",
  );
  await expect(nextStep.getByRole("link", { name: "开始学习" })).toHaveAttribute(
    "href",
    "/knowledge/development-environment/",
  );
  expect(browserErrors).toEqual([]);
});

test("全部 published Concept 完成后显示诚实 empty state", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await seedAllPublishedConceptsMastered(page);
  await page.goto("/");

  const nextStep = page.locator('[data-dashboard-next-step="empty"]');
  await expect(nextStep).toHaveAttribute(
    "data-next-step-reason-code",
    "published-route-complete",
  );
  await expect(nextStep).toContainText(
    "当前已发布内容已全部完成，后续路线尚未正式展开。",
  );
  await expect(nextStep.locator("[data-next-step-target-id]")).toHaveCount(0);
  await expect(nextStep.getByRole("link", { name: "浏览 Roadmap" })).toBeVisible();
  await expect(nextStep.getByRole("link", { name: "浏览 Knowledge" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("静态 HTML 在 hydration 前只提供中性初始化状态", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();

  expect(html).toContain('data-dashboard-next-step="loading"');
  expect(html).toContain("正在恢复浏览器本地学习状态");
  expect(html).not.toContain('data-dashboard-next-step="recommendation"');
});
