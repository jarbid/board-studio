import { tessellateBoard, type BezierBoard } from '@board-studio/kernel';
import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Build a centered Three.js BufferGeometry from the kernel board tessellation.
 * Centering puts the board's bounding-box midpoint at the origin so a fixed
 * camera/orbit target frames it regardless of board size.
 */
export function boardGeometry(board: BezierBoard): BufferGeometry {
  const mesh = tessellateBoard(board);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
  g.setIndex(new BufferAttribute(mesh.indices, 1));
  g.computeBoundingBox();
  g.center();
  return g;
}

/** Rough board size (max bbox dimension, cm) for camera framing. */
export function boardSpan(board: BezierBoard): number {
  const mesh = tessellateBoard(board);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i]!;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return Number.isFinite(max - min) && max > min ? max - min : 200;
}
