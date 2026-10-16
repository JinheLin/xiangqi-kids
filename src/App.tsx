import { useEffect, useState } from 'react';
import { chapters, lessons, makePiece, pieceGuides } from './data/curriculum';
import type { Lesson } from './data/curriculum';
import { awardLesson, emptyProgress, firstUnfinished, isUnlocked, parseProgress, starTotal, STORAGE_KEY } from './progress';
import type { Progress } from './progress';
import { HorseArt, Icon, ProgressRing, Stars } from './components/Art';
import { LessonPlayer } from './components/LessonPlayer';
import { Practice } from './components/Practice';
import { SoundProvider, SoundToggle } from './components/Sound';
import { ChessBoard } from './components/Board';
import { legalMoves } from './engine/xiangqi';
import type { Board, PieceType } from './engine/xiangqi';

type Navigate = (route: string) => void;
const navItems = [{ route: '/learn', title: '学习地图', icon: 'book' }, { route: '/practice', title: '自由练习', icon: 'flag' }, { route: '/pieces', title: '棋子图鉴', icon: 'grid' }, { route: '/progress', title: '我的成长', icon: 'trophy' }];
const readRoute = () => window.location.hash.slice(1) || '/learn';
function readInitial() {
  try { return { progress: parseProgress(localStorage.getItem(STORAGE_KEY)), available: true }; }
  catch { return { progress: emptyProgress(), available: false }; }
}

