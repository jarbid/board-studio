import { describe, expect, it } from 'vitest';
import { knotFromArray } from './knot';
import {
  maxYInRange,
  splineFromKnots,
  splineLength,
  valueAt,
  xForMaxYInRange,
} from './bezier-spline';

/**
 * Real shortboard outline (p32 from docs/specs/golden/shortboard.brd). Outline y is the
 * half-width; the centerline is y=0. Validated against docs/specs/golden/golden.json:
 *   centerWidth = 46.94468582 (half = 23.4723), maxWidth = 46.99000234 (half = 23.495),
 *   maxWidthPos = 90.07625140.
 * cp record order is [endX,endY, prevX,prevY, nextX,nextY].
 */
const shortboardOutline = splineFromKnots([
  knotFromArray([0.0, 0.0, 0.0, 0.0, 0.0, 3.05804454721486], false, false),
  knotFromArray(
    [1.396916196324043, 5.7737301929790315, 0.09199389838430455, 4.5383224190388285, 7.42679238696713, 11.482388810874316],
    true,
    false,
  ),
  knotFromArray(
    [90.13362308681752, 23.49499750470692, 30.390000282383603, 23.502663416291362, 129.08124632569087, 23.490000000000002],
    true,
    false,
  ),
  knotFromArray(
    [187.96, 0.5, 165.39140765851977, 16.729079863293684, 187.96215325905928, 0.4806433299508672],
    false,
    false,
  ),
  knotFromArray([187.96, 0.0, 187.96, 0.02097709562634233, 187.96, 0.0], false, false),
]);

describe('bezier-spline (real shortboard outline vs golden)', () => {
  it('half-width at center matches golden centerWidth/2', () => {
    // center of board length 187.96 => x = 93.98
    expect(valueAt(shortboardOutline, 93.98) * 2).toBeCloseTo(46.94468582, 1);
  });

  it('max width matches golden maxWidth', () => {
    expect(maxYInRange(shortboardOutline, 0, 187.96) * 2).toBeCloseTo(46.99000234, 1);
  });

  it('widepoint position matches golden maxWidthPos', () => {
    expect(xForMaxYInRange(shortboardOutline, 0, 187.96)).toBeCloseTo(90.07625, 0);
  });

  it('outline arc length is sensible (> board length)', () => {
    // Perimeter of half-outline nose->tail must exceed the straight length.
    expect(splineLength(shortboardOutline)).toBeGreaterThan(187.96);
  });
});
