# Tasks: Skate Game — core game

**Input:** [plan.md](plan.md), [spec.md](spec.md) v0.1 · `[P]` = can run in parallel · `[USn]` = user story

## Phase 1 — Skeleton (blocks everything)
- [x] T001 Vendor Three.js 0.187.0 into `src/vendor/` with LICENSE + VERSION — D-001
- [x] T002 `src/skate.html` + `styles.css`: import map, canvas, HUD/menu DOM, controls list
- [x] T003 `js/main.js`: renderer, camera, lights, fog, resize; fixed-step loop with accumulator and sub-step cap; `window.__skate` debug handle — FR-15
- [x] T004 `js/input.js`: key map, pressed/just-pressed/just-released, blur release, two-key sequence detector — FR-11

## Phase 2 — US1 roll around the park (P1)
- [x] T005 [US1] `js/park.js`: ground, walls, half-pipe transitions (extruded quarter circles) + decks, bank + kicker, funbox with banks, flat rail, ledge, 6-stair + handrail; returns colliders, rails, spawn — FR-1
- [x] T006 [US1] `js/skater.js`: skater (box figure) + board (deck, trucks, wheels) as a group; lean, crouch, pose helpers — D-007
- [x] T007 [US1] `js/controller.js` ROLL + AIR: ground probe, surface alignment, push/coast/brake/turn, slope gravity, lip launch, wall clamp — FR-2
- [x] T008 [US1] Follow camera with smoothing and floor clamp — FR-3
- [x] T009 [US1] Check: drive a lap, roll up the quarter pipe and back, launch off the kicker; screenshots

## Phase 3 — US2 ollie + air tricks (P1)
- [x] T010 [US2] Ollie with hold-to-charge; crouch animation — FR-4
- [x] T011 [US2] `js/tricks.js`: trick table; kickflip / heelflip / shove-it / 360 flip animation + queueing — FR-5
- [x] T012 [US2] Grabs (indy, melon, nosegrab, tailgrab) held with poses and time-based points — FR-6
- [x] T013 [US2] Air spin + landing rounding to 180° increments; spin names — FR-7
- [x] T014 [US2] Landing validation + BAIL state (tumble, reason, lockout) — FR-8
- [x] T015 [US2] `js/scoring.js`: combo accumulate / bank / bust; best score in localStorage — FR-12

## Phase 4 — US3 grinds (P1)
- [x] T016 [US3] Rail capture test + GRIND state: snap, travel, decay, end-of-rail drop, ollie off — FR-9
- [x] T017 [US3] Grind type by orientation/input (50-50, boardslide, 5-0, nosegrind) with board pose — FR-9
- [x] T018 [US3] Balance meter model + HUD bar; bail at limit — FR-10

## Phase 5 — US4 manuals + combos (P2)
- [x] T019 [US4] Manual / nose manual via sequence detector; MANUAL state with balance and per-time points — FR-11
- [x] T020 [US4] Combo continuity across AIR → GRIND → MANUAL → AIR; HUD combo string and math — FR-12, FR-13

## Phase 6 — US5 modes, HUD, audio (P2)
- [x] T021 [US5] `js/hud.js`: score, timer, combo, balance, toast, start/pause/end menus; keyboard navigation — FR-13, FR-14
- [x] T022 [US5] Modes: 2-minute run (timer, end-of-run banking rule, end screen with best) and free skate; restart; pause — FR-14
- [x] T023 `js/audio.js`: push, pop, land, grind loop, bail; mute toggle — FR-16

## Phase 7 — Verify & ship
- [x] T024 `tests/smoke.mjs` (Playwright): loads with zero console errors; start run; push → speed > 0; ollie → AIR → ROLL; kickflip lands and scores 150+; kickflip-then-land-early bails; grind on flat rail scores; manual works; 2-min timer ends and best persists across reload
- [x] T025 Screenshot review of park, air trick, grind, bail, end screen
- [x] T026 `README.md` (run instructions, controls), `project.yml` entry/status, CHANGELOG v1, EVALUATION row, rebuild index, tag `skate_game/v1`
