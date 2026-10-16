import { useEffect, useRef, useState } from 'react';
import { applyMove, at, legalMoves, pieceName, samePoint, validateMove } from '../engine/xiangqi';
import type { Point } from '../engine/xiangqi';
import type { Lesson } from '../data/curriculum';
import { chapters, lessons } from '../data/curriculum';
import { BoardSelection, ChessBoard } from './Board';
import { HorseArt, Icon, Stars } from './Art';
import { PlayFocusButton, usePlayFocus } from './PlayFocus';
import { useSound } from './Sound';

export function speak(text: string, enabled: boolean) {
  if (!enabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN'; utterance.rate = 0.88;
  const chineseVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('zh'));
  if (chineseVoice) utterance.voice = chineseVoice;
  window.speechSynthesis.speak(utterance);
}

export function LessonPlayer({ lesson, voice, onComplete, navigate, active = true }: { active?: boolean; lesson: Lesson; voice: boolean; onComplete: (id: string, stars: number) => void; navigate: (route: string) => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = lesson.steps[stepIndex];
  const [board, setBoard] = useState(step.board);
  const [selected, setSelected] = useState<Point | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [hints, setHints] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const [demo, setDemo] = useState(false);
  const [wrongOption, setWrongOption] = useState<number | null>(null);
  const { focused, setFocused } = usePlayFocus(active);
  const { play } = useSound();
  const stars = mistakes === 0 && totalHints === 0 ? 3 : mistakes <= 3 ? 2 : 1;
  const nextLesson = lessons[lessons.findIndex(l => l.id === lesson.id) + 1];

  useEffect(() => {
    if (!active) return;
    speak(`${step.title}。${step.instruction}`, voice);
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, [step, voice, active]);
  useEffect(() => {
    if (!active || !demo || step.kind !== 'move') return;
    const start = window.setTimeout(() => { setBoard(applyMove(step.board, step)); play(at(step.board, step.to) ? 'capture' : 'move'); }, 650);
    const finish = window.setTimeout(() => { setBoard(step.board); setSelected(null); setDemo(false); }, 1900);
    return () => { clearTimeout(start); clearTimeout(finish); };
  }, [demo, step, play, active]);
  useEffect(() => { if (!active && demo) { setDemo(false); setBoard(step.board); setSelected(null); } }, [active, demo, step]);
  const page = useRef<HTMLElement>(null);
  const lastShownStep = useRef<typeof step | null>(null);
  useEffect(() => {
    if (!active || lastShownStep.current === step) return;
    // Wait until the enclosing screen has restored its own scroll position.
    const frame = requestAnimationFrame(() => {
      lastShownStep.current = step;
      if (matchMedia('(max-width: 900px)').matches || matchMedia('(orientation: portrait) and (any-pointer: coarse)').matches) {
        page.current?.querySelector(step.kind === 'quiz' ? '.coach-card' : '.board-card')?.scrollIntoView({ block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, step]);
  useEffect(() => {
    if (active && feedback && (matchMedia('(max-width: 650px)').matches)) {
      page.current?.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [active, feedback]);

  function success() { play('correct', step.kind === 'move' ? .12 : 0); setSolved(true); setSelected(null); setFeedback({ kind: 'success', text: step.explain }); speak(`真棒！${step.explain}`, voice); }
  function wrong(text: string) { play('mistake'); setMistakes(n => n + 1); setFeedback({ kind: 'error', text }); speak(text, voice); }
  function onSquare(p: Point) {
    if (solved || demo) return;
    const piece = at(board, p);
    if (step.kind === 'quiz') return;
    if (step.kind === 'identify') {
      if (!piece) { setFeedback({ kind: 'info', text: '点一下棋子就可以啦。' }); return; }
      if (piece.type === step.targetType && piece.side === step.targetSide) { setSelected(p); success(); }
      else wrong(`这是${pieceName(piece)}。${step.instruction}`);
      return;
    }
    if (!selected) {
      if (!piece || piece.side !== step.turn) { setFeedback({ kind: 'info', text: '先选择自己的红色棋子，再选择它要去的地方。' }); return; }
      play('select'); setSelected(p); setFeedback(null); return;
    }
    if (samePoint(p, selected)) { setSelected(null); return; }
    if (piece?.side === step.turn) { play('select'); setSelected(p); setFeedback({ kind: 'info', text: '换好棋子啦。现在点一下它要去的落点。' }); return; }
    const move = { from: selected, to: p }, valid = validateMove(board, move, step.turn);
    if (!valid.ok) { wrong(valid.reason); return; }
    if (!samePoint(selected, step.from) || !samePoint(p, step.to)) {
      wrong(`这步符合走法！这次的小任务是：${step.instruction}`); return;
    }
    play(piece ? 'capture' : 'move'); setBoard(applyMove(board, move)); success();
  }
  function next() {
    if (stepIndex === lesson.steps.length - 1) { play('win'); onComplete(lesson.id, stars); setFocused(false); setFinished(true); return; }
    const next = lesson.steps[stepIndex + 1];
    setStepIndex(n => n + 1); setBoard(next.board); setSelected(null); setSolved(false); setFeedback(null); setHints(0); setWrongOption(null);
  }
  const highlighted = step.kind === 'identify' && hints > 0 ? board.filter(p => p.side === step.targetSide && p.type === step.targetType) : [];
  const legal = step.kind === 'move' && selected && !solved && !demo ? legalMoves(board, step.turn, selected).map(m => m.to) : [];

  if (finished) return <main className="completion page-width">
    <div className="confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 5) * 0.15}s`, background: ['#e6b854', '#789e7f', '#df936f'][i % 3] }} />)}</div>
    <HorseArt /><span className="eyebrow">又学会了一个新本领</span><h1>这一课，闯关成功！</h1><p>你完成了「{lesson.title}」，做得真棒。</p><Stars count={stars} size={42} />
    <div className="reward-note">{stars === 3 ? '独立完成，获得 3 颗星！' : `获得 ${stars} 颗星！愿意尝试、会用提示，也是好棋手。`}<small>每关保留最好的星星成绩，可以随时回来复习。</small></div>
    <div className="button-row"><button className="btn primary" onClick={() => navigate(nextLesson ? `/lesson/${nextLesson.id}` : '/practice')}>{nextLesson ? '学习下一课' : '去自由练习'}<Icon name="arrow" /></button><button className="btn secondary" onClick={() => navigate('/learn')}>回到学习地图</button></div>
  </main>;

  return <main ref={page} className="lesson-page page-width">
    <div className="screen-jump" role="group" aria-label="课堂区域"><button onClick={() => page.current?.querySelector('.board-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="grid" size={17} />看棋盘</button><span>小任务 {stepIndex + 1} / {lesson.steps.length}</span><button onClick={() => page.current?.querySelector('.coach-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="hint" size={17} />讲解与提示</button></div>
    <div className="lesson-top"><button className="text-btn" onClick={() => navigate('/learn')}><Icon name="back" />学习地图</button><span>第 {lesson.chapter + 1} 章 · {chapters[lesson.chapter].title}</span><span className="step-label">{stepIndex + 1} / {lesson.steps.length} 个小任务</span></div>
    <div className="step-progress" aria-label={`课程进度 ${stepIndex + 1}/${lesson.steps.length}`}>{lesson.steps.map((_, i) => <span key={i} className={i < stepIndex || (i === stepIndex && solved) ? 'done' : i === stepIndex ? 'current' : ''} />)}</div>
    <div className="lesson-heading"><div><span className="eyebrow">第 {lessons.indexOf(lesson) + 1} 课 · 跟着小棋探学</span><h1>{lesson.title}</h1><p>{lesson.subtitle}</p></div><div className="lesson-heading-actions"><div className="lesson-token">{lesson.token}</div><PlayFocusButton focused={focused} onToggle={() => setFocused(value => !value)} /></div></div>
    <div className="mobile-task-cue"><strong>{step.title}</strong><p>{step.instruction}</p></div>
    <div className="play-layout">
      <section className="board-card"><div className="board-card-top"><span><i className="side-dot" />{step.kind === 'move' ? '红方走棋' : '一起观察棋盘'}</span><span>{step.kind === 'move' ? '✦ 星星是这次的目的地' : '红方在下 · 黑方在上'}</span></div>
        <ChessBoard board={board} selected={selected} legal={legal} target={step.kind === 'move' ? step.to : undefined} onSquare={onSquare} disabled={solved || demo || step.kind === 'quiz'} highlight={highlighted} />
        {step.kind !== 'quiz' && <BoardSelection piece={selected ? at(board, selected) : undefined} onCancel={() => setSelected(null)} message={demo ? '看好啦，演示后你来试一次。' : solved ? '真棒，走对啦！到讲解区继续下一个小任务。' : step.kind === 'identify' ? '找到棋子后，轻轻点一下。' : '轻点红棋，再点星星；选错棋子可以取消。'} />}
        <p className="board-footnote">{step.kind === 'identify' ? '找到棋子，轻轻点一下' : step.kind === 'quiz' ? '观察棋盘，在旁边选出答案' : '先点棋子，再点落点'}<span>支持方向键与回车操作</span></p>
      </section>
      <aside className="lesson-aside">
        <section className="coach-card"><div className="coach-top"><span className="coach-avatar"><HorseArt small /></span><div><strong>小棋探陪你学</strong><span>一步一步来，慢慢就会啦</span></div></div><span className="task-count">小任务 {stepIndex + 1}</span><h2>{step.title}</h2><p className="instruction">{step.instruction}</p>
          {step.kind === 'quiz' && <div className="quiz-options">{step.options.map((option, i) => <button key={option} className={`quiz-option ${solved && i === step.answer ? 'correct' : wrongOption === i ? 'incorrect' : ''}`} disabled={solved} onClick={() => { if (i === step.answer) success(); else { setWrongOption(i); wrong('再想一想，答案就在小提示里。试试另一个答案吧！'); } }}><span>{String.fromCharCode(65 + i)}</span>{option}{solved && i === step.answer && <Icon name="check" size={18} />}</button>)}</div>}
          <div className={`feedback ${feedback?.kind || 'quiet'}`} role="status" aria-live="polite">{feedback ? <><Icon name={feedback.kind === 'success' ? 'check' : 'hint'} size={21} /><p>{feedback.text}</p></> : <><Icon name="hint" size={19} /><p>不用担心走错，每一次尝试都会有新发现。</p></>}</div>
          {hints > 0 && !solved && <div className="hint-box" role="status"><strong>小提示 {Math.min(hints, step.hints.length)}</strong><p>{step.hints[Math.min(hints, step.hints.length) - 1]}</p></div>}
          {solved ? <button className="btn primary full" onClick={next}>{stepIndex === lesson.steps.length - 1 ? '完成课程，领取星星' : '下一个小任务'}<Icon name="arrow" /></button> : <div className="help-actions"><button className="btn secondary" disabled={demo || hints >= step.hints.length} onClick={() => { play('hint'); setHints(n => n + 1); setTotalHints(n => n + 1); }}><Icon name="hint" size={18} />{hints >= step.hints.length ? '提示都在这里啦' : '给我一点提示'}</button>{step.kind === 'move' && <button className="text-btn" disabled={demo} onClick={() => { play('hint'); setBoard(step.board); setSelected(step.from); setDemo(true); setTotalHints(n => n + 1); setFeedback({ kind: 'info', text: '看好啦！先选棋子，再走到星星处。演示后你来试一次。' }); }}><Icon name="play" size={17} />{demo ? '演示中…' : '看演示'}</button>}</div>}
        </section>
        <div className="gentle-note"><Icon name="star" /><p>多想一会儿也没关系。<br /><strong>会思考的小脑袋，正在悄悄长大。</strong></p></div>
      </aside>
    </div>
  </main>;
}
