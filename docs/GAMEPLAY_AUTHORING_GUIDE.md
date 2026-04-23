# Gameplay and Story Authoring Guide

This guide explains how to safely update and expand gameplay/story content.

## Core Files

- `src/gameData.ts` - content source of truth (`ITEMS`, `OBJECTS`, `SCENES`, `INITIAL_STATE`).
- `src/types.ts` - content and runtime type contracts.
- `src/lib/contentSchema.ts` - validation rules for references and structure.
- `src/lib/gameEngine.ts` - command processing/runtime behavior.
- `src/lib/engine/sceneTransition.ts` - canonical scene-entry/on-load progression behavior.

## Content Model Overview

- **Items (`ITEMS`)**: inventory/equipment entries with player-facing text and optional icon/slot metadata.
- **Objects (`OBJECTS`)**: interactable entities with stateful descriptions and regex-driven interactions.
- **Scenes (`SCENES`)**: locations/cutscenes with descriptions, exits, object presence, and scene-level commands.
- **State (`INITIAL_STATE`)**: starting runtime values (scene, inventory, flags, etc).

## Add a New Item

1. Add an entry in `ITEMS` with a stable `id` that matches the object key.
2. Provide:
   - `name`
   - `description`
   - `useText`
3. If equippable, define `itemType` and slot metadata (`gearSlot`/`weaponHand`).
4. Reuse a known icon name from `src/lib/iconRegistry.ts` when possible.

## Add a New Scene

1. Add a new `SCENES` entry with a stable `id`.
2. Include:
   - `title`
   - `description`
   - `objects` list (object IDs from `OBJECTS`)
   - `exits` map (direction -> valid scene ID)
3. Add optional:
   - `onLoad` (first-entry text/items/flags/sound)
   - `commands` (scene-level regex-keyed command responses)
   - `isCheckpoint` for save/checkpoint behavior
4. Ensure at least one path forward (exit, `nextScene`, or callback flow).

## Add a New Object and Interactions

1. Add object entry in `OBJECTS` with:
   - `id`
   - `name`
   - `descriptions`
   - `initialState` (and optionally `initialAxes`)
   - `interactions`
2. Each interaction should include:
   - `regex` (without surrounding `/.../`)
   - optional effects (`text`, `nextScene`, `getItem`, `setState`, etc.)
3. Prefer axis-based states (`initialAxes`, `setAxes`, `whenAxes`) for richer behavior.
4. If reusing interaction logic, use `id` + `reuseInteractionId`.

## Regex and Command Authoring Rules

- Regexes are compiled at runtime; keep patterns explicit and predictable.
- Avoid overly broad patterns that shadow other interactions.
- For scene commands (`SCENES[...].commands`), the object key itself is the regex pattern.
- Keep one clear canonical path for important story actions to prevent ambiguity.

## Scene Transition and Story Flow Rules

- All scene-entry behavior should be compatible with `transitionIntoScene(...)` behavior:
  - first-entry `onLoad` handling
  - progress scoring flags
  - scene-enter hooks where applicable
- Avoid duplicating transition logic in callbacks unless absolutely necessary.
- Use `nextScene` for simple moves; use `callback` only for exceptional branching logic.

## Checkpoints, Death, and Deadlines

- `isCheckpoint` scenes can persist checkpoint snapshots.
- Death flows should set game-over state consistently and append clear fatal messaging.
- Deadline-based choices should use the established deadline fields and reason IDs.

## Theming and Content UI Consistency

- Use semantic theme tokens (not new hard-coded hex values).
- For any new UI text/state messaging, keep terminal tone/style aligned with existing content.

## Validation and Test Workflow

After content edits, run:

1. `npm run lint`
2. `npm run test`
3. `npm run build`

Validation is enforced through:

- `tests/content-schema.test.ts` (registry/schema integrity)
- `tests/game-integrity.test.ts` (scene graph/integrity checks)

## Quick Expansion Checklist

- [ ] New IDs are unique and stable.
- [ ] Every referenced scene/object/item exists.
- [ ] New scene has at least one forward path.
- [ ] Regex patterns do not conflict with existing critical commands.
- [ ] Tests/lint/build pass.

## Recommended Workflow for New Story Beats

1. Draft the beat as a minimal scene/object set.
2. Implement one happy-path command flow end-to-end.
3. Add fallback/error interactions for missing requirements.
4. Run tests and manually play through the new branch.
5. Iterate on narrative text only after behavior is stable.
