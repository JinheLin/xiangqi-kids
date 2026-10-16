import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { lessons } from '../src/data/curriculum';
import type { Step } from '../src/data/curriculum';
import { STORAGE_KEY } from '../src/progress';

async function solveStep(page: Page, step: Step) {
  if (step.kind === 'quiz') await page.getByRole('button', { name: new RegExp(step.options[step.answer]) }).click();
  else if (step.kind === 'identify') {
    const p = step.board.find(p => p.type === step.targetType && p.side === step.targetSide)!;
    await page.getByTestId(`square-${p.x}-${p.y}`).click();
  } else {
    await page.getByTestId(`square-${step.from.x}-${step.from.y}`).click();
    await page.getByTestId(`square-${step.to.x}-${step.to.y}`).click();
  }
  await expect(page.getByRole('status').filter({ hasText: step.explain })).toBeVisible();
}

test('a child can complete all 22 lessons, unlock chapters, earn badges and restore progress', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '你的象棋冒险地图' })).toBeVisible();
  await expect(page.getByRole('button', { name: '认识红黑两队，待解锁' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: '开始第 1 课' }).click();
  for (const lesson of lessons) {
    await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible();
    for (let i = 0; i < lesson.steps.length; i++) {
      await solveStep(page, lesson.steps[i]);
      await page.getByRole('button', { name: i === lesson.steps.length - 1 ? '完成课程，领取星星' : '下一个小任务' }).click();
    }
    await expect(page.getByRole('heading', { name: '这一课，闯关成功！' })).toBeVisible();
    if (lesson !== lessons[lessons.length - 1]) await page.getByRole('button', { name: '学习下一课' }).click();
  }
  await page.getByRole('navigation').getByRole('button', { name: '我的成长' }).click();
  await expect(page.getByText('已完成 22 节课程，收集 66 颗星星。')).toBeVisible();
  await expect(page.getByText('已获得 · 做得真棒')).toHaveCount(5);
  await page.reload();
  await expect(page.getByText('已完成 22 节课程，收集 66 颗星星。')).toBeVisible();
  expect(errors).toEqual([]);
});

test('wrong answers explain, hints and demo do not auto-complete, rewards cannot be farmed', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, completed: { 'hello-board': 3, 'meet-team': 3, 'meet-pieces': 3 }, lastLesson: 'rook', voice: false })), STORAGE_KEY);
  await page.goto('/#/lesson/rook');
  await page.getByTestId('square-0-8').click();
  await page.getByTestId('square-1-7').click();
  await expect(page.getByRole('status').filter({ hasText: '不能斜走' })).toBeVisible();
  await page.getByRole('button', { name: '给我一点提示' }).click();
  await expect(page.getByText('找到左下方的红车。')).toBeVisible();
  await page.getByRole('button', { name: '看演示' }).click();
  await expect(page.getByRole('button', { name: '演示中…' })).toBeVisible();
  await expect(page.getByRole('button', { name: '看演示' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: '下一个小任务' })).toHaveCount(0);
  for (let i = 0; i < lessons[3].steps.length; i++) {
    await solveStep(page, lessons[3].steps[i]);
    await page.getByRole('button', { name: i === 0 ? '下一个小任务' : '完成课程，领取星星' }).click();
  }
  await expect(page.getByLabel('已收集 11 颗星星')).toBeVisible();
  await page.getByRole('button', { name: '回到学习地图', exact: true }).click();
  await page.getByRole('button', { name: /车：直线小火车，已获得2颗星/ }).click();
  for (let i = 0; i < lessons[3].steps.length; i++) {
    await solveStep(page, lessons[3].steps[i]);
    await page.getByRole('button', { name: i === 0 ? '下一个小任务' : '完成课程，领取星星' }).click();
  }
  await expect(page.getByLabel('已收集 12 颗星星')).toBeVisible();
});

test('practice supports errors, a legal companion response, undo, two players and restart', async ({ page }) => {
  await page.goto('/#/practice');
  await page.getByTestId('square-1-9').click();
  await page.getByTestId('square-1-7').click();
  // Friendly piece switches selection; choose a rook and attempt a blocked forward move.
  await page.getByTestId('square-0-9').click();
  await page.getByTestId('square-0-5').click();
  await expect(page.getByRole('status').filter({ hasText: '不能跳过' })).toBeVisible();
  await page.getByTestId('square-0-6').click();
  await page.getByTestId('square-0-5').click();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '悔棋' }).click();
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '双人同屏' }).click();
  await page.getByTestId('square-0-6').click(); await page.getByTestId('square-0-5').click();
  await expect(page.getByText('已走 1 步', { exact: true })).toBeVisible();
  await page.getByTestId('square-0-3').click(); await page.getByTestId('square-0-4').click();
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '想想怎么走' }).click();
  await expect(page.getByRole('status').filter({ hasText: '星星' })).toBeVisible();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '重新开局', exact: true }).click();
  await expect(page.getByText('已走 0 步', { exact: true })).toBeVisible();
});

test('responsive pages, accessible keyboard board and invalid storage recovery', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.goto('/');
  await expect(page.getByLabel('已收集 0 颗星星')).toBeVisible();
  for (const route of ['/learn', '/practice', '/pieces', '/progress']) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole('heading', { name: ({ '/learn': '你的象棋冒险地图', '/practice': '自由练习场', '/pieces': '棋子小图鉴', '/progress': '我的成长花园' } as Record<string, string>)[route] })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(route.slice(1) + '.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto('/#/practice');
  await expect(page.getByRole('heading', { name: '自由练习场' })).toBeVisible();
  await page.getByTestId('square-0-6').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('square-0-6')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('square-0-5')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  await page.goto('/#/lesson/stalemate');
  await expect(page.getByRole('heading', { name: '先把前面的本领学会吧' })).toBeVisible();
});

test('unavailable storage is explained and clearing progress requires a deliberate choice', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('无法保存进度');
  await page.getByRole('button', { name: '开始第 1 课' }).click();
  await expect(page.getByRole('heading', { name: '你好，象棋！', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: '我的成长' }).click();
  await page.getByRole('button', { name: '重新开始学习' }).click();
  await expect(page.getByRole('button', { name: '确定清空进度' })).toBeVisible();
  await page.getByRole('button', { name: '保留进度' }).click();
  await expect(page.getByRole('button', { name: '确定清空进度' })).toHaveCount(0);
});
