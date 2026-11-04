# Tasks: US Ski Resort Map — core loop

**Input:** [plan.md](plan.md), [spec.md](spec.md) v0.2 · `[P]` = can run in parallel · `[USn]` = user story

## Phase 1 — Data foundation (blocks everything)
- [x] T001 Write `scripts/build_resorts.mjs` (OpenSkiMap filter → `src/data/resorts.json` + `build_report.md`) — FR-1, FR-12
- [x] T002 [P] Curate `data/opening_dates.json` (63 matched US resorts, sourced) — US3
- [x] T003 [P] `data/feed_aliases.json` for feed keys whose names don't match — US2
- [x] T004 Verify the build against real data: 513 plotted · 55 live-matched · 63 dated · 1 unmatched (Snowriver, MI)
- [x] T005 `.github/workflows/ski_resort_map_data.yml`: rebuild on input change + weekly; commit result — D-005

## Phase 2 — Pure logic, test first
- [ ] T006 [P] `src/lib.js`: `zonedInstant(dateISO, "09:00", tz)`, `countdownParts(ms)`, `summarizeFeed(entry, now)`, `summarizeTerrain(json)`, `statusFor(resort, feedSummary, now)`
- [ ] T007 [P] `tests/lib.test.mjs`: DST edge (Nov 1 2026 fallback), Phoenix no-DST, stale vs. fresh feed, open/closed/hold counts, terrain parse with zero trails → null, status precedence table

## Phase 3 — US1 map (P1)
- [ ] T008 [US1] `src/ski_resort_map.html` + `styles.css`: full-viewport map, header with search, legend, side panel container, footer attribution
- [ ] T009 [US1] `app.js`: load `resorts.json`; Leaflet + markercluster; marker style per coverage (live-feed vs. static); legend counts — FR-2, FR-9
- [ ] T010 [US1] Search box (datalist of names) → fly to + pin — SC-3

## Phase 4 — US4 website link + US2 status/trail map (P1)
- [ ] T011 [US4] Panel: name, state, "Official site ↗" (new tab, `rel=noopener`) — FR-8
- [ ] T012 [US2] Panel: hover preview / click pin / Esc / outside click / touch — FR-3, D-004
- [ ] T013 [US2] Fetch feed once and on a 5-min interval while a panel is open; per-lift list + counts + "as of" / stale badge — FR-4, FR-5
- [ ] T014 [US2] Terrain: lazy fetch of `/{key}/terrain/{date}.json`; tolerant summary or "not available"
- [ ] T015 [US2] "View trail map ↗" → skimap.org page, else website — FR-6, D-003

## Phase 5 — US3 countdown (P2)
- [ ] T016 [US3] Countdown ticking every second to 09:00 resort-local; "Open now" override; "not posted" + note; source link — FR-7

## Phase 6 — Verify & ship
- [ ] T017 `tests/smoke.mjs` (Playwright): page loads, marker count ≥ 450, hover shows a panel, click pins it, Esc closes it, countdown ticks
- [ ] T018 Screenshot review desktop + mobile
- [ ] T019 `project.yml` entry/status, CHANGELOG v1, EVALUATION row, rebuild index, tag `ski_resort_map/v1`
- [ ] T020 Enable GitHub Pages (needs Chris's OK — repo setting)
