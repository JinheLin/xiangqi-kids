import { useRef, useState } from 'react';
import { at, isInCheck, pieceName, pieceLabel, samePoint } from '../engine/xiangqi';
import type { Board as BoardState, Move, Point, Side } from '../engine/xiangqi';

interface BoardProps { board: BoardState; onSquare?: (p: Point) => void; selected?: Point | null; legal?: Point[]; target?: Point; lastMove?: Move | null; turn?: Side; disabled?: boolean; highlight?: Point[] }
const squares = Array.from({ length: 90 }, (_, i) => ({ x: i % 9, y: Math.floor(i / 9) }));
export function ChessBoard({ board, onSquare, selected, legal = [], target, lastMove, turn = 'red', disabled, highlight = [] }: BoardProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(85);
  const checked = isInCheck(board, turn);
  return <div className="chess-board" role="group" aria-label="中国象棋棋盘，9 列 10 行。方向键移动，回车选择。">
    <svg className="board-lines" viewBox="0 0 528 584" aria-hidden="true">
      <rect x="21" y="21" width="486" height="542" rx="2" fill="none" stroke="#BDA477" strokeWidth="1" />
      <g stroke="#A68D62" strokeWidth="1.2">
        {Array.from({ length: 10 }, (_, y) => <line key={`h${y}`} x1="40" x2="488" y1={40 + y * 56} y2={40 + y * 56} />)}
        {Array.from({ length: 9 }, (_, x) => <g key={`v${x}`}><line x1={40 + x * 56} x2={40 + x * 56} y1="40" y2={x === 0 || x === 8 ? 544 : 264} />{x > 0 && x < 8 && <line x1={40 + x * 56} x2={40 + x * 56} y1="320" y2="544" />}</g>)}
        <path d="m208 40 112 112m0-112L208 152m0 280 112 112m0-112L208 544" />
      </g>
      <g stroke="#A68D62" strokeWidth="1.2" fill="none">
        {[{ x: 1, y: 2 }, { x: 7, y: 2 }, { x: 1, y: 7 }, { x: 7, y: 7 }, ...[0, 2, 4, 6, 8].flatMap(x => [{ x, y: 3 }, { x, y: 6 }])].map(({ x, y }) => <g key={`mark${x}${y}`} transform={`translate(${40 + x * 56},${40 + y * 56})`}>{x > 0 && <path d="M-5-12v7h-7M-5 12V5h-7" />}{x < 8 && <path d="M5-12v7h7M5 12V5h7" />}</g>)}
      </g>
      <g fill="#907D58" fontSize="24" fontFamily="serif" letterSpacing="12"><text x="115" y="301">楚河</text><text x="333" y="301">汉界</text></g>
      <g fill="#998A6D" fontSize="11" textAnchor="middle">{Array.from({ length: 9 }, (_, x) => <g key={`coord${x}`}><text x={40 + x * 56} y="15">{x + 1}</text><text x={40 + x * 56} y="577">{['九', '八', '七', '六', '五', '四', '三', '二', '一'][x]}</text></g>)}</g>
    </svg>
    <div className="board-squares" onKeyDown={e => {
      const change = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
      if (change === undefined) return;
      e.preventDefault();
      const x = focus % 9, y = Math.floor(focus / 9);
      const next = Math.max(0, Math.min(9, y + (change === 9 ? 1 : change === -9 ? -1 : 0))) * 9 + Math.max(0, Math.min(8, x + (change === 1 ? 1 : change === -1 ? -1 : 0)));
      setFocus(next); refs.current[next]?.focus();
    }}>
      {squares.map((p, i) => {
        const piece = at(board, p), chosen = !!selected && samePoint(p, selected);
        const possible = legal.some(t => samePoint(p, t));
        const isTarget = !!target && samePoint(p, target);
        const marked = highlight.some(t => samePoint(p, t));
        const last = !!lastMove && (samePoint(p, lastMove.from) || samePoint(p, lastMove.to));
        const inCheck = piece?.type === 'general' && piece.side === turn && checked;
        return <button key={i} ref={el => { refs.current[i] = el; }} type="button" tabIndex={focus === i ? 0 : -1} onFocus={() => setFocus(i)} aria-disabled={disabled || !onSquare} aria-label={`${piece ? pieceName(piece) : '空位'}，第${p.x + 1}列第${p.y + 1}行${isTarget ? '，目标' : ''}${chosen ? '，已选中' : ''}${inCheck ? '，被将军' : ''}`} aria-pressed={chosen} className={`square ${chosen ? 'selected' : ''} ${possible ? 'possible' : ''} ${last ? 'last-move' : ''} ${marked ? 'highlighted' : ''} ${inCheck ? 'in-check' : ''}`} data-testid={`square-${p.x}-${p.y}`} onClick={() => { if (!disabled) onSquare?.(p); }}>
          {isTarget && <span className={`target-star ${piece ? 'with-piece' : ''}`} aria-hidden="true">✦</span>}
          {piece && <span className={`piece ${piece.side}`} data-piece={piece.type}>{pieceLabel(piece)}</span>}
          {possible && !piece && !isTarget && <span className="legal-dot" />}
          {possible && piece && <span className="capture-ring" />}
        </button>;
      })}
    </div>
  </div>;
}
