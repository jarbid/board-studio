// SPDX-License-Identifier: GPL-3.0-or-later
import type { Vec2 } from './vec2';
import { vec2 } from './vec2';

/**
 * Least-squares cubic Bézier fit, ported from legacy `cadcore.BezierFit`.
 *
 * Given a list of sample points, returns the four control points
 * `[p0, c1, c2, p3]` of the cubic Bézier that minimizes the residual sum of
 * squares, using chord-length parameterization for the t-indices.
 *
 * Legacy derivation (`BezierFit.bestFit`, boardcad-le/src/cadcore/BezierFit.java:701):
 *   - normalized chord lengths s[i] in [0,1] are the t-parameters of each sample
 *   - U is the n×4 design matrix with rows [s³, s², s, 1]
 *   - M is the 4×4 cubic Bézier basis matrix
 *   - the fitted control points are  P = M⁻¹ · (UᵀU)⁻¹ · Uᵀ · D
 *     where D is the n×2 matrix of sample coordinates.
 *
 * The legacy used the UJMP matrix library and fell back to a symmetric-positive-
 * definite inverse (`invSPD`) when a determinant was zero. Here we use a Gauss-
 * Jordan inverse for the well-conditioned 4×4 systems; for the (rare) singular
 * case we fall back to a Moore-Penrose pseudo-inverse, which agrees with `invSPD`
 * for the SPD matrices that arise here.
 *
 * Pure and immutable; no UI/AWT coupling (legacy depended on `java.awt.geom`).
 */

/** The cubic Bézier basis matrix M (legacy `BezierFit.M()`). */
const M: readonly (readonly number[])[] = [
  [-1, 3, -3, 1],
  [3, -6, 3, 0],
  [-3, 3, 0, 0],
  [1, 0, 0, 0],
];

/**
 * Normalized cumulative chord lengths in [0,1] (legacy
 * `BezierFit.normalizedPathLengths`). The final element is always 1 (unless all
 * points coincide, in which case every entry is NaN — matching the legacy, which
 * divides by a zero total length).
 */
export const normalizedPathLengths = (points: readonly Vec2[]): number[] => {
  const n = points.length;
  const pathLength = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    pathLength[i] = pathLength[i - 1]! + Math.sqrt(dx * dx + dy * dy);
  }
  const total = pathLength[n - 1]!;
  return pathLength.map((l) => l / total);
};

// --- minimal dense linear algebra (only what BezierFit needs) ---

/** Multiply an a×b matrix by a b×c matrix. */
const matMul = (
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
): number[][] => {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0]!.length;
  const out: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const aik = a[i]![k]!;
      if (aik === 0) continue;
      for (let j = 0; j < cols; j++) out[i]![j]! += aik * b[k]![j]!;
    }
  }
  return out;
};

const transpose = (a: readonly (readonly number[])[]): number[][] => {
  const rows = a.length;
  const cols = a[0]!.length;
  const out: number[][] = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out[j]![i] = a[i]![j]!;
  return out;
};

/**
 * Gauss-Jordan inverse of a square matrix with partial pivoting. Returns `null`
 * when the matrix is singular (caller falls back to a pseudo-inverse).
 */
const inverse = (a: readonly (readonly number[])[]): number[][] | null => {
  const n = a.length;
  const m: number[][] = a.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_unused, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-15) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const pv = m[col]![col]!;
    for (let j = 0; j < 2 * n; j++) m[col]![j]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]!;
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r]![j]! -= f * m[col]![j]!;
    }
  }
  return m.map((row) => row.slice(n));
};

/**
 * Moore-Penrose pseudo-inverse via normal equations: A⁺ = (AᵀA)⁻¹Aᵀ for tall A,
 * or Aᵀ(AAᵀ)⁻¹ otherwise. Used only as the singular-case fallback (mirrors the
 * legacy `invSPD` branch). For square SPD inputs this equals the true inverse.
 */
const pseudoInverse = (a: readonly (readonly number[])[]): number[][] => {
  const at = transpose(a);
  const ata = matMul(at, a);
  const inv = inverse(ata);
  if (inv) return matMul(inv, at);
  const aat = matMul(a, at);
  const inv2 = inverse(aat);
  if (inv2) return matMul(at, inv2);
  // Degenerate: return transpose (best effort), matching no-op fallback.
  return at as number[][];
};

const invOrPseudo = (a: readonly (readonly number[])[]): number[][] =>
  inverse(a) ?? pseudoInverse(a);

/**
 * Best cubic Bézier fit of `points`. Returns four control points `[p0,c1,c2,p3]`.
 * Requires at least 2 points (the legacy degenerates for fewer, dividing by a
 * zero path length). Tolerance against legacy: see bezier-fit.test.ts.
 */
export const bestFit = (points: readonly Vec2[]): [Vec2, Vec2, Vec2, Vec2] => {
  const npls = normalizedPathLengths(points);

  // U: n×4 with rows [s³, s², s, 1]
  const U: number[][] = npls.map((s) => [s ** 3, s ** 2, s, 1]);
  const UT = transpose(U);
  const X: number[][] = points.map((p) => [p.x]);
  const Y: number[][] = points.map((p) => [p.y]);

  const Minv = invOrPseudo(M);
  const A = matMul(UT, U); // 4×4
  const B = invOrPseudo(A); // (UᵀU)⁻¹
  const C = matMul(Minv, B); // M⁻¹ (UᵀU)⁻¹
  const D = matMul(C, UT); // … Uᵀ  (4×n)
  const E = matMul(D, X); // 4×1  → control-point x
  const F = matMul(D, Y); // 4×1  → control-point y

  const cp = (i: number): Vec2 => vec2(E[i]![0]!, F[i]![0]!);
  return [cp(0), cp(1), cp(2), cp(3)];
};
