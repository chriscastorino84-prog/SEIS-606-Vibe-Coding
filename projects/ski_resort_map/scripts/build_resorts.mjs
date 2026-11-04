#!/usr/bin/env node
// Build src/data/resorts.json for the US Ski Resort Map.
//
//   node projects/ski_resort_map/scripts/build_resorts.mjs [--geojson path/to/ski_areas.geojson]
//
// Inputs
//   - OpenSkiMap ski areas (ODbL, derived from OpenStreetMap + skimap.org):
//       https://tiles.openskimap.org/geojson/ski_areas.geojson   (~21 MB, downloaded unless --geojson given)
//   - Live lift feed resort keys (for feed_key matching):
//       https://jacobschulman.github.io/ski-run-scraper/data/latest-lifts.json
//   - data/opening_dates.json   (curated, sourced; see DECISIONS.md D-007)
//   - data/feed_aliases.json    (manual feed_key → resort overrides when name matching fails)
// Outputs
//   - src/data/resorts.json     (compact array consumed by the app)
//   - src/data/build_report.md  (counts + every unmatched name, so gaps are visible in review)
//
// No dependencies; Node 18+ (global fetch).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OSM_URL = "https://tiles.openskimap.org/geojson/ski_areas.geojson";
const FEED_URL = "https://jacobschulman.github.io/ski-run-scraper/data/latest-lifts.json";

const args = process.argv.slice(2);
const geoArg = args.includes("--geojson") ? args[args.indexOf("--geojson") + 1] : null;

