import { useEffect, useId, useRef, useState } from 'react';
import { release, releaseDate } from '../release';

export function VersionInfo() {
  const [open, setOpen] = useState(false), dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
    return () => { if (dialog.current?.open) dialog.current.close(); };
  }, [open]);
  return <><button className="app-version" aria-label="查看版本信息" title="查看当前版本和更新时间" onClick={() => setOpen(true)}>v{release.version}<span>· {release.revision}</span></button><dialog ref={dialog} className="version-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setOpen(false); }}><h2 id={titleId}>版本信息</h2><dl><div><dt>当前版本</dt><dd>v{release.version}</dd></div><div><dt>更新编号</dt><dd>{release.revision}</dd></div><div><dt>更新时间</dt><dd>{releaseDate}<small>北京时间</small></dd></div><div><dt>运行方式</dt><dd>{release.development ? '本地开发预览' : '正式版本'}</dd></div></dl><p>刷新页面后，可以对照更新编号，确认是否已加载新版本。</p><button className="btn primary" autoFocus onClick={() => setOpen(false)}>知道了</button></dialog></>;
}
