import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

export function enhancementTests() {
  test("enhancement: controlled comparison, reading, deep links and accessibility", async ({ page }, info) => {
    await page.goto("/knowledge/dip-enhancement/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    for (const text of ["Mastery Evidence", "Practice", "Active Recall", "不是成功去噪", "target", "同一", "端点比例", "显示变化不等于数据增强"])
      await expect(article).toContainText(text);
    await expect(article.locator("pre")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    await expect(article.locator("table")).toContainText("0.11558");
    await expect(article.locator(".katex").first()).toBeVisible();
    await expect(article.locator(".katex-error")).toHaveCount(0);
    const mobile = page.viewportSize()!.width < 768;
    const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
    if (mobile) await toc.locator("summary").click();
    const link = toc.getByRole("link", { name: /Checkpoint 3/ });
    await link.focus();
    await page.keyboard.press("Enter");
    const heading = article.getByRole("heading", { name: /Checkpoint 3/ });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    const anchor = await heading.getAttribute("id");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(anchor);
    await page.goto("/knowledge/");
    await page.goto(`/knowledge/dip-enhancement/#${encodeURIComponent(anchor!)}`);
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    const code = article.locator("pre").first();
    await code.focus();
    await expect(code).toBeFocused();
    if (mobile) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => code.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    const resource = page.locator('a[href="/resources/opencv-histogram-enhancement/"]').first();
    await resource.focus();
    await expect(resource).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(resource).not.toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await article.locator("table").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("enhancement.png") });
  });

  test("enhancement: navigation, partial release and isolated resource", async ({ page }) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=CLAHE", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-enhancement"]').first()).toBeAttached();
    }
    await page.goto("/resources/opencv-histogram-enhancement/");
    await expect(page.getByRole("main")).toContainText("equalizeHist");
    await expect(page.getByRole("main")).toContainText("跳过");
    await expect(page.locator('a[href="https://docs.opencv.org/4.13.0/d6/dc7/group__imgproc__hist.html"]')).toBeVisible();
  });
}
