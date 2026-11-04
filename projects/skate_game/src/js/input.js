// Keyboard input: held state, per-step edge detection, blur release, two-key sequences.

const MAP = {
  push: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  ollie: ['Space'],
  brake: ['ShiftLeft', 'ShiftRight'],
  kickflip: ['KeyJ'],
  heelflip: ['KeyK'],
  shoveit: ['KeyL'],
  treflip: ['Semicolon'],
  indy: ['KeyU'],
  melon: ['KeyI'],
  nosegrab: ['KeyO'],
  tailgrab: ['KeyP'],
  pause: ['Escape'],
  restart: ['KeyR'],
  menu: ['KeyM'],
  mute: ['KeyN'],
  camera: ['KeyC'],
  one: ['Digit1', 'Numpad1'],
  two: ['Digit2', 'Numpad2'],
  enter: ['Enter'],
};

const codeToAction = new Map();
for (const [action, codes] of Object.entries(MAP)) for (const c of codes) codeToAction.set(c, action);

export class Input {
  constructor(target = window) {
    this.held = new Set();          // actions currently held
    this.pressedQueue = [];         // actions pressed since last consume
    this.releasedQueue = [];
    this.heldSince = new Map();     // action -> performance.now()
    this.history = [];              // [{action, t}] of presses for sequence detection
    this.onAnyKey = null;           // callback for audio unlock
    this._down = (e) => {
      const a = codeToAction.get(e.code);
      if (!a) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.onAnyKey) this.onAnyKey();
      if (e.repeat || this.held.has(a)) return;
      this.held.add(a);
      this.heldSince.set(a, performance.now());
      this.pressedQueue.push(a);
      this.history.push({ action: a, t: performance.now() });
      if (this.history.length > 16) this.history.shift();
    };
    this._up = (e) => {
      const a = codeToAction.get(e.code);
      if (!a) return;
      if (this.held.has(a)) { this.held.delete(a); this.releasedQueue.push(a); }
    };
    this._blur = () => { for (const a of this.held) this.releasedQueue.push(a); this.held.clear(); };
    target.addEventListener('keydown', this._down);
    target.addEventListener('keyup', this._up);
    target.addEventListener('blur', this._blur);
    this.frame = { pressed: new Set(), released: new Set() };
  }

  // Move queued edges into the per-step frame set. Call once per fixed step.
  beginStep() {
    this.frame.pressed = new Set(this.pressedQueue); this.pressedQueue.length = 0;
    this.frame.released = new Set(this.releasedQueue); this.releasedQueue.length = 0;
  }
  down(a) { return this.held.has(a); }
  pressed(a) { return this.frame.pressed.has(a); }
  released(a) { return this.frame.released.has(a); }
  heldFor(a) { return this.held.has(a) ? (performance.now() - this.heldSince.get(a)) / 1000 : 0; }
  axis() { return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0); }

  // Was `second` just pressed with `first` pressed within `window` seconds before it?
  sequence(first, second, windowSec = 0.3) {
    if (!this.pressed(second)) return false;
    const now = performance.now();
    for (let i = this.history.length - 2; i >= 0; i--) {
      const h = this.history[i];
      if (now - h.t > windowSec * 1000) return false;
      if (h.action === first) return true;
      if (h.action === second) return false;
    }
    return false;
  }

  // Simulated key events for tests and demos.
  simulate(code, isDown) {
    const ev = { code, repeat: false, preventDefault() {} };
    isDown ? this._down(ev) : this._up(ev);
  }
}
