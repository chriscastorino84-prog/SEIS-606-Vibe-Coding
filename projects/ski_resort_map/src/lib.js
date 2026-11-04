// Pure functions for the US Ski Resort Map. No DOM, no fetch — unit-tested in tests/lib.test.mjs.

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Offset (ms) of `tz` from UTC at instant `utcMs`. */
function tzOffsetMs(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - utcMs;
}

/** UTC ms for local wall-clock `dateISO` + `hhmm` in IANA zone `tz` (DST-correct). */
export function zonedInstant(dateISO, hhmm, tz) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz); // second pass settles DST boundaries
  return t;
}

/** Split a non-negative ms duration into d/h/m/s. */
export function countdownParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const normStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v.startsWith("open")) return "open";
  if (v.includes("hold")) return "hold";
  if (v.includes("sched") || v.includes("expected") || v.includes("delayed")) return "scheduled";
  if (v.includes("closed")) return "closed";
  return "unknown";
};

/**
 * Summarize one resort entry from latest-lifts.json.
 * Returns null when there is nothing usable.
 */
export function summarizeFeed(entry, nowMs) {
  if (!entry || !Array.isArray(entry.lifts) || entry.lifts.length === 0) return null;
  const lifts = entry.lifts.map((l) => ({ name: l.name || "Lift", status: normStatus(l.status), type: l.type || null }));
  const counts = { open: 0, hold: 0, scheduled: 0, closed: 0, unknown: 0 };
  for (const l of lifts) counts[l.status]++;
  const stamps = [entry.generated, ...entry.lifts.map((l) => l.lastUpdated)].filter(Boolean).map((x) => Date.parse(x)).filter((x) => !isNaN(x));
  const asOf = stamps.length ? Math.max(...stamps) : entry.date ? Date.parse(entry.date + "T12:00:00Z") : null;
  const stale = asOf == null || nowMs - asOf > STALE_AFTER_MS;
  return { lifts, counts, total: lifts.length, asOf, stale, date: entry.date || null };
}

/**
 * Tolerant terrain summary from a /{resort}/terrain/{date}.json file (Vail format today).
 * Counts trails under GroomingAreas[].Trails[]; returns null if no trails are found.
 */
export function summarizeTerrain(json) {
  const areas = json && Array.isArray(json.GroomingAreas) ? json.GroomingAreas : [];
  let total = 0, open = 0;
  for (const a of areas) {
    for (const t of Array.isArray(a.Trails) ? a.Trails : []) {
      total++;
      if (t.IsOpen === true || t.isOpen === true || /^open/i.test(String(t.Status ?? t.status ?? ""))) open++;
    }
  }
  return total ? { open, total } : null;
}

/**
 * Headline status for a resort.
 *  kind: "open" | "countdown" | "past-date" | "not-posted"
 */
export function statusFor(resort, feedSummary, nowMs) {
  if (feedSummary && !feedSummary.stale && feedSummary.counts.open > 0) return { kind: "open" };
  const o = resort.opening;
  if (o && o.date) {
    const at = zonedInstant(o.date, "09:00", resort.tz);
    if (at > nowMs) return { kind: "countdown", at, date: o.date, note: o.note, source: o.source };
    return { kind: "past-date", date: o.date, note: o.note, source: o.source };
  }
  return { kind: "not-posted", note: o?.note || null, source: o?.source || null };
}

/** "Nov 6, 2026" in the resort's zone. */
export function fmtDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "3:42 PM" or "May 16, 2026" depending on age. */
export function fmtAsOf(ms, nowMs) {
  const d = new Date(ms);
  return nowMs - ms < STALE_AFTER_MS
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
