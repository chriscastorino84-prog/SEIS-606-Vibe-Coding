# US Ski Resort Map — decisions

Numbered, never deleted; supersede instead. Conventions: `../README.md` §6.

## D-001 — Live lift status comes from an existing open aggregator in v1, not our own scrapers
Date: 2026-11-04 · Status: proposed · Round: prompts.md #1
Context: There are ~470–500 US ski areas and no single free API for live lift status. Liftie (open source, BSD, public JSON API, ~190 resorts worldwide) and a Vail/Ikon scraper published to GitHub Pages (~60 resorts) exist; the rest need a parser per resort or a paid feed.
Decision: v1 plots every resort but shows live status only for resorts one open aggregator covers, labeled honestly (constitution II.2, V.1). Which aggregator, and whether a tiny proxy is needed for CORS, is decided in `plan.md`.
Alternatives: (a) Write per-resort scrapers for all ~470 — months of work and a server; (b) paid aggregator (Skiresort Service International, Parse.bot) — recurring cost for a learning project; (c) drop "live" — contradicts the prompt.
Consequences: Partial coverage in v1 is a feature of the record, not a bug: `EVALUATION.md` will score how useful partial live data actually is. Expanding coverage becomes `specs/002-…`.

## D-002 — Official trail maps are embedded by URL, never copied into the repo
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: Trail-map art is resort copyright; the repo is public.
Decision: Store `trail_map_url` per resort and embed/link it; fall back to an OpenSkiMap/OSM rendering with ODbL attribution.
Alternatives: Download the PNG/PDFs — simpler offline, legally wrong.
Consequences: Some panels will show a less pretty open-data map; links can rot and need a build-time check.
