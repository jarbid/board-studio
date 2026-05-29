import { exportDxf, exportPdf, exportStl } from '@board-studio/export';
import { parseBrd, readBoardJson, writeBoardJson } from '@board-studio/io';
import type { BezierBoard } from '@board-studio/kernel';

function download(data: BlobPart, filename: string, type: string): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Trigger a download of the board as a native .board.json document. */
export function downloadBoard(board: BezierBoard, filename = 'board.board.json'): void {
  download(writeBoardJson(board), filename, 'application/json');
}

/** Read a user-picked file: native .board.json or a legacy .brd import. */
export async function openBoardFile(file: File): Promise<BezierBoard> {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.brd')) return parseBrd(text).board;
  return readBoardJson(text).board;
}

export type ExportFormat = 'stl' | 'dxf' | 'pdf';

/** Export the board to STL / DXF / PDF and download it. */
export function exportBoard(board: BezierBoard, format: ExportFormat): void {
  switch (format) {
    case 'stl':
      return download(exportStl(board), 'board.stl', 'model/stl');
    case 'dxf':
      return download(exportDxf(board), 'board.dxf', 'application/dxf');
    case 'pdf':
      // exportPdf returns a Uint8Array; cast for the DOM BlobPart type (runtime is fine).
      return download(exportPdf(board) as unknown as BlobPart, 'board.pdf', 'application/pdf');
  }
}
