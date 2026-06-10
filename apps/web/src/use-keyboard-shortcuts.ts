import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { downloadBoard, type BoardMeta } from './file-io';
import { boardStore } from './store';
import type { View } from './view-toolkit';

/**
 * Global editor keyboard shortcuts: undo/redo, save, delete the selected control
 * point, cross-section paging ([ / ]), and view switching (1–5). Skips typing keys
 * while a text field is focused. `metaRef` keeps the save handler reading the
 * latest board metadata without re-binding the listener.
 */
export function useKeyboardShortcuts({
  setView,
  setCsIndex,
  metaRef,
  onCommandPalette,
}: {
  setView: Dispatch<SetStateAction<View>>;
  setCsIndex: Dispatch<SetStateAction<number>>;
  metaRef: MutableRefObject<BoardMeta>;
  /** Ctrl/Cmd+K. Pass a stable callback — the listener re-binds when it changes. */
  onCommandPalette: () => void;
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) boardStore.getState().redo();
        else boardStore.getState().undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        boardStore.getState().redo();
      } else if (mod && k === 's') {
        e.preventDefault();
        const b = boardStore.getState().board;
        if (b) downloadBoard(b, metaRef.current);
      } else if (mod && k === 'k') {
        e.preventDefault();
        onCommandPalette();
      } else if (!mod && !inField) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const sel = boardStore.getState().selection;
          if (sel) {
            e.preventDefault();
            boardStore.getState().deleteControlPoint(sel.target, sel.index);
          }
          return;
        }
        if (e.key === '[' || e.key === ']') {
          e.preventDefault();
          const b = boardStore.getState().board;
          const last = Math.max(1, (b?.crossSections.length ?? 0) - 2);
          setCsIndex((i) => {
            const cur = Math.min(Math.max(i, 1), last);
            return e.key === '[' ? Math.max(1, cur - 1) : Math.min(last, cur + 1);
          });
          return;
        }
        const map: Record<string, View> = {
          '1': 'quad',
          '2': 'outline',
          '3': 'rocker',
          '4': 'crossSection',
          '5': '3d',
        };
        if (map[e.key]) setView(map[e.key]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView, setCsIndex, metaRef, onCommandPalette]);
}
