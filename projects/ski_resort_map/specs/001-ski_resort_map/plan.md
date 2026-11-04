# Implementation Plan: US Ski Resort Map — core loop

**Feature:** `001-ski_resort_map` · **Date:** 2026-11-04 · **Spec:** [spec.md](spec.md) v0.2 · **Constitution:** v1.0

## Summary

A static GitHub Pages site: one HTML page with a Leaflet map of 513 US ski areas built from OpenSkiMap. Hover previews a side panel; click pins it. The panel shows lift status from an open, CORS-enabled community feed for the ~55 resorts it covers, a countdown to the posted opening day, a link to the resort's trail map on skimap.org, and the official website. A GitHub Action rebuilds the resort data weekly and whenever its inputs change.

## Research (phase 0) — what was verified, 2026-11-04

| Question | Finding | Consequence |
|---|---|---|
| Where can ~500 US ski areas with coordinates and websites come from? | **OpenSkiMap** `ski_areas.geojson` (OSM + skimap.org, ODbL), 21 MB. US + operating + downhill + named + ≥1 mapped lift = **513** areas; 484 with a website, 503 with a skimap.org page. | Single, reproducible base source (D-006). Matches the NSAA's ~470 count and Storm Skiing's 503. |
| Can Liftie be called from the browser? | No. `liftie.info/api/*` returns a Cloudflare bot-challenge page (HTTP 403) to non-browser clients, and it sets no CORS headers. | Liftie is out for v1. |
| Is there a live feed a static page can read directly? | **jacobschulman/ski-run-scraper** on GitHub Pages: `latest-lifts.json` sends `access-control-allow-origin: *`. It covers 61 resorts (Vail + Ikon "Inspector" resorts), **55 of them in the US**, with per-lift status and timestamps. | Browser fetches it directly, so no proxy and no Action (D-005 holds). |
| Is that feed fresh? | Its `generated` time is **2026-05-16**, the end of last season. It hadn't refreshed for 2026-27 as of 2026-11-04. | Panels must label stale data. Older than 24 h → "last report <date>", never shown as current (constitution II.1). Running our own copy of the scraper is a candidate `specs/002`. |
| Terrain (runs/acres open)? | The same project publishes `/{resort}/terrain/{date}.json` in raw Vail format (`GroomingAreas[].Trails[]`, `Lifts[]`). Fields vary by provider. | Parse tolerantly: count trails whose `IsOpen === true` or whose `Status` matches /open/. If none are found, say "Terrain status not available." |
| Opening dates? | No API. Official Vail (Aug 18) and Ikon (Sept 17) calendars plus three roundups give **63 matched US resorts**. | Curated `data/opening_dates.json` with a source URL per entry (D-007). |
| Trail maps? | skimap.org hosts most official trail-map images, one page per area. Its ID is in OpenSkiMap's `sources`. | "View trail map ↗" links to skimap.org, else the resort website (D-003). |
| Time zones? | Not in OpenSkiMap. | Assigned by state, with lon/lat splits for ID, OR, MI, TN, SD/NE/ND, TX (D-008). |

## Technical context

- **Language:** HTML/CSS + vanilla ES modules (no build step); Node 22 for the data script only.
- **Dependencies:** Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 from unpkg, with SRI hashes. Base tiles from CARTO Positron with OSM attribution.
- **Storage:** `src/data/resorts.json` (~175 KB, generated). No backend, no cookies, no analytics.
- **Testing:** `node --test` unit tests for the pure functions (countdown, time-zone instant, feed parsing, terrain parsing). A Playwright smoke test loads the page, counts markers, and opens and pins a panel.
- **Target:** evergreen desktop + mobile browsers; GitHub Pages.
- **Performance:** first interactive under 3 s. Markers are clustered; the feed is fetched once on load and every 5 min while a panel is open.

## Constitution check

| Article | How this plan complies |
|---|---|
| I. What it is | One page; all 513 areas; hover/tap panel with trail map, lift status, countdown, website. |
| II. Data honesty | Every status shows its source and timestamp. Stale (>24 h) is labeled. The legend counts live-covered vs. static resorts. Opening dates carry their source link. |
| III. Copyright | No trail-map images copied; link-out only. ODbL attribution in the footer. |
| IV. Technical | Static Pages; no keys; open base data in the repo with `sources`. The map shell works from cache offline (tiles excepted). |
| V. Scope | Only the 4 user stories. Snow, weather, and pass filters are excluded. |
| VI. Process | This plan + tasks.md precede `src/`. Each round is logged. |

## Project structure

```
projects/ski_resort_map/
├── data/
│   ├── opening_dates.json     # curated, sourced (input)
│   └── feed_aliases.json      # feed key → resort overrides (input)
├── scripts/
│   └── build_resorts.mjs      # OpenSkiMap + inputs → src/data/resorts.json
├── src/                       # ← GitHub Pages serves this folder's files
│   ├── ski_resort_map.html    # entry (project.yml.entry)
│   ├── app.js                 # map, markers, panel, hover/pin
│   ├── lib.js                 # pure functions (countdown, tz, feed + terrain parsing) — unit-tested
│   ├── styles.css
│   └── data/
│       ├── resorts.json       # generated
│       └── build_report.md    # generated: counts + unmatched names
└── tests/
    ├── lib.test.mjs           # node --test
    └── smoke.mjs              # Playwright
.github/workflows/ski_resort_map_data.yml   # weekly + on-input-change rebuild
```

## Key behaviors

- **Panel state machine:** `hidden → preview` (marker mouseover) `→ hidden` (mouseout after 250 ms grace, cancelled if the pointer enters the panel) · `preview → pinned` (marker click) · `pinned → hidden` (Esc, ×, map click). Touch devices: tap means pinned.
- **Status precedence:** if the feed is fresh (<24 h) and any lift is `Open`, show **Open now**. Otherwise, if the opening date is in the future, show a countdown to 09:00 resort-local. Otherwise, if the opening date has passed, show "Scheduled to have opened <date>" plus "check the resort site." With no date, show "Opening date not posted" (and the note, if present).
- **Feed freshness label:** `as of HH:MM` within 24 h; otherwise "Last report <date> — the feed hasn't updated since" with a stale badge.
- **Legend:** total plotted · with live feed · open now (fresh + ≥1 open lift) · with posted opening date.

## Risks

| Risk | Mitigation |
|---|---|
| Community feed stops or changes schema | Parsing is defensive; panels degrade to "No live data." `specs/002` = run our own scraper in an Action. |
| OpenSkiMap URL or schema change | The Action fails loudly; the last good `resorts.json` stays committed. |
| Opening dates drift | Each entry shows its source and checked date. Re-check monthly in season. |
