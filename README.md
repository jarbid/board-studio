# Board Studio

Free, open-source surfboard CAD that runs entirely in your browser — a from-scratch
modern rebuild of the legacy Java/Swing [BoardCAD-LE](https://github.com/ciditup/boardcad).
Design outlines, rocker, and cross-sections; see live volume, area and weight; preview
the board in 3D; and export STL / DXF / PDF — all client-side, nothing to install, no account.

**▶ Live app: https://jarbid.github.io/board-studio/**

A passion project for the shaping community. Built and shared under the GPL, the same
license as the BoardCAD it descends from.

## Features

- Outline, rocker, and cross-section editors driven by one shared board model
- Live specs: length, width, thickness, volume, plan-shape area, center of mass, weight
- 3D preview (Three.js) with a striped-reflection shading mode for fairness checks
- Compare against a "ghost" board; printable spec sheet
- Export **STL** (3D print / CAM), **DXF** (2D outline), and **PDF**, plus a native
  `.board.json` save — every format free
- Reads legacy `.brd` files

## Stack

- pnpm workspaces + Turborepo + Vite (static SPA — no server, no database)
- React 18 + TypeScript, Tailwind CSS
- Zustand (board document + command/undo)
- Canvas 2D editors; Three.js / react-three-fiber 3D
- Pure, immutable, framework-agnostic geometry kernel pinned to golden reference data
- Tauri 2 optional desktop shell wrapping the same web app

## Layout

```
apps/web        the product (React)
apps/desktop    Tauri native shell wrapping apps/web
packages/kernel pure geometry + board model (port of cadcore + board)
packages/io     file readers/writers (.brd in; .board.json/DXF/STL/PDF out)
packages/store  board document store, command/undo, derived-spec selectors
packages/render2d  canvas viewport + 2D editor draw layer
packages/render3d  three.js board mesh + scene
packages/units  metric/imperial + fraction formatting
packages/export STL/DXF/PDF/spec-sheet exporters
packages/ui     design-system components
docs/specs      extracted legacy behavior specs + golden reference data
```

## Develop

```sh
pnpm install
pnpm dev          # run the web app
pnpm test         # all package tests (kernel golden tests, etc.)
pnpm typecheck
pnpm build        # static build to apps/web/dist
```

Pushes to `main` build and deploy the live app to GitHub Pages automatically
(`.github/workflows/deploy-pages.yml`).

## Contributing

Issues and pull requests welcome — bug reports, board templates, file-format fixes,
and shaping-domain feedback especially. By contributing you agree your work is licensed
under the project's GPL-3.0-or-later.

## License

Board Studio is licensed under the **GNU General Public License v3.0 or later**
(GPL-3.0-or-later) — see [`LICENSE`](./LICENSE).

Its kernel is a behavioral port of **BoardCAD-LE** and is therefore a derivative work;
we release Board Studio under the same copyleft to honor it. See [`NOTICE.md`](./NOTICE.md)
for attribution to the original BoardCAD authors. The BoardCAD-LE source is used as a
reference only and is not redistributed here.

Project orchestration and architecture conventions live in
[`.claude/CLAUDE.md`](.claude/CLAUDE.md).
