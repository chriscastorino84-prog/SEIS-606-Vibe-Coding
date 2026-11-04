// Playwright smoke test for the skate game. Drives the simulation deterministically through
// window.__skate (advance(seconds) runs fixed physics steps without waiting for frames).
//
//   python3 -m http.server 8765 --directory src &
//   node tests/smoke.mjs            # add SHOTS=1 to write screenshots to tests/shots/
//
// Needs Playwright with a Chromium. PLAYWRIGHT_PATH overrides the package location.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8765';
const SHOTS = !!process.env.SHOTS;
if (SHOTS) fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

let failed = 0, passed = 0;
const check = (name, ok, detail = '') => { if (ok) { passed++; console.log(`  ok   ${name}`); } else { failed++; console.log(`  FAIL ${name} ${detail}`); } };
const S = (fn, arg) => page.evaluate(fn, arg);
const key = (c, d) => S(([c, d]) => __skate.key(c, d), [c, d]);
const adv = (s) => S((s) => __skate.advance(s), s);
const st = () => S(() => ({ state: __skate.state, pos: __skate.pos, speed: __skate.speed, score: __skate.score, combo: __skate.combo, phase: __skate.phase, timeLeft: __skate.timeLeft }));
const tap = async (c, hold = 0.05) => { await key(c, true); await adv(hold); await key(c, false); };
const events = () => S(() => (__skate.game.eventLog || []).splice(0));
const tele = (x, y, z, fx, fz, speed) => S(([x, y, z, fx, fz, speed]) => { __skate.teleport(x, y, z, fx, fz); __skate.setSpeed(speed); }, [x, y, z, fx, fz, speed]);
const shot = async (n) => { if (SHOTS) { await page.evaluate(() => __skate.game.frame(performance.now())); await page.screenshot({ path: new URL(`./shots/${n}.png`, import.meta.url).pathname }); } };
// hold the balance pin centred with A/D for `sec` seconds
const balanceFor = async (sec) => { for (let i = 0; i < sec / 0.05; i++) { const b = await S(() => __skate.game.controller.balance); await key('KeyA', b > 0.05); await key('KeyD', b < -0.05); await adv(0.05); } await key('KeyA', false); await key('KeyD', false); };

console.log('load');
await page.goto(`${BASE}/skate.html?test`);
await page.waitForFunction(() => window.__skate);
check('page loads without console errors', errors.length === 0, JSON.stringify(errors));
check('starts on the menu', (await st()).phase === 'MENU');
await shot('00_menu');

console.log('US5 modes');
await tap('Digit1');
check('1 starts a 2-minute run', (await st()).phase === 'PLAYING' && Math.abs((await st()).timeLeft - 120) < 0.5);
await tap('Escape');
check('Esc pauses', (await st()).phase === 'PAUSED');
const tl = (await st()).timeLeft; await adv(0.5);
check('timer frozen while paused', (await st()).timeLeft === tl);
await tap('Escape');
check('Esc resumes', (await st()).phase === 'PLAYING');

