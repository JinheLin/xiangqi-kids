import { applyMove, at, choosePracticeMove, getOutcome, initialBoard, isInCheck, legalMoves, opposite, pieceLabel, pieceName, pieceValues, positionKey, samePoint, validateMove } from '../engine/xiangqi';
import type { Board, Move, Piece, Side } from '../engine/xiangqi';

export type GoalId = 'safe' | 'capture' | 'escape';
export interface GuideGoal { id: GoalId; title: string; description: string; target: number; board: () => Board }
const p = (type: Piece['type'], side: Side, x: number, y: number): Piece => ({ id: `${side}-${type}-${x}-${y}`, type, side, x, y });
export const guideGoals: GuideGoal[] = [
  { id: 'safe', title: '安全走棋', description: '从完整棋局开始，尝试走出 5 步没有明显送子的棋。', target: 5, board: initialBoard },
  { id: 'capture', title: '练习吃子', description: '从小棋局开始，找到一次安全吃子的机会。', target: 1, board: () => [p('general', 'red', 4, 9), p('general', 'black', 4, 0), p('pawn', 'red', 4, 5), p('rook', 'red', 0, 8), p('pawn', 'black', 0, 5), p('horse', 'black', 2, 7)] },
  { id: 'escape', title: '练习应将', description: '帅被将军了，先找一步合法的走法解除危险。', target: 1, board: () => [p('general', 'red', 4, 9), p('general', 'black', 4, 0), p('rook', 'black', 4, 6), p('rook', 'red', 0, 8), p('advisor', 'red', 3, 9)] },
];
export interface Threat { move: Move; attacker: Piece; victim: Piece }
export interface MoveAdvice { kind: 'quiet' | 'capture' | 'escape' | 'check' | 'win' | 'risk'; message: string; why: string; warning?: string; loss: number; safe: boolean; captured: boolean; escaped: boolean }
export interface GuideFrame { board: Board; turn: Side; lastMove: Move | null; message: string; advice?: MoveAdvice; actor?: Side }
export const createGuideGame = (goal: GoalId): GuideFrame[] => [{ board: guideGoals.find(g => g.id === goal)!.board(), turn: 'red', lastMove: null, message: goal === 'escape' ? '帅正在被将军。先试试移动帅、挡住进攻，或者吃掉进攻的棋子。' : '你执红棋，我执黑棋。走之前，先看自己的帅，再看看有没有伙伴需要保护。' }];
export const describeMove = (board: Board, move: Move) => `${pieceName(at(board, move.from)!)}从第${move.from.x + 1}列第${move.from.y + 1}行，走到第${move.to.x + 1}列第${move.to.y + 1}行`;

/** Only legal, immediate captures count. A pinned piece is not an attacker. */
export function threatsTo(board: Board, side: Side): Threat[] {
  return legalMoves(board, opposite(side)).flatMap(move => {
    const victim = at(board, move.to), attacker = at(board, move.from)!;
    return victim?.side === side && victim.type !== 'general' ? [{ move, attacker, victim }] : [];
  });
}

export function assessGuideMove(board: Board, move: Move, side: Side = 'red'): MoveAdvice {
  const validation = validateMove(board, move, side);
  if (!validation.ok) throw new Error(validation.reason);
  const moved = at(board, move.from)!, captured = at(board, move.to), next = applyMove(board, move);
  const escaped = isInCheck(board, side), outcome = getOutcome(next, opposite(side));
  const base = { loss: 0, safe: true, captured: !!captured, escaped };
  if (outcome.winner === side) return { ...base, kind: 'win', message: outcome.kind === 'checkmate' ? '将死啦！你的这步棋让对方无法解除将军。' : '对方已经没有合法走法了。按象棋规则，这一方困毙，你获胜！', why: '象棋的胜负看队长是否还能安全行动，不需要真的吃掉将。' };
  const before = threatsTo(board, side);
  const previousLoss = (victim: Piece) => Math.max(0, ...before.filter(t => t.victim.id === victim.id).map(t => {
    const reply = applyMove(board, t.move);
    const defended = legalMoves(reply, side).some(move => samePoint(move.to, t.move.to));
    return pieceValues[t.victim.type] - (defended ? pieceValues[t.attacker.type] : 0);
  }));
  const risks = threatsTo(next, side).map(threat => {
    const replyBoard = applyMove(next, threat.move);
    const canRecapture = legalMoves(replyBoard, side).some(reply => samePoint(reply.to, threat.move.to));
    const loss = pieceValues[threat.victim.type] - (canRecapture ? pieceValues[threat.attacker.type] : 0) - (captured ? pieceValues[captured.type] : 0);
    return { ...threat, loss, canRecapture };
  }).filter(risk => risk.loss > 0 && (risk.victim.id === moved.id || risk.loss > previousLoss(risk.victim))).sort((a, b) => b.loss - a.loss);
  const risk = risks[0];
  if (risk) {
    const warning = `这步以后，${pieceName(risk.attacker)}可以吃到你的${pieceLabel(risk.victim)}。${risk.canRecapture ? '即使能回吃，这次交换也可能损失更多棋力。' : '暂时没有发现能马上回吃它的伙伴。'}`;
    return { ...base, kind: 'risk', safe: false, loss: risk.loss, warning, message: `你选择试试看。${warning}`, why: '这是下一步的直接吃子检查。可以考虑移开被攻击的棋子、加上保护，或寻找更有价值的机会；更远的变化还要继续观察。' };
  }
  if (escaped) return { ...base, kind: 'escape', message: '保护好队长了！你用这一步解除了将军。', why: '被将军时要先解除危险。移动帅、挡住进攻、吃掉进攻的棋子，都可以成为应将办法。' };
  if (outcome.kind === 'check') return { ...base, kind: 'check', message: `你的${pieceLabel(moved)}将军了！对方下一步必须先保护将。`, why: '将军能让对方先应对队长的危险。也要留意进攻棋子有没有伙伴照应。' };
  if (captured) return { ...base, kind: 'capture', message: `吃到了${pieceName(captured)}！没有发现这步带来的明显吃子损失。`, why: '吃子前先看落点是否被攻击，再想想对方能否回吃。这次检查只看直接吃子和回吃，还要留意后续变化。' };
  const development = moved.type === 'rook' ? '车沿直线活动起来了。' : moved.type === 'horse' ? '小马开始参与走棋了。' : moved.type === 'cannon' ? '炮沿直线换好了位置。' : moved.type === 'pawn' ? '小兵向新的位置出发了。' : '这一步照顾到了自己的阵地。';
  return { ...base, kind: 'quiet', message: `${development}没有发现这步带来的明显送子，继续观察对方会怎么走。`, why: '先确认自己的帅安全，再检查走动的棋子和新露出的伙伴有没有直接吃子危险。没有直接危险，不代表已经看清所有后续变化。' };
}

