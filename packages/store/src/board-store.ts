import type { BezierBoard, Vec2 } from '@board-studio/kernel';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  getTargetSpline,
  moveKnotEnd,
  moveKnotTangent,
  withSpline,
  type SplineTarget,
} from './edits';

/** A selected control point, for the inspector / highlight. */
export interface Selection {
  target: SplineTarget;
  index: number;
}

export interface BoardState {
  board: BezierBoard | null;
  past: BezierBoard[];
  future: BezierBoard[];
  /** True while a drag is in progress (edits coalesce into one undo step). */
  editing: boolean;
  selection: Selection | null;

  load: (board: BezierBoard) => void;
  select: (selection: Selection | null) => void;

  /** Begin a grouped edit (call on drag start). */
  beginEdit: () => void;
  /** End a grouped edit (call on drag end). */
  endEdit: () => void;

  moveControlPoint: (target: SplineTarget, index: number, end: Vec2) => void;
  moveTangent: (target: SplineTarget, index: number, which: 'prev' | 'next', pos: Vec2) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 200;

export const createBoardStore = (): StoreApi<BoardState> =>
  createStore<BoardState>((set, get) => {
    /** Apply an edited board, recording history unless mid-drag. */
    const commit = (next: BezierBoard) => {
      const { board, editing, past } = get();
      if (!board) return;
      if (editing) {
        set({ board: next }); // snapshot already taken at beginEdit
      } else {
        set({
          board: next,
          past: [...past, board].slice(-MAX_HISTORY),
          future: [],
        });
      }
    };

    const editSpline = (target: SplineTarget, fn: (s: ReturnType<typeof getTargetSpline>) => BezierBoard) => {
      const { board } = get();
      if (!board) return;
      commit(fn(getTargetSpline(board, target)));
    };

    return {
      board: null,
      past: [],
      future: [],
      editing: false,
      selection: null,

      load: (board) => set({ board, past: [], future: [], editing: false, selection: null }),
      select: (selection) => set({ selection }),

      beginEdit: () => {
        const { board, past, editing } = get();
        if (!board || editing) return;
        set({ editing: true, past: [...past, board].slice(-MAX_HISTORY), future: [] });
      },
      endEdit: () => set({ editing: false }),

      moveControlPoint: (target, index, end) =>
        editSpline(target, (s) => withSpline(get().board!, target, moveKnotEnd(s, index, end))),

      moveTangent: (target, index, which, pos) =>
        editSpline(target, (s) =>
          withSpline(get().board!, target, moveKnotTangent(s, index, which, pos)),
        ),

      undo: () => {
        const { past, future, board } = get();
        if (past.length === 0 || !board) return;
        const prev = past[past.length - 1]!;
        set({ board: prev, past: past.slice(0, -1), future: [board, ...future], editing: false });
      },
      redo: () => {
        const { past, future, board } = get();
        if (future.length === 0 || !board) return;
        const next = future[0]!;
        set({ board: next, past: [...past, board], future: future.slice(1), editing: false });
      },
      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,
    };
  });
