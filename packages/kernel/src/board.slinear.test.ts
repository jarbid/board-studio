// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { board, getCrossSectionAreaAt, getLength, getVolume } from './board';
import { parseBrdGeometry } from './test-support/brd-geometry';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = resolve(here, '../../../docs/specs/golden');

interface SLinearArea {
  frac: number;
  pos: number;
  area: number;
}
interface SLinearBoard {
  length: number;
  volume: number;
  areas: SLinearArea[];
}
const golden: { sLinear: Record<string, SLinearBoard> } = JSON.parse(
  readFileSync(resolve(goldenDir, 'interp.golden.json'), 'utf8'),
);

// Rebuild the parsed (controlPoint) board with the sLinear interpolation model.
const loadSLinearBoard = (name: string) => {
  const b = parseBrdGeometry(readFileSync(resolve(goldenDir, `${name}.brd`), 'utf8'));
  return board(b.outline, b.bottom, b.deck, b.crossSections, 'sLinear');
};

// The sLinear port reproduces the legacy to ~12 significant figures (the chained
// arc-length / reverse-tangent / Simpson searches use the same constants), so the
// agreement is far tighter than the model needs. We assert a comfortable 1e-4
// relative band that still leaves headroom for platform float-ordering drift.
// See docs/specs/slinear-interpolation.md for the derivation and exact figures.
const AREA_PCT = 1e-4;
const VOL_PCT = 1e-4;

const withinPct = (actual: number, expected: number, pct: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(pct);

for (const name of ['shortboard', 'funboard', 'longboard']) {
  describe(`sLinear interpolation vs golden: ${name}`, () => {
    const b = loadSLinearBoard(name);
    const g = golden.sLinear[name]!;

    it('length matches', () => {
      expect(Math.abs(getLength(b) - g.length)).toBeLessThanOrEqual(0.05);
    });

    it('does not throw for sLinear (gap closed)', () => {
      expect(() => getCrossSectionAreaAt(b, g.length / 2, 10)).not.toThrow();
    });

    it('per-station cross-section area matches legacy sLinear', () => {
      for (const a of g.areas) {
        withinPct(getCrossSectionAreaAt(b, a.pos, 10), a.area, AREA_PCT);
      }
    });

    it('volume within 1%', () => withinPct(getVolume(b), g.volume, VOL_PCT));
  });
}
