import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/progress';
const view = (page: Page) => page.locator('.app-view:not([hidden])');
const square = (page: Page, id: string) => view(page).locator('.guided-board').getByTestId(`square-${id}`);
async function enter(page: Page, goal = '练习吃子') {
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, completed: {}, voice: false, sound: false }));
  }, STORAGE_KEY);
  await page.goto('/#/guided');
  await page.getByRole('group', { name: '指导棋小目标' }).getByRole('button', { name: new RegExp(goal) }).click();
}
async function start(page: Page, goal = '练习吃子') { await enter(page, goal); await page.getByRole('button', { name: '开始指导对局' }).click(); }
interface SpeechProbe { texts: string[]; langs: string[]; cancelled: number; pending: boolean }
interface SpeechWindow extends Window { __guideSpeech: SpeechProbe; __finishGuideSpeech: () => void }
async function fakeSpeech(page: Page, mode: 'hold' | 'error' = 'hold') {
  await page.addInitScript(mode => {
    const probe: SpeechProbe = { texts: [], langs: [], cancelled: 0, pending: false };
    const w = window as unknown as SpeechWindow;
    w.__guideSpeech = probe;
    let current: SpeechSynthesisUtterance | null = null;
    w.__finishGuideSpeech = () => { const value = current; current = null; probe.pending = false; value?.onend?.({} as SpeechSynthesisEvent); };
    const synthesis = {
      getVoices: () => [{ name: '中文', lang: 'zh-CN', localService: true }],
      cancel: () => { if (current) { probe.cancelled++; current = null; probe.pending = false; } },
      speak: (value: SpeechSynthesisUtterance) => {
        current = value; probe.texts.push(value.text); probe.langs.push(value.lang); probe.pending = true;
        if (mode === 'error') setTimeout(() => { if (current !== value) return; current = null; probe.pending = false; value.onerror?.({ error: 'language-unavailable' } as SpeechSynthesisErrorEvent); }, 10);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { text: string; constructor(text: string) { this.text = text; } } });
  }, mode);
}
const speech = (page: Page) => page.evaluate(() => (window as unknown as SpeechWindow).__guideSpeech);

