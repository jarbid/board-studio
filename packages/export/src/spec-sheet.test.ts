import { describe, expect, it } from 'vitest';
import { specSheetHtml } from './spec-sheet';

describe('specSheetHtml', () => {
  const doc = {
    title: 'Pintail 6\'2"',
    designer: 'Ada',
    info: [['Surfer', 'Grace']] as const,
    rows: [
      ['Length', '187.96 cm'],
      ['Volume', '32.5 l'],
    ] as const,
  };

  it('produces a self-contained HTML document with the heading and rows', () => {
    const html = specSheetHtml(doc);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Spec Sheet');
    expect(html).toContain('by Ada');
    expect(html).toContain('<b>Surfer:</b> Grace');
    expect(html).toContain('<td class="l">Length</td><td class="v">187.96 cm</td>');
    expect(html).toContain('<td class="l">Volume</td><td class="v">32.5 l</td>');
  });

  it('escapes HTML-significant characters in interpolated text', () => {
    const html = specSheetHtml({
      title: 'A & B <C>',
      info: [['Note', '<script>x</script>']],
      rows: [['Width & depth', '> 20']],
    });
    expect(html).toContain('A &amp; B &lt;C&gt;');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Width &amp; depth');
    expect(html).not.toContain('<script>x</script>');
  });

  it('falls back to a default heading when the title is empty', () => {
    const html = specSheetHtml({ title: '', info: [], rows: [] });
    expect(html).toContain('Surfboard — Spec Sheet');
  });
});
