import AxeBuilder from "@axe-core/playwright";
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

async function fillLog(
  page: Page,
  values: {
    readonly date: string;
    readonly minutes: string;
    readonly learned: string;
    readonly blockers?: string;
    readonly completed?: string;
    readonly plan?: string;
  },
) {
  await page.getByLabel("学习日期").fill(values.date);
  await page.getByLabel("学习时长（分钟）").fill(values.minutes);
  await page.getByLabel("学习了什么").fill(values.learned);
  await page.getByLabel("遇到什么问题").fill(values.blockers ?? "");
  await page.getByLabel("完成了什么").fill(values.completed ?? "");
  await page.getByLabel("下一步准备做什么").fill(values.plan ?? "");
}

test("Study Log 可创建、排序、关联、编辑、确认删除并刷新保留", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const beforeTarget = "tooling.computer-files";

  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", beforeTarget);

  await page.goto("/study-log/");
  await fillLog(page, {
    date: localDate(yesterday),
    minutes: "30",
    learned: "昨天学习了文件路径",
    blockers: "相对路径容易混淆",
    completed: "完成路径实验",
    plan: "继续复现",
  });
  await page.getByRole("button", { name: "保存学习记录" }).click();
  await expect(page.locator("[data-study-log-message]")).toContainText(
    "学习记录已创建",
  );

  await fillLog(page, {
    date: localDate(today),
    minutes: "60",
    learned: "今天学习了 Python 核心语法",
    blockers: "异常路径还需要练习",
    completed: "完成函数练习",
    plan: "明天整理最小复现",
  });
  await page.getByRole("checkbox", { name: "Python 核心语法" }).check();
  await page
    .getByLabel("Pixel Lab：可复现的第一次图像读写实验")
    .check();
  await page.getByRole("button", { name: "保存学习记录" }).click();

  const entries = page.locator("[data-study-log-entry-id]");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText("今天学习了 Python 核心语法");
  await expect(entries.nth(1)).toContainText("昨天学习了文件路径");
  await expect(page.locator("[data-study-today-minutes]")).toHaveText("60 分钟");
  await expect(entries.first().getByRole("link", { name: "Python 核心语法" })).toHaveAttribute(
    "href",
    "/knowledge/python-core/",
  );
  await expect(
    entries.first().getByRole("link", {
      name: "Pixel Lab：可复现的第一次图像读写实验",
    }),
  ).toHaveAttribute("href", "/projects/pixel-lab/");

  await entries.first().getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("学习时长（分钟）").fill("75");
  await page.getByLabel("完成了什么").fill("完成函数练习并写出反例");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.locator("[data-study-log-message]")).toContainText(
    "学习记录已更新",
  );
  await expect(entries.first()).toContainText("用户记录时长：75 分钟");
  await expect(entries.first()).toContainText("完成函数练习并写出反例");

  await entries.nth(1).getByRole("button", { name: "删除" }).click();
  const confirmation = entries.nth(1).locator("[data-study-log-delete-confirm]");
  await expect(confirmation).toContainText("此操作只删除日志，不改变学习状态");
  await confirmation.getByRole("button", { name: "取消" }).click();
  await expect(entries).toHaveCount(2);
  await entries.nth(1).getByRole("button", { name: "删除" }).click();
  await entries
    .nth(1)
    .locator("[data-study-log-delete-confirm]")
    .getByRole("button", { name: "确认删除" })
    .click();
  await expect(entries).toHaveCount(1);

  await page.reload();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("今天学习了 Python 核心语法");
  await expect(entries.first()).toContainText("用户记录时长：75 分钟");

  await page.goto("/");
  await expect(
    page.locator('[data-dashboard-next-step="recommendation"]'),
  ).toHaveAttribute("data-next-step-target-id", beforeTarget);
  expect(browserErrors).toEqual([]);
});

test("Study Log 同一自然日允许多条记录，分钟数按用户输入求和", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  const today = localDate(new Date());
  await page.goto("/study-log/");

  await fillLog(page, {
    date: today,
    minutes: "20",
    learned: "同日第一段学习",
  });
  await page.getByRole("button", { name: "保存学习记录" }).click();
  await fillLog(page, {
    date: today,
    minutes: "35",
    learned: "同日第二段学习",
  });
  await page.getByRole("button", { name: "保存学习记录" }).click();

  const entries = page.locator("[data-study-log-entry-id]");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText("同日第二段学习");
  await expect(entries.nth(1)).toContainText("同日第一段学习");
  await expect(page.locator("[data-study-today-minutes]")).toHaveText("55 分钟");
  expect(browserErrors).toEqual([]);
});

