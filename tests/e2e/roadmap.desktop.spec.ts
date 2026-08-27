import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const stageZeroConceptIds = [
  "tooling.computer-files",
  "tooling.dev-environment",
  "tooling.python-core",
  "tooling.python-modules",
  "tooling.git-basics",
  "tooling.debugging",
  "tooling.linux-basics",
  "tooling.reproducibility",
] as const;

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
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

test("Roadmap 从 manifest 展示 Stage 0 完整路线并支持键盘导航", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/roadmap/");
  await expect(page.getByRole("heading", { level: 1, name: "Roadmap" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stage 0：计算机与编程基础" }),
  ).toBeVisible();

  const stage = page.locator('[data-stage-id="stage.tooling-foundations"]');
  const conceptItems = stage.locator("[data-concept-id]");
  await expect(conceptItems).toHaveCount(8);
  expect(await conceptItems.evaluateAll((items) => items.map((item) => item.getAttribute("data-concept-id")))).toEqual(
    stageZeroConceptIds,
  );
  await expect(stage.locator('[data-dependency-kind="hard"]')).toHaveCount(7);
  await expect(stage.locator('[data-dependency-kind="recommended"]')).toHaveCount(5);
  await expect(stage.getByText("M · 必须掌握")).toHaveCount(7);
  await expect(stage.getByText("U · 理解即可")).toHaveCount(1);

  await expect(stage.locator('[data-project-id="project.pixel-lab"]')).toBeVisible();
  await expect(stage.getByRole("heading", { name: "Stage 出口标准" })).toBeVisible();
  await expect(
    stage.locator(
      'section[aria-labelledby="stage.tooling-foundations-exit"] ol > li',
    ),
  ).toHaveCount(5);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("我的学习进度")).toHaveCount(0);

  const disclosure = stage.locator("summary");
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press("Space");
  await expect(stage.locator("details")).not.toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(stage.locator("details")).toHaveAttribute("open", "");

  const pythonCoreLink = stage.getByRole("link", { name: "Python 核心语法" }).first();
  await pythonCoreLink.focus();
  await expect(pythonCoreLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/python-core\/$/);

  await page.goto("/roadmap/");
  await page.getByRole("link", { name: /Pixel Lab/ }).click();
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);

  await page.goto("/roadmap/");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
