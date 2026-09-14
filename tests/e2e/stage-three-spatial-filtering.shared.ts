import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

export function spatialFilteringTests() {
  test("spatial filtering: reading, TOC, refresh, keyboard and accessibility", async ({ page }, info) => {
    await page.goto("/knowledge/dip-spatial-filtering/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    for (const text of ["Mastery Evidence", "Practice", "Active Recall", "sigmaColor", "不是卷积", "MSE", "line contrast"])
      await expect(article).toContainText(text);
    await expect(article.locator("pre")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    const mobile = page.viewportSize()!.width < 768;
    const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
    if (mobile) await toc.locator("summary").click();
    const link = toc.getByRole("link", { name: /Checkpoint 2/ });
    await link.focus();
    await page.keyboard.press("Enter");
    const heading = article.getByRole("heading", { name: /Checkpoint 2/ });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    const anchor = await heading.getAttribute("id");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(anchor);
    await page.goto("/knowledge/");
    await page.goto(`/knowledge/dip-spatial-filtering/#${encodeURIComponent(anchor!)}`);
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    const code = article.locator("pre").first();
    await code.focus();
    await expect(code).toBeFocused();
    if (mobile) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => code.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    const resource = page.locator('a[href="/resources/opencv-spatial-filtering/"]').first();
    await resource.focus();
    await expect(resource).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(resource).not.toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await heading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("spatial-filtering.png") });
  });

  test("spatial filtering: formal navigation, partial release and resource", async ({ page }) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=Spatial%20Filtering", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-spatial-filtering"]').first()).toBeAttached();
      await expect(page.locator('a[href="/knowledge/dip-enhancement/"]')).toHaveCount(0);
    }
    await page.goto("/resources/opencv-spatial-filtering/");
    await expect(page.getByRole("main")).toContainText("Median Blurring");
    await expect(page.getByRole("main")).toContainText("跳过");
    await expect(page.locator('a[href="https://docs.opencv.org/4.13.0/d4/d13/tutorial_py_filtering.html"]')).toBeVisible();
  });
}
