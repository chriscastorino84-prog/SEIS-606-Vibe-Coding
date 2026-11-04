// US Ski Resort Map — UI. Pure logic lives in lib.js.
import { summarizeFeed, summarizeTerrain, statusFor, countdownParts, fmtDate, fmtAsOf } from "./lib.js";

const FEED_BASE = "https://jacobschulman.github.io/ski-run-scraper/data";
const FEED_URL = `${FEED_BASE}/latest-lifts.json`;
const FEED_REFRESH_MS = 5 * 60 * 1000;
const PREVIEW_GRACE_MS = 250;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = {
  resorts: [],
  byId: new Map(),
  markers: new Map(),
  feed: null,            // raw latest-lifts.json
  feedFetchedAt: null,
  feedError: null,
  terrainCache: new Map(),
  current: null,         // resort id shown in panel
  mode: "hidden",        // hidden | preview | pinned
  hideTimer: null,
  tick: null,
  refresh: null,
};

// ---------- map ----------
const map = L.map("map", { zoomControl: true, worldCopyJump: true, minZoom: 3 }).setView([41.5, -100], 4);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  subdomains: "abcd", maxZoom: 18, attribution: "© OpenStreetMap contributors © CARTO",
}).addTo(map);
const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, disableClusteringAtZoom: 9 });
map.addLayer(cluster);

// ---------- data ----------
async function loadResorts() {
  const res = await fetch("data/resorts.json");
  const data = await res.json();
  state.resorts = data.resorts;
  for (const r of data.resorts) state.byId.set(r.id, r);
  return data;
}

