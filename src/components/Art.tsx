import type { CSSProperties } from 'react';

export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    back: <><path d="M19 12H5m6 6-6-6 6-6" /></>,
    book: <><path d="M12 5C8 2 4 4 3 4v15c4-2 7-1 9 1 2-2 5-3 9-1V4c-1 0-5-2-9 1v15" /></>,
    play: <path d="m9 5 11 7-11 7V5Z" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    hint: <><path d="M8 17c0-3-3-4-3-8a7 7 0 0 1 14 0c0 4-3 5-3 8M8 18h8m-7 3h6M12 5v2" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" /></>,
    undo: <><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" /></>,
    volume: <><path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6" /></>,
    flag: <><path d="M5 21V3c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
    trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v3a5 5 0 0 0 5 5m9-8h4v3a5 5 0 0 1-5 5m-4 0v6m-4 2h8" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] || paths.star}</svg>;
}

export function HorseArt({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'horse-art small' : 'horse-art'} viewBox="0 0 240 240" fill="none" aria-hidden="true">
    <circle cx="120" cy="122" r="100" fill="#D9E4C8" />
    <path d="M47 176c14-24 45-21 55-40l-30-18-13 8-15-25 40-48 7-25 23 18c29-5 51 7 67 31 17 25 16 62 1 87l8 25H80l7-23" fill="#456D57" stroke="#284D3D" strokeWidth="4" strokeLinejoin="round" />
    <path d="m91 54 11-13 10 10M111 56c32 1 54 25 58 49" stroke="#719070" strokeWidth="8" strokeLinecap="round" />
    <path d="m72 84-11 15 16 12c12-12 21-13 27-5" fill="#F9E9C2" />
    <circle cx="99" cy="77" r="5" fill="#203E31" />
    <circle cx="98" cy="75" r="1.5" fill="white" />
    <path d="M62 112c5 4 10 5 15 3" stroke="#284D3D" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="106" cy="96" rx="9" ry="5" fill="#CB936B" opacity=".8" />
    <path d="m103 143 19 12-14 18-21-10" fill="#D9B56D" />
    <rect x="68" y="181" width="127" height="23" rx="11.5" fill="#F6E2B9" stroke="#C8AB71" strokeWidth="3" />
    <path d="M83 192h97" stroke="#C8AB71" strokeWidth="2" />
    <path d="m185 39 3-10 3 10 10 3-10 3-3 10-3-10-10-3 10-3ZM37 150l2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#C99853" />
  </svg>;
}

export function Stars({ count = 0, size = 16 }: { count?: number; size?: number }) {
  return <span className="stars" aria-label={`${count} 颗星`}>{[1, 2, 3].map(n => <span className={n <= count ? 'filled' : ''} key={n}><Icon name="star" size={size} /></span>)}</span>;
}

export function ProgressRing({ percent }: { percent: number }) {
  return <div className="progress-ring" style={{ '--progress': `${percent}%` } as CSSProperties}><div><strong>{percent}<small>%</small></strong><span>探索进度</span></div></div>;
}
