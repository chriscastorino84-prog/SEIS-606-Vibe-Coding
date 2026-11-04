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
