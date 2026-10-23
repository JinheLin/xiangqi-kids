import { useEffect, useRef, useState } from 'react';
import { difficulties } from '../engine/difficulty';
import type { Difficulty } from '../engine/difficulty';
import { searchBestMove } from '../engine/search';
import type { SearchFrame, SearchResult } from '../engine/search';
import { validateMove } from '../engine/xiangqi';
import type { Board, Move, Side } from '../engine/xiangqi';

interface Options { enabled: boolean; board: Board; side: Side; difficulty: Difficulty; history: readonly SearchFrame[]; delayMs: number; onMove: (move: Move) => void }
/** Each position owns its worker. Undo, navigation and settings terminate it. */
export function useComputerMove({ enabled, board, side, difficulty, history, delayMs, onMove }: Options) {
  const [visible, setVisible] = useState(document.visibilityState !== 'hidden');
  const [notice, setNotice] = useState('');
  const callback = useRef(onMove); callback.current = onMove;
  const current = useRef({ enabled: enabled && visible, board, side, difficulty, history });
  current.current = { enabled: enabled && visible, board, side, difficulty, history };
  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!enabled || !visible) return;
    let cancelled = false, settled = false, worker: Worker | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const isCurrent = () => !cancelled && !settled && current.current.enabled && current.current.board === board && current.current.side === side && current.current.difficulty === difficulty && current.current.history === history;
    const finish = (move: Move | null) => {
      if (!isCurrent()) return;
      settled = true; worker?.terminate(); clearTimeout(watchdog);
      if (move && validateMove(board, move, side).ok) callback.current(move);
    };
    const fallback = () => {
      if (!isCurrent()) return;
      worker?.terminate(); clearTimeout(watchdog);
      setNotice('深度思考暂不可用，本步使用基础陪练。可以继续下棋。');
      finish(searchBestMove(board, side, 'starter', { maxNodes: 500, timeMs: 20 }).move);
    };
    const timer = setTimeout(() => {
      setNotice('');
      try {
        worker = new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<{ result?: SearchResult; error?: boolean }>) => {
          if (!isCurrent()) return;
          const move = event.data.result?.move;
          if (move && validateMove(board, move, side).ok) finish(move); else fallback();
        };
        worker.onerror = event => { event.preventDefault(); fallback(); };
        worker.onmessageerror = fallback;
        watchdog = setTimeout(fallback, difficulties.find(level => level.id === difficulty)!.timeMs + 4_000);
        worker.postMessage({ board, side, difficulty, history });
      } catch { fallback(); }
    }, delayMs);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(watchdog); worker?.terminate(); };
  }, [enabled, visible, board, side, difficulty, history, delayMs]);
  return notice;
}
