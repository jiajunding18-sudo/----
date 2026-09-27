import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectViewportContained } from "./helpers/viewport";

export function classicalInspectionTests() {
  test("Classical Inspection Project: published contract, content and deep links", async ({ page }, info) => {
    const width = info.project.name === "mobile-chromium" ? 360 : 1440;
    await page.goto("/projects/classical-inspection/");
    await page.waitForLoadState("networkidle");
    const article = page.locator(".learning-document");
    await expect(article.getByRole("heading", { level: 1, name: "经典零件与图形检测" })).toBeVisible();
    await expect(page.locator("[data-project-progress-status=not_started]")).toBeVisible();
    await expect(page.locator("[data-project-requirement]")).toHaveCount(7);
    await expect(page.locator("[data-acceptance-criterion]")).toHaveCount(7);
    await expect(page.locator("[data-deliverable-requirements] li")).toHaveCount(4);
    await expect(article.locator("table")).toHaveCount(1);
    await expect(article.locator(".katex-error")).toHaveCount(0);
    for (const marker of ["外缘缺口", "dev-0001.png", "R<0.98", "contourArea", "Otsu", "-80", "FP", "FN", "succeeded / failed / skipped", "不要求把这些算法塞进本项目"])
      await expect(article).toContainText(marker);
    await expect(article).not.toContainText("路线已规划，正式项目内容尚未展开");

    const jump = article.getByRole("link", { name: "A/B 比较", exact: true });
    await jump.focus();
    await expect(jump).toBeFocused();
    await page.keyboard.press("Enter");
    const hash = "#section-scheme-a-b-只改变阈值选择方法";
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe(hash);
    const section = article.locator("h2", { hasText: "Scheme A/B" });
    await expect(section).toBeInViewport();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(section).toBeInViewport();
    await page.goto(`/projects/classical-inspection/${hash}`);
    await expect(section).toBeInViewport();
    await expectViewportContained(page, width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("Classical Inspection publication is discoverable without granting learner completion", async ({ page }, info) => {
    const width = info.project.name === "mobile-chromium" ? 360 : 1440;
    await page.goto("/projects/");
    await expect(page.locator('[data-project-id="project.classical-inspection"]')).toHaveAttribute("data-project-status", "published");
    await page.getByLabel("Status").selectOption("published");
    await expect(page.locator("[data-project-id]")).toHaveCount(2);
    await page.locator('[data-project-id="project.classical-inspection"] a[href="/projects/classical-inspection/"]').first().click();
    await expect(page.locator("[data-project-completion-status=not_started]")).toBeVisible();
    await expect(page.locator('[data-project-knowledge-readiness="not-ready"]')).toBeVisible();
    await expectViewportContained(page, width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("Classical Inspection is linked from Roadmap, Search and its published knowledge", async ({ page }, info) => {
    const width = info.project.name === "mobile-chromium" ? 360 : 1440;
    for (const route of ["/roadmap/", "/search/?q=经典零件", "/knowledge/dip-segmentation/"]) {
      await page.goto(route);
      await expect(page.locator('a[href="/projects/classical-inspection/"]').first()).toBeAttached();
    }
    await page.goto("/projects/classical-inspection/");
    const link = page.locator('a[href="/knowledge/opencv-io-color/"]').first();
    await expect(link).toBeAttached();
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/knowledge\/opencv-io-color\//);
    await expectViewportContained(page, width);
  });
}
