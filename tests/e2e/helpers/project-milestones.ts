import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { legacyEnvelope, milestone0, milestone2, historyTime } from "../../fixtures/project-milestones";

export function registerMilestoneAudit() {
  test("milestone deep links validate ownership, survive reload and retain scoped copy", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("mv-learning-os:learning-state", JSON.stringify(value)), legacyEnvelope());
    await page.goto(`/projects/pixel-lab/#milestone=${milestone0}`);
    const select = page.getByLabel("查看能力增量");
    await expect(select).toHaveValue(milestone0);
    await expect(page.getByRole("heading", { name: "该项目增量已完成", exact: true })).toBeVisible();
    await page.goto(`/projects/pixel-lab/#milestone=${milestone2}`);
    await expect(select).toHaveValue(milestone2);
    await page.reload();
    await expect(select).toHaveValue(milestone2);
    await expect(page.getByRole("status")).toContainText("正式验收与交付物契约尚未发布");
    await expect(page.locator("[data-project-completion]")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto("/projects/pixel-lab/#milestone=milestone.another-project.invalid");
    await expect(select).toHaveValue(milestone0);
    await expect(page.locator("[data-project-completion]")).toHaveAttribute("data-project-completion-status", "completed");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
  test("milestone migration retains Stage 0 history, Stage 2 stays planned; keyboard/axe/overflow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("mv-learning-os:learning-state", JSON.stringify(value)), legacyEnvelope());
    await page.goto("/projects/pixel-lab/");
    await expect(page.locator(`[data-milestone-id="${milestone0}"]`)).toContainText("已完成");
    await expect(page.locator(`[data-milestone-id="${milestone2}"]`)).toContainText("尚未完成");
    await expect(page.locator("[data-project-deliverable]")).toContainText("原始交付物");
    await expect(page.locator("[data-project-completion]")).toHaveAttribute("data-project-completion-status", "completed");
    const select = page.getByLabel("查看能力增量");
    await select.focus();
    await expect(select).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(select).toHaveValue(milestone2);
    await expect(page.getByRole("status")).toContainText("当前不能开始或确认完成");
    await expect(page.getByRole("button", { name: "确认完成此项目增量" })).toHaveCount(0);
    await expect(page.locator(`[data-milestone-id="${milestone0}"]`)).toContainText("已完成");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await select.selectOption(milestone0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.reload();
    await expect(page.locator("[data-project-completion]")).toHaveAttribute("data-project-completion-status", "completed");
    const raw = await page.evaluate(() => JSON.parse(localStorage.getItem("mv-learning-os:learning-state")!));
    // Read-only hydrate leaves the old primary key untouched; its recovery copy preserves bytes.
    expect(raw.payload.projectProgress["project.pixel-lab"].completedAt).toBe(historyTime);
    expect(errors).toEqual([]);
  });
}