console.log('US1 roll');
await key('KeyW', true); await adv(2); await key('KeyW', false);
let s = await st();
check('push reaches > 10 m/s in 2 s', s.speed > 10, s.speed);
check('still on the ground', s.state === 'ROLL' && Math.abs(s.pos.y) < 0.05);
await adv(2); s = await st();
check('coasting slows down', s.speed < 11 && s.speed > 5 && s.state === 'ROLL', s.speed);
await tele(-7, 0, 10, 0, -1, 8); await key('KeyA', true); await adv(1); await key('KeyA', false); s = await st();
check('turning changes heading', Math.abs(s.pos.x + 7) > 1, JSON.stringify(s.pos));
await shot('01_rolling');
// kicker launch at (12, 9) approached travelling +Z
await tele(12, 0, 2, 0, 1, 13);
let maxY = 0, seenAir = false;
for (let i = 0; i < 40; i++) { await adv(0.05); s = await st(); maxY = Math.max(maxY, s.pos.y); if (s.state === 'AIR') seenAir = true; }
check('kicker launches the skater (max height > 1.5 m)', seenAir && maxY > 1.5, maxY);
check('…and lands rolling', s.state === 'ROLL', s.state);
// half-pipe vert air: ride up the west wall, come back down it
await tele(-26, 0, 0, -1, 0, 15);
maxY = 0; let landedOnWall = false, stuckOnDeck = false, backOnFlat = false;
for (let i = 0; i < 80; i++) { await adv(0.05); s = await st(); maxY = Math.max(maxY, s.pos.y); if (s.state === 'ROLL' && s.pos.y > 1 && s.pos.y < 4.1 && s.pos.x > -36.05 && s.pos.x < -35.5) landedOnWall = true; if (s.state === 'ROLL' && s.pos.x < -36.2) stuckOnDeck = true; if (landedOnWall && s.state === 'ROLL' && s.pos.y < 0.2 && s.pos.x > -33) backOnFlat = true; }
check('vert air above the lip (lip 4.2 m)', maxY > 4.4, maxY);
check('comes back down the transition, not onto the deck', landedOnWall && !stuckOnDeck, JSON.stringify(s));
check('rolls out of the pipe onto the flat', backOnFlat, JSON.stringify(s.pos));
await events();

console.log('US2 ollie + air tricks');
await tele(-7, 0, 12, 0, -1, 10); const score0 = (await st()).score;
await key('Space', true); await adv(0.3); await key('Space', false); await adv(0.03);
s = await st(); check('ollie leaves the ground', s.state === 'AIR', s.state);
await tap('KeyJ'); await adv(0.1); await tap('KeyU', 0.3); await shot('02_kickflip_indy');
await adv(1.2); s = await st(); let ev = await events();
const landEv = ev.find(e => e.kind === 'land');
check('kickflip + indy lands clean', s.state === 'ROLL' && !!landEv, JSON.stringify(ev));
check('…and banks (150 + 60 + grab time) × 2 ≥ 420', landEv && landEv.data.banked >= 420, landEv && landEv.data.banked);
check('score increased', s.score > score0);
// tap-ollie, flip too late → bail
await tele(-7, 0, 12, 0, -1, 10); await tap('Space', 0.05); await adv(0.4); await tap('KeyJ'); await adv(1); ev = await events();
check('flip pressed too late bails with LANDED MID-FLIP', ev.some(e => e.kind === 'bail' && e.data.reason === 'LANDED MID-FLIP'), JSON.stringify(ev));
await shot('03_bail'); await adv(1.5); s = await st();
check('recovers to ROLL after the bail', s.state === 'ROLL');
// 360 spin on a charged ollie: hold A for ~0.97 s (6.5 rad/s)
await tele(-7, 0, 12, 0, -1, 10); await key('Space', true); await adv(0.4); await key('Space', false);
await key('KeyA', true); await adv(0.84); await key('KeyA', false); await adv(1); ev = await events();
const spinLand = ev.find(e => e.kind === 'land');
check('held spin lands as a 360', spinLand && spinLand.data.spin === 360, JSON.stringify(ev));
check('…scored as a "360 Ollie" (250 pts)', spinLand && spinLand.data.banked === 250, spinLand && spinLand.data.banked);
// 90° spin → over-rotated bail
await tele(-7, 0, 12, 0, -1, 10); await key('Space', true); await adv(0.4); await key('Space', false);
await key('KeyA', true); await adv(0.25); await key('KeyA', false); await adv(1); ev = await events();
check('90° spin bails (OVER-ROTATED)', ev.some(e => e.kind === 'bail' && e.data.reason === 'OVER-ROTATED'), JSON.stringify(ev));
await adv(1.5);

