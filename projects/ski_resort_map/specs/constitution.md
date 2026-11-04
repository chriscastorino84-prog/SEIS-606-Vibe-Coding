# US Ski Resort Map — Constitution

**Version:** 1.0 · **Ratified:** 2026-11-04 · **Governs:** `specs/001-ski_resort_map/`

Non-negotiables for this app. Any spec, plan or task that conflicts with an article is invalid until the article is amended (log the amendment in `DECISIONS.md`).

## I. What it is
1. A single-page, browser-only interactive map of every operating, lift-served, public ski area in the United States (≈470–500 of them).
2. Hovering (desktop) or tapping (touch) a resort opens a panel showing: the resort's trail map, live lift and terrain status, the posted opening day with a live countdown when the resort is not yet open, and a link to the resort's official website.
3. It is a personal, non-commercial project built to learn — not a product. It must never pretend to be an official source; every panel says where its data came from and when it was fetched.

## II. Data honesty
1. **Live means live or labeled.** Every status value carries a fetched-at timestamp. If a resort has no live feed, the panel says "no live data" — it never shows stale or invented status as current.
2. **Coverage is explicit.** The map visually distinguishes resorts with live status from resorts with static info only. A legend states the count of each.
3. **No scraping of a site that forbids it** in its terms or `robots.txt`. Prefer published APIs and existing open aggregators; add a per-resort parser only when permitted.
4. **Opening dates are sourced**, with the URL they came from and the date they were checked, because they change.

## III. Trail maps and copyright
1. Official trail-map images are the resort's copyright. The app **links or embeds by URL** from the resort's own site or a licensed host; it does not copy images into the repo.
2. When no embeddable official map exists, the panel shows an open-data rendering (OpenSkiMap / OpenStreetMap-derived lifts and runs) clearly labeled as such, with attribution per the ODbL.

## IV. Technical boundaries
1. **Static-first.** v1 is static HTML/CSS/JS deployable to GitHub Pages. Any server component (a status proxy or cache) is a separate, explicitly decided addition — see `DECISIONS.md`.
2. **No accounts, no tracking, no paid API keys committed.** Keys, if ever needed, live in environment variables and are documented in `plan.md`.
3. **Open base data.** Resort list and coordinates come from open sources (OpenStreetMap / OpenSkiMap, Wikipedia, Forest Service permits) and are stored in the repo as a reviewable `data/resorts.json` with a `source` field per record.
4. **Works offline for the static parts.** With the network down, the map, markers, names, websites and last-known opening dates still render.

## V. Scope discipline
1. v1 proves the loop end-to-end for a **slice**: all resorts plotted; live status for whichever subset an open aggregator already covers; countdown and website link for all. Broader live coverage is a later feature (`specs/002-…`).
2. Not in v1: snow reports, weather, webcams, pass-affiliation filters, trip planning, user favorites.
3. Each new capability is a new `specs/00N-<slug>/` set and a new round in `prompts.md`.

## VI. Process
1. Spec Kit order is mandatory: constitution → spec → plan → tasks → implement. No `src/` code before `tasks.md` exists.
2. Every prompt that produces code or data is a round in `prompts.md` with its commit hash. Every data-source choice is a `DECISIONS.md` entry.
3. A version is tagged `ski_resort_map/vN` only when `EVALUATION.md` has a row for it.
