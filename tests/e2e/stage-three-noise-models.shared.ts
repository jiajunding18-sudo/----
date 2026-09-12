import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

export function noiseModelsReadingTests() {
  test("noise models: checkpoints, keyboard, deep links and a11y", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/knowledge/dip-noise-models/");
    // Complete static-page/font loading before testing retained scroll positions.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const article = page.locator(".learning-document");
    await expect(article).toContainText("颗粒感不是来源证明");
    await expect(article.locator(".katex").first()).toBeVisible();
    await expect(article.locator("pre")).toHaveCount(5);
    const checkpoint = article.getByRole("heading", { name: /Checkpoint 4/ });
    const anchor = await checkpoint.getAttribute("id");
    const expectAnchor = async () => {
      expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(anchor);
      await expect(checkpoint).toBeInViewport();
      const position = await checkpoint.evaluate(el => el.getBoundingClientRect().top);
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThan(160);
    };
    const mobile = (page.viewportSize()?.width ?? 1440) < 768;
    const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
    if (mobile) await toc.locator("summary").click();
    const link = toc.getByRole("link", { name: /Checkpoint 4/ });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(checkpoint).toBeFocused();
    await expect(checkpoint).toBeInViewport();
    // Finish the TOC's animation-frame focus and browser scroll bookkeeping
    // before initiating a second navigation (reload).
    await checkpoint.evaluate(async (heading) => {
      let previous = heading.getBoundingClientRect().top;
      let stableFrames = 0;
      while (stableFrames < 5) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const current = heading.getBoundingClientRect().top;
        stableFrames = Math.abs(current - previous) < 0.5 ? stableFrames + 1 : 0;
        previous = current;
      }
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expectAnchor();
    // A fresh deep-link navigation is distinct from navigating to the current hash.
    await page.goto("/knowledge/");
    await page.goto(`/knowledge/dip-noise-models/#${encodeURIComponent(anchor!)}`);
    await page.waitForLoadState("networkidle");
    await expectAnchor();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expectAnchor();
    const ids = await page.locator("[id]").evaluateAll(elements => elements.map(el => el.id));
    expect(new Set(ids).size).toBe(ids.length);
    const resource = page.locator('a[href="/resources/numpy-random-generator/"]').first();
    await resource.focus();
    await expect(resource).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(resource).not.toBeFocused();
    const code = article.locator("pre").first();
    await code.focus();
    await expect(code).toBeFocused();
    if (mobile) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => code.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await checkpoint.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("noise-models.png") });
    expect(errors).toEqual([]);
  });

  test("noise models: manifest navigation and scoped resource", async ({ page }) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=Noise%20Models", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-noise-models"]').first()).toBeAttached();
    }
    await page.goto("/resources/numpy-random-generator/");
    await expect(page.getByRole("main")).toContainText("必看");
    await expect(page.getByRole("main")).toContainText("跳过");
    await expect(page.locator('a[href="https://numpy.org/doc/stable/reference/random/generator.html"]')).toBeVisible();
  });
}
