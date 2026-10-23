import type { Board, Move, PieceType, Side } from './xiangqi';
import { difficulties } from './difficulty';
import type { Difficulty } from './difficulty';

// Search uses a compact board and reversible moves; the teaching engine still
// validates every result before the UI applies it. Parity tests compare both.
const GENERAL = 1, ADVISOR = 2, ELEPHANT = 3, HORSE = 4, CANNON = 5, ROOK = 6, PAWN = 7;
const types: Record<PieceType, number> = { general: GENERAL, advisor: ADVISOR, elephant: ELEPHANT, horse: HORSE, cannon: CANNON, rook: ROOK, pawn: PAWN };
const value = [0, 10000, 200, 200, 420, 450, 900, 100];
const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const horses = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const onBoard = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 10;
const palace = (x: number, y: number, side: number) => x >= 3 && x <= 5 && (side === 1 ? y >= 7 : y <= 2);
const crossed = (y: number, side: number) => side === 1 ? y <= 4 : y >= 5;
const color = (side: Side) => side === 'red' ? 1 : -1;
const encode = (from: number, to: number) => from * 90 + to;
const decode = (move: number): Move => { const from = Math.floor(move / 90), to = move % 90; return { from: { x: from % 9, y: Math.floor(from / 9) }, to: { x: to % 9, y: Math.floor(to / 9) } }; };

let seed = 0x51a9b23d;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const zobrist = Array.from({ length: 2 }, () => Array.from({ length: 15 }, () => Uint32Array.from({ length: 90 }, random)));
const sideHash = [random(), random()];
const codeIndex = (code: number) => code > 0 ? code : 7 - code;

