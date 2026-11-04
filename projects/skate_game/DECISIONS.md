# Skate Game — decisions

Numbered, never deleted; supersede instead. Conventions: `../README.md` §6.

## D-001 — Three.js, vendored into `src/vendor/`, no build step
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: The game needs a WebGL scene graph, cameras, lights, shadows and raycasting. Writing raw WebGL would eat the whole project; a bundler would break "open the file and it runs."
Decision: Three.js (MIT), one pinned `three.module.js` copied into `src/vendor/` with its LICENSE and version recorded in `src/vendor/VERSION`. Loaded through an import map in the HTML. No npm at play time.
Alternatives: (a) Babylon.js — comparable, larger, less familiar in the examples the model has seen; (b) CDN import — smaller repo but the game dies offline and a future commit can't be replayed if the CDN path changes; (c) raw WebGL — no.
Consequences: ~2.1 MB of vendored library in the repo (0.187.0 ships `three.module.js` + `three.core.js`; both are needed). Upgrading Three.js is a deliberate, logged change. ES modules mean the page must be served over HTTP (GitHub Pages, `python3 -m http.server`), not opened via `file://` — noted in the project README.

## D-002 — Custom character controller with raycasts, no physics engine
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: Skateboard games feel good because the skater sticks to surfaces, carves, and launches off lips along the tangent. A rigid-body engine (Cannon, Rapier, Ammo) would give realistic but un-fun tumbling and would need tuning *away* from physics everywhere.
Decision: The skater is a point with velocity and an orientation frame. Each fixed step it casts a ray along its own "down" (and world-down as a fallback) against the park's collision meshes; a hit within a snap distance means grounded — project velocity onto the surface, apply slope gravity, align the board to the normal. No hit → ballistic. Rails are line segments with their own snap test.
Alternatives: Rapier/Cannon rigid body + constraints — rejected per constitution IV.3.
Consequences: Every obstacle must be a mesh the raycaster can hit (collision list) and curved transitions must be tessellated finely enough that the normal changes smoothly. Walls are handled by a horizontal probe, not by collision response. Tunneling is prevented by sub-stepping, not by continuous collision detection.

## D-003 — Keyboard only in v1
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: The prompt did not specify input. Gamepad support is a small addition but doubles the control-mapping and testing surface, and it cannot be exercised in the headless browser used to check the build.
Decision: Keyboard: arrows/WASD move, Space ollie, J/K/L/; flips, U/I/O/P grabs, Shift brake, Esc pause. Gamepad → `specs/002`.
Alternatives: Gamepad API now — would make the game feel more like the genre on day one.
Consequences: Players without a keyboard (tablets) can't play v1 — accepted; mobile is out of scope (constitution II.4).

## D-004 — One hand-built park containing every obstacle type
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: Multiple parks multiply geometry work without adding mechanics.
Decision: A single ~80 × 60 m park built from code: a half-pipe, a bank with a kicker, a funbox with two rails, a flat rail, a ledge, a 6-stair with a handrail, boundary walls. Every obstacle exists to exercise a mechanic in the spec.
Alternatives: Procedural/random parks — fun later, harder to test and to tune the feel against.
Consequences: Park layout lives in one file (`park.js`) so a second park is a second file plus a menu entry.

## D-005 — Two modes: 2-minute scored run and free skate
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: "Fully playable" needs a beginning, an end and a reason to try again. Goals lists (collect letters, hit a high score, find the hidden tape) are the genre's classic structure but are content, not mechanics.
Decision: A 2:00 run with a persisted best score, and an untimed free skate for practice. Goals → `specs/002`.
Consequences: Replay value in v1 comes from the score alone; `EVALUATION.md`'s "Used" axis will tell whether that is enough.

## D-006 — Scoring: base × combo count, with spin/grab-time bonuses; no overuse decay
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: The genre scores (sum of trick base points) × (multiplier = tricks in the combo), with repeated tricks in a run worth progressively less.
Decision: Keep sum × count, add +100 per 180° of spin and grab points per 0.1 s held, bank on a clean landing, discard on a bail. Skip overuse decay in v1 — it fights the "land one kickflip and feel good" first-minute experience (SC-1) and is easy to add later.
Alternatives: Flat points per trick with no multiplier — doesn't reward linking, which is the whole game.
Consequences: Spamming the same flip in a long combo is the dominant strategy until decay is added; noted for `specs/002`.

## D-007 — Everything procedural: primitives for the park and skater, Web Audio for sound
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: Constitution II.3 forbids binary assets; the model can't author or verify imported art anyway.
Decision: Park from boxes, extruded quarter-circle transitions and cylinders; skater from boxes and capsule-ish primitives with code animation (crouch, grab poses, flip rotation, tumble); sounds synthesized at runtime (noise bursts and short tones).
Consequences: A deliberately low-poly "toy park" look — leaned into with flat colors and strong shadows rather than apologised for.
