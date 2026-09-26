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
  await expect(page.locator("[data-resource-id]")).toHaveCount(26);
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
  await expect(page.locator("[data-resource-id]")).toHaveCount(21);
  await expect(page).toHaveURL(/type=official-doc/u);
  await typeFilter.selectOption("all");
  await stageFilter.selectOption("stage.tooling-foundations");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await expect(page).toHaveURL(/stage=stage\.tooling-foundations/u);
  await trackFilter.selectOption("track.common");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await levelFilter.selectOption("beginner");
  await expect(page.locator("[data-resource-id]")).toHaveCount(8);
  await conceptFilter.selectOption("tooling.debugging");
  await expect(page.locator("[data-resource-id]")).toHaveCount(2);
  await expect(page).toHaveURL(/relatedConcept=tooling\.debugging/u);
  await page.reload();
  await expect(conceptFilter).toHaveValue("tooling.debugging");
  await expect(page.locator("[data-resource-id]")).toHaveCount(2);

  const reset = page.getByRole("button", { name: "全部资源" });
  await reset.focus();
  await expect(reset).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-resource-id]")).toHaveCount(26);

  await stageFilter.selectOption("stage.vision-math-geometry-optimization");
  await expect(page.locator("[data-resource-id]")).toHaveCount(3);
  await expect(
    page.locator('[data-resource-id="resource.numpy-linear-algebra"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-resource-id="resource.stanford-cs231n-optimization"]'),
  ).toBeVisible();
  await reset.click();

  await page.goto(
    "/resources/?type=unknown&stage=missing&track=invalid&difficulty=expert&relatedConcept=ghost",
  );
  await expect(typeFilter).toHaveValue("all");
  await expect(stageFilter).toHaveValue("all");
  await expect(trackFilter).toHaveValue("all");
  await expect(levelFilter).toHaveValue("all");
  await expect(conceptFilter).toHaveValue("all");
  await expect(page.locator("[data-resource-id]")).toHaveCount(26);

  const internalLink = page
    .locator('[data-resource-id="resource.python-tutorial"]')
    .getByRole("link", { name: "The Python Tutorial" });
  await expect(internalLink).toHaveAttribute("href", "/resources/python-tutorial/");
  await expect(
    page.getByRole("link", { name: /打开.*资源.*外部网站/u }),
  ).toHaveCount(0);
  await internalLink.focus();
  await expect(internalLink).toBeFocused();

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("26 个 Resource 均有静态详情，正式外链只由详情主动打开", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/resources/");
  const detailHrefs = await page
    .locator("[data-resource-id] h3 > a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

  expect(detailHrefs).toHaveLength(26);
  expect(new Set(detailHrefs).size).toBe(26);
  for (const href of detailHrefs) {
    expect(href).not.toBeNull();
    await page.goto(href ?? "/resources/");
    await expect(page.locator('[data-resource-detail="true"]')).toBeVisible();
  }

  await page.goto("/resources/python-tutorial/");
  const detail = page.locator('[data-resource-detail="true"]');
  await expect(
    page.getByRole("heading", { level: 1, name: "The Python Tutorial" }),
  ).toBeVisible();
  await expect(detail).toContainText("Python Software Foundation");
  await expect(detail).toContainText("官方文档");
  await expect(detail).toContainText("入门");
  await expect(detail).toContainText("优先学习");
  await expect(detail).toContainText("英文");
  await expect(detail).toContainText("验证状态");
  await expect(detail).toContainText("最近验证");
  await expect(detail).toContainText("为什么推荐");
  await expect(detail).toContainText("建议学习范围");
  await expect(detail.getByRole("link", { name: "Python 核心语法" })).toBeVisible();
  const externalLink = detail.getByRole("link", {
    name: /打开官方资源.*外部网站/u,
  });
  await expect(externalLink).toHaveAttribute(
    "href",
    "https://docs.python.org/3/tutorial/",
  );
  await expect(externalLink).toHaveAttribute("target", "_blank");
  await externalLink.focus();
  await expect(externalLink).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "The Python Tutorial" }),
  ).toBeVisible();

  await page.goto("/resources/opencv-python-tutorials/");
  const openCvDetail = page.locator('[data-resource-detail="true"]');
  await expect(openCvDetail).toContainText("ORB in OpenCV");
  await expect(openCvDetail).toContainText("除 ORB 最小预览外的 features");
  await expect(openCvDetail.getByRole("link", { name: "局部特征预览", exact: true }))
    .toHaveAttribute("href", "/knowledge/opencv-features-preview/");
  await expect(openCvDetail).toContainText("Averaging、Gaussian Blurring");
  await expect(openCvDetail).toContainText("filter2D");
  await expect(openCvDetail).toContainText("sharpening mask");
  await expect(openCvDetail).toContainText("median、bilateral");
  await expect(openCvDetail).toContainText("THRESH_BINARY、THRESH_BINARY_INV");
  await expect(openCvDetail).toContainText("Erosion、Dilation、Opening、Closing");
  await expect(openCvDetail).toContainText("adaptive threshold、Otsu");
  await expect(openCvDetail).toContainText("Sobel 与 output depth");
  await expect(openCvDetail).toContainText("Canny Edge Detection");
  await expect(openCvDetail).toContainText("findContours、RETR_EXTERNAL");
  await expect(openCvDetail).toContainText("area、perimeter 与 bounding rectangle");
  await expect(
    openCvDetail.getByRole("link", { name: "平滑、锐化与基础滤波" }),
  ).toHaveAttribute("href", "/knowledge/opencv-filtering-basics/");
  await expect(
    openCvDetail.getByRole("link", { name: "阈值与形态学" }),
  ).toHaveAttribute("href", "/knowledge/opencv-threshold-morphology/");
  await expect(
    openCvDetail.getByRole("link", { name: "边缘、轮廓与区域测量" }),
  ).toHaveAttribute("href", "/knowledge/opencv-edges-contours/");
  await expect(
    openCvDetail.getByRole("link", { name: "批处理、配置、结果保存与日志" }),
  ).toHaveAttribute("href", "/knowledge/pipeline-batch-images/");

  await page.goto("/resources/python-pathlib/");
  const pathlibDetail = page.locator('[data-resource-detail="true"]');
  await expect(pathlibDetail).toContainText("Path.iterdir");
  await expect(pathlibDetail).toContainText("Path.stem");
  await expect(pathlibDetail).toContainText("Path.rglob");
  await expect(
    pathlibDetail.getByRole("link", { name: "批处理、配置、结果保存与日志" }),
  ).toHaveAttribute("href", "/knowledge/pipeline-batch-images/");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("不存在的 Resource 返回可恢复的静态 404", async ({ page }) => {
  const missingResponse = await page.goto("/resources/not-a-resource/");

  expect(missingResponse?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "内容不存在" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Resources" })).toHaveAttribute(
    "href",
    "/resources/",
  );
  await expectNoHorizontalOverflow(page);
});

