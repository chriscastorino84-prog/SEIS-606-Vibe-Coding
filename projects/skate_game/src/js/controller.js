// Skater physics: a point with a scalar rolling speed, a forward vector and a surface-up vector,
// moved by a fixed-step state machine (ROLL / AIR / GRIND / MANUAL / BAIL). Ground contact is a
// raycast along the skater's own "down"; rails are line segments. See plan.md "Controller".
import * as THREE from 'three';
import { AirTricks, grindType, GRINDS, GRIND_RATE, MANUALS, MANUAL_RATE } from './tricks.js';

export const DT = 1 / 120;
const G = 18;                 // m/s², game gravity (same in the air and along slopes)
const PUSH = 7;               // m/s² while holding push
const VMAX_PUSH = 16;         // push stops helping above this
const VMAX = 26;              // absolute cap
const BRAKE = 9;
const ROLL_FRICTION = 0.3;    // m/s²
const DRAG = 0.012;           // × v² m/s²
const TURN_RATE = 2.9;        // rad/s at mid speed
const SPIN_RATE = 7.5;        // rad/s in the air (~430°/s: a 360 in 0.84 s, a charged ollie's hang time)
const OLLIE_MIN = 5.2, OLLIE_MAX = 7.8, OLLIE_CHARGE = 0.4;
const SNAP = 0.4;             // how far below the board a surface still counts as "under"
const PROBE_UP = 0.5;         // ray origin offset
const WALL_NORMAL_Y = 0.45;   // faces with |normal.y| below this are walls
const WALL_BAIL_SPEED = 7.5;
const BAIL_TIME = 1.4;
const RAIL_COOLDOWN = 0.25;
const MANUAL_REQUEST_WINDOW = 0.35;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion();

export class Controller {
  constructor({ park, scoring, input, audio, onEvent }) {
    this.park = park;
    this.scoring = scoring;
    this.input = input;
    this.audio = audio;
    this.onEvent = onEvent || (() => {});
    this.ray = new THREE.Raycaster();
    this.tricks = new AirTricks(scoring);
    this.reset();
  }

  reset() {
    const s = this.park.spawn;
    this.state = 'ROLL';
    this.pos = s.pos.clone();
    this.fwd = s.fwd.clone();
    this.up = WORLD_UP.clone();
    this.hf = s.fwd.clone();          // last valid horizontal forward (camera, landings)
    this.vel = new THREE.Vector3();   // used in AIR / BAIL
    this.speed = 0;                   // signed, along fwd, used in ROLL / MANUAL / GRIND
    this.groundN = WORLD_UP.clone();
    this.lastGround = this.pos.clone();
    this.charging = false; this.charge = 0;
    this.lean = 0; this.turnInput = 0;
    this.vertAir = null;              // { n, lipY, plane } while in a vert air
    this.landingPending = false;      // combo still open after a rail drop
    this.railCooldown = 0;
    this.grind = null;                // { rail, t, dir, len, type, entry, time }
    this.manual = null;               // { type, entry, time }
    this.balance = 0; this.drift = 1;
    this.bail = null;                 // { t, reason }
    this.manualRequest = null;        // { type, at }
    this.fakieTime = 0;
    this.pushAnim = 0;
    this.airTime = 0;
    this.lastEvent = null;
    this.tricks.reset();
  }

  // ---------- helpers
  cast(origin, dir, far) {
    this.ray.set(origin, dir);
    this.ray.far = far; this.ray.near = 0;
    const hits = this.ray.intersectObjects(this.park.colliders, false);
    return hits.length ? hits[0] : null;
  }
  // Ground probe for the current up vector. Returns {point, normal, distance} or null.
  probeGround(allowWorldDown = true) {
    v1.copy(this.pos).addScaledVector(this.up, PROBE_UP);
    v2.copy(this.up).negate();
    let hit = this.cast(v1, v2, PROBE_UP + SNAP);
    if (!hit && allowWorldDown && this.up.y > 0.5) {
      v1.set(this.pos.x, this.pos.y + PROBE_UP, this.pos.z);
      hit = this.cast(v1, v3.set(0, -1, 0), PROBE_UP + SNAP);
    }
    if (!hit) return null;
    return { point: hit.point, normal: hit.face.normal.clone(), distance: hit.distance };
  }
  horizontal(v, out) { out.set(v.x, 0, v.z); const l = out.length(); if (l > 1e-4) out.divideScalar(l); return l; }
  setEvent(kind, data) { this.lastEvent = { kind, data, at: performance.now() }; this.onEvent(kind, data); }

