// Boot, scene, camera, game modes and the fixed-step loop.
import * as THREE from 'three';
import { buildPark } from './park.js';
import { Skater } from './skater.js';
import { Controller, DT } from './controller.js';
import { Scoring, fmt } from './scoring.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';

const RUN_SECONDS = 120;
const MAX_SUBSTEPS = 12;

class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      document.getElementById('webgl-fail').classList.remove('hidden');
      document.getElementById('menu').classList.add('hidden');
      throw err;
    }
    const params = new URLSearchParams(location.search);
    this.testMode = params.has('test');          // deterministic: frames render, advance() simulates
    const lowFx = this.testMode && !params.has('hq');
    this.renderer.setPixelRatio(lowFx ? 0.5 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !lowFx;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b7d9);
    this.scene.fog = new THREE.Fog(0x87b7d9, 60, 160);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    this.camMode = 0; // 0 follow, 1 high
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camDir = new THREE.Vector3(0, 0, -1);

    // Lights
    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6a6f55, 0.9));
    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;

    // World
    this.park = buildPark();
    this.scene.add(this.park.root);
    this.skater = new Skater();
    this.scene.add(this.skater.root);

    this.input = new Input(window);
    this.audio = new Audio();
    this.input.onAnyKey = () => this.audio.unlock();
    this.scoring = new Scoring();
    this.hud = new Hud();
    this.controller = new Controller({ park: this.park, scoring: this.scoring, input: this.input, audio: this.audio, onEvent: (k, d) => this.onEvent(k, d) });

    this.phase = 'MENU';   // MENU | PLAYING | PAUSED | END
    this.mode = 'run';
    this.timeLeft = RUN_SECONDS;
    this.accumulator = 0;
    this.lastT = performance.now();
    this.fps = { frames: 0, since: performance.now(), value: 0 };
    this.stepsRun = 0;

    this.scoring.on((ev, data) => {
      if (ev === 'bank' && data.total > 0) { this.audio.bank(); }
    });

    window.addEventListener('resize', () => this.resize());
    for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => this.start(b.dataset.mode));
    this.resize();
    this.hud.showMenu('start', { best: this.scoring.best });
    this.placeCameraInstant();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- modes
  start(mode) {
    this.mode = mode;
    this.prevBest = this.scoring.best;
    this.scoring.reset();
    this.controller.reset();
    this.timeLeft = RUN_SECONDS;
    this.phase = 'PLAYING';
    this.hud.showMenu(null);
    this.hud.showHud(true);
    this.placeCameraInstant();
    this.accumulator = 0;
    this.runStartedAt = performance.now();
  }
  pause() { if (this.phase === 'PLAYING') { this.phase = 'PAUSED'; this.hud.showMenu('pause'); } }
  resume() { if (this.phase === 'PAUSED') { this.phase = 'PLAYING'; this.hud.showMenu(null); this.lastT = performance.now(); } }
  endRun() {
    // Bank only if the skater is on the ground; an open air/grind/manual at the buzzer is lost.
    const c = this.controller;
    if (c.state === 'ROLL' || c.state === 'MANUAL') this.scoring.bank();
    this.scoring.finishRun();
    this.phase = 'END';
    this.audio.grindStop();
    this.hud.showMenu('end', {
      score: this.scoring.score, newBest: this.scoring.score > 0 && this.scoring.score > this.prevBest,
      bestCombo: this.scoring.bestCombo, longestCombo: this.scoring.longestCombo, bails: this.scoring.bails, best: this.scoring.best,
    });
  }
  toMenu() {
    this.phase = 'MENU';
    this.audio.grindStop();
    this.controller.reset();
    this.hud.showHud(false);
    this.hud.showMenu('start', { best: this.scoring.best });
  }

  onEvent(kind, data) {
    (this.eventLog ||= []).push({ kind, data, t: this.stepsRun * DT });
    if (this.eventLog.length > 200) this.eventLog.shift();
    if (kind === 'bail') this.hud.toast(data.reason + (data.lost ? `  −${fmt(data.lost)}` : ''));
    else if (kind === 'land' && data.banked > 0 && data.banked >= 1000) this.hud.toast(`+${fmt(data.banked)}`, true, 900);
  }

  // ---- keys that change phase. Called after input.beginStep() with the current edges.
  phaseKeys() {
    const i = this.input;
    if (this.phase === 'MENU') {
      if (i.pressed('one') || i.pressed('enter')) this.start('run');
      else if (i.pressed('two')) this.start('free');
    } else if (this.phase === 'PLAYING') {
      if (i.pressed('pause')) this.pause();
      else if (i.pressed('restart')) this.start(this.mode);
      else if (i.pressed('menu')) this.toMenu();
    } else if (this.phase === 'PAUSED') {
      if (i.pressed('pause') || i.pressed('enter')) this.resume();
      else if (i.pressed('restart')) this.start(this.mode);
      else if (i.pressed('menu')) this.toMenu();
    } else if (this.phase === 'END') {
      if (i.pressed('restart') || i.pressed('enter')) this.start(this.mode);
      else if (i.pressed('menu')) this.toMenu();
    }
    if (i.pressed('mute')) { const m = this.audio.toggleMute(); this.hud.toast(m ? 'MUTED' : 'SOUND ON', true, 800); }
    if (i.pressed('camera')) this.camMode = (this.camMode + 1) % 2;
  }

  // Run `seconds` of simulation now, independent of rendering (used by tests).
  advance(seconds) {
    let n = Math.round(seconds / DT);
    while (n-- > 0) {
      this.input.beginStep();
      if (this.phase !== 'PLAYING') { this.phaseKeys(); continue; }
      this.phaseKeys();
      if (this.phase !== 'PLAYING') continue;
      this.controller.step(DT, this.input);
      this.stepsRun++;
      if (this.mode === 'run') { this.timeLeft -= DT; if (this.timeLeft <= 0) { this.timeLeft = 0; this.endRun(); } }
    }
    this.accumulator = 0;
    const c = this.controller;
    c.fillPose(this.skater.pose); this.skater.place(c.pos, c.fwd, c.up); this.skater.update(0.1);
    this.hud.update({ scoring: this.scoring, controller: c, timeLeft: this.timeLeft, mode: this.mode });
  }

  // ---- loop
  frame(t) {
    requestAnimationFrame((t2) => this.frame(t2));
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);

    if (this.testMode) {
      // tests drive the simulation through advance(); frames only render
    } else if (this.phase !== 'PLAYING') {
      this.input.beginStep();
      this.phaseKeys();
      this.accumulator = 0;
    } else {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= DT && steps < MAX_SUBSTEPS && this.phase === 'PLAYING') {
        this.input.beginStep();            // edges are consumed by exactly one physics step
        if (steps === 0) { this.phaseKeys(); if (this.phase !== 'PLAYING') break; }
        this.controller.step(DT, this.input);
        this.accumulator -= DT; steps++; this.stepsRun++;
        if (this.mode === 'run') {
          this.timeLeft -= DT;
          if (this.timeLeft <= 0) { this.timeLeft = 0; this.endRun(); break; }
        }
      }
      if (steps === MAX_SUBSTEPS) this.accumulator = 0;
      this.audio.roll(this.controller.state === 'ROLL' || this.controller.state === 'MANUAL' ? Math.abs(this.controller.speed) : 0);
    }

    // Visuals
    const c = this.controller;
    c.fillPose(this.skater.pose);
    this.skater.place(c.pos, c.fwd, c.up);
    this.skater.update(dt);
    this.updateCamera(dt);
    this.sun.position.set(c.pos.x + 30, 50, c.pos.z + 20);
    this.sunTarget.position.copy(c.pos);
    this.hud.update({ scoring: this.scoring, controller: c, timeLeft: this.timeLeft, mode: this.mode });
    this.renderer.render(this.scene, this.camera);

    this.fps.frames++;
    if (t - this.fps.since > 1000) { this.fps.value = this.fps.frames * 1000 / (t - this.fps.since); this.fps.frames = 0; this.fps.since = t; }
  }

  updateCamera(dt) {
    const c = this.controller;
    const tmp = new THREE.Vector3();
    // Smoothed travel direction (horizontal). Spinning in the air doesn't whip the camera.
    let dir;
    if (c.state === 'AIR' || c.state === 'BAIL') { tmp.set(c.vel.x, 0, c.vel.z); dir = tmp.length() > 1 ? tmp.normalize() : null; }
    else { tmp.set(c.fwd.x, 0, c.fwd.z); if (tmp.length() > 0.1) { tmp.normalize(); if (c.speed < -0.5) tmp.negate(); dir = tmp; } else dir = null; }
    if (dir) this.camDir.lerp(dir, 1 - Math.exp(-3.5 * dt)).normalize();

    const dist = this.camMode === 0 ? 5 : 11, height = this.camMode === 0 ? 2.1 : 6;
    const want = new THREE.Vector3().copy(c.pos).addScaledVector(this.camDir, -dist);
    want.y = c.pos.y + height;
    // Keep the camera above whatever is under it
    c.ray.set(new THREE.Vector3(want.x, want.y + 20, want.z), new THREE.Vector3(0, -1, 0));
    c.ray.far = 60;
    const hits = c.ray.intersectObjects(this.park.colliders, false);
    if (hits.length) want.y = Math.max(want.y, hits[0].point.y + 0.9);
    want.y = Math.max(want.y, 0.6);
    this.camPos.lerp(want, 1 - Math.exp(-8 * dt));
    const look = new THREE.Vector3(c.pos.x, c.pos.y + 0.9, c.pos.z);
    this.camLook.lerp(look, 1 - Math.exp(-12 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
  placeCameraInstant() {
    const c = this.controller;
    this.camDir.set(c.fwd.x, 0, c.fwd.z).normalize();
    this.camPos.copy(c.pos).addScaledVector(this.camDir, -5); this.camPos.y = c.pos.y + 2.1;
    this.camLook.set(c.pos.x, c.pos.y + 0.9, c.pos.z);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
  }
}

const game = new Game();
// Debug / test handle
window.__skate = {
  game,
  get state() { return game.controller.state; },
  get pos() { const p = game.controller.pos; return { x: p.x, y: p.y, z: p.z }; },
  get speed() { return game.controller.speed; },
  get score() { return game.scoring.score; },
  get combo() { return { ...game.scoring.combo, total: game.scoring.comboTotal }; },
  get phase() { return game.phase; },
  get fps() { return game.fps.value; },
  get timeLeft() { return game.timeLeft; },
  key(code, down) { game.input.simulate(code, down); },
  advance(sec) { game.advance(sec); },
  get events() { return game.eventLog; },
  teleport(x, y, z, fx = 0, fz = -1) { const c = game.controller; c.pos.set(x, y, z); c.fwd.set(fx, 0, fz).normalize(); c.hf.copy(c.fwd); c.up.set(0, 1, 0); c.vel.set(0, 0, 0); c.speed = 0; c.state = 'ROLL'; c.vertAir = null; game.placeCameraInstant(); },
  setSpeed(v) { game.controller.speed = v; },
  setTime(t) { game.timeLeft = t; },
  lastEvent() { return game.controller.lastEvent; },
};
