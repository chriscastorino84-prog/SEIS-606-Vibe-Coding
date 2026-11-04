// DOM overlay: score, timer, combo, balance meter, toasts, and the menu panels.
import { fmt } from './scoring.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), score: $('score'), timer: $('timer'), best: $('best'), combo: $('combo'),
      comboName: $('combo-name'), comboMath: $('combo-math'), balance: $('balance'), pin: $('balance-pin'),
      toast: $('toast'), speed: $('speed'), menu: $('menu'),
      start: $('panel-start'), pause: $('panel-pause'), end: $('panel-end'), menuBest: $('menu-best'),
      endScore: $('end-score'), endNewBest: $('end-newbest'), endBestCombo: $('end-best-combo'),
      endLongest: $('end-longest'), endBails: $('end-bails'), endAlltime: $('end-alltime'),
    };
    this.toastUntil = 0;
    this.bankUntil = 0;
    this.lastComboText = '';
  }
  showMenu(which, data = {}) {
    for (const k of ['start', 'pause', 'end']) this.el[k].classList.toggle('hidden', k !== which);
    this.el.menu.classList.toggle('hidden', !which);
    if (which === 'start') this.el.menuBest.textContent = fmt(data.best || 0);
    if (which === 'end') {
      this.el.endScore.textContent = fmt(data.score);
      this.el.endNewBest.classList.toggle('hidden', !data.newBest);
      this.el.endBestCombo.textContent = fmt(data.bestCombo);
      this.el.endLongest.textContent = `${data.longestCombo} trick${data.longestCombo === 1 ? '' : 's'}`;
      this.el.endBails.textContent = String(data.bails);
      this.el.endAlltime.textContent = fmt(data.best);
    }
  }
  showHud(on) { this.el.hud.classList.toggle('hidden', !on); }
  toast(text, good = false, ms = 1400) {
    this.el.toast.textContent = text;
    this.el.toast.classList.toggle('good', good);
    this.el.toast.classList.remove('hidden');
    this.toastUntil = performance.now() + ms;
  }
  update({ scoring, controller, timeLeft, mode }) {
    const e = this.el;
    e.score.textContent = fmt(scoring.score);
    e.best.textContent = fmt(scoring.best);
    if (mode === 'free') e.timer.textContent = 'FREE';
    else {
      const t = Math.max(0, timeLeft), m = Math.floor(t / 60), s = Math.floor(t % 60);
      e.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      e.timer.classList.toggle('low', t <= 10);
    }
    // Combo
    const now = performance.now();
    if (scoring.comboOpen) {
      const text = scoring.comboString();
      if (text !== this.lastComboText) { e.combo.classList.remove('landed'); void e.combo.offsetWidth; e.combo.classList.add('landed'); this.lastComboText = text; }
      e.comboName.textContent = text;
      e.comboMath.textContent = `${fmt(scoring.combo.base)} × ${scoring.combo.count}`;
      e.combo.classList.remove('banked');
    } else if (scoring.lastBank && now - scoring.lastBank.at < 1500) {
      e.comboName.textContent = scoring.lastBank.entries.join(' + ');
      e.comboMath.textContent = `+${fmt(scoring.lastBank.total)}`;
      e.combo.classList.add('banked');
    } else {
      e.comboName.textContent = ''; e.comboMath.textContent = ''; this.lastComboText = '';
    }
    // Balance
    const bal = controller.state === 'GRIND' || controller.state === 'MANUAL';
    e.balance.classList.toggle('hidden', !bal);
    if (bal) {
      e.pin.style.left = `${50 + controller.balance * 48}%`;
      e.balance.classList.toggle('danger', Math.abs(controller.balance) > 0.7);
    }
    // Toast
    if (this.toastUntil && now > this.toastUntil) { e.toast.classList.add('hidden'); this.toastUntil = 0; }
    e.speed.textContent = `${Math.abs(controller.speed * 3.6).toFixed(0)} km/h · ${controller.state.toLowerCase()}`;
  }
}
