import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectViewportContained } from "./helpers/viewport";

export function morphologyTests() {
  test("morphology: experiments, keyboard, TOC, hash, resource and accessibility",async({page},info)=>{
    await page.goto("/knowledge/dip-morphology/");
    await page.waitForLoadState("networkidle");
    const article=page.locator(".learning-document");
    await expect(article.locator("pre")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    for(const text of ["Mastery Evidence","Practice","Active Recall","16 个 FP","12 个 FN"])
      await expect(article).toContainText(text);
    const mobile=info.project.name==="mobile-chromium";
    const toc=page.locator(`[data-concept-toc="${mobile?"mobile":"desktop"}"]`);
    if(mobile) await toc.locator("summary").click();
    await toc.getByRole("link",{name:/Checkpoint C/}).focus();
    await page.keyboard.press("Enter");
    const heading=article.getByRole("heading",{name:/Checkpoint C/});
    await expect(heading).toBeFocused();
    const anchor=await heading.getAttribute("id");
    await page.reload();await page.waitForLoadState("networkidle");
    await expect(heading).toBeInViewport();
    await page.goto(`/knowledge/dip-morphology/#${encodeURIComponent(anchor!)}`);
    await expect(heading).toBeInViewport();
    const resource=page.locator('[data-resource-id="resource.opencv-morphology"]');
    await resource.scrollIntoViewIfNeeded();
    await resource.getByRole("link").first().focus();
    await expect(resource.getByRole("link").first()).toBeFocused();
    await expectViewportContained(page,mobile?360:1440);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await page.screenshot({path:info.outputPath("morphology.png")});
  });
  test("morphology: manifest navigation and scoped resource",async({page})=>{
    for(const route of ["/knowledge/","/roadmap/","/search/?q=morphology","/roadmap/graph/"]){
      await page.goto(route);
      if(route==="/roadmap/graph/")await page.locator("#global-graph-stage").selectOption("stage.digital-image-processing");
      await expect(page.locator('a[href^="/knowledge/dip-morphology"]').first()).toBeAttached();
      await expect(page.locator('a[href="/knowledge/dip-quality-metrics/"]')).toHaveCount(0);
    }
    await page.goto("/resources/opencv-morphology/");
    await expect(page.getByRole("main")).toContainText("跳过");
    await expect(page.getByRole("main")).toContainText("Structuring Element");
  });
}
