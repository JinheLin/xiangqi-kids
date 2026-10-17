import { lessons } from '../data/curriculum';
import { describe, expect, it } from 'vitest';
import { applyMove, at, choosePracticeMove, isInCheck, legalMoves, positionKey, validateMove } from '../engine/xiangqi';
import type { Board, Piece } from '../engine/xiangqi';
import { advanceGuide, assessGuideMove, createGuideGame, explainCompanionMove, guideGoals, guideReview, guideStats, suggestGuideMove, threatsTo } from './coach';
const piece = (type: Piece['type'], side: Piece['side'], x: number, y: number): Piece => ({ id: `${side}-${type}-${x}-${y}`, type, side, x, y });
const base = (): Board => [piece('general', 'red', 4, 9), piece('general', 'black', 4, 0), piece('pawn', 'red', 4, 5)];

describe('guided play analysis', () => {
  it.each(guideGoals)('$title starts with both generals and legal choices', goal => {
    const board = goal.board();
    expect(board.filter(p => p.type === 'general')).toHaveLength(2);
    expect(isInCheck(board, 'black')).toBe(false);
    expect(legalMoves(board, 'red').length).toBeGreaterThan(0);
    expect(isInCheck(board, 'red')).toBe(goal.id === 'escape');
  });
  it('detects a rook walking into a legal horse capture, without moving the board', () => {
    const board = guideGoals[1].board().filter(p => !(p.side === 'black' && p.type === 'pawn')), before = positionKey(board, 'red');
    const advice = assessGuideMove(board, { from: { x: 0, y: 8 }, to: { x: 0, y: 6 } });
    expect(advice.warning).toContain('黑方马'); expect(advice.warning).toContain('你的车'); expect(advice.safe).toBe(false);
    expect(positionKey(board, 'red')).toBe(before);
  });
  it('finds a newly undefended piece even if it was already attacked before its protector moved', () => {
    const board = [...base(), piece('rook', 'red', 0, 6), piece('rook', 'red', 2, 6), piece('rook', 'black', 0, 0)];
    const advice = assessGuideMove(board, { from: { x: 2, y: 6 }, to: { x: 2, y: 7 } });
    expect(advice.kind).toBe('risk'); expect(advice.warning).toContain('黑方车');
  });
  it('does not call a fair, defended rook exchange a blunder', () => {
    const board = [...base(), piece('rook', 'red', 0, 6), piece('rook', 'red', 2, 5), piece('pawn', 'black', 0, 5), piece('rook', 'black', 0, 0)];
    const advice = assessGuideMove(board, { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } });
    expect(advice.warning).toBeUndefined(); expect(advice.captured).toBe(true);
  });
  it('ignores a pinned attacker whose capture would expose its own general', () => {
    const board = [piece('general', 'red', 3, 9), piece('general', 'black', 4, 0), piece('rook', 'red', 4, 7), piece('rook', 'black', 4, 3), piece('pawn', 'red', 0, 3)];
    expect(threatsTo(board, 'red').some(t => t.victim.x === 0 && t.victim.y === 3)).toBe(false);
  });
  it('recognizes safe captures and a completed capture goal', () => {
    const frames = createGuideGame('capture');
    const next = advanceGuide(frames, { from: { x: 0, y: 8 }, to: { x: 0, y: 5 } });
    expect(next.at(-1)!.advice?.safe).toBe(true); expect(next.at(-1)!.advice?.captured).toBe(true);
    expect(guideStats(next, 'capture')).toMatchObject({ count: 1, complete: true, safe: 1 });
  });
  it('requires an actual legal escape before awarding the check-escape goal', () => {
    const frames = createGuideGame('escape'), board = frames[0].board;
    expect(advanceGuide(frames, { from: { x: 0, y: 8 }, to: { x: 0, y: 7 } })).toBe(frames);
    const move = legalMoves(board, 'red')[0], next = advanceGuide(frames, move);
    expect(isInCheck(next.at(-1)!.board, 'red')).toBe(false);
    expect(guideStats(next, 'escape').complete).toBe(true);
    expect(next.at(-1)!.advice?.message).toContain('解除了将军');
  });
  it('three hints suggest one legal move without playing it for the child', () => {
    for (const goal of guideGoals) {
      const board = goal.board(), before = JSON.stringify(board), suggestion = suggestGuideMove(board)!;
      expect(suggestion.hints).toHaveLength(3);
      expect(validateMove(board, suggestion.move, 'red').ok).toBe(true);
      expect(JSON.stringify(board)).toBe(before);
    }
  });
  it('records a risky attempt and returns the exact prior position for retry', () => {
    const frames = createGuideGame('capture');
    const move = { from: { x: 0, y: 8 }, to: { x: 0, y: 6 } };
    const after = advanceGuide(frames, move), reply = choosePracticeMove(after.at(-1)!.board, 'black')!;
    expect(at(after.at(-1)!.board, reply.to)?.type).toBe('rook');
    expect(explainCompanionMove(after.at(-1)!.board, reply)).toContain('吃到了你的车');
    const played = advanceGuide(after, reply), review = guideReview(played);
    expect(review.retry?.index).toBe(1); expect(review.good).toBeUndefined();
    expect(positionKey(played.slice(0, review.retry!.index).at(-1)!.board, 'red')).toBe(positionKey(frames[0].board, 'red'));
  });
  it('all companion replies are legal and preserve both generals', () => {
    const board = guideGoals[1].board(), next = applyMove(board, { from: { x: 0, y: 8 }, to: { x: 0, y: 5 } });
    const reply = choosePracticeMove(next, 'black')!;
    expect(validateMove(next, reply, 'black').ok).toBe(true);
    expect(applyMove(next, reply).filter(p => p.type === 'general')).toHaveLength(2);
  });
});


describe('guided endings', () => {
  it.each(['checkmate', 'stalemate'])('explains %s without capturing a general', id => {
    const step = lessons.find(lesson => lesson.id === id)!.steps[0];
    if (step.kind !== 'move') throw new Error('Expected a movement task');
    const advice = assessGuideMove(step.board, step);
    expect(advice.kind).toBe('win'); expect(advice.warning).toBeUndefined();
    expect(applyMove(step.board, step).filter(piece => piece.type === 'general')).toHaveLength(2);
  });
});


it('announces the teaching pause on a third occurrence of the same position', () => {
  let frames = createGuideGame('safe');
  frames[0].board = [...base(), piece('rook', 'red', 0, 9), piece('rook', 'black', 8, 0)];
  const cycle = [
    { from: { x: 0, y: 9 }, to: { x: 0, y: 8 } },
    { from: { x: 8, y: 0 }, to: { x: 8, y: 1 } },
    { from: { x: 0, y: 8 }, to: { x: 0, y: 9 } },
    { from: { x: 8, y: 1 }, to: { x: 8, y: 0 } },
  ];
  for (const move of [...cycle, ...cycle]) frames = advanceGuide(frames, move);
  expect(frames).toHaveLength(9); expect(frames.at(-1)!.message).toContain('三次');
});
