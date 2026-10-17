import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuideNarrator } from './speech';
import type { SpeechStatus } from './speech';
function setup() {
  const statuses: SpeechStatus[] = [], utterances: SpeechSynthesisUtterance[] = [];
  const voice = { lang: 'zh-CN', name: '中文', localService: true } as SpeechSynthesisVoice;
  const synthesis = { cancel: vi.fn(), getVoices: () => [{ lang: 'en-US' }, voice], speak: vi.fn() } as unknown as SpeechSynthesis;
  const narrator = new GuideNarrator(status => statuses.push(status), { synthesis, utterance: text => { const value = { text } as SpeechSynthesisUtterance; utterances.push(value); return value; } });
  return { narrator, statuses, utterances, synthesis, voice };
}
afterEach(() => vi.useRealTimers());
describe('Chinese guide narration', () => {
  it('uses a Chinese voice and resolves only after its end event', async () => {
    const env = setup(); let settled = false;
    const pending = env.narrator.speak('先保护好自己的帅。').then(() => { settled = true; });
    expect(env.utterances[0].lang).toBe('zh-CN'); expect(env.utterances[0].voice).toBe(env.voice);
    expect(env.statuses.at(-1)?.state).toBe('speaking'); expect(settled).toBe(false);
    env.utterances[0].onend!({} as SpeechSynthesisEvent); await pending;
    expect(settled).toBe(true); expect(env.statuses.at(-1)?.state).toBe('idle');
  });
  it('cancellation settles a pending narration and late events cannot clear a newer one', async () => {
    const env = setup(); const old = env.narrator.speak('第一段'); const latest = env.narrator.speak('第二段');
    await old; env.utterances[0].onend!({} as SpeechSynthesisEvent);
    expect(env.statuses.at(-1)?.state).toBe('speaking'); env.narrator.stop(); await latest;
    expect(env.synthesis.cancel).toHaveBeenCalled(); expect(env.statuses.at(-1)?.state).toBe('idle');
  });
  it('recovers from missing Chinese language and lets the game continue', async () => {
    const env = setup(); const pending = env.narrator.speak('这一步');
    env.utterances[0].onerror!({ error: 'language-unavailable' } as SpeechSynthesisErrorEvent); await pending;
    expect(env.statuses.at(-1)).toMatchObject({ state: 'error', message: expect.stringContaining('中文语音') });
  });
  it('a stuck native service is bounded and does not hang the game', async () => {
    vi.useFakeTimers(); const env = setup(); const pending = env.narrator.speak('先看帅。');
    await vi.advanceTimersByTimeAsync(23_000); await pending;
    expect(env.statuses.at(-1)?.state).toBe('error'); expect(env.synthesis.cancel).toHaveBeenCalled();
  });
  it('handles unavailable speech and synchronous browser errors', async () => {
    const statuses: SpeechStatus[] = [];
    const unavailable = new GuideNarrator(s => statuses.push(s), { synthesis: null, utterance: null });
    expect(unavailable.supported).toBe(false); await unavailable.speak('文字讲解');
    expect(statuses.at(-1)?.state).toBe('unavailable');
    const env = setup(); vi.mocked(env.synthesis.speak).mockImplementation(() => { throw new Error('denied'); });
    await env.narrator.speak('文字讲解'); expect(env.statuses.at(-1)?.state).toBe('error');
  });
});
