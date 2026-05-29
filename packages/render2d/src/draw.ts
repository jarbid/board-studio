import type { Spline, Vec2 } from '@board-studio/kernel';
import { sampleSpline } from './sample';
import { worldToScreen, type Viewport } from './viewport';
import type { Hit } from './hit';

export interface DrawStyle {
  curve: string;
  curveWidth: number;
  handleLine: string;
  point: string;
  pointSelected: string;
  tangent: string;
}

export const defaultStyle: DrawStyle = {
  curve: '#cc785c',
  curveWidth: 2,
  handleLine: 'rgba(140,140,150,0.6)',
  point: '#e8e3dd',
  pointSelected: '#cc785c',
  tangent: '#8a8a93',
};

/** Reflection options: outline mirrors across y=0; cross-sections across x=0. */
export interface Mirror {
  mirrorX?: boolean;
  mirrorY?: boolean;
}

const reflections = (m: Mirror): ((p: Vec2) => Vec2)[] => {
  const fns: ((p: Vec2) => Vec2)[] = [(p) => p];
  if (m.mirrorY) fns.push((p) => ({ x: p.x, y: -p.y }));
  if (m.mirrorX) fns.push((p) => ({ x: -p.x, y: p.y }));
  return fns;
};

/** Stroke a spline as a sampled polyline, plus any requested mirror reflections. */
export const drawSpline = (
  ctx: CanvasRenderingContext2D,
  spline: Spline,
  vp: Viewport,
  style: DrawStyle,
  mirror: Mirror = {},
): void => {
  const pts = sampleSpline(spline);
  if (pts.length === 0) return;
  ctx.strokeStyle = style.curve;
  ctx.lineWidth = style.curveWidth;
  for (const f of reflections(mirror)) {
    ctx.beginPath();
    const first = worldToScreen(vp, f(pts[0]!));
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const s = worldToScreen(vp, f(pts[i]!));
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
  }
};

const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
};

/** Draw control points + tangent handles for a spline. */
export const drawControlPoints = (
  ctx: CanvasRenderingContext2D,
  spline: Spline,
  vp: Viewport,
  style: DrawStyle,
  selectedIndex: number | null,
): void => {
  spline.knots.forEach((k, i) => {
    const end = worldToScreen(vp, k.end);
    const prev = worldToScreen(vp, k.tangentToPrev);
    const next = worldToScreen(vp, k.tangentToNext);

    ctx.strokeStyle = style.handleLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();

    dot(ctx, prev.x, prev.y, 3, style.tangent);
    dot(ctx, next.x, next.y, 3, style.tangent);
    dot(ctx, end.x, end.y, 5, i === selectedIndex ? style.pointSelected : style.point);
  });
};

export const clear = (ctx: CanvasRenderingContext2D, w: number, h: number, bg = '#1b1b1f') => {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
};

export type { Hit };
