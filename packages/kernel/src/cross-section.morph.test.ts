// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { crossSection, interpolateCrossSection } from './cross-section';
import { knotFromArray } from './knot';
import { splineFromKnots } from './bezier-spline';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = resolve(here, '../../../docs/specs/golden');

// Each knot is [endX, endY, prevX, prevY, nextX, nextY] (legacy getPoints order).
type GKnot = [number, number, number, number, number, number];
interface MorphCase {
  t: number;
  knots: GKnot[];
}
interface Morph {
  sourceKnots: GKnot[];
  targetKnots: GKnot[];
  cases: MorphCase[];
}
const golden: { morph: Morph } = JSON.parse(
  readFileSync(resolve(goldenDir, 'interp.golden.json'), 'utf8'),
);

const sectionFrom = (knots: GKnot[]) =>
  crossSection(0, splineFromKnots(knots.map((k) => knotFromArray(k))));

// Morph involves chained de Casteljau splits + root-found closest-t; the legacy used
// 32→…-split recursion. 1e-4 cm covers float-order differences in those searches.
const TOL = 1e-4;

describe('interpolateCrossSection morph vs legacy golden (differing CP counts)', () => {
  const source = sectionFrom(golden.morph.sourceKnots);
  const target = sectionFrom(golden.morph.targetKnots);

  it('source has more control points than target (exercises the morph path)', () => {
    expect(golden.morph.sourceKnots.length).not.toBe(golden.morph.targetKnots.length);
  });

  for (const c of golden.morph.cases) {
    it(`t=${c.t}: matches legacy knots`, () => {
      const result = interpolateCrossSection(source, target, c.t);
      const knots = result.spline.knots;
      expect(knots.length).toBe(c.knots.length);
      knots.forEach((k, i) => {
        const g = c.knots[i]!;
        expect(Math.abs(k.end.x - g[0])).toBeLessThanOrEqual(TOL);
        expect(Math.abs(k.end.y - g[1])).toBeLessThanOrEqual(TOL);
        expect(Math.abs(k.tangentToPrev.x - g[2])).toBeLessThanOrEqual(TOL);
        expect(Math.abs(k.tangentToPrev.y - g[3])).toBeLessThanOrEqual(TOL);
        expect(Math.abs(k.tangentToNext.x - g[4])).toBeLessThanOrEqual(TOL);
        expect(Math.abs(k.tangentToNext.y - g[5])).toBeLessThanOrEqual(TOL);
      });
    });
  }
});
