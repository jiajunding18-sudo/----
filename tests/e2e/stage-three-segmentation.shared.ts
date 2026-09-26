import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectViewportContained } from "./helpers/viewport";

export function segmentationTests() {
  for (const slug of ["dip-segmentation", "dip-enhancement", "dip-frequency-domain"]) {
    test(`resource viewport: ${slug}`, async ({ page }, info) => {
      await page.goto(`/knowledge/${slug}/`);
      await page.waitForLoadState("networkidle");
      const resource = page.locator("[data-resource-id]").first();
      await resource.scrollIntoViewIfNeeded();
      await expect(resource.getByText("建议学习范围", { exact: true })).toBeVisible();
      await expectViewportContained(page, info.project.name === "mobile-chromium" ? 360 : 1440);
      const link = resource.getByRole("link").first();
      await link.focus();
      await expect(link).toBeFocused();
      await expect(link).toBeInViewport();
      await page.screenshot({ path: info.outputPath("resource.png") });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/resources\//);
      await page.waitForLoadState("networkidle");
      await expectViewportContained(page, info.project.name === "mobile-chromium" ? 360 : 1440);
    });
  }
  test("segmentation: controlled comparison, reading, deep links and accessibility", async ({ page }, info) => {
    await page.goto("/knowledge/dip-segmentation/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    for (const text of ["Mastery Evidence", "Practice", "Active Recall", "冻结", "truth", "同一", "IoU", "前景"])
      await expect(article).toContainText(text);
    await expect(article.locator("pre")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    await expect(article.locator("table")).toContainText("0.88281");
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
    await page.goto(`/knowledge/dip-segmentation/#${encodeURIComponent(anchor!)}`);
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    const code = article.locator("pre").first();
    await code.focus();
    await expect(code).toBeFocused();
    if (mobile) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => code.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    const resource = page.locator('a[href="/resources/opencv-segmentation-thresholds/"]').first();
    await resource.focus();
    await expect(resource).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(resource).not.toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expectViewportContained(page, mobile ? 360 : 1440);
    await article.locator("table").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("segmentation.png") });
  });

  test("segmentation: navigation, partial release and isolated resource", async ({ page }) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=segmentation", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-segmentation"]').first()).toBeAttached();
    }
    await page.goto("/resources/opencv-segmentation-thresholds/");
    await expect(page.getByRole("main")).toContainText("adaptiveThreshold");
    await expect(page.getByRole("main")).toContainText("跳过");
    await expect(page.locator('a[href="https://docs.opencv.org/4.13.0/d7/d1b/group__imgproc__misc.html"]')).toBeVisible();
  });
}
