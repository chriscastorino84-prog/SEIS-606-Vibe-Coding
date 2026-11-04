# Skate Game

A fully playable 3D skateboarding game in the browser, in the spirit of the classic skate games: push, ollie, flip tricks, grabs, spins, grinds, manuals, combos, a 2-minute scored run with a persisted best, and a free-skate mode. Everything — park, skater, sounds — is generated in code; the only dependency is Three.js, vendored in `src/vendor/`.

## Run it

ES modules need an HTTP server (opening `skate.html` via `file://` won't work):

```bash
cd projects/skate_game
python3 -m http.server 8765 --directory src
# open http://localhost:8765/skate.html
```

On GitHub Pages it runs as-is from `projects/skate_game/src/skate.html`.

## Controls

| | |
|---|---|
| Move | `W` `A` `S` `D` / arrows — push, turn, brake |
| Ollie | `Space` — hold to go higher; also pops off rails |
| Flips | `J` kickflip · `K` heelflip · `L` pop shove-it · `;` 360 flip |
| Grabs | `U` indy · `I` melon · `O` nosegrab · `P` tailgrab (hold) |
| Spin | `A` / `D` in the air — land within 35° of a 180 |
| Grind | land on a rail: parallel = 50-50, sideways = boardslide, hold `W`/`S` while landing = nosegrind / 5-0 · balance with `A`/`D` |
| Manual | `S` then `W` (nose manual `W` then `S`) — keeps the combo alive |
| Other | `Esc` pause · `R` restart · `M` menu · `N` mute · `C` camera |

Scoring: each trick adds base points and +1 to the multiplier; grabs, grinds and manuals keep earning while held. A clean landing banks `base × multiplier`; a bail (mid-flip landing, over-rotation, lost balance, hitting a wall fast) loses the whole combo.

## The park

Half-pipe (west) with coping · funbox with two rails (centre) · flat rail · ledge · bank with platform (south) · two kickers · 6-stair with handrail (east).

## Layout

```
src/skate.html      entry + HUD/menu DOM
src/js/main.js      scene, camera, modes, fixed-step loop, window.__skate debug handle
src/js/park.js      park geometry, colliders, rail segments
src/js/controller.js  physics state machine: ROLL / AIR / GRIND / MANUAL / BAIL
src/js/tricks.js    trick table, flip/grab/spin state, landing validation
src/js/scoring.js   combo accumulation, banking, best score
src/js/skater.js    skater + board model and poses
src/js/hud.js       DOM overlay and menus
src/js/audio.js     synthesized sound effects
src/js/input.js     keyboard state and two-key sequences
tests/smoke.mjs     Playwright test (see below)
specs/              Spec Kit: constitution → spec → plan → tasks
```

## Test

```bash
python3 -m http.server 8765 --directory src &
node tests/smoke.mjs                 # PLAYWRIGHT_PATH=… if playwright isn't resolvable; SHOTS=1 writes screenshots
```

`?test` in the URL puts the game in deterministic mode: frames only render and `window.__skate.advance(seconds)` steps the simulation. `?test&hq` keeps shadows and full resolution for screenshots.
