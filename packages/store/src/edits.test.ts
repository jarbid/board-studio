/**
 * Unit tests for edits.ts.
 *
 * board-store.test.ts already covers:
 *   - moveControlPoint (via the store action) and undo/redo coalescing.
 *   - moveKnotTangent with continuous=true (collinearity preservation).
 *
 * This file covers the paths NOT exercised by that test:
 *   - moveKnotEnd: correct delta application to tangent handles.
 *   - moveKnotTangent with continuous=false: opposite handle is unchanged.
 *   - withSpline: replacing each spline target kind (outline/deck/bottom/crossSection).
 *   - getTargetSpline: correctly retrieves the right spline for each target kind.
 */
import {
  board,
  crossSection,
  getDeckAtPos,
  getLength,
  getMaxWidth,
  getRockerAtPos,
  getWidthAtPos,
  knot,
  maxX,
  splineFromKnots,
  valueAt,
  vec2,
  type BezierBoard,
} from '@openshaper/kernel';
import { describe, expect, it } from 'vitest';
import {
  alignTangentsHorizontal,
  alignTangentsVertical,
  enforceJunctions,
  getTargetSpline,
  insertCrossSection,
  moveKnotEnd,
  moveKnotTangent,
  propagateCrossSectionToCurves,
  removeCrossSection,
  scaleBoard,
  setSplineValueAt,
  withSpline,
  type SplineTarget,
} from './edits';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpline() {
  return splineFromKnots([
    knot(vec2(0, 0), vec2(-5, 0), vec2(5, 0), true),
    knot(vec2(100, 0), vec2(95, 0), vec2(105, 0), true),
  ]);
}

function makeBoard(): BezierBoard {
  const outline = makeSpline();
  const bottom = splineFromKnots([
    knot(vec2(0, 5), vec2(-5, 5), vec2(5, 5)),
    knot(vec2(100, 5), vec2(95, 5), vec2(105, 5)),
  ]);
  const deck = splineFromKnots([
    knot(vec2(0, 11), vec2(-5, 11), vec2(5, 11)),
    knot(vec2(100, 11), vec2(95, 11), vec2(105, 11)),
  ]);
  const prof = splineFromKnots([
    knot(vec2(0, 5), vec2(0, 5), vec2(10, 5)),
    knot(vec2(10, 8), vec2(10, 6), vec2(10, 8)),
  ]);
  const cs = [crossSection(0, prof), crossSection(50, prof), crossSection(100, prof)];
  return board(outline, bottom, deck, cs);
}

// ---------------------------------------------------------------------------
// moveKnotEnd
// ---------------------------------------------------------------------------

describe('moveKnotEnd', () => {
  it('moves the endpoint to the new position', () => {
    const s = makeSpline();
    const moved = moveKnotEnd(s, 0, vec2(10, 20));
    expect(moved.knots[0]!.end.x).toBeCloseTo(10, 9);
    expect(moved.knots[0]!.end.y).toBeCloseTo(20, 9);
  });

  it('translates tangentToPrev by the same delta as the endpoint', () => {
    const s = makeSpline();
    const k0 = s.knots[0]!;
    // original end=(0,0), tangentToPrev=(-5,0). Move end to (10,20): delta=(10,20).
    const moved = moveKnotEnd(s, 0, vec2(10, 20));
    expect(moved.knots[0]!.tangentToPrev.x).toBeCloseTo(k0.tangentToPrev.x + 10, 9);
    expect(moved.knots[0]!.tangentToPrev.y).toBeCloseTo(k0.tangentToPrev.y + 20, 9);
  });

  it('translates tangentToNext by the same delta as the endpoint', () => {
    const s = makeSpline();
    const k0 = s.knots[0]!;
    const moved = moveKnotEnd(s, 0, vec2(10, 20));
    expect(moved.knots[0]!.tangentToNext.x).toBeCloseTo(k0.tangentToNext.x + 10, 9);
    expect(moved.knots[0]!.tangentToNext.y).toBeCloseTo(k0.tangentToNext.y + 20, 9);
  });

  it('leaves other knots unchanged', () => {
    const s = makeSpline();
    const moved = moveKnotEnd(s, 0, vec2(10, 20));
    expect(moved.knots[1]).toEqual(s.knots[1]);
  });

  it('returns a new spline instance (immutability)', () => {
    const s = makeSpline();
    const moved = moveKnotEnd(s, 0, vec2(10, 20));
    expect(moved).not.toBe(s);
  });

  it('works on any knot index, including the last', () => {
    const s = makeSpline();
    const moved = moveKnotEnd(s, 1, vec2(200, 5));
    expect(moved.knots[1]!.end.x).toBeCloseTo(200, 9);
  });
});

