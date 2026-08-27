import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function normalizedPathname(url: string) {
  const pathname = new URL(url).pathname.replace(/\/$/, "");
  return pathname || "/";
}

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

test("移动端抽屉支持键盘、焦点恢复与页面导航", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  const response = await page.goto("/");
  const menuButton = page.getByRole("button", { name: "打开导航" });
  const dialog = page.getByRole("dialog", { name: "Learning OS" });

  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("desktop-sidebar")).toBeHidden();
  await expect(menuButton).toBeVisible();
  await expect(page.getByRole("link", { name: "Search / 搜索" })).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await menuButton.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭导航" })).toBeFocused();

  const openDialogAccessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(openDialogAccessibilityScan.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await page
    .getByRole("navigation", { name: "移动端主导航" })
    .getByRole("link", { name: /Roadmap/ })
    .click();
  await expect
    .poll(() => normalizedPathname(page.url()))
    .toBe("/roadmap");
  await expect(page.getByRole("heading", { level: 1, name: "Roadmap" })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await page
    .getByRole("navigation", { name: "移动端辅助导航" })
    .getByRole("link", { name: /Settings \/ Data/ })
    .click();
  await expect
    .poll(() => normalizedPathname(page.url()))
    .toBe("/settings/data");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings / Data" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Search / 搜索" }).click();
  await expect
    .poll(() => normalizedPathname(page.url()))
    .toBe("/search");
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const pageAccessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(pageAccessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