  // ---------- main step
  step(dt, input) {
    this.railCooldown = Math.max(0, this.railCooldown - dt);
    this.pushAnim = Math.max(0, this.pushAnim - dt);
    this.turnInput = input.axis();

    // Manual request detection (valid in ROLL and AIR; consumed on landing or immediately in ROLL)
    if (input.sequence('back', 'push')) this.manualRequest = { type: 'manual', at: performance.now() };
    else if (input.sequence('push', 'back')) this.manualRequest = { type: 'nosemanual', at: performance.now() };

    switch (this.state) {
      case 'ROLL': this.stepRoll(dt, input, false); break;
      case 'MANUAL': this.stepRoll(dt, input, true); break;
      case 'AIR': this.stepAir(dt, input); break;
      case 'GRIND': this.stepGrind(dt, input); break;
      case 'BAIL': this.stepBail(dt, input); break;
    }

    // Boundary clamp (walls also exist as colliders; this is the safety net)
    const W = 39.5, D = 29.5;
    if (Math.abs(this.pos.x) > W) { this.pos.x = Math.sign(this.pos.x) * W; this.vel.x = 0; }
    if (Math.abs(this.pos.z) > D) { this.pos.z = Math.sign(this.pos.z) * D; this.vel.z = 0; }
    if (this.pos.y < -3) { // fell through the world: never let that end a run
      const s = this.park.spawn;
      this.pos.copy(s.pos); this.fwd.copy(s.fwd); this.up.copy(WORLD_UP); this.vel.set(0, 0, 0); this.speed = 0;
      this.state = 'ROLL'; this.vertAir = null;
    }
    if (this.horizontal(this.fwd, v1) > 0.2) this.hf.copy(v1);
  }

