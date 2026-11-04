// Trick table + the air-trick state (flips, grabs, spin) and landing validation.

export const FLIPS = {
  kickflip: { name: 'Kickflip', base: 150, duration: 0.45 },
  heelflip: { name: 'Heelflip', base: 150, duration: 0.45 },
  shoveit:  { name: 'Pop Shove-it', base: 120, duration: 0.40 },
  treflip:  { name: '360 Flip', base: 350, duration: 0.60 },
};
export const GRABS = {
  indy:     { name: 'Indy', base: 60 },
  melon:    { name: 'Melon', base: 60 },
  nosegrab: { name: 'Nosegrab', base: 60 },
  tailgrab: { name: 'Tailgrab', base: 60 },
};
export const GRAB_RATE = 250;   // points per second held
export const GRINDS = {
  '50-50':     { name: '50-50', base: 100 },
  boardslide:  { name: 'Boardslide', base: 120 },
  '5-0':       { name: '5-0', base: 140 },
  nosegrind:   { name: 'Nosegrind', base: 140 },
};
export const GRIND_RATE = 150;  // points per second
export const MANUALS = {
  manual:     { name: 'Manual', base: 50 },
  nosemanual: { name: 'Nose Manual', base: 50 },
};
export const MANUAL_RATE = 100;
export const SPIN_POINTS = { 180: 100, 360: 250, 540: 450, 720: 700, 900: 1000, 1080: 1400 };
export const SPIN_TOLERANCE_DEG = 35;
export const FLIP_DONE_FRACTION = 0.85;

// Air trick state machine. Owned by the controller; reset on takeoff.
export class AirTricks {
  constructor(scoring) {
    this.scoring = scoring;
    this.reset();
  }
  reset() {
    this.flip = null;         // key of current flip
    this.flipT = 0;           // 0..1 progress
    this.flipQueue = null;
    this.grab = null;         // key of current grab
    this.grabEntry = null;
    this.spinDeg = 0;         // accumulated signed yaw in degrees
    this.count = 0;           // tricks started this air
    this.airTime = 0;
  }
  get flipDone() { return !this.flip || this.flipT >= FLIP_DONE_FRACTION; }

  startFlip(key) {
    if (!FLIPS[key]) return false;
    if (this.flip && this.flipT < 1) { if (!this.flipQueue) this.flipQueue = key; return false; }
    this.flip = key; this.flipT = 0; this.count++;
    this.scoring.add(FLIPS[key].name, FLIPS[key].base);
    return true;
  }
  startGrab(key) {
    if (!GRABS[key] || this.grab === key) return false;
    this.grab = key; this.count++;
    this.grabEntry = this.scoring.add(GRABS[key].name, GRABS[key].base);
    return true;
  }
  endGrab() { this.grab = null; this.grabEntry = null; }

  step(dt, input) {
    this.airTime += dt;
    if (this.flip) {
      this.flipT += dt / FLIPS[this.flip].duration;
      if (this.flipT >= 1) {
        this.flipT = 1;
        if (this.flipQueue) { const q = this.flipQueue; this.flipQueue = null; this.flip = null; this.startFlip(q); }
      }
    }
    if (this.grab) {
      if (!input.down(this.grab)) this.endGrab();
      else this.scoring.grow(this.grabEntry, GRAB_RATE * dt);
    }
    for (const k of Object.keys(FLIPS)) if (input.pressed(k)) this.startFlip(k);
    for (const k of Object.keys(GRABS)) if (input.pressed(k)) this.startGrab(k);
  }

  // Called on touchdown. Returns { ok, reason, spin, fakie } and records the spin bonus.
  resolveLanding() {
    const spin = Math.abs(this.spinDeg);
    const nearest = Math.round(spin / 180) * 180;
    const off = Math.abs(spin - nearest);
    if (!this.flipDone) return { ok: false, reason: 'LANDED MID-FLIP', spin: nearest };
    if (off > SPIN_TOLERANCE_DEG) return { ok: false, reason: 'OVER-ROTATED', spin: nearest };
    if (nearest >= 180) {
      const pts = SPIN_POINTS[Math.min(nearest, 1080)] || 1400 + (nearest - 1080) * 2;
      const label = `${nearest}°`;
      if (this.count === 0) this.scoring.add(`${nearest} Ollie`, pts);
      else this.scoring.bonus(label, pts);
    }
    // Snap the finished flip and release grabs
    if (this.flip) this.flipT = 1;
    const fakie = (nearest / 180) % 2 === 1;
    return { ok: true, spin: nearest, fakie };
  }
}

// Which grind, given the angle between heading and rail (degrees, 0..180) and held keys.
export function grindType(angleDeg, input) {
  const a = Math.min(angleDeg, 180 - angleDeg); // 0 = parallel, 90 = perpendicular
  if (a >= 55) return 'boardslide';
  if (input.down('push')) return 'nosegrind';
  if (input.down('back')) return '5-0';
  return '50-50';
}
