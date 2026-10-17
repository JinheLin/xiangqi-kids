import { useEffect, useState } from 'react';
import { Icon } from './Art';

export function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const sync = () => { setFullscreen(!!document.fullscreenElement); setMessage(''); };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!document.fullscreenEnabled) return null;
  async function toggle() {
    setPending(true); setMessage('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { setMessage('浏览器暂时无法全屏，可以继续学习。'); }
    finally { setPending(false); }
  }
  return <div className="fullscreen-control">
    <button className="fullscreen-button" aria-pressed={fullscreen} disabled={pending} onClick={toggle}>
      <Icon name={fullscreen ? 'minimize' : 'expand'} size={19} />{fullscreen ? '退出全屏' : '全屏使用'}
    </button>
    {message && <span className="fullscreen-message" role="status">{message}</span>}
  </div>;
}
