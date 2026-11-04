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

**Commit:** `8b76663`

---

## Round 3

- **Date:** 2026-11-04
- **Tool / model:** Claude (claude.ai, Claude Code harness) / claude-opus-5-5 (Chris switched models via /model before this round)
- **Mode:** speckit/plan + speckit/tasks + speckit/implement
- **Context given:** spec v0.2, constitution v1.0, D-001–D-005. Chris approved a Vercel sandbox so Claude could reach the open internet for data research.

**Prompt (verbatim):**

```text
I authorized vercel
```

(The working request carried over from Round 2: proceed to plan → tasks → implement.)

**What came back:**

- Research in a Vercel sandbox: Liftie is blocked by a Cloudflare bot check. The ski-run-scraper feed is CORS-open (55 US resorts) but was last updated 2026-05-16. OpenSkiMap gives 513 qualifying US areas.
- `plan.md` (research table, constitution check, structure, state machine) and `tasks.md` (T001–T020).
- `scripts/build_resorts.mjs` + `data/opening_dates.json` (63 sourced entries) + `data/feed_aliases.json`. Built and checked against real data in the sandbox, then rebuilt by `.github/workflows/ski_resort_map_data.yml`, which committed `src/data/resorts.json` itself (commit `5655731`).
- App: `src/ski_resort_map.html`, `app.js`, `lib.js`, `styles.css`, vendored Leaflet + markercluster.
- Tests: `tests/lib.test.mjs` (10 unit tests: DST, Phoenix, Anchorage, stale-feed logic, status precedence) and `tests/smoke.mjs` (Playwright, 11 checks).
- Decisions D-006 through D-010.

**How it was checked:**

- Build run twice against the real OpenSkiMap file; name mismatches fixed (Heavenly, Palisades, Snowmass, Sun Valley, Ski Santa Fe, The Highlands, Crotched). One known miss logged.
- `node --test` 10/10 pass. Playwright smoke 11/11 pass, with tiles and feed stubbed (the workspace can't reach them): 513 markers, legend total, hover → preview, click → pin, stale badge on May data, official-site link, countdown ticks, "No live data" on static resorts, Esc closes, no page errors.
- Desktop and mobile screenshots reviewed. Fixed the cluster-icon styling (missing MarkerCluster.Default.css) and a legend/report count mismatch.
- **Not yet checked:** real map tiles and the live feed in a real browser (blocked in this workspace), and real hover with a mouse. Both need the deployed Pages URL.

**Verdict:** kept with edits (the two fixes above).

**Commit:** `ada6312`

---