// ---------------------------------------------------------------------------
// moveKnotTangent — continuous = false (no mirroring)
// ---------------------------------------------------------------------------

describe('moveKnotTangent (continuous=false)', () => {
  it('moves only the specified "next" handle when not continuous', () => {
    const s = splineFromKnots([
      knot(vec2(0, 0), vec2(-1, 0), vec2(1, 0), false), // continuous=false
      knot(vec2(10, 0), vec2(9, 0), vec2(11, 0), false),
    ]);
    const moved = moveKnotTangent(s, 0, 'next', vec2(3, 4));
    expect(moved.knots[0]!.tangentToNext.x).toBeCloseTo(3, 9);
    expect(moved.knots[0]!.tangentToNext.y).toBeCloseTo(4, 9);
    // prev handle must remain unchanged
    expect(moved.knots[0]!.tangentToPrev.x).toBeCloseTo(-1, 9);
    expect(moved.knots[0]!.tangentToPrev.y).toBeCloseTo(0, 9);
  });

  it('moves only the specified "prev" handle when not continuous', () => {
    const s = splineFromKnots([
      knot(vec2(0, 0), vec2(-1, 0), vec2(1, 0), false),
      knot(vec2(10, 0), vec2(9, 0), vec2(11, 0), false),
    ]);
    const moved = moveKnotTangent(s, 0, 'prev', vec2(-5, 2));
    expect(moved.knots[0]!.tangentToPrev.x).toBeCloseTo(-5, 9);
    expect(moved.knots[0]!.tangentToPrev.y).toBeCloseTo(2, 9);
    // next handle unchanged
    expect(moved.knots[0]!.tangentToNext.x).toBeCloseTo(1, 9);
    expect(moved.knots[0]!.tangentToNext.y).toBeCloseTo(0, 9);
  });
});

// ---------------------------------------------------------------------------
// moveKnotTangent — continuous = true (collinearity; board-store covers one case
// already, here we verify the "prev" direction path and length preservation)
// ---------------------------------------------------------------------------

describe('moveKnotTangent (continuous=true, prev direction)', () => {
  it('keeps the "next" handle collinear through the endpoint when "prev" is moved', () => {
    const s = splineFromKnots([
      knot(vec2(0, 0), vec2(-1, 0), vec2(1, 0), true),
      knot(vec2(10, 0), vec2(9, 0), vec2(11, 0), true),
    ]);
    // Move prev handle straight down
    const moved = moveKnotTangent(s, 0, 'prev', vec2(0, -2));
    const k = moved.knots[0]!;
    // next should mirror: same direction from end, original length 1 (was (1,0))
    expect(k.tangentToNext.x).toBeCloseTo(0, 9);
    expect(k.tangentToNext.y).toBeCloseTo(1, 9);
  });
});

// ---------------------------------------------------------------------------
// getTargetSpline
// ---------------------------------------------------------------------------

describe('getTargetSpline', () => {
  it('returns the outline spline for target kind "outline"', () => {
    const b = makeBoard();
    const t: SplineTarget = { kind: 'outline' };
    expect(getTargetSpline(b, t)).toBe(b.outline);
  });

  it('returns the deck spline for target kind "deck"', () => {
    const b = makeBoard();
    const t: SplineTarget = { kind: 'deck' };
    expect(getTargetSpline(b, t)).toBe(b.deck);
  });

  it('returns the bottom spline for target kind "bottom"', () => {
    const b = makeBoard();
    const t: SplineTarget = { kind: 'bottom' };
    expect(getTargetSpline(b, t)).toBe(b.bottom);
  });

  it('returns the correct cross-section spline by index', () => {
    const b = makeBoard();
    const t: SplineTarget = { kind: 'crossSection', index: 1 };
    expect(getTargetSpline(b, t)).toBe(b.crossSections[1]!.spline);
  });
});

// ---------------------------------------------------------------------------
// withSpline
// ---------------------------------------------------------------------------

