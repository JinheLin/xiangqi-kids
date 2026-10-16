export type SoundEffect = 'select' | 'move' | 'capture' | 'correct' | 'mistake' | 'hint' | 'check' | 'win' | 'undo';
type Note = { hz: number; end?: number; at: number; length: number; gain: number; wave?: OscillatorType };
// Short original sounds, synthesized locally. No downloads or background music.
const notes: Record<SoundEffect, Note[]> = {
  select: [{ hz: 660, end: 440, at: 0, length: .065, gain: .15 }],
  move: [{ hz: 240, end: 95, at: 0, length: .095, gain: .38 }, { hz: 720, end: 260, at: 0, length: .035, gain: .08, wave: 'triangle' }],
  capture: [{ hz: 260, end: 110, at: 0, length: .085, gain: .34 }, { hz: 340, end: 140, at: .075, length: .10, gain: .28 }, { hz: 784, at: .12, length: .14, gain: .09 }],
  correct: [{ hz: 523.25, at: 0, length: .13, gain: .14 }, { hz: 659.25, at: .10, length: .15, gain: .14 }, { hz: 783.99, at: .20, length: .20, gain: .12 }],
  mistake: [{ hz: 440, end: 392, at: 0, length: .12, gain: .12 }, { hz: 349.23, at: .11, length: .15, gain: .10 }],
  hint: [{ hz: 783.99, at: 0, length: .12, gain: .11 }, { hz: 1046.5, at: .09, length: .17, gain: .09 }],
  check: [{ hz: 659.25, at: 0, length: .13, gain: .16 }, { hz: 880, at: .15, length: .19, gain: .14 }],
  win: [{ hz: 523.25, at: 0, length: .18, gain: .14 }, { hz: 659.25, at: .13, length: .18, gain: .14 }, { hz: 783.99, at: .26, length: .20, gain: .14 }, { hz: 1046.5, at: .41, length: .34, gain: .13 }, { hz: 659.25, at: .41, length: .30, gain: .07 }],
  undo: [{ hz: 523.25, at: 0, length: .10, gain: .12 }, { hz: 392, at: .09, length: .14, gain: .10 }],
};

/** Also usable with OfflineAudioContext for actual waveform validation. */
export function synthesizeEffect(context: BaseAudioContext, destination: AudioNode, effect: SoundEffect, start: number, register?: (oscillator: OscillatorNode) => void) {
  for (const note of notes[effect]) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = note.wave || 'sine';
    const at = start + note.at;
    oscillator.frequency.setValueAtTime(note.hz, at);
    if (note.end) oscillator.frequency.exponentialRampToValueAtTime(note.end, at + note.length);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(note.gain, at + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + note.length);
    envelope.gain.setValueAtTime(0, at + note.length + .005);
    oscillator.connect(envelope); envelope.connect(destination);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    register?.(oscillator);
    oscillator.start(at); oscillator.stop(at + note.length + .015);
  }
}

export function audioSupported() {
  return typeof window !== 'undefined' && !!(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}
function createContext(): AudioContext | null {
  if (!audioSupported()) return null;
  const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
  return new Constructor();
}

export class SoundPlayer {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private active = new Set<OscillatorNode>();
  private revision = 0;
  private enabled: boolean;
  private factory: () => AudioContext | null;
  private visible: () => boolean;
  private now: () => number;

  constructor(options: { enabled?: boolean; factory?: () => AudioContext | null; visible?: () => boolean; now?: () => number } = {}) {
    this.enabled = options.enabled ?? true;
    this.factory = options.factory || createContext;
    this.visible = options.visible || (() => document.visibilityState !== 'hidden');
    this.now = options.now || (() => performance.now());
  }
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.stop();
  }
  stop() {
    this.revision++;
    for (const oscillator of this.active) { try { oscillator.stop(); } catch { /* Already ended. */ } }
    this.active.clear();
  }
  async play(effect: SoundEffect, delay = 0): Promise<void> {
    if (!this.enabled || !this.visible()) return;
    const revision = this.revision, requested = this.now();
    try {
      // Called by button/board handlers: create or resume within the user gesture.
      if (!this.context || this.context.state === 'closed') {
        this.context = this.factory();
        if (!this.context) return;
        this.output = this.context.createGain();
        this.output.gain.value = .32;
        this.output.connect(this.context.destination);
      }
      const context = this.context;
      if (context.state !== 'running') await context.resume();
      // Muting, leaving the page or a blocked resume must not cause delayed sounds.
      if (!this.enabled || !this.visible() || revision !== this.revision || this.now() - requested > 350 || context.state !== 'running') return;
      if (this.active.size > 20) this.stop();
      synthesizeEffect(context, this.output!, effect, context.currentTime + .008 + Math.max(0, Math.min(delay, .3)), oscillator => {
        this.active.add(oscillator);
        oscillator.addEventListener('ended', () => this.active.delete(oscillator), { once: true });
      });
    } catch { /* Audio permissions or device failures must never interrupt a lesson. */ }
  }
  dispose() {
    this.stop();
    const context = this.context;
    this.context = null; this.output = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
