# Skate Game — Constitution

**Version:** 1.0 · **Ratified:** 2026-11-04 · **Governs:** `specs/001-skate_game/`

Non-negotiables for this app. Any spec, plan or task that conflicts with an article is invalid until the article is amended (log the amendment in `DECISIONS.md`).

## I. What it is
1. A fully playable, real-time **3D skateboarding game in the browser**, in the spirit of *Tony Hawk's Pro Skater*: a skater rolls around one skatepark, pushes, turns, ollies, does flip tricks, grabs and spins in the air, grinds rails and ledges, manuals, strings tricks into combos, and is scored for it.
2. "Fully playable" means: a start screen, a timed scored run with an end screen and a persisted best score, a free-skate mode, pause, and a restart — with no step that requires a developer.
3. It is an **original** game built for a class on vibe coding. It borrows the *genre's* mechanics (ollie, kickflip, grind, manual, combo multiplier), which are not anyone's property, and nothing else: no Tony Hawk name, logos, levels, music, skater likenesses or art from the real games appear anywhere in it.

## II. Runs anywhere, builds nowhere
1. Plain HTML + ES modules. **No build step, no bundler, no package install** to play it. Open the entry file from any static server (GitHub Pages, `python3 -m http.server`) and it runs.
2. The only third-party code is the 3D library, **vendored into the repo** with its version and license recorded, so the game works offline and the commit that made it can always be replayed.
3. All models, textures, sounds and the park itself are **generated in code** (primitives and procedural geometry, Web Audio synthesis). No binary asset files. If something cannot be made from code, it is cut.
4. Target: a current desktop Chrome, Firefox, Safari or Edge with WebGL at 60 fps on an integrated GPU. Mobile is not a v1 target.

## III. Feel first
1. Controls are discoverable: the start screen shows every control; the in-game HUD shows the current trick name and the combo as it happens.
2. The simulation is deterministic per frame and frame-rate independent (fixed-step physics), so a trick that works at 60 fps works at 144 fps and at 30 fps.
3. A bail is always the player's fault and always legible: land sideways, land mid-flip, run out of balance — the game shows which.
4. Nothing blocks play on first load: no login, no network calls, no cookies. The best score lives in `localStorage` and nowhere else.

## IV. Scope discipline
1. **v1 is one park, one skater, keyboard controls, one timed mode plus free skate.** Multiple parks, character select, gamepad, goals/objectives lists, multiplayer, replays and leaderboards are explicitly out of v1 and belong in `specs/002-…` onward.
2. The trick list in v1 is the genre's core set — ollie, kickflip, heelflip, pop shove-it, 360 flip, four grabs, 180/360/540 spins, four grinds (50-50, boardslide, 5-0, nosegrind), manual and nose manual — and no more until those feel right.
3. The physics is **game physics**, not simulation: a custom character controller with raycast ground detection. No general-purpose physics engine (rigid bodies make a skater feel like a crate).

## V. Process
1. Every Spec Kit phase and every implementation prompt is a round in `prompts.md`, with the model named and the result checked (ran it, screenshotted it, drove the inputs) before it is marked kept.
2. Decisions the AI proposed and I accepted without arguing are still decisions: log them.
3. `EVALUATION.md` is filled at v1 and re-scored after it has actually been played.
