import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { lessons } from '../src/data/curriculum';
import { STORAGE_KEY } from '../src/progress';
test.use({ actionTimeout: 10_000 });
const view = (page: Page) => page.locator('.app-view:not([hidden])');
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });
async function seed(page: Page) {
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, completed: { 'hello-board': 3, 'meet-team': 3, 'meet-pieces': 3 }, sound: false, voice: false }));
  }, STORAGE_KEY);
}

test('tablet map is one screen with chapters in place and only the course list scrolling', async ({ page }, info) => {
  await seed(page); await page.goto('/#/learn');
  for (let i = 1; i <= 5; i++) await expect(view(page).getByRole('button', { name: new RegExp(`第 ${i} 章`) })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '继续我的冒险' })).toBeInViewport({ ratio: 1 });
  const chapter = view(page).getByRole('button', { name: /第 2 章/ });
  await chapter.tap(); await chapter.tap();
  await expect(chapter).toHaveAttribute('aria-expanded', 'true');
  const list = view(page).locator('.lesson-grid');
  await expect(list.getByRole('button')).toHaveCount(9);
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const position = await list.evaluate(el => el.scrollTop); expect(position).toBeGreaterThan(100);
  expect(await view(page).evaluate(el => el.scrollTop)).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await nav(page, '自由练习').tap(); await nav(page, '学习地图').tap();
  await expect(chapter).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(position);
  await view(page).getByRole('button', { name: /第 1 章/ }).tap();
  await page.screenshot({ path: info.outputPath('tablet-map.png') });
});

test('all lessons keep feedback and next-task controls reachable while the board stays still', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1120, height: 650 });
  await page.goto('/');
  await page.getByRole('button', { name: '开始第 1 课' }).tap();
  for (const lesson of lessons) {
    for (const [index, step] of lesson.steps.entries()) {
      const board = await view(page).locator('.chess-board').boundingBox();
      await expect(view(page).locator('.chess-board')).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: '给我一点提示' })).toBeInViewport({ ratio: 1 });
      await page.getByRole('button', { name: '给我一点提示' }).tap();
      await expect(view(page).locator('.hint-box')).toBeInViewport({ ratio: 1 });
      if (step.kind === 'quiz') await page.getByRole('button', { name: new RegExp(step.options[step.answer]) }).tap();
      else if (step.kind === 'identify') {
        const p = step.board.find(p => p.type === step.targetType && p.side === step.targetSide)!;
        await view(page).getByTestId(`square-${p.x}-${p.y}`).tap();
      } else {
        await view(page).getByTestId(`square-${step.from.x}-${step.from.y}`).tap();
        await view(page).getByTestId(`square-${step.to.x}-${step.to.y}`).tap();
      }
      await expect(view(page).locator('.feedback.success')).toBeInViewport({ ratio: 1 });
      expect(await view(page).locator('.chess-board').boundingBox()).toEqual(board);
      const next = page.getByRole('button', { name: index === lesson.steps.length - 1 ? '完成课程，领取星星' : '下一个小任务' });
      await expect(next).toBeInViewport({ ratio: 1 });
      expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await next.tap();
    }
    await expect(page.getByRole('heading', { name: '这一课，闯关成功！' })).toBeVisible();
    if (lesson !== lessons.at(-1)) await page.getByRole('button', { name: '学习下一课' }).tap();
  }
});

test('practice history and helper share fixed tools, restart can be cancelled through native cancellation', async ({ page }, info) => {
  await seed(page); await page.goto('/#/practice');
  await page.getByRole('button', { name: '双人同屏' }).tap();
  for (const [from, to] of [['0-6', '0-5'], ['0-3', '0-4']]) {
    await view(page).getByTestId(`square-${from}`).tap(); await view(page).getByTestId(`square-${to}`).tap();
  }
  await page.getByRole('button', { name: /^走棋记录/ }).tap();
  await expect(view(page).locator('.practice-history')).toBeInViewport({ ratio: 1 });
  await expect(view(page).locator('.move-log-list > p')).toHaveCount(2);
  for (const name of ['悔棋', '想想怎么走', '重新开始']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: '想想怎么走' }).tap();
  await expect(page.getByRole('button', { name: '练习助手' })).toHaveAttribute('aria-pressed', 'true');
  await expect(view(page).getByRole('status')).toContainText('星星');
  await page.getByRole('button', { name: '重新开始', exact: true }).tap();
  await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '接着下', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新开始', exact: true }).tap();
  await page.getByRole('button', { name: '重新开局', exact: true }).tap();
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('tablet-practice.png') });
});

test('fullscreen is a real browser mode and exiting it preserves the current position', async ({ page }) => {
  await seed(page); await page.goto('/#/practice');
  await page.getByRole('button', { name: '双人同屏' }).tap();
  await view(page).getByTestId('square-0-6').tap(); await view(page).getByTestId('square-0-5').tap();
  await page.getByRole('button', { name: '全屏使用', exact: true }).tap();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.getByRole('button', { name: '退出全屏' })).toHaveAttribute('aria-pressed', 'true');
  await nav(page, '棋子图鉴').tap(); await nav(page, '自由练习').tap();
  await page.getByRole('button', { name: '退出全屏', exact: true }).tap();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.getByText('已走 1 步', { exact: true })).toBeVisible();
  await expect(view(page).getByTestId('square-0-5')).toHaveAttribute('aria-label', /红方兵/);
});

test('refused fullscreen never blocks the course', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError'));
  });
  await page.goto('/#/lesson/hello-board');
  await page.getByRole('button', { name: '全屏使用', exact: true }).tap();
  await expect(page.getByRole('status').filter({ hasText: '暂时无法全屏' })).toBeVisible();
  await page.getByRole('button', { name: 'A 线与线的交叉点', exact: true }).tap();
  await expect(page.getByRole('button', { name: '下一个小任务' })).toBeInViewport({ ratio: 1 });
});


test('rotation reopens a chapter when portrait accordion was collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1120 });
  await page.goto('/#/learn');
  const chapter = view(page).getByRole('button', { name: /第 1 章/ });
  await chapter.tap(); await expect(chapter).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 1120, height: 800 });
  await expect(chapter).toHaveAttribute('aria-expanded', 'true');
  await expect(view(page).getByRole('button', { name: '你好，象棋！，开始学习', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await view(page).evaluate(el => el.scrollTop)).toBe(0);
});

test('unsupported fullscreen is omitted and illegal moves bring help back from the history panel', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false }));
  await page.goto('/#/practice');
  await expect(page.getByRole('button', { name: '全屏使用', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^走棋记录/ }).tap();
  await view(page).getByTestId('square-0-9').tap(); await view(page).getByTestId('square-0-5').tap();
  await expect(page.getByRole('button', { name: '练习助手' })).toHaveAttribute('aria-pressed', 'true');
  await expect(view(page).getByRole('status')).toContainText('不能跳过');
});


test('piece library keeps all seven choices, the board and the course action on one screen', async ({ page }, info) => {
  await seed(page); await page.goto('/#/pieces');
  const choices = view(page).locator('.piece-selector button');
  for (const choice of await choices.all()) {
    await expect(choice).toBeInViewport({ ratio: 1 });
    await choice.tap(); await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(view(page).locator('.chess-board')).toBeInViewport({ ratio: 1 });
    await expect(view(page).locator('.guide-detail > .btn')).toBeInViewport({ ratio: 1 });
    expect(await view(page).evaluate(el => el.scrollTop)).toBe(0);
  }
  await page.screenshot({ path: info.outputPath('tablet-library.png') });
});
