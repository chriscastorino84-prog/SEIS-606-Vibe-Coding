# US Ski Resort Map — prompts & outputs

Every prompt→response exchange, in order. Newest at the bottom. Keep the discarded ones.
Conventions: `../README.md` §3.

---

## Round 1

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-fable-5-1
- **Mode:** speckit/constitution + speckit/specify
- **Context given:** The `projects/` framework README (just written in the same session); no prior specs. Claude ran three web searches on lift-status data sources and US ski-area lists before drafting.

**Prompt (verbatim):**

```text
The first app I want to make is an interactive map of all of the ski resorts in the US. When you roll over the ski area, a ski map shows up with the live lift and terrain status, the posted opening day (if it isn't already open) with a timer counting down to opening day. I also want a link on the ski map page that links to the ski resort website.
```

**What came back:**

- `specs/constitution.md` v1.0 — six articles; the load-bearing ones are II (data honesty: no unlabeled stale status, explicit coverage), III (trail maps linked/embedded, never copied), IV.1 (static-first) and V.1 (v1 = all resorts plotted, live status only for the subset an open aggregator covers).
- `specs/001-ski_resort_map/spec.md` v0.1 — four user stories (map, live status + trail map, countdown, website link), 12 FRs, 5 success criteria, 4 open questions.
- Research finding that shaped both: ~470–500 operating US ski areas; no unified free live-status API. Liftie (`liftie.info/api/resort/<id>`, BSD, ~190 resorts worldwide, parses each resort's page once a minute) and a GitHub-Pages scraper covering ~60 Vail/Ikon resorts are the open options; everything else is per-resort parsing or a paid aggregator (Skiresort Service International; Parse.bot per-resort APIs).
- `DECISIONS.md` D-001 (proposed): live-status strategy.

**How it was checked:**

Spec cross-read against the prompt sentence by sentence (map ✔, hover ✔, trail map ✔, live lift + terrain ✔, opening day + countdown ✔, website link ✔). Data-source claims come from the searched pages, not memory. Not yet checked: whether Liftie's public API allows cross-origin browser calls (affects the static-first article) — flagged for the plan phase.

**Verdict:** kept, pending Chris's answers to the four open questions in `spec.md`.

**Commit:** `d3ebeb6`

---

## Round 2

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-fable-5-1
- **Mode:** speckit/clarify
- **Context given:** `spec.md` v0.1 open questions 1–4.

**Prompt (verbatim):**

```text
1. yes
2. what's easiest
3.  yes
4. pages
```

**What came back:**

Spec → v0.2 with a Clarifications section; FR-3 (hover + click-to-pin) and FR-6 (link-out trail-map fallback) amended. Decisions: D-001 accepted; D-003 link-out fallback; D-004 hover/pin; D-005 GitHub Pages static-only, with a scheduled GitHub Action pre-fetching any live source that blocks cross-origin calls.

Data-access probing during this round: the workspace shell, the web fetcher (URL-length cap, robots rules) and Chrome (not connected) couldn't pull the full Wikidata/Overpass resort lists; Chris authorized a Vercel sandbox for the fetch.

**How it was checked:**

Each answer mapped to a specific spec/decision edit; diff reviewed. Live-source CORS behavior is still unverified and is the first item in plan.md research.

**Verdict:** kept.

**Commit:** `<filled at commit>`

---