class Position {
  cells = new Int8Array(90);
  kings = [-1, -1];
  hashes = [0, 0];
  constructor(board: Board) {
    for (const piece of board) {
      const square = piece.y * 9 + piece.x, code = types[piece.type] * color(piece.side);
      this.cells[square] = code;
      if (Math.abs(code) === GENERAL) this.kings[code > 0 ? 0 : 1] = square;
      this.toggle(code, square);
    }
  }
  toggle(code: number, square: number) { if (code) for (let i = 0; i < 2; i++) this.hashes[i] ^= zobrist[i][codeIndex(code)][square]; }
  key(side: number) { return `${(this.hashes[0] ^ (side < 0 ? sideHash[0] : 0)) >>> 0}:${(this.hashes[1] ^ (side < 0 ? sideHash[1] : 0)) >>> 0}`; }
  make(move: number) {
    const from = Math.floor(move / 90), to = move % 90, piece = this.cells[from], captured = this.cells[to];
    this.toggle(piece, from); this.toggle(piece, to); this.toggle(captured, to);
    this.cells[from] = 0; this.cells[to] = piece;
    if (Math.abs(piece) === GENERAL) this.kings[piece > 0 ? 0 : 1] = to;
    return captured;
  }
  unmake(move: number, captured: number) {
    const from = Math.floor(move / 90), to = move % 90, piece = this.cells[to];
    this.toggle(piece, from); this.toggle(piece, to); this.toggle(captured, to);
    this.cells[from] = piece; this.cells[to] = captured;
    if (Math.abs(piece) === GENERAL) this.kings[piece > 0 ? 0 : 1] = from;
  }
  inCheck(side: number) {
    const king = this.kings[side > 0 ? 0 : 1];
    if (king < 0) return true;
    const x = king % 9, y = Math.floor(king / 9), enemy = -side;
    for (const [dx, dy] of directions) {
      let screen = false;
      for (let nx = x + dx, ny = y + dy; onBoard(nx, ny); nx += dx, ny += dy) {
        const code = this.cells[ny * 9 + nx];
        if (!code) continue;
        if (!screen) {
          if (code === enemy * ROOK || (dx === 0 && code === enemy * GENERAL)) return true;
          screen = true;
        } else { if (code === enemy * CANNON) return true; break; }
      }
      const nx = x + dx, ny = y + dy;
      if (onBoard(nx, ny) && palace(x, y, enemy) && this.cells[ny * 9 + nx] === enemy * GENERAL) return true;
    }
    for (const [dx, dy] of horses) {
      const nx = x - dx, ny = y - dy;
      if (!onBoard(nx, ny) || this.cells[ny * 9 + nx] !== enemy * HORSE) continue;
      const leg = (ny + (Math.abs(dy) === 2 ? Math.sign(dy) : 0)) * 9 + nx + (Math.abs(dx) === 2 ? Math.sign(dx) : 0);
      if (!this.cells[leg]) return true;
    }
    const pawnY = y - (enemy > 0 ? -1 : 1);
    if (onBoard(x, pawnY) && this.cells[pawnY * 9 + x] === enemy * PAWN) return true;
    if (crossed(y, enemy)) for (const dx of [-1, 1]) if (onBoard(x + dx, y) && this.cells[y * 9 + x + dx] === enemy * PAWN) return true;
    for (const [dx, dy] of diagonal) {
      if (palace(x, y, enemy) && onBoard(x + dx, y + dy) && this.cells[(y + dy) * 9 + x + dx] === enemy * ADVISOR) return true;
      if (!crossed(y, enemy) && onBoard(x + dx * 2, y + dy * 2) && this.cells[(y + dy * 2) * 9 + x + dx * 2] === enemy * ELEPHANT && !this.cells[(y + dy) * 9 + x + dx]) return true;
    }
    return false;
  }
  pseudo(side: number, capturesOnly = false) {
    const moves: number[] = [];
    const add = (from: number, x: number, y: number) => {
      if (!onBoard(x, y)) return;
      const to = y * 9 + x, target = this.cells[to];
      if (target * side > 0 || Math.abs(target) === GENERAL || (capturesOnly && !target)) return;
      moves.push(encode(from, to));
    };
    for (let from = 0; from < 90; from++) {
      const piece = this.cells[from]; if (piece * side <= 0) continue;
      const type = Math.abs(piece), x = from % 9, y = Math.floor(from / 9);
      if (type === ROOK || type === CANNON) {
        for (const [dx, dy] of directions) {
          let screen = false;
          for (let nx = x + dx, ny = y + dy; onBoard(nx, ny); nx += dx, ny += dy) {
            const target = this.cells[ny * 9 + nx];
            if (type === ROOK) { add(from, nx, ny); if (target) break; }
            else if (!screen) { if (target) screen = true; else if (!capturesOnly) add(from, nx, ny); }
            else if (target) { add(from, nx, ny); break; }
          }
        }
      } else if (type === HORSE) {
        for (const [dx, dy] of horses) if (onBoard(x + dx, y + dy) && !this.cells[(y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0)) * 9 + x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0)]) add(from, x + dx, y + dy);
      } else if (type === ELEPHANT) {
        for (const [dx, dy] of diagonal) if (onBoard(x + dx * 2, y + dy * 2) && !crossed(y + dy * 2, side) && !this.cells[(y + dy) * 9 + x + dx]) add(from, x + dx * 2, y + dy * 2);
      } else if (type === ADVISOR) {
        for (const [dx, dy] of diagonal) if (palace(x + dx, y + dy, side)) add(from, x + dx, y + dy);
      } else if (type === GENERAL) {
        for (const [dx, dy] of directions) if (palace(x + dx, y + dy, side)) add(from, x + dx, y + dy);
      } else {
        add(from, x, y + (side > 0 ? -1 : 1));
        if (crossed(y, side)) { add(from, x - 1, y); add(from, x + 1, y); }
      }
    }
    return moves;
  }
  legal(side: number, capturesOnly = false, firstOnly = false) {
    const result: number[] = [];
    for (const move of this.pseudo(side, capturesOnly)) {
      const captured = this.make(move), valid = !this.inCheck(side); this.unmake(move, captured);
      if (valid) { result.push(move); if (firstOnly) break; }
    }
    return result;
  }
  evaluate(side: number) {
    let score = 0, count = 0;
    for (const code of this.cells) if (code) count++;
    for (let square = 0; square < 90; square++) {
      const code = this.cells[square]; if (!code) continue;
      const own = code > 0 ? 1 : -1, type = Math.abs(code), x = square % 9, y = Math.floor(square / 9), advance = own > 0 ? 9 - y : y, center = 4 - Math.abs(4 - x);
      let bonus = 0;
      if (type === PAWN) bonus = advance * 8 + (crossed(y, own) ? 55 + center * 6 : center * 2) - (advance === 9 ? 20 : 0);
      else if (type === HORSE) {
        bonus = center * 9 + Math.min(advance, 6) * 4 + (count < 16 ? 18 : 0);
        for (const [dx, dy] of directions) if (onBoard(x + dx, y + dy) && this.cells[(y + dy) * 9 + x + dx]) bonus -= 7;
      } else if (type === ROOK) bonus = center * 3 + Math.min(advance, 6) * 3;
      else if (type === CANNON) bonus = center * 5 + Math.min(advance, 5) * 2 - (count < 12 ? 35 : 0);
      else if (type === GENERAL) bonus = -(advance * 5) + (count > 12 ? center * 5 : 0);
      score += own * (value[type] + bonus);
    }
    // Pressure near the enemy palace matters beyond material and development.
    for (const own of [1, -1]) {
      const king = this.kings[own > 0 ? 0 : 1]; if (king < 0) continue;
      const kx = king % 9, ky = Math.floor(king / 9);
      for (let square = 0; square < 90; square++) {
        const code = this.cells[square], type = Math.abs(code); if (code * own >= 0 || ![ROOK, HORSE, CANNON, PAWN].includes(type)) continue;
        const distance = Math.abs(square % 9 - kx) + Math.abs(Math.floor(square / 9) - ky);
        if (distance <= 4) score -= own * (5 - distance) * (type === ROOK ? 10 : 6);
      }
    }
    return score * side;
  }
}