async function loadFeed() {
  try {
    const res = await fetch(FEED_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.feed = await res.json();
    state.feedFetchedAt = Date.now();
    state.feedError = null;
  } catch (e) {
    state.feedError = e.message;
  }
}

const feedFor = (r) => (r.feed_key && state.feed ? summarizeFeed(state.feed[r.feed_key], Date.now()) : null);

async function terrainFor(r, feedSummary) {
  if (!r.feed_key || !feedSummary?.date) return null;
  const key = `${r.feed_key}/${feedSummary.date}`;
  if (state.terrainCache.has(key)) return state.terrainCache.get(key);
  let out = null;
  try {
    const res = await fetch(`${FEED_BASE}/${r.feed_key}/terrain/${feedSummary.date}.json`);
    if (res.ok) out = summarizeTerrain(await res.json());
  } catch { /* leave null */ }
  state.terrainCache.set(key, out);
  return out;
}

// ---------- markers ----------
function pinClass(r) {
  const fs = feedFor(r);
  if (fs && !fs.stale && fs.counts.open > 0) return "open";
  return r.feed_key ? "live" : "static";
}

function renderMarkers() {
  cluster.clearLayers();
  state.markers.clear();
  const layers = [];
  for (const r of state.resorts) {
    const icon = L.divIcon({ className: "", html: `<div class="pin ${pinClass(r)}" data-id="${esc(r.id)}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
    const m = L.marker([r.lat, r.lon], { icon, title: r.name, keyboard: true, riseOnHover: true });
    m.on("mouseover", () => preview(r.id));
    m.on("mouseout", () => scheduleHide());
    m.on("click", () => pin(r.id));
    m.on("keypress", (e) => { if (e.originalEvent.key === "Enter") pin(r.id); });
    state.markers.set(r.id, m);
    layers.push(m);
  }
  cluster.addLayers(layers);
}

function updateLegend() {
  const live = state.resorts.filter((r) => r.feed_key).length;
  const open = state.resorts.filter((r) => pinClass(r) === "open").length;
  const set = (k, v) => { const el = $(`[data-count="${k}"]`); if (el) el.textContent = v; };
  set("total", state.resorts.length);
  set("live", live);
  set("open", open);
  set("static", state.resorts.length - live);
  set("dated", state.resorts.filter((r) => r.opening?.date).length);
  const fs = $("[data-feed-status]");
  if (state.feedError) { fs.textContent = `Lift feed unavailable (${state.feedError})`; fs.classList.add("stale"); return; }
  if (!state.feed) return;
  const newest = Math.max(...Object.values(state.feed).map((v) => Date.parse(v.generated || v.date || 0)).filter((x) => !isNaN(x)));
  const stale = Date.now() - newest > 24 * 3600 * 1000;
  fs.textContent = stale ? `Lift feed last updated ${fmtAsOf(newest, Date.now())} — not refreshed this season yet` : `Lift feed updated ${fmtAsOf(newest, Date.now())}`;
  fs.classList.toggle("stale", stale);
}

// ---------- panel ----------
const panel = $("#panel");
const body = $(".panel-body", panel);

function setActivePin(id) {
  document.querySelectorAll(".pin.active").forEach((el) => el.classList.remove("active"));
  if (id) document.querySelector(`.pin[data-id="${CSS.escape(id)}"]`)?.classList.add("active");
}

function preview(id) {
  clearTimeout(state.hideTimer);
  if (state.mode === "pinned") return; // a pinned panel stays put while you hover elsewhere
  show(id, "preview");
}

function pin(id) {
  clearTimeout(state.hideTimer);
  show(id, "pinned");
}

function scheduleHide() {
  if (state.mode !== "preview") return;
  clearTimeout(state.hideTimer);
  state.hideTimer = setTimeout(hide, PREVIEW_GRACE_MS);
}

function hide() {
  state.mode = "hidden";
  state.current = null;
  panel.hidden = true;
  panel.dataset.mode = "hidden";
  clearInterval(state.tick);
  clearInterval(state.refresh);
  setActivePin(null);
}

function show(id, mode) {
  const r = state.byId.get(id);
  if (!r) return;
  const changed = state.current !== id;
  state.current = id;
  state.mode = mode;
  panel.dataset.mode = mode;
  panel.hidden = false;
  setActivePin(id);
  if (changed) renderPanel(r);
  clearInterval(state.refresh);
  if (r.feed_key) {
    state.refresh = setInterval(async () => { await loadFeed(); updateLegend(); if (state.current === id) renderPanel(r); }, FEED_REFRESH_MS);
  }
}

function renderPanel(r) {
  const now = Date.now();
  const fs = feedFor(r);
  const st = statusFor(r, fs, now);

  body.innerHTML = `
    <div class="p-head">
      <div class="p-sub">${esc(r.state || "")}${r.lifts ? ` · ${r.lifts} lifts mapped` : ""}${r.runs ? ` · ${r.runs} runs` : ""}</div>
      <h2>${esc(r.name)}</h2>
      <div class="p-hint">Click the marker to pin this panel.</div>
    </div>
    ${statusBlock(st, r)}
    <div class="actions">
      ${r.trail_map_page || r.website
        ? `<a class="btn" href="${esc(r.trail_map_page || r.website)}" target="_blank" rel="noopener">View trail map ↗</a>`
        : `<span class="btn" aria-disabled="true">No trail map link</span>`}
      ${r.website
        ? `<a class="btn primary" href="${esc(r.website)}" target="_blank" rel="noopener">Official site ↗</a>`
        : `<a class="btn" href="https://www.google.com/search?q=${encodeURIComponent(r.name + " ski " + (r.state || ""))}" target="_blank" rel="noopener">Search for site ↗</a>`}
    </div>
    <div class="section" id="lift-section">
      <h3>Lifts</h3>
      ${liftsBlock(fs, r, now)}
    </div>
    <div class="section" id="terrain-section" ${r.feed_key ? "" : "hidden"}>
      <h3>Terrain</h3>
      <p class="muted">Checking…</p>
    </div>
    <div class="section">
      <h3>Mapped terrain</h3>
      <div class="facts">
        <div><b>${r.lifts ?? "–"}</b><span>lifts in OpenStreetMap</span></div>
        <div><b>${r.runs ?? "–"}</b><span>downhill runs mapped</span></div>
      </div>
      <p class="src">Counts come from OpenStreetMap, not the resort, and may be incomplete.</p>
    </div>
  `;

  clearInterval(state.tick);
  if (st.kind === "countdown") {
    const cd = $(".countdown", body);
    const draw = () => {
      const p = countdownParts(st.at - Date.now());
      cd.innerHTML = [["days", p.days], ["hrs", p.hours], ["min", p.minutes], ["sec", p.seconds]]
        .map(([k, v]) => `<div><b>${String(v).padStart(2, "0")}</b><span>${k}</span></div>`).join("");
      if (st.at - Date.now() <= 0) renderPanel(r);
    };
    draw();
    state.tick = setInterval(draw, 1000);
  }

  if (r.feed_key) {
    terrainFor(r, fs).then((t) => {
      if (state.current !== r.id) return;
      const el = $("#terrain-section", body);
      if (!el) return;
      el.innerHTML = `<h3>Terrain</h3>` + (t
        ? `<div class="meta"><b>${t.open} / ${t.total}</b> trails open ${fs?.stale ? `<span class="badge stale">as of ${fmtDate(fs.date)}</span>` : ""}</div>
           <div class="bar-chart"><i class="o" style="width:${(100 * t.open) / t.total}%"></i></div>`
        : `<p class="muted">Terrain status not available from this feed.</p>`);
    });
  }
}

function statusBlock(st, r) {
  const src = (s) => (s ? `<div class="src">Source: <a href="${esc(s)}" target="_blank" rel="noopener">${esc(new URL(s).hostname.replace(/^www\./, ""))}</a> · checked ${esc(r.opening?.checked || "")}</div>` : "");
  switch (st.kind) {
    case "open":
      return `<div class="status open"><div class="label">Right now</div><div class="big">Open — lifts spinning</div></div>`;
    case "countdown":
      return `<div class="status"><div class="label">Opening day</div>
        <div class="big">${esc(fmtDate(st.date))}${st.note ? ` <span class="badge">${esc(st.note)}</span>` : ""}</div>
        <div class="countdown" aria-label="Countdown to opening day"></div>
        ${src(st.source)}</div>`;
    case "past-date":
      return `<div class="status"><div class="label">Opening day</div>
        <div class="big">Scheduled for ${esc(fmtDate(st.date))}</div>
        <div class="muted">That date has passed — the resort is likely open or delayed. Check the official site.</div>
        ${src(st.source)}</div>`;
    default:
      return `<div class="status"><div class="label">Opening day</div>
        <div class="big">${st.note ? esc(st.note) : "Opening date not posted"}</div>
        ${st.note ? "" : `<div class="muted">No projected date found for 2026-27 yet.</div>`}
        ${src(st.source)}</div>`;
  }
}

function liftsBlock(fs, r, now) {
  if (!r.feed_key) return `<p class="muted">No live data for this resort. Check the official site for lift status.</p>`;
  if (state.feedError) return `<p class="muted">The lift feed couldn't be reached (${esc(state.feedError)}).</p>`;
  if (!fs) return `<p class="muted">No lift report in the feed for this resort right now.</p>`;
  const { counts, total } = fs;
  const pct = (n) => ((100 * n) / total).toFixed(1);
  const order = { open: 0, hold: 1, scheduled: 2, closed: 3, unknown: 4 };
  const rows = [...fs.lifts].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name))
    .map((l) => `<li><span>${esc(l.name)}</span><span class="st ${l.status}">${l.status}</span></li>`).join("");
  return `
    <div class="meta">
      <b>${counts.open} / ${total}</b> open
      ${counts.hold ? ` · ${counts.hold} on hold` : ""}${counts.scheduled ? ` · ${counts.scheduled} scheduled` : ""}
      ${fs.stale
        ? `<span class="badge stale">Last report ${esc(fmtAsOf(fs.asOf, now))} — not current</span>`
        : `<span class="badge fresh">as of ${esc(fmtAsOf(fs.asOf, now))}</span>`}
    </div>
    <div class="bar-chart" aria-hidden="true"><i class="o" style="width:${pct(counts.open)}%"></i><i class="h" style="width:${pct(counts.hold)}%"></i><i class="s" style="width:${pct(counts.scheduled)}%"></i></div>
    <ul class="lifts">${rows}</ul>
    <p class="src">Source: community feed (ski-run-scraper), refreshed every 5 min while this panel is open.</p>`;
}

// ---------- interactions ----------
panel.addEventListener("mouseenter", () => clearTimeout(state.hideTimer));
panel.addEventListener("mouseleave", () => scheduleHide());
$(".panel-close", panel).addEventListener("click", hide);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
map.on("click", () => { if (state.mode === "pinned") hide(); });

const q = $("#q");
q.addEventListener("change", () => {
  const v = q.value.trim().toLowerCase();
  const r = state.resorts.find((x) => `${x.name} (${x.state})`.toLowerCase() === v) || state.resorts.find((x) => x.name.toLowerCase().includes(v));
  if (!r) return;
  map.flyTo([r.lat, r.lon], 11, { duration: 0.8 });
  setTimeout(() => pin(r.id), 850);
  q.blur();
});

// ---------- boot ----------
(async function boot() {
  await loadResorts();
  $("#resort-names").innerHTML = state.resorts.map((r) => `<option value="${esc(r.name)} (${esc(r.state)})">`).join("");
  renderMarkers();
  updateLegend();
  await loadFeed();
  renderMarkers(); // recolor "open now" pins once the feed is in
  updateLegend();
  window.__skiMap = { state, pin, hide, preview }; // for the smoke test
})();
