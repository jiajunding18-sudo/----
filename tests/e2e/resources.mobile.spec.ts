import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

test("Resources 在 360px 可筛选、可键盘操作且通过基础 axe", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/resources/");
  await expect(page.locator("[data-resource-id]")).toHaveCount(26);
  const conceptFilter = page.getByLabel("按 Related Concept 浏览");
  await conceptFilter.focus();
  await expect(conceptFilter).toBeFocused();
  await conceptFilter.selectOption("tooling.reproducibility");
  await expect(page.locator("[data-resource-id]")).toHaveCount(3);
  await expect(page.locator('[data-resource-id="resource.github-readme"]')).toBeVisible();
  await expect(page).toHaveURL(/relatedConcept=tooling\.reproducibility/u);
  await page.reload();
  await expect(conceptFilter).toHaveValue("tooling.reproducibility");

  const reset = page.getByRole("button", { name: "全部资源" });
  await reset.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-resource-id]")).toHaveCount(26);
  await page
    .locator('[data-resource-id="resource.github-readme"]')
    .getByRole("link", { name: "About the repository README file" })
    .click();
  await expect(page).toHaveURL(/\/resources\/github-readme\/$/u);
  const externalLink = page.getByRole("link", {
    name: /打开官方资源.*外部网站/u,
  });
  await externalLink.focus();
  await expect(externalLink).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
