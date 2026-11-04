# Implementation Plan: Skate Game — core game

**Feature:** `001-skate_game` · **Date:** 2026-11-04 · **Spec:** [spec.md](spec.md) v0.1 · **Constitution:** v1.0

## Summary

One HTML page plus eight ES modules and a vendored Three.js. A fixed-step (120 Hz) character controller moves a skater over a procedurally built park using raycasts for ground contact and segment tests for rails. Tricks are small state machines that animate the board/skater and push entries onto a combo; landing validation banks or bails. A DOM overlay is the HUD and the menus. Everything is generated in code; there are no asset files and no network calls.

## Technical context

- **Language:** HTML/CSS + vanilla ES modules; no build, no TypeScript.
- **Dependency:** Three.js **0.187.0** (MIT) — `src/vendor/three.module.js` + `three.core.js`, loaded via an import map (`"three": "./vendor/three.module.js"`).
- **Rendering:** `WebGLRenderer`, `PerspectiveCamera`, one `DirectionalLight` with a shadow map + `HemisphereLight`, `MeshLambertMaterial`/`MeshStandardMaterial` flat colors, fog for depth.
- **Storage:** `localStorage["skate_game.best"]` only.
- **Testing:** Playwright + the container's Chromium (software WebGL). A smoke script loads the page, starts a run, injects key events, and asserts on a debug handle `window.__skate` (state, score, combo). Screenshots at fixed moments for eyeballing.
- **Target:** desktop evergreen browsers; served over HTTP (GitHub Pages / `python3 -m http.server`).
- **Performance budget:** < 60 draw calls, < 50 k triangles, one shadow-casting light, 2 raycasts + ≤ 12 segment tests per physics step.

## Constitution check

| Article | How this plan complies |
|---|---|
| I. What it is | All five user stories are in `tasks.md`; start → run → end screen → restart loop; no borrowed names, art or audio. |
| II. Runs anywhere | Import map + vendored lib; `src/` is self-contained; procedural everything; `VERSION` and `LICENSE` beside the library. |
| III. Feel first | Fixed 120 Hz step with accumulator and sub-step cap; controls on the start screen; bail reasons in the HUD; no network. |
| IV. Scope | One park (`park.js`), one skater, keyboard, two modes, the listed trick set, custom controller (no engine). |
| V. Process | Each phase is a round; implementation commits map to task IDs; Playwright check before "kept." |

## Project structure

```
projects/skate_game/
├── README.md                 # how to run it locally, controls
├── src/
│   ├── skate.html            # entry (project.yml.entry); import map; HUD + menu DOM
│   ├── styles.css
│   ├── vendor/               # three.module.js, three.core.js, LICENSE, VERSION
│   └── js/
│       ├── main.js           # boot, game loop (fixed step + render), mode/state, debug handle
│       ├── input.js          # key state, edge detection, blur release, sequences (manual)
│       ├── park.js           # builds the park: meshes + collision list + rail segments + spawn
│       ├── skater.js         # skater + board model, poses, animation helpers
│       ├── controller.js     # physics: ground/air/grind/manual/bail state machine
│       ├── tricks.js         # trick table, flip/grab/spin logic, landing validation
│       ├── scoring.js        # combo accumulation, banking, best score persistence
│       ├── hud.js            # DOM overlay: score, combo string, timer, balance meter, menus
│       └── audio.js          # Web Audio synth: push, pop, land, grind loop, bail
└── tests/
    └── smoke.mjs             # Playwright: loads, plays, asserts, screenshots
```

## Key designs

### Park (`park.js`)
Coordinates in metres, +Y up, ground at y = 0. Builder returns `{ scene objects, colliders: Mesh[], rails: Rail[], spawn }`.

