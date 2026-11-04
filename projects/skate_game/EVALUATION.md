# Skate Game — evaluation

Fill at v1; append a new row every time you come back. Scores 0–5. Conventions: `../README.md` §5.

| Date | Version | Works | Used | Trust | Effort ratio | Learned | Mean |
|---|---|---|---|---|---|---|---|
| 2026-11-04 | v1 | 4 | 0 | 3 | — | — | — |

*Row filled by Claude at v1 for the axes it can speak to; Chris scores Used, Effort ratio and Learned after playing it, and re-scores the rest. The mean and `project.yml.usefulness` stay blank until then.*

## Verdict (latest)

Not yet played by a human. Everything in the spec's five user stories exists and passes an automated check, but "feels like a skateboard" is a judgment the headless browser can't make.

## Notes by axis

- **Works (4):** 49/49 automated acceptance checks across all five user stories, zero console errors, every obstacle exercised. Held back from 5 because the board-attitude part of FR-8 is folded into "flip finished", frame rate on real hardware (SC-3) is unmeasured, and tuning numbers (gravity, turn rate, balance drift) are first guesses.
- **Used (0):** built today.
- **Trust (3):** the controller logic was read line by line and every state transition has a test that drives it, but the tests were written by the same model that wrote the code, in the same session.
- **Effort ratio:** for Chris — roughly one session of prompting against what a comparable prototype would take by hand.
- **Learned:** for Chris. From the build side, the things worth writing about: the extrusion-orientation mistake (a confident wrong comment about a rotation), the vert-air behaviour that needed a "virtual wall plane" rather than physics, and that a game can't be checked with fixed timeouts — the simulation had to be made deterministic (`?test` + `advance()`) before the tests stopped lying.
