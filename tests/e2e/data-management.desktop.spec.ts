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

test("Settings/Data 可导出、预览、取消、替换恢复并在刷新后保留", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  await page
    .locator("[data-concept-progress]")
    .getByRole("button", { name: "开始学习" })
    .click();

  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.python-core");
  await page.goto("/settings/data/");
  await expect(page.getByText("1 条").first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^machine-vision-learning-os-backup-\d{4}-\d{2}-\d{2}-v2\.json$/,
  );
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backupBuffer = Buffer.concat(chunks);
  const exported = JSON.parse(backupBuffer.toString("utf8")) as {
    app: string;
    schemaVersion: number;
    payload: { conceptProgress: Record<string, { status: string }> };
  };
  expect(exported).toMatchObject({
    app: "machine-vision-learning-os",
    schemaVersion: 2,
    payload: {
      conceptProgress: { "tooling.python-core": { status: "learning" } },
    },
  });

  await page.getByRole("button", { name: "准备清空学习记录" }).click();
  const resetButton = page.getByRole("button", { name: "确认清空学习记录" });
  await expect(resetButton).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /明确确认清空学习记录/ })
    .check();
  await resetButton.click();
  await expect(page.locator("[data-data-message]")).toContainText(
    "学习记录已清空",
  );
  await expect(page.getByText("0 条").first()).toBeVisible();

  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.computer-files");
  await page.goto("/settings/data/");

  const fileInput = page.getByLabel("选择 Learning OS JSON 备份");
  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await fileInput.setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  const preview = page.locator("[data-import-preview]");
  await expect(preview).toContainText("1 个 Concept 的学习记录");
  await expect(preview).toContainText("当前浏览器中的学习状态将被备份文件替换");

  await preview.getByRole("button", { name: "取消导入" }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.locator("[data-data-message]")).toContainText(
    "当前浏览器学习数据没有改变",
  );
  await expect(page.getByText("0 条").first()).toBeVisible();

  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await page.getByLabel("选择 Learning OS JSON 备份").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await page
    .getByRole("checkbox", { name: /明确确认替换当前学习状态/ })
    .check();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(page.locator("[data-data-message]")).toContainText(
    "替换恢复已完成",
  );
  await expect(page.getByText("1 条").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("1 条").first()).toBeVisible();
  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.python-core");
  await page.reload();
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.python-core");
  await page.goto("/knowledge/python-core/");
  await expect(page.locator("[data-concept-progress]")).toContainText(
    "当前：学习中",
  );
  expect(browserErrors).toEqual([]);
});

test("Settings/Data 支持键盘确认，且通过 axe 基础检查", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/settings/data/");

  const prepareReset = page.getByRole("button", { name: "准备清空学习记录" });
  await prepareReset.focus();
  await page.keyboard.press("Enter");
  const confirmation = page.getByRole("checkbox", {
    name: /明确确认清空学习记录/,
  });
  await confirmation.focus();
  await page.keyboard.press("Space");
  await expect(confirmation).toBeChecked();
  const confirmReset = page.getByRole("button", { name: "确认清空学习记录" });
  await confirmReset.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-data-message]")).toContainText(
    "学习记录已清空",
  );

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
