# Vibe-coded projects — conventions

How projects in this folder are organized and documented. Each project is something built with an AI assistant. The goal is a record that others (and my future self) can learn from and write about: **what was asked, what came back, how well it was checked, and whether it was worth it.**

This README is the single source of truth. Templates in `templates/` and the scripts in `tools/` implement it; if they disagree with this file, this file wins and the tool gets fixed.

---

## 1. Folders

* One folder per project, with its own `prompts.md`.
* Group projects in a shared folder (`games/`, `productivity/`, `teaching/`, etc.) only when **three or more** share a theme. A group has one `prompts.md` with one section per project.
* Folder names are `snake_case`. Use the project's own file name inside it (e.g. `timer_app/timer.html`, not `timer_app/index.html`) — the parent `index.html` links to whatever `project.yml` says the entry file is.

Every project folder has this shape (created by `tools/new_project.sh <name>`):

```
<project_name>/
├── project.yml        # metadata — the ONE file the index reads
├── prompts.md         # every prompt + what came back + how it was checked
├── DECISIONS.md       # major decisions for this project (ADR-lite)
├── EVALUATION.md      # how useful it turned out to be (filled at v1 and re-scored later)
├── CHANGELOG.md       # one entry per version
├── specs/             # Spec Kit artifacts (constitution → spec → plan → tasks)
│   ├── constitution.md
│   └── 001-<slug>/
│       ├── spec.md
│       ├── plan.md
│       └── tasks.md
└── src/               # the generated app itself
```

Repo-level files:

```
projects/
├── README.md          # this file
├── index.html         # GENERATED gallery — do not hand-edit; run tools/build_index.py
├── decisions/DECISIONS.md   # decisions that affect the whole framework, not one app
├── templates/         # what new_project.sh copies
└── tools/             # new_project.sh, build_index.py
```

---

## 2. Versioning

Git is the version history; the files below make it legible.

* **Every iteration that changes behavior is a commit.** No more "the timer app went through five versions but the repo shows one upload." Small commits, often.
* **Versions are git tags scoped to the project:** `timer_app/v1`, `timer_app/v2`, … A tag marks a state you'd actually show someone. Create one with `git tag -a timer_app/v2 -m "..."`.
* **`CHANGELOG.md`** gets one entry per tag: version, date, what changed, which `prompts.md` rounds produced it, and the model used.
* **`project.yml` → `version`** is the current tag. The index shows it.
* **Prompt rounds reference commits.** Each round in `prompts.md` ends with the short hash of the commit that captured its output (`commit: a1b2c3d`), so anyone can diff "prompt → output" exactly.
* If you want the old files side by side (for a write-up, say), `git worktree` or `git show timer_app/v1:projects/timer_app/src/timer.html` gets them — no `v1/`, `v2/` folders in the tree.

---

## 3. Tracking prompts and outputs — `prompts.md`

One file per project, one `## Round N` section per prompt→response exchange, newest at the bottom. Each round records:

| Field | Why |
|---|---|
| **Date, tool, model** | So the record says *which* AI did the work (see §4). |
| **Mode** | chat / agent / Spec Kit phase (`specify`, `plan`, `tasks`, `implement`) / inline completion. |
| **Prompt** | Verbatim. If long, verbatim in a fenced block anyway — paraphrases lose the thing people want to learn from. |
| **Context given** | Files attached, prior rounds referenced, constitution/spec in play. |
| **What came back** | Short summary + where the output lives (`src/...`, commit hash). Paste short outputs inline; large ones go to `src/` and get linked. |
| **How it was checked** | What you actually did: ran it, read it, tested X, compared to Y, *or* "not checked." Honesty here is the point. |
| **Verdict** | `kept` / `kept with edits` / `discarded` / `partially kept`, and one line why. |
| **Commit** | Hash that captured the result. |

Template: `templates/prompts.md`. Keep every round, including the bad ones — discarded output is the most instructive kind.

---

## 4. Metadata — `project.yml`

Machine-readable, one per project; `tools/build_index.py` reads these to build `index.html`. Fields:

```yaml
name: Timer App                # display name
slug: timer_app                # == folder name
group: ~                       # or the group folder name, e.g. productivity
status: active                 # idea | active | done | abandoned
version: v3                    # current git tag suffix
entry: src/timer.html          # file the index links to (relative to project folder); ~ if not runnable in a browser
summary: One-line description for the index.
created: 2026-11-04
updated: 2026-11-04
tools:                         # every AI tool/model that touched it
  - tool: Claude Code
    model: claude-opus-4-5
    role: spec + implementation
  - tool: GitHub Copilot
    model: gpt-5
    role: inline fixes
spec_kit: true                 # went through specify → plan → tasks → implement?
usefulness: 4                  # 0–5, from EVALUATION.md (blank until evaluated)
time_hours: 3.5                # rough total human time
tags: [timer, pomodoro, vanilla-js]
```

