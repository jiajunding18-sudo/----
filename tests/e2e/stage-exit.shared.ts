import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { stageReadyInput, imageStage, stageTime } from "../fixtures/stage-lifecycle";
import { createPersistedEnvelope, LEARNING_STATE_STORAGE_KEY } from "../../src/lib/storage/learning-state";

export async function auditStageExit(page: Page) {
  const state = stageReadyInput();
  // Unrelated learning cannot preempt the explicitly focused Stage 2 exit.
  state.conceptProgress["math.numerical-stability"].status = "learning";
  delete state.conceptProgress["math.numerical-stability"].masteryConfirmation;
  // A genuine v2 checkpoint: migration preserves it but never confirms it.
  const envelope = { ...createPersistedEnvelope(state, "test", 1, stageTime), schemaVersion: 2,
    payload: { ...state, schemaVersion: 2, stageCheckpoints: { [imageStage.id]: { criterionEvidence: { [imageStage.exitCriteria[0].id]: ["evidence.old-unresolved"] }, initiallyEligibleAt: "2099-01-01T00:00:00.000Z", retestedAt: "2099-01-09T00:00:00.000Z", updatedAt: stageTime } } } };
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { key: LEARNING_STATE_STORAGE_KEY, raw: JSON.stringify(envelope) });
  await page.goto("/");
  const next = page.locator('[data-dashboard-next-step="stage-exit"]');
  await expect(next).toBeVisible();
  await next.getByRole("link", { name: "查看出口证据与资格" }).focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(`[data-stage-exit="${imageStage.id}"]`);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Legacy needs-review" })).toBeVisible();
  await expect(panel).toContainText("旧时间位于未来");
  for (const c of imageStage.exitCriteria) {
    const criterion = panel.locator(`[data-stage-criterion="${c.id}"]`);
    await criterion.locator("summary").click();
    await criterion.getByLabel(/Stage 2 验证报告/).check();
    await criterion.getByLabel(/math.numerical-stability · 正式测试证据/).check();
    await criterion.getByLabel("逐项证据解释").fill("核对 uint8 溢出与 actual range、坐标解释及批处理身份 / rerun 证据，不自动复用项目完成。");
    await criterion.getByRole("button", { name: "保存证据与解释" }).click();
    await expect(criterion).toContainText("已选择 2 条证据");
    await criterion.getByLabel("我已核对证据", { exact: false }).check();
    const button = criterion.getByRole("button", { name: "确认本条标准" });
    await button.focus(); await page.keyboard.press("Enter");
    await expect(criterion).toContainText("已确认且引用有效");
  }
  await expect(panel).toContainText("当前非复测条件：已满足");
  await expect(panel).toContainText("eligibility.stage.image-computing.");
  await expect(panel).toContainText("历史完成：尚无");
  await expect(panel).toContainText("连续 168 小时");
  const beforeRefresh = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload.stageCheckpoints, LEARNING_STATE_STORAGE_KEY);
  await page.reload();
  await expect(panel).toContainText("当前非复测条件：已满足");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload.stageCheckpoints, LEARNING_STATE_STORAGE_KEY)).toEqual(beforeRefresh);
  // Simulate a source evidence status update, then hydrate the real store.
  await page.evaluate(key => {
    const envelope = JSON.parse(localStorage.getItem(key)!);
    envelope.payload.conceptProgress["math.numerical-stability"].evidence[0].result = "failed";
    localStorage.setItem(key, JSON.stringify(envelope));
  }, LEARNING_STATE_STORAGE_KEY);
  await page.reload();
  await expect(panel).toContainText("原确认已失效");
  await expect(panel).toContainText("当前非复测条件：尚未满足");
  await page.evaluate(key => {
    const envelope = JSON.parse(localStorage.getItem(key)!);
    envelope.payload.conceptProgress["math.numerical-stability"].evidence[0].result = "passed";
    localStorage.setItem(key, JSON.stringify(envelope));
  }, LEARNING_STATE_STORAGE_KEY);
  await page.reload();
  await expect(panel).toContainText("当前非复测条件：尚未满足");
  for (const c of imageStage.exitCriteria) {
    const criterion = panel.locator(`[data-stage-criterion="${c.id}"]`);
    await criterion.getByLabel("我已核对证据", { exact: false }).check();
    await criterion.getByRole("button", { name: "确认本条标准" }).click();
    await expect(criterion).toContainText("已确认且引用有效");
  }
  await expect(panel).toContainText("当前资格：有效");
  expect((await new AxeBuilder({ page }).include(`[data-stage-exit="${imageStage.id}"]`).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.locator(`[data-stage-criterion="${imageStage.exitCriteria[0].id}"]`).getByRole("button", { name: "撤销确认" }).click();
  await expect(panel).toContainText("当前非复测条件：尚未满足");
  await expect(panel).toContainText("已失效：");
  await page.reload();
  await expect(panel).toContainText("已失效：");
  await expect(panel.getByRole("heading", { name: "Legacy needs-review" })).toBeVisible();
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, LEARNING_STATE_STORAGE_KEY);
  expect(stored.schemaVersion).toBe(3);
  expect(stored.stageCheckpoints[imageStage.id].historicalCompletion).toBeUndefined();
  await page.goto("/settings/data/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  await page.getByRole("radio", { name: /替换恢复/ }).check();
  await page.getByLabel("选择 Learning OS JSON 备份").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/json", buffer: Buffer.concat(chunks) });
  await expect(page.locator("[data-import-preview]")).toBeVisible();
  await page.getByRole("checkbox", { name: /明确确认替换当前学习状态/ }).check();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(page.locator("[data-data-message]")).toContainText("替换恢复已完成");
  await page.goto(`/roadmap/#stage-exit-${imageStage.id}`);
  await expect(panel).toContainText("已失效：");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload.stageCheckpoints, LEARNING_STATE_STORAGE_KEY)).toEqual(stored.stageCheckpoints);
}
