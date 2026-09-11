import AxeBuilder from '@axe-core/playwright';
import { expect,type Page } from '@playwright/test';
import { stageReadyInput,stageCatalog,stageRef,stageTime } from '../fixtures/stage-lifecycle';
import { mutateStageCriterion } from '../../src/features/progress/stage-lifecycle';
import { createPersistedEnvelope,LEARNING_STATE_STORAGE_KEY } from '../../src/lib/storage/learning-state';

const stage2='stage.image-computing';
const due=Date.parse(stageTime)+7*86400000;
async function seed(page:Page,stageId:string,time:number) {
  let state=stageReadyInput();state.preferences.activeStageId=stageId;
  for(const c of stageCatalog.stages!.find(s=>s.id===stageId)!.exitCriteria) {
    state=mutateStageCriterion(state,stageCatalog,stageId,c.id,{kind:'evidence',evidenceRefs:[stageRef],explanation:'实际报告逐项核对'},stageTime);
    state=mutateStageCriterion(state,stageCatalog,stageId,c.id,{kind:'confirm',confirmed:true},stageTime);
  }
  await page.clock.install({time:new Date(time)});
  await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);},{key:LEARNING_STATE_STORAGE_KEY,raw:JSON.stringify(createPersistedEnvelope(state,'test',1,stageTime))});
}
async function accessible(page:Page,stageId:string) {
  expect((await new AxeBuilder({page}).include(`[data-stage-exit="${stageId}"]`).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
export async function stage2Retest(page:Page) {
  await seed(page,stage2,due-60000);await page.goto('/');
  await expect(page.locator('[data-dashboard-next-step="stage-wait"]')).toBeVisible();
  const raw=await page.evaluate(key=>localStorage.getItem(key),LEARNING_STATE_STORAGE_KEY);
  await page.clock.fastForward(60001);
  await expect(page.locator('[data-dashboard-next-step="stage-retest"]')).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),LEARNING_STATE_STORAGE_KEY)).toBe(raw);
  await page.locator('[data-dashboard-next-step="stage-retest"]').getByRole('link').focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#stage-exit-stage.image-computing/);
  const panel=page.locator(`[data-stage-exit="${stage2}"]`);
  await panel.getByRole('button',{name:'开始本次复测'}).click();
  const fields=panel.getByLabel('本次结果与解释');const statuses=panel.getByLabel('自检状态');const save=panel.getByRole('button',{name:'保存本项结果'});
  await expect(fields).toHaveCount(2);
  await fields.nth(0).fill('新图片 safe arithmetic 核对后，仍需复习');await statuses.nth(0).selectOption('needs_review');await save.nth(0).click();
  await expect(panel.getByRole('button',{name:'确认复测并完成阶段'})).toBeDisabled();
  await page.reload();await expect(fields.nth(0)).toHaveValue(/仍需复习/);
  for(let i=0;i<2;i++) {await fields.nth(i).fill(i===0?'本次新图路径、shape、actual range、通道与 uint8 安全加法均实际核对':'本次四文件 failed/skipped 身份完整，manifest 与干净目录 rerun 一致');await statuses.nth(i).selectOption('passed');await save.nth(i).click();}
  const confirm=panel.getByLabel('我已实际完成本次复测', {exact:false});await confirm.check();
  await fields.nth(0).fill('修改后尚未保存');await expect(panel.getByRole('button',{name:'确认复测并完成阶段'})).toBeDisabled();
  await save.nth(0).click();await confirm.check();await accessible(page,stage2);
  await panel.getByRole('button',{name:'确认复测并完成阶段'}).focus();await page.keyboard.press('Enter');
  await expect(panel.locator('[data-stage-history]')).toBeVisible();
  await page.reload();await expect(panel.locator('[data-stage-history]')).toBeVisible();
  await page.evaluate(key=>{const e=JSON.parse(localStorage.getItem(key)!);e.payload.projectProgress={};localStorage.setItem(key,JSON.stringify(e));},LEARNING_STATE_STORAGE_KEY);
  await page.reload();await expect(panel.locator('[data-stage-history]')).toContainText('已完成');await expect(panel).toContainText('原确认已失效');
  await accessible(page,stage2);
  await page.goto('/');await expect(page.locator('[data-dashboard-next-step="stage-retest"], [data-dashboard-next-step="stage-exit"], [data-dashboard-next-step="stage-complete"], [data-dashboard-next-step="stage-wait"]')).toHaveCount(0);
}
export async function noRetest(page:Page) {
  const id='stage.vision-math-immediate';await seed(page,id,due);await page.goto('/');
  const next=page.locator('[data-dashboard-next-step="stage-complete"]');await expect(next).toBeVisible();await next.getByRole('link').click();
  const panel=page.locator(`[data-stage-exit="${id}"]`);
  await expect(panel.locator('[data-stage-history]')).toHaveCount(0);
  await panel.getByLabel('我已核对当前出口证据',{exact:false}).check();await panel.getByRole('button',{name:'确认完成此检查点'}).focus();await page.keyboard.press('Enter');
  await expect(panel.locator('[data-stage-history]')).toContainText('无复测检查点显式完成');await page.reload();await expect(panel.locator('[data-stage-history]')).toBeVisible();await accessible(page,id);
}
export async function stage0Retest(page:Page) {
  const id='stage.tooling-foundations';await seed(page,id,due-60000);await page.goto(`/roadmap/#stage-exit-${id}`);
  const panel=page.locator(`[data-stage-exit="${id}"]`);await expect(panel.locator('[data-stage-retest="wait"]')).toBeVisible();
  await panel.getByText('复测目标预览',{exact:false}).click();await expect(panel).toContainText('20–35 分钟');
  await page.clock.setSystemTime(new Date(due+1));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(panel.locator('[data-stage-retest="due"]')).toBeVisible();await panel.getByRole('button',{name:'刷新时间'}).click();await panel.getByRole('button',{name:'开始本次复测'}).click();
  await expect(panel.getByLabel('本次结果与解释')).toHaveCount(3);await accessible(page,id);
}
