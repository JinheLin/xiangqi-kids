import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/progress';
import { lessons } from '../src/data/curriculum';

const screen = (page: Page) => page.locator('.app-view:not([hidden])');
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name, exact: true });
async function unlock(page: Page) {
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ version: 1, completed: { 'hello-board': 3, 'meet-team': 3, 'meet-pieces': 3 }, sound: false, voice: false }));
  }, STORAGE_KEY);
}

test('touch navigation stays anchored while only the active screen scrolls, without document reloads', async ({ page }, info) => {
  const documents: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'document') documents.push(request.url()); });
  await page.goto('/#/learn');
  const origin = await page.evaluate(() => performance.timeOrigin);
  const tablet = info.project.name.includes('landscape') || info.project.name.includes('large') || info.project.name.includes('browser-bars');
  if (tablet) await screen(page).getByRole('button', { name: /第 2 章/ }).tap();
  const scrollArea = tablet ? screen(page).locator('.lesson-grid') : screen(page);
  await scrollArea.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => scrollArea.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  for (const name of ['学习地图', '自由练习', '棋子图鉴', '我的成长']) await expect(nav(page, name)).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  const bounds = (await page.getByRole('navigation').boundingBox())!;
  if (info.project.name.includes('landscape') || info.project.name.includes('large') || info.project.name.includes('browser-bars')) {
    expect(bounds.width).toBeLessThan(110); expect(bounds.height).toBeGreaterThan(500);
  } else {
    expect(bounds.y).toBeGreaterThan(page.viewportSize()!.height - 90);
  }
  await nav(page, '自由练习').tap(); await nav(page, '棋子图鉴').tap(); await nav(page, '我的成长').tap();
  await page.goBack(); await expect(nav(page, '棋子图鉴')).toHaveAttribute('aria-current', 'page');
  await page.goForward(); await expect(nav(page, '我的成长')).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin); expect(documents).toHaveLength(1);
  await page.screenshot({ path: info.outputPath('app-navigation.png') });
});

test('map chapter, scroll position and piece choice survive switching screens', async ({ page }) => {
  await page.goto('/#/learn');
  const chapter = screen(page).getByRole('button', { name: /第 5 章/ });
  await chapter.tap(); await expect(chapter).toHaveAttribute('aria-expanded', 'true');
  const position = await screen(page).evaluate(element => element.scrollTop);
  await nav(page, '棋子图鉴').tap();
  await screen(page).getByRole('button', { name: '炮 炮', exact: true }).tap();
  await expect(screen(page).getByRole('heading', { name: '走直线，隔一子吃' })).toBeVisible();
  await nav(page, '学习地图').tap();
  await expect(chapter).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => screen(page).evaluate(element => element.scrollTop)).toBeCloseTo(position, 0);
  await nav(page, '棋子图鉴').tap();
  await expect(screen(page).getByRole('button', { name: '炮 炮', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('an unfinished lesson keeps its task, hints and selection through browser back and tab changes', async ({ page }) => {
  await unlock(page); await page.goto('/#/lesson/rook');
  const first = lessons[3].steps[0];
  if (first.kind !== 'move') throw new Error('Expected a movement lesson');
  await screen(page).getByTestId(`square-${first.from.x}-${first.from.y}`).tap();
  await screen(page).getByTestId(`square-${first.to.x}-${first.to.y}`).tap();
  await page.getByRole('button', { name: '下一个小任务' }).tap();
  await page.getByRole('button', { name: '给我一点提示' }).tap();
  const step = lessons[3].steps[1];
  if (step.kind !== 'move') throw new Error('Expected a movement task');
  await screen(page).getByTestId(`square-${step.from.x}-${step.from.y}`).tap();
  await nav(page, '棋子图鉴').tap();
  await page.goBack();
  await expect(screen(page).getByText('小任务 2', { exact: true })).toBeVisible();
  await expect(screen(page).getByTestId(`square-${step.from.x}-${step.from.y}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(screen(page).getByText('小提示 1', { exact: true })).toBeVisible();
  await nav(page, '学习地图').tap();
  await screen(page).getByRole('button', { name: /车：直线小火车，开始学习/ }).tap();
  await expect(screen(page).getByText('小任务 2', { exact: true })).toBeVisible();
});

test('practice pauses the companion off-screen and retains turn, history and undo', async ({ page }) => {
  await page.goto('/#/practice');
  await screen(page).getByTestId('square-0-6').tap(); await screen(page).getByTestId('square-0-5').tap();
  await nav(page, '棋子图鉴').tap();
  // Allow more than the companion delay to pass: a hidden board must stay paused.
  await page.waitForTimeout(800);
  expect(await page.locator('[data-view="/practice"] .board-card-top').innerText()).toContain('已走 1 步');
  await nav(page, '自由练习').tap();
  await expect(screen(page).getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '悔棋', exact: true }).tap();
  await expect(screen(page).getByText('已走 0 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '双人同屏' }).tap();
  await screen(page).getByTestId('square-0-6').tap(); await screen(page).getByTestId('square-0-5').tap();
  await nav(page, '我的成长').tap(); await nav(page, '自由练习').tap();
  await expect(screen(page).getByText('已走 1 步', { exact: true })).toBeVisible();
  await expect(screen(page).getByRole('button', { name: '双人同屏' })).toHaveClass('active');
});

test('lesson regions remain accessible within the app in both orientations', async ({ page }, info) => {
  await unlock(page); await page.goto('/#/lesson/rook');
  if (info.project.name.includes('landscape') || info.project.name.includes('large') || info.project.name.includes('browser-bars')) {
    await expect(screen(page).locator('.chess-board')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '给我一点提示' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '讲解与提示', exact: true })).toBeHidden();
    await page.screenshot({ path: info.outputPath('app-lesson.png') });
    return;
  }
  await page.getByRole('button', { name: '讲解与提示', exact: true }).tap();
  await expect(page.getByRole('button', { name: '给我一点提示' })).toBeInViewport({ ratio: 1 });
  await nav(page, '学习地图').tap(); await page.goBack();
  await page.getByRole('button', { name: '看棋盘', exact: true }).tap();
  await expect(screen(page).getByTestId('square-0-0')).toBeInViewport({ ratio: 1 });
  await expect(nav(page, '自由练习')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('app-lesson.png') });
});


test('short landscape screens scroll the quiz coach independently without moving the board', async ({ page }, info) => {
  if (info.project.name === 'mobile' || info.project.name.includes('portrait')) {
    await page.goto('/#/lesson/hello-board');
    await expect(page.getByRole('button', { name: 'A 线与线的交叉点', exact: true })).toBeInViewport({ ratio: 1 });
    return;
  }
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 650 });
  await page.goto('/#/lesson/hello-board');
  await page.getByRole('button', { name: '给我一点提示' }).tap();
  const board = await screen(page).locator('.chess-board').boundingBox();
  const coach = screen(page).locator('.coach-content');
  await coach.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await coach.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const after = await screen(page).locator('.chess-board').boundingBox();
  expect(after).toEqual(board); expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'A 线与线的交叉点', exact: true })).toBeVisible();
});
