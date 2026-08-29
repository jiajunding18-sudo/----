import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("Resources 从正式 catalog 浏览并组合筛选", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/resources/");

  await expect(page.getByRole("heading", { level: 1, name: "Resources" })).toBeVisible();
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await expect(page.locator('[data-resource-id="resource.python-tutorial"]')).toContainText(
    "Python Software Foundation",
  );
  await expect(page.locator('[data-resource-id="resource.python-tutorial"]')).toContainText(
    "为什么推荐",
  );
  await expect(page.locator('[data-resource-id="resource.python-tutorial"]')).toContainText(
    "建议学习范围",
  );

  const typeFilter = page.getByLabel("按 Type 浏览");
  const stageFilter = page.getByLabel("按 Stage 浏览");
  const trackFilter = page.getByLabel("按 Track 浏览");
  const levelFilter = page.getByLabel("按 Difficulty 浏览");
  const conceptFilter = page.getByLabel("按 Related Concept 浏览");

  await typeFilter.selectOption("official-doc");
  await expect(page.locator("[data-resource-id]")).toHaveCount(7);
  await typeFilter.selectOption("all");
  await stageFilter.selectOption("stage.tooling-foundations");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await trackFilter.selectOption("track.common");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await levelFilter.selectOption("beginner");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await conceptFilter.selectOption("tooling.debugging");
  await expect(page.locator("[data-resource-id]")).toHaveCount(2);

  const reset = page.getByRole("button", { name: "全部资源" });
  await reset.focus();
  await expect(reset).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);

  const externalLink = page
    .locator('[data-resource-id="resource.python-tutorial"]')
    .getByRole("link", { name: /打开外部资源/ });
  await expect(externalLink).toHaveAttribute("href", "https://docs.python.org/3/tutorial/");
  await expect(externalLink).toHaveAttribute("target", "_blank");
  await externalLink.focus();
  await expect(externalLink).toBeFocused();

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Concept 与 Project 使用正式关系展示学习指导", async ({ page }) => {
  await page.goto("/knowledge/debugging-and-problem-localization/");
  const conceptResources = page.locator("[data-resource-id]");
  await expect(conceptResources).toHaveCount(2);
  await expect(conceptResources.nth(0)).toContainText("推荐顺序 1");
  await expect(conceptResources.nth(0)).toContainText("The Python Tutorial");
  await expect(conceptResources.nth(1)).toContainText("推荐顺序 2");
  await expect(conceptResources.nth(1)).toContainText("OpenCV-Python Tutorials");

  await page.goto("/projects/pixel-lab/");
  const projectResources = page.locator("[data-resource-id]");
  await expect(projectResources).toHaveCount(4);
  await expect(projectResources.nth(0)).toContainText("项目必需 · 环境 / API 文档");
  await expect(projectResources.nth(2)).toContainText("项目必需 · 参考资料");
  await expect(page.locator('[data-resource-id="resource.npm-package-lock"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
