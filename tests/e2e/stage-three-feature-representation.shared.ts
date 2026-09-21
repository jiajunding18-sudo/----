import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectViewportContained } from "./helpers/viewport";

export function featureRepresentationTests() {
  test("feature representation: constrained experiments, keyboard, hashes and responsive resources", async ({ page }, info) => {
    await page.goto("/knowledge/dip-feature-representation/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    await expect(article.locator("pre")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    await expect(article.locator(".katex-error")).toHaveCount(0);
    for (const text of ["understand", "293.94", "256 bits", "去均值", "碰撞", "Active Recall", "Practice", "Mastery Evidence", "descriptors is None"])
      await expect(article).toContainText(text);
    const mobile = info.project.name === "mobile-chromium";
    const width = mobile ? 360 : 1440;
    const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
    if (mobile) await toc.locator("summary").click();
    await toc.getByRole("link", { name: /Checkpoint B/ }).focus();
    await page.keyboard.press("Enter");
    const heading = article.getByRole("heading", { name: /Checkpoint B/ });
    await expect(heading).toBeFocused();
    const hash = new URL(page.url()).hash;
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    await page.goto("/knowledge/");
    await page.goto(`/knowledge/dip-feature-representation/${hash}`);
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
    await article.getByRole("heading", { name: /Checkpoint C/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("feature-contract.png") });
    const resource = page.locator('[data-resource-id="resource.opencv-python-tutorials"]');
    await resource.scrollIntoViewIfNeeded();
    await resource.getByRole("link").first().focus();
    await expect(resource.getByRole("link").first()).toBeFocused();
    await expectViewportContained(page, width);
    await page.screenshot({ path: info.outputPath("feature-resource.png") });
  });
  test("feature representation: published navigation and reused resource", async ({ page }, info) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=dip.feature-representation", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-feature-representation"]').first()).toBeAttached();
      for (const slug of ["dip-quality-metrics"])
        await expect(page.locator(`a[href="/knowledge/${slug}/"]`)).toHaveCount(0);
    }
    await page.goto("/resources/opencv-python-tutorials/");
    await expect(page.getByRole("main")).toContainText("ORB");
    await expect(page.locator('a[href^="/knowledge/dip-feature-representation"]').first()).toBeAttached();
    await expectViewportContained(page, info.project.name === "mobile-chromium" ? 360 : 1440);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
