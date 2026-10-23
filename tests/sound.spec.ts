import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

interface Probe { contexts: number; starts: number; maxRMS: number; states: string[] }
const probe = (page: Page) => page.evaluate(() => (window as unknown as Window & { __soundProbe: Probe }).__soundProbe);
const press = (control: Locator, touch: boolean) => touch ? control.tap() : control.click();

async function observeNativeAudio(page: Page, sampleDelay = 0) {
  await page.addInitScript(sampleDelay => {
    const state: Probe = { contexts: 0, starts: 0, maxRMS: 0, states: [] };
    (window as unknown as Window & { __soundProbe: Probe }).__soundProbe = state;
    const Original = window.AudioContext;
    // Instrument the real browser graph; do not replace playback with a fake API.
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: new Proxy(Original, { construct(target, args) {
      const context = Reflect.construct(target, args) as AudioContext;
      state.contexts++; state.states.push(context.state);
      context.addEventListener('statechange', () => state.states.push(context.state));
      return context;
    } }) });
    const connect = AudioNode.prototype.connect, start = OscillatorNode.prototype.start;
    Object.defineProperty(AudioNode.prototype, 'connect', { configurable: true, value: function(this: AudioNode, ...args: unknown[]) {
      const result = Reflect.apply(connect, this, args);
      if (args[0] instanceof AudioDestinationNode) {
        // Keep ~0.7 s of real PCM so a delayed UI frame still sees short notes.
        const analyser = this.context.createAnalyser(); analyser.fftSize = 32768;
        Reflect.apply(connect, this, [analyser]);
        const samples = new Float32Array(analyser.fftSize);
        const measure = () => {
          analyser.getFloatTimeDomainData(samples);
          state.maxRMS = Math.max(state.maxRMS, Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length));
          requestAnimationFrame(measure);
        };
        setTimeout(() => requestAnimationFrame(measure), sampleDelay);
      }
      return result;
    } });
    Object.defineProperty(OscillatorNode.prototype, 'start', { configurable: true, value: function(this: OscillatorNode, ...args: unknown[]) {
      state.starts++; return Reflect.apply(start, this, args);
    } });
  }, sampleDelay);
}