describe('withSpline', () => {
  const replacement = splineFromKnots([
    knot(vec2(0, 99), vec2(0, 99), vec2(10, 99)),
    knot(vec2(100, 99), vec2(90, 99), vec2(100, 99)),
  ]);

  it('replaces the outline and leaves other splines unchanged', () => {
    const b = makeBoard();
    const next = withSpline(b, { kind: 'outline' }, replacement);
    expect(next.outline).toBe(replacement);
    expect(next.bottom).toBe(b.bottom);
    expect(next.deck).toBe(b.deck);
  });

  it('replaces the bottom and leaves other splines unchanged', () => {
    const b = makeBoard();
    const next = withSpline(b, { kind: 'bottom' }, replacement);
    expect(next.bottom).toBe(replacement);
    expect(next.outline).toBe(b.outline);
    expect(next.deck).toBe(b.deck);
  });

  it('replaces the deck and leaves other splines unchanged', () => {
    const b = makeBoard();
    const next = withSpline(b, { kind: 'deck' }, replacement);
    expect(next.deck).toBe(replacement);
    expect(next.outline).toBe(b.outline);
    expect(next.bottom).toBe(b.bottom);
  });

  it('replaces the correct cross-section spline by index', () => {
    const b = makeBoard();
    const next = withSpline(b, { kind: 'crossSection', index: 1 }, replacement);
    expect(next.crossSections[1]!.spline).toBe(replacement);
    // position is preserved
    expect(next.crossSections[1]!.position).toBe(b.crossSections[1]!.position);
    // other cross-sections untouched
    expect(next.crossSections[0]!.spline).toBe(b.crossSections[0]!.spline);
    expect(next.crossSections[2]!.spline).toBe(b.crossSections[2]!.spline);
  });

  it('returns a new board instance (immutability)', () => {
    const b = makeBoard();
    const next = withSpline(b, { kind: 'outline' }, replacement);
    expect(next).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// enforceJunctions — shared curve junctions can't be pulled apart
// ---------------------------------------------------------------------------

describe('enforceJunctions', () => {
  it('snaps cross-section center endpoints onto the stringer (x=0)', () => {
    const b = makeBoard();
    // Pull both center endpoints of cross-section 1 off the stringer.
    const drifted = withSpline(
      b,
      { kind: 'crossSection', index: 1 },
      splineFromKnots([
        knot(vec2(3, 5), vec2(3, 5), vec2(10, 5)),
        knot(vec2(-2, 8), vec2(10, 6), vec2(-2, 8)),
      ]),
    );
    const fixed = enforceJunctions(drifted, { kind: 'crossSection', index: 1 });
    const ks = fixed.crossSections[1]!.spline.knots;
    expect(ks[0]!.end.x).toBeCloseTo(0, 9);
    expect(ks[ks.length - 1]!.end.x).toBeCloseTo(0, 9);
    // y is preserved (only the off-axis component is clamped).
    expect(ks[0]!.end.y).toBeCloseTo(5, 9);
    expect(ks[ks.length - 1]!.end.y).toBeCloseTo(8, 9);
  });

  it('snaps the outline nose endpoint onto the centerline (y=0) but leaves the tail free', () => {
    const b = makeBoard();
    const drifted = withSpline(
      b,
      { kind: 'outline' },
      splineFromKnots([
        knot(vec2(0, 4), vec2(-5, 4), vec2(5, 4)), // nose pulled off centerline
        knot(vec2(100, 12), vec2(95, 12), vec2(105, 12)), // legitimate tail width
      ]),
    );
    const fixed = enforceJunctions(drifted, { kind: 'outline' });
    expect(fixed.outline.knots[0]!.end.y).toBeCloseTo(0, 9);
    expect(fixed.outline.knots[1]!.end.y).toBeCloseTo(12, 9); // tail untouched
  });

  it('drags the bottom nose/tail tips to follow an edited deck (deck wins)', () => {
    const b = makeBoard();
    const movedDeck = withSpline(
      b,
      { kind: 'deck' },
      splineFromKnots([
        knot(vec2(0, 20), vec2(-5, 20), vec2(5, 20)),
        knot(vec2(100, 22), vec2(95, 22), vec2(105, 22)),
      ]),
    );
    const fixed = enforceJunctions(movedDeck, { kind: 'deck' });
    expect(fixed.bottom.knots[0]!.end).toEqual(fixed.deck.knots[0]!.end);
    expect(fixed.bottom.knots[fixed.bottom.knots.length - 1]!.end).toEqual(
      fixed.deck.knots[fixed.deck.knots.length - 1]!.end,
    );
  });

  it('drags the deck tips to follow an edited bottom (bottom wins)', () => {
    const b = makeBoard();
    const movedBottom = withSpline(
      b,
      { kind: 'bottom' },
      splineFromKnots([
        knot(vec2(0, -3), vec2(-5, -3), vec2(5, -3)),
        knot(vec2(100, -1), vec2(95, -1), vec2(105, -1)),
      ]),
    );
    const fixed = enforceJunctions(movedBottom, { kind: 'bottom' });
    expect(fixed.deck.knots[0]!.end).toEqual(fixed.bottom.knots[0]!.end);
    expect(fixed.deck.knots[fixed.deck.knots.length - 1]!.end).toEqual(
      fixed.bottom.knots[fixed.bottom.knots.length - 1]!.end,
    );
  });

  it('is idempotent (already-joined board is unchanged on a second pass)', () => {
    const once = enforceJunctions(makeBoard());
    const twice = enforceJunctions(once);
    expect(twice.deck.knots).toEqual(once.deck.knots);
    expect(twice.bottom.knots).toEqual(once.bottom.knots);
    expect(twice.outline.knots).toEqual(once.outline.knots);
  });
});

// ---------------------------------------------------------------------------
// insertCrossSection / removeCrossSection
// ---------------------------------------------------------------------------

describe('insertCrossSection', () => {
  it('inserts a section at the position, kept sorted, returning its index', () => {
    const b = makeBoard(); // sections at 0, 50, 100
    const r = insertCrossSection(b, 25);
    expect(r).not.toBeNull();
    expect(r!.board.crossSections).toHaveLength(b.crossSections.length + 1);
    expect(r!.board.crossSections[r!.index]!.position).toBeCloseTo(25, 6);
    const ps = r!.board.crossSections.map((c) => c.position);
    expect(ps).toEqual([...ps].sort((a, c) => a - c));
  });

  it('returns null for a position outside the board', () => {
    const b = makeBoard();
    expect(insertCrossSection(b, -5)).toBeNull();
    expect(insertCrossSection(b, 1000)).toBeNull();
  });
});

describe('removeCrossSection', () => {
  it('removes a real section', () => {
    const withTwo = insertCrossSection(makeBoard(), 25)!.board; // 0,25,50,100
    const after = removeCrossSection(withTwo, 1); // remove pos 25
    expect(after.crossSections).toHaveLength(withTwo.crossSections.length - 1);
    expect(after.crossSections.map((c) => c.position)).not.toContain(25);
  });

  it('is a no-op for dummy endpoints or when only one real section remains', () => {
    const b = makeBoard(); // a single real section (index 1)
    expect(removeCrossSection(b, 0)).toBe(b); // nose dummy
    expect(removeCrossSection(b, b.crossSections.length - 1)).toBe(b); // tail dummy
    expect(removeCrossSection(b, 1)).toBe(b); // would leave zero real sections
  });
});

describe('scaleBoard', () => {
  it('scales length independently of width', () => {
    const b = makeBoard(); // length 100, sections at 0/50/100
    const s = scaleBoard(b, 2, 1, 1);
    expect(getLength(s)).toBeCloseTo(getLength(b) * 2, 6);
    expect(getMaxWidth(s)).toBeCloseTo(getMaxWidth(b), 6);
    // cross-section positions scale with length.
    expect(s.crossSections.map((c) => c.position)).toEqual(
      b.crossSections.map((c) => c.position * 2),
    );
  });

  it('scales width independently of length', () => {
    const b = makeBoard();
    const s = scaleBoard(b, 1, 1.5, 1);
    expect(getMaxWidth(s)).toBeCloseTo(getMaxWidth(b) * 1.5, 6);
    expect(getLength(s)).toBeCloseTo(getLength(b), 6);
  });
});

// ---------------------------------------------------------------------------
// setSplineValueAt (two-way link primitive)
// ---------------------------------------------------------------------------

describe('setSplineValueAt', () => {
  const flat = () =>
    splineFromKnots([
      knot(vec2(0, 5), vec2(-5, 5), vec2(5, 5)),
      knot(vec2(100, 5), vec2(95, 5), vec2(105, 5)),
    ]);

  it('inserts a knot on the curve at x and makes value(x) exact', () => {
    const out = setSplineValueAt(flat(), 50, 8);
    expect(out.knots).toHaveLength(3);
    expect(valueAt(out, 50)).toBeCloseTo(8, 6);
    // Endpoints (tips) are untouched.
    expect(valueAt(out, 0)).toBeCloseTo(5, 6);
    expect(valueAt(out, 100)).toBeCloseTo(5, 6);
  });

  it('retargets an interior knot already near the station instead of duplicating', () => {
    const s = splineFromKnots([
      knot(vec2(0, 5), vec2(-5, 5), vec2(5, 5)),
      knot(vec2(50, 5), vec2(45, 5), vec2(55, 5)),
      knot(vec2(100, 5), vec2(95, 5), vec2(105, 5)),
    ]);
    const out = setSplineValueAt(s, 50.3, 8); // within VALUE_X_TOL of the x=50 knot
    expect(out.knots).toHaveLength(3); // no new knot
    expect(valueAt(out, 50.3)).toBeCloseTo(8, 6);
  });
});

// ---------------------------------------------------------------------------
// propagateCrossSectionToCurves (two-way link)
// ---------------------------------------------------------------------------

describe('propagateCrossSectionToCurves', () => {
  // bottom(50)=3, deck(50)=9 (thickness 6); outline half-width(50)=20 (width 40).
  const make = (): BezierBoard => {
    const k = (ex: number, ey: number) => knot(vec2(ex, ey), vec2(ex - 5, ey), vec2(ex + 5, ey));
    const outline = splineFromKnots([k(0, 0), k(50, 20), k(100, 0)]);
    const bottom = splineFromKnots([k(0, 5), k(50, 3), k(100, 5)]);
    const deck = splineFromKnots([k(0, 11), k(50, 9), k(100, 11)]);
    // profile: bottom-center(0,0), rail(20,3) widest, tuck(15,5) interior, deck-center(0,6).
    const prof = splineFromKnots([
      knot(vec2(0, 0), vec2(0, 0), vec2(8, 0)),
      knot(vec2(20, 3), vec2(16, 1), vec2(20, 4)),
      knot(vec2(15, 5), vec2(18, 5), vec2(12, 5)),
      knot(vec2(0, 6), vec2(8, 6), vec2(0, 6)),
    ]);
    return board(outline, bottom, deck, [
      crossSection(0, prof),
      crossSection(50, prof),
      crossSection(100, prof),
    ]);
  };
  const cs1 = { kind: 'crossSection', index: 1 } as const;
  const editSection1 = (b: BezierBoard, ki: number, end: ReturnType<typeof vec2>) =>
    withSpline(b, cs1, moveKnotEnd(b.crossSections[1]!.spline, ki, end));

  it('deck-center drag raises the deck only', () => {
    const prev = make();
    const next = editSection1(prev, 3, vec2(0, 9)); // deck-center 6 → 9 (+3)
    const out = propagateCrossSectionToCurves(prev, next, 1);
    expect(getDeckAtPos(out, 50)).toBeCloseTo(12, 3); // 9 + 3
    expect(getRockerAtPos(out, 50)).toBeCloseTo(3, 3); // bottom unchanged
    expect(getWidthAtPos(out, 50)).toBeCloseTo(40, 2); // width unchanged
  });

  it('bottom-center drag drives the bottom rocker only', () => {
    const prev = make();
    const next = editSection1(prev, 0, vec2(0, -2)); // bottom-center 0 → -2 (-2)
    const out = propagateCrossSectionToCurves(prev, next, 1);
    expect(getRockerAtPos(out, 50)).toBeCloseTo(1, 3); // 3 - 2
    expect(getDeckAtPos(out, 50)).toBeCloseTo(9, 3); // deck unchanged
  });

  it('widest-point drag drives the outline width', () => {
    const prev = make();
    const next = editSection1(prev, 1, vec2(25, 3)); // rail 20 → 25 maxX (+5 half-width)
    const out = propagateCrossSectionToCurves(prev, next, 1);
    expect(getWidthAtPos(out, 50)).toBeGreaterThan(48); // ~50
    expect(getDeckAtPos(out, 50)).toBeCloseTo(9, 3); // deck unchanged
    expect(getRockerAtPos(out, 50)).toBeCloseTo(3, 3); // bottom unchanged
  });

  it('foil-only edit (interior, non-widest, y-only) propagates nothing', () => {
    const prev = make();
    const next = editSection1(prev, 2, vec2(15, 4)); // tuck 5 → 4, x kept, maxX kept
    const out = propagateCrossSectionToCurves(prev, next, 1);
    expect(out).toBe(next); // referential: curves untouched
    expect(getDeckAtPos(out, 50)).toBeCloseTo(9, 6);
    expect(getRockerAtPos(out, 50)).toBeCloseTo(3, 6);
    expect(getWidthAtPos(out, 50)).toBeCloseTo(40, 6);
  });

  it('leaves the nose/tail dummy stations alone', () => {
    const prev = make();
    const next = editSection1(prev, 3, vec2(0, 9));
    expect(propagateCrossSectionToCurves(prev, next, 0)).toBe(next);
    expect(propagateCrossSectionToCurves(prev, next, prev.crossSections.length - 1)).toBe(next);
  });
});

// ---------------------------------------------------------------------------
// alignTangentsHorizontal — port of BrdEditCommand.rotateControlPointToHorizontal
// ---------------------------------------------------------------------------

describe('alignTangentsHorizontal', () => {
  // Interior knot with both handles off-axis (not horizontal).
  // end=(50,10), prev=(45,5), next=(55,15) — both diagonal.
  const makeDiagSpline = () =>
    splineFromKnots([
      knot(vec2(0, 0), vec2(-5, 0), vec2(5, 0), true),
      knot(vec2(50, 10), vec2(45, 5), vec2(55, 15), false),
      knot(vec2(100, 0), vec2(95, 0), vec2(105, 0), true),
    ]);

  it('rotates both tangents to horizontal, preserving each handle length', () => {
    const s = makeDiagSpline();
    const k = s.knots[1]!;
    const prevLen = Math.hypot(k.tangentToPrev.x - k.end.x, k.tangentToPrev.y - k.end.y);
    const nextLen = Math.hypot(k.tangentToNext.x - k.end.x, k.tangentToNext.y - k.end.y);
    const out = alignTangentsHorizontal(s, 1);
    const ko = out.knots[1]!;
    // y-coordinates of both handles must equal the endpoint's y
    expect(ko.tangentToPrev.y).toBeCloseTo(k.end.y, 9);
    expect(ko.tangentToNext.y).toBeCloseTo(k.end.y, 9);
    // lengths are preserved
    expect(Math.hypot(ko.tangentToPrev.x - ko.end.x, ko.tangentToPrev.y - ko.end.y)).toBeCloseTo(
      prevLen,
      9,
    );
    expect(Math.hypot(ko.tangentToNext.x - ko.end.x, ko.tangentToNext.y - ko.end.y)).toBeCloseTo(
      nextLen,
      9,
    );
  });

  it('prev handle stays to the left (negative x direction relative to end)', () => {
    const s = makeDiagSpline();
    const out = alignTangentsHorizontal(s, 1);
    const ko = out.knots[1]!;
    // original tangentToPrev.x (45) < end.x (50): prev should stay to the left
    expect(ko.tangentToPrev.x).toBeLessThan(ko.end.x);
  });

  it('next handle stays to the right (positive x direction relative to end)', () => {
    const s = makeDiagSpline();
    const out = alignTangentsHorizontal(s, 1);
    const ko = out.knots[1]!;
    // original tangentToNext.x (55) > end.x (50): next should stay to the right
    expect(ko.tangentToNext.x).toBeGreaterThan(ko.end.x);
  });

  it('when continuous, both handles become collinear (horizontal) through the endpoint', () => {
    const s = splineFromKnots([
      knot(vec2(0, 0), vec2(-5, 0), vec2(5, 0), true),
      knot(vec2(50, 10), vec2(45, 5), vec2(55, 15), true), // continuous
      knot(vec2(100, 0), vec2(95, 0), vec2(105, 0), true),
    ]);
    const out = alignTangentsHorizontal(s, 1);
    const ko = out.knots[1]!;
    expect(ko.tangentToPrev.y).toBeCloseTo(ko.end.y, 9);
    expect(ko.tangentToNext.y).toBeCloseTo(ko.end.y, 9);
    // collinear: sum of x-offsets is 0 (they point in opposite x directions)
    expect(ko.tangentToPrev.x + ko.tangentToNext.x).toBeCloseTo(2 * ko.end.x, 9);
  });

  it('leaves other knots unchanged', () => {
    const s = makeDiagSpline();
    const out = alignTangentsHorizontal(s, 1);
    expect(out.knots[0]).toEqual(s.knots[0]);
    expect(out.knots[2]).toEqual(s.knots[2]);
  });

  it('returns a new spline instance (immutability)', () => {
    const s = makeDiagSpline();
    expect(alignTangentsHorizontal(s, 1)).not.toBe(s);
  });
});

// ---------------------------------------------------------------------------
// alignTangentsVertical — port of BrdEditCommand.rotateControlPointToVertical
// ---------------------------------------------------------------------------

describe('alignTangentsVertical', () => {
  // Interior knot with diagonal handles: end=(50,10), prev=(45,5), next=(55,15)
  const makeDiagSpline = () =>
    splineFromKnots([
      knot(vec2(0, 0), vec2(-5, 0), vec2(5, 0), true),
      knot(vec2(50, 10), vec2(45, 5), vec2(55, 15), false),
      knot(vec2(100, 0), vec2(95, 0), vec2(105, 0), true),
    ]);

  it('rotates both tangents to vertical, preserving each handle length', () => {
    const s = makeDiagSpline();
    const k = s.knots[1]!;
    const prevLen = Math.hypot(k.tangentToPrev.x - k.end.x, k.tangentToPrev.y - k.end.y);
    const nextLen = Math.hypot(k.tangentToNext.x - k.end.x, k.tangentToNext.y - k.end.y);
    const out = alignTangentsVertical(s, 1);
    const ko = out.knots[1]!;
    // x-coordinates of both handles must equal the endpoint's x
    expect(ko.tangentToPrev.x).toBeCloseTo(k.end.x, 9);
    expect(ko.tangentToNext.x).toBeCloseTo(k.end.x, 9);
    // lengths are preserved
    expect(Math.hypot(ko.tangentToPrev.x - ko.end.x, ko.tangentToPrev.y - ko.end.y)).toBeCloseTo(
      prevLen,
      9,
    );
    expect(Math.hypot(ko.tangentToNext.x - ko.end.x, ko.tangentToNext.y - ko.end.y)).toBeCloseTo(
      nextLen,
      9,
    );
  });

  it('prev handle direction on Y axis is preserved (sign)', () => {
    const s = makeDiagSpline();
    // tangentToPrev.y (5) < end.y (10): prev is below end, so aligned it points below
    const out = alignTangentsVertical(s, 1);
    const ko = out.knots[1]!;
    expect(ko.tangentToPrev.y).toBeLessThan(ko.end.y);
  });

  it('next handle direction on Y axis is preserved (sign)', () => {
    const s = makeDiagSpline();
    // tangentToNext.y (15) > end.y (10): next is above end, so aligned it points above
    const out = alignTangentsVertical(s, 1);
    const ko = out.knots[1]!;
    expect(ko.tangentToNext.y).toBeGreaterThan(ko.end.y);
  });

  it('when continuous, both handles become collinear (vertical) through the endpoint', () => {
    const s = splineFromKnots([
      knot(vec2(0, 0), vec2(-5, 0), vec2(5, 0), true),
      knot(vec2(50, 10), vec2(45, 5), vec2(55, 15), true), // continuous
      knot(vec2(100, 0), vec2(95, 0), vec2(105, 0), true),
    ]);
    const out = alignTangentsVertical(s, 1);
    const ko = out.knots[1]!;
    expect(ko.tangentToPrev.x).toBeCloseTo(ko.end.x, 9);
    expect(ko.tangentToNext.x).toBeCloseTo(ko.end.x, 9);
    // collinear vertical: sum of y-offsets is 0
    expect(ko.tangentToPrev.y + ko.tangentToNext.y).toBeCloseTo(2 * ko.end.y, 9);
  });

  it('leaves other knots unchanged', () => {
    const s = makeDiagSpline();
    const out = alignTangentsVertical(s, 1);
    expect(out.knots[0]).toEqual(s.knots[0]);
    expect(out.knots[2]).toEqual(s.knots[2]);
  });

  it('returns a new spline instance (immutability)', () => {
    const s = makeDiagSpline();
    expect(alignTangentsVertical(s, 1)).not.toBe(s);
  });
});
