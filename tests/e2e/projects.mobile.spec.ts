import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

test("360px 下可筛选 Project 并浏览未 ready 的 Pixel Lab", async ({ page }) => {
  await page.goto("/projects/");
  await expect(page.locator("[data-project-id]")).toHaveCount(13);
  await page.getByLabel("Status").selectOption("published");
  await expect(page.locator("[data-project-id]")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "查看正式项目内容" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Pixel Lab/ })).toBeVisible();
  await expect(page.getByText(/仍缺 7 项 hard requirement/)).toBeVisible();
  await expect(page.locator("[data-project-requirement]")).toHaveCount(8);

  await page
    .getByRole("radio", { name: /程序生成的 PGM 测试图/ })
    .check();
  await page.getByRole("checkbox", { name: /Python 与项目内 venv/ }).check();
  await page.getByRole("checkbox", { name: /opencv-python/ }).check();
  await page
    .getByLabel("第一项下一动作")
    .fill("创建项目目录并记录解释器路径");
  await page
    .getByRole("checkbox", { name: /我理解仍缺少上述 hard 前置能力/ })
    .check();
  await page
    .getByRole("button", { name: "确认带缺口开始 Project" })
    .click();
  await expect(page.getByRole("heading", { name: "当前正在执行" })).toBeVisible();
  await expect(page.locator("[data-deliverable-requirements] li")).toHaveCount(4);
  await page
    .getByLabel("交付物标题")
    .fill("Pixel Lab 移动端验收记录");
  await page.getByRole("button", { name: "记录交付物" }).click();
  const acceptanceCheckboxes = page.locator(
    "[data-acceptance-criterion] input[type=checkbox]",
  );
  for (let index = 0; index < 7; index += 1) {
    await acceptanceCheckboxes.nth(index).check();
  }
  await page
    .getByRole("checkbox", { name: /我已逐项检查正式验收标准与交付物/ })
    .check();
  await page.getByRole("button", { name: "确认完成此项目增量" }).click();
  await expect(page.getByRole("heading", { name: "该项目增量已完成" })).toBeVisible();
  await expect(page.locator("[data-project-evidence-candidates] li")).toHaveCount(8);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});
