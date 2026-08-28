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

async function saveEvidenceForEveryCriterion(page: Page) {
  const progress = page.locator("[data-concept-progress]");
  const form = progress.getByRole("form", { name: "记录一条通过证据" });
  const criterionCheckboxes = form.getByRole("checkbox");
  const count = await criterionCheckboxes.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await criterionCheckboxes.nth(index).check();
  }
  await form.getByLabel("证据类型").selectOption("code-artifact");
  await form.getByLabel("证据标题").fill("Python 数据处理与控制流证据");
  await form
    .getByLabel("如何检查这条证据")
    .fill("保存了源码、三组输入、手算预期、实际输出与逐步变量追踪表。");
  await form.getByLabel("产物位置（可选）").fill("commit abc123");
  await form.getByRole("button", { name: "保存通过证据" }).click();
}

test("Concept 从未开始到主动确认 mastered，并同步 Dashboard / Knowledge", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  const progress = page.locator("[data-concept-progress]");

  await expect(progress).toContainText("当前：未开始");
  await expect(progress.locator("[data-recommended-prerequisites]")).toContainText(
    "这是建议，不会阻止确认理解",
  );
  await expect(progress.locator("[data-mastery-criteria]")).toContainText(
    "独立编写函数处理至少三条图像记录",
  );

  await progress.getByRole("button", { name: "开始学习" }).click();
  await expect(progress).toContainText("当前：学习中");
  await page.reload();
  await expect(progress).toContainText("当前：学习中");

  await progress.getByRole("button", { name: "确认已理解" }).click();
  await expect(progress).toContainText("当前：已理解");
  await expect(progress.getByRole("button", { name: "确认已掌握" })).toHaveCount(0);

  await saveEvidenceForEveryCriterion(page);
  await expect(progress).toContainText("当前：已理解");
  await expect(progress.locator("[data-saved-evidence]")).toContainText(
    "Python 数据处理与控制流证据",
  );
  await page.reload();
  await expect(progress.locator("[data-saved-evidence]")).toContainText(
    "Python 数据处理与控制流证据",
  );
  await expect(progress).toContainText("当前：已理解");

  const masteryDeclaration = progress.getByRole("checkbox", {
    name: /主动确认自己能够独立达到全部必需掌握标准/,
  });
  const masteryButton = progress.getByRole("button", { name: "确认已掌握" });
  await expect(masteryButton).toBeDisabled();
  await masteryDeclaration.check();
  await expect(progress).toContainText("当前：已理解");
  await masteryButton.click();
  await expect(progress).toContainText("当前：已掌握");
  await expect(progress.locator("[data-mastered-at]")).toBeVisible();

  await page.reload();
  await expect(progress).toContainText("当前：已掌握");
  await expect(progress.locator("[data-saved-evidence]")).toContainText(
    "Python 数据处理与控制流证据",
  );

  await page.goto("/");
  const summary = page.locator("[data-stage-progress]");
  await expect(summary.getByText("1 / 8")).toHaveCount(3);
  await page.goto("/knowledge/");
  await expect(
    page.locator('[data-knowledge-concept-id="tooling.python-core"] [data-concept-status="mastered"]'),
  ).toHaveText("已掌握");

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("hard 前置阻止 understood，recommended 前置只提示", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-modules-files-exceptions/");
  const progress = page.locator("[data-concept-progress]");
  await progress.getByRole("button", { name: "开始学习" }).click();
  await expect(progress.getByRole("button", { name: "确认已理解" })).toBeDisabled();
  await expect(progress.locator("[data-hard-prerequisites]")).toContainText(
    "Python 核心语法",
  );
  await expect(progress).toContainText("还需要先理解：");

  await progress.getByRole("link", { name: "Python 核心语法" }).first().click();
  const prerequisiteProgress = page.locator("[data-concept-progress]");
  await expect(prerequisiteProgress.locator("[data-recommended-prerequisites]")).toContainText(
    "不会阻止确认理解",
  );
  await prerequisiteProgress.getByRole("button", { name: "开始学习" }).click();
  await prerequisiteProgress.getByRole("button", { name: "确认已理解" }).click();
  await expect(prerequisiteProgress).toContainText("当前：已理解");

  await page.goto("/knowledge/python-modules-files-exceptions/");
  await expect(progress.getByRole("button", { name: "确认已理解" })).toBeEnabled();
  await progress.getByRole("button", { name: "确认已理解" }).click();
  await expect(progress).toContainText("当前：已理解");
  expect(browserErrors).toEqual([]);
});

