# US Ski Resort Map — decisions

Numbered, never deleted; supersede instead. Conventions: `../README.md` §6.

## D-001 — Live lift status comes from an existing open aggregator in v1, not our own scrapers
Date: 2026-11-04 · Status: accepted (Round 2) · Round: prompts.md #1
Context: There are ~470–500 US ski areas and no single free API for live lift status. Liftie (open source, BSD, public JSON API, ~190 resorts worldwide) and a Vail/Ikon scraper published to GitHub Pages (~60 resorts) exist; the rest need a parser per resort or a paid feed.
Decision: v1 plots every resort but shows live status only for resorts one open aggregator covers, labeled honestly (constitution II.2, V.1). Which aggregator, and whether a tiny proxy is needed for CORS, is decided in `plan.md`.
Alternatives: (a) Write per-resort scrapers for all ~470 — months of work and a server; (b) paid aggregator (Skiresort Service International, Parse.bot) — recurring cost for a learning project; (c) drop "live" — contradicts the prompt.
Consequences: Partial coverage in v1 is a feature of the record, not a bug: `EVALUATION.md` will score how useful partial live data actually is. Expanding coverage becomes `specs/002-…`.

## D-002 — Official trail maps are embedded by URL, never copied into the repo
Date: 2026-11-04 · Status: accepted · Round: prompts.md #1
Context: Trail-map art is resort copyright; the repo is public.
Decision: Store `trail_map_url` per resort and embed/link it; fallback superseded by D-003.
Alternatives: Download the PNG/PDFs — simpler offline, legally wrong.
Consequences: Some panels will show a less pretty open-data map; links can rot and need a build-time check.

## D-003 — No open-data trail-map rendering in v1; link out instead
Date: 2026-11-04 · Status: accepted · Round: prompts.md #2
Context: Asked whether panels without an embeddable official map should render an OpenSkiMap view or link out, Chris chose "what's easiest."
Decision: Link out ("View trail map ↗") to the resort's trail-map page or website. Supersedes D-002's fallback clause.
Alternatives: OpenSkiMap vector rendering — prettier and keeps users in-app, but adds a map-style dependency, per-resort bounding boxes, and ODbL attribution work.
Consequences: Some panels will be text-and-link only; revisit in a later feature if EVALUATION shows it matters.

## D-004 — Hover previews, click pins
Date: 2026-11-04 · Status: accepted · Round: prompts.md #2
Context: Pure hover panels disappear when the pointer moves toward the panel's links.
Decision: Hover shows a preview; click pins it; Escape / close / outside-click unpins. Touch: tap = pin.
Consequences: Two panel states to implement and test.

## D-005 — GitHub Pages, static only
Date: 2026-11-04 · Status: accepted · Round: prompts.md #2
Context: Hosting choice between static Pages and a host that permits a status proxy.
Decision: GitHub Pages. Any live source that blocks cross-origin browser requests is pre-fetched into static JSON by a scheduled GitHub Action instead of a proxy.
Consequences: "Live" means as fresh as the Action schedule (GitHub cron is best-effort, ~every 15–30 min at best) for those sources; panels show the fetched-at time either way.
