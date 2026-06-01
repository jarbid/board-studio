/**
 * Starting board templates — the three the legacy BoardCAD-LE shipped in its
 * "New Board" chooser (boardcad.DefaultBrds): Shortboard, Funboard, Longboard.
 * The exact legacy `.brd` data is bundled here so each template loads the real
 * board geometry (authentic outline / rocker / sections), not an approximation.
 * The shortboard is the same file as the default sample board.
 */
import funboardBrd from './funboard.brd?raw';
import longboardBrd from './longboard.brd?raw';
import shortboardBrd from './sample-board.brd?raw';

export interface BoardTemplate {
  name: string;
  /** Raw legacy `.brd` content, parsed with parseBrd on selection. */
  brd: string;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  { name: 'Shortboard', brd: shortboardBrd },
  { name: 'Funboard', brd: funboardBrd },
  { name: 'Longboard', brd: longboardBrd },
];
