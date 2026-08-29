import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { seedAllPublishedConceptsMastered } from "./helpers/learning-state";

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

async function startPixelLabWithGaps(page: Page) {
  await page.goto("/projects/pixel-lab/");
  await page
    .getByRole("radio", { name: /程序生成的 PGM 测试图/ })
    .check();
  await page.getByRole("checkbox", { name: /Python 与项目内 venv/ }).check();
  await page.getByRole("checkbox", { name: /opencv-python/ }).check();
  await page
    .getByLabel("第一项下一动作")
    .fill("创建项目目录并记录 Python 解释器路径");
  const override = page.getByRole("checkbox", {
    name: /我理解仍缺少上述 hard 前置能力/,
  });
  await override.focus();
  await page.keyboard.press("Space");
  const start = page.getByRole("button", {
    name: "确认带缺口开始 Project",
  });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-project-action-message]")).toContainText(
    "Project 已开始",
  );
}

async function completePixelLab(page: Page) {
  await startPixelLabWithGaps(page);
  await page
    .getByLabel("交付物标题")
    .fill("Pixel Lab 可复现项目目录");
  await page
    .getByLabel("文件、commit 或结果引用（可选）")
    .fill("evidence/stage-0-exit/index.md");
  await page.getByRole("button", { name: "记录交付物" }).click();
  const acceptanceCheckboxes = page.locator(
    "[data-acceptance-criterion] input[type=checkbox]",
  );
  await expect(acceptanceCheckboxes).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    await acceptanceCheckboxes.nth(index).check();
  }
  await expect(page.locator("[data-project-completion]")).toHaveAttribute(
    "data-project-completion-status",
    "in_progress",
  );
  await expect(page.locator('[data-completion-eligible="true"]')).toBeVisible();
  const completionConfirmation = page.getByRole("checkbox", {
    name: /我已逐项检查正式验收标准与交付物/,
  });
  await completionConfirmation.focus();
  await page.keyboard.press("Space");
  const complete = page.getByRole("button", { name: "确认完成项目" });
  await complete.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-project-completion-message]")).toContainText(
    "Project 已由你主动确认完成",
  );
}

