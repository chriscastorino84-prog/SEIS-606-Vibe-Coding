# Framework decisions

Decisions about how `projects/` itself works. Per-app decisions live in each project's `DECISIONS.md`.

## D-001 — Versions are git tags + CHANGELOG, not `v1/ v2/` folders
Date: 2026-11-04 · Status: accepted
Context: Earlier apps (notably the timer) were iterated several times but the repo shows only the final upload, so the iteration history is lost.
Decision: Every behavior change is a commit; shown-to-someone states are annotated tags scoped per project (`timer_app/v2`); `CHANGELOG.md` narrates them; `prompts.md` rounds carry the commit hash.
Alternatives: Copying `src/` into `versions/v1/` etc. — easy to read but duplicates files, drifts, and still doesn't tie a version to the prompt that made it.
Consequences: Old versions are retrieved via `git show <tag>:path`; requires the discipline of committing per round.

## D-002 — `index.html` is generated from `project.yml`, never hand-edited
Date: 2026-11-04 · Status: accepted
Context: A hand-maintained gallery page goes stale the second a project is added or re-scored.
Decision: `project.yml` is the single metadata source; `tools/build_index.py` renders `index.html` with no dependencies beyond Python 3 stdlib (uses a tiny flat-YAML reader, so no PyYAML install).
Alternatives: Hand-edit HTML (stale); a JS app that fetches YAML at runtime (breaks on `file://` and GitHub Pages without extra config).
Consequences: Must re-run the script after metadata changes; a pre-commit hook can enforce it later.

## D-003 — Spec Kit runs per project, not per repo
Date: 2026-11-04 · Status: accepted
Context: Spec Kit assumes one product per repo with one constitution. These are unrelated one-off apps.
Decision: Each project folder carries its own `specs/constitution.md` and `specs/00N-<slug>/` set, seeded from the Spec Kit templates vendored in `templates/speckit/` (copied from `vibe-coding-mobile-app/.specify/templates`, spec-kit 1.0.10). The real CLI can be initialised inside a project folder with `specify init --here` when agent integration is wanted.
Alternatives: One repo-level `.specify/` with `specs/001-timer`, `specs/002-…` — keeps one toolchain but forces unrelated apps under one constitution and one feature counter.
Consequences: Slight template duplication per project; complete independence between apps.

## D-004 — Usefulness is five scored axes plus a verdict paragraph, re-scored over time
Date: 2026-11-04 · Status: accepted
Context: "Was it useful?" answered once at build time is always optimistic.
Decision: `EVALUATION.md` is an append-only table (Works, Used, Trust, Effort ratio, Learned) with a verdict; `project.yml.usefulness` mirrors the latest mean.
Alternatives: A single 1–5 star; free-text only.
Consequences: Honest "Used" scores will drop over time for most toys — that's the signal, not a bug.
