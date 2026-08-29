import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const destinations = [
  { href: "/", label: "Dashboard", navigation: "主导航" },
  { href: "/roadmap/", label: "Roadmap", navigation: "主导航" },
  { href: "/knowledge/", label: "Knowledge", navigation: "主导航" },
  { href: "/projects/", label: "Projects", navigation: "主导航" },
  { href: "/study-log/", label: "Study Log", navigation: "主导航" },
  { href: "/search/", label: "Search", navigation: "top" },
  { href: "/resources/", label: "Resources", navigation: "辅助导航" },
  { href: "/settings/data/", label: "Settings / Data", navigation: "辅助导航" },
] as const;

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

test("桌面 App Shell 提供完整且可访问的导航", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("desktop-sidebar")).toBeVisible();
  await expect(page.getByRole("button", { name: "打开导航" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("link")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Search / 搜索" })).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  for (const destination of destinations) {
    const link =
      destination.navigation === "top"
        ? page.getByRole("link", { name: "Search / 搜索" })
        : page
            .getByRole("navigation", { name: destination.navigation })
            .getByRole("link", { name: new RegExp(destination.label) });

    await link.click();
    await expect
      .poll(() => normalizedPathname(page.url()))
      .toBe(normalizedPathname(`http://localhost${destination.href}`));
    await expect(
      page.getByRole("heading", { level: 1, name: destination.label }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    if (destination.navigation !== "top") {
      await expect(link).toHaveAttribute("aria-current", "page");
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);
  }

  expect(browserErrors).toEqual([]);
});
