# Smoke Test Checklist

Use this checklist for a quick confidence pass after major changes.

## Setup

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Start from a clean browser tab/session.

## Core Flow (Critical Path)

1. **Title -> Start Game**
   - Click **START GAME**.
   - Confirm naming flow appears and transitions into gameplay.

2. **Intro -> Bedroom transition**
   - Complete intro choice flow into `bedroom`.
   - Confirm terminal output appears correctly (no missing/garbled lines).

3. **Basic interaction + inventory pickup**
   - In bedroom, run/open wardrobe path to obtain **old key**.
   - Confirm pickup animation runs and inventory panel reflects item.

4. **Object interaction state progression**
   - Interact with wardrobe/rug multiple times to verify stateful responses.
   - Confirm repeated actions produce expected redundant/fallback messages.

5. **Scene transition**
   - Use key/door flow to leave bedroom and enter hallway.
   - Confirm scene image/title/state updates and terminal narration align.

## UI and Panel Behavior

6. **Right rail panel behavior**
   - Expand/collapse both Inventory and Scene Objects panels.
   - Confirm rows are stable (no random shape/size jumps).

7. **Modal stack behavior**
   - Open/close Settings, Help, and Load dialogs.
   - Press `Escape` and click backdrop to close.
   - Confirm no modal remains visually stuck behind another.

8. **Mobile drawer behavior** (responsive mode)
   - Switch to narrow viewport in devtools.
   - Toggle left and right drawers.
   - Confirm dimmer overlays and close buttons behave consistently.

## Terminal and Message Rendering

9. **Message styles**
   - Trigger normal narrative, system-style, and fatal/game-over message lines.
   - Confirm each message renders with intended styling and readability.

10. **Typewriter continuity**
   - Verify latest line typewriter behavior and skip behavior on click/input.
   - Confirm no duplicated or skipped state transitions.

## Save/Load and Recovery

11. **Checkpoint/save**
   - Save progress from settings.
   - Confirm save slot appears in Load modal.

12. **Load + note edit/delete**
   - Edit save note, reload slot, and test delete confirmation flow.
   - Confirm slot list updates accurately.

13. **Game over recovery**
   - Trigger a death path.
   - Confirm reload checkpoint/start over behavior works and recovers cleanly.

## Audio and Settings

14. **Audio controls**
   - Test mute/unmute, BGM slider, SFX slider.
   - Confirm values update and persist for the active session.

15. **System actions**
   - Verify HELP, SYSTEM_REBOOT, and (dev) DATA_LOG entries open and close properly.

## Final Verification

16. Run:
   - `npm run lint`
   - `npm run test`
   - `npm run build`

17. Confirm:
   - No lint/test/build failures.
   - No visual regressions in the key path above.

## Optional Extended Pass

- Continue playthrough from hallway to at least one major cutscene branch.
- Validate one full story branch through inventory use, branch choice, and recovery flow.
