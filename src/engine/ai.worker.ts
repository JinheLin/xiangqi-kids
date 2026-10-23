import { searchBestMove } from './search';
import type { SearchFrame } from './search';
import type { Board, Side } from './xiangqi';
import type { Difficulty } from './difficulty';
export interface ComputerRequest { board: Board; side: Side; difficulty: Difficulty; history: readonly SearchFrame[] }
const scope = self as unknown as { onmessage: ((event: MessageEvent<ComputerRequest>) => void) | null; postMessage: (result: unknown) => void };
scope.onmessage = ({ data }) => {
  try { scope.postMessage({ result: searchBestMove(data.board, data.side, data.difficulty, { history: data.history }) }); }
  catch { scope.postMessage({ error: true }); }
};
