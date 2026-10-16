import { useEffect, useState } from 'react';
import { Icon } from './Art';
import { SoundToggle } from './Sound';

/** Expands the play area without requiring fullscreen permissions or locking rotation. */
export function usePlayFocus(active = true) {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.toggle('board-focused', focused);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocused(false); };
    window.addEventListener('keydown', escape);
    return () => { document.documentElement.classList.remove('board-focused'); window.removeEventListener('keydown', escape); };
  }, [focused, active]);
  return { focused, setFocused };
}

export function PlayFocusButton({ focused, onToggle }: { focused: boolean; onToggle: () => void }) {
  return <div className="play-controls"><SoundToggle /><button className="btn secondary focus-button" aria-pressed={focused} onClick={onToggle}>
    <Icon name={focused ? 'minimize' : 'expand'} size={18} />{focused ? '退出专注' : '专心下棋'}
  </button></div>;
}
