# Skate Game — prompts & outputs

Every prompt→response exchange, in order. Newest at the bottom. Keep the discarded ones.
Conventions: `../README.md` §3.

This project was built from **one human prompt**. Each Spec Kit phase and the implementation are still recorded as separate rounds so the record shows what was produced at each step and how it was checked; rounds 2+ carry no new human text and say so.

---

## Round 1

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-fable-5-1
- **Mode:** speckit/constitution + speckit/specify
- **Context given:** The Project doc `claude/vibe-project-conventions.md` (the `projects/README.md` conventions), the `ski_resort_map` project as the worked example of the format, and the `feature/vibe-project-framework` branch (PR #1, unmerged) which holds `tools/new_project.sh` and the templates. No design doc, no reference material about skateboarding games beyond the model's own knowledge of the genre.

**Prompt (verbatim):**

```text
I want to build a full version of a game like Tony Hawk's pro skater. I want it to be fully playable and 3d. Follow the same guidelines as the other projects for my vibe coding class.
```

**What came back:**

- Branch `feature/skate_game` stacked on `feature/vibe-project-framework` (the scaffolder only exists there). `projects/tools/new_project.sh skate_game …` run.
- `specs/constitution.md` v1.0 — five articles. Load-bearing: I.3 (original game: genre mechanics only, no Tony Hawk names/art/audio), II (no build step, vendored 3D lib, everything procedural), III.2 (fixed-step physics), IV (one park, one skater, keyboard, listed trick set, custom controller — no physics engine).
- `specs/001-skate_game/spec.md` v0.1 — five user stories (roll around; ollie + air tricks; grinds; manuals + combos; modes/screens), 16 FRs, 5 success criteria, an explicit out-of-scope list. Because the prompt asked for the whole build, the four questions the spec would normally pause on (controls, park count, modes, scoring model) were decided, written into a "Clarifications (assumed)" section, and logged as D-003..D-006 so Chris can reverse any of them.
- `DECISIONS.md` D-001..D-007.

**How it was checked:**

Spec read against the prompt: "game like THPS" → trick set, grinds, manuals, combo multiplier, timed run (US1–US5); "fully playable" → start/pause/end screens, persisted best score, restart (US5, constitution I.2); "3d" → constitution I.1, FR-1/FR-3. Constitution I.3 checked against the spec and plan for any borrowed names (none). Not checked at this stage: whether the physics approach in D-002 actually feels right — that is what Round 4 is for.

**Verdict:** kept.

**Commit:** `cdc3048`

---

## Round 2

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-fable-5-1
- **Mode:** speckit/plan + speckit/tasks
- **Context given:** Round 1's constitution, spec and decisions. No new human prompt — continuation of Round 1's instruction to build the full game.

**Prompt (verbatim):**

```text
(none — autonomous continuation of Round 1)
```

**What came back:**

- Three.js **0.187.0** pulled from npm (`npm pack three`) and vendored: `src/vendor/three.module.js` + `three.core.js` (the module build imports the core file), `LICENSE`, `VERSION`. 2.1 MB total — larger than D-001's estimate, noted there.
- `specs/001-skate_game/plan.md` — module layout (8 modules), park obstacle table with dimensions, the controller state machine (ROLL / AIR / GRIND / MANUAL / BAIL) with the actual numbers (gravity −22 m/s², push 6 m/s², vmax 14 m/s, ollie 4.2–6.5 m/s, rail capture 0.55 m, balance drift), the trick table with base points and durations, scoring, HUD, audio, risks.
- `specs/001-skate_game/tasks.md` — 26 tasks in 7 phases, mapped to user stories and FRs.

**How it was checked:**

Plan's constitution-check table filled article by article. Every FR in the spec has at least one task (cross-read FR-1..FR-16 against tasks T001..T026). Numbers in the controller design are first guesses to be tuned in Round 4 — flagged as such.

**Verdict:** kept.

**Commit:** `cdc3048`

---

## Round 3

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-fable-5-1
- **Mode:** speckit/implement
- **Context given:** constitution, spec v0.1, plan, tasks. No new human prompt — continuation of Round 1's instruction.

**Prompt (verbatim):**

```text
(none — autonomous continuation of Round 1)
```

**What came back:**

`src/` — the whole game in one pass (~1,900 lines across `skate.html`, `styles.css`, 9 modules), committed as one implementation commit because the modules depend on each other and nothing ran until all of them existed. What's in it, by task:

- T002–T004 HTML shell with import map, HUD/menu DOM, CSS; `main.js` renderer/lights/fog/camera, 120 Hz accumulator loop with a 12-substep cap, `window.__skate` debug handle; `input.js` key map, edge detection, blur release, two-key sequences.
- T005 `park.js`: ground with a procedural concrete texture, boundary walls, half-pipe (two extruded quarter-pipe profiles, 28 arc segments, 1.2 m vert, decks, coping rails), funbox (truncated pyramid) with two rails, flat rail, ledge, bank + platform, two kickers, 6-stair with bank-up and handrail, decorative trees. All collider transforms baked into geometry so face normals are world-space.
- T006 `skater.js`: box-built skater and board with crouch, lean, grab poses, flip rotations, boardslide yaw, manual pitch, balance tilt and a bail tumble.
- T007–T008 `controller.js`: ROLL/AIR/GRIND/MANUAL/BAIL state machine as in the plan, follow camera with a floor probe.
- T010–T015 ollie charge, flip/grab/spin state (`tricks.js`), landing validation (mid-flip, over-rotation, sideways), bail with reason, combo bank/bust and `localStorage` best (`scoring.js`).
- T016–T018 rail capture, grind travel, type by angle/held key, balance meter with a side-flipping drift.
- T019–T020 manual via `S→W` / `W→S` within 0.3 s, also requested in the air and resolved on landing; combos carry across air → grind → manual → air.
- T021–T023 HUD, start/pause/end menus, 2-minute run vs free skate, synthesized audio.

Things the model got wrong on the first pass and fixed before committing (all found by driving the game headlessly, Round 4):

1. **Extrusion orientation.** The first `wedge`/`quarterPipe` code applied two Y rotations with a wrong comment about what `rotateY(-90°)` does; ramps would have faced the wrong way. Replaced with one `profileToMesh` helper and the actual mapping written out.
2. **Vert air returned the skater to the deck, not the transition.** The gentle pull toward the wall dragged the skater across the lip onto the deck. Fix: the wall plane extends upward past the lip (never cross it mid-air), and touch-down on the wall only when a ray back into the wall actually hits it.
3. **Coping captured the skater on the way back down.** Rail capture is now skipped while in a vert air.
4. **A flip key pressed in the same 8 ms step as the ollie release was swallowed** (the edge was consumed by the ROLL step). After popping, the same step now runs the trick input once.
5. **Spins too slow** for a 360 inside a charged ollie's 0.87 s hang time: 4.6 → 7.5 rad/s. Ollie velocity raised 4.6–7.2 → 5.2–7.8 m/s.
6. **Test determinism.** With `?test` the frame loop no longer steps physics; `advance(seconds)` does. Without this the browser's own frames kept simulating between test commands and the balance tests were flaky.
7. Cosmetics: T-posed arms, `PCFSoftShadowMap` removed in r187 → `PCFShadowMap`, camera moved closer/lower (6.5 m/2.8 m → 5 m/2.1 m).

Not implemented from FR-8: a separate board pitch/roll check at landing. The board's attitude in the air is only the flip animation, so "flip finished" already covers it; noted as a deviation rather than silently dropped.

**How it was checked:**

See Round 4 — 49 automated checks plus screenshots. No manual play-testing on real hardware yet (the session has no GPU); `EVALUATION.md` says so.

**Verdict:** kept.

**Commit:** `8722533`

---

## Round 4

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-fable-5-1
- **Mode:** agent (verification)
- **Context given:** the running game served by `python3 -m http.server`, Playwright with the container's Chromium (SwiftShader software WebGL, ~4 fps with shadows).

**Prompt (verbatim):**

```text
(none — autonomous continuation of Round 1)
```

**What came back:**

`tests/smoke.mjs` — 49 checks, driven deterministically through `window.__skate` (`key`, `advance`, `teleport`, `setSpeed`, event log). Coverage by user story: US5 start/pause/resume/timer-freeze/end-screen/restart/reload-persistence/free-skate; US1 push speed, coasting, turning, kicker launch height, half-pipe vert air above the lip that returns down the transition and rolls out onto the flat; US2 ollie, kickflip+indy banked ≥ 420, late flip → "LANDED MID-FLIP", 360 spin scored 250, 90° spin → "OVER-ROTATED"; US3 50-50 / boardslide / 5-0 by approach and held key, points accrue, ollie off with the combo open, lost-balance bail; US4 manual and nose manual by key sequence, brake banks, and the chain *Kickflip → 50-50 → Manual → Heelflip* banked as one 4-trick combo (2,460 = base × 4); safety: wall bail, never falls through geometry, rolls down the 6-stair. `tests/shots/v1_contact_sheet.png` — 11 full-quality screenshots (roll, crouch, kickflip, indy, 50-50, boardslide, manual, bail, half-pipe air, kicker spin, overview).

**How it was checked:**

Ran the suite three times in a row after the determinism fix: 49/49 each time, zero console errors. Looked at every screenshot in the contact sheet. One false alarm investigated and dismissed: a side-camera override I wrote for close-ups hid the body in one shot; the game's own camera shows it.

What this does **not** verify: frame rate on real hardware (SC-3), how it feels to play with a keyboard (SC-1), sound. Those are Chris's to score in `EVALUATION.md`.

**Verdict:** kept.

**Commit:** `df2e2c3`

---
