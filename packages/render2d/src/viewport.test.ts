import { describe, expect, it } from 'vitest';
import { fitToBounds, pan, screenToWorld, worldToScreen, zoomAt } from './viewport';

describe('viewport', () => {
  const vp = { scale: 2, originX: 100, originY: 200 };

  it('round-trips world<->screen (y inverted)', () => {
    const p = { x: 30, y: 15 };
    const s = worldToScreen(vp, p);
    expect(s).toEqual({ x: 160, y: 170 });
    const back = screenToWorld(vp, s);
    expect(back.x).toBeCloseTo(30, 9);
    expect(back.y).toBeCloseTo(15, 9);
  });

  it('zoomAt keeps the anchor point fixed', () => {
    const anchor = { x: 160, y: 170 };
    const before = screenToWorld(vp, anchor);
    const z = zoomAt(vp, anchor, 1.5);
    const after = screenToWorld(z, anchor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(z.scale).toBeCloseTo(3, 9);
  });

  it('fitToBounds centers and scales to fit', () => {
    const f = fitToBounds({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, 520, 320, 10);
    // width-limited: (520-20)/100 = 5 ; height allows (320-20)/50=6 -> min = 5
    expect(f.scale).toBeCloseTo(5, 9);
    const center = screenToWorld(f, { x: 260, y: 160 });
    expect(center.x).toBeCloseTo(50, 6);
    expect(center.y).toBeCloseTo(25, 6);
  });

  it('pan shifts the origin', () => {
    expect(pan(vp, 10, -5)).toEqual({ scale: 2, originX: 110, originY: 195 });
  });
});
