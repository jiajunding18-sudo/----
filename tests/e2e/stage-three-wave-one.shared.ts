import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

export function waveOneReadingTests() {
  for (const slug of ["dip-sampling-quantization", "dip-convolution-lsi"]) {
    test(`${slug}: reading, deep link, keyboard and accessibility`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`/knowledge/${slug}/`);
      const article = page.locator(".learning-document");
      await expect(article).toBeVisible();
      await expect(article.locator(".katex").first()).toBeVisible();
      await expect(article.locator("pre").first()).toBeVisible();
      for (const name of [/Practice/, /Active Recall/, /Mastery Evidence/]) {
        await expect(article.getByRole("heading", { name })).toBeAttached();
      }
      const clarification = slug === "dip-sampling-quantization"
        ? "下面的成对平均表达等价于" : "先写下两项预测，再运行";
      const paragraph = article.locator("p").filter({ hasText: clarification });
      await expect(paragraph).toBeAttached();
      expect(await paragraph.evaluate(el => {
        let next = el.nextElementSibling;
        while (next && !next.querySelector("pre")) next = next.nextElementSibling;
        return Boolean(next);
      })).toBe(true);
      const heading = article.getByRole("heading", { name: /Worked Example/ });
      const anchor = await heading.getAttribute("id");
      expect(anchor).toBeTruthy();
      const mobile = (page.viewportSize()?.width ?? 1440) < 768;
      const toc = page.locator(`[data-concept-toc="${mobile ? "mobile" : "desktop"}"]`);
      if (mobile) await toc.locator("summary").click();
      const tocLink = toc.getByRole("link", { name: /Worked Example/ });
      await tocLink.focus();
      await expect(tocLink).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(heading).toBeInViewport();
      await page.goto(`/knowledge/${slug}/#${anchor}`);
      await expect(heading).toBeInViewport();
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const resource = page.locator('a[href^="/resources/"]').filter({ hasText: /Rescale|Filtering reference/ }).first();
      await resource.focus();
      await expect(resource).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(resource).not.toBeFocused();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const ids = await page.locator("[id]").evaluateAll(nodes => nodes.map(n => n.id));
      expect(new Set(ids).size).toBe(ids.length);
      const code = article.locator("pre").first();
      await code.focus();
      await expect(code).toBeFocused();
      if (mobile) {
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => code.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      }
      await paragraph.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${slug}.png`) });
      expect(errors).toEqual([]);
    });
  }

  test("Wave 1 appears in Knowledge, Roadmap, Search and Graph; resources resolve", async ({ page }) => {
    for (const route of ["/knowledge/", "/roadmap/", "/search/?q=卷积", "/roadmap/graph/"]) {
      await page.goto(route);
      if (route === "/roadmap/graph/") await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-convolution-lsi"]').first()).toBeAttached();
    }
    for (const slug of ["skimage-rescale-example", "opencv-filtering-reference"]) {
      await page.goto(`/resources/${slug}/`);
      await expect(page.getByRole("main")).toContainText("必看");
    }
  });
}
