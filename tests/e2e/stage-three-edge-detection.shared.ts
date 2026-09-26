import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectViewportContained } from "./helpers/viewport";

export function edgeDetectionTests() {
  test("edge detection: equations, predictions, keyboard, hash and accessible reading", async ({ page }, info) => {
    await page.goto("/knowledge/dip-edge-detection/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    await expect(article.locator("pre")).toHaveCount(5);
    await expect(article.locator("table")).toHaveCount(1);
    await expect(article.locator(".katex-error")).toHaveCount(0);
    expect(await article.locator(".katex").count()).toBeGreaterThanOrEqual(2);
    for (const text of ["法向", "切向", "Active Recall", "Practice", "Mastery Evidence", "1245", "signed", "语义边界"])
      await expect(article).toContainText(text);
    const mobile = info.project.name === "mobile-chromium";
    const width = mobile ? 360 : 1440;
    const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
    if (mobile) await toc.locator("summary").click();
    await toc.getByRole("link", { name: /Checkpoint D/ }).focus();
    await page.keyboard.press("Enter");
    const heading = article.getByRole("heading", { name: /Checkpoint D/ });
    await expect(heading).toBeFocused();
    const hash = new URL(page.url()).hash;
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    await page.goto("/knowledge/");
    await page.goto(`/knowledge/dip-edge-detection/${hash}`);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    for (const element of await article.locator('[tabindex="0"]').all()) {
      const scrolls = await element.evaluate(e => e.scrollWidth > e.clientWidth);
      if (scrolls) {
        await element.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => element.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
        await page.keyboard.press("Tab");
        await expect(element).not.toBeFocused();
      }
    }
    await expectViewportContained(page, width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await article.getByRole("heading", { name: /Gx\/Gy、幅值与方向/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("edge-direction.png") });
    for (const slug of ["opencv-image-gradients", "opencv-canny-edges"]) {
      const resource = page.locator(`[data-resource-id="resource.${slug}"]`);
      await resource.scrollIntoViewIfNeeded();
      await resource.getByRole("link").first().focus();
      await expect(resource.getByRole("link").first()).toBeFocused();
      await expectViewportContained(page, width);
    }
    await page.screenshot({ path: info.outputPath("edge-resources.png") });
  });
  test("edge detection: navigation, partial release and scoped resources", async ({ page }, info) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=dip.edge-detection", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-edge-detection"]').first()).toBeAttached();
    }
    for (const slug of ["opencv-image-gradients", "opencv-canny-edges"]) {
      await page.goto(`/resources/${slug}/`);
      await expect(page.getByRole("main")).toContainText("跳过");
      await expectViewportContained(page, info.project.name === "mobile-chromium" ? 360 : 1440);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
}
