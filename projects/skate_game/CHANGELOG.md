# Skate Game — changelog

One entry per git tag `skate_game/vN`. Newest at the top. Conventions: `../README.md` §2.

## v1 — 2026-11-04
- Rounds: #1–#4
- Model(s): claude-fable-5-1 (Claude, claude.ai / Claude Code harness)
- Changes:
  - First playable: one park (half-pipe, funbox + rails, flat rail, ledge, bank, kickers, 6-stair + handrail), one skater, keyboard controls.
  - Mechanics: push/carve/brake, slope and lip launches, vert air, ollie with hold-to-charge, kickflip / heelflip / pop shove-it / 360 flip, four grabs, spins scored in 180° steps, 50-50 / boardslide / 5-0 / nosegrind with a balance meter, manual / nose manual, combo multiplier, bails with reasons.
  - Modes: 2-minute run with end screen and persisted best; free skate; pause; restart.
  - Synthesized sound; procedural everything; Three.js 0.187.0 vendored.
  - `tests/smoke.mjs`: 49 Playwright checks, deterministic via `?test` + `__skate.advance()`.
