import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { audioSupported, SoundPlayer } from '../audio';
import type { SoundEffect } from '../audio';
import { Icon } from './Art';

interface SoundControls { enabled: boolean; supported: boolean; play: (effect: SoundEffect, delay?: number) => void; toggle: () => void }
const SoundContext = createContext<SoundControls>({ enabled: false, supported: false, play: () => {}, toggle: () => {} });
export const useSound = () => useContext(SoundContext);

export function SoundProvider({ enabled, onEnabledChange, children }: { enabled: boolean; onEnabledChange: (enabled: boolean) => void; children: ReactNode }) {
  const [player] = useState(() => new SoundPlayer({ enabled }));
  useEffect(() => { player.setEnabled(enabled); }, [enabled, player]);
  useEffect(() => {
    const stop = () => player.stop();
    const visibility = () => { if (document.visibilityState === 'hidden') stop(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('hashchange', stop);
    window.addEventListener('pagehide', stop);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('hashchange', stop); window.removeEventListener('pagehide', stop); player.dispose(); };
  }, [player]);
  const play = useCallback((effect: SoundEffect, delay?: number) => { void player.play(effect, delay); }, [player]);
  const toggle = useCallback(() => {
    player.setEnabled(!enabled); onEnabledChange(!enabled);
    if (!enabled) void player.play('select');
  }, [enabled, onEnabledChange, player]);
  const value = useMemo(() => ({ enabled, supported: audioSupported(), play, toggle }), [enabled, play, toggle]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function SoundToggle() {
  const { enabled, supported, toggle } = useSound();
  const label = !supported ? '当前浏览器不支持音效' : enabled ? '关闭音效' : '开启音效';
  return <button className={`sound-toggle ${enabled ? 'on' : ''}`} aria-label={label} title={label} aria-pressed={enabled} disabled={!supported} onClick={toggle}><Icon name={enabled ? 'music' : 'music-off'} size={19} /><span>音效</span><small>{enabled ? '开' : '关'}</small></button>;
}
