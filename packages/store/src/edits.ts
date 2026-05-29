import {
  board,
  knot,
  splineFromKnots,
  vec2,
  type BezierBoard,
  type Knot,
  type Spline,
  type Vec2,
} from '@board-studio/kernel';

/**
 * Pure editing helpers. The kernel is immutable, so every edit returns a NEW
 * spline / board; the store swaps the reference. No mutation, fully testable.
 */

/** Identifies which spline on the board an edit targets. */
export type SplineTarget =
  | { kind: 'outline' }
  | { kind: 'deck' }
  | { kind: 'bottom' }
  | { kind: 'crossSection'; index: number };

export const getTargetSpline = (b: BezierBoard, t: SplineTarget): Spline => {
  switch (t.kind) {
    case 'outline':
      return b.outline;
    case 'deck':
      return b.deck;
    case 'bottom':
      return b.bottom;
    case 'crossSection':
      return b.crossSections[t.index]!.spline;
  }
};

/** Return a new board with the target spline replaced. */
export const withSpline = (b: BezierBoard, t: SplineTarget, spline: Spline): BezierBoard => {
  switch (t.kind) {
    case 'outline':
      return board(spline, b.bottom, b.deck, b.crossSections, b.interpolationType);
    case 'deck':
      return board(b.outline, b.bottom, spline, b.crossSections, b.interpolationType);
    case 'bottom':
      return board(b.outline, spline, b.deck, b.crossSections, b.interpolationType);
    case 'crossSection': {
      const cs = b.crossSections.map((c, i) =>
        i === t.index ? { position: c.position, spline } : c,
      );
      return board(b.outline, b.bottom, b.deck, cs, b.interpolationType);
    }
  }
};

const replaceKnot = (s: Spline, index: number, k: Knot): Spline =>
  splineFromKnots(s.knots.map((kk, i) => (i === index ? k : kk)));

/**
 * Move a knot's endpoint to `end`, translating its two tangent handles by the
 * same delta (legacy `BezierKnot.setControlPointLocation` — the whole knot moves).
 */
export const moveKnotEnd = (s: Spline, index: number, end: Vec2): Spline => {
  const k = s.knots[index]!;
  const dx = end.x - k.end.x;
  const dy = end.y - k.end.y;
  return replaceKnot(
    s,
    index,
    knot(
      end,
      vec2(k.tangentToPrev.x + dx, k.tangentToPrev.y + dy),
      vec2(k.tangentToNext.x + dx, k.tangentToNext.y + dy),
      k.continuous,
      k.other,
    ),
  );
};

/**
 * Move one tangent handle to `pos`. If the knot is continuous, the opposite
 * handle is kept collinear through the endpoint, preserving its own length
 * (smooth-curve editing).
 */
export const moveKnotTangent = (
  s: Spline,
  index: number,
  which: 'prev' | 'next',
  pos: Vec2,
): Spline => {
  const k = s.knots[index]!;
  let prev = which === 'prev' ? pos : k.tangentToPrev;
  let next = which === 'next' ? pos : k.tangentToNext;

  if (k.continuous) {
    const movedToEnd = vec2(k.end.x - pos.x, k.end.y - pos.y); // from moved handle to end
    const len = Math.hypot(movedToEnd.x, movedToEnd.y);
    const opp = which === 'prev' ? k.tangentToNext : k.tangentToPrev;
    const oppLen = Math.hypot(opp.x - k.end.x, opp.y - k.end.y);
    if (len > 1e-9) {
      const ux = movedToEnd.x / len;
      const uy = movedToEnd.y / len;
      const mirrored = vec2(k.end.x + ux * oppLen, k.end.y + uy * oppLen);
      if (which === 'prev') next = mirrored;
      else prev = mirrored;
    }
  }
  return replaceKnot(s, index, knot(k.end, prev, next, k.continuous, k.other));
};
