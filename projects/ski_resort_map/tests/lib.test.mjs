import test from "node:test";
import assert from "node:assert/strict";
import { zonedInstant, countdownParts, summarizeFeed, summarizeTerrain, statusFor, STALE_AFTER_MS } from "../src/lib.js";

test("zonedInstant: 09:00 Denver on 2026-11-06 is 16:00Z (MST, after DST ended Nov 1)", () => {
  assert.equal(new Date(zonedInstant("2026-11-06", "09:00", "America/Denver")).toISOString(), "2026-11-06T16:00:00.000Z");
});
test("zonedInstant: 09:00 Denver on 2026-10-30 is 15:00Z (still MDT)", () => {
  assert.equal(new Date(zonedInstant("2026-10-30", "09:00", "America/Denver")).toISOString(), "2026-10-30T15:00:00.000Z");
});
test("zonedInstant: Phoenix has no DST", () => {
  assert.equal(new Date(zonedInstant("2026-11-20", "09:00", "America/Phoenix")).toISOString(), "2026-11-20T16:00:00.000Z");
});
test("zonedInstant: Anchorage", () => {
  assert.equal(new Date(zonedInstant("2026-11-28", "09:00", "America/Anchorage")).toISOString(), "2026-11-28T18:00:00.000Z");
});

test("countdownParts", () => {
  assert.deepEqual(countdownParts(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000), { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.deepEqual(countdownParts(-5), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

const now = Date.parse("2026-11-04T22:00:00Z");
const entry = (generated, statuses) => ({
  name: "X", date: generated.slice(0, 10), generated,
  lifts: statuses.map((s, i) => ({ name: "L" + i, status: s, lastUpdated: generated })),
});

test("summarizeFeed: counts and freshness", () => {
  const s = summarizeFeed(entry("2026-11-04T21:00:00Z", ["Open", "Closed", "On Hold", "Scheduled", "Closed for Season"]), now);
  assert.deepEqual(s.counts, { open: 1, hold: 1, scheduled: 1, closed: 2, unknown: 0 });
  assert.equal(s.total, 5);
  assert.equal(s.stale, false);
});
test("summarizeFeed: >24h old is stale", () => {
  const s = summarizeFeed(entry("2026-05-16T16:52:11Z", ["Open"]), now);
  assert.equal(s.stale, true);
});
test("summarizeFeed: empty → null", () => {
  assert.equal(summarizeFeed({ lifts: [] }, now), null);
  assert.equal(summarizeFeed(undefined, now), null);
});

test("summarizeTerrain", () => {
  assert.equal(summarizeTerrain({ GroomingAreas: [{ Trails: [] }] }), null);
  assert.deepEqual(
    summarizeTerrain({ GroomingAreas: [{ Trails: [{ IsOpen: true }, { IsOpen: false }] }, { Trails: [{ Status: "Open" }] }] }),
    { open: 2, total: 3 }
  );
});

const resort = (opening) => ({ tz: "America/Denver", opening });
test("statusFor precedence", () => {
  const fresh = summarizeFeed(entry("2026-11-04T21:00:00Z", ["Open"]), now);
  const staleOpen = summarizeFeed(entry("2026-05-16T16:00:00Z", ["Open"]), now);
  assert.equal(statusFor(resort({ date: "2026-11-06" }), fresh, now).kind, "open");
  assert.equal(statusFor(resort({ date: "2026-11-06" }), staleOpen, now).kind, "countdown"); // stale never counts as open
  assert.equal(statusFor(resort({ date: "2026-11-01" }), null, now).kind, "past-date");
  assert.equal(statusFor(resort(null), null, now).kind, "not-posted");
  assert.equal(statusFor(resort({ date: null, note: "ASAP" }), null, now).note, "ASAP");
  assert.ok(STALE_AFTER_MS === 86400000);
});