console.log('US3 grinds');
// 50-50: flat rail z=-12, x∈[-4,4] at 0.45 m; approach travelling +X
await tele(-7, 0, -12, 1, 0, 5); await adv(0.1); await tap('Space', 0.12);
let grind = null; for (let i = 0; i < 15 && !grind; i++) { await adv(0.1); ev = await events(); grind = ev.find(e => e.kind === 'grind'); }
check('lands on the flat rail → 50-50', grind && grind.data.type === '50-50' && grind.data.rail === 'Flat Rail', JSON.stringify(grind));
await shot('04_5050');
await balanceFor(0.8); s = await st();
check('still grinding with balance held', s.state === 'GRIND', s.state + ' ' + JSON.stringify(await S(() => (__skate.game.eventLog || []).slice(-4))));
check('grind points accrue', s.combo.total > 150, s.combo.total);
await tap('Space'); await adv(0.05); s = await st();
check('ollie off the rail → AIR with combo open', s.state === 'AIR' && s.combo.total > 0, s.state);
await adv(1.5); ev = await events(); const grindLand = ev.find(e => e.kind === 'land');
check('landing after the grind banks the combo', grindLand && grindLand.data.banked > 150, JSON.stringify(ev));
// boardslide: approach the same rail perpendicular, travelling -Z
await tele(0, 0, -8, 0, -1, 7); await adv(0.1); await tap('Space', 0.12);
grind = null; for (let i = 0; i < 15 && !grind; i++) { await adv(0.1); ev = await events(); grind = ev.find(e => e.kind === 'grind'); }
check('perpendicular approach → boardslide', grind && grind.data.type === 'boardslide', JSON.stringify(grind));
await shot('05_boardslide');
// no balance input → eventually bails with LOST BALANCE (rail is long enough? 4 m at ~7 m/s = 0.6 s: may drop off first)
await adv(3); await events();
// 5-0: hold S while landing parallel
await tele(-7, 0, -12, 1, 0, 8); await adv(0.1); await key('KeyS', true); await tap('Space', 0.12);
grind = null; for (let i = 0; i < 15 && !grind; i++) { await adv(0.1); ev = await events(); grind = ev.find(e => e.kind === 'grind'); }
await key('KeyS', false);
check('holding back while landing → 5-0', grind && grind.data.type === '5-0', JSON.stringify(grind));
await adv(3); await events();
// lost balance: grind the long handrail-free box rail with no corrections and D held → bail
await tele(-7, 0, -12, 1, 0, 6); await adv(0.1); await tap('Space', 0.12);
grind = null; for (let i = 0; i < 15 && !grind; i++) { await adv(0.1); ev = await events(); grind = ev.find(e => e.kind === 'grind'); }
await key('KeyD', true); await adv(1.2); await key('KeyD', false); ev = await events();
check('leaning hard on a grind → LOST BALANCE bail', ev.some(e => e.kind === 'bail' && e.data.reason === 'LOST BALANCE'), JSON.stringify(ev));
await adv(1.6);

