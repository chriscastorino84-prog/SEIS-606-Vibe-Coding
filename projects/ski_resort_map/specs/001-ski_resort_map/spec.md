# Feature Specification: US Ski Resort Map — core loop

**Feature:** `001-ski_resort_map` · **Created:** 2026-11-04 · **Status:** Draft v0.1 (awaiting Chris's review)
**Governing document:** `../constitution.md` v1.0

**Input (Chris, verbatim, prompts.md Round 1):**
> The first app I want to make is an interactive map of all of the ski resorts in the US. When you roll over the ski area, a ski map shows up with the live lift and terrain status, the posted opening day (if it isn't already open) with a timer counting down to opening day. I also want a link on the ski map page that links to the ski resort website.

## User Scenarios & Testing

### User Story 1 — See every US ski area on one map (Priority: P1)
A visitor opens the page and sees a map of the United States with a marker for each operating, lift-served, public ski area. Markers are visually grouped or clustered at national zoom so dense regions (Colorado, Vermont, Tahoe) remain readable, and resolve to individual markers on zoom.

**Why this priority:** Without the complete base layer nothing else has anywhere to live; it is also the only story that can be fully delivered from open data with no live dependency.

**Independent test:** Load the page offline-after-first-load; count markers ≥ 450; spot-check 10 known resorts across 5 states land within ~1 km of their base area.

**Acceptance scenarios:**
1. **Given** the page is loaded, **When** the map renders at national zoom, **Then** every record in `data/resorts.json` is represented and a legend shows the total count.
2. **Given** national zoom, **When** the visitor zooms into Summit County, CO, **Then** Breckenridge, Keystone, Copper, A-Basin and Loveland are separately clickable.
3. **Given** a marker, **When** the visitor hovers (pointer) or taps (touch), **Then** a panel opens within 200 ms showing at least the resort name, state and website link (US-4) even if no live data is available.

### User Story 2 — See the trail map and live lift/terrain status (Priority: P1)
When the panel opens, it shows the resort's trail map and, for resorts with a live feed, the current lift status (open / closed / hold / scheduled per lift, plus a count such as "12 / 18 lifts open") and terrain status (runs or acres open, where the feed provides it), each with a fetched-at time and the source name.

**Why this priority:** This is the stated reason for the app. It is P1 for the covered subset; the constitution (V.1) accepts partial coverage in v1 as long as it is honest.

**Independent test:** On an in-season day, open Breckenridge and one non-Vail resort covered by the aggregator; compare displayed lift counts with the resort's own status page at the same minute.

**Acceptance scenarios:**
1. **Given** a resort with a live feed, **When** the panel opens, **Then** lift and terrain status render with "as of HH:MM" and a source label, and refresh at least every 5 minutes while the panel is open.
2. **Given** a resort without a live feed, **When** the panel opens, **Then** the status area reads "No live data for this resort" and nothing else is shown as current.
3. **Given** any resort, **When** the panel opens, **Then** a trail map is shown: the official map embedded by URL when one is available, otherwise an open-data rendering labeled "Open data rendering, not the official map."
4. **Given** the live source is unreachable, **When** the panel opens, **Then** the last successfully fetched status is shown with its (older) timestamp and a visible "stale" marker — never blank, never silently current.

### User Story 3 — Opening-day countdown (Priority: P2)
If the resort is not currently open, the panel shows its posted (projected) opening day for the season and a live countdown (days · hours · minutes · seconds) to 9:00 local resort time on that day. Once open, the countdown is replaced by "Open" and the opening date it opened on, if known.

**Why this priority:** It is the fun part and almost free once dates are collected; it does not block US-1/US-2.

**Independent test:** Set the system clock to a date before a known opening date and confirm the countdown; set it after and confirm "Open."

**Acceptance scenarios:**
1. **Given** a resort with `opening_date` in the future, **When** the panel opens, **Then** a countdown ticks every second and the date and its source URL are shown.
2. **Given** `opening_date` has passed or the live feed reports the resort open, **When** the panel opens, **Then** "Open" is shown and no countdown.
3. **Given** no opening date is known, **When** the panel opens, **Then** "Opening date not posted" is shown with a link to the resort's site.
4. **Given** a resort open year-round or already open, **When** the live feed says `resort_open: true`, **Then** that overrides any stale `opening_date`.

### User Story 4 — Link to the resort's website (Priority: P1)
Every panel has a clearly labeled link to the resort's official website, opening in a new tab.

**Acceptance scenarios:**
1. **Given** any resort, **When** the panel opens, **Then** an "Official site ↗" link is present and resolves (HTTP 200/301 at data-build time; a build check flags dead links).

### Edge cases
- Resorts that straddle a state line or have two base areas (e.g. Palisades/Alpine) — one marker per ski area as the operator defines it; note aliases in the record.
- Private or members-only areas — excluded per constitution I.1; list them in `data/excluded.json` with a reason so the omission is deliberate.
- Resorts closed for the season / permanently — `status: closed_season` renders greyed; `status: defunct` is excluded.
- Time zones: countdown targets the resort's local time zone, stored per record.
- Touch devices have no hover: tap opens, second tap on the map closes.
- Very slow network: map tiles and markers render before any live fetch begins.

## Functional Requirements
- **FR-1** The system MUST load `data/resorts.json` containing, per resort: `id`, `name`, `aliases[]`, `state`, `lat`, `lon`, `timezone`, `website`, `trail_map_url` (nullable), `opening_date` (nullable, ISO), `opening_date_source` (URL + checked date), `status_source` (nullable: provider + provider id), `source` (where the base record came from).
- **FR-2** The system MUST render all records as markers on a slippy map with clustering above a configurable zoom threshold.
- **FR-3** The system MUST open a detail panel on hover (pointer devices) and tap (touch devices), and close it on pointer leave / second tap / Escape.
- **FR-4** The system MUST fetch live status from the configured provider for resorts with a `status_source`, cache it in memory with a timestamp, and re-fetch no more often than every 60 s per resort and at least every 5 min while a panel is open.
- **FR-5** The system MUST display per-lift status and aggregate counts when available, and terrain status when the provider returns it, each labeled with source and fetched-at time.
- **FR-6** The system MUST show the official trail map by URL when `trail_map_url` is set, otherwise an open-data rendering with ODbL attribution.
- **FR-7** The system MUST compute and tick a countdown to `opening_date` 09:00 in the resort's `timezone` when that instant is in the future and the live feed does not report the resort open.
- **FR-8** The system MUST show the official website link in every panel.
- **FR-9** The system MUST show a legend with counts: total resorts, resorts with live status, resorts currently open (from live feeds).
- **FR-10** The system MUST remain usable with the network unavailable after first load for everything except live status and embedded trail maps.
- **FR-11** The system MUST NOT bundle copies of official trail-map images (constitution III.1).
- **FR-12** A build script MUST validate `resorts.json` (schema, duplicate ids, coordinates inside the US bounding box incl. Alaska, reachable `website`) and fail on error.

## Key Entities
- **Resort** — one lift-served ski area; the unit shown as a marker (fields in FR-1).
- **LiftStatus** — `{resort_id, lifts:[{name, type?, status: open|closed|hold|scheduled|unknown}], runs_open?, runs_total?, acres_open?, resort_open?, fetched_at, source}`.
- **Provider** — an adapter that turns a remote source into `LiftStatus` (v1: one open aggregator adapter; others later).

## Success Criteria
- **SC-1** ≥ 450 resorts plotted; the list reconciles against two independent public lists with discrepancies logged.
- **SC-2** Live status shown for every resort the chosen aggregator covers in the US (target ≥ 60 in v1), and the legend's "live" count matches that number.
- **SC-3** A first-time visitor can find a named resort and reach its website in under 15 seconds (hallway test, 3 people).
- **SC-4** Status displayed matches the resort's own page within one refresh interval in 9 of 10 spot checks.
- **SC-5** Page is interactive in under 3 s on a mid-range laptop over a typical home connection.

## Assumptions
- "All ski resorts in the US" means operating, public, lift-served alpine areas (≈470–500); Nordic-only centers and defunct areas are out.
- Partial live coverage in v1 is acceptable provided it is labeled (constitution II.2, V.1) — **confirm with Chris**.
- Opening dates are gathered once per season into the data file (semi-manual, scripted where a source exists), not scraped live.

## Open questions — NEEDS CLARIFICATION
1. **Coverage bar for v1:** is "live status for the ~60–100 resorts an open aggregator already covers, static for the rest" acceptable, or is broad live coverage a v1 requirement (which forces a server-side scraper and a much larger build)?
2. **Trail map fallback:** is an open-data rendering acceptable where no official map can be embedded, or should those panels simply link out?
3. **Hover vs. click on desktop:** hover-to-open is what you asked for; do you also want click-to-pin so the panel stays while the pointer moves to it (needed to click the website link)? Proposed: hover previews, click pins.
4. **Hosting:** GitHub Pages (static only) vs. somewhere that allows a small status proxy?
