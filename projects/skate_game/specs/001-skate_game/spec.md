# Feature Specification: Skate Game — core game

**Feature:** `001-skate_game` · **Created:** 2026-11-04 · **Status:** Draft v0.1
**Governing document:** `../constitution.md` v1.0

**Input (Chris, verbatim, prompts.md Round 1):**
> I want to build a full version of a game like Tony Hawk's pro skater. I want it to be fully playable and 3d. Follow the same guidelines as the other projects for my vibe coding class.

## Clarifications (assumed, 2026-11-04)

The prompt was a single instruction to build the whole thing, so the open questions below were decided rather than asked (each is a `DECISIONS.md` entry; all are cheap to reverse):

- **Controls:** keyboard only in v1 (D-003). Gamepad is `specs/002`.
- **Park:** one hand-built park containing every obstacle type the trick list needs (D-004).
- **Modes:** a 2-minute scored run (the genre's classic "career run") and free skate (D-005).
- **Scoring:** the genre's model — base points per trick, spin and flip bonuses, ×1 multiplier per trick in a combo, banked on a clean landing, lost on a bail — simplified: no trick-overuse decay in v1 (D-006).

## User Scenarios & Testing

### User Story 1 — Roll around a 3D skatepark (Priority: P1)
The player opens the page, presses Start, and controls a skater in a third-person 3D view. The skater pushes to accelerate, carves left and right, slows down, rolls up and down banks and transitions, and gets air off ramps purely from speed. The camera follows behind smoothly.

**Why this priority:** It is the game. Nothing else is testable until a skater can be driven around a park and feels like a skateboard rather than a car.

**Independent test:** Drive a lap of the park with only the movement keys; roll up the quarter pipe and come back down facing the right way; no fall-through, no getting stuck in geometry, no camera clipping through the floor.

**Acceptance scenarios:**
1. **Given** the start screen, **When** the player presses Start, **Then** the park renders and the skater responds to input within one frame.
2. **Given** the skater is on flat ground, **When** the player holds push, **Then** speed rises to a cap within ~2 s; releasing it lets the skater coast down to a stop over several seconds.
3. **Given** the skater is rolling, **When** the player holds turn, **Then** the skater carves (turn radius tighter at low speed, wider at high speed) and leans into the turn visibly.
4. **Given** the skater rolls up a quarter pipe above the coping with enough speed, **When** it leaves the lip, **Then** it is airborne, gravity returns it to the transition, and it lands rolling back down it ("vert air").
5. **Given** a bank or a kicker, **When** the skater rolls over its edge at speed, **Then** it leaves the ground along the surface's tangent (ramps launch, flat edges only drop).
6. **Given** any point in the park, **Then** the skater never passes through the ground, a ramp or a wall, and the camera never shows the underside of the ground.

### User Story 2 — Ollie and do tricks in the air (Priority: P1)
The player ollies on demand, higher the longer the key is held, and while airborne performs flip tricks, grabs and spins. Tricks are named on screen the moment they start. A clean landing requires the board to be roughly level and the flip finished; otherwise the skater bails and gets up after a moment.

**Independent test:** From flat ground, ollie → kickflip → land: name appears, points awarded. Ollie → kickflip released too late (board still rotating) → bail with reason shown.

**Acceptance scenarios:**
1. **Given** the skater is rolling, **When** the player taps Ollie, **Then** the skater crouches briefly and leaves the ground; holding longer (up to ~0.4 s) ollies higher.
2. **Given** the skater is airborne, **When** the player presses a flip key, **Then** the board visibly performs that trick (kickflip rolls along its long axis; shove-it spins about the vertical axis; 360 flip does both), its name is shown, and it finishes in a fixed time.
3. **Given** the skater is airborne, **When** the player holds a grab key, **Then** the skater visibly holds the board (distinct pose per grab) and the grab's score grows with time held.
4. **Given** the skater is airborne, **When** the player holds turn, **Then** the skater rotates about the vertical axis; on landing, total rotation is reported in 180° increments ("360 Kickflip") and scored.
5. **Given** the board is level and no flip is in progress, **When** the skater reaches the ground, **Then** the landing is clean and the combo's points are banked.
6. **Given** a flip is still in progress, or the skater's spin is more than ~35° away from a 180° increment, or the board hits the ground at a steep pitch/roll, **When** the skater reaches the ground, **Then** the skater bails: a visible ragdoll-ish tumble, the combo is lost, the reason is shown ("landed mid-flip"), and control returns after ~1.5 s.

### User Story 3 — Grind rails and ledges (Priority: P1)
Landing on a rail or ledge edge locks the skater into a grind along it. The grind type depends on the skater's orientation relative to the rail. A balance meter drifts and must be corrected; the grind ends by ollieing off, reaching the end, or losing balance (bail).

**Independent test:** Approach the flat rail, ollie, land on it → "50-50" shown, points tick up; ollie off → clean landing banks the combo. Repeat while approaching sideways → "Boardslide".

**Acceptance scenarios:**
1. **Given** the skater is airborne and descending within ~0.5 m of a rail's line, **When** it reaches rail height, **Then** it snaps to the rail and grinds in the direction of travel.
2. **Given** the skater is parallel to the rail, **Then** the grind is a 50-50; sideways (60–120°) → boardslide; parallel with nose/tail down (hold forward/back while landing) → nosegrind / 5-0.
3. **Given** the skater is grinding, **Then** a balance meter is shown; it drifts toward one side at a rate that increases with grind time; the player corrects it with the turn keys; if it reaches the edge, the skater bails.
4. **Given** the skater is grinding, **When** the player presses Ollie, **Then** the skater pops off the rail and remains in the combo.
5. **Given** the skater reaches the rail's end, **Then** it drops off with its velocity preserved and the grind counts as landed-pending (the combo continues until the ground landing resolves it).

### User Story 4 — Manual and chain combos (Priority: P2)
On landing, tapping back-then-forward (or forward-then-back) puts the skater into a manual (or nose manual). The manual has its own balance meter and keeps the combo alive across flat ground, so air tricks can be linked to grinds to more air tricks.

**Acceptance scenarios:**
1. **Given** the skater is rolling or about to land, **When** the player presses back then forward within 0.3 s, **Then** the skater manuals; forward then back → nose manual.
2. **Given** a manual, **Then** a balance meter is shown (as in grinds), the combo stays open, and points accrue per second.
3. **Given** a manual, **When** the player ollies, **Then** the combo continues into the air.
4. **Given** the combo chain *kickflip → 50-50 → manual → heelflip*, **When** the final landing is clean, **Then** the HUD showed one growing combo throughout and banks (sum of base points) × (number of tricks).

### User Story 5 — Scored run, free skate, start/pause/end screens (Priority: P2)
The start screen shows controls and two modes. The 2-minute run shows a countdown; when it ends, an end screen shows the score, best combo, and the all-time best score (persisted); the player can restart or return to the menu. Free skate has no timer. Pause stops the simulation.

**Acceptance scenarios:**
1. **Given** the start screen, **Then** every control is listed and both modes are selectable with the keyboard.
2. **Given** a 2-minute run, **When** the timer reaches 0, **Then** the simulation stops, any open combo is banked only if the skater is on the ground, and the end screen shows score, best single combo, and best score ever; a new best is called out.
3. **Given** the end screen, **When** the player presses Restart, **Then** a fresh run starts in under one second with score 0.
4. **Given** play, **When** the player presses Pause, **Then** the simulation and timer freeze and a resume prompt shows; the camera does not move.
5. **Given** a page reload, **Then** the best score is still shown on the start screen.

### Edge cases
- Bail while grinding over a gap → skater falls to whatever is below; no stuck state.
- Ollie key held at page load / focus loss mid-air → inputs are released on `blur`; no permanently held key.
- Landing exactly on a rail end → treated as a landing on the ground beyond it, not a zero-length grind.
- Very low frame rate (tab in background) → fixed-step physics with a capped number of sub-steps per frame; no tunneling through ramps at normal speeds.
- Window resize → camera aspect and HUD reflow.

## Functional Requirements

| ID | Requirement | Story |
|---|---|---|
| FR-1 | Third-person 3D view of a skatepark with ground, ≥2 quarter pipes forming a half-pipe, ≥1 bank, ≥1 kicker, ≥1 funbox, ≥3 grindable rails/ledges, stairs with a handrail, boundary walls. | US1 |
| FR-2 | Skater controller: push, coast, carve, brake, slope acceleration, airborne ballistic motion, surface-aligned rolling on banks and transitions. | US1 |
| FR-3 | Follow camera with smoothing, no clipping below the ground plane. | US1 |
| FR-4 | Ollie with hold-to-charge height. | US2 |
| FR-5 | Flip tricks: kickflip, heelflip, pop shove-it, 360 flip, each with an animated board and fixed duration. | US2 |
| FR-6 | Grabs: indy, melon, nosegrab, tailgrab, held, scored per time held. | US2 |
| FR-7 | Air spin via turn keys; landing orientation rounded to the nearest 180° and named; off-axis landings bail. | US2 |
| FR-8 | Landing validation: flip complete, spin within tolerance, board pitch/roll within tolerance; otherwise bail with a stated reason and ~1.5 s lockout. | US2 |
| FR-9 | Rail/ledge snapping within a capture radius; grind along the segment; 50-50 / boardslide / 5-0 / nosegrind by orientation and input. | US3 |
| FR-10 | Balance meter for grinds and manuals: drift that accelerates over time, player correction, bail at the limit. | US3, US4 |
| FR-11 | Manual / nose manual entered by a two-key sequence. | US4 |
| FR-12 | Combo system: tricks accumulate base points and a count while airborne, grinding or manualing; clean landing banks base × count; bail discards. | US2–4 |
| FR-13 | HUD: score, current combo (running total and multiplier), trick-name string, timer, balance meter, bail reason. | all |
| FR-14 | Modes: 2-minute run and free skate; start, pause, end screens; restart; best score in `localStorage`. | US5 |
| FR-15 | Fixed-timestep simulation (e.g. 120 Hz) with render interpolation or sub-stepping; inputs released on window blur. | III.2 |
| FR-16 | Synthesized sound for push, ollie pop, land, grind, bail (Web Audio; starts after the first key press). | II.3 |

## Success Criteria

| ID | Criterion |
|---|---|
| SC-1 | A first-time player can read the start screen and land an ollie-kickflip within 60 s of starting. |
| SC-2 | The combo *kickflip → 50-50 on the flat rail → manual → heelflip* is landable by a practiced player and scores exactly base-sum × 4. |
| SC-3 | 60 fps on an integrated GPU (measured via `requestAnimationFrame` deltas over a 30 s run; ≥ 55 fps average). |
| SC-4 | A 2-minute run plays start to finish with no console errors, and the best score survives a reload. |
| SC-5 | The whole game is served from `src/` with zero network requests other than its own files. |

## Out of scope (v1)
Multiple parks or skaters, gamepad/touch, goals and collectibles, replays, leaderboards, create-a-park, multiplayer, imported models or audio, trick-overuse decay, reverts, wallrides, lip tricks, spine transfers.
