// Synthesized sound effects. The AudioContext is created on the first key press (autoplay policy).
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.grindNode = null;
    this.rollGain = null;
    this._noise = null;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    // 2 s of white noise, reused by every noise voice
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    // rolling noise: looped, filtered, gain driven by speed
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    this.rollGain = this.ctx.createGain(); this.rollGain.gain.value = 0;
    src.connect(f).connect(this.rollGain).connect(this.master);
    src.start();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.6; }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  noiseBurst({ dur = 0.08, freq = 1200, type = 'bandpass', gain = 0.5, q = 1 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  tone({ from = 800, to = 200, dur = 0.08, gain = 0.3, type = 'sine' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  roll(speed) { if (this.rollGain) this.rollGain.gain.value = Math.min(0.35, speed / 40); }
  pop(charge = 0.5) { this.tone({ from: 900 + 600 * charge, to: 150, dur: 0.07, gain: 0.25 }); this.noiseBurst({ dur: 0.05, freq: 2500, gain: 0.3 }); }
  land(force = 0.5) { this.noiseBurst({ dur: 0.12, freq: 180, type: 'lowpass', gain: 0.4 + 0.4 * force }); this.tone({ from: 120, to: 50, dur: 0.1, gain: 0.3 }); }
  push() { this.noiseBurst({ dur: 0.09, freq: 700, gain: 0.18 }); }
  bail() { this.noiseBurst({ dur: 0.35, freq: 300, type: 'lowpass', gain: 0.6 }); this.tone({ from: 300, to: 60, dur: 0.4, gain: 0.25, type: 'sawtooth' }); }
  bank() { this.tone({ from: 600, to: 900, dur: 0.12, gain: 0.15, type: 'triangle' }); }
  grindStart() {
    if (!this.ctx || this.grindNode) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 2;
    const g = this.ctx.createGain(); g.gain.value = 0.25;
    src.connect(f).connect(g).connect(this.master); src.start();
    this.grindNode = { src, g };
  }
  grindStop() {
    if (!this.grindNode) return;
    const { src, g } = this.grindNode; this.grindNode = null;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.stop(t + 0.12);
  }
}
