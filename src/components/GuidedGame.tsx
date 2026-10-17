import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { at, choosePracticeMove, getOutcome, legalMoves, positionKey, samePoint, validateMove } from '../engine/xiangqi';
import type { Move, Point } from '../engine/xiangqi';
import { advanceGuide, assessGuideMove, createGuideGame, describeMove, guideGoals, guideReview, guideStats, suggestGuideMove } from '../guided/coach';
import type { GoalId, MoveAdvice } from '../guided/coach';
import { useGuideNarration } from '../guided/useGuideNarration';
import { BoardSelection, ChessBoard } from './Board';
import { HorseArt, Icon } from './Art';
import { PlayFocusButton, usePlayFocus } from './PlayFocus';
import { RestartDialog } from './RestartDialog';
import { useSound } from './Sound';

interface Props { active: boolean; voice: boolean; onVoiceChange: (value: boolean) => void; onAward: (goal: GoalId, safe: number, completed: boolean) => void }
interface Comment { text: string; why: string; kind: 'info' | 'success' | 'warning' }
export function GuidedGame({ active, voice, onVoiceChange, onAward }: Props) {
  const [goalId, setGoalId] = useState<GoalId>('safe');
  const [frames, setFrames] = useState(() => createGuideGame('safe'));
  const [started, setStarted] = useState(false), [review, setReview] = useState(false);
  const [selected, setSelected] = useState<Point | null>(null);
  const [pending, setPending] = useState<{ move: Move; advice: MoveAdvice } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestGuideMove>>(null);
  const [whyOpen, setWhyOpen] = useState(false), [confirmNew, setConfirmNew] = useState(false);
  const [visible, setVisible] = useState(document.visibilityState !== 'hidden');
  const [comment, setComment] = useState<Comment>({ text: '一起边下边学。你执红棋，小棋探执黑棋；不会的时候，随时点提示。', why: '每次只观察一个小本领，慢慢就会更熟练。', kind: 'info' });
  const page = useRef<HTMLElement>(null), content = useRef<HTMLDivElement>(null);
  const { focused, setFocused } = usePlayFocus(active && started && !review);
  const { play } = useSound();
  const { say, stop, status, supported } = useGuideNarration(voice, active);
  const lastVoice = useRef(voice), lastMessage = useRef(comment.text), lastGoalComplete = useRef(false);
  lastMessage.current = comment.text;
  const goal = guideGoals.find(g => g.id === goalId)!;
  const current = frames.at(-1)!, { board, turn } = current;
  const outcome = useMemo(() => getOutcome(board, turn), [board, turn]);
  const repeated = frames.filter(frame => positionKey(frame.board, frame.turn) === positionKey(board, turn)).length >= 3;
  const finished = !!outcome.winner || repeated;
  const thinking = started && !review && !finished && turn === 'black';
  const stats = useMemo(() => guideStats(frames, goalId), [frames, goalId]);
  const previousChild = [...frames].reverse().find(frame => frame.actor === 'red');
  const reviewItems = useMemo(() => guideReview(frames), [frames]);
  const announce = useCallback((text: string, why = '走之前先看帅，再看棋子之间的攻击和保护。', kind: Comment['kind'] = 'info') => {
    setComment({ text, why, kind }); setWhyOpen(false); say(text);
  }, [say]);
  useEffect(() => {
    if (active && voice && !lastVoice.current) say(lastMessage.current);
    lastVoice.current = voice;
  }, [voice, active, say]);
  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => { if (!active) { setPending(null); setConfirmNew(false); } }, [active]);
  useEffect(() => {
    if (!active || !started) return;
    onAward(goalId, stats.safe, stats.complete);
    if (stats.complete && !lastGoalComplete.current) play('win');
    lastGoalComplete.current = stats.complete;
  }, [active, started, goalId, stats.safe, stats.complete, onAward, play]);
  useEffect(() => {
    if (active && content.current) content.current.scrollTop = 0;
    if (active && started && !review && matchMedia('(max-width: 650px)').matches) {
      page.current?.querySelector('.guide-comment')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [comment, active, started, review]);
  useEffect(() => {
    if (!active || !visible || !thinking || status.state === 'speaking') return;
    const timer = setTimeout(() => {
      const move = choosePracticeMove(board, 'black');
      if (!move) return;
      const next = advanceGuide(frames, move), nextOutcome = getOutcome(next.at(-1)!.board, 'red');
      setFrames(next); setSelected(null); setSuggestion(null); setHintLevel(0);
      play(at(board, move.to) ? 'capture' : 'move');
      if (nextOutcome.winner) play('win', .12); else if (nextOutcome.kind === 'check') play('check', .12);
      announce(next.at(-1)!.message, `${describeMove(board, move)}。我的回应是按基本规则选择的。轮到你后，也要重新观察棋子之间的攻击和保护。`, nextOutcome.winner ? 'warning' : 'info');
    }, 850);
    return () => clearTimeout(timer);
  }, [active, visible, thinking, status.state, frames, board, play, announce]);

  function start() {
    const next = createGuideGame(goalId);
    stop(); setFrames(next); setStarted(true); setReview(false); setSelected(null); setPending(null); setHintLevel(0); setSuggestion(null); setConfirmNew(false); lastGoalComplete.current = false;
    announce('这局的小目标是' + goal.title + '。' + next[0].message, '本局的小目标是：' + goal.description);
  }
  function commit(move: Move, advice: MoveAdvice) {
    if (turn !== 'red' || !validateMove(board, move, 'red').ok) return;
    const next = advanceGuide(frames, move, advice);
    setFrames(next); setPending(null); setSelected(null); setSuggestion(null); setHintLevel(0);
    play(at(board, move.to) ? 'capture' : 'move');
    if (advice.kind === 'check') play('check', .12); else if (advice.kind === 'win') play('win', .12);
    const earned = guideStats(next, goalId).complete && !stats.complete;
    announce(next.at(-1)!.message + (earned ? `小目标完成啦，获得了${goal.title}徽章！可以继续下，也可以结束并复盘。` : ''), advice.why, advice.safe ? 'success' : 'warning');
  }
  function onSquare(point: Point) {
    if (finished || thinking || review || pending) return;
    const piece = at(board, point);
    if (!selected || piece?.side === 'red') {
      if (piece?.side !== 'red') { play('mistake'); announce('先点一下自己的红色棋子，再点它要去的地方。'); return; }
      play('select'); setSelected(selected && samePoint(point, selected) ? null : point); return;
    }
    const move = { from: selected, to: point }, valid = validateMove(board, move, 'red');
    if (!valid.ok) { play('mistake'); announce(valid.reason, '走法要符合棋子本领，还必须保证自己的帅安全。', 'warning'); return; }
    const advice = assessGuideMove(board, move);
    if (advice.warning) { setPending({ move, advice }); play('hint'); announce(advice.warning + '你可以再想想，也可以选择试试看。', advice.why, 'warning'); return; }
    commit(move, advice);
  }
  function hint() {
    if (turn !== 'red' || finished || pending) return;
    const choice = suggestion || suggestGuideMove(board);
    if (!choice) return;
    const level = Math.min(3, hintLevel + 1);
    setSuggestion(choice); setHintLevel(level);
    if (level === 3) setSelected(choice.move.from);
    play('hint'); announce(choice.hints[level - 1], choice.advice.why);
  }
  function undo() {
    if (frames.length < 2) return;
    const count = turn === 'red' ? 2 : 1;
    const next = frames.slice(0, Math.max(1, frames.length - count));
    stop(); setFrames(next); setPending(null); setSelected(null); setSuggestion(null); setHintLevel(0); setReview(false); play('undo');
    announce('回到你上一次走棋之前了。可以换个选择试试，提示和悔棋都不会扣掉徽章。');
  }
  function openReview() {
    setReview(true); setFocused(false); setPending(null);
    const text = `这盘你尝试了${stats.childMoves}步红棋，有${stats.safe}步没有发现明显送子。${stats.complete ? '已经完成了' + goal.title + '的小目标，获得一枚本领徽章。' : '可以回看其中的一步，再试一个想法。'}`;
    announce(text);
  }
  function retry(index: number) {
    stop(); setFrames(frames.slice(0, index)); setSelected(null); setPending(null); setSuggestion(null); setHintLevel(0); setReview(false);
    announce('回到这一步之前啦。看看能不能试一个新的选择。');
  }
  const voiceControls = <div className="guide-voice-tools"><button className={`guide-voice-toggle ${voice ? 'on' : ''}`} disabled={!supported} aria-pressed={voice} onClick={() => onVoiceChange(!voice)}><Icon name={voice ? 'volume' : 'mute'} size={18} />{!supported ? '浏览器不支持语音' : voice ? '关闭语音播报' : '开启语音播报'}</button><button className="text-btn" disabled={!supported || !voice} onClick={() => say(comment.text)}><Icon name="play" size={16} />再听一次</button>{status.state === 'speaking' && <button className="text-btn" onClick={stop}>停止播报</button>}</div>;

  if (!started) return <main className="page-width guided-intro"><div className="page-title"><div><span className="eyebrow">小棋探陪你 · 边下边学</span><h1>下指导棋</h1><p>你执红棋，我执黑棋。先观察、再尝试，一起学会保护棋子。</p></div><HorseArt small /></div><section className="guide-welcome"><h2>先选一个小目标</h2><div className="guide-goals" role="group" aria-label="指导棋小目标">{guideGoals.map(item => <button className={goalId === item.id ? 'chosen' : ''} aria-pressed={goalId === item.id} key={item.id} onClick={() => { setGoalId(item.id); announce('选择了' + item.title + '。' + item.description); }}><span><Icon name={item.id === 'safe' ? 'star' : item.id === 'capture' ? 'flag' : 'hint'} size={25} /></span><strong>{item.title}</strong><p>{item.description}</p></button>)}</div><div className="guide-welcome-bottom"><div><strong>牵手下棋</strong><p>走前提醒危险 · 分三步给提示 · 随时悔棋 · 局后小复盘</p>{voiceControls}{status.message && <p className="speech-status" role="status">{status.message}</p>}</div><button className="btn primary" onClick={start}><Icon name="play" size={19} />开始指导对局<Icon name="arrow" size={19} /></button></div></section><p className="guide-save-note">提示和悔棋不扣奖励；本领徽章会保存在这台设备。未完成棋局在切换栏目后保留，刷新页面会重新开始。</p></main>;

  if (review) return <main className="page-width guided-review"><div className="page-title"><div><span className="eyebrow">每个选择，都能学到一点</span><h1>这盘棋的小复盘</h1><p>{comment.text}</p></div></div><div className={`guide-review-summary ${stats.complete ? 'earned' : ''}`}><Icon name="trophy" size={34} /><div><h2>{stats.complete ? goal.title + ' · 本领徽章已获得' : '愿意观察和尝试，就是进步'}</h2><p>尝试 {stats.childMoves} 步红棋 · 安全观察 {stats.safe} 步 · {goal.title} {Math.min(stats.count, goal.target)} / {goal.target}</p></div></div><div className="guide-review-grid">{[{ item: reviewItems.good, label: '一步值得记住的棋', empty: '还没有找到适合展示的好棋。回到棋盘，试着先观察帅和伙伴。' }, { item: reviewItems.retry, label: '一个可以再试试的地方', empty: '这盘没有记录到明显送子的尝试。继续留意对方下一步能吃到谁。' }].map(({ item, label, empty }) => <section className="guide-review-card" key={label}><h2>{label}</h2>{item ? <><div className="guide-review-card-content"><ChessBoard board={frames[item.index - 1].board} lastMove={item.frame.lastMove} disabled /><p className="review-move">{describeMove(frames[item.index - 1].board, item.frame.lastMove!)}</p><p>{item.frame.advice?.warning || item.frame.message}</p></div><button className="btn secondary" onClick={() => retry(item.index)}>回到这里试一试<Icon name="undo" size={18} /></button></> : <div className="guide-review-card-content"><p className="guide-empty-review">{empty}</p></div>}</section>)}</div><div className="guide-review-footer">{voiceControls}{status.message && <p className="speech-status" role="status">{status.message}</p>}<div className="button-row guide-review-actions"><button className="btn secondary" onClick={() => { stop(); setReview(false); announce(current.message); }}>{finished ? '看看最后棋局' : '继续这盘棋'}</button><button className="btn primary" onClick={() => { stop(); setStarted(false); announce('再选一个小目标，一起开始新的指导对局吧。'); }}>再选一个小目标<Icon name="arrow" /></button></div></div></main>;

  const legal = selected && !pending && !thinking ? legalMoves(board, 'red', selected).map(move => move.to) : [];
  const highlight = suggestion && hintLevel >= 2 ? board.filter(piece => samePoint(piece, suggestion.move.from)) : [];
  return <main ref={page} className="page-width practice-page guided-page"><div className="screen-jump" role="group" aria-label="指导棋区域"><button onClick={() => page.current?.querySelector('.board-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="grid" size={17} />看棋盘</button><span>牵手下棋</span><button onClick={() => page.current?.querySelector('.guided-coach')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="hint" size={17} />听指导</button></div><div className="page-title"><div><span className="eyebrow">边下边学 · 牵手模式</span><h1>下指导棋</h1><p>{goal.title}，一步一步来。</p></div><div className="practice-heading-actions"><button className="text-btn guide-end" onClick={openReview}>{finished ? '看看小复盘' : '结束并复盘'}<Icon name="book" size={18} /></button><PlayFocusButton focused={focused} onToggle={() => setFocused(value => !value)} /></div></div><div className="play-layout"><section className="board-card guided-board"><div className="board-card-top"><span><i className={`side-dot ${turn}`} />{finished ? '本局结束' : pending ? '先想一想，再决定' : thinking ? status.state === 'speaking' ? '先听完这一步的讲解' : '小棋探正在想…' : '轮到你 · 红方'}</span><span className="guide-board-meta"><span>已走 {frames.length - 1} 步</span>{outcome.kind === 'check' && <strong className="check-label">将军！先保护帅</strong>}</span></div><ChessBoard board={board} selected={selected} legal={legal} target={pending?.move.to || (hintLevel >= 3 ? suggestion?.move.to : undefined)} lastMove={current.lastMove} turn={turn} onSquare={onSquare} disabled={thinking || finished || !!pending} highlight={highlight} /><BoardSelection piece={selected ? at(board, selected) : undefined} onCancel={() => { setSelected(null); setPending(null); }} message={thinking ? '先观察小棋探的回应，马上就轮到你。' : '轻点自己的红棋，再点落点。走之前先看帅。'} /></section><aside className="lesson-aside"><section className="coach-card guided-coach"><div className="coach-top"><span className="coach-avatar"><HorseArt small /></span><div><strong>小棋探陪你下</strong><span>{status.state === 'speaking' ? '正在为你讲解…' : '提示和悔棋，都不扣奖励'}</span></div></div><div className={`guide-goal-status ${stats.complete ? 'earned' : ''}`}><span><Icon name={stats.complete ? 'trophy' : 'flag'} size={19} /><strong>{goal.title}</strong></span><span>{stats.complete ? '小目标完成！' : `${Math.min(stats.count, goal.target)} / ${goal.target}`}</span></div><div ref={content} className="coach-content guide-comment"><h2>{pending ? '这一步，要再想想吗？' : finished ? outcome.winner === 'red' ? '红方获胜！' : repeated ? '先停下来，换个思路' : '一起回看这盘棋' : thinking ? '听听这一步' : '轮到你的小脑袋啦'}</h2><div className={`feedback ${comment.kind}`} role={pending ? 'alert' : 'status'} aria-live="polite"><Icon name={comment.kind === 'success' ? 'check' : 'hint'} size={21} /><p>{comment.text}</p></div>{current.actor === 'black' && previousChild && !pending && <section className="guide-previous-choice"><strong>刚才你的一步</strong><p>{previousChild.advice?.message}</p></section>}{repeated && <p>同一局面已出现三次，本次教学练习暂停。可以悔棋，或在复盘中换个选择。</p>}{whyOpen && <div className="hint-box"><strong>为什么这样提醒</strong><p>{comment.why}</p></div>}{hintLevel > 0 && !pending && <p className="guide-hint-level">提示 {hintLevel} / 3 · 提示不会替你走棋</p>}{stats.complete && <p className="guide-goal-celebration">已经获得本领徽章！可以继续探索，也可以结束并复盘。</p>}{voiceControls}{status.message && <p className="speech-status" role="status">{status.message}</p>}</div><div className="coach-actions guide-actions">{pending ? <><button className="btn primary" onClick={() => { setPending(null); announce('好，我们再观察一下。原来的棋子还选着，可以换一个落点。'); }}>再想想</button><button className="btn secondary" onClick={() => commit(pending.move, pending.advice)}>就这样走</button></> : <><button className="btn secondary" disabled={thinking || finished || hintLevel >= 3} onClick={hint}><Icon name="hint" size={17} />{hintLevel >= 3 ? '提示已展开' : hintLevel ? '再给一点提示' : '给点提示'}</button><button className="btn secondary" onClick={() => { setWhyOpen(value => !value); if (!whyOpen) say(comment.why); }}><Icon name="book" size={17} />为什么</button><button className="btn secondary" disabled={frames.length < 2} onClick={undo}><Icon name="undo" size={17} />悔一步</button>{finished && <button className="btn primary" onClick={openReview}>看看小复盘<Icon name="arrow" size={17} /></button>}</>}</div></section><button className="text-btn guide-new" onClick={() => setConfirmNew(true)}><Icon name="reset" size={16} />换个小目标</button></aside></div><RestartDialog open={active && confirmNew} onCancel={() => setConfirmNew(false)} onRestart={() => { stop(); setConfirmNew(false); setStarted(false); setFocused(false); announce('再选一个小目标，一起开始新的指导对局吧。'); }} /></main>;
}
