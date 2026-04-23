<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Cavern of the Evil Wizard

Retro terminal-style narrative adventure built with React + TypeScript + Vite + Tailwind.

## Current Architecture

- **Engine core:** command processing, scene transitions, checkpoints, scoring, deadlines in `src/lib/gameEngine.ts`.
- **Shared transition logic:** canonical scene entry behavior in `src/lib/engine/sceneTransition.ts`.
- **Content layer:** scenes/objects/items live in `src/gameData.ts`.
- **Content validation:** startup schema/reference checks in `src/lib/contentSchema.ts`.
- **UI composition:** shell split into `GameShell`, `ModalLayer`, `PanelSystem`, and `TerminalView`.
- **Terminal messaging:** message classification in `src/lib/terminalMessages.ts`.

## Prerequisites

- Node.js 20+
- npm

## Local Development

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open `http://localhost:3000`

## Scripts

- `npm run dev` - start Vite dev server on port 3000.
- `npm run lint` - run TypeScript typecheck (`tsc --noEmit`).
- `npm run test` - run all Node test suites in `tests/*.test.ts`.
- `npm run test:unit` - alias of unit/integration test command.
- `npm run test:visual` - run BackstopJS visual regression checks.
- `npm run test:visual:approve` - approve latest BackstopJS baseline snapshots.
- `npm run build` - create production build in `dist/`.
- `npm run preview` - preview production build locally.

## Testing and Quality

- CI deploy workflow runs tests before production build.
- Content integrity + schema validation tests help protect story data quality.
- Engine transition tests verify typed effect behavior.
- Terminal message tests verify command/system/fatal/narrative rendering paths.

## Theming

- Semantic design tokens are defined in `src/index.css` (`@theme` color/font tokens).
- Prefer token classes (`bg-bg-base`, `text-accent-cyan`, etc.) over inline hex values.

## Visual Regression

BackstopJS configuration lives in `backstop.config.cjs`.

- Reference/test artifacts are written under `tests/visual/backstop_data/`.
- Default scenario currently captures the title screen across desktop/mobile viewports.

## Notes

- Save format can change during active rewrite/refactor work.
- Large gameplay/content updates should keep `src/gameData.ts` and tests in sync.

## Authoring Documentation

- Gameplay/story updates guide: `docs/GAMEPLAY_AUTHORING_GUIDE.md`