test('answers produce real audio after a gesture, and muting prevents all later sounds', async ({ page, isMobile }) => {
  await observeNativeAudio(page); await page.goto('/');
  await expect(page.getByRole('button', { name: '关闭音效', exact: true })).toBeVisible();
  expect((await probe(page)).contexts).toBe(0);
  await press(page.getByRole('button', { name: '开始第 1 课' }), isMobile);
  await press(page.getByRole('button', { name: 'B 小方格的正中间' }), isMobile);
  await expect.poll(async () => (await probe(page)).maxRMS).toBeGreaterThan(.0005);
  expect((await probe(page)).states).toContain('running');
  const before = (await probe(page)).starts;
  await press(page.getByRole('button', { name: 'A 线与线的交叉点' }), isMobile);
  await expect.poll(async () => (await probe(page)).starts).toBeGreaterThan(before);
  await press(page.getByRole('button', { name: '关闭音效', exact: true }), isMobile);
  const muted = (await probe(page)).starts;
  await press(page.getByRole('button', { name: '下一个小任务' }), isMobile);
  await press(page.getByRole('button', { name: 'B 两边：红方和黑方' }), isMobile);
  await expect(page.getByRole('status').filter({ hasText: '楚河汉界把棋盘分成两边' })).toBeVisible();
  expect((await probe(page)).starts).toBe(muted);
  await expect(page.getByRole('button', { name: '开启语音讲解', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('selection, moves, captures and undo all generate audio in free practice', async ({ page, isMobile }) => {
  await observeNativeAudio(page); await page.goto('/#/practice');
  await press(page.getByRole('button', { name: '双人同屏' }), isMobile);
  for (const [from, to, step] of [['0-6', '0-5', 1], ['0-3', '0-4', 2], ['0-5', '0-4', 3]] as const) {
    const before = (await probe(page)).starts;
    await press(page.locator('.app-view:not([hidden])').getByTestId(`square-${from}`), isMobile);
    await expect.poll(async () => (await probe(page)).starts).toBeGreaterThan(before);
    const selected = (await probe(page)).starts;
    await press(page.locator('.app-view:not([hidden])').getByTestId(`square-${to}`), isMobile);
    await expect(page.getByText(`已走 ${step} 步`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await probe(page)).starts).toBeGreaterThan(selected);
  }
  await expect(page.locator('.app-view:not([hidden])').getByTestId('square-0-4')).toHaveAttribute('aria-label', /红方兵/);
  const before = (await probe(page)).starts;
  await press(page.getByRole('button', { name: '悔棋', exact: true }), isMobile);
  await expect.poll(async () => (await probe(page)).starts).toBeGreaterThan(before);
  expect((await probe(page)).contexts).toBe(1);
});

test('the sound switch remains available in focus mode and survives refresh independently of speech', async ({ page, isMobile }) => {
  // A busy renderer can miss a whole 65 ms selection sound between frames.
  await observeNativeAudio(page, 220); await page.goto('/#/practice');
  await press(page.getByRole('button', { name: '专心下棋', exact: true }), isMobile);
  await press(page.getByRole('button', { name: '关闭音效', exact: true }), isMobile);
  await press(page.locator('.app-view:not([hidden])').getByTestId('square-0-6'), isMobile); await press(page.locator('.app-view:not([hidden])').getByTestId('square-0-5'), isMobile);
  await expect(page.getByText('已走 2 步', { exact: true })).toBeVisible();
  expect((await probe(page)).contexts).toBe(0);
  await press(page.getByRole('button', { name: '开启音效', exact: true }), isMobile);
  await expect.poll(async () => (await probe(page)).maxRMS).toBeGreaterThan(.0005);
  await press(page.getByRole('button', { name: '关闭音效', exact: true }), isMobile);
  await press(page.getByRole('button', { name: '退出专注', exact: true }), isMobile);
  await page.reload();
  await expect(page.getByRole('button', { name: '开启音效', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '开启语音讲解', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect((await probe(page)).contexts).toBe(0);
});

test('lessons still work when browser audio is unavailable', async ({ page, isMobile }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.goto('/#/lesson/hello-board');
  await expect(page.getByRole('button', { name: '当前浏览器不支持音效', exact: true })).toBeDisabled();
  await press(page.getByRole('button', { name: 'A 线与线的交叉点' }), isMobile);
  await expect(page.getByRole('button', { name: '下一个小任务' })).toBeVisible(); expect(errors).toEqual([]);
});

test('all nine effects have actual non-clipping waveforms that fade to silence', async ({ page }, info) => {
  await page.goto('/');
  const result = await page.evaluate(async (demo: boolean) => {
    const path = '/src/audio.ts';
    const { synthesizeEffect } = await import(path);
    const effects = ['select', 'move', 'capture', 'correct', 'mistake', 'hint', 'check', 'win', 'undo'];
    const measures: { effect: string; peak: number; rms: number; tail: number }[] = [];
    for (const effect of effects) {
      const context = new OfflineAudioContext(1, 22050, 22050), master = context.createGain();
      master.gain.value = .32; master.connect(context.destination); synthesizeEffect(context, master, effect, .02);
      const data = (await context.startRendering()).getChannelData(0);
      measures.push({ effect, peak: Math.max(...data.map(Math.abs)), rms: Math.sqrt(data.reduce((sum, n) => sum + n * n, 0) / data.length), tail: Math.max(...data.slice(-200).map(Math.abs)) });
    }
    if (!demo) return { measures, wav: [] as number[] };
    const context = new OfflineAudioContext(1, 22050 * 9, 22050), master = context.createGain();
    master.gain.value = .32; master.connect(context.destination);
    effects.forEach((effect, index) => synthesizeEffect(context, master, effect, .15 + index * .95));
    const data = (await context.startRendering()).getChannelData(0);
    const file = new ArrayBuffer(44 + data.length * 2), view = new DataView(file);
    const tag = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
    tag(0, 'RIFF'); view.setUint32(4, 36 + data.length * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 22050, true);
    view.setUint32(28, 44100, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, data.length * 2, true);
    data.forEach((n, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, n)) * 32767), true));
    return { measures, wav: Array.from(new Uint8Array(file)) };
  }, info.project.name === 'desktop');
  for (const measure of result.measures) {
    expect(measure.rms, measure.effect).toBeGreaterThan(.0005); expect(measure.peak, measure.effect).toBeLessThan(.5); expect(measure.tail, measure.effect).toBe(0);
  }
  if (result.wav.length) await writeFile(info.outputPath('xiangqi-sound-demo.wav'), new Uint8Array(result.wav));
});
