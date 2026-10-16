import { describe, expect, it, vi } from 'vitest';
import { SoundPlayer } from './audio';

function fakeAudio(state = 'running') {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state, currentTime: 0, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }),
    close: vi.fn(async () => { context.state = 'closed'; }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })),
    createOscillator: vi.fn(() => {
      const node = { frequency: param(), connect: vi.fn(), disconnect: vi.fn(), addEventListener: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(node); return node;
    }),
  };
  return { context, oscillators, factory: vi.fn(() => context as unknown as AudioContext) };
}

describe('audio lifecycle and browser permission boundaries', () => {
  it('creates no context on load or while muted, and reuses a context after a gesture', async () => {
    const audio = fakeAudio(), player = new SoundPlayer({ enabled: false, factory: audio.factory, visible: () => true });
    expect(audio.factory).not.toHaveBeenCalled();
    await player.play('correct'); expect(audio.factory).not.toHaveBeenCalled();
    player.setEnabled(true); await player.play('select'); await player.play('move');
    expect(audio.factory).toHaveBeenCalledTimes(1); expect(audio.oscillators.every(node => node.start.mock.calls.length === 1)).toBe(true);
  });
  it('muting immediately stops active and scheduled notes', async () => {
    const audio = fakeAudio(), player = new SoundPlayer({ factory: audio.factory, visible: () => true });
    await player.play('win', .2); player.setEnabled(false);
    expect(audio.oscillators.length).toBeGreaterThan(0);
    expect(audio.oscillators.every(node => node.stop.mock.calls.some(args => args.length === 0))).toBe(true);
    const count = audio.oscillators.length; await player.play('correct'); expect(audio.oscillators).toHaveLength(count);
  });
  it('cannot replay a pending resume after the user mutes', async () => {
    const audio = fakeAudio('suspended'); let release!: () => void;
    audio.context.resume.mockImplementation(() => new Promise<void>(resolve => { release = () => { audio.context.state = 'running'; resolve(); }; }));
    const player = new SoundPlayer({ factory: audio.factory, visible: () => true });
    const pending = player.play('win'); player.setEnabled(false); release(); await pending;
    expect(audio.oscillators).toHaveLength(0);
  });
  it('drops delayed autoplay requests instead of playing a backlog after unlocking', async () => {
    const audio = fakeAudio('suspended'); let time = 0;
    audio.context.resume.mockImplementation(async () => { time = 1000; audio.context.state = 'running'; });
    const player = new SoundPlayer({ factory: audio.factory, visible: () => true, now: () => time });
    await player.play('correct'); expect(audio.oscillators).toHaveLength(0);
    await player.play('select'); expect(audio.oscillators.length).toBeGreaterThan(0);
  });
  it('audio permission failures are harmless and a later gesture can retry', async () => {
    const audio = fakeAudio('suspended'); audio.context.resume.mockRejectedValueOnce(new Error('Blocked'));
    const player = new SoundPlayer({ factory: audio.factory, visible: () => true });
    await expect(player.play('select')).resolves.toBeUndefined(); expect(audio.oscillators).toHaveLength(0);
    await player.play('select'); expect(audio.oscillators.length).toBeGreaterThan(0);
  });
  it('hidden pages and unavailable audio APIs remain silent', async () => {
    const audio = fakeAudio(), hidden = new SoundPlayer({ factory: audio.factory, visible: () => false });
    await hidden.play('win'); expect(audio.factory).not.toHaveBeenCalled();
    const unsupported = new SoundPlayer({ factory: () => null, visible: () => true });
    await expect(unsupported.play('select')).resolves.toBeUndefined();
  });
  it('stopping a scene invalidates pending sounds and disposal releases the context', async () => {
    const audio = fakeAudio('suspended'); let release!: () => void;
    audio.context.resume.mockImplementation(() => new Promise<void>(resolve => { release = () => { audio.context.state = 'running'; resolve(); }; }));
    const player = new SoundPlayer({ factory: audio.factory, visible: () => true });
    const pending = player.play('win'); player.stop(); release(); await pending;
    expect(audio.oscillators).toHaveLength(0); player.dispose(); expect(audio.context.close).toHaveBeenCalledTimes(1);
  });
});