  // ---------- ROLL (and MANUAL, which is ROLL plus balance)
  stepRoll(dt, input, manual) {
    const g = this.probeGround(true);
    if (!g) { this.leaveGround(); return; }
    // Surface alignment
    this.groundN.copy(g.normal);
    this.up.lerp(g.normal, 1 - Math.exp(-25 * dt)).normalize();
    this.pos.copy(g.point);
    this.lastGround.copy(g.point);
    // Keep fwd on the surface
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up));
    if (this.fwd.lengthSq() < 1e-4) { this.fwd.copy(this.hf).addScaledVector(this.up, -this.hf.dot(this.up)); }
    this.fwd.normalize();

    // Turning (needs speed; tighter at low speed)
    const sp = Math.abs(this.speed);
    const turnScale = THREE.MathUtils.clamp(sp / 3, 0, 1) * THREE.MathUtils.clamp(1 - sp / 28, 0.45, 1);
    const turn = -this.turnInput * TURN_RATE * turnScale * dt * (manual ? 0.5 : 1);
    if (turn !== 0) { q1.setFromAxisAngle(this.up, turn); this.fwd.applyQuaternion(q1).normalize(); }
    this.lean = THREE.MathUtils.lerp(this.lean, this.turnInput * THREE.MathUtils.clamp(sp / 8, 0, 1), 1 - Math.exp(-10 * dt));

    // Speed: slope gravity, push, brake, friction, drag
    this.speed += -G * this.fwd.y * dt;
    if (!manual && input.down('push') && this.speed < VMAX_PUSH) { this.speed += PUSH * dt; if (this.pushAnim <= 0) this.pushAnim = 0.4; }
    if (input.down('brake')) this.speed = THREE.MathUtils.damp(this.speed, 0, BRAKE, dt);
    if (input.down('back') && !manual && this.speed > 0 && !input.down('push')) this.speed = Math.max(0, this.speed - BRAKE * 0.6 * dt);
    const fr = (ROLL_FRICTION + DRAG * this.speed * this.speed) * dt;
    this.speed = Math.abs(this.speed) <= fr ? 0 : this.speed - Math.sign(this.speed) * fr;
    this.speed = THREE.MathUtils.clamp(this.speed, -VMAX, VMAX);

    // Fakie auto-turn on flat ground after rolling backwards for a bit
    if (this.speed < -1 && this.up.y > 0.85 && !manual) {
      this.fakieTime += dt;
      if (this.fakieTime > 0.45) { this.fwd.negate(); this.speed = -this.speed; this.fakieTime = 0; }
    } else this.fakieTime = 0;

    // Wall probe along travel direction
    if (sp > 0.5) {
      v1.copy(this.pos).addScaledVector(this.up, 0.3);
      v2.copy(this.fwd).multiplyScalar(Math.sign(this.speed));
      const hit = this.cast(v1, v2, 0.45 + sp * dt);
      if (hit && Math.abs(hit.face.normal.y) < WALL_NORMAL_Y) {
        if (sp > WALL_BAIL_SPEED) { this.startBail('WALL'); return; }
        this.speed = 0;
        this.pos.addScaledVector(hit.face.normal, 0.05);
      }
    }

    // Manual state handling
    if (manual) {
      const m = this.manual;
      m.time += dt;
      this.stepBalance(dt, 0.35 + 0.4 * m.time);
      if (Math.abs(this.balance) >= 1) { this.startBail('LOST BALANCE'); return; }
      this.scoring.grow(m.entry, MANUAL_RATE * dt);
      if (Math.abs(this.speed) < 1.2 || input.down('brake') || this.up.y < 0.75) { this.endManual(true); }
    } else if (this.manualRequest && (performance.now() - this.manualRequest.at) / 1000 < MANUAL_REQUEST_WINDOW && Math.abs(this.speed) > 2) {
      this.startManual(this.manualRequest.type);
      this.manualRequest = null;
    }

    // Ollie: hold to charge, release to pop
    if (input.pressed('ollie')) { this.charging = true; this.charge = 0; }
    if (this.charging) {
      this.charge = Math.min(OLLIE_CHARGE, this.charge + dt);
      if (!input.down('ollie')) {
        this.charging = false; this.ollie(this.charge / OLLIE_CHARGE);
        this.tricks.step(0, input);   // a flip/grab pressed in the same step as the pop still counts
        return;
      }
    }

    // Integrate
    this.pos.addScaledVector(this.fwd, this.speed * dt);
    this.airTime = 0;
  }

  stepBalance(dt, driftRate) {
    this.balance += this.drift * driftRate * dt + this.turnInput * 2.4 * dt;
    // the drift flips sides occasionally so it can't be held with one key
    if (Math.random() < 0.6 * dt) this.drift = -this.drift;
  }

  leaveGround() {
    // Rolled off an edge or over a lip: carry the rolling velocity into the air.
    this.vel.copy(this.fwd).multiplyScalar(this.speed);
    const vert = this.groundN.y < 0.3;
    if (vert) {
      this.vertAir = { n: this.groundN.clone(), anchor: this.pos.clone() };
    } else this.vertAir = null;
    if (this.state === 'MANUAL') this.endManual(false);
    this.enterAir(false);
  }

  ollie(charge) {
    const v = OLLIE_MIN + (OLLIE_MAX - OLLIE_MIN) * charge;
    v1.copy(this.up).add(v2.set(0, 1.2, 0)).normalize();
    this.vel.copy(this.fwd).multiplyScalar(this.speed).addScaledVector(v1, v);
    const vert = this.groundN.y < 0.3;
    this.vertAir = vert ? { n: this.groundN.clone(), anchor: this.pos.clone() } : null;
    if (this.state === 'MANUAL') this.endManual(false);
    this.audio?.pop(charge);
    this.enterAir(true);
  }

  enterAir(fromOllie) {
    this.state = 'AIR';
    this.airTime = 0;
    this.tricks.reset();
    this.charging = false;
    this.lean = 0;
    if (!this.vertAir) {
      // forward becomes the horizontal heading; up eases to world up
      if (this.horizontal(this.fwd, v1) > 0.05) this.hf.copy(v1);
      this.fwd.copy(this.hf);
    } else {
      // vert air: keep standing on the wall; forward points up the wall
      this.fwd.copy(WORLD_UP);
      this.up.copy(this.vertAir.n);
    }
    this.setEvent(fromOllie ? 'ollie' : 'launch');
  }

  // ---------- AIR
  stepAir(dt, input) {
    this.airTime += dt;
    this.tricks.step(dt, input);
    // Spin about the skater's up (world up normally, wall normal in vert air)
    const spinAxis = this.vertAir ? this.vertAir.n : WORLD_UP;
    const spin = -this.turnInput * SPIN_RATE * dt;
    if (spin !== 0) {
      q1.setFromAxisAngle(spinAxis, spin);
      this.fwd.applyQuaternion(q1).normalize();
      this.tricks.spinDeg += THREE.MathUtils.radToDeg(spin);
    }
    if (!this.vertAir) this.up.lerp(WORLD_UP, 1 - Math.exp(-7 * dt)).normalize();

    // Gravity + integrate
    this.vel.y -= G * dt;
    if (this.vertAir) this.vel.addScaledVector(this.vertAir.n, -2.5 * dt);   // gentle pull back to the wall
    this.pos.addScaledVector(this.vel, dt);

    // Vert air: treat the wall as a plane. Below the lip (where a ray back into the wall still hits
    // something) never pass through it, and touch down on it when descending close to it.
    if (this.vertAir) {
      const va = this.vertAir;
      v1.copy(this.pos).sub(va.anchor);
      const d = v1.dot(va.n);                     // signed distance out from the wall plane
      // The wall plane extends upward past the lip: you can't drift over the deck mid-air.
      if (d < 0.02) { this.pos.addScaledVector(va.n, 0.02 - d); const into = this.vel.dot(va.n); if (into < 0) this.vel.addScaledVector(va.n, -into); }
      if (this.vel.y < 0 && d < 0.35) {
        v2.copy(this.pos).addScaledVector(va.n, 0.3);
        const wallHere = this.cast(v2, v3.copy(va.n).negate(), 0.6 + Math.max(0, d));
        if (wallHere && Math.abs(wallHere.face.normal.y) < 0.3) {
          const g = this.probeGround(false);
          if (g) { this.land(g, input); return; }
        }
      }
      if (d > 2.5 || this.pos.y < 0.6) this.vertAir = null;   // flew out of the pipe: normal air
    }

    // Rail capture
    // (not during a vert air: coming back down the wall past the coping is a landing, not a grind)
    if (this.railCooldown <= 0 && this.vel.y < 3 && !this.vertAir) { const r = this.findRail(); if (r) { this.startGrind(r, input); return; } }

    // Walls in flight
    const hs = this.horizontal(this.vel, v2);
    if (this.vel.lengthSq() > 1) {
      v1.copy(this.pos).add(v3.set(0, 0.3, 0));
      v2.copy(this.vel).normalize();
      const hit = this.cast(v1, v2, this.vel.length() * dt + 0.35);
      if (hit && Math.abs(hit.face.normal.y) < WALL_NORMAL_Y && !(this.vertAir && hit.face.normal.dot(this.vertAir.n) > 0.9)) {
        if (hs > WALL_BAIL_SPEED) { this.startBail('WALL'); return; }
        const into = this.vel.dot(hit.face.normal);
        if (into < 0) this.vel.addScaledVector(hit.face.normal, -into);
        this.pos.copy(hit.point).addScaledVector(hit.face.normal, 0.3).y -= 0.3;
      }
    }

    // Ground landing (world down)
    if (this.vel.y <= 0.5 && this.airTime > 0.04) {
      const prevUp = v3.copy(this.up);
      this.up.copy(WORLD_UP);
      const g = this.probeGround(true);
      this.up.copy(prevUp);
      if (g && this.vel.dot(g.normal) <= 0) { this.land(g, input); return; }
    }
  }

  land(g, input) {
    const n = g.normal;
    // Tangential velocity and forward on the landing surface
    const vt = v1.copy(this.vel).addScaledVector(n, -this.vel.dot(n));
    const vtLen = vt.length();
    const fwdP = v2.copy(this.fwd).addScaledVector(n, -this.fwd.dot(n));
    if (fwdP.lengthSq() < 0.09) { if (vtLen > 0.5) fwdP.copy(vt).normalize(); else fwdP.copy(this.hf).addScaledVector(n, -this.hf.dot(n)); }
    fwdP.normalize();
    let speed = vt.dot(fwdP);
    const lateral = Math.sqrt(Math.max(0, vtLen * vtLen - speed * speed));
    const result = this.tricks.resolveLanding();
    this.pos.copy(g.point);
    this.up.copy(n); this.groundN.copy(n);
    this.vertAir = null;
    if (!result.ok) { this.fwd.copy(fwdP); this.speed = speed; this.startBail(result.reason); return; }
    if (vtLen > 2 && lateral > 0.6 * vtLen) { this.fwd.copy(fwdP); this.speed = speed; this.startBail('LANDED SIDEWAYS'); return; }
    // Snap heading to the travel line
    if (vtLen > 1) { fwdP.copy(vt).normalize(); if (speed < 0) fwdP.negate(); speed = Math.sign(speed || 1) * vtLen; }
    this.fwd.copy(fwdP); this.speed = speed;
    this.audio?.land(Math.min(1, Math.abs(this.vel.y) / 10));
    this.vel.set(0, 0, 0);
    this.landingPending = false;
    this.airTime = 0;
    // Manual into the landing?
    const mr = this.manualRequest;
    if (mr && (performance.now() - mr.at) / 1000 < MANUAL_REQUEST_WINDOW && Math.abs(this.speed) > 2 && n.y > 0.75) {
      this.manualRequest = null;
      this.state = 'ROLL';
      this.startManual(mr.type);
      this.setEvent('land', { banked: 0, spin: result.spin, intoManual: true });
      return;
    }
    this.state = 'ROLL';
    const banked = this.scoring.bank();
    this.setEvent('land', { banked, spin: result.spin });
  }

  // ---------- GRIND
  findRail() {
    let best = null;
    for (const rail of this.park.rails) {
      const ab = v1.subVectors(rail.b, rail.a);
      const len = ab.length(); ab.divideScalar(len);
      const ap = v2.subVectors(this.pos, rail.a);
      const t = THREE.MathUtils.clamp(ap.dot(ab), 0, len) / len;
      if (t < 0.03 || t > 0.97) continue;
      const p = v3.copy(rail.a).addScaledVector(ab, t * len);
      const dx = this.pos.x - p.x, dz = this.pos.z - p.z, dy = this.pos.y - p.y;
      const hd = Math.sqrt(dx * dx + dz * dz);
      if (hd < rail.capture && dy > -0.15 && dy < 0.5) {
        if (!best || hd < best.hd) best = { rail, t, len, hd, dir: ab.clone() };
      }
    }
    return best;
  }

  startGrind(r, input) {
    const { rail, t, len, dir } = r;
    const hv = this.horizontal(this.vel, v1);
    let sgn = Math.sign(v1.dot(dir)) || 1;
    const railDir = dir.clone();
    const speed = Math.max(2.5, Math.max(hv, Math.abs(this.speed)));
    // Grind type from the angle between heading and rail
    const hfLen = this.horizontal(this.fwd, v2);
    const cos = hfLen > 0.1 ? Math.abs(v2.dot(railDir)) : 1;
    const angle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cos, -1, 1)));
    const type = grindType(angle, input);
    const entry = this.scoring.add(GRINDS[type].name, GRINDS[type].base);
    this.grind = { rail, t, dir: sgn, railDir, len, type, entry, time: 0, speed };
    this.balance = 0; this.drift = Math.random() < 0.5 ? -1 : 1;
    this.state = 'GRIND';
    this.vertAir = null;
    this.up.copy(WORLD_UP);
    if (type === 'boardslide') {
      // face across the rail, board turned along it
      this.fwd.copy(v2).addScaledVector(railDir, -v2.dot(railDir));
      if (this.fwd.lengthSq() < 0.01) this.fwd.crossVectors(WORLD_UP, railDir);
      this.fwd.normalize();
    } else {
      this.fwd.copy(railDir).multiplyScalar(sgn);
    }
    this.tricks.reset();
    this.audio?.grindStart();
    this.setEvent('grind', { type, rail: rail.name });
  }

  stepGrind(dt, input) {
    const gr = this.grind;
    gr.time += dt;
    gr.speed += -G * gr.railDir.y * gr.dir * dt * 0.6 - 0.5 * dt;
    gr.speed = Math.max(2.5, Math.min(VMAX, gr.speed));
    gr.t += gr.dir * gr.speed * dt / gr.len;
    this.pos.copy(gr.rail.a).addScaledVector(gr.railDir, gr.t * gr.len);
    this.pos.y += gr.rail.radius + 0.02;
    this.up.lerp(WORLD_UP, 1 - Math.exp(-20 * dt)).normalize();
    this.stepBalance(dt, 0.3 + 0.35 * gr.time);
    this.scoring.grow(gr.entry, GRIND_RATE * dt);
    this.speed = gr.speed;
    if (Math.abs(this.balance) >= 1) { this.endGrind(); this.startBail('LOST BALANCE'); return; }
    if (input.pressed('ollie')) {
      this.vel.copy(gr.railDir).multiplyScalar(gr.dir * gr.speed);
      this.vel.y += 5.2;
      this.endGrind();
      this.railCooldown = RAIL_COOLDOWN;
      this.audio?.pop(0.5);
      this.enterAir(true);
      this.tricks.step(0, input);
      this.landingPending = true;
      return;
    }
    if (gr.t <= 0 || gr.t >= 1) {
      this.vel.copy(gr.railDir).multiplyScalar(gr.dir * gr.speed);
      this.vel.y += 0.5;
      this.endGrind();
      this.railCooldown = RAIL_COOLDOWN;
      this.enterAir(false);
      this.landingPending = true;
    }
  }

  endGrind() {
    this.audio?.grindStop();
    // for the heading after a boardslide, travel direction wins
    if (this.grind && this.grind.type === 'boardslide') this.fwd.copy(this.grind.railDir).multiplyScalar(this.grind.dir);
    this.grind = null;
    this.balance = 0;
  }

  // ---------- MANUAL
  startManual(type) {
    const entry = this.scoring.add(MANUALS[type].name, MANUALS[type].base);
    this.manual = { type, entry, time: 0 };
    this.balance = 0; this.drift = Math.random() < 0.5 ? -1 : 1;
    this.state = 'MANUAL';
    this.setEvent('manual', { type });
  }
  endManual(bankIt) {
    this.manual = null;
    this.balance = 0;
    this.state = 'ROLL';
    if (bankIt) { const banked = this.scoring.bank(); this.setEvent('land', { banked, spin: 0 }); }
  }

  // ---------- BAIL
  startBail(reason) {
    if (this.state === 'GRIND') this.endGrind();
    if (this.state === 'MANUAL') { this.manual = null; this.balance = 0; }
    const lost = this.scoring.bust(reason);
    this.state = 'BAIL';
    this.bail = { t: 0, reason };
    if (this.vel.lengthSq() < 0.01) this.vel.copy(this.fwd).multiplyScalar(this.speed);
    this.vel.y = Math.max(this.vel.y, 0);
    this.speed = 0;
    this.charging = false;
    this.vertAir = null;
    this.tricks.reset();
    this.manualRequest = null;
    this.audio?.bail();
    this.setEvent('bail', { reason, lost });
  }
  stepBail(dt) {
    const b = this.bail;
    b.t += dt;
    // slide to a stop, falling if there's nothing underneath
    this.vel.y -= G * dt;
    this.pos.addScaledVector(this.vel, dt);
    const prevUp = v3.copy(this.up); this.up.copy(WORLD_UP);
    const g = this.probeGround(true);
    this.up.copy(prevUp);
    if (g) {
      this.pos.copy(g.point);
      this.vel.y = 0;
      this.vel.multiplyScalar(Math.max(0, 1 - 4 * dt));
      this.up.lerp(g.normal, 1 - Math.exp(-15 * dt)).normalize();
      this.lastGround.copy(g.point);
    }
    if (b.t >= BAIL_TIME) {
      this.state = 'ROLL';
      this.bail = null;
      this.vel.set(0, 0, 0); this.speed = 0;
      if (this.horizontal(this.fwd, v1) > 0.05) this.fwd.copy(v1); else this.fwd.copy(this.hf);
      this.setEvent('recover');
    }
  }

  // ---------- pose for the skater model
  fillPose(pose) {
    pose.crouch = this.charging ? this.charge / OLLIE_CHARGE : (this.state === 'AIR' && !this.tricks.grab ? 0.35 : 0);
    pose.lean = this.state === 'ROLL' || this.state === 'MANUAL' ? this.lean : 0;
    pose.grab = this.state === 'AIR' ? this.tricks.grab : null;
    pose.flip = this.state === 'AIR' && this.tricks.flip && this.tricks.flipT < 1 ? this.tricks.flip : null;
    pose.flipT = this.tricks.flipT;
    pose.slide = this.state === 'GRIND' && this.grind.type === 'boardslide' ? 1 : 0;
    pose.manual = this.state === 'MANUAL' ? (this.manual.type === 'manual' ? 1 : -1)
      : this.state === 'GRIND' ? (this.grind.type === '5-0' ? 1 : this.grind.type === 'nosegrind' ? -1 : 0) : 0;
    pose.balance = (this.state === 'GRIND' || this.state === 'MANUAL') ? this.balance : 0;
    pose.bail = this.state === 'BAIL' ? Math.min(1, this.bail.t * 4) : 0;
    pose.push = this.pushAnim > 0 ? 1 : 0;
  }
}
