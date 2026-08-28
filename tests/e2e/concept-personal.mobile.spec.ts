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

test("360px 下个人学习记录可用键盘操作且无横向溢出", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/knowledge/computer-files-and-terminal/");
  const personal = page.locator('[data-concept-personal="ready"]');
  const note = personal.getByLabel("记录你的理解、疑问或下次复习提醒");
  await note.focus();
  await page.keyboard.type("360px keyboard note");
  const save = personal.getByRole("button", { name: "保存笔记" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(personal.locator("[data-personal-note-status]")).toContainText(
    "个人笔记已保存",
  );

  const favorite = personal.getByRole("button", { name: "收藏此知识点" });
  await favorite.focus();
  await page.keyboard.press("Enter");
  await expect(
    personal.getByRole("button", { name: "取消收藏" }),
  ).toHaveAttribute("aria-pressed", "true");
  await personal.getByLabel("对我来说有多难").selectOption("3");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});