test("完整 mastered 状态与 Evidence 可经 Export → Reset → Import 恢复", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  const progress = page.locator("[data-concept-progress]");
  await progress.getByRole("button", { name: "开始学习" }).click();
  await progress.getByRole("button", { name: "确认已理解" }).click();
  await saveEvidenceForEveryCriterion(page);
  await progress
    .getByRole("checkbox", { name: /主动确认自己能够独立达到全部必需掌握标准/ })
    .check();
  await progress.getByRole("button", { name: "确认已掌握" }).click();

  await page.goto("/settings/data/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backupBuffer = Buffer.concat(chunks);
  const exported = JSON.parse(backupBuffer.toString("utf8")) as {
    payload: {
      conceptProgress: Record<
        string,
        { status: string; evidence: unknown[]; masteryConfirmation?: unknown }
      >;
    };
  };
  expect(exported.payload.conceptProgress["tooling.python-core"]).toMatchObject({
    status: "mastered",
    evidence: [{ title: "Python 数据处理与控制流证据" }],
    masteryConfirmation: {},
  });

  await page.getByRole("button", { name: "准备清空学习记录" }).click();
  await page.getByRole("checkbox", { name: /明确确认清空学习记录/ }).check();
  await page.getByRole("button", { name: "确认清空学习记录" }).click();
  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await page.getByLabel("选择 Learning OS JSON 备份").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await expect(page.locator("[data-import-preview]")).toContainText("1 个已掌握");
  await page
    .getByRole("checkbox", { name: /明确确认替换当前学习状态/ })
    .check();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();

  await page.reload();
  await page.goto("/knowledge/python-core/");
  await expect(progress).toContainText("当前：已掌握");
  await expect(progress.locator("[data-saved-evidence]")).toContainText(
    "Python 数据处理与控制流证据",
  );
  expect(browserErrors).toEqual([]);
});

test("Progress 全流程可通过键盘操作，回退需要明确确认", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  const progress = page.locator("[data-concept-progress]");

  const start = progress.getByRole("button", { name: "开始学习" });
  await start.focus();
  await page.keyboard.press("Enter");
  const understand = progress.getByRole("button", { name: "确认已理解" });
  await understand.focus();
  await page.keyboard.press("Enter");

  const form = progress.getByRole("form", { name: "记录一条通过证据" });
  const criteria = form.getByRole("checkbox");
  for (let index = 0; index < (await criteria.count()); index += 1) {
    await criteria.nth(index).focus();
    await page.keyboard.press("Space");
  }
  await form.getByLabel("证据标题").focus();
  await page.keyboard.type("Keyboard evidence");
  await form.getByLabel("如何检查这条证据").focus();
  await page.keyboard.type("Input output and explanation were checked.");
  const save = form.getByRole("button", { name: "保存通过证据" });
  await save.focus();
  await page.keyboard.press("Enter");

  const declaration = progress.getByRole("checkbox", {
    name: /主动确认自己能够独立达到全部必需掌握标准/,
  });
  await declaration.focus();
  await page.keyboard.press("Space");
  const master = progress.getByRole("button", { name: "确认已掌握" });
  await master.focus();
  await page.keyboard.press("Enter");
  await expect(progress).toContainText("当前：已掌握");

  const downgrade = progress.locator("[data-progress-downgrade]");
  const summary = downgrade.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  const downgradeConfirmation = downgrade.getByRole("checkbox", {
    name: /理解这会降低当前学习状态/,
  });
  await downgradeConfirmation.focus();
  await page.keyboard.press("Space");
  await downgrade.getByRole("button", { name: "撤销掌握确认" }).focus();
  await page.keyboard.press("Enter");
  await expect(progress).toContainText("当前：已理解");
  await expect(progress.locator("[data-saved-evidence]")).toContainText(
    "Keyboard evidence",
  );

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
