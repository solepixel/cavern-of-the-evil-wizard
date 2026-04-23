# Rewrite Branch Policy

This project is in a full rewrite phase focused on architecture quality, deterministic behavior, and long-term maintainability.

## Branch Rules

- Use a dedicated rewrite branch for structural refactors.
- Keep `main` as the stable playable baseline until rewrite milestones are accepted.
- Avoid net-new gameplay features unless they are needed to validate the rewrite architecture.

## Feature Freeze Scope

- Frozen: new narrative arcs, new items/scenes, non-essential UI flair.
- Allowed: parity fixes, architecture extraction, component consolidation, testing/theming infrastructure.

## Parity Contract

- Existing command/story paths are the source of truth while rewriting.
- Every rewrite milestone must preserve:
  - command routing outcomes
  - scene transition behavior
  - inventory/equipment state behavior
  - game-over and checkpoint semantics

## Delivery Cadence

- Land rewrite in phases behind clear module boundaries.
- Prefer small vertical slices (engine core + adapter + tests) over wide speculative changes.
- Keep CI green on each phase before starting the next.

## Current Milestone Sequence

1. Engine transition core + typed effects.
2. Content schema validation and authoring cleanup.
3. UI shell/component decomposition.
4. Message rendering model and terminal cleanup.
5. Theme token migration.
6. Test and visual-regression hardening.
