import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/progress';
import { applyMove, initialBoard, validateMove } from '../src/engine/xiangqi';
import type { ComputerRequest } from '../src/engine/ai.worker';
import type { SearchResult } from '../src/engine/search';
interface Probe { sent: ComputerRequest[]; results: SearchResult[]; terminated: number }
type ProbeWindow = Window & { __aiProbe: Probe };
const view = (page: Page) => page.locator('.app-view:not([hidden])');
const level = (page: Page) => view(page).getByLabel('陪练难度', { exact: true });
const count = (page: Page, steps: number) => view(page).getByText(`已走 ${steps} 步`, { exact: true });
const square = (page: Page, point: string) => view(page).getByTestId(`square-${point}`);
async function setup(page: Page) {
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, completed: {}, voice: false, sound: false }));
    const probe: Probe = { sent: [], results: [], terminated: 0 }; (window as unknown as ProbeWindow).__aiProbe = probe;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); this.addEventListener('message', event => { if (event.data.result) probe.results.push(event.data.result); }); }
      postMessage(message: ComputerRequest) { probe.sent.push(message); super.postMessage(message); }
      terminate() { probe.terminated++; super.terminate(); }
    };
  }, STORAGE_KEY);
  await page.goto('/#/practice');
}
async function firstMove(page: Page) { await square(page, '0-6').click(); await square(page, '0-5').click(); }
const probe = (page: Page) => page.evaluate(() => (window as unknown as ProbeWindow).__aiProbe);

test('all four levels use a real search worker, produce legal replies and save the choice', async ({ page }, info) => {
  await setup(page);
  for (const id of ['starter', 'easy', 'medium', 'hard']) {
    await level(page).selectOption(id); await firstMove(page);
    await expect(count(page, 2)).toBeVisible({ timeout: 9_000 });
    const result = (await probe(page)).results.at(-1)!;
    expect(validateMove(applyMove(initialBoard(), { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }), result.move!, 'black').ok).toBe(true);
    expect((await probe(page)).sent.at(-1)!.difficulty).toBe(id);
    expect(result.depth).toBeGreaterThanOrEqual(id === 'medium' || id === 'hard' ? 3 : 1);
    await page.getByRole('button', { name: '悔棋', exact: true }).click(); await expect(count(page, 0)).toBeVisible();
  }
  if (info.project.name.includes('landscape')) {
    await expect(level(page)).toBeInViewport({ ratio: 1 });
    for (const name of ['悔棋', '想想怎么走']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath('difficulty-pad3.png') });
  }
  await page.reload(); await expect(level(page)).toHaveValue('hard');
});

test('undo, two players and restarting terminate active searches and never apply stale replies', async ({ page }) => {
  await setup(page); await level(page).selectOption('hard'); await firstMove(page);
  await expect.poll(async () => (await probe(page)).sent.length).toBe(1);
  await page.getByRole('button', { name: '悔棋', exact: true }).click();
  await expect.poll(async () => (await probe(page)).terminated).toBeGreaterThan(0);
  await expect(count(page, 0)).toBeVisible();
  await firstMove(page); await expect.poll(async () => (await probe(page)).sent.length).toBe(2);
  await page.getByRole('button', { name: '双人同屏', exact: true }).click();
  await expect(level(page)).toHaveCount(0);
  await square(page, '0-3').click(); await square(page, '0-4').click();
  await page.waitForTimeout(2100); await expect(count(page, 2)).toBeVisible();
  await expect(square(page, '0-4')).toHaveAttribute('aria-label', /黑方卒/);
  await page.getByRole('button', { name: '小棋搭子', exact: true }).click();
  await square(page, '0-5').click(); await square(page, '0-4').click();
  await expect.poll(async () => (await probe(page)).sent.length).toBe(3);
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '重新开局', exact: true }).click();
  await page.waitForTimeout(2100); await expect(count(page, 0)).toBeVisible();
});

test('switching difficulty restarts the current search; navigation and rotation preserve it safely', async ({ page }) => {
  await setup(page); await level(page).selectOption('hard'); await firstMove(page);
  await expect.poll(async () => (await probe(page)).sent.length).toBe(1);
  await level(page).selectOption('starter'); await expect(count(page, 2)).toBeVisible({ timeout: 7_000 });
  expect((await probe(page)).sent.at(-1)!.difficulty).toBe('starter');
  await page.getByRole('button', { name: '悔棋', exact: true }).click();
  await level(page).selectOption('hard');
  const sent = (await probe(page)).sent.length; await firstMove(page);
  await expect.poll(async () => (await probe(page)).sent.length).toBeGreaterThan(sent);
  await page.getByRole('navigation').getByRole('button', { name: '学习地图', exact: true }).click();
  await page.waitForTimeout(2100);
  expect(await page.locator('[data-view="/practice"] .board-card-top').innerText()).toContain('已走 1 步');
  await page.getByRole('navigation').getByRole('button', { name: '自由练习', exact: true }).click();
  const original = page.viewportSize()!; await page.setViewportSize({ width: original.height, height: original.width });
  await expect(level(page)).toHaveValue('hard'); await page.setViewportSize(original);
  await expect(count(page, 2)).toBeVisible({ timeout: 9_000 });
});

test('worker startup failure explains the fallback and still makes a legal move', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.Worker = class { constructor() { throw new Error('Worker unavailable'); } } as unknown as typeof Worker; });
  await level(page).selectOption('hard'); await firstMove(page);
  await expect(count(page, 2)).toBeVisible();
  await expect(view(page).locator('.computer-notice')).toContainText('基础陪练');
  await page.getByRole('button', { name: '悔棋', exact: true }).click(); await expect(count(page, 0)).toBeVisible();
});

test('guidance shares the saved level and keeps hints, rewards and undo with a stronger reply', async ({ page }) => {
  await setup(page); await level(page).selectOption('hard');
  await page.getByRole('navigation').getByRole('button', { name: '下指导棋', exact: true }).click();
  await expect(level(page)).toHaveValue('hard');
  await page.getByRole('group', { name: '指导棋小目标' }).getByRole('button', { name: /练习吃子/ }).click();
  await page.getByRole('button', { name: '开始指导对局' }).click();
  await page.getByRole('button', { name: '给点提示', exact: true }).click();
  await page.getByRole('button', { name: '再给一点提示', exact: true }).click(); await page.getByRole('button', { name: '再给一点提示', exact: true }).click();
  await view(page).locator('.guided-board .square:has(.target-star)').click();
  await expect(count(page, 2)).toBeVisible({ timeout: 9_000 });
  expect((await probe(page)).sent.at(-1)!.difficulty).toBe('hard');
  await page.getByRole('button', { name: '悔一步', exact: true }).click();
  await expect(count(page, 0)).toBeVisible();
  await expect(level(page)).toHaveValue('hard');
});
