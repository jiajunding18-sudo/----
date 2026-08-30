import { expect, test, type Page } from "@playwright/test";

import { contentManifest } from "../../.generated/content-manifest";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function openDashboardFromPrimaryNavigation(page: Page) {
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: /Dashboard/ })
    .click();
  await expect(page.locator('[data-dashboard-console="ready"]')).toBeVisible();
}

async function startPixelLab(page: Page) {
  await page.goto("/projects/pixel-lab/");
  await page.getByRole("radio", { name: /程序生成的 PGM 测试图/ }).check();
  await page.getByRole("checkbox", { name: /Python 与项目内 venv/ }).check();
  await page.getByRole("checkbox", { name: /opencv-python/ }).check();
  await page
    .getByLabel("第一项下一动作")
    .fill("创建项目目录并记录 Python 解释器路径");
  await page
    .getByRole("checkbox", { name: /我理解仍缺少上述 hard 前置能力/ })
    .check();
  await page.getByRole("button", { name: "确认带缺口开始 Project" }).click();
  await expect(page.locator("[data-project-execution]")).toHaveAttribute(
    "data-project-progress-status",
    "in_progress",
  );
}

async function fillStudyLog(
  page: Page,
  values: {
    readonly date: string;
    readonly learned: string;
    readonly minutes: string;
  },
) {
  await page.getByLabel("学习日期").fill(values.date);
  await page.getByLabel("学习时长（分钟）").fill(values.minutes);
  await page.getByLabel("学习了什么").fill(values.learned);
}

test("新用户 Dashboard 只显示诚实空状态和正式路线分母", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  const expectedTotal = contentManifest.concepts.filter(
    ({ publicationStatus, requiredness }) =>
      publicationStatus === "published" && requiredness === "required",
  ).length;

  await page.goto("/");
  const console = page.locator('[data-dashboard-console="ready"]');
  await expect(console).toBeVisible();
  await expect(console.locator("[data-dashboard-learning-empty]")).toBeVisible();
  await expect(console.locator("[data-dashboard-project-empty]")).toBeVisible();
  await expect(console.locator("[data-dashboard-recent-logs-empty]")).toContainText(
    "只有你主动保存的记录",
  );
  await expect(console.locator("[data-dashboard-today-minutes]")).toHaveText(
    "0 分钟",
  );
  await expect(console.locator("[data-dashboard-week-minutes]")).toHaveText(
    "0 分钟",
  );
  await expect(console.locator("[data-dashboard-last-study-date]")).toHaveText(
    "尚无学习记录",
  );
  for (const kind of ["started", "understood", "mastered"]) {
    await expect(
      console.locator(`[data-dashboard-progress-kind="${kind}"]`),
    ).toHaveText(`0 / ${expectedTotal}`);
  }
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveCount(1);
  expect(browserErrors).toEqual([]);
});

