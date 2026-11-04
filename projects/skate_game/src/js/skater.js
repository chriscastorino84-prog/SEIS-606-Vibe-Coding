// Skater + board built from primitives, with code-driven poses.
// Local frame: +Z forward (nose), +Y up, +X to the skater's right. Origin = board underside centre.
import * as THREE from 'three';

const col = {
  deck: 0x2b2b30, deckTop: 0xd8c39a, truck: 0xc8c8cc, wheel: 0xf2f0e8,
  shoe: 0x202020, pants: 0x3a4a6b, shirt: 0xe0453a, skin: 0xd9a57a, helmet: 0x1f1f23,
};
const M = (c) => new THREE.MeshLambertMaterial({ color: c });
const lerp = THREE.MathUtils.lerp;

function part(w, h, d, c, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export class Skater {
  constructor() {
    this.root = new THREE.Group();          // placed at the controller position with the (fwd, up) basis
    this.body = new THREE.Group();          // whole-body lean/crouch/bail
    this.board = new THREE.Group();         // flips, slides, manuals, balance tilt
    this.root.add(this.body, this.board);

    // --- Board: 0.82 long, 0.2 wide, deck 0.03 thick, wheels Ø0.056, truck height ~0.1
    const deck = part(0.2, 0.03, 0.82, col.deck, 0, 0.11, 0);
    const grip = part(0.19, 0.006, 0.8, col.deckTop, 0, 0.128, 0);
    const nose = part(0.18, 0.03, 0.12, col.deck, 0, 0.14, 0.44); nose.rotation.x = -0.45;
    const tail = part(0.18, 0.03, 0.12, col.deck, 0, 0.14, -0.44); tail.rotation.x = 0.45;
    this.board.add(deck, grip, nose, tail);
    for (const z of [-0.26, 0.26]) {
      this.board.add(part(0.16, 0.03, 0.05, col.truck, 0, 0.08, z));
      for (const x of [-0.1, 0.1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), M(col.wheel));
        w.rotation.z = Math.PI / 2; w.position.set(x, 0.028, z); w.castShadow = true;
        this.board.add(w);
      }
    }

    // --- Body: legs, torso, arms, head. Hips at ~0.95 m when standing.
    this.legs = [];
    for (const [x, z] of [[-0.02, 0.22], [0.02, -0.2]]) {   // feet along the board
      const leg = new THREE.Group();
      leg.position.set(x, 0.13, z);
      leg.add(part(0.11, 0.4, 0.13, col.pants, 0, 0.2, 0));   // shin
      leg.add(part(0.13, 0.42, 0.15, col.pants, 0, 0.6, 0));  // thigh
      leg.add(part(0.12, 0.07, 0.26, col.shoe, 0, 0.035, 0.03));
      this.legs.push(leg);
      this.body.add(leg);
    }
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.95, 0);
    this.torso.add(part(0.36, 0.5, 0.22, col.shirt, 0, 0.25, 0));   // chest
    this.torso.add(part(0.2, 0.22, 0.22, col.skin, 0, 0.64, 0));    // head
    this.torso.add(part(0.23, 0.12, 0.25, col.helmet, 0, 0.73, 0)); // helmet
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.23, 0.46, 0);
      arm.add(part(0.09, 0.3, 0.09, col.shirt, 0, -0.15, 0));
      arm.add(part(0.08, 0.3, 0.08, col.skin, 0, -0.42, 0));
      this.arms.push(arm);
      this.torso.add(arm);
    }
    this.body.add(this.torso);
    // Regular stance: chest faces roughly sideways (+X) rather than down the board
    this.torso.rotation.y = -Math.PI / 2 * 0.8;

    // Pose inputs, set by the controller each step
    this.pose = { crouch: 0, lean: 0, grab: null, flip: null, flipT: 0, slide: 0, manual: 0, balance: 0, bail: 0, push: 0, fakie: 0 };
    this._q = new THREE.Quaternion();
    this._tmp = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._bodyEuler = new THREE.Euler();
  }

  // Place the root at `pos` with basis (fwd, up).
  place(pos, fwd, up) {
    const z = fwd.clone().normalize();
    const y = up.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    z.crossVectors(x, y).normalize();
    this._m.makeBasis(x, y, z);
    this.root.quaternion.setFromRotationMatrix(this._m);
    this.root.position.copy(pos);
  }

  update(dt) {
    const p = this.pose;
    const k = 1 - Math.exp(-18 * dt);
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

    // --- Legs / torso: crouch and grab tuck
    const tuck = p.grab ? 1 : 0;
    const legScale = tuck ? 0.55 : 1 - 0.35 * p.crouch;
    for (const leg of this.legs) leg.scale.y = lerp(leg.scale.y, legScale, k);
    this.torso.position.y = lerp(this.torso.position.y, 0.95 - 0.33 * p.crouch - 0.3 * tuck, k);

    // --- Arms
    let a0 = [0.25, 0.1, -0.15], a1 = [-0.25, 0.1, 0.15];
    if (p.grab === 'indy') { a0 = [2.6, 0.3, 0.2]; a1 = [-0.8, 0, 0.8]; }
    else if (p.grab === 'melon') { a0 = [0.5, 0, -0.9]; a1 = [-2.6, -0.3, 0.3]; }
    else if (p.grab === 'nosegrab') { a0 = [2.4, 0.8, 0.9]; a1 = [-0.9, 0.2, 0.6]; }
    else if (p.grab === 'tailgrab') { a0 = [0.9, -0.2, -0.6]; a1 = [-2.4, -0.8, -0.9]; }
    else if (p.bail > 0) { a0 = [2.8, 0.5, 0]; a1 = [-2.8, -0.5, 0]; }
    else if (p.push > 0) { a0 = [1.2, 0.2, -0.2]; a1 = [-1.0, 0.2, 0.4]; }
    const [L, R] = this.arms;
    L.rotation.set(lerp(L.rotation.x, a0[0], k), lerp(L.rotation.y, a0[1], k), lerp(L.rotation.z, a0[2], k));
    R.rotation.set(lerp(R.rotation.x, a1[0], k), lerp(R.rotation.y, a1[1], k), lerp(R.rotation.z, a1[2], k));

    // --- Body group: lean (turns), balance tilt, manual pitch, bail fall
    let bx = -0.3 * p.manual + 0.25 * p.crouch, bz = -p.lean * 0.35 - p.balance * 0.55, by = 0, bposY = tuck * 0.05, bposZ = 0;
    if (p.bail > 0) { const t = Math.min(1, p.bail); bx = -1.3 * t; bposZ = -0.4 * t; bposY = -0.1 * t; by = 0.3 * t; }
    this._bodyEuler.set(bx, by, bz);
    this._tmp.setFromEuler(this._bodyEuler);
    this.body.quaternion.slerp(this._tmp, k);
    this.body.position.y = lerp(this.body.position.y, bposY, k);
    this.body.position.z = lerp(this.body.position.z, bposZ, k);

    // --- Board: balance roll × manual pitch × slide yaw × flip × bail
    const q = this._q.identity();
    q.multiply(this._tmp.setFromAxisAngle(Z, -p.balance * 0.35));
    if (p.manual) q.multiply(this._tmp.setFromAxisAngle(X, -0.45 * p.manual));
    if (p.slide) q.multiply(this._tmp.setFromAxisAngle(Y, Math.PI / 2 * p.slide));
    if (p.bail > 0) q.multiply(this._tmp.setFromAxisAngle(Y, 0.8 * Math.min(1, p.bail)));
    if (p.flip) {
      const t = p.flipT;
      if (p.flip === 'kickflip') q.multiply(this._tmp.setFromAxisAngle(Z, -Math.PI * 2 * t));
      else if (p.flip === 'heelflip') q.multiply(this._tmp.setFromAxisAngle(Z, Math.PI * 2 * t));
      else if (p.flip === 'shoveit') q.multiply(this._tmp.setFromAxisAngle(Y, Math.PI * t));
      else if (p.flip === 'treflip') {
        q.multiply(this._tmp.setFromAxisAngle(Y, Math.PI * 2 * t));
        q.multiply(this._tmp.setFromAxisAngle(Z, -Math.PI * 2 * t));
      }
      this.board.quaternion.copy(q);          // flips are exact, not smoothed
    } else {
      this.board.quaternion.slerp(q, k);
    }
    const boardY = tuck * 0.22 + (p.bail > 0 ? -0.05 : 0);
    this.board.position.y = lerp(this.board.position.y, boardY, k);
    this.board.position.z = lerp(this.board.position.z, p.bail > 0 ? 0.6 : 0, k);
  }
}
