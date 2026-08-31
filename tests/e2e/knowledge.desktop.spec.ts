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
  "math.vectors-matrices",
  "math.linear-transforms",
  "math.calculus-gradients",
  "math.probability-statistics",
  "math.coordinate-frames",
  "math.least-squares",
  "math.eigen-svd",
  "math.optimization",
  "math.numerical-stability",
  "python.numpy-arrays",
  "python.numpy-dtypes",
  "image.digital-representation",
  "visualization.image-plots",
  "opencv.io-color",
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

test("Knowledge 从正式 catalog 浏览 Stage / Track，并保留未发布范围的诚实空结果", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/");

  const results = page.locator("[data-knowledge-concept-id]");
  await expect(results).toHaveCount(22);
  expect(
    await results.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-knowledge-concept-id")),
    ),
  ).toEqual(conceptIds);
  await expect(page.getByText("4 个 Stage 已有正式内容")).toBeVisible();
  await expect(page.getByText("13 个 Stage 为 planned")).toBeVisible();

  const stageFilter = page.getByLabel("按 Stage 浏览");
  const trackFilter = page.getByLabel("按 Track 浏览");
  await expect(stageFilter.locator("option")).toHaveCount(18);
  await expect(trackFilter.locator("option")).toHaveText([
    "全部 Track（22）",
    "公共主干（22）",
    "3D 工业视觉高级分支（0）",
    "计算成像高级分支（0）",
  ]);

  await stageFilter.selectOption("stage.tooling-foundations");
  await expect(results).toHaveCount(8);
  await stageFilter.selectOption("stage.vision-math-immediate");
  await expect(results).toHaveCount(4);
  await expect(
    page.locator('[data-knowledge-concept-id="math.vectors-matrices"]'),
  ).toBeVisible();
  await stageFilter.selectOption("stage.vision-math-geometry-optimization");
  await expect(results).toHaveCount(5);
  await expect(
    page.locator('[data-knowledge-concept-id="math.coordinate-frames"]'),
  ).toBeVisible();
  await stageFilter.selectOption("stage.image-computing");
  await expect(results).toHaveCount(5);
  await expect(
    page.locator('[data-knowledge-concept-id="python.numpy-arrays"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-knowledge-concept-id="opencv.io-color"]'),
  ).toBeVisible();
  await stageFilter.selectOption("stage.digital-image-processing");
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
  await expect(results).toHaveCount(22);

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

test("Concept 自动目录与中英文深链接在桌面端稳定可用", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/debugging-and-problem-localization/");

  const desktopToc = page.locator('[data-concept-toc="desktop"]');
  const mobileToc = page.locator('[data-concept-toc="mobile"]');
  await expect(desktopToc).toBeVisible();
  await expect(mobileToc).toBeHidden();
  expect(await desktopToc.evaluate((element) => getComputedStyle(element).position)).toBe(
    "sticky",
  );

  const tocTitles = await desktopToc.getByRole("link").allTextContents();
  const documentTitles = await page
    .locator(".learning-document h2, .learning-document h3")
    .evaluateAll((headings) =>
      headings.map((heading) => {
        const copy = heading.cloneNode(true) as HTMLElement;
        copy.querySelector(".heading-anchor")?.remove();
        return copy.textContent?.trim() ?? "";
      }),
    );
  expect(tocTitles).toEqual(documentTitles);
  expect(tocTitles).toHaveLength(14);

  const recallLink = desktopToc.getByRole("link", {
    name: "9. Active Recall 主动回忆",
  });
  await recallLink.focus();
  await expect(recallLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-9-active-recall-主动回忆");

  const recallHeading = page.locator("#section-9-active-recall-主动回忆");
  await expect(recallHeading).toBeFocused();
  await expect
    .poll(async () => (await recallHeading.boundingBox())?.y ?? 0)
    .toBeGreaterThan(64);
  await expect(recallLink).toHaveAttribute("aria-current", "location");

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-9-active-recall-主动回忆");
  await expect
    .poll(async () => (await recallHeading.boundingBox())?.y ?? 0)
    .toBeGreaterThan(64);

  await page.goto("/knowledge/reproducible-learning-projects/");
  await expect(page.locator("#section-python-pixel-lab")).toHaveText(
    /Python：Pixel Lab/,
  );
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