test("Concept、Project 与 Study Log 变化实时进入 Dashboard，并经刷新和备份恢复", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  const now = new Date();
  const today = localDate(now);
  const yesterdayDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const yesterday = localDate(yesterdayDate);
  const expectedWeekMinutes = now.getDay() === 1 ? 40 : 65;
  const expectedProgressTotal = contentManifest.concepts.filter(
    ({ publicationStatus, requiredness }) =>
      publicationStatus === "published" && requiredness === "required",
  ).length;

  await page.goto("/knowledge/python-core/");
  await page
    .locator("[data-concept-progress]")
    .getByRole("button", { name: "开始学习" })
    .click();
  await openDashboardFromPrimaryNavigation(page);
  await expect(
    page.locator('[data-dashboard-learning-concept-id="tooling.python-core"]'),
  ).toContainText("Python 核心语法");
  await expect(
    page.locator('[data-dashboard-progress-kind="started"]'),
  ).toHaveText(`1 / ${expectedProgressTotal}`);

  await startPixelLab(page);
  await openDashboardFromPrimaryNavigation(page);
  const project = page.locator(
    '[data-dashboard-current-project="project.pixel-lab"]',
  );
  await expect(project).toContainText(
    "Pixel Lab：可复现的第一次图像读写实验",
  );
  await expect(project.locator("[data-dashboard-project-next-action]")).toHaveText(
    "创建项目目录并记录 Python 解释器路径",
  );
  await expect(project.locator("[data-dashboard-project-readiness]")).toContainText(
    "hard 知识缺口",
  );

  await page.goto("/study-log/");
  await fillStudyLog(page, {
    date: yesterday,
    learned: "昨日完成路径与异常复盘",
    minutes: "25",
  });
  await page.getByRole("button", { name: "保存学习记录" }).click();
  await fillStudyLog(page, {
    date: today,
    learned: "今日完成 Python 与 Pixel Lab 练习",
    minutes: "40",
  });
  await page.getByRole("checkbox", { name: "Python 核心语法" }).check();
  await page
    .getByLabel("Pixel Lab：可复现的第一次图像读写实验")
    .check();
  await page.getByRole("button", { name: "保存学习记录" }).click();

  await openDashboardFromPrimaryNavigation(page);
  await expect(page.locator("[data-dashboard-today-minutes]")).toHaveText(
    "40 分钟",
  );
  await expect(page.locator("[data-dashboard-week-minutes]")).toHaveText(
    `${expectedWeekMinutes} 分钟`,
  );
  await expect(page.locator("[data-dashboard-last-study-date]")).toContainText(
    `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`,
  );
  const recentLogs = page.locator("[data-dashboard-study-log-id]");
  await expect(recentLogs).toHaveCount(2);
  await expect(recentLogs.first()).toContainText(
    "今日完成 Python 与 Pixel Lab 练习",
  );
  await expect(recentLogs.nth(1)).toContainText("昨日完成路径与异常复盘");
  await expect(
    recentLogs.first().getByRole("link", { name: "Python 核心语法" }),
  ).toHaveAttribute("href", "/knowledge/python-core/");
  await expect(
    recentLogs.first().getByRole("link", {
      name: "Pixel Lab：可复现的第一次图像读写实验",
    }),
  ).toHaveAttribute("href", "/projects/pixel-lab/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.python-core");

  await page.reload();
  await expect(page.locator('[data-dashboard-console="ready"]')).toBeVisible();
  await expect(page.locator("[data-dashboard-today-minutes]")).toHaveText(
    "40 分钟",
  );
  await expect(
    page.locator('[data-dashboard-current-project="project.pixel-lab"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-dashboard-learning-concept-id="tooling.python-core"]'),
  ).toBeVisible();

  await page.goto("/settings/data/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backupBuffer = Buffer.concat(chunks);

  await page.getByRole("button", { name: "准备清空学习记录" }).click();
  await page
    .getByRole("checkbox", { name: /明确确认清空学习记录/ })
    .check();
  await page.getByRole("button", { name: "确认清空学习记录" }).click();
  await openDashboardFromPrimaryNavigation(page);
  await expect(page.locator("[data-dashboard-learning-empty]")).toBeVisible();
  await expect(page.locator("[data-dashboard-project-empty]")).toBeVisible();
  await expect(page.locator("[data-dashboard-recent-logs-empty]")).toBeVisible();
  await expect(page.locator("[data-dashboard-today-minutes]")).toHaveText(
    "0 分钟",
  );

  await page.goto("/settings/data/");
  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await page.getByLabel("选择 Learning OS JSON 备份").setInputFiles({
    buffer: backupBuffer,
    mimeType: "application/json",
    name: download.suggestedFilename(),
  });
  await page
    .getByRole("checkbox", { name: /明确确认替换当前学习状态/ })
    .check();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await openDashboardFromPrimaryNavigation(page);
  await expect(page.locator("[data-dashboard-today-minutes]")).toHaveText(
    "40 分钟",
  );
  await expect(page.locator("[data-dashboard-study-log-id]")).toHaveCount(2);
  await expect(
    page.locator('[data-dashboard-current-project="project.pixel-lab"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-dashboard-learning-concept-id="tooling.python-core"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-dashboard-progress-kind="started"]'),
  ).toHaveText(`1 / ${expectedProgressTotal}`);
  expect(browserErrors).toEqual([]);
});
