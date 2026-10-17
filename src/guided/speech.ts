export type SpeechState = 'idle' | 'speaking' | 'unavailable' | 'error';
export interface SpeechStatus { state: SpeechState; message: string }
interface SpeechEnvironment {
  synthesis: SpeechSynthesis | null;
  utterance: ((text: string) => SpeechSynthesisUtterance) | null;
}
const nativeEnvironment = (): SpeechEnvironment => ({
  synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null,
  utterance: typeof SpeechSynthesisUtterance !== 'undefined' ? text => new SpeechSynthesisUtterance(text) : null,
});

/** One short narration at a time. Cancellation also settles any pending caller. */
export class GuideNarrator {
  private finish: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private current: SpeechSynthesisUtterance | null = null;
  readonly supported: boolean;
  constructor(private report: (status: SpeechStatus) => void, private environment = nativeEnvironment()) {
    this.supported = !!environment.synthesis && !!environment.utterance;
  }
  stop() {
    const hadCurrent = !!this.current;
    this.finish?.();
    if (hadCurrent) { try { this.environment.synthesis?.cancel(); } catch { /* Text remains available. */ } }
    this.report({ state: 'idle', message: '' });
  }
  speak(text: string): Promise<void> {
    this.stop();
    const { synthesis, utterance } = this.environment;
    if (!synthesis || !utterance) { this.report({ state: 'unavailable', message: '当前浏览器不支持语音播报，仍可阅读文字讲解。' }); return Promise.resolve(); }
    return new Promise(resolve => {
      let settled = false;
      const complete = (status: SpeechStatus = { state: 'idle', message: '' }) => {
        if (settled) return;
        settled = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null; this.current = null; this.finish = null;
        this.report(status); resolve();
      };
      this.finish = () => complete();
      try {
        const speech = utterance(text.slice(0, 500));
        speech.lang = 'zh-CN'; speech.rate = .88; speech.pitch = 1; speech.volume = 1;
        const voices = synthesis.getVoices();
        const chinese = voices.filter(voice => /^zh([_-]|$)/i.test(voice.lang));
        const chosen = chinese.find(voice => /^zh[_-]CN$/i.test(voice.lang) && voice.localService) || chinese.find(voice => /^zh[_-]CN$/i.test(voice.lang)) || chinese[0];
        if (chosen) speech.voice = chosen;
        speech.onend = () => complete();
        speech.onerror = event => complete(event.error === 'canceled' || event.error === 'interrupted' ? { state: 'idle', message: '' } : { state: 'error', message: event.error === 'language-unavailable' || event.error === 'voice-unavailable' ? '设备暂时没有可用的中文语音，请检查系统的中文文字转语音设置。可以继续阅读文字。' : '暂时无法播放语音，可以点“再听一次”重试，或继续阅读文字。' });
        this.current = speech;
        this.report({ state: 'speaking', message: '' });
        this.timer = setTimeout(() => {
          complete({ state: 'error', message: '语音播放等待过久，已暂停播报。可以继续走棋或重听。' });
          try { synthesis.cancel(); } catch { /* Do not stall a game on audio failure. */ }
        }, Math.min(22_000, Math.max(8_000, text.length * 230 + 2500)));
        synthesis.cancel(); synthesis.speak(speech);
      } catch { complete({ state: 'error', message: '暂时无法播放语音，文字讲解仍可使用。' }); }
    });
  }
}
