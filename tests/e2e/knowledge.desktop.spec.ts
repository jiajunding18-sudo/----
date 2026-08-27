import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const conceptIds = [
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

test("Knowledge 从正式 catalog 浏览 Stage / Track，planned 范围保持空结果", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/");

  const results = page.locator("[data-knowledge-concept-id]");
  await expect(results).toHaveCount(8);
  expect(
    await results.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-knowledge-concept-id")),
    ),
  ).toEqual(conceptIds);
  await expect(page.getByText("1 个 Stage 已有正式内容")).toBeVisible();
  await expect(page.getByText("16 个 Stage 为 planned")).toBeVisible();

  const stageFilter = page.getByLabel("按 Stage 浏览");
  const trackFilter = page.getByLabel("按 Track 浏览");
  await expect(stageFilter.locator("option")).toHaveCount(18);
  await expect(trackFilter.locator("option")).toHaveText([
    "全部 Track（8）",
    "公共主干（8）",
    "3D 工业视觉高级分支（0）",
    "计算成像高级分支（0）",
  ]);

  await stageFilter.selectOption("stage.tooling-foundations");
  await expect(results).toHaveCount(8);
  await stageFilter.selectOption("stage.image-computing");
  await expect(results).toHaveCount(0);
  await expect(page.locator("[data-knowledge-empty-state]")).toContainText(
    "路线已规划，但正式学习内容尚未展开",
  );

  await page.getByRole("button", { name: "返回全部知识" }).click();
  await trackFilter.selectOption("track.industrial-3d");
  await expect(results).toHaveCount(0);
  await expect(page.locator("[data-knowledge-empty-state]")).toContainText(
    "目前没有已发布 Concept",
  );
  await page.getByRole("button", { name: "全部知识", exact: true }).click();
  await expect(results).toHaveCount(8);

  const developmentEnvironment = page.locator(
    '[data-knowledge-concept-id="tooling.dev-environment"]',
  );
  await expect(
    developmentEnvironment.locator('[data-dependency-kind="hard"]'),
  ).toContainText("计算机、文件与终端");
  await expect(
    developmentEnvironment.locator('[data-dependency-kind="recommended"]'),
  ).toContainText("Python 核心语法");
  await expect(page.locator("[data-user-progress]")).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Concept 详情可用键盘进入，并提供前置、后续与 Roadmap 导航", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/");

  const pythonCoreLink = page
    .locator('[data-knowledge-concept-id="tooling.python-core"] h2')
    .getByRole("link", { name: "Python 核心语法" });
  await pythonCoreLink.focus();
  await expect(pythonCoreLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/python-core\/$/);

  const navigation = page.locator("[data-concept-navigation]");
  await expect(navigation.getByRole("heading", { name: "前置知识" })).toBeVisible();
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.computer-files"][data-dependency-kind="recommended"]',
    ),
  ).toContainText("recommended · 建议前置");
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.python-modules"][data-dependency-kind="hard"]',
    ),
  ).toContainText("本知识是其 hard 前置");
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.debugging"][data-dependency-kind="hard"]',
    ),
  ).toBeVisible();
  await expect(
    navigation.locator(
      '[data-related-concept-id="tooling.dev-environment"][data-dependency-kind="recommended"]',
    ),
  ).toBeVisible();

  const prerequisiteLink = navigation.getByRole("link", {
    name: "计算机、文件与终端",
  });
  await prerequisiteLink.focus();
  await expect(prerequisiteLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/computer-files-and-terminal\/$/);

  await page.goto("/knowledge/python-core/");
  const roadmapLink = page.getByRole("link", {
    name: "在 Roadmap 查看对应 Stage",
  });
  await expect(roadmapLink).toHaveAttribute(
    "href",
    "/roadmap/#roadmap-stage-stage.tooling-foundations",
  );
  await roadmapLink.click();
  await expect(page).toHaveURL(
    /\/roadmap\/#roadmap-stage-stage\.tooling-foundations$/,
  );

  await page.goto("/knowledge/python-core/");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
