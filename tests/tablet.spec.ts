import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { lessons } from '../src/data/curriculum';
import type { Step } from '../src/data/curriculum';
import { STORAGE_KEY } from '../src/progress';

async function unlockMovementLessons(page: Page) {
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, completed: { 'hello-board': 3, 'meet-team': 3, 'meet-pieces': 3 }, voice: false }));
  }, STORAGE_KEY);
}

async function tapStep(page: Page, step: Step) {
  if (step.kind === 'quiz') await page.getByRole('button', { name: new RegExp(step.options[step.answer]) }).tap();
  else if (step.kind === 'identify') {
    const p = step.board.find(p => p.side === step.targetSide && p.type === step.targetType)!;
    await page.locator('.app-view:not([hidden])').getByTestId(`square-${p.x}-${p.y}`).tap();
  } else {
    await page.locator('.app-view:not([hidden])').getByTestId(`square-${step.from.x}-${step.from.y}`).tap();
    await page.locator('.app-view:not([hidden])').getByTestId(`square-${step.to.x}-${step.to.y}`).tap();
  }
}

test('landscape board and teaching controls fit, with finger-sized intersections', async ({ page }, info) => {
  await unlockMovementLessons(page);
  await page.goto('/#/lesson/rook');
  await expect(page.getByRole('heading', { name: '车：直线小火车', exact: true })).toBeVisible();
  const cell = await page.locator('.app-view:not([hidden])').getByTestId('square-0-9').boundingBox();
  expect(cell!.width).toBeGreaterThanOrEqual(48); expect(cell!.height).toBeGreaterThanOrEqual(48);
  for (const name of ['给我一点提示', '看演示']) {
    const button = page.getByRole('button', { name, exact: true });
    const bounds = await button.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(48);
    if (!info.project.name.includes('portrait')) await expect(button).toBeInViewport({ ratio: 1 });
  }
  if (!info.project.name.includes('portrait')) await expect(page.locator('.chess-board')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('lesson.png'), fullPage: false });
});

test('finger taps select, cancel, explain an illegal move and complete the whole course', async ({ page }) => {
  await unlockMovementLessons(page); await page.goto('/#/lesson/rook');
  await page.getByRole('button', { name: '专心下棋' }).tap();
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-8').tap();
  await expect(page.getByText('已选红方车', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消选择' }).tap();
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-8')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-8').tap(); await page.locator('.app-view:not([hidden])').getByTestId('square-1-7').tap();
  await expect(page.getByRole('status').filter({ hasText: '不能斜走' })).toBeVisible();
  // A failed tap must not clear the chosen piece; the child can correct the destination.
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-4').tap();
  await page.getByRole('button', { name: '下一个小任务' }).tap();
  await tapStep(page, lessons[3].steps[1]);
  await page.getByRole('button', { name: '完成课程，领取星星' }).tap();
  await expect(page.getByRole('heading', { name: '这一课，闯关成功！' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/board-focused/);
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('已收集 11 颗星星')).toBeVisible();
});

test('focus and rotation preserve the board, turn, selected piece and undo history', async ({ page }, info) => {
  await page.goto('/#/practice');
  const cell = await page.locator('.app-view:not([hidden])').getByTestId('square-0-9').boundingBox();
  expect(cell!.width).toBeGreaterThanOrEqual(48);
  await page.getByRole('button', { name: '双人同屏' }).tap();
  await page.getByRole('button', { name: '专心下棋' }).tap();
  await expect(page.getByRole('button', { name: '退出专注' })).toBeInViewport();
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').tap(); await page.locator('.app-view:not([hidden])').getByTestId('square-0-5').tap();
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-3').tap(); await page.locator('.app-view:not([hidden])').getByTestId('square-0-4').tap();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-5').tap();
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: original.height, height: original.width });
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-5')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.setViewportSize(original);
  await page.getByRole('button', { name: '悔棋', exact: true }).tap();
  await expect(page.getByText('已走 1 步', { exact: true })).toBeVisible();
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-3')).toHaveAttribute('aria-label', /黑方卒/);
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-4')).toHaveAttribute('aria-label', /空位/);
  await page.getByRole('button', { name: '退出专注' }).tap();
  await expect(page.getByRole('navigation')).toBeVisible();
  if (!info.project.name.includes('portrait') && !info.project.name.includes('browser-bars')) await expect(page.locator('.chess-board')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('practice.png'), fullPage: false });
});

test('swiping over pieces scrolls the screen without selecting or moving one', async ({ page }) => {
  await page.goto('/#/practice');
  await page.getByRole('button', { name: '双人同屏' }).tap();
  // Make the board scrollable even in the spacious landscape viewport.
  await page.setViewportSize({ width: 800, height: 720 });
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').scrollIntoViewIfNeeded();
  const pawn = (await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').boundingBox())!;
  const x = pawn.x + pawn.width / 2, y = pawn.y + pawn.height / 2;
  const session = await page.context().newCDPSession(page);
  const screen = page.locator('.app-view:not([hidden])');
  const before = await screen.evaluate(element => element.scrollTop);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let delta = 10; delta <= 180; delta += 10) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - delta }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => screen.evaluate(element => element.scrollTop)).toBeGreaterThan(before + 50);
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消选择' })).toHaveCount(0);
  // A normal tap after a cancelled gesture must work immediately.
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').tap();
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-6')).toHaveAttribute('aria-pressed', 'true');
  await session.detach();
});

test('all navigation pages fit tablet width and primary controls are easy to tap', async ({ page }) => {
  for (const [route, title] of [['/learn', '你的象棋冒险地图'], ['/pieces', '棋子小图鉴'], ['/progress', '我的成长花园']]) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.getByRole('navigation').getByRole('button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
  }
});

test('resting a finger or touching with two fingers never plays a move', async ({ page }) => {
  await page.goto('/#/practice');
  await page.getByRole('button', { name: '双人同屏' }).tap();
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').scrollIntoViewIfNeeded();
  const bounds = (await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').boundingBox())!;
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  // Real elapsed time matters here: this is a resting finger, not a tap.
  await page.waitForTimeout(720);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-6')).toHaveAttribute('aria-pressed', 'false');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x, y }, { id: 1, x: x + 60, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-6')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await page.locator('.app-view:not([hidden])').getByTestId('square-0-6').tap(); await page.locator('.app-view:not([hidden])').getByTestId('square-0-5').tap();
  await expect(page.getByText('已走 1 步', { exact: true })).toBeVisible();
  await session.detach();
});