test('risky legal moves wait for a choice, can be tried, reviewed and replayed for a badge', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await square(page, '0-8').click(); await square(page, '0-6').click();
  await expect(view(page).getByRole('alert')).toContainText('可以吃到你的车');
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '再想想', exact: true }).click();
  await expect(square(page, '0-8')).toHaveAttribute('aria-pressed', 'true');
  await square(page, '0-6').click();
  await page.getByRole('button', { name: '就这样走', exact: true }).click();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await expect(view(page).getByRole('status').filter({ hasText: '吃到了你的车' })).toBeVisible();
  await expect(square(page, '0-6')).toHaveAttribute('aria-label', /黑方卒/);
  await page.getByRole('button', { name: '结束并复盘' }).click();
  await expect(page.getByRole('heading', { name: '这盘棋的小复盘' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '一个可以再试试的地方' })).toBeVisible();
  await page.getByRole('button', { name: '回到这里试一试' }).click();
  await expect(square(page, '0-8')).toHaveAttribute('aria-label', /红方车/);
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await square(page, '0-8').click(); await square(page, '0-5').click();
  await expect(view(page).getByText('小目标完成！', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '结束并复盘' }).click();
  await expect(page.getByRole('heading', { name: '练习吃子 · 本领徽章已获得' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/board-focused/);
  await expect(page.getByRole('navigation')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({ path: info.outputPath('guided-review.png') });
  await page.getByRole('navigation').getByRole('button', { name: '我的成长', exact: true }).click();
  await expect(page.getByText('练习吃子 · 已获得', { exact: true })).toBeVisible();
  await expect(page.getByLabel('已收集 0 颗星星')).toBeVisible();
  await page.reload(); await expect(page.getByText('练习吃子 · 已获得', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('hints progress from observation to piece to destination and never play a move', async ({ page }, info) => {
  await start(page);
  await page.getByRole('button', { name: '给点提示', exact: true }).click();
  await expect(view(page).locator('.guided-board .highlighted')).toHaveCount(0);
  await page.getByRole('button', { name: '再给一点提示', exact: true }).click();
  await expect(view(page).locator('.guided-board .highlighted')).toHaveCount(1);
  await page.getByRole('button', { name: '再给一点提示', exact: true }).click();
  await expect(page.getByRole('button', { name: '提示已展开' })).toBeDisabled();
  await expect(view(page).locator('.guided-board .square.selected')).toHaveCount(1);
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  if (info.project.name.includes('landscape')) {
    for (const name of ['提示已展开', '为什么', '悔一步']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
    await expect(view(page).locator('.guided-board .chess-board')).toBeInViewport({ ratio: 1 });
  }
  await page.screenshot({ path: info.outputPath('guided-hints.png') });
  await view(page).locator('.guided-board .square:has(.target-star)').click();
  await expect(page.getByText('小目标完成！', { exact: true })).toBeVisible();
});

test('check must be resolved legally, and the escape goal can be learned with hints', async ({ page }) => {
  await start(page, '练习应将');
  await square(page, '0-8').click(); await square(page, '0-7').click();
  await expect(view(page).getByRole('status').filter({ hasText: '还没解除将军' })).toBeVisible();
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '给点提示', exact: true }).click();
  await page.getByRole('button', { name: '再给一点提示', exact: true }).click(); await page.getByRole('button', { name: '再给一点提示', exact: true }).click();
  await view(page).locator('.guided-board .square:has(.target-star)').click();
  await expect(page.getByText('小目标完成！', { exact: true })).toBeVisible();
  await expect(view(page).getByRole('status').filter({ hasText: '解除了将军' })).toBeVisible();
  await page.getByRole('button', { name: '悔一步', exact: true }).click();
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await expect(page.getByText('将军！先保护帅', { exact: true })).toBeVisible();
});

test('Chinese narration finishes the child commentary before the reply, supports replay, mute and scene cancellation', async ({ page }) => {
  await fakeSpeech(page); await enter(page);
  await page.getByRole('button', { name: '开启语音播报', exact: true }).click();
  await expect.poll(async () => (await speech(page)).texts.length).toBe(1);
  await page.getByRole('button', { name: '开始指导对局' }).click();
  await page.evaluate(() => (window as unknown as SpeechWindow).__finishGuideSpeech());
  await square(page, '0-8').click(); await square(page, '0-5').click();
  await expect.poll(async () => (await speech(page)).texts.at(-1)).toContain('吃到了黑方卒');
  await page.waitForTimeout(1100);
  await expect(page.getByText('已走 1 步', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as SpeechWindow).__finishGuideSpeech());
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  expect((await speech(page)).langs.every(lang => lang === 'zh-CN')).toBe(true);
  const before = (await speech(page)).texts.length;
  await page.getByRole('button', { name: '再听一次', exact: true }).click();
  await expect.poll(async () => (await speech(page)).texts.length).toBe(before + 1);
  const cancelled = (await speech(page)).cancelled;
  await page.getByRole('navigation').getByRole('button', { name: '学习地图', exact: true }).click();
  await expect.poll(async () => (await speech(page)).cancelled).toBeGreaterThan(cancelled);
  await page.getByRole('navigation').getByRole('button', { name: '下指导棋', exact: true }).click();
  await page.getByRole('button', { name: '关闭语音播报', exact: true }).click();
  await expect(page.getByRole('button', { name: '开启语音讲解', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const muted = (await speech(page)).texts.length;
  await page.getByRole('button', { name: '为什么', exact: true }).click(); expect((await speech(page)).texts.length).toBe(muted);
  await page.reload(); await expect(page.getByRole('button', { name: '开启语音播报', exact: true })).toBeVisible();
});

test('a missing Chinese voice is explained and never stalls the companion', async ({ page }) => {
  await fakeSpeech(page, 'error'); await enter(page);
  await page.getByRole('button', { name: '开启语音播报', exact: true }).click();
  await expect(view(page).getByRole('status')).toContainText('中文语音');
  await page.getByRole('button', { name: '开始指导对局' }).click();
  await square(page, '0-8').click(); await square(page, '0-5').click();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await expect(view(page).locator('.speech-status')).toContainText('中文语音');
});

test('unavailable speech leaves text, selection and legal play working', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true }));
  await start(page);
  await expect(page.getByRole('button', { name: '浏览器不支持语音' })).toBeDisabled();
  await square(page, '0-8').click(); await square(page, '0-5').click();
  await expect(page.getByText('小目标完成！', { exact: true })).toBeVisible();
});

test('rotation, focus, tab navigation and clearing progress do not corrupt a guided session', async ({ page }, info) => {
  await start(page);
  await page.getByRole('button', { name: '专心下棋', exact: true }).click();
  await square(page, '0-8').click();
  if (info.project.name !== 'desktop') {
    const original = page.viewportSize()!; await page.setViewportSize({ width: original.height, height: original.width });
    await expect(square(page, '0-8')).toHaveAttribute('aria-pressed', 'true'); await page.setViewportSize(original);
  }
  await page.getByRole('button', { name: '退出专注', exact: true }).click();
  await square(page, '0-5').click();
  await page.getByRole('navigation').getByRole('button', { name: '棋子图鉴', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '下指导棋', exact: true }).click();
  await expect(page.getByText('小目标完成！', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: '我的成长', exact: true }).click();
  await page.getByRole('button', { name: '重新开始学习', exact: true }).click();
  await page.getByRole('button', { name: '确定清空进度', exact: true }).click();
  await expect(page.getByText('练习吃子 · 已获得', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: '下指导棋', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始指导对局' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: '我的成长', exact: true }).click();
  await expect(page.getByText('练习吃子 · 已获得', { exact: true })).toHaveCount(0);
});

test('native speech receives actual Chinese utterances and can be cancelled', async ({ page }) => {
  await page.addInitScript(() => {
    const captured: { text: string; lang: string }[] = [];
    (window as unknown as Window & { __nativeUtterances: typeof captured }).__nativeUtterances = captured;
    const original = window.speechSynthesis.speak;
    window.speechSynthesis.speak = function(utterance: SpeechSynthesisUtterance) { captured.push({ text: utterance.text, lang: utterance.lang }); return original.call(this, utterance); };
  });
  await enter(page);
  await page.getByRole('button', { name: '开启语音播报', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __nativeUtterances: { text: string; lang: string }[] }).__nativeUtterances.length)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as Window & { __nativeUtterances: { text: string; lang: string }[] }).__nativeUtterances[0])).toMatchObject({ text: expect.stringContaining('练习吃子'), lang: 'zh-CN' });
  await page.getByRole('button', { name: '关闭语音播报', exact: true }).click();
  await expect(page.getByRole('button', { name: '开启语音播报', exact: true })).toBeVisible();
});


test('leaving the guide during the reply delay pauses it until returning', async ({ page }) => {
  await start(page);
  await square(page, '0-8').click(); await square(page, '0-5').click();
  await page.getByRole('navigation').getByRole('button', { name: '学习地图', exact: true }).click();
  await page.waitForTimeout(1100);
  expect(await page.locator('[data-view="/guided"] .board-card-top').innerText()).toContain('已走 1 步');
  await page.getByRole('navigation').getByRole('button', { name: '下指导棋', exact: true }).click();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await expect(view(page).locator('.guide-previous-choice')).toContainText('吃到了黑方卒');
});
