import { useCallback, useEffect, useRef, useState } from 'react';
import { GuideNarrator } from './speech';
import type { SpeechStatus } from './speech';

export function useGuideNarration(enabled: boolean, active: boolean) {
  const [status, setStatus] = useState<SpeechStatus>({ state: 'idle', message: '' });
  const [narrator] = useState(() => new GuideNarrator(setStatus));
  const settings = useRef({ enabled, active });
  settings.current = { enabled, active };
  const say = useCallback((text: string, force = false) => {
    if (settings.current.active && (settings.current.enabled || force) && document.visibilityState !== 'hidden') void narrator.speak(text);
  }, [narrator]);
  const stop = useCallback(() => narrator.stop(), [narrator]);
  useEffect(() => { if (!enabled || !active) narrator.stop(); }, [enabled, active, narrator]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') narrator.stop(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', stop); narrator.stop(); };
  }, [narrator, stop]);
  return { say, stop, status, supported: narrator.supported };
}