/** Exposed to compare search move generation against the teaching rules. */
export const searchLegalMoves = (board: Board, side: Side) => new Position(board).legal(color(side)).map(decode);
export interface SearchFrame { board: Board; turn: Side }
export interface SearchOptions { history?: readonly SearchFrame[]; maxDepth?: number; timeMs?: number; maxNodes?: number; now?: () => number }
export interface SearchResult { move: Move | null; depth: number; nodes: number; elapsedMs: number; score: number; limited: boolean }
interface Entry { depth: number; score: number; flag: 'exact' | 'lower' | 'upper'; move: number }
const MATE = 100_000, INF = 1_000_000, STOP = Symbol('search budget exhausted');
const toTable = (score: number, ply: number) => score > 90_000 ? score + ply : score < -90_000 ? score - ply : score;
const fromTable = (score: number, ply: number) => score > 90_000 ? score - ply : score < -90_000 ? score + ply : score;

export function searchBestMove(board: Board, turn: Side, difficulty: Difficulty, options: SearchOptions = {}): SearchResult {
  const level = difficulties.find(item => item.id === difficulty)!;
  const now = options.now || (() => performance.now()), started = now();
  const deadline = started + Math.max(1, options.timeMs ?? level.timeMs), maxNodes = Math.max(1, options.maxNodes ?? level.nodes), maxDepth = Math.max(1, Math.min(8, options.maxDepth ?? level.depth));
  const position = new Position(board), side = color(turn), rootKey = position.key(side), table = new Map<string, Entry>(), repetitions = new Map<string, number>(), historyScores = new Int32Array(8100), killers: number[][] = [];
  const past = [...(options.history || [])];
  if (past.length && new Position(past.at(-1)!.board).key(color(past.at(-1)!.turn)) === rootKey) past.pop();
  for (const frame of past) { const key = new Position(frame.board).key(color(frame.turn)); repetitions.set(key, (repetitions.get(key) || 0) + 1); }
  let nodes = 0;
  const tick = () => { nodes++; if (nodes > maxNodes || ((nodes & 127) === 0 && now() >= deadline)) throw STOP; };
  function rank(move: number): number {
    const captured = Math.abs(position.cells[move % 90]), attacker = Math.abs(position.cells[Math.floor(move / 90)]);
    return captured ? 1_000_000 + value[captured] * 16 - value[attacker] : historyScores[move];
  }
  // A separate sorter applies the principal variation and killer moves first.
  const sort = (moves: number[], best = -1, ply = 0) => {
    return moves.sort((a, b) => priority(b) - priority(a));
    function priority(move: number) { return move === best ? 10_000_000 : rank(move) + (killers[ply]?.includes(move) ? 500_000 : 0); }
  };
  function visit(current: number, depth: number, alpha: number, beta: number, ply: number, quiet: number): number {
    tick();
    const key = position.key(current), seen = repetitions.get(key) || 0;
    if (seen >= 2) return 0;
    repetitions.set(key, seen + 1);
    try {
      const check = position.inCheck(current), originalAlpha = alpha;
      const atHorizon = depth <= 0;
      const cached = !atHorizon && !seen ? table.get(key) : undefined;
      if (cached && cached.depth >= depth) {
        const score = fromTable(cached.score, ply);
        if (cached.flag === 'exact' || (cached.flag === 'lower' && score >= beta) || (cached.flag === 'upper' && score <= alpha)) return score;
      }
      if (atHorizon) {
        if (!position.legal(current, false, true).length) return -MATE + ply;
        const standing = position.evaluate(current);
        if (ply >= 28 || (quiet <= 0 && (!check || quiet <= -2))) return standing;
        if (!check) { if (standing >= beta) return standing; alpha = Math.max(alpha, standing); }
      }
      const moves = sort(position.legal(current, atHorizon && !check), cached?.move, ply);
      if (!moves.length) return atHorizon && !check ? alpha : -MATE + ply;
      let best = -INF, bestMove = moves[0];
      for (const move of moves) {
        const captured = position.make(move);
        let score: number;
        try { score = -visit(-current, depth - 1, -beta, -alpha, ply + 1, atHorizon ? quiet - 1 : quiet); }
        finally { position.unmake(move, captured); }
        if (score > best) { best = score; bestMove = move; }
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
          if (!captured && !atHorizon) { killers[ply] = [move, ...(killers[ply] || []).filter(item => item !== move)].slice(0, 2); historyScores[move] = Math.min(200_000, historyScores[move] + depth * depth); }
          break;
        }
      }
      // Quiet positions can keep the stand-pat score rather than capture.
      if (atHorizon && !check) best = Math.max(best, originalAlpha, position.evaluate(current));
      if (!atHorizon && !seen && table.size < 100_000) table.set(key, { depth, score: toTable(best, ply), move: bestMove, flag: best <= originalAlpha ? 'upper' : best >= beta ? 'lower' : 'exact' });
      return best;
    } finally { if (seen) repetitions.set(key, seen); else repetitions.delete(key); }
  }
  const roots = sort(position.legal(side));
  if (!roots.length) return { move: null, depth: 0, nodes, elapsedMs: now() - started, score: -MATE, limited: false };
  let bestMove = roots[0], bestScore = position.evaluate(side), completedDepth = 0, limited = false;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationMove = bestMove, iterationScore = -INF, alpha = -INF;
    repetitions.set(rootKey, (repetitions.get(rootKey) || 0) + 1);
    try {
      for (const move of sort(roots, bestMove)) {
        if (now() >= deadline) throw STOP;
        const captured = position.make(move);
        let score: number;
        try { score = -visit(-side, depth - 1, -INF, -alpha, 1, level.quiescence); }
        finally { position.unmake(move, captured); }
        if (score > iterationScore) { iterationScore = score; iterationMove = move; }
        alpha = Math.max(alpha, score);
      }
      bestMove = iterationMove; bestScore = iterationScore; completedDepth = depth;
      if (Math.abs(bestScore) > MATE - 100) break;
    } catch (error) { if (error !== STOP) throw error; limited = true; break; }
    finally { const count = repetitions.get(rootKey)! - 1; if (count) repetitions.set(rootKey, count); else repetitions.delete(rootKey); }
  }
  return { move: decode(bestMove), depth: completedDepth, nodes, elapsedMs: now() - started, score: bestScore, limited };
}