Tool/model is recorded **per round in `prompts.md`** (ground truth) and **rolled up in `project.yml`** (for the index). When a new model shows up in a round, add it to the rollup.

---

## 5. Documenting usefulness — `EVALUATION.md`

Filled in when a project reaches `v1`, then **re-scored** any time you come back to it (append a dated row; don't overwrite). Scores are 0–5 on five axes, plus a one-paragraph verdict:

| Axis | Question |
|---|---|
| **Works** | Does it do what the spec said? (0 = doesn't run, 5 = every acceptance scenario passes) |
| **Used** | Have I actually used it since building it? (0 = never, 5 = weekly or it's in my routine) |
| **Trust** | How much did I verify vs. take on faith? (0 = never read the code, 5 = tested every path I rely on) |
| **Effort ratio** | Value out vs. time in, compared to building it by hand or buying it |
| **Learned** | Did this teach me something about the tool, the model, or the problem? |

`usefulness` in `project.yml` is the rounded mean of the latest row. The verdict paragraph answers: *was it worth it, and would I do it again the same way?*

---

## 6. Tracking major decisions — `DECISIONS.md`

ADR-lite. One numbered entry per decision that would be expensive to reverse or that a future reader would ask "why?" about. Per project in `<project>/DECISIONS.md`; framework-wide in `decisions/DECISIONS.md`.

```
## D-003 — Use localStorage instead of a backend
Date: 2026-11-04 · Status: accepted · Round: prompts.md #4
Context: ...one or two sentences on the situation...
Decision: ...what was chosen...
Alternatives: ...what was rejected and why...
Consequences: ...what this makes easier / harder later...
```

Statuses: `proposed` → `accepted` → (`superseded by D-00N` | `reversed`). Never delete an entry; supersede it.

Rule of thumb: if the AI proposed it and you accepted it without thinking, it's a decision too — write it down. Those are the ones that bite.

---

## 7. Spec Kit per project

Each project runs the [Spec Kit](https://github.com/github/spec-kit) loop on its own, inside its folder — one-off apps don't share a constitution:

1. **Constitution** → `specs/constitution.md` — the non-negotiables for *this* app (scope, stack, what it must never do). Usually a page.
2. **Specify** → `specs/001-<slug>/spec.md` — user stories with priorities, acceptance scenarios, functional requirements. No tech choices.
3. **Plan** → `specs/001-<slug>/plan.md` — stack, structure, how the spec gets built.
4. **Tasks** → `specs/001-<slug>/tasks.md` — ordered, checkable task list grouped by user story.
5. **Implement** → `src/`, one commit per task or small group of tasks.

`new_project.sh` drops the Spec Kit templates in place. To run the real Spec Kit CLI against a project instead, `cd` into the project folder and run `specify init --here --ai <agent>`; it writes its own `.specify/` there and the two layouts coexist (Spec Kit's `specs/` is the same `specs/` folder).

A second feature on the same app is `specs/002-<slug>/`. Each Spec Kit phase is itself a round in `prompts.md` with `Mode: speckit/<phase>`.

---

## 8. The parent `index.html`

`projects/index.html` is a static gallery generated from every `project.yml` by `tools/build_index.py`. It lists each project with its status, version, usefulness score, tools used, and a link to the `entry` file plus its `prompts.md`. Only projects with `status: done` or `active` **and** an `entry` are shown as runnable; others are listed under "Also in the repo."

Regenerate after any metadata change:

```bash
python3 projects/tools/build_index.py
```

Commit the regenerated file. (A pre-commit hook or CI step can enforce this later — see `decisions/DECISIONS.md` D-002.)

---

## 9. Starting a new project — the checklist

```bash
projects/tools/new_project.sh timer_app "Timer App" "A pomodoro-style timer"
```

Then:

1. Write `specs/constitution.md` (5–10 minutes; what this app is and isn't).
2. Round 1 in `prompts.md`: the *specify* prompt. Fill `spec.md`.
3. Rounds 2–3: *plan*, *tasks*.
4. Implement; commit per task; record each prompt as a round with its commit hash.
5. When it does the thing: tag `v1`, write `CHANGELOG.md` entry, fill `EVALUATION.md`, update `project.yml`, rebuild the index.
6. Every later iteration: round → commit → (tag → changelog → re-score) when it's a real version.

---

## 10. Writing about it later

Everything above exists so that a blog post or paper can be assembled from the repo without memory: `prompts.md` is the transcript, `DECISIONS.md` the reasoning, `EVALUATION.md` the verdict, `git log` + tags the timeline, `project.yml` the facts. If a future write-up needs something the record doesn't have, add the field here first, then to the templates.
