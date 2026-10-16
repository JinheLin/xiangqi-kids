/** A UI-independent Xiangqi engine. Coordinates: black at y=0; red at y=9. */
export type Side = 'red' | 'black';
export type PieceType = 'rook' | 'horse' | 'cannon' | 'pawn' | 'elephant' | 'advisor' | 'general';
export interface Point { x: number; y: number }
export interface Piece extends Point { id: string; side: Side; type: PieceType }
export type Board = Piece[];
export interface Move { from: Point; to: Point }
export interface Validation { ok: boolean; reason: string }
export interface Outcome { kind: 'playing' | 'check' | 'checkmate' | 'stalemate'; winner?: Side }

export const opposite = (side: Side): Side => side === 'red' ? 'black' : 'red';
export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const inside = (p: Point) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < 9 && p.y >= 0 && p.y < 10;
export const at = (board: Board, p: Point) => board.find(piece => samePoint(piece, p));
export const pieceLabel = (piece: Pick<Piece, 'type' | 'side'>) => ({
  red: { rook: '车', horse: '马', cannon: '炮', pawn: '兵', elephant: '相', advisor: '仕', general: '帅' },
  black: { rook: '车', horse: '马', cannon: '炮', pawn: '卒', elephant: '象', advisor: '士', general: '将' },
})[piece.side][piece.type];
export const sideLabel = (side: Side) => side === 'red' ? '红方' : '黑方';
export const pieceName = (piece: Piece) => `${sideLabel(piece.side)}${pieceLabel(piece)}`;
export const inPalace = (p: Point, side: Side) => p.x >= 3 && p.x <= 5 && (side === 'red' ? p.y >= 7 && p.y <= 9 : p.y >= 0 && p.y <= 2);
export const crossedRiver = (p: Piece) => p.side === 'red' ? p.y <= 4 : p.y >= 5;

export function initialBoard(): Board {
  const back: PieceType[] = ['rook', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'rook'];
  return (['black', 'red'] as Side[]).flatMap(side => {
    const y = side === 'red' ? 9 : 0;
    return [
      ...back.map((type, x) => ({ id: `${side}-${type}-${x}`, type, side, x, y })),
      ...[1, 7].map(x => ({ id: `${side}-cannon-${x}`, type: 'cannon' as const, side, x, y: side === 'red' ? 7 : 2 })),
      ...[0, 2, 4, 6, 8].map(x => ({ id: `${side}-pawn-${x}`, type: 'pawn' as const, side, x, y: side === 'red' ? 6 : 3 })),
    ];
  });
}

export function between(board: Board, from: Point, to: Point): number {
  return board.filter(p => from.x === to.x
    ? p.x === from.x && p.y > Math.min(from.y, to.y) && p.y < Math.max(from.y, to.y)
    : p.y === from.y && p.x > Math.min(from.x, to.x) && p.x < Math.max(from.x, to.x)).length;
}

/** Movement geometry, also used to detect attacks on a general. */
function movementError(board: Board, piece: Piece, to: Point, attack = false): string | null {
  const dx = to.x - piece.x, dy = to.y - piece.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const target = at(board, to);
  switch (piece.type) {
    case 'rook':
      if (dx !== 0 && dy !== 0) return '车走直线：只能横着或竖着走，不能斜走哦。';
      return between(board, piece, to) === 0 ? null : '前面有棋子挡住了，车不能跳过它。';
    case 'horse': {
      if (!((ax === 1 && ay === 2) || (ax === 2 && ay === 1))) return '马走“日”：先直走一格，再向外斜走一格。';
      const leg = { x: piece.x + (ax === 2 ? Math.sign(dx) : 0), y: piece.y + (ay === 2 ? Math.sign(dy) : 0) };
      return at(board, leg) ? '蹩马腿啦！马先直走的那一格被挡住了，换个方向试试。' : null;
    }
    case 'cannon': {
      if (dx !== 0 && dy !== 0) return '炮也走直线，只能横着或竖着走。';
      const screens = between(board, piece, to);
      if (target) return screens === 1 ? null : screens === 0 ? '炮吃子要隔一个“炮架”，中间还没有炮架哦。' : '炮架太多啦！炮吃子时，中间只能隔一个棋子。';
      return screens === 0 ? null : '炮不吃子时不能跳过棋子，要沿着空的直线走。';
    }
    case 'elephant': {
      if (ax !== 2 || ay !== 2) return '相（象）走“田”：斜着走两格。';
      if (piece.side === 'red' ? to.y < 5 : to.y > 4) return '相（象）要留在自己这一边，不能过河。';
      return at(board, { x: piece.x + dx / 2, y: piece.y + dy / 2 }) ? '塞象眼啦！“田”字中心有棋子挡住，不能走过去。' : null;
    }
    case 'advisor':
      if (!inPalace(to, piece.side)) return '仕（士）要守在九宫里，不能走出去。';
      return ax === 1 && ay === 1 ? null : '仕（士）每次只能斜走一格。';
    case 'general':
      if (attack && target?.type === 'general' && dx === 0 && between(board, piece, to) === 0) return null;
      if (!inPalace(to, piece.side)) return '帅（将）要留在自己的九宫里。';
      return ax + ay === 1 ? null : '帅（将）每次横着或竖着走一格，不能斜走。';
    case 'pawn': {
      const forward = piece.side === 'red' ? -1 : 1;
      if (dy === forward && dx === 0) return null;
      if (dy === 0 && ax === 1 && crossedRiver(piece)) return null;
      if (dy * forward < 0) return '兵（卒）只能向前，永远不能后退哦。';
      if (dy === 0 && ax === 1) return '还没过河呢，兵（卒）现在只能向前走一格。';
      return '兵（卒）一次只走一格，过河后也不能斜走或后退。';
    }
  }
}

