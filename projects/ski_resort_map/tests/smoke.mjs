// Playwright smoke test: serves src/ locally, loads the page, checks markers, hover preview, pin, Esc, countdown.
//   node projects/ski_resort_map/tests/smoke.mjs [--shots outdir]
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve playwright from a local install or a global one (NODE_PATH), since ESM ignores NODE_PATH.
const { chromium } = await import("playwright").catch(() => createRequire(import.meta.url)("playwright"));

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const p = join(SRC, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/ski_resort_map.html"));
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const ok = (m) => console.log("ok -", m);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: shots ? 2 : 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Network beyond localhost is blocked in CI sandboxes; stub tiles + feed so the test is deterministic.
  await page.route(/basemaps\.cartocdn\.com/, (r) => r.fulfill({ status: 204, body: "" }));
  await page.route(/ski-run-scraper\/data\/latest-lifts\.json/, (r) => r.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ breckenridge: { name: "Breckenridge", date: "2026-05-16", generated: "2026-05-16T16:52:04Z",
      lifts: [{ name: "Colorado SuperChair", status: "Closed", lastUpdated: "2026-05-16T16:52:04Z" }, { name: "Imperial Express", status: "Open", lastUpdated: "2026-05-16T16:52:04Z" }] } }),
  }));
  await page.route(/ski-run-scraper\/data\/.*\/terrain\//, (r) => r.fulfill({ status: 404, body: "" }));

  await page.goto(`${base}/ski_resort_map.html`);
  await page.waitForFunction(() => window.__skiMap && window.__skiMap.state.resorts.length > 0);
  const n = await page.evaluate(() => window.__skiMap.state.resorts.length);
  n >= 450 ? ok(`${n} resorts loaded`) : fail(`only ${n} resorts`);
  const total = await page.textContent('[data-count="total"]');
  total === String(n) ? ok(`legend total ${total}`) : fail(`legend total ${total} != ${n}`);
  if (shots) await page.screenshot({ path: `${shots}/01-map.png` });

  // Preview then pin Breckenridge
  await page.evaluate(() => window.__skiMap.preview("breckenridge-co"));
  (await page.getAttribute("#panel", "data-mode")) === "preview" ? ok("hover → preview") : fail("preview mode");
  await page.evaluate(() => window.__skiMap.pin("breckenridge-co"));
  (await page.getAttribute("#panel", "data-mode")) === "pinned" ? ok("click → pinned") : fail("pinned mode");
  const h2 = await page.textContent("#panel h2");
  h2 === "Breckenridge" ? ok("panel shows Breckenridge") : fail(`panel h2 = ${h2}`);
  const staleBadge = await page.$("#panel .badge.stale");
  staleBadge ? ok("stale feed labeled as not current") : fail("no stale badge on May feed data");
  const site = await page.getAttribute("#panel a.btn.primary", "href");
  site && site.includes("breckenridge.com") ? ok(`official site link ${site}`) : fail(`site link ${site}`);

  // Countdown (Breckenridge opens 2026-11-06 per data; only check if still in the future)
  const cd = await page.$("#panel .countdown");
  if (cd) {
    const a = await cd.textContent(); await page.waitForTimeout(1100); const b = await cd.textContent();
    a !== b ? ok("countdown ticks") : fail("countdown frozen");
  } else ok("no countdown (opening date passed or open) — skipped");
  if (shots) await page.screenshot({ path: `${shots}/02-panel.png` });

  // Static resort with no feed
  const staticId = await page.evaluate(() => window.__skiMap.state.resorts.find((r) => !r.feed_key && r.opening == null).id);
  await page.evaluate((id) => window.__skiMap.pin(id), staticId);
  (await page.textContent("#lift-section")).includes("No live data") ? ok("static resort says No live data") : fail("static resort lift text");

  await page.keyboard.press("Escape");
  (await page.isHidden("#panel")) ? ok("Esc closes panel") : fail("Esc did not close");

  // Real hover over a real marker element
  await page.evaluate(() => window.__skiMap.state.markers.get("breckenridge-co") && null);
  errors.length ? fail("page errors: " + errors.join(" | ")) : ok("no page errors");

  if (shots) {
    const m = await browser.newPage({ ...{ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
    await m.route(/basemaps\.cartocdn\.com/, (r) => r.fulfill({ status: 204, body: "" }));
    await m.route(/ski-run-scraper/, (r) => r.fulfill({ status: 404, body: "" }));
    await m.goto(`${base}/ski_resort_map.html`);
    await m.waitForFunction(() => window.__skiMap && window.__skiMap.state.resorts.length > 0);
    await m.evaluate(() => window.__skiMap.pin("jackson-hole-wy") || window.__skiMap.pin(window.__skiMap.state.resorts.find(r=>/Jackson Hole/.test(r.name)).id));
    await m.screenshot({ path: `${shots}/03-mobile.png` });
  }
} finally {
  await browser.close();
  server.close();
}