console.log('US4 manuals + combo chain');
await tele(-20, 0, 20, 0, -1, 9); await adv(0.1);
await tap('KeyS', 0.04); await tap('KeyW', 0.04); await adv(0.02); s = await st();
check('S then W → MANUAL', s.state === 'MANUAL', s.state);
await balanceFor(1); s = await st();
check('manual held 1 s with corrections, points accrue', s.state === 'MANUAL' && s.combo.total > 100, JSON.stringify(s.combo));
await shot('06_manual');
await key('ShiftLeft', true); await adv(0.1); await key('ShiftLeft', false); ev = await events();
check('brake ends the manual and banks', ev.some(e => e.kind === 'land' && e.data.banked > 100), JSON.stringify(ev));
// nose manual
await tele(-20, 0, 20, 0, -1, 9); await adv(0.1); await tap('KeyW', 0.04); await tap('KeyS', 0.04); await adv(0.02); s = await st();
check('W then S → nose manual', s.state === 'MANUAL' && (await S(() => __skate.game.controller.manual.type)) === 'nosemanual');
await key('ShiftLeft', true); await adv(0.2); await key('ShiftLeft', false); await events();
// chain: kickflip → 50-50 → manual → heelflip, one combo, banked as sum × 4
await tele(-9, 0, -12, 1, 0, 8); await adv(0.1);
await key('Space', true); await adv(0.12); await key('Space', false); await tap('KeyJ');
grind = null; for (let i = 0; i < 20 && !grind; i++) { await adv(0.05); ev = await events(); grind = ev.find(e => e.kind === 'grind'); }
check('chain: kickflip into 50-50', grind && grind.data.type === '50-50', JSON.stringify(grind));
await balanceFor(0.5);
// ollie off, request manual while airborne, land into manual
await tap('Space'); await adv(0.2); await tap('KeyS', 0.04); await tap('KeyW', 0.04);
for (let i = 0; i < 20; i++) { await adv(0.05); s = await st(); if (s.state === 'MANUAL') break; }
check('chain: landed into a manual', s.state === 'MANUAL', s.state);
await balanceFor(0.5);
await key('Space', true); await adv(0.3); await key('Space', false); await tap('KeyK'); await adv(1.3); ev = await events(); s = await st();
const chainLand = ev.find(e => e.kind === 'land' && e.data.banked > 0);
const comboLog = await S(() => __skate.game.scoring.lastBank);
check('chain lands and banks one combo of 4 tricks', chainLand && comboLog && comboLog.entries.length === 4, JSON.stringify(comboLog));
check('chain total = base × 4', comboLog && chainLand.data.banked % 4 === 0 && chainLand.data.banked > 1500, chainLand && chainLand.data.banked);
console.log('   combo:', comboLog && comboLog.entries.join(' + '), '=', chainLand && chainLand.data.banked);

console.log('US5 end of run + persistence');
const scoreNow = (await st()).score;
await S(() => __skate.setTime(0.5)); await adv(1); s = await st();
check('timer expiry ends the run', s.phase === 'END', s.phase);
await shot('07_end');
const bestShown = await S(() => document.getElementById('end-alltime').textContent);
check('end screen shows the all-time best', bestShown.replace(/,/g, '') === String(scoreNow), bestShown);
await tap('KeyR'); s = await st();
check('R restarts a fresh run', s.phase === 'PLAYING' && s.score === 0 && s.timeLeft > 119);
await page.reload(); await page.waitForFunction(() => window.__skate);
const menuBest = await S(() => document.getElementById('menu-best').textContent);
check('best score survives a reload', menuBest.replace(/,/g, '') === String(scoreNow), menuBest);
await tap('Digit2');
check('2 starts free skate (no timer)', (await st()).phase === 'PLAYING' && (await S(() => document.getElementById('timer').textContent)) === 'FREE');

console.log('safety');
await tele(30, 0, 20, 1, 0, 14); await adv(1.5); ev = await events();
check('hitting a wall fast bails', ev.some(e => e.kind === 'bail' && e.data.reason === 'WALL'), JSON.stringify(ev));
await adv(1.5);
await tele(0, 1.5, -2, 0, -1, 0); await adv(1); s = await st();   // dropped onto the funbox top
check('falls onto geometry and lands (never through it)', s.state === 'ROLL' && s.pos.y > 0.9 && s.pos.y < 1.1, JSON.stringify(s.pos));
await tele(17, 1.02, 0, 1, 0, 6); let minY = 9; for (let i = 0; i < 40; i++) { await adv(0.05); s = await st(); minY = Math.min(minY, s.pos.y); }
check('rolls down the 6-stair to the ground', s.pos.y < 0.05 && s.pos.x > 23 && minY > -0.1, JSON.stringify(s.pos));
check('no console errors during the whole session', errors.length === 0, JSON.stringify(errors));

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