| Obstacle | Geometry | Position | Exercises |
|---|---|---|---|
| Half-pipe | two quarter pipes (radius 3 m, 1.2 m vert extension, 14 m wide) facing each other 12 m apart, decks behind each | west end | vert air, transition rolling |
| Bank + kicker | 20° bank 3 m long; 35° kicker 1.5 m long | centre-south | launches, spin setups |
| Funbox | 1 m tall box 6×4 m with 25° banks on four sides; two 6 m rails on top at the long edges | centre | kicker → rail → kicker combos |
| Flat rail | round rail 8 m long, 0.45 m high | centre-north | 50-50 / boardslide basics |
| Ledge | 0.4 m tall concrete ledge 8 m long; grind line at its top edge | north | 5-0 / nosegrind |
| 6-stair + handrail | 6 steps (0.17 m rise, 0.3 m run) with a round handrail along the slope | east | drop + sloped grind |
| Walls | 1 m tall boundary, 80 × 60 m | perimeter | keeps the skater in |

Transitions are `ExtrudeGeometry` of a quarter-circle profile with 24 segments (normals smooth enough for a 120 Hz raycast). All colliders are `BufferGeometry` with `computeBoundingBox`/`BoundingSphere`; the raycaster is given the collider array only (decorations excluded).

Rails: `{ a: Vector3, b: Vector3, kind: "round"|"ledge", name }`. Slope rails allowed (stairs).

### Controller (`controller.js`) — state machine
States: `ROLL`, `AIR`, `GRIND`, `MANUAL`, `BAIL`.

Per fixed step (`dt = 1/120`):
1. **Probe ground.** Ray from `pos + up*0.5` along `-up`, maxDist 0.9; fallback ray from `pos + (0,0.5,0)` straight down. Hit within `snap = 0.35` ⇒ grounded candidate with point `p`, normal `n`.
2. **ROLL:** set `up = n` (slerped), `pos = p`. Forward `f` = heading projected on the plane. `v += g·dt` projected on plane (slope accel); push adds `+6 m/s²` along `f` up to `vmax = 14 m/s`; brake `−8 m/s²`; rolling friction `−0.4 m/s²`; lateral velocity (perpendicular to `f`) damped hard (`×0.0^dt` style) so carving redirects speed. Turn rate = `2.6 rad/s · clamp(1 − speed/22, 0.35, 1)`. Lean = turn input × speed factor (visual). If the surface normal's vertical component < 0.15 and `v·n` would leave the surface (lip), or the probe misses next step → `AIR` with velocity preserved (this is what makes lips launch along the tangent). Ollie: charge while held (≤ 0.4 s), release → `v += up·(4.2 + 2.3·charge)` → `AIR`.
3. **AIR:** `v += g·dt` (`g = −22 m/s²`, snappy game gravity). Turn keys spin yaw at `4.5 rad/s`; `spinAccum += |Δyaw|`. Board visual pitch/roll from tricks. Up vector eases back toward world-up. Landing: probe hit while `v·n < 0` ⇒ `tricks.validateLanding()` → ROLL (bank) or BAIL. Rail capture checked first: if descending and within `0.55 m` horizontally of a rail segment and `pos.y − railY ∈ [−0.1, 0.45]` ⇒ `GRIND`.
4. **GRIND:** `pos` = closest point on segment + rail offset; `v` = `dir · speed` where `dir` is the rail direction with the sign of the entry velocity; `speed` decays `−0.6 m/s²`, min 2 m/s. Balance: `bal += (drift + lean·dt)`, drift grows `0.35·t`; turn keys apply `∓2.2/s`; `|bal| ≥ 1` ⇒ BAIL("lost balance"). Past the end of the segment ⇒ `AIR` with velocity preserved (`landingPending`). Ollie ⇒ `AIR`, combo continues.
5. **MANUAL:** ROLL physics plus balance as in GRIND (drift `0.45·t`), score `+10/0.1 s`, `MANUAL` exits on ollie (AIR), `|bal| ≥ 1` (BAIL), or speed < 1.5 (clean end, combo stays open until next ground frame → banks).
6. **BAIL:** 1.5 s timer; skater mesh tumbles (rotation velocity decays), velocity ×0.9/step; combo discarded; then reset upright at the contact point, `ROLL` at 0 speed.
7. **Walls:** after integrating, if `|x| > 39` or `|z| > 29`, clamp and zero the outward velocity component.

