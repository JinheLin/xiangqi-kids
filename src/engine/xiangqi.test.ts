import { describe, expect, it } from 'vitest';
import { applyMove, at, choosePracticeMove, generalsFacing, getOutcome, initialBoard, inside, isInCheck, legalMoves, positionKey, validateMove } from './xiangqi';
import type { Board, Move, Piece, PieceType, Side } from './xiangqi';
import { lessons, makePiece } from '../data/curriculum';

const p = (type: PieceType, x: number, y: number, side: Side = 'red'): Piece => makePiece(type, side, x, y);
const base = (...extra: Piece[]): Board => [p('general', 4, 9), p('general', 4, 0, 'black'), p('pawn', 4, 5)].filter(piece => !extra.some(e => e.x === piece.x && e.y === piece.y)).concat(extra);
const m = (x: number, y: number, tx: number, ty: number): Move => ({ from: { x, y }, to: { x: tx, y: ty } });
const valid = (board: Board, move: Move, side: Side = 'red') => validateMove(board, move, side).ok;

describe('board and common legality', () => {
  it('starts with 32 unique pieces on 9 × 10 intersections', () => {
    const board = initialBoard(); expect(board).toHaveLength(32);
    expect(new Set(board.map(p => `${p.x},${p.y}`)).size).toBe(32);
    expect(board.filter(p => p.side === 'red')).toHaveLength(16);
    expect(board.every(inside)).toBe(true);
    expect(at(board, { x: 4, y: 9 })?.type).toBe('general');
    expect(isInCheck(board, 'red')).toBe(false); expect(isInCheck(board, 'black')).toBe(false);
    expect(legalMoves(board, 'red')).toHaveLength(44); expect(legalMoves(board, 'black')).toHaveLength(44);
  });
  it('rejects empty starts, wrong turns, friendly captures, null moves and invalid coordinates', () => {
    const board = initialBoard();
    for (const move of [m(0, 5, 0, 4), m(0, 0, 0, 1), m(0, 9, 1, 9), m(0, 9, 0, 9), m(0, 9, -1, 9), m(0, 9, 0.5, 9)]) expect(valid(board, move)).toBe(false);
  });
  it('captures exactly one enemy without mutating input', () => {
    const board = base(p('rook', 0, 7), p('pawn', 0, 3, 'black'));
    const copy = JSON.stringify(board), next = applyMove(board, m(0, 7, 0, 3));
    expect(valid(board, m(0, 7, 0, 3))).toBe(true); expect(next.length).toBe(board.length - 1);
    expect(at(next, { x: 0, y: 3 })?.side).toBe('red'); expect(JSON.stringify(board)).toBe(copy);
  });
  it('never permits physically capturing a general', () => {
    expect(validateMove(base(p('rook', 4, 3)), m(4, 3, 4, 0), 'red').reason).toContain('将死');
  });
});

