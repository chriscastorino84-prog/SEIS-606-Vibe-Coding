# US Ski Resort Map — changelog

One entry per git tag `ski_resort_map/vN`. Newest at the top. Conventions: `../README.md` §2.

## Unreleased (v1 candidate) — 2026-11-04
- Rounds: #1–#3
- Model(s): claude-fable-5-1 (spec), claude-opus-5-5 (plan + build)
- Changes:
  - 513 US ski areas on a clustered Leaflet map (OpenSkiMap data, rebuilt weekly by a GitHub Action)
  - Hover-preview / click-to-pin panel: lift status for 55 feed-covered resorts with freshness labels, opening-day countdown (61 dated + 2 "ASAP" notes), trail-map link (skimap.org), official site
  - Search box, legend with coverage counts, mobile bottom sheet
  - 10 unit tests + 11-check Playwright smoke test
- To tag v1: enable GitHub Pages, verify against real tiles/feed, fill an EVALUATION.md row (constitution VI.3)
