import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, at, choosePracticeMove, getOutcome, initialBoard, isInCheck, legalMoves, opposite, pieceLabel, pieceName, positionKey, samePoint, sideLabel, validateMove } from '../engine/xiangqi';
import type { Board, Move, Piece, Point, Side } from '../engine/xiangqi';
import { BoardSelection, ChessBoard } from './Board';
import { HorseArt, Icon } from './Art';
import { PlayFocusButton, usePlayFocus } from './PlayFocus';
import { useSound } from './Sound';

interface Frame { board: Board; turn: Side; lastMove: Move | null; captured?: Piece; text: string }
const newGame = (): Frame[] => [{ board: initialBoard(), turn: 'red', lastMove: null, text: '新的一局，红方先走。' }];
function advance(frames: Frame[], move: Move): Frame[] {
  const current = frames[frames.length - 1], piece = at(current.board, move.from)!;
  const captured = at(current.board, move.to);
  const text = `${pieceName(piece)}：${move.from.x + 1}列${move.from.y + 1}行 → ${move.to.x + 1}列${move.to.y + 1}行${captured ? `，吃${pieceLabel(captured)}` : ''}`;
  return [...frames, { board: applyMove(current.board, move), turn: opposite(current.turn), lastMove: move, captured, text }];
}

export function Practice({ active = true }: { active?: boolean }) {
  const page = useRef<HTMLElement>(null);
  const [frames, setFrames] = useState<Frame[]>(newGame);
  const [mode, setMode] = useState<'ai' | 'duo'>('ai');
  const [selected, setSelected] = useState<Point | null>(null);
  const [aids, setAids] = useState(true);
  const [hintTarget, setHintTarget] = useState<Point>();
  const [feedback, setFeedback] = useState('点一下红色棋子，就能看见它可以去的地方。');
  const [confirmReset, setConfirmReset] = useState(false);
  const { focused, setFocused } = usePlayFocus(active);
  const { play } = useSound();
  const current = frames[frames.length - 1], { board, turn } = current;
  const outcome = useMemo(() => getOutcome(board, turn), [board, turn]);
  const repeated = frames.filter(frame => positionKey(frame.board, frame.turn) === positionKey(board, turn)).length >= 3;
  const finished = !!outcome.winner || repeated;
  const thinking = mode === 'ai' && turn === 'black' && !finished;
  const legal = selected && aids ? legalMoves(board, turn, selected).map(m => m.to) : [];
  const playMove = useCallback((position: Board, move: Move, side: Side) => {
    play(at(position, move.to) ? 'capture' : 'move');
    const next = getOutcome(applyMove(position, move), opposite(side));
    if (next.winner) play('win', .12);
    else if (next.kind === 'check') play('check', .12);
  }, [play]);

  useEffect(() => {
    if (!active || !thinking) return;
    const timer = window.setTimeout(() => {
      const move = choosePracticeMove(board, 'black');
      if (move) { playMove(board, move, 'black'); setFrames(old => advance(old, move)); setFeedback('小棋搭子走好啦，轮到你了。先看看自己的帅是否安全。'); }
    }, 480);
    return () => clearTimeout(timer);
  }, [board, thinking, playMove, active]);

  function onSquare(p: Point) {
    if (finished || thinking) return;
    const piece = at(board, p);
    if (!selected || piece?.side === turn) {
      if (piece?.side !== turn) { play('mistake'); setFeedback(`现在轮到${sideLabel(turn)}，先选一枚自己的棋子吧。`); return; }
      if (selected && samePoint(selected, p)) { setSelected(null); return; }
      play('select'); setSelected(p); setHintTarget(undefined); setFeedback(`选中了${pieceName(piece)}。${aids ? '小圆点是安全的空落点，圆圈是可以吃的棋子。' : '再点一下你想去的位置。'}`); return;
    }
    const move = { from: selected, to: p }, validation = validateMove(board, move, turn);
    if (!validation.ok) { play('mistake'); setFeedback(validation.reason); return; }
    playMove(board, move, turn);
    setFrames(old => advance(old, move)); setSelected(null); setHintTarget(undefined);
    setFeedback(isInCheck(applyMove(board, move), opposite(turn)) ? '将军！下一方必须先解除队长的危险。' : validation.reason);
  }
  function undo() {
    play('undo');
    // If the companion has replied, rewind both moves to the child's previous turn.
    const count = mode === 'ai' && turn === 'red' ? 2 : 1;
    setFrames(old => old.slice(0, Math.max(1, old.length - count)));
    setSelected(null); setHintTarget(undefined); setConfirmReset(false); setFeedback('回到上一步啦，换个想法试试。');
  }
  return <main ref={page} className="page-width practice-page">
    <div className="screen-jump" role="group" aria-label="练习区域"><button onClick={() => page.current?.querySelector('.board-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="grid" size={17} />看棋盘</button><span>棋局会为你保留</span><button onClick={() => page.current?.querySelector('.practice-coach')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="hint" size={17} />练习工具</button></div>
    <div className="page-title"><div><span className="eyebrow">把新学的本领用起来</span><h1>自由练习场<span className="tiny-label">大胆试，慢慢想</span></h1><p>和小棋搭子下一盘，或邀请家人一起玩。</p></div><div className="practice-heading-actions"><div className="mode-switch" role="group" aria-label="练习模式"><button className={mode === 'ai' ? 'active' : ''} onClick={() => { setMode('ai'); setSelected(null); setFeedback('小棋搭子执黑，你执红。红方先走。'); }}>小棋搭子</button><button className={mode === 'duo' ? 'active' : ''} onClick={() => { setMode('duo'); setSelected(null); setFeedback(`双人练习，轮到${sideLabel(turn)}。`); }}>双人同屏</button></div><PlayFocusButton focused={focused} onToggle={() => setFocused(value => !value)} /></div></div>
    <div className="play-layout"><section className="board-card"><div className="board-card-top"><span><i className={`side-dot ${turn}`} />{finished ? '本次练习结束' : thinking ? '小棋搭子思考中…' : `${sideLabel(turn)}走棋`}</span><span className={outcome.kind === 'check' ? 'check-label' : ''}>{outcome.kind === 'check' ? '将军！请先保护队长' : `已走 ${frames.length - 1} 步`}</span></div>
      <ChessBoard board={board} turn={turn} selected={selected} legal={legal} target={hintTarget} onSquare={onSquare} lastMove={current.lastMove} disabled={finished || thinking} />
      <BoardSelection piece={selected ? at(board, selected) : undefined} onCancel={() => { setSelected(null); setHintTarget(undefined); }} message={finished ? '本次练习结束，可以悔棋或重新开始。' : thinking ? '小棋搭子正在思考，马上轮到你。' : '轻点自己的棋子，再点落点；选错可以取消。'} />
      <p className="board-footnote">先点棋子，再点落点<span>红方在下 · 黑方在上</span></p>
    </section><aside className="lesson-aside">
      <section className="coach-card practice-coach"><div className="coach-top"><span className="coach-avatar"><HorseArt small /></span><div><strong>{mode === 'ai' ? '你的小棋搭子' : '一起下，更开心'}</strong><span>{mode === 'ai' ? '你执红棋，我来执黑棋' : '两位棋手轮流走棋'}</span></div></div>
        {finished ? <div className="game-result" role="status"><Icon name="trophy" size={32} /><h2>{outcome.winner ? `${sideLabel(outcome.winner)}获胜！` : '休息一下，换个思路'}</h2><p>{outcome.kind === 'checkmate' ? '将死：队长正被攻击，而且没有办法解除危险。' : outcome.kind === 'stalemate' ? '困毙：虽然没有被将军，但轮到的一方已经无棋可走，也会输。' : '同一个局面已出现三次，本次教学练习暂停。可以悔棋换个走法，或重新开局。'}</p></div> : <div className="practice-message" role="status" aria-live="polite"><h2>{thinking ? '让我想一想…' : '轮到你的小脑袋啦'}</h2><p>{feedback}</p></div>}
        <label className="toggle-line"><span>显示合法走法</span><input type="checkbox" checked={aids} onChange={e => setAids(e.target.checked)} /><span className="toggle-visual" aria-hidden="true" /></label>
        <div className="practice-tools"><button className="btn secondary" onClick={undo} disabled={frames.length < 2}><Icon name="undo" size={18} />悔棋</button><button className="btn secondary" disabled={finished || thinking} onClick={() => { play('hint'); const hint = choosePracticeMove(board, turn); if (hint) { setSelected(hint.from); setHintTarget(hint.to); setFeedback('可以试试这一步：把选中的棋子移到星星处。先观察，再决定。'); } }}><Icon name="hint" size={18} />想想怎么走</button></div>
        {confirmReset ? <div className="reset-confirm"><p>要结束这一局，重新开始吗？</p><div className="button-row"><button className="btn primary" onClick={() => { setFrames(newGame()); setSelected(null); setHintTarget(undefined); setConfirmReset(false); setFeedback('新的一局开始啦，红方先走！'); }}>重新开局</button><button className="text-btn" onClick={() => setConfirmReset(false)}>接着下</button></div></div> : <button className="text-btn reset-game" onClick={() => { if (frames.length > 1) setConfirmReset(true); else { setFrames(newGame()); setFeedback('棋盘准备好啦，红方先走！'); } }}><Icon name="reset" size={17} />重新开始</button>}
      </section>
      <section className="move-log"><h3>这盘棋的小足迹 <span>{frames.length - 1} 步</span></h3><div className="move-log-list">{frames.length === 1 ? <p className="muted">第一步，从这里出发。</p> : frames.slice(1).map((frame, i) => <p key={i}><span>{i + 1}</span>{frame.text}</p>)}</div></section>
      <details className="practice-rules"><summary>练习规则与小提醒</summary><p>支持全部基本走法、将军、应将、将死和困毙。不能把自己的帅置于危险中，也不能直接吃掉对方的将。</p><p>这是入门陪练，小棋搭子只思考两步。同一局面出现三次时暂停教学练习；不作正式比赛的长将、长捉或自然限着裁决。练习棋局在离开页面后重新开始，课程进度会保存在本机。</p></details>
    </aside></div>
  </main>;
}
