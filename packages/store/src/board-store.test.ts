import { describe, expect, it } from 'vitest';
import {
  board,
  crossSection,
  knot,
  splineFromKnots,
  vec2,
  type BezierBoard,
} from '@board-studio/kernel';
import { createBoardStore } from './board-store';
import { moveKnotTangent } from './edits';
import { selectSpecs } from './selectors';

// A small but valid board: outline (half-width), flat-ish bottom & deck.
const makeBoard = (): BezierBoard => {
  const k = (ex: number, ey: number) => knot(vec2(ex, ey), vec2(ex - 5, ey), vec2(ex + 5, ey));
  const outline = splineFromKnots([k(0, 0), k(50, 20), k(100, 0)]);
  const bottom = splineFromKnots([k(0, 5), k(100, 5)]);
  const deck = splineFromKnots([k(0, 11), k(100, 11)]);
  // three cross-sections (nose dummy, middle, tail dummy) so volume is computable
  const prof = splineFromKnots([knot(vec2(0, 5), vec2(0, 5), vec2(10, 5)), knot(vec2(10, 8), vec2(10, 6), vec2(10, 8))]);
  const cs = [crossSection(0, prof), crossSection(50, prof), crossSection(100, prof)];
  return board(outline, bottom, deck, cs);
};

describe('board store: editing + undo/redo', () => {
  it('moves a control point and records undo history', () => {
    const store = createBoardStore();
    const original = makeBoard();
    store.getState().load(original);

    const before = selectSpecs(store.getState().board!).maxWidth;
    store.getState().moveControlPoint({ kind: 'outline' }, 1, vec2(50, 30));
    const after = selectSpecs(store.getState().board!).maxWidth;

    expect(after).toBeGreaterThan(before);
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().board).not.toBe(original);
  });

  it('undo restores the exact previous board, redo re-applies', () => {
    const store = createBoardStore();
    const original = makeBoard();
    store.getState().load(original);

    store.getState().moveControlPoint({ kind: 'outline' }, 1, vec2(50, 30));
    const edited = store.getState().board;

    store.getState().undo();
    expect(store.getState().board).toBe(original);
    expect(store.getState().canRedo()).toBe(true);

    store.getState().redo();
    expect(store.getState().board).toBe(edited);
  });

  it('coalesces a drag (beginEdit..endEdit) into a single undo step', () => {
    const store = createBoardStore();
    const original = makeBoard();
    store.getState().load(original);

    store.getState().beginEdit();
    store.getState().moveControlPoint({ kind: 'outline' }, 1, vec2(50, 25));
    store.getState().moveControlPoint({ kind: 'outline' }, 1, vec2(50, 28));
    store.getState().moveControlPoint({ kind: 'outline' }, 1, vec2(50, 31));
    store.getState().endEdit();

    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().board).toBe(original);
  });
});

describe('edits: continuous tangent mirroring', () => {
  it('keeps the opposite handle collinear through the endpoint', () => {
    const s = splineFromKnots([
      knot(vec2(0, 0), vec2(-1, 0), vec2(1, 0), true),
      knot(vec2(10, 0), vec2(9, 0), vec2(11, 0), true),
    ]);
    const moved = moveKnotTangent(s, 0, 'next', vec2(0, 2)); // pull next handle straight up
    const k = moved.knots[0]!;
    // prev should mirror to (0,-1): opposite direction, original length 1 preserved.
    expect(k.tangentToPrev.x).toBeCloseTo(0, 9);
    expect(k.tangentToPrev.y).toBeCloseTo(-1, 9);
  });
});
