import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

async function submitSearch(page: Page, query: string) {
  const input = page.getByRole("searchbox", { name: "搜索词" });
  await input.fill(query);
  await input.press("Enter");
}

test("空状态可用，中文标题搜索可由键盘进入 Concept", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/search/");

  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
  await expect(page.locator('[data-search-empty="initial"]')).toBeVisible();
  await expect(page.locator("[data-search-result-id]")).toHaveCount(0);

  const input = page.getByRole("searchbox", { name: "搜索词" });
  await input.focus();
  await expect(input).toBeFocused();
  await input.fill("调试与问题定位");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/search\/?\?q=/);

  const debugging = page.locator(
    '[data-search-result-id="tooling.debugging"]',
  );
  await expect(debugging).toBeVisible();
  await expect(debugging).toContainText("命中标题");
  await expect(debugging).toContainText("available · 正式内容");
  const conceptLink = debugging.getByRole("link", { name: "调试与问题定位" });
  await conceptLink.focus();
  await expect(conceptLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/knowledge\/debugging-and-problem-localization\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /调试与问题定位/ })).toBeVisible();

  await page.goto("/search/?q=调试与问题定位");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("英文、alias、缩写与 URL 刷新保持正确，draft 项目不进入结果", async ({
  page,
}) => {
  await page.goto(
    "/search/?q=Debugging%20and%20Problem%20Localization",
  );
  await expect(
    page.locator('[data-search-result-id="tooling.debugging"]'),
  ).toContainText("命中英文名");

  await submitSearch(page, "Systematic Debugging");
  await expect(page.locator("[data-search-result-id]")).toHaveCount(1);
  await expect(
    page.locator('[data-search-result-id="tooling.debugging"]'),
  ).toContainText("命中别名");

  await submitSearch(page, "WSL");
  await expect(
    page.locator('[data-search-result-id="tooling.linux-basics"]'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "搜索词" })).toHaveValue(
    "WSL",
  );
  await expect(
    page.locator('[data-search-result-id="tooling.linux-basics"]'),
  ).toBeVisible();

  await submitSearch(page, "PnP");
  await expect(page.locator('[data-search-empty="no-results"]')).toBeVisible();
  await expect(page.locator("[data-search-result-id]")).toHaveCount(0);
  await expect(page.getByText(/planned Concept 或 draft Project/)).toBeVisible();

  await submitSearch(page, "[]()^$\\");
  await expect(page.locator('[data-search-empty="no-results"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("多类型结果、Project 导航与 Resource 站内落点正确", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/search/?q=Python");

  await expect(page.locator('[data-search-group="knowledge"]')).toBeVisible();
  await expect(page.locator('[data-search-group="projects"]')).toBeVisible();
  await expect(page.locator('[data-search-group="resources"]')).toBeVisible();

  await submitSearch(page, "Pixel Lab");
  const project = page.locator(
    '[data-search-result-id="project.pixel-lab"]',
  );
  await expect(project).toContainText("Project");
  await project.getByRole("link", { name: /Pixel Lab/ }).click();
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);

  await page.goto("/search/?q=Python%20官方教程");
  const resource = page.locator(
    '[data-search-result-id="resource.python-tutorial"]',
  );
  await expect(resource).toContainText("verified · 已核验资源");
  await expect(resource).toContainText("命中别名");
  await expect(resource.getByRole("link", { name: /The Python Tutorial/ })).toHaveAttribute(
    "href",
    "/resources/python-tutorial/",
  );
  await resource.getByRole("link", { name: /The Python Tutorial/ }).click();
  await expect(page).toHaveURL(/\/resources\/python-tutorial\/$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Python Tutorial" }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Stage 1A 新 Concept 自动进入搜索并落到正式学习页", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/search/?q=梯度");

  const result = page.locator(
    '[data-search-result-id="math.calculus-gradients"]',
  );
  await expect(result).toBeVisible();
  await expect(result).toContainText("available · 正式内容");
  const link = result.getByRole("link", {
    name: "微积分、偏导、链式法则与梯度",
  });
  await expect(link).toHaveAttribute(
    "href",
    "/knowledge/calculus-and-gradients/",
  );
  await link.click();
  await expect(page).toHaveURL(/\/knowledge\/calculus-and-gradients\/$/u);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /微积分、偏导、链式法则与梯度/u,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(browserErrors).toEqual([]);
});

test("Stage 1B 新 Concept 自动进入搜索并落到正式学习页", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/search/?q=SVD");

  const result = page.locator('[data-search-result-id="math.eigen-svd"]');
  await expect(result).toBeVisible();
  await expect(result).toContainText("available · 正式内容");
  const link = result.getByRole("link", {
    name: "特征方向、奇异值分解与低秩信息",
  });
  await expect(link).toHaveAttribute("href", "/knowledge/eigenvalues-and-svd/");
  await link.click();
  await expect(page).toHaveURL(/\/knowledge\/eigenvalues-and-svd\/$/u);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /特征方向、奇异值分解与低秩信息/u,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(browserErrors).toEqual([]);
});

test("正文标题命中直接进入 Concept 对应稳定章节", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/search/?q=9.%20Active%20Recall%20主动回忆");

  const debugging = page.locator(
    '[data-search-result-id="tooling.debugging"]',
  );
  await expect(debugging).toContainText("命中正文标题");
  const resultLink = debugging.getByRole("link", { name: "调试与问题定位" });
  await expect(resultLink).toHaveAttribute(
    "href",
    "/knowledge/debugging-and-problem-localization/#section-9-active-recall-主动回忆",
  );

  await resultLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-9-active-recall-主动回忆");
  const target = page.locator("#section-9-active-recall-主动回忆");
  await expect(target).toBeVisible();
  await expect
    .poll(async () => (await target.boundingBox())?.y ?? 0)
    .toBeGreaterThan(64);

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-9-active-recall-主动回忆");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