export function explainCompanionMove(board: Board, move: Move): string {
  const piece = at(board, move.from)!, captured = at(board, move.to), next = applyMove(board, move);
  const outcome = getOutcome(next, 'red');
  if (outcome.winner) return outcome.kind === 'checkmate' ? '我这一步形成了将死。你的帅正在被攻击，而且没有合法的应将办法。一起回看前面的选择吧。' : '轮到红方时已经没有合法走法了，这是困毙。这盘黑方获胜，可以回到复盘里再试。';
  if (outcome.kind === 'check') return `我用${pieceLabel(piece)}将军了。现在先保护帅：想想能不能移动帅、挡住进攻，或者吃掉进攻的棋子。`;
  if (isInCheck(board, 'black')) return `我移动${pieceLabel(piece)}，先解除了将军。轮到你，看看下一步还能怎样安排。`;
  if (captured) return `我用${pieceLabel(piece)}吃到了你的${pieceLabel(captured)}。先看看剩下的伙伴有没有需要保护的。`;
  const threat = threatsTo(next, 'red').find(t => t.attacker.id === piece.id);
  if (threat) return `我的${pieceLabel(piece)}现在能攻击你的${pieceLabel(threat.victim)}。留意这个伙伴，想想怎样保护它。`;
  return `我把${pieceLabel(piece)}走到了第${move.to.x + 1}列第${move.to.y + 1}行。轮到你了，先看帅，再看伙伴是否安全。`;
}
export function advanceGuide(frames: GuideFrame[], move: Move, advice?: MoveAdvice): GuideFrame[] {
  const current = frames.at(-1)!;
  if (!validateMove(current.board, move, current.turn).ok) return frames;
  const message = current.turn === 'red' ? (advice || assessGuideMove(current.board, move)).message : explainCompanionMove(current.board, move);
  const next = [...frames, { board: applyMove(current.board, move), turn: opposite(current.turn), lastMove: move, message, actor: current.turn, advice: current.turn === 'red' ? advice || assessGuideMove(current.board, move) : undefined }];
  const last = next.at(-1)!;
  if (next.filter(frame => positionKey(frame.board, frame.turn) === positionKey(last.board, last.turn)).length >= 3) last.message = '同一个局面已经出现三次了。本次教学练习先暂停，一起复盘，或悔棋换一个选择吧。';
  return next;
}
export function guideStats(frames: GuideFrame[], goal: GoalId) {
  const moves = frames.filter(f => f.actor === 'red');
  const safe = moves.filter(f => f.advice?.safe).length;
  const count = goal === 'safe' ? safe : moves.filter(f => goal === 'capture' ? f.advice?.safe && f.advice.captured : f.advice?.escaped).length;
  return { safe, childMoves: moves.length, count, complete: count >= guideGoals.find(g => g.id === goal)!.target };
}
export function suggestGuideMove(board: Board) {
  const move = choosePracticeMove(board, 'red');
  if (!move) return null;
  const piece = at(board, move.from)!, advice = assessGuideMove(board, move);
  return { move, advice, hints: [isInCheck(board, 'red') ? '队长正在被将军。先找能解除危险的一步。' : advice.captured && advice.safe ? '观察一下，有没有对方的棋子可以吃，并且不会明显吃亏？' : '先看帅是否安全，再找能让伙伴活动起来的一步。', `可以留意这枚${pieceName(piece)}。棋盘上已经为你圈出来了。`, `试着把${pieceLabel(piece)}走到第${move.to.x + 1}列第${move.to.y + 1}行，金色星星就是建议落点。${advice.safe ? '' : '目前的局面仍有风险，这只是可以考虑的一步。'}`] };
}
export function guideReview(frames: GuideFrame[]) {
  const choices = frames.map((frame, index) => ({ frame, index })).filter(item => item.frame.actor === 'red');
  const good = choices.filter(item => item.frame.advice?.safe).sort((a, b) => Number(b.frame.advice?.captured || b.frame.advice?.escaped) - Number(a.frame.advice?.captured || a.frame.advice?.escaped))[0];
  const retry = choices.filter(item => item.frame.advice?.warning).sort((a, b) => (b.frame.advice?.loss || 0) - (a.frame.advice?.loss || 0))[0];
  return { good, retry };
}
