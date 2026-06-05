// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Render a {@link TemplateSheet} to ASCII (R12) DXF. Parts are laid out in a row.
 * Layers: CUT (through-cuts incl. slots), CUTINNER (lightening holes), MARK
 * (centrelines / station lines, dashed), LABEL (text).
 *
 * Output is in **millimetres** (the de-facto CAM / laser unit, matching the SVG
 * writer), and the file declares `$INSUNITS = 4` so importers don't guess and
 * land the parts at the wrong scale. The sheet model is centimetres, so every
 * coordinate is scaled ×10 on the way out.
 */
import { rowLayout } from './construction/geom';
import type { Loop, Part, Pt, TemplateSheet } from './construction/types';

const LAYERS = {
  CUT: 5, // blue
  CUTINNER: 4, // cyan
  MARK: 3, // green
  LABEL: 8, // grey
} as const;
type Layer = keyof typeof LAYERS;

const GAP = 5; // cm between parts (scaled to mm on output)
const CM_TO_MM = 10;

/** Format a centimetre value as a millimetre DXF coordinate. */
const mm = (cm: number): string => (Number.isFinite(cm) ? cm * CM_TO_MM : 0).toFixed(4);

const polyline = (out: string[], pts: readonly Pt[], layer: Layer, closed: boolean): void => {
  if (pts.length < 2) return;
  out.push('0', 'POLYLINE', '8', layer, '66', '1', '70', closed ? '1' : '0');
  for (const p of pts) {
    out.push('0', 'VERTEX', '8', layer, '10', mm(p.x), '20', mm(p.y), '30', '0.0');
  }
  out.push('0', 'SEQEND');
};

const text = (out: string[], p: Pt, h: number, str: string): void => {
  out.push(
    '0',
    'TEXT',
    '8',
    'LABEL',
    '10',
    mm(p.x),
    '20',
    mm(p.y),
    '30',
    '0.0',
    '40',
    mm(h),
    '1',
    str,
  );
};

/** R12 HEADER declaring drawing units as millimetres ($INSUNITS = 4). */
const headerSection = (out: string[]): void => {
  out.push('0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC');
};

const loopLayer = (l: Loop): Layer =>
  l.kind === 'cut' ? 'CUT' : l.kind === 'cutInner' ? 'CUTINNER' : 'MARK';

const tablesSection = (out: string[]): void => {
  out.push('0', 'SECTION', '2', 'TABLES');
  const names = Object.keys(LAYERS) as Layer[];
  out.push('0', 'TABLE', '2', 'LAYER', '70', String(names.length));
  for (const name of names) {
    out.push('0', 'LAYER', '2', name, '70', '0', '62', String(LAYERS[name]), '6', 'CONTINUOUS');
  }
  out.push('0', 'ENDTAB', '0', 'ENDSEC');
};

const drawPart = (out: string[], part: Part): void => {
  for (const l of part.loops) polyline(out, l.pts, loopLayer(l), l.closed);
  for (const lbl of part.labels ?? []) text(out, lbl.at, lbl.height, lbl.text);
};

export const sheetToDxf = (sheet: TemplateSheet): string => {
  const parts = rowLayout(sheet.parts, GAP);
  const out: string[] = ['999', `OpenShaper template: ${sheet.meta?.title ?? ''}`];
  headerSection(out);
  tablesSection(out);
  out.push('0', 'SECTION', '2', 'ENTITIES');
  for (const part of parts) drawPart(out, part);
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n') + '\n';
};