test("Projects 从 manifest 浏览 13 项能力路线并按正式维度筛选", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/projects/");

  await expect(page.locator("[data-project-id]")).toHaveCount(13);
  await expect(
    page.locator('[data-project-id="project.pixel-lab"]'),
  ).toHaveAttribute("data-project-status", "published");
  await expect(
    page.locator('[data-project-id="project.classical-inspection"]'),
  ).toHaveAttribute("data-project-status", "draft");
  await expect(page.getByText("Published · 可执行", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Draft · Planned", { exact: true })).toHaveCount(13);

  const status = page.getByLabel("Status");
  await status.focus();
  await expect(status).toBeFocused();
  await status.selectOption("draft");
  await expect(page.locator("[data-project-id]")).toHaveCount(12);
  await expect(page.locator('[data-project-status="published"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "查看正式项目内容" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /开始 Project/ })).toHaveCount(0);

  await status.selectOption("all");
  await page.getByLabel("Stage").selectOption("stage.planar-vision");
  await expect(page.locator("[data-project-id]")).toHaveCount(1);
  await expect(
    page.locator('[data-project-id="project.planar-localization"]'),
  ).toBeVisible();

  await page.getByLabel("Stage").selectOption("all");
  await page.getByLabel("Track").selectOption("track.computational-imaging");
  await expect(page.locator("[data-project-id]")).toHaveCount(2);

  await page.getByLabel("Track").selectOption("all");
  await page.getByLabel("Difficulty / Level").selectOption("beginner");
  await expect(page.locator('[data-project-level="beginner"]')).toHaveCount(3);

  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Pixel Lab 显示能力、应用、Required Knowledge 与实时 readiness", async ({
  page,
}) => {
  await page.goto("/projects/pixel-lab/");

  await expect(page.locator("[data-project-capability-overview]")).toContainText(
    "从现实问题到能力证据",
  );
  await expect(page.getByRole("heading", { name: "Real-world Connection" })).toBeVisible();
  await expect(page.locator("[data-project-requirement]")).toHaveCount(8);
  await expect(
    page.getByRole("heading", { name: "Recommended / supportive" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-project-requirement="tooling.linux-basics"]'),
  ).toContainText("需要已理解");
  await expect(page.locator('[data-requirement-satisfied="false"]')).toHaveCount(8);
  await expect(page.getByText(/仍缺 7 项 hard requirement/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Pixel Lab/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next Projects" })).toBeVisible();
  await expect(page.locator("[data-deliverable-requirements] li")).toHaveCount(4);
  await expect(page.locator("[data-acceptance-criterion]")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "记录交付物" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "经典零件与图形检测" })).toHaveAttribute(
    "href",
    "/projects/#project-classical-inspection",
  );

  await seedAllPublishedConceptsMastered(page);
  await page.reload();
  await expect(
    page.locator('[data-project-knowledge-readiness="ready"]'),
  ).toBeVisible();
  await expect(page.getByText("已具备开始条件", { exact: true })).toBeVisible();
  await expect(page.locator('[data-requirement-satisfied="true"]')).toHaveCount(8);
  await expectNoHorizontalOverflow(page);
});

test("Pixel Lab 交付物与验收项满足后仍须主动确认完成", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await startPixelLabWithGaps(page);
  await expect(page.locator("[data-deliverable-requirements] li")).toHaveCount(4);
  await expect(page.locator("[data-acceptance-criterion]")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "确认完成项目" })).toBeDisabled();

  await page
    .getByLabel("交付物标题")
    .fill("Pixel Lab 可复现项目目录");
  await page
    .getByLabel("文件、commit 或结果引用（可选）")
    .fill("evidence/stage-0-exit/index.md");
  await page.getByRole("button", { name: "记录交付物" }).click();
  await expect(page.locator("[data-project-deliverable]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "确认完成项目" })).toBeDisabled();

  const acceptanceCheckboxes = page.locator(
    "[data-acceptance-criterion] input[type=checkbox]",
  );
  for (let index = 0; index < 7; index += 1) {
    await acceptanceCheckboxes.nth(index).check();
  }
  await expect(page.locator("[data-project-completion]")).toHaveAttribute(
    "data-project-completion-status",
    "in_progress",
  );
  await expect(page.getByRole("button", { name: "确认完成项目" })).toBeDisabled();
  await expect(page.locator('[data-completion-eligible="true"]')).toBeVisible();

  const completionConfirmation = page.getByRole("checkbox", {
    name: /我已逐项检查正式验收标准与交付物/,
  });
  await completionConfirmation.focus();
  await page.keyboard.press("Space");
  const complete = page.getByRole("button", { name: "确认完成项目" });
  await complete.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-project-completion]")).toHaveAttribute(
    "data-project-completion-status",
    "completed",
  );
  await expect(page.locator("[data-project-completed-at]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "项目已完成" })).toBeVisible();
  await expect(page.locator("[data-project-evidence-candidates] li")).toHaveCount(8);
  await expect(page.locator("[data-project-deliverable]")).toContainText(
    "evidence/stage-0-exit/index.md",
  );
  const stored = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("mv-learning-os:learning-state") ?? "null",
    ),
  );
  expect(stored.payload.conceptProgress).toEqual({});
  expect(stored.payload.projectProgress["project.pixel-lab"]).toMatchObject({
    status: "completed",
    completionConfirmation: {
      acceptanceCriterionIds: expect.arrayContaining([
        "acceptance.pixel-lab.environment-rebuild",
        "acceptance.pixel-lab.reproducible-readme",
      ]),
      deliverableIds: [expect.stringMatching(/^deliverable\.project\.pixel-lab\./)],
    },
  });

  await page.reload();
  await expect(page.locator("[data-project-completion]")).toHaveAttribute(
    "data-project-completion-status",
    "completed",
  );
  await page.goto("/projects/");
  await expect(
    page.locator(
      '[data-project-id="project.pixel-lab"] [data-project-execution-status="completed"]',
    ),
  ).toContainText("执行状态：已完成");
  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.computer-files");
  expect(browserErrors).toEqual([]);
});

