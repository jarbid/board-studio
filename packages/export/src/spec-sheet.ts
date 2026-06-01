/**
 * Printable board spec-sheet as a standalone HTML document.
 *
 * A pure `doc -> string` transform (no DOM, no window) so it is unit-testable and
 * lives alongside the other exporters. The caller formats values into the active
 * units, hands over label/value pairs, then opens the returned HTML in a window
 * (or writes it to a file). All interpolated text is HTML-escaped.
 */
export interface SpecSheetDoc {
  /** Document title and heading (e.g. the board model, or "Surfboard"). */
  title: string;
  /** Optional designer credit, shown under the heading. */
  designer?: string;
  /** Free-form board info rows (Designer / Model / Surfer / Comments …). */
  info: readonly (readonly [string, string])[];
  /** Dimension rows (label, pre-formatted value), shown in the spec table. */
  rows: readonly (readonly [string, string])[];
}

const esc = (s: unknown): string =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

const STYLE = `body{font:14px system-ui,sans-serif;margin:40px;color:#222}h1{font-size:22px;margin:0 0 2px}.sub{color:#666;margin-bottom:20px}
table{border-collapse:collapse;width:100%;max-width:420px}td{padding:6px 4px;border-bottom:1px solid #ddd}td.l{color:#666}td.v{text-align:right;font-variant-numeric:tabular-nums}
.info{margin-bottom:18px}.info div{margin:2px 0}@media print{button{display:none}}`;

/** Build a self-contained, printable spec-sheet HTML document. */
export function specSheetHtml(doc: SpecSheetDoc): string {
  const heading = doc.title || 'Surfboard';
  const infoHtml = doc.info.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('');
  const rowsHtml = doc.rows
    .map(([k, v]) => `<tr><td class="l">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(heading)} — Spec Sheet</title>
<style>${STYLE}</style></head>
<body><h1>${esc(heading)} — Spec Sheet</h1>
<div class="sub">${esc(doc.designer ? 'by ' + doc.designer : '')}</div>
<div class="info">${infoHtml}</div>
<table>${rowsHtml}</table>
<p><button onclick="print()">Print / Save as PDF</button></p></body></html>`;
}
