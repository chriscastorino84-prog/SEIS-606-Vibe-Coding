// Combo accumulation, banking, busting, and the persisted best score.
const BEST_KEY = 'skate_game.best';

export class Scoring {
  constructor() {
    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    this.combo = this.emptyCombo();
    this.bestCombo = 0;
    this.longestCombo = 0;
    this.bails = 0;
    this.lastBank = null;     // { total, at }
    this.lastBust = null;     // { lost, at, reason }
    this.listeners = [];
  }
  emptyCombo() { return { entries: [], count: 0, base: 0, bonuses: [] }; }
  on(fn) { this.listeners.push(fn); }
  emit(ev, data) { for (const fn of this.listeners) fn(ev, data); }

  get comboOpen() { return this.combo.count > 0 || this.combo.bonuses.length > 0; }

  // A named trick worth `points`, increments the multiplier. Returns the entry so callers can grow it.
  add(name, points) {
    const e = { name, points: Math.round(points) };
    this.combo.entries.push(e);
    this.combo.count += 1;
    this.recompute();
    this.emit('trick', e);
    return e;
  }
  // Grow an existing entry (grabs and grinds accrue while held).
  grow(entry, delta) { entry.points += delta; this.recompute(); }
  // A bonus adds points and a label but not to the multiplier (spins).
  bonus(label, points) {
    this.combo.bonuses.push({ name: label, points });
    this.recompute();
    this.emit('bonus', { label, points });
  }
  recompute() {
    let base = 0;
    for (const e of this.combo.entries) base += e.points;
    for (const b of this.combo.bonuses) base += b.points;
    this.combo.base = Math.round(base);
  }
  get comboTotal() { return this.combo.base * Math.max(1, this.combo.count); }

  bank() {
    if (!this.comboOpen) return 0;
    const total = this.comboTotal;
    this.score += total;
    this.bestCombo = Math.max(this.bestCombo, total);
    this.longestCombo = Math.max(this.longestCombo, this.combo.count);
    this.lastBank = { total, at: performance.now(), entries: this.combo.entries.map(e => e.name) };
    const combo = this.combo;
    this.combo = this.emptyCombo();
    if (this.score > this.best) { this.best = this.score; this.persist(); }
    this.emit('bank', { total, combo });
    return total;
  }
  bust(reason) {
    this.bails += 1;
    const lost = this.comboOpen ? this.comboTotal : 0;
    this.lastBust = { lost, at: performance.now(), reason };
    this.combo = this.emptyCombo();
    this.emit('bust', { lost, reason });
    return lost;
  }
  persist() { try { localStorage.setItem(BEST_KEY, String(this.best)); } catch (_) { /* private mode */ } }
  finishRun() {
    if (this.score > this.best) { this.best = this.score; }
    this.persist();
  }
  reset() {
    this.score = 0; this.combo = this.emptyCombo(); this.bestCombo = 0; this.longestCombo = 0; this.bails = 0;
    this.lastBank = null; this.lastBust = null;
  }

  // HUD strings
  comboString() {
    const names = this.combo.entries.map(e => e.name);
    for (const b of this.combo.bonuses) names.push(b.name);
    return names.join(' + ');
  }
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');