// ---------- helpers ----------
// Loose name key: drops generic words so "Mt. Bachelor" == "Mount Bachelor" and
// "Park City Mountain" == "Park City". Falls back to the plain name if nothing is left
// (e.g. "Mount Snow").
const norm = (s) => {
  const base = (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ");
  const loose = base
    .replace(/\b(ski|skiing|resort|resorts|area|mountain|mountains|mtn|mt|mount|the|and|snow|bowl|village|of|at|california|tahoe|center|club|hill)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
  return loose || base.replace(/[^a-z0-9]+/g, "");
};

const slug = (s) =>
  (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// A few OpenSkiMap names carry geocoder residue, e.g. "Ski Santa Fe, Santa Fe, Q38555".
const cleanName = (s) => s.replace(/,\s*[^,]+,\s*Q\d+$/, "").trim();

function centroid(geom) {
  // Average of all coordinates of the outer ring(s); good enough for a marker.
  if (geom.type === "Point") return geom.coordinates;
  const rings =
    geom.type === "Polygon" ? [geom.coordinates[0]] :
    geom.type === "MultiPolygon" ? geom.coordinates.map((p) => p[0]) :
    geom.type === "LineString" ? [geom.coordinates] : [];
  let x = 0, y = 0, n = 0;
  for (const r of rings) for (const [lon, lat] of r) { x += lon; y += lat; n++; }
  return n ? [x / n, y / n] : null;
}

// US time zone for a ski area: state default, with longitude/latitude splits for the split states
// that actually have ski areas. Good to the hour, which is all the countdown needs. (D-008)
const STATE_TZ = {
  AK: "America/Anchorage", AZ: "America/Phoenix", CA: "America/Los_Angeles", NV: "America/Los_Angeles",
  OR: "America/Los_Angeles", WA: "America/Los_Angeles", CO: "America/Denver", MT: "America/Denver",
  NM: "America/Denver", UT: "America/Denver", WY: "America/Denver", ID: "America/Boise",
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago",
  MN: "America/Chicago", MO: "America/Chicago", WI: "America/Chicago", OK: "America/Chicago",
  TX: "America/Chicago", ND: "America/Chicago", SD: "America/Chicago", NE: "America/Chicago", KS: "America/Chicago",
  TN: "America/Chicago", KY: "America/New_York", IN: "America/Indiana/Indianapolis", MI: "America/Detroit",
};
function timezoneFor(state, lon, lat) {
  if (state === "ID" && lat > 45.5) return "America/Los_Angeles";
  if (state === "OR" && lon > -117.6 && lat < 44.5) return "America/Boise";
  if (state === "MI" && lon < -87.6) return "America/Menominee";
  if (state === "TN" && lon > -85.6) return "America/New_York";
  if ((state === "SD" || state === "NE" || state === "ND") && lon < -101) return "America/Denver";
  if (state === "TX" && lon < -104.9) return "America/Denver";
  return STATE_TZ[state] || "America/New_York";
}

function liftCount(p) {
  const bt = p.statistics?.lifts?.byType || {};
  return Object.values(bt).reduce((a, b) => a + (b.count || 0), 0);
}
function runCount(p) {
  const bd = p.statistics?.runs?.byActivity?.downhill?.byDifficulty || {};
  return Object.values(bd).reduce((a, b) => a + (b.count || 0), 0);
}

// ---------- load ----------
console.error("loading OpenSkiMap…");
const geo = geoArg
  ? JSON.parse(await readFile(geoArg, "utf8"))
  : await (await fetch(OSM_URL)).json();

console.error("loading feed keys…");
let feed = {};
try { feed = await (await fetch(FEED_URL)).json(); } catch (e) { console.error("feed unavailable:", e.message); }

const openingDates = JSON.parse(await readFile(join(ROOT, "data/opening_dates.json"), "utf8"));
const feedAliases = JSON.parse(await readFile(join(ROOT, "data/feed_aliases.json"), "utf8"));

// ---------- filter ----------
// Operating, named, downhill, at least one mapped lift, in the US. (constitution I.1, D-006)
const resorts = [];
const seen = new Map();
for (const f of geo.features) {
  const p = f.properties;
  const usPlace = (p.places || []).find((pl) => pl.iso3166_1Alpha2 === "US");
  if (!usPlace) continue;
  if (p.status !== "operating") continue;
  if (!(p.activities || []).includes("downhill")) continue;
  if (!p.name) continue;
  const lifts = liftCount(p);
  if (lifts < 1) continue;
  const c = centroid(f.geometry);
  if (!c) continue;
  const [lon, lat] = c;
  const state = (usPlace.iso3166_2 || "").replace("US-", "") || null;
  const skimap = (p.sources || []).find((s) => s.type === "skimap.org");
  let id = slug(cleanName(p.name)) + (state ? "-" + state.toLowerCase() : "");
  if (seen.has(id)) id += "-" + p.id.slice(0, 6);
  seen.set(id, true);
  resorts.push({
    id,
    name: cleanName(p.name),
    state,
    lat: +lat.toFixed(5),
    lon: +lon.toFixed(5),
    tz: timezoneFor(state, lon, lat),
    website: (p.websites || [])[0] || null,
    trail_map_page: skimap ? `https://skimap.org/skiareas/view/${skimap.id}` : null,
    lifts,
    runs: runCount(p),
    osm_id: p.id,
    feed_key: null,
    opening: null,
  });
}

// ---------- match feed keys ----------
const byNorm = new Map();
for (const r of resorts) {
  const k = norm(r.name);
  if (!byNorm.has(k)) byNorm.set(k, []);
  byNorm.get(k).push(r);
}
const feedUnmatched = [];
let feedMatched = 0;
for (const [key, v] of Object.entries(feed)) {
  let target = null;
  const alias = feedAliases[key];
  if (alias === null) continue; // explicitly non-US / ignored
  if (alias) target = resorts.find((r) => r.id === alias || r.name === alias.name);
  if (!target) {
    const cands = byNorm.get(norm(v.name)) || byNorm.get(norm(key)) || [];
    if (cands.length === 1) target = cands[0];
    else if (cands.length > 1) target = cands.sort((a, b) => b.lifts - a.lifts)[0];
  }
  if (target) { target.feed_key = key; feedMatched++; }
  else feedUnmatched.push(`${key} (${v.name})`);
}

// ---------- merge opening dates ----------
const odUnmatched = [];
let odMatched = 0;
for (const od of openingDates.resorts) {
  // An explicit `match` is an exact OpenSkiMap name and ignores state (Heavenly straddles CA/NV).
  const cands = od.match
    ? resorts.filter((r) => r.name === od.match)
    : resorts.filter((r) => r.state === od.state && norm(r.name) === norm(od.name));
  const target = cands.sort((a, b) => b.lifts - a.lifts)[0];
  if (!target) { odUnmatched.push(`${od.name} (${od.state})`); continue; }
  target.opening = { date: od.date, note: od.note || null, source: od.source, checked: openingDates.checked };
  odMatched++;
}

// ---------- write ----------
resorts.sort((a, b) => a.name.localeCompare(b.name));
const out = join(ROOT, "src/data");
await mkdir(out, { recursive: true });
const built = new Date().toISOString();
await writeFile(
  join(out, "resorts.json"),
  JSON.stringify({ built, season: openingDates.season, sources: {
    resorts: "OpenSkiMap (© OpenStreetMap contributors, ODbL; skimap.org)",
    live: FEED_URL,
    opening_dates: "data/opening_dates.json",
  }, resorts })
);

const byState = {};
for (const r of resorts) byState[r.state] = (byState[r.state] || 0) + 1;
const report = `# Build report — ${built}

| | count |
|---|---|
| Resorts plotted | ${resorts.length} |
| With website | ${resorts.filter((r) => r.website).length} |
| With skimap.org trail-map page | ${resorts.filter((r) => r.trail_map_page).length} |
| Matched to live feed | ${feedMatched} |
| With posted opening date | ${odMatched} |

## By state
${Object.entries(byState).sort().map(([s, n]) => `${s} ${n}`).join(" · ")}

## Live-feed keys not matched (non-US expected; add US ones to data/feed_aliases.json)
${feedUnmatched.map((x) => "- " + x).join("\n") || "- none"}

## Opening-date entries not matched (fix name/state or add \`match\` in data/opening_dates.json)
${odUnmatched.map((x) => "- " + x).join("\n") || "- none"}
`;
await writeFile(join(out, "build_report.md"), report);
console.log(report);
