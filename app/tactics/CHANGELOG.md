# Tactics Changelog

This changelog tracks only major changes:

- Relevant new features.
- Major bug fixes that change behavior.

Small tweaks and minor touch-ups are not listed.

## 2026-03-18

### Features

- Constants reorganization: split into `constants/game.ts` and `constants/formations.ts`, with `constants/index.ts` barrel exports for cleaner imports.
- New realistic formations:
  - Offense: `wishbone`, `flexbone`.
  - Defense: `4-4`, `46`.
- Offensive LOS visual indicator: offensive players on the LOS now show their label in red.
- New per-player editing: selecting a player opens a settings panel to change the label (max 3 letters) and, for eligible offensive players, assign common routes.
- Route visualization on the field: a black arrowed line is drawn from the player for selected offensive routes.
- Advanced offensive route editing: the arrow tip is draggable to extend the route in its current direction while keeping the start and break points fixed.
- Offensive route break-point editing: the break point is now also draggable to extend or shorten the initial route segment.
- New toggle in Game Settings to lock player movement (`Players: Locked`).
- Global state refactor: introduced `GameProvider` with `useGame` to share state/actions across components and reduce prop drilling (especially in `TacticsSidebar`).
- Additional architecture refactor: split global state into two providers (`DrawingProvider` and `GameStateProvider`) to isolate responsibilities and reduce unnecessary UI rerenders.
- Context simplification: formation and route option constants are no longer passed through providers; they are now imported directly from `constants` where used.
- Decoupled providers into dedicated files: `DrawingProvider.tsx` and `GameStateProvider.tsx`.
- Final cleanup of the refactor: removed `GameProvider.tsx` (compatibility barrel) and kept direct imports from the dedicated providers.
- Data-driven formations refactor: introduced `constants/formations.json` with `offense` and `defense`; `applyOffenseFormation` and `applyDefenseFormation` now use direct ID-based lookups instead of multiple `if` blocks.
- Formation schema evolution: each formation now includes `label` and `players` inside `formations.json`; formation options (`offenseFormationOptions` and `defenseFormationOptions`) are generated from JSON instead of hardcoded arrays.
- Player defaults extraction: introduced `constants/players.json` for role mappings (e.g. `O-QB`, `D-CB1`), and updated `formations.ts` to consume JSON instead of an inline `roles` map.
- New defensive coverage feature: added a coverage selector (`Cover 0/1/2/3/4/6`) in Defense Settings, plus on-field dashed purple rectangle zones that visualize the selected zone coverage.
- Defensive coverage rendering fixes: zones are now outline-only (no fill), constrained to the defensive side from the LOS upward, and `Cover 0` no longer renders zone boxes (man coverage).
- Coverage coaching labels: each coverage rectangle now shows a top-centered zone name (e.g. `Flat`, `Hook`, `Curl/Hook`, `Deep 1/3`, `Deep 1/2`, `Deep 1/4`) for clearer assignment visualization.
- Coverage layout tuning: deep zones are now placed directly above underneath zones (instead of near the end zone), and zone labels are rendered at the top-center inside each rectangle.
- Coverage boundary adjustment: removed the extra deep-zone top cap so deep zones can extend to the end of the field; regular touchdown-line clamping remains for zone rendering.
- Defensive assignment overlay: when `Players: Locked` is enabled, selecting a defender and using `Ctrl+click` (`Cmd+click` on Mac) on the field now creates a purple arrow from that player to the clicked target zone center.
- Defensive assignment quick-clear: `Ctrl+double click` (`Cmd+double click` on Mac) on a defender now removes that defender's assignment arrow.
- Near-zone package selector: Defense Settings now includes `Near Zones` (3/4/5) to regenerate underneath zones dynamically: `3 = Curl to Flat L/R + Middle`, `4 = Flat L/R + Curl L/R`, `5 = Flat L/R + Curl L/R + Middle`.
- Play persistence workflow: added a `Play name` input with `Save Play` and `Load Play` actions in Game Settings; saved plays are stored in `localStorage` as JSON snapshots of the current play state, and loading is handled through a dedicated modal component with list + `Load`/`Cancel` flow.
