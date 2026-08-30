import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
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

test("Study Log 在 360px 下可用键盘创建、关联且无横向溢出", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/study-log/");
  const minutes = page.getByLabel("学习时长（分钟）");
  await minutes.focus();
  await page.keyboard.type("40");
  const learned = page.getByLabel("学习了什么");
  await learned.focus();
  await page.keyboard.type("360px keyboard study log");
  const concept = page.getByLabel("计算机、文件与终端");
  await concept.focus();
  await page.keyboard.press("Space");
  await expect(concept).toBeChecked();
  const project = page.getByLabel("Pixel Lab：可复现的第一次图像读写实验");
  await project.focus();
  await page.keyboard.press("Space");
  await expect(project).toBeChecked();
  const save = page.getByRole("button", { name: "保存学习记录" });
  await save.focus();
  await page.keyboard.press("Enter");

  const entry = page.locator("[data-study-log-entry-id]");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("360px keyboard study log");
  await expect(entry).toContainText("用户记录时长：40 分钟");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