describe('all seven pieces', () => {
  it('rook slides orthogonally and cannot jump', () => {
    const board = base(p('rook', 0, 8), p('pawn', 0, 6));
    expect(valid(board, m(0, 8, 3, 8))).toBe(true);
    expect(valid(board, m(0, 8, 0, 5))).toBe(false); expect(valid(board, m(0, 8, 1, 7))).toBe(false);
  });
  it.each([[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [-2, 1], [2, -1], [-2, -1]])('horse leaps (%i,%i) and the corresponding leg can block it', (dx, dy) => {
    const board = base(p('horse', 3, 4));
    const move = m(3, 4, 3 + dx, 4 + dy);
    expect(valid(board, move)).toBe(true);
    const leg = p('pawn', 3 + (Math.abs(dx) === 2 ? Math.sign(dx) : 0), 4 + (Math.abs(dy) === 2 ? Math.sign(dy) : 0), 'black');
    expect(validateMove([...board, leg], move, 'red').reason).toContain('蹩马腿');
  });
  it('horse cannot move in a straight line', () => expect(valid(base(p('horse', 1, 7)), m(1, 7, 1, 5))).toBe(false));
  it('cannon needs exactly one screen for capture and zero for quiet moves', () => {
    const cannon = p('cannon', 1, 8), enemy = p('rook', 1, 1, 'black');
    expect(valid(base(cannon, enemy), m(1, 8, 1, 1))).toBe(false);
    for (const side of ['red', 'black'] as Side[]) expect(valid(base(cannon, enemy, p('pawn', 1, 5, side)), m(1, 8, 1, 1))).toBe(true);
    expect(valid(base(cannon, enemy, p('pawn', 1, 5), p('pawn', 1, 3, 'black')), m(1, 8, 1, 1))).toBe(false);
    expect(valid(base(cannon), m(1, 8, 1, 2))).toBe(true);
    expect(valid(base(cannon, p('pawn', 1, 5)), m(1, 8, 1, 2))).toBe(false);
    expect(valid(base(cannon), m(1, 8, 2, 7))).toBe(false);
  });
  it.each(['red', 'black'] as Side[])('%s pawn respects direction, river and no promotion', side => {
    const start = side === 'red' ? 6 : 3, direction = side === 'red' ? -1 : 1, crossed = side === 'red' ? 4 : 5;
    expect(valid(base(p('pawn', 0, start, side)), m(0, start, 0, start + direction), side)).toBe(true);
    expect(valid(base(p('pawn', 0, start, side)), m(0, start, 1, start), side)).toBe(false);
    expect(valid(base(p('pawn', 0, start, side)), m(0, start, 0, start - direction), side)).toBe(false);
    expect(valid(base(p('pawn', 0, crossed, side)), m(0, crossed, 1, crossed), side)).toBe(true);
    expect(valid(base(p('pawn', 0, crossed, side)), m(0, crossed, 1, crossed + direction), side)).toBe(false);
    const edge = side === 'red' ? 0 : 9;
    const board = base(p('pawn', 0, edge, side)), move = m(0, edge, 1, edge);
    expect(valid(board, move, side)).toBe(true); expect(at(applyMove(board, move), move.to)?.type).toBe('pawn');
  });
  it.each(['red', 'black'] as Side[])('%s elephant cannot cross river or a blocked eye', side => {
    const y = side === 'red' ? 9 : 0, dy = side === 'red' ? -2 : 2;
    expect(valid(base(p('elephant', 2, y, side)), m(2, y, 0, y + dy), side)).toBe(true);
    expect(validateMove(base(p('elephant', 2, y, side), p('pawn', 1, y + dy / 2)), m(2, y, 0, y + dy), side).reason).toContain('塞象眼');
    const bank = side === 'red' ? 5 : 4;
    expect(validateMove(base(p('elephant', 2, bank, side)), m(2, bank, 0, bank + dy), side).reason).toContain('过河');
  });
  it.each(['red', 'black'] as Side[])('%s advisor moves diagonally within the palace', side => {
    const y = side === 'red' ? 9 : 0, inner = side === 'red' ? 8 : 1;
    const board = base(p('advisor', 3, y, side));
    expect(valid(board, m(3, y, 4, inner), side)).toBe(true);
    expect(valid(board, m(3, y, 2, inner), side)).toBe(false);
    expect(valid(board, m(3, y, 3, inner), side)).toBe(false);
  });
  it.each(['red', 'black'] as Side[])('%s general stays in the palace and moves one orthogonal step', side => {
    const y = side === 'red' ? 9 : 0, inner = side === 'red' ? 8 : 1;
    expect(valid(base(), m(4, y, 5, y), side)).toBe(true);
    expect(valid(base(), m(4, y, 5, inner), side)).toBe(false);
    expect(valid(base(), m(4, y, 6, y), side)).toBe(false);
  });
});

describe('general safety and winning', () => {
  it('rejects exposing facing generals', () => {
    const board = [p('general', 4, 9), p('general', 4, 0, 'black'), p('pawn', 4, 4)];
    expect(validateMove(board, m(4, 4, 3, 4), 'red').reason).toContain('照面');
    expect(valid(board, m(4, 4, 4, 3))).toBe(true);
    expect(generalsFacing(board.slice(0, 2))).toBe(true);
    expect(isInCheck(board.slice(0, 2), 'red')).toBe(true);
  });
  it('cannot ignore check or expose a pinned general', () => {
    const checked = base(p('rook', 4, 6, 'black'), p('pawn', 0, 6));
    expect(isInCheck(checked, 'red')).toBe(true); expect(valid(checked, m(0, 6, 0, 5))).toBe(false);
    const pinned = base(p('rook', 0, 9, 'black'), p('rook', 3, 9));
    expect(isInCheck(pinned, 'red')).toBe(false); expect(valid(pinned, m(3, 9, 3, 8))).toBe(false);
  });
  it('detects pawn, horse, and cannon checks including blocked attacks', () => {
    expect(isInCheck(base(p('pawn', 3, 9, 'black')), 'red')).toBe(true);
    expect(isInCheck(base(p('horse', 3, 7, 'black')), 'red')).toBe(true);
    expect(isInCheck(base(p('horse', 3, 7, 'black'), p('pawn', 3, 8)), 'red')).toBe(false);
    expect(isInCheck(base(p('cannon', 4, 3, 'black')), 'red')).toBe(true);
    expect(isInCheck(base(p('cannon', 4, 3, 'black'), p('pawn', 4, 7)), 'red')).toBe(false);
  });
  it('allows escaping, blocking and capturing the attacker', () => {
    expect(valid(base(p('rook', 4, 6, 'black')), m(4, 9, 5, 9))).toBe(true);
    expect(valid(base(p('rook', 0, 9, 'black'), p('rook', 3, 7)), m(3, 7, 3, 9))).toBe(true);
    expect(valid(base(p('rook', 4, 7, 'black'), p('rook', 0, 7)), m(0, 7, 4, 7))).toBe(true);
  });
  it('position keys ignore ids and board array ordering, but include turn', () => {
    const board = initialBoard(); expect(positionKey(board, 'red')).toBe(positionKey([...board].reverse().map(p => ({ ...p, id: 'other' })), 'red'));
    expect(positionKey(board, 'red')).not.toBe(positionKey(board, 'black'));
  });
  it('companion returns a legal move and handles finished games', () => {
    const board = initialBoard(), move = choosePracticeMove(board, 'black');
    expect(move).not.toBeNull(); expect(valid(board, move!, 'black')).toBe(true);
    const step = lessons.find(l => l.id === 'checkmate')!.steps[0];
    if (step.kind !== 'move') throw new Error('Expected move');
    expect(choosePracticeMove(applyMove(step.board, step), 'black')).toBeNull();
  });
});

describe('every curriculum position is legal, solvable and teaches the advertised result', () => {
  it.each(lessons.map(l => [l.id, l] as const))('%s', (_, lesson) => {
    expect(lesson.steps.length).toBeGreaterThan(0);
    for (const step of lesson.steps) {
      expect(step.board.filter(p => p.type === 'general')).toHaveLength(2);
      expect(step.board.every(inside)).toBe(true);
      expect(new Set(step.board.map(p => p.id)).size).toBe(step.board.length);
      expect(new Set(step.board.map(p => `${p.x},${p.y}`)).size).toBe(step.board.length);
      expect(generalsFacing(step.board)).toBe(false);
      if (step.kind === 'identify') expect(step.board.some(p => p.type === step.targetType && p.side === step.targetSide)).toBe(true);
      if (step.kind === 'quiz') expect(step.answer).toBeLessThan(step.options.length);
      if (step.kind === 'move') {
        expect(validateMove(step.board, step, step.turn), `${lesson.id}: ${step.title}`).toMatchObject({ ok: true });
        const next = applyMove(step.board, step), outcome = getOutcome(next, 'black');
        expect(isInCheck(next, step.turn)).toBe(false);
        if (step.result === 'capture') expect(next.length).toBe(step.board.length - 1);
        if (step.result === 'check') expect(outcome.kind).toBe('check');
        if (step.result === 'escape') { expect(isInCheck(step.board, step.turn)).toBe(true); expect(isInCheck(next, step.turn)).toBe(false); }
        if (step.result === 'checkmate' || step.result === 'stalemate') expect(outcome).toEqual({ kind: step.result, winner: 'red' });
      }
    }
  });
});