function LearningMap({ progress, navigate }: { progress: Progress; navigate: Navigate }) {
  const next = firstUnfinished(progress), completed = Object.keys(progress.completed).length;
  const [expanded, setExpanded] = useState(next.chapter);
  const allDone = completed === lessons.length;
  return <main className="page-width home-page">
    <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="mini-spark">✦</span> 每一步，都是新发现</span><h1>小小棋手，<br />今天也要前进一步！</h1><p>认识一个新伙伴，学会一个小本领。<br className="desktop-break" />和小棋探一起，把象棋变成有趣的冒险。</p><div className="hero-actions"><button className="btn primary" onClick={() => navigate(allDone ? '/practice' : `/lesson/${next.id}`)}><Icon name="play" size={18} />{allDone ? '去自由练习' : completed ? '继续我的冒险' : '开始第 1 课'}<Icon name="arrow" size={19} /></button><span><Icon name="clock" size={15} />每课 2–4 分钟</span></div></div>
      <div className="hero-art"><div className="orbit" /><span className="art-dot one" /><span className="art-dot two" /><span className="floating-piece red">马</span><span className="floating-piece dark">将</span><HorseArt /><span className="art-caption"><Icon name="star" size={16} />思考的你，闪闪发光</span><span className="art-spark">✧</span></div>
    </section>
    <div className="home-columns"><section className="learning-map"><div className="section-heading"><div><span className="eyebrow">LEARN · PLAY · GROW</span><h2>你的象棋冒险地图</h2></div><span className="count-label">已完成 <strong>{completed}</strong> / {lessons.length} 课</span></div><p className="section-intro">从第一步开始，一起解锁新的小世界。</p>
      <div className="chapters">{chapters.map((chapter, chapterIndex) => {
        const chapterLessons = lessons.filter(l => l.chapter === chapterIndex), done = chapterLessons.filter(l => progress.completed[l.id]).length;
        const open = expanded === chapterIndex, unlocked = chapterLessons.some(l => isUnlocked(lessons.indexOf(l), progress));
        return <section className={`chapter ${open ? 'open' : ''} ${!unlocked ? 'chapter-locked' : ''}`} key={chapter.title}><button className="chapter-toggle" aria-expanded={open} onClick={() => setExpanded(open ? -1 : chapterIndex)}><span className={`chapter-icon ${chapter.color}`}>{chapter.icon}</span><span className="chapter-title"><small>第 {chapterIndex + 1} 章</small><strong>{chapter.title}</strong><span>{chapter.subtitle}</span></span><span className="chapter-count">{done === chapterLessons.length ? <span className="chapter-done"><Icon name="check" size={16} />已完成</span> : `${done} / ${chapterLessons.length}`}</span><span className={`expand-icon ${open ? 'rotated' : ''}`}><Icon name="chevron" size={18} /></span></button>
          {open && <div className="lesson-grid">{chapterLessons.map(lesson => {
            const index = lessons.indexOf(lesson), locked = !isUnlocked(index, progress), stars = progress.completed[lesson.id] || 0;
            const current = next.id === lesson.id && !allDone;
            return <button key={lesson.id} className={`lesson-card ${locked ? 'locked' : ''} ${current ? 'current' : ''} ${stars ? 'completed' : ''}`} aria-disabled={locked} aria-label={`${lesson.title}${locked ? '，待解锁' : stars ? `，已获得${stars}颗星，可复习` : '，开始学习'}`} onClick={() => { if (!locked) navigate(`/lesson/${lesson.id}`); }}><div className="card-top"><span className="card-token">{lesson.token}</span><span className="card-number">{String(index + 1).padStart(2, '0')}</span>{current && <span className="current-tag">从这里出发</span>}</div><h3>{lesson.title}</h3><p>{lesson.subtitle}</p><div className="card-bottom">{locked ? <span><Icon name="lock" size={13} />完成前一课解锁</span> : stars ? <Stars count={stars} size={14} /> : <span><Icon name="clock" size={13} />{lesson.minutes} 分钟 · {lesson.steps.length} 个小任务</span>}<Icon name={locked ? 'lock' : 'arrow'} size={18} /></div></button>;
          })}</div>}
        </section>;
      })}</div>
    </section><aside className="home-aside"><section className="journey-card"><div className="aside-heading"><h3>我的小小成长</h3><span>🌱</span></div><ProgressRing percent={Math.round(completed / lessons.length * 100)} /><div className="journey-stats"><div><strong>{completed}<small> / {lessons.length}</small></strong><span>完成课程</span></div><div><strong><span className="gold">✦</span> {starTotal(progress)}</strong><span>收集星星</span></div></div><div className="journey-message">{completed === 0 ? '你的第一颗星星，就在下一步。' : allDone ? '全部课程完成啦，继续在棋盘上探索吧！' : '每一次尝试，都比昨天更进一步。'}</div><button className="text-btn" onClick={() => navigate('/progress')}>看看我的成长<Icon name="arrow" size={16} /></button></section>
      <section className="tip-card"><span className="tip-illustration">✧</span><span className="eyebrow">小棋探悄悄说</span><h3>下棋前，先看一看</h3><p>这颗棋子能怎么走？<br />我的帅，安全吗？<br />想清楚，再出发。</p><span className="tip-leaf" aria-hidden="true">♧</span></section>
      <div className="local-note"><Icon name="check" size={17} /><p>不用注册，随时开始<br /><span>学习进度自动保存在这台设备</span></p></div>
    </aside></div>
    <section className="practice-banner"><div className="practice-banner-icon"><Icon name="flag" size={30} /></div><div><h3>想先和棋子们玩一玩？</h3><p>在自由练习场大胆尝试，走错了也有小提示。</p></div><button className="btn secondary" onClick={() => navigate('/practice')}>去练习场<Icon name="arrow" size={18} /></button></section>
  </main>;
}

