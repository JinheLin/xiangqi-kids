import { useEffect, useRef } from 'react';
import { Icon } from './Art';

export function RestartDialog({ open, onCancel, onRestart }: { open: boolean; onCancel: () => void; onRestart: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [open]);
  return <dialog ref={ref} className="restart-dialog" aria-labelledby="restart-title" onCancel={e => { e.preventDefault(); onCancel(); }}>
    <span className="restart-illustration"><Icon name="reset" size={30} /></span>
    <h2 id="restart-title">要重新开始这一局吗？</h2>
    <p>当前棋局会结束。已经获得的课程星星会保留。</p>
    <div className="button-row"><button className="btn secondary" autoFocus onClick={onCancel}>接着下</button><button className="btn primary" onClick={onRestart}>重新开局</button></div>
  </dialog>;
}
