import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the visible release badge opens details without changing the game and fits a narrow phone', async ({ page }, info) => {
  await page.goto('/#/practice');
  const badge = page.getByRole('button', { name: '查看版本信息', exact: true });
  await expect(badge).toContainText(`v${version}`);
  await expect(badge).toContainText(/· [a-f0-9]{7}|· local/);
  await expect(badge).toBeInViewport({ ratio: 1 });
  const square = page.locator('.app-view:not([hidden])').getByTestId('square-0-6');
  await square.click();
  await badge.click();
  const dialog = page.getByRole('dialog', { name: '版本信息' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(`v${version}`, { exact: true })).toBeVisible();
  await expect(dialog).toContainText('北京时间');
  await expect(dialog).toContainText('本地开发预览');
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(square).toHaveAttribute('aria-pressed', 'true');
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 780 });
    await expect(badge).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '关闭音效', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '开启语音讲解', exact: true })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
  await page.screenshot({ path: info.outputPath('release-badge.png') });
});
