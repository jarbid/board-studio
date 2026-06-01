// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bestFit, normalizedPathLengths } from './bezier-fit';
import { vec2 } from './vec2';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = resolve(here, '../../../docs/specs/golden');

interface FitCase {
  points: [number, number][];
  controlPoints: [number, number][];
}
const golden: { bezierFit: { cases: FitCase[] } } = JSON.parse(
  readFileSync(resolve(goldenDir, 'interp.golden.json'), 'utf8'),
);

// Control-point coordinates within 1e-5 cm of the legacy BezierFit (pure linear
// algebra, so the only difference vs the legacy UJMP matrices is float rounding).
const TOL = 1e-5;

describe('BezierFit.bestFit vs legacy golden', () => {
  golden.bezierFit.cases.forEach((c, idx) => {
    it(`case ${idx}: matches legacy control points`, () => {
      const pts = c.points.map(([x, y]) => vec2(x, y));
      const cp = bestFit(pts);
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(cp[i]!.x - c.controlPoints[i]![0])).toBeLessThanOrEqual(TOL);
        expect(Math.abs(cp[i]!.y - c.controlPoints[i]![1])).toBeLessThanOrEqual(TOL);
      }
    });
  });
});

describe('normalizedPathLengths', () => {
  it('is 0 at the start and 1 at the end', () => {
    const s = normalizedPathLengths([vec2(0, 0), vec2(3, 4), vec2(6, 8)]);
    expect(s[0]).toBe(0);
    expect(s[s.length - 1]).toBeCloseTo(1, 12);
  });

  it('is proportional to cumulative chord length', () => {
    // Equal 5-unit chords → 0, 0.5, 1.
    const s = normalizedPathLengths([vec2(0, 0), vec2(3, 4), vec2(6, 8)]);
    expect(s[1]).toBeCloseTo(0.5, 12);
  });
});