export function generalsFacing(board: Board): boolean {
  const red = board.find(p => p.type === 'general' && p.side === 'red');
  const black = board.find(p => p.type === 'general' && p.side === 'black');
  return !!red && !!black && red.x === black.x && between(board, red, black) === 0;
}

export function isInCheck(board: Board, side: Side): boolean {
  const general = board.find(p => p.type === 'general' && p.side === side);
  if (!general) return true;
  return board.some(p => p.side !== side && movementError(board, p, general, true) === null);
}

/** Pure transition. Call validateMove first for untrusted moves. */
export function applyMove(board: Board, move: Move): Board {
  const piece = at(board, move.from);
  if (!piece) return board;
  return board.filter(p => p.id === piece.id || !samePoint(p, move.to)).map(p => p.id === piece.id ? { ...p, ...move.to } : { ...p });
}

export function validateMove(board: Board, move: Move, turn: Side): Validation {
  const fail = (reason: string): Validation => ({ ok: false, reason });
  if (!inside(move.from) || !inside(move.to)) return fail('落点要在棋盘的交叉点上哦。');
  const piece = at(board, move.from), target = at(board, move.to);
  if (!piece) return fail('先点一下你想移动的棋子吧。');
  if (piece.side !== turn) return fail(`现在轮到${sideLabel(turn)}，请选择自己的棋子。`);
  if (samePoint(move.from, move.to)) return fail('棋子还在原地，试试另一个落点吧。');
  if (target?.side === turn) return fail('这是自己的伙伴，不能吃自己的棋子哦。');
  if (target?.type === 'general') return fail('我们用“将死”结束对局，不需要真的吃掉帅或将。');
  const error = movementError(board, piece, move.to);
  if (error) return fail(error);
  const next = applyMove(board, move);
  if (generalsFacing(next)) return fail('将帅不能直接照面！中间至少要隔一个棋子。');
  if (isInCheck(next, turn)) return fail(isInCheck(board, turn) ? '还没解除将军哦。可以移动帅、挡住进攻，或吃掉进攻的棋子。' : '这样会让自己的帅（将）被攻击，先保护好它吧。');
  return { ok: true, reason: target ? `吃到了${pieceLabel(target)}！` : '这步走得对！' };
}

export function legalMoves(board: Board, turn: Side, from?: Point): Move[] {
  const moves: Move[] = [];
  for (const p of board) {
    if (p.side !== turn || (from && !samePoint(from, p))) continue;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
      const move = { from: { x: p.x, y: p.y }, to: { x, y } };
      if (validateMove(board, move, turn).ok) moves.push(move);
    }
  }
  return moves;
}

export function getOutcome(board: Board, turn: Side): Outcome {
  const check = isInCheck(board, turn);
  if (!legalMoves(board, turn).length) return { kind: check ? 'checkmate' : 'stalemate', winner: opposite(turn) };
  return { kind: check ? 'check' : 'playing' };
}

export function positionKey(board: Board, turn: Side): string {
  return turn + ':' + board.map(p => `${p.side[0]}${p.type}@${p.x},${p.y}`).sort().join(';');
}

const values: Record<PieceType, number> = { general: 10000, rook: 900, cannon: 450, horse: 420, elephant: 200, advisor: 200, pawn: 100 };
function evaluate(board: Board, side: Side): number {
  return board.reduce((score, p) => {
    const advance = p.side === 'red' ? 9 - p.y : p.y;
    const development = p.type === 'pawn' ? advance * 8 + (crossedRiver(p) ? 50 : 0) : p.type === 'horse' ? advance * 3 + (4 - Math.abs(4 - p.x)) * 3 : 0;
    return score + (p.side === side ? 1 : -1) * (values[p.type] + development);
  }, 0);
}

/** Small, deterministic two-ply companion. Always chooses a legal move. */
export function choosePracticeMove(board: Board, side: Side): Move | null {
  let best: Move | null = null, bestScore = -Infinity;
  for (const move of legalMoves(board, side)) {
    const next = applyMove(board, move);
    const replies = legalMoves(next, opposite(side));
    let score = evaluate(next, side);
    if (!replies.length) score = 100000;
    else score = Math.min(...replies.map(reply => evaluate(applyMove(next, reply), side)));
    if (isInCheck(next, opposite(side))) score += 10;
    if (score > bestScore) { bestScore = score; best = move; }
  }
  return best;
}