test("Study Log 完整进入 Export → Reset → Import，且不改写 Progress/Project", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/study-log/");
  await fillLog(page, {
    date: localDate(new Date()),
    minutes: "50",
    learned: "为备份测试记录真实学习",
    completed: "完成导出恢复检查",
    plan: "复查恢复后的关联",
  });
  await page.getByLabel("计算机、文件与终端").check();
  await page
    .getByLabel("Pixel Lab：可复现的第一次图像读写实验")
    .check();
  await page.getByRole("button", { name: "保存学习记录" }).click();

  await page.goto("/settings/data/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backupBuffer = Buffer.concat(chunks);
  const backup = JSON.parse(backupBuffer.toString("utf8")) as {
    payload: {
      conceptProgress: Record<string, unknown>;
      projectProgress: Record<string, unknown>;
      studyLogs: Array<{
        learned: string;
        minutes: number;
        conceptIds: string[];
        projectIds: string[];
      }>;
    };
  };
  expect(backup.payload.conceptProgress).toEqual({});
  expect(backup.payload.projectProgress).toEqual({});
  expect(backup.payload.studyLogs).toMatchObject([
    {
      learned: "为备份测试记录真实学习",
      minutes: 50,
      conceptIds: ["tooling.computer-files"],
      projectIds: ["project.pixel-lab"],
    },
  ]);

  await page.getByRole("button", { name: "准备清空学习记录" }).click();
  await page
    .getByRole("checkbox", { name: /明确确认清空学习记录/ })
    .check();
  await page.getByRole("button", { name: "确认清空学习记录" }).click();
  await expect(page.locator("[data-data-message]")).toContainText("学习记录已清空");

  await page.goto("/study-log/");
  await expect(page.locator("[data-study-log-entry-id]")).toHaveCount(0);
  await page.goto("/settings/data/");
  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await page.getByLabel("选择 Learning OS JSON 备份").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: backupBuffer,
  });
  await expect(page.locator("[data-import-preview]")).toContainText("1 条 Study Log");
  await page
    .getByRole("checkbox", { name: /明确确认替换当前学习状态/ })
    .check();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();

  await page.goto("/study-log/");
  const restored = page.locator("[data-study-log-entry-id]");
  await expect(restored).toHaveCount(1);
  await expect(restored).toContainText("为备份测试记录真实学习");
  await expect(restored).toContainText("用户记录时长：50 分钟");
  expect(browserErrors).toEqual([]);
});

test("orphan Study Log 关联被保留、标记并可编辑", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  const timestamp = "2026-08-28T08:00:00.000Z";
  const trackGoals = Object.fromEntries(
    contentManifest.tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const defaultAdvancedMaster = contentManifest.tracks.find(
    ({ defaultGoal, kind }) =>
      kind === "advanced-branch" && defaultGoal === "master",
  );
  const envelope = {
    app: "machine-vision-learning-os",
    schemaVersion: 1,
    contentVersion: "2026.08.29",
    revision: 1,
    savedAt: timestamp,
    payload: {
      schemaVersion: 1,
      preferences: {
        focusedTrackIds: defaultAdvancedMaster ? [defaultAdvancedMaster.id] : [],
        trackGoals,
        weeklyTargetMinutes: 540,
        updatedAt: timestamp,
      },
      conceptProgress: {},
      projectProgress: {},
      stageCheckpoints: {},
      studyLogs: [
        {
          id: "study-log.orphan-e2e",
          localDate: "2026-08-28",
          minutes: 25,
          conceptIds: ["concept.removed"],
          projectIds: ["project.removed"],
          learned: "旧版本内容的历史学习记录",
          blockers: "",
          completed: "",
          tomorrowPlan: "",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    },
  };
  await page.goto("/study-log/");
  await page.evaluate(
    ({ value }) =>
      window.localStorage.setItem(
        "mv-learning-os:learning-state",
        JSON.stringify(value),
      ),
    { value: envelope },
  );
  await page.reload();
  const entry = page.locator("[data-study-log-entry-id]");
  await expect(entry).toContainText("关联实体当前不可用：concept.removed");
  await expect(entry).toContainText("关联实体当前不可用：project.removed");
  await entry.getByRole("button", { name: "编辑" }).click();
  await expect(page.getByText("concept.removed（Concept 当前不可关联）")).toBeVisible();
  await page.getByLabel("学习了什么").fill("旧版本历史记录已补充说明");
  await page.getByRole("button", { name: "保存修改" }).click();
  await page.reload();
  await expect(entry).toContainText("旧版本历史记录已补充说明");
  await expect(entry).toContainText("关联实体当前不可用：concept.removed");
  expect(browserErrors).toEqual([]);
});

test("Study Log 桌面页通过 axe 基础检查", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/study-log/");
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
