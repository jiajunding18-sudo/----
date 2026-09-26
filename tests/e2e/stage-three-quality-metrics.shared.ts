import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectViewportContained } from "./helpers/viewport";

export function qualityMetricsTests() {
  test("quality metrics: numerical lesson, TOC, keyboard, deep link and responsive content", async ({ page }, info) => {
    await page.goto("/knowledge/dip-quality-metrics/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    await expect(article.locator("pre")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    await expect(article.locator("table th")).toHaveCount(4);
    await expect(article.locator(".katex-error")).toHaveCount(0);
    for (const marker of ["0.0025", "0.022148", "+∞", "masked_mse", "Active Recall", "Practice", "Mastery Evidence"])
      await expect(article).toContainText(marker);

    const mobile = info.project.name === "mobile-chromium";
    const width = mobile ? 360 : 1440;
    const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
    if (mobile) await toc.locator("summary").click();
    const tocLink = toc.getByRole("link", { name: /Checkpoint C/ });
    await tocLink.focus();
    await page.keyboard.press("Enter");
    const heading = article.getByRole("heading", { name: /Checkpoint C/ });
    await expect(heading).toBeFocused();
    const hash = new URL(page.url()).hash;
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    await page.goto(`/knowledge/dip-quality-metrics/${hash}`);
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    for (const element of await article.locator('[tabindex="0"]').all()) {
      if (await element.evaluate(e => e.scrollWidth > e.clientWidth)) {
        await element.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => element.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
        await page.keyboard.press("Tab");
        await expect(element).not.toBeFocused();
      }
    }
    await expectViewportContained(page, width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const resource = page.locator('[data-resource-id="resource.skimage-image-metrics"]');
    await resource.scrollIntoViewIfNeeded();
    await resource.getByRole("link").first().focus();
    await expect(resource.getByRole("link").first()).toBeFocused();
    await expectViewportContained(page, width);
  });

  test("quality metrics: Knowledge, Roadmap, Search, Graph and Resource include publication", async ({ page }, info) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=quality-metrics", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-quality-metrics"]').first()).toBeAttached();
    }
    await page.goto("/resources/skimage-image-metrics/");
    await expect(page.getByRole("main")).toContainText("data_range");
    await expect(page.locator('a[href^="/knowledge/dip-quality-metrics"]').first()).toBeAttached();
    await expectViewportContained(page, info.project.name === "mobile-chromium" ? 360 : 1440);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