test("Concept 与 Project 使用正式关系展示学习指导", async ({ page }) => {
  await page.goto("/knowledge/debugging-and-problem-localization/");
  const conceptResources = page.locator("[data-resource-id]");
  await expect(conceptResources).toHaveCount(2);
  await expect(conceptResources.nth(0)).toContainText("推荐顺序 1");
  await expect(conceptResources.nth(0)).toContainText("The Python Tutorial");
  await expect(conceptResources.nth(1)).toContainText("推荐顺序 2");
  await expect(conceptResources.nth(1)).toContainText("OpenCV-Python Tutorials");
  const conceptResourceLink = conceptResources
    .nth(0)
    .getByRole("link", { name: "The Python Tutorial" });
  await expect(conceptResourceLink).toHaveAttribute(
    "href",
    "/resources/python-tutorial/",
  );
  await conceptResourceLink.click();
  await expect(page).toHaveURL(/\/resources\/python-tutorial\/$/u);

  await page.goto("/projects/pixel-lab/");
  const projectResources = page.locator("[data-resource-id]");
  await expect(projectResources).toHaveCount(4);
  await expect(projectResources.nth(0)).toContainText("项目必需 · 环境 / API 文档");
  await expect(projectResources.nth(2)).toContainText("项目必需 · 参考资料");
  await expect(page.locator('[data-resource-id="resource.npm-package-lock"]')).toHaveCount(0);
  const projectResourceLink = page
    .locator('[data-resource-id="resource.python-venv"]')
    .getByRole("link", { name: "venv — Creation of virtual environments" });
  await expect(projectResourceLink).toHaveAttribute(
    "href",
    "/resources/python-venv/",
  );
  await projectResourceLink.click();
  await expect(page).toHaveURL(/\/resources\/python-venv\/$/u);
  await expectNoHorizontalOverflow(page);
});
