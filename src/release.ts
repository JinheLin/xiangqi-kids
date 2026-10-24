declare const __APP_RELEASE__: { version: string; revision: string; updatedAt: string; development: boolean };
export const release = __APP_RELEASE__;
export const releaseDate = release.updatedAt && Number.isFinite(Date.parse(release.updatedAt))
  ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(release.updatedAt))
  : '未提供';
