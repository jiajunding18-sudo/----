import { expect, type Page } from "@playwright/test";

export async function expectViewportContained(page: Page, expectedWidth: number) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      innerWidth, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
      bodyClientWidth: document.body.clientWidth, bodyScrollWidth: document.body.scrollWidth,
      visualWidth: visualViewport?.width,
      candidates: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(el => {
          if (el.getBoundingClientRect().right <= root.clientWidth + 1) return false;
          // Local code/table scrolling is allowed.
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(parent).overflowX)) return false;
          }
          return true;
        }).slice(0, 8).map(el => ({
          tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 100),
          right: el.getBoundingClientRect().right, client: el.clientWidth, scroll: el.scrollWidth,
        })),
    };
  });
  const diagnostic = JSON.stringify({ configured: page.viewportSize(), expectedWidth, ...metrics }, null, 2);
  expect(page.viewportSize()?.width, diagnostic).toBe(expectedWidth);
  expect(Math.abs(metrics.clientWidth - expectedWidth), diagnostic).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.innerWidth - expectedWidth), diagnostic).toBeLessThanOrEqual(1);
  expect(metrics.scrollWidth, diagnostic).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyClientWidth, diagnostic).toBeLessThanOrEqual(expectedWidth + 1);
  expect(metrics.bodyScrollWidth, diagnostic).toBeLessThanOrEqual(expectedWidth + 1);
  console.log("viewport containment", JSON.stringify({ expectedWidth, ...metrics }));
}