function PieceLibrary({ progress, navigate }: { progress: Progress; navigate: Navigate }) {
  const [type, setType] = useState<PieceType>('rook');
  const guide = pieceGuides.find(p => p.type === type)!;
  const positions: Record<PieceType, [number, number]> = { rook: [1, 7], horse: [3, 7], cannon: [1, 7], pawn: [2, 6], elephant: [2, 9], advisor: [3, 9], general: [4, 9] };
  const [x, y] = positions[type];
  const board: Board = [makePiece('general', 'black', 4, 0), makePiece('pawn', 'red', 4, 5), ...(type === 'general' ? [] : [makePiece('general', 'red', 4, 9)]), makePiece(type, 'red', x, y)];
  const lesson = lessons.find(l => l.id === (type === 'pawn' ? 'pawn' : type))!;
  const unlocked = isUnlocked(lessons.indexOf(lesson), progress);
  return <main className="page-width library-page"><div className="page-title"><div><span className="eyebrow">七个伙伴，七种独特的本领</span><h1>棋子小图鉴</h1><p>点一个伙伴，认识它的走法。绿色小点是它现在能去的地方。</p></div></div><div className="piece-selector" role="group" aria-label="选择棋子">{pieceGuides.map(p => <button className={p.type === type ? 'active' : ''} onClick={() => setType(p.type)} key={p.type} aria-pressed={p.type === type}><span>{p.title.split(' / ')[0]}</span><strong>{p.title}</strong></button>)}</div><div className="library-layout"><div className="board-card"><ChessBoard board={board} selected={{ x, y }} legal={legalMoves(board, 'red', { x, y }).map(m => m.to)} disabled /><p className="board-footnote">走法观察板<span>这里展示安全的合法落点</span></p></div><section className="guide-detail"><span className="eyebrow">棋子伙伴 · {guide.title}</span><h2>{guide.rhyme}</h2><p>{guide.detail}</p>{type === 'cannon' && <div className="hint-box"><strong>吃子时别忘了炮架</strong><p>图上小点是空位走法。吃子时，还需要恰好一枚棋子当炮架。</p></div>}{type === 'pawn' && <div className="hint-box"><strong>红兵向上，黑卒向下</strong><p>过河以后可以左右走，到底线也不会变成别的棋子。</p></div>}<div className="guide-memory"><Icon name="hint" size={23} /><p>走法符合规则之后，<br /><strong>还要检查自己的帅是不是安全。</strong></p></div><button className="btn primary" onClick={() => navigate(unlocked ? `/lesson/${lesson.id}` : '/learn')}>{unlocked ? '去互动课堂试一试' : '从学习地图开始解锁'}<Icon name="arrow" /></button></section></div></main>;
}

function Growth({ progress, onReset, navigate }: { progress: Progress; onReset: () => void; navigate: Navigate }) {
  const [confirm, setConfirm] = useState(false);
  const completed = Object.keys(progress.completed).length;
  return <main className="page-width growth-page"><div className="page-title"><div><span className="eyebrow">每一个小脚印，都值得被看见</span><h1>我的成长花园</h1><p>星星和徽章，记录着你学会的每一个新本领。</p></div></div><section className="growth-summary"><HorseArt /><div><span className="eyebrow">{completed === lessons.length ? '小小象棋手' : completed >= 3 ? '努力探索的小棋探' : '你好，象棋新朋友'}</span><h2>{completed === lessons.length ? '冒险才刚刚开始！' : '一点点进步，也很了不起。'}</h2><p>已完成 {completed} 节课程，收集 {starTotal(progress)} 颗星星。</p><button className="btn primary" onClick={() => navigate(`/lesson/${firstUnfinished(progress).id}`)}>继续探索<Icon name="arrow" /></button></div><ProgressRing percent={Math.round(completed / lessons.length * 100)} /></section><div className="section-heading"><h2>我的本领徽章</h2><span className="count-label">完成一章，解锁一枚</span></div><div className="badge-grid">{chapters.map((chapter, i) => {
    const list = lessons.filter(l => l.chapter === i), count = list.filter(l => progress.completed[l.id]).length, earned = count === list.length;
    return <div className={`badge-card ${earned ? 'earned' : ''}`} key={i}><div className={`badge-medal ${chapter.color}`}><Icon name={earned ? 'trophy' : 'lock'} size={32} /></div><h3>{chapter.badge}</h3><p>{chapter.title}</p><span>{earned ? '已获得 · 做得真棒' : `${count} / ${list.length} 课`}</span></div>;
  })}</div><section className="review-section"><h2>我的课程足迹</h2>{completed ? <div className="review-grid">{lessons.filter(l => progress.completed[l.id]).map(l => <button key={l.id} className="review-item" onClick={() => navigate(`/lesson/${l.id}`)}><span className="review-token">{l.token}</span><strong>{l.title}</strong><Stars count={progress.completed[l.id]} /><Icon name="arrow" size={17} /></button>)}</div> : <div className="empty-state"><Icon name="flag" size={32} /><p>第一堂课正在等你。<br />完成后，这里就会留下你的星星足迹。</p><button className="btn secondary" onClick={() => navigate(`/lesson/${lessons[0].id}`)}>出发吧<Icon name="arrow" size={17} /></button></div>}</section><section className="save-info"><div><h3>关于学习进度</h3><p>进度保存在当前浏览器中，不需要账号。更换浏览器、设备或清除网站数据后，进度不会同步。</p></div>{confirm ? <div className="reset-confirm"><p>确定清空这台设备上的全部课程星星和徽章？</p><div className="button-row"><button className="btn danger" onClick={() => { onReset(); setConfirm(false); }}>确定清空进度</button><button className="btn secondary" onClick={() => setConfirm(false)}>保留进度</button></div></div> : <button className="text-btn" onClick={() => setConfirm(true)}>重新开始学习</button>}</section></main>;
}

