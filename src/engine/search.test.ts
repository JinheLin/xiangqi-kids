import { describe, expect, it } from 'vitest';
import { lessons } from '../data/curriculum';
import { guideGoals } from '../guided/coach';
import { difficulties } from './difficulty';
import { searchBestMove, searchLegalMoves } from './search';
import { applyMove, choosePracticeMove, getOutcome, initialBoard, legalMoves, opposite, validateMove } from './xiangqi';
import type { Board, Move, Piece, Side } from './xiangqi';
const key = (move: Move) => `${move.from.x},${move.from.y}-${move.to.x},${move.to.y}`;
const p = (type: Piece['type'], side: Side, x: number, y: number): Piece => ({ id: `${side}-${type}-${x}-${y}`, type, side, x, y });
const limits = { now: () => 0, maxNodes: 500_000 };

describe('search legality matches the teaching rules', () => {
  it('matches every curriculum and guided position for both sides', () => {
    const boards: Board[] = [initialBoard(), ...guideGoals.map(goal => goal.board())];
    for (const lesson of lessons) for (const task of lesson.steps) if ('board' in task) boards.push(task.board);
    for (const board of boards) for (const side of ['red', 'black'] as Side[]) expect(searchLegalMoves(board, side).map(key).sort()).toEqual(legalMoves(board, side).map(key).sort());
  });
  it('matches 120 deterministic plies, including checks, captures and blocked pieces', () => {
    let board = initialBoard(), side: Side = 'red', seed = 97;
    for (let ply = 0; ply < 120; ply++) {
      const moves = legalMoves(board, side);
      expect(searchLegalMoves(board, side).map(key).sort(), `ply ${ply}`).toEqual(moves.map(key).sort());
      if (!moves.length) break;
      seed = (seed * 16807) % 2147483647;
      board = applyMove(board, moves[seed % moves.length]); side = opposite(side);
    }
  });
});
describe('graded search', () => {
  it('finds a quiet forced mate in three plies that the former two-ply companion misses', () => {
    const original = [p('general', 'red', 4, 9), p('general', 'black', 5, 1), p('pawn', 'red', 4, 5), p('rook', 'red', 6, 0), p('rook', 'red', 1, 4)];
    for (const side of ['red', 'black'] as Side[]) {
      const board = side === 'red' ? original : original.map(piece => ({ ...piece, side: opposite(piece.side), y: 9 - piece.y }));
      const forcesMate = (move: Move) => {
        const next = applyMove(board, move), replies = legalMoves(next, opposite(side));
        return !replies.length || replies.every(reply => {
          const after = applyMove(next, reply);
          return legalMoves(after, side).some(finish => getOutcome(applyMove(after, finish), opposite(side)).winner === side);
        });
      };
      expect(forcesMate(choosePracticeMove(board, side)!)).toBe(false);
      for (const level of ['medium', 'hard'] as const) {
        const result = searchBestMove(board, side, level, { ...limits, maxDepth: 3 });
        expect(result.score).toBe(99997); expect(forcesMate(result.move!)).toBe(true);
      }
    }
  });
  it('entry and higher levels avoid a poisoned capture that tempts the first level', () => {
    const board = [p('general', 'red', 4, 9), p('general', 'black', 4, 0), p('pawn', 'red', 4, 5), p('rook', 'red', 0, 8), p('pawn', 'black', 0, 5), p('rook', 'black', 0, 0)];
    const poisoned = '0,8-0,5';
    expect(key(searchBestMove(board, 'red', 'starter', limits).move!)).toBe(poisoned);
    for (const level of ['easy', 'medium', 'hard'] as const) expect(key(searchBestMove(board, 'red', level, limits).move!)).not.toBe(poisoned);
  });
  it.each(difficulties)('$title chooses a legal move without changing the board', level => {
    const board = initialBoard(), before = JSON.stringify(board);
    const result = searchBestMove(board, 'black', level.id, limits);
    expect(result.move).not.toBeNull(); expect(validateMove(board, result.move!, 'black').ok).toBe(true);
    expect(JSON.stringify(board)).toBe(before); expect(result.depth).toBeGreaterThanOrEqual(1);
    expect(result.depth).toBeLessThanOrEqual(level.depth);
  });
  it('finds mate and stalemate wins and never captures a general', () => {
    for (const kind of ['checkmate', 'stalemate']) {
      const task = lessons.flatMap(lesson => lesson.steps).find(task => task.kind === 'move' && task.result === kind);
      if (!task || task.kind !== 'move') throw new Error('Missing terminal fixture');
      const result = searchBestMove(task.board, task.turn || 'red', 'hard', { ...limits, maxDepth: 3 });
      expect(getOutcome(applyMove(task.board, result.move!), opposite(task.turn || 'red')).winner).toBe(task.turn || 'red');
    }
  });
  it('returns no move when checkmated or stalemated', () => {
    const board = [p('general', 'black', 4, 0), p('general', 'red', 4, 9), p('rook', 'red', 4, 1), p('rook', 'red', 3, 1), p('rook', 'red', 5, 1)];
    expect(getOutcome(board, 'black').winner).toBe('red');
    expect(searchBestMove(board, 'black', 'hard', limits).move).toBeNull();
  });
  it('respects node and time budgets and returns a legal completed fallback', () => {
    const board = initialBoard();
    const nodes = searchBestMove(board, 'red', 'hard', { maxNodes: 1, now: () => 0 });
    expect(nodes.limited).toBe(true); expect(nodes.nodes).toBeLessThanOrEqual(2);
    expect(validateMove(board, nodes.move!, 'red').ok).toBe(true);
    let clock = 0;
    const time = searchBestMove(board, 'red', 'hard', { timeMs: 1, now: () => clock++ });
    expect(time.depth).toBe(0); expect(time.limited).toBe(true); expect(validateMove(board, time.move!, 'red').ok).toBe(true);
  });
  it('uses the game history to avoid making a third identical position when a better choice exists', () => {
    const board = initialBoard(), original = searchBestMove(board, 'red', 'starter', limits).move!;
    const repeated = { board: applyMove(board, original), turn: 'black' as const };
    const next = searchBestMove(board, 'red', 'starter', { ...limits, history: [repeated, repeated, { board, turn: 'red' }] });
    expect(key(next.move!)).not.toBe(key(original)); expect(validateMove(board, next.move!, 'red').ok).toBe(true);
  });
});
