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

test("Concept 个人笔记、收藏与自评难度可保存、修改并刷新恢复", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.computer-files");

  await page.goto("/knowledge/computer-files-and-terminal/");
  const progress = page.locator("[data-concept-progress]");
  const personal = page.locator('[data-concept-personal="ready"]');
  const note = personal.getByLabel("记录你的理解、疑问或下次复习提醒");
  const favorite = personal.getByRole("button", { name: "收藏此知识点" });
  const difficulty = personal.getByLabel("对我来说有多难");

  await expect(progress).toContainText("当前：未开始");
  await note.fill("相对路径取决于当前工作目录。\n下次补一个失败案例。");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mv-learning-os:learning-state"),
    ),
  ).toBeNull();
  await expect(personal.locator("[data-personal-note-status]"))
    .toHaveAttribute("data-personal-note-status", "unsaved");
  const save = personal.getByRole("button", { name: "保存笔记" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(personal.locator("[data-personal-note-status]")).toContainText(
    "个人笔记已保存到当前浏览器",
  );

  await favorite.focus();
  await page.keyboard.press("Enter");
  await expect(
    personal.getByRole("button", { name: "取消收藏" }),
  ).toHaveAttribute("aria-pressed", "true");
  await difficulty.selectOption("4");
  await expect(difficulty).toHaveValue("4");
  await expect(personal.locator("[data-personal-property-message]")).toContainText(
    "个人难度已设为：较难",
  );
  await expect(progress).toContainText("当前：未开始");

  await page.reload();
  await expect(note).toHaveValue(
    "相对路径取决于当前工作目录。\n下次补一个失败案例。",
  );
  await expect(
    personal.getByRole("button", { name: "取消收藏" }),
  ).toHaveAttribute("data-concept-favorite", "true");
  await expect(difficulty).toHaveValue("4");
  await expect(progress).toContainText("当前：未开始");

  await note.fill("修改后的个人笔记。");
  await personal.getByRole("button", { name: "保存笔记" }).click();
  await difficulty.selectOption("2");
  await page.reload();
  await expect(note).toHaveValue("修改后的个人笔记。");
  await expect(difficulty).toHaveValue("2");

  await page.goto("/knowledge/");
  const concept = page.locator(
    '[data-knowledge-concept-id="tooling.computer-files"]',
  );
  await expect(concept.locator('[data-knowledge-favorite="true"]')).toHaveText(
    "已收藏",
  );
  await expect(
    concept.locator('[data-knowledge-user-difficulty="2"]'),
  ).toContainText("个人难度 2 · 较容易");
  await page.getByRole("button", { name: "仅看收藏" }).click();
  await expect(page.locator("[data-knowledge-concept-id]")).toHaveCount(1);
  await expect(concept).toBeVisible();

  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", "tooling.computer-files");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-reason-code", "project-gap");

  await page.goto("/knowledge/computer-files-and-terminal/");
  await personal.getByRole("button", { name: "清空笔记" }).click();
  await personal.getByRole("button", { name: "确认清空笔记" }).click();
  await expect(note).toHaveValue("");
  await personal.getByRole("button", { name: "取消收藏" }).click();
  await difficulty.selectOption("");
  await page.reload();
  await expect(note).toHaveValue("");
  await expect(
    personal.getByRole("button", { name: "收藏此知识点" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(difficulty).toHaveValue("");
  await expect(progress).toContainText("当前：未开始");

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("个人字段通过 Export、Reset 与 Import 完整恢复", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/python-core/");
  const personal = page.locator('[data-concept-personal="ready"]');
  await personal
    .getByLabel("记录你的理解、疑问或下次复习提醒")
    .fill("需要回顾函数参数和返回值。");
  await personal.getByRole("button", { name: "保存笔记" }).click();
  await personal.getByRole("button", { name: "收藏此知识点" }).click();
  await personal.getByLabel("对我来说有多难").selectOption("5");

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
        { note: string; favorite: boolean; userDifficulty?: number }
      >;
    };
  };
  expect(exported.payload.conceptProgress["tooling.python-core"])
    .toMatchObject({
      status: "not_started",
      note: "需要回顾函数参数和返回值。",
      favorite: true,
      userDifficulty: 5,
    });

  await page.getByRole("button", { name: "准备清空学习记录" }).click();
  await page
    .getByRole("checkbox", { name: /明确确认清空学习记录/ })
    .check();
  await page.getByRole("button", { name: "确认清空学习记录" }).click();

  await page.goto("/knowledge/python-core/");
  await expect(
    personal.getByLabel("记录你的理解、疑问或下次复习提醒"),
  ).toHaveValue("");
  await expect(
    personal.getByRole("button", { name: "收藏此知识点" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(personal.getByLabel("对我来说有多难")).toHaveValue("");

  await page.goto("/settings/data/");
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

  await page.goto("/knowledge/python-core/");
  await expect(
    personal.getByLabel("记录你的理解、疑问或下次复习提醒"),
  ).toHaveValue("需要回顾函数参数和返回值。");
  await expect(
    personal.getByRole("button", { name: "取消收藏" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(personal.getByLabel("对我来说有多难")).toHaveValue("5");
  await expect(page.locator("[data-concept-progress]")).toContainText(
    "当前：未开始",
  );
  expect(browserErrors).toEqual([]);
});

test("Concept 静态 HTML 在 hydration 前只显示个人数据初始化状态", async ({
  request,
}) => {
  const response = await request.get("/knowledge/computer-files-and-terminal/");
  expect(response.ok()).toBe(true);
  const html = await response.text();

  expect(html).toContain('data-concept-personal="loading"');
  expect(html).toContain("正在恢复浏览器本地个人数据");
  expect(html).not.toContain('data-concept-personal="ready"');
});