export default function App() {
  const [initial] = useState(readInitial);
  const [progress, setProgress] = useState(initial.progress);
  const [storageError, setStorageError] = useState(!initial.available);
  const [route, setRoute] = useState(readRoute);
  useEffect(() => { const onHash = () => { setRoute(readRoute()); window.scrollTo({ top: 0, behavior: 'instant' }); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); setStorageError(false); } catch { setStorageError(true); } }, [progress]);
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setProgress(parseProgress(e.newValue)); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  const navigate: Navigate = path => { window.location.hash = path; };
  const lesson: Lesson | undefined = route.startsWith('/lesson/') ? lessons.find(l => l.id === route.slice(8)) : undefined;
  const allowed = lesson && isUnlocked(lessons.indexOf(lesson), progress);
  useEffect(() => { if (lesson && allowed) setProgress(old => old.lastLesson === lesson.id ? old : { ...old, lastLesson: lesson.id }); }, [lesson, allowed]);
  useEffect(() => { document.title = `${lesson ? lesson.title : navItems.find(n => n.route === route)?.title || '一起学象棋'} · 小棋探`; }, [route, lesson]);
  let content;
  if (lesson && allowed) content = <LessonPlayer key={lesson.id} lesson={lesson} voice={progress.voice} onComplete={(id, stars) => setProgress(old => awardLesson(old, id, stars))} navigate={navigate} />;
  else if (lesson) content = <main className="page-width empty-state locked-page"><Icon name="lock" size={40} /><h1>先把前面的本领学会吧</h1><p>完成前一课，这一课就会解锁。</p><button className="btn primary" onClick={() => navigate('/learn')}>回到学习地图<Icon name="arrow" /></button></main>;
  else if (route === '/practice') content = <Practice />;
  else if (route === '/pieces') content = <PieceLibrary progress={progress} navigate={navigate} />;
  else if (route === '/progress') content = <Growth progress={progress} onReset={() => setProgress(emptyProgress())} navigate={navigate} />;
  else content = <LearningMap progress={progress} navigate={navigate} />;
  return <SoundProvider enabled={progress.sound} onEnabledChange={enabled => setProgress(old => ({ ...old, sound: enabled }))}><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); document.getElementById('main-content')?.scrollIntoView(); }}>跳到主要内容</a><header className="site-header"><div className="header-inner"><button className="brand" onClick={() => navigate('/learn')} aria-label="小棋探，回到学习地图"><span className="brand-mark">馬</span><span><strong>小棋探<span className="brand-spark">✦</span></strong><small>每一步，都有新发现</small></span></button><nav aria-label="主要导航">{navItems.map(item => <button key={item.route} className={route === item.route || (item.route === '/learn' && route.startsWith('/lesson/')) ? 'active' : ''} aria-current={route === item.route ? 'page' : undefined} onClick={() => navigate(item.route)}><Icon name={item.icon} size={18} />{item.title}</button>)}</nav><div className="header-tools"><span className="star-counter" aria-label={`已收集 ${starTotal(progress)} 颗星星`}><Icon name="star" size={18} />{starTotal(progress)}</span><SoundToggle /><button className={`voice-toggle ${progress.voice ? 'on' : ''}`} aria-label={progress.voice ? '关闭语音讲解' : '开启语音讲解'} title={progress.voice ? '关闭语音讲解' : '开启语音讲解'} aria-pressed={progress.voice} disabled={!('speechSynthesis' in window)} onClick={() => setProgress(old => ({ ...old, voice: !old.voice }))}><Icon name={progress.voice ? 'volume' : 'mute'} size={19} /></button></div></div></header>
    {storageError && <div className="storage-warning" role="alert">当前浏览器无法保存进度。你仍然可以学习，但关闭页面后星星可能会丢失。</div>}<div id="main-content" tabIndex={-1}>{content}</div><footer className="site-footer"><span><span className="footer-knight">♞</span> 小棋探 · 让思考，慢慢开花</span><span>没有广告 · 不用注册 · 快乐学象棋</span></footer>
  </SoundProvider>;
}
