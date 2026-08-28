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

test("Concept 状态保存到 LocalStorage，并在刷新与 Dashboard 中恢复", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  const progress = page.locator("[data-concept-progress]");
  await expect(progress).toContainText("当前：未学习");

  await progress.getByRole("button", { name: "开始学习" }).click();
  await expect(progress).toContainText("当前：学习中");
  await expect(progress.locator("[data-progress-action-message]")).toContainText(
    "已记录为学习中",
  );

  await page.reload();
  await expect(progress).toContainText("当前：学习中");
  await progress.getByRole("button", { name: "确认已理解" }).click();
  await expect(progress).toContainText("当前：已理解");

  await page.reload();
  await expect(progress).toContainText("当前：已理解");
  await page.goto("/");
  const summary = page.locator("[data-stage-progress]");
  await expect(summary.getByText("1 / 8")).toHaveCount(2);
  await expect(summary.getByText("0 / 8")).toHaveCount(1);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
