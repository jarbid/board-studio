import { parseBrd, readBoardJson, writeBoardJson } from '@board-studio/io';
import type { BezierBoard } from '@board-studio/kernel';

/** Trigger a download of the board as a native .board.json document. */
export function downloadBoard(board: BezierBoard, filename = 'board.board.json'): void {
  const text = writeBoardJson(board);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a user-picked file: native .board.json or a legacy .brd import. */
export async function openBoardFile(file: File): Promise<BezierBoard> {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.brd')) return parseBrd(text).board;
  return readBoardJson(text).board;
}