test("Pixel Lab 必须主动确认带缺口开始，并在刷新后保持正式执行状态", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/projects/pixel-lab/");
  await expect(page.locator("[data-project-execution]")).toHaveAttribute(
    "data-project-progress-status",
    "not_started",
  );
  await expect(page.locator("[data-environment-readiness]")).toHaveCount(0);

  await page
    .getByRole("radio", { name: /程序生成的 PGM 测试图/ })
    .check();
  await expect(page.locator('[data-environment-readiness="not-ready"]')).toBeVisible();
  await page.getByRole("checkbox", { name: /Python 与项目内 venv/ }).check();
  await page.getByRole("checkbox", { name: /opencv-python/ }).check();
  await expect(page.locator('[data-environment-readiness="ready"]')).toBeVisible();
  await page
    .getByLabel("第一项下一动作")
    .fill("创建项目目录并记录 Python 解释器路径");
  await expect(
    page.getByRole("button", { name: "确认带缺口开始 Project" }),
  ).toBeDisabled();

  const override = page.getByRole("checkbox", {
    name: /我理解仍缺少上述 hard 前置能力/,
  });
  await override.focus();
  await page.keyboard.press("Space");
  const start = page.getByRole("button", {
    name: "确认带缺口开始 Project",
  });
  await start.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-project-execution]")).toHaveAttribute(
    "data-project-progress-status",
    "in_progress",
  );
  await expect(page.getByRole("heading", { name: "当前正在执行" })).toBeVisible();
  await expect(page.locator("[data-project-started-at]")).toBeVisible();
  await expect(page.locator("[data-project-next-action]")).toHaveText(
    "创建项目目录并记录 Python 解释器路径",
  );
  await expect(page.locator("[data-project-hard-gaps] li")).toHaveCount(7);
  await expect(page.locator('[data-environment-readiness="ready"]')).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("mv-learning-os:learning-state") ?? "null",
    ),
  );
  expect(stored.payload).toMatchObject({
    conceptProgress: {},
    projectProgress: {
      "project.pixel-lab": {
        status: "in_progress",
        selectedExecutionPathId: "execution.pixel-lab.generated-image",
        prerequisiteOverride: {
          missingRequirementConceptIds: expect.arrayContaining([
            "tooling.computer-files",
            "tooling.reproducibility",
          ]),
        },
      },
    },
  });

  await page.reload();
  await expect(page.locator("[data-project-execution]")).toHaveAttribute(
    "data-project-progress-status",
    "in_progress",
  );
  await expect(page.locator("[data-project-next-action]")).toHaveText(
    "创建项目目录并记录 Python 解释器路径",
  );
  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.computer-files");
  expect(browserErrors).toEqual([]);
});

test("完整 Project 完成快照经 Export → Reset → Import 后恢复", async ({ page }) => {
  await completePixelLab(page);
  await page.goto("/settings/data/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backupBuffer = Buffer.concat(chunks);
  const exported = JSON.parse(backupBuffer.toString("utf8"));
  expect(exported.payload.projectProgress["project.pixel-lab"]).toMatchObject({
    status: "completed",
    selectedExecutionPathId: "execution.pixel-lab.generated-image",
    deliverables: [{ title: "Pixel Lab 可复现项目目录" }],
    completionConfirmation: {
      acceptanceCriterionIds: expect.arrayContaining([
        "acceptance.pixel-lab.environment-rebuild",
        "acceptance.pixel-lab.reproducible-readme",
      ]),
    },
  });

  await page.getByRole("button", { name: "准备清空学习记录" }).click();
  await page
    .getByRole("checkbox", { name: /明确确认清空学习记录/ })
    .check();
  await page.getByRole("button", { name: "确认清空学习记录" }).click();
  await page.goto("/projects/pixel-lab/");
  await expect(page.locator("[data-project-execution]")).toHaveAttribute(
    "data-project-progress-status",
    "not_started",
  );

  await page.goto("/settings/data/");
  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await page.getByLabel("选择 Learning OS JSON 备份").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await expect(page.locator("[data-import-preview]")).toContainText(
    "1 个 Project 的执行记录",
  );
  await page
    .getByRole("checkbox", { name: /明确确认替换当前学习状态/ })
    .check();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();

  await page.goto("/projects/pixel-lab/");
  await expect(page.locator("[data-project-execution]")).toHaveAttribute(
    "data-project-progress-status",
    "completed",
  );
  await expect(page.locator("[data-project-deliverable]")).toContainText(
    "Pixel Lab 可复现项目目录",
  );
});

test("Concept 与 Roadmap 都通过正式派生关系返回 Project", async ({ page }) => {
  await page.goto("/knowledge/computer-files-and-terminal/");
  const usage = page.locator("[data-concept-project-usage]");
  await expect(usage.locator('[data-concept-project-id="project.pixel-lab"]')).toBeVisible();
  await usage.getByRole("link", { name: /Pixel Lab/ }).click();
  await expect(page).toHaveURL(/\/projects\/pixel-lab\/$/);

  await page.goto("/roadmap/");
  const stageOneB = page.locator(
    '[data-overview-stage-id="stage.vision-math-geometry-optimization"]',
  );
  await stageOneB.locator("summary").click();
  const planned = stageOneB.getByRole("link", { name: "视觉数学实验册" });
  await planned.click();
  await expect(page).toHaveURL(/\/projects\/#project-math-vision-lab$/);
  await expect(
    page.locator('[data-project-id="project.math-vision-lab"]'),
  ).toBeVisible();
});