Sub-stepping: `accumulator += min(frameDt, 0.1)`; while `≥ dt` step (cap 12 per frame). Render uses the latest state (no interpolation — 120 Hz step is fine visually).

### Tricks (`tricks.js`)
Table: `{ name, base, kind, duration, anim }`.

| Key | Trick | Base | Duration |
|---|---|---|---|
| J | Kickflip | 150 | 0.45 s roll 360° about board long axis |
| K | Heelflip | 150 | same, opposite sign |
| L | Pop Shove-it | 120 | 0.4 s yaw 180° about board up |
| ; | 360 Flip | 350 | 0.6 s both |
| U | Indy | 60 + 25/0.1 s | held |
| I | Melon | 60 + 25/0.1 s | held |
| O | Nosegrab | 60 + 25/0.1 s | held |
| P | Tailgrab | 60 + 25/0.1 s | held |
| spin | 180 / 360 / 540 / 720 | 100 / 250 / 450 / 700 | from `spinAccum` at landing |
| — | 50-50 / Boardslide / 5-0 / Nosegrind | 100 / 120 / 140 / 140 + 15/0.1 s | while grinding |
| — | Manual / Nose Manual | 50 + 10/0.1 s | while manualing |
| — | Ollie (alone) | 10 | — |

Flip tricks can chain (second flip starts when the first ends; pressed mid-flip is queued, max 1). Grabs can overlap a flip (board follows flip; skater pose changes). Spin rounds to nearest 180° if within 35°; otherwise landing is "sketchy" → BAIL("over-rotated"). Landing also requires `|boardPitch|,|boardRoll| < 25°` relative to surface and no flip in progress (`flipProgress ≥ 0.85` counts as done, THPS is forgiving).

Grind type at capture: angle θ between skater heading and rail dir (mod 180°): θ < 30° or > 150° → 50-50 unless forward held → Nosegrind, back held → 5-0; 60–120° → Boardslide; in between → 50-50 (forgiving).

### Scoring (`scoring.js`)
`combo = { tricks: [names], base: 0, count: 0, spinBonus }`. `add(name, points)` increments `count` and `base`. `bank()` → `score += base × count`, records `bestCombo`, clears. `bust()` clears. HUD string: `"Kickflip + 50-50 + Manual + Heelflip"` with `"1,250 × 4"` beneath. Best score persisted on bank and at run end.

### HUD/menus (`hud.js`)
DOM only (no canvas text). Elements: `#score`, `#timer`, `#combo-name`, `#combo-math`, `#balance` (hidden unless GRIND/MANUAL), `#toast` (bail reason / "NEW BEST"), `#menu` (start / pause / end variants). Keyboard-navigable: Enter = start/restart, 1/2 = mode, Esc = pause/resume, M = menu.

### Audio (`audio.js`)
`AudioContext` created on first keydown. Push: filtered noise burst 80 ms. Pop: 1 kHz→200 Hz sine sweep 60 ms + click. Land: low thud 120 ms. Grind: looping band-passed noise, gain tied to GRIND state. Bail: longer noise burst + descending tone. A mute toggle (`N`).

## Risks

| Risk | Mitigation |
|---|---|
| Raycast ground detection jitters on transition seams | smooth `up` by slerp, 24-segment profiles, snap tolerance 0.35 m, hysteresis before declaring AIR (2 consecutive misses on a steep surface) |
| Vert air returns the skater to the deck instead of the transition | gravity only; no "magnet" — it's correct physics: if you leave the lip vertically you come straight back down. Launch angle = surface tangent at the last grounded step, so it works like the real thing. |
| Software WebGL in the test browser is slow | tests assert state, not frame rate; SC-3 is measured by Chris on real hardware and recorded in EVALUATION |
| Key ghosting on cheap keyboards (3+ keys) | controls chosen so a typical combo needs ≤ 3 simultaneous keys |
