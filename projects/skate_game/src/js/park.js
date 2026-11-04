// The park. Everything is built from primitives in world space (transforms baked into the
// geometry) so the raycaster's face normals are already world normals. Returns the visual
// group, the collider meshes the controller raycasts against, the rail segments, and the spawn.
import * as THREE from 'three';

const C = {
  concrete: 0xb9b4a8,
  concreteDark: 0x8f8a7e,
  ramp: 0xd96b3b,
  rampSide: 0xb5532a,
  deck: 0x7b5a3a,
  funbox: 0x4c7fb3,
  funboxSide: 0x3a6490,
  rail: 0xe8e8ec,
  post: 0x55585f,
  ledge: 0x9ea0a6,
  wall: 0xd9cfbf,
  grass: 0x6fa35a,
  stairs: 0xa8a39a,
  coping: 0xffe08a,
};

export const PARK = { halfW: 40, halfD: 30 };

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function finalize(mesh, { collide = true, shadow = true } = {}) {
  mesh.updateMatrix();
  mesh.geometry.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.userData.collide = collide;
  return mesh;
}

// Axis-aligned box whose bottom face sits at y.
function box(w, h, d, x, y, z, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  return finalize(m, opts);
}

// Rotate a mesh about Y around a pivot (x,z) by `facing` quarter turns before finalizing.
// facing: 0 = the low edge faces +Z (skater approaches travelling -Z... i.e. from the south),
// 1 = faces +X, 2 = faces -Z, 3 = faces -X.
function orient(mesh, x, z, facing) {
  mesh.rotation.y = facing * Math.PI / 2;
  mesh.position.x += x; mesh.position.z += z;
}

// Extrude a profile drawn in the (z, y) plane (shape X = z, shape Y = height) along X,
// centred on x = 0, so the result's low edge sits at local +Z and its width spans [-w/2, w/2].
// ExtrudeGeometry extrudes along +Z; rotateY(-90°) maps (x, y, z) → (-z, y, x), i.e. shape X → world Z
// and the extrusion → world -X, which we then shift by +w/2.
function profileToMesh(shape, w) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(w / 2, 0, 0);
  return g;
}

// A wedge: ramp surface rising from the +Z edge (low) toward -Z (high), width along X.
// Local footprint: x ∈ [-w/2, w/2], z ∈ [-run/2, run/2], top edge at z = -run/2 height h.
// If `platform` > 0, a flat top extends further toward -Z by that depth.
function wedge(w, run, h, x, z, facing, color, { platform = 0, back = true } = {}) {
  const shape = new THREE.Shape();
  // Profile in the (z, y) plane → we draw it in shape XY as (X = z, Y = y) then rotate.
  const z0 = run / 2, z1 = -run / 2, z2 = -run / 2 - platform;
  shape.moveTo(z0, 0);
  shape.lineTo(z1, h);
  if (platform > 0) shape.lineTo(z2, h);
  shape.lineTo(platform > 0 ? z2 : z1, 0);
  shape.lineTo(z0, 0);
  const m = new THREE.Mesh(profileToMesh(shape, w), mat(color));
  orient(m, x, z, facing);
  return finalize(m);
}

// Quarter pipe: flat tangent at the low edge, rising along a quarter circle of radius r to
// vertical, then `vert` metres of vertical, then a deck `deck` metres deep, then a back wall.
// Local: low edge at z = 0 (skater approaches travelling -Z), wall at z = -r, deck beyond.
function quarterPipe(w, r, vert, deck, x, z, facing, color) {
  const shape = new THREE.Shape();
  const top = r + vert;
  const segs = 28;
  shape.moveTo(0, 0);
  for (let i = 1; i <= segs; i++) {
    const ang = -Math.PI / 2 - (i / segs) * (Math.PI / 2); // from the bottom (-90°) round to the wall (-180°)
    shape.lineTo(r * Math.cos(ang), r + r * Math.sin(ang)); // circle centre at (0, r)
  }
  shape.lineTo(-r, top);
  shape.lineTo(-r - deck, top);
  shape.lineTo(-r - deck, 0);
  shape.lineTo(0, 0);
  const m = new THREE.Mesh(profileToMesh(shape, w), mat(color));
  orient(m, x, z, facing);
  return finalize(m);
}

// Truncated pyramid: top rectangle (tw × td) at height h, sides sloping out by `run`.
function funbox(tw, td, h, run, x, z, color) {
  const bw = tw / 2 + run, bd = td / 2 + run, hw = tw / 2, hd = td / 2;
  const v = [
    // bottom ring (y=0): 0..3  (sw, se, ne, nw) with +z = south
    [-bw, 0, bd], [bw, 0, bd], [bw, 0, -bd], [-bw, 0, -bd],
    // top ring (y=h): 4..7
    [-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd],
  ];
  const quads = [
    [0, 1, 5, 4], // south face
    [1, 2, 6, 5], // east
    [2, 3, 7, 6], // north
    [3, 0, 4, 7], // west
    [4, 5, 6, 7], // top
  ];
  const pos = [];
  for (const q of quads) {
    const [a, b, c, d] = q.map(i => v[i]);
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, 0, z);
  return finalize(m);
}

// Round rail between two world points, with posts. Returns { mesh group, rail record }.
function railBetween(a, b, { radius = 0.05, posts = true, name = 'Rail', kind = 'round', capture = 0.55 } = {}) {
  const group = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), mat(C.rail));
  cyl.position.copy(mid);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  cyl.castShadow = true;
  group.add(cyl);
  if (posts) {
    const n = Math.max(2, Math.round(len / 2.5) + 1);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, i / (n - 1));
      const groundY = (p.y > 1.5) ? p.y - 0.85 : 0; // handrails stand on the stairs
      const h = p.y - groundY;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), mat(C.post));
      post.position.set(p.x, groundY + h / 2, p.z);
      post.castShadow = true;
      group.add(post);
    }
  }
  const rail = { a: a.clone(), b: b.clone(), kind, name, capture, radius };
  return { group, rail };
}

// Procedural concrete texture so the ground reads as moving.
function groundTexture() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b9b4a8'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  ctx.strokeStyle = 'rgba(60,55,50,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(PARK.halfW / 2, PARK.halfD / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildPark() {
  const root = new THREE.Group();
  const colliders = [];
  const rails = [];
  const add = (mesh) => { root.add(mesh); if (mesh.userData.collide) colliders.push(mesh); return mesh; };
  const addRail = (r) => { root.add(r.group); rails.push(r.rail); return r.rail; };
  const W = PARK.halfW, D = PARK.halfD;

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2;
  add(finalize(ground, { shadow: false }));

  // Grass apron outside the walls (visual only)
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 160, D * 2 + 160), mat(C.grass));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02;
  root.add(finalize(apron, { collide: false, shadow: false }));

  // Boundary walls (1 m tall, 0.4 thick)
  add(box(W * 2 + 0.8, 1, 0.4, 0, 0, -D - 0.2, C.wall));
  add(box(W * 2 + 0.8, 1, 0.4, 0, 0, D + 0.2, C.wall));
  add(box(0.4, 1, D * 2, -W - 0.2, 0, 0, C.wall));
  add(box(0.4, 1, D * 2, W + 0.2, 0, 0, C.wall));

  // ---- Half-pipe (west end). Two quarter pipes facing each other across X.
  // West QP: skater approaches travelling -X → low edge faces +X → facing = 1.
  const hpW = 14, r = 3, vert = 1.2, deckD = 3;
  const hpCenterX = -30, flat = 6;
  add(quarterPipe(hpW, r, vert, deckD, hpCenterX - flat / 2, 0, 1, C.ramp));   // west wall, lip at x = -30-3-3 = -36
  add(quarterPipe(hpW, r, vert, deckD, hpCenterX + flat / 2, 0, 3, C.ramp));   // east wall, lip at x = -24
  // Coping on both lips (grindable, tight capture)
  const lipY = r + vert;
  addRail(railBetween(new THREE.Vector3(hpCenterX - flat / 2 - r, lipY, -hpW / 2), new THREE.Vector3(hpCenterX - flat / 2 - r, lipY, hpW / 2), { posts: false, name: 'Coping', capture: 0.4, radius: 0.06 }));
  addRail(railBetween(new THREE.Vector3(hpCenterX + flat / 2 + r, lipY, -hpW / 2), new THREE.Vector3(hpCenterX + flat / 2 + r, lipY, hpW / 2), { posts: false, name: 'Coping', capture: 0.4, radius: 0.06 }));
  // Side panels so the half-pipe reads as a structure (visual only, not colliders)
  for (const sz of [-1, 1]) {
    const panel = box(flat + 2 * (r + deckD), 0.08, 0.1, hpCenterX, lipY - 0.04, sz * (hpW / 2 + 0.05), C.rampSide, { collide: false });
    root.add(panel);
  }

  // ---- Funbox (centre): 1 m tall, 6 × 4 top, 25° banks all round. Two rails on top.
  const fb = { x: 0, z: -2, tw: 6, td: 4, h: 1 };
  add(funbox(fb.tw, fb.td, fb.h, fb.h / Math.tan(THREE.MathUtils.degToRad(25)), fb.x, fb.z, C.funbox));
  for (const sz of [-1, 1]) {
    addRail(railBetween(new THREE.Vector3(fb.x - 3, fb.h + 0.3, fb.z + sz * 1.6), new THREE.Vector3(fb.x + 3, fb.h + 0.3, fb.z + sz * 1.6), { name: 'Box Rail' }));
  }

  // ---- Flat rail (north of the box)
  addRail(railBetween(new THREE.Vector3(-4, 0.45, -12), new THREE.Vector3(4, 0.45, -12), { name: 'Flat Rail' }));

  // ---- Ledge (north-west): 8 × 0.5 × 0.4 concrete, grind line along the top centre
  add(box(8, 0.4, 0.5, -12, 0, -16, C.ledge));
  addRail({ group: new THREE.Group(), rail: { a: new THREE.Vector3(-16, 0.4, -16), b: new THREE.Vector3(-8, 0.4, -16), kind: 'ledge', name: 'Ledge', capture: 0.6, radius: 0 } });

  // ---- Bank with platform (south): rises toward -Z... we want to roll onto it from the north,
  // so the low edge faces -Z → facing = 2. Platform behind.
  add(wedge(8, 3.2, 1.15, 0, 17, 2, C.ramp, { platform: 3 }));

  // ---- Kicker (south-east): 35°, 1.5 m run, approached travelling +Z... low edge faces -Z (facing 2)
  add(wedge(3, 1.5, 1.5 * Math.tan(THREE.MathUtils.degToRad(35)), 12, 9, 2, C.ramp));
  // and one approached travelling -Z (facing 0) further north so there is a launch both ways
  add(wedge(3, 1.5, 1.5 * Math.tan(THREE.MathUtils.degToRad(35)), -12, -4, 0, C.ramp));

  // ---- Stairs (east): bank up from the west, platform, 6-stair down to the east, handrail.
  const rise = 0.17, run = 0.3, steps = 6, platY = rise * steps; // 1.02
  add(wedge(6, 3, platY, 14.5, 0, 3, C.stairs));             // approached travelling +X → low edge faces -X → facing 3
  add(box(6, platY, 6, 19, 0, 0, C.stairs));                 // platform x ∈ [16, 22]
  for (let i = 0; i < steps; i++) {
    const h = platY - rise * (i + 1);
    if (h <= 0) break;
    add(box(run, h, 6, 22 + run / 2 + i * run, 0, 0, C.stairs));
  }
  const railTop = new THREE.Vector3(21.6, platY + 0.85, 0);
  const railBot = new THREE.Vector3(22 + run * steps + 0.4, 0.85, 0);
  addRail(railBetween(railTop, railBot, { name: 'Handrail', radius: 0.04 }));

  // ---- Decorations: a few blocky trees outside the walls, benches, a sign.
  const treeMat = mat(0x3f7d3a), trunkMat = mat(0x6b4a2c);
  const treeSpots = [[-50, -20], [-48, 10], [-30, 40], [0, 42], [30, 40], [52, 15], [50, -18], [20, -42], [-20, -42]];
  for (const [tx, tz] of treeSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8), trunkMat);
    trunk.position.set(tx, 1.25, tz); trunk.castShadow = true; root.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5, 7), treeMat);
    crown.position.set(tx, 4.8, tz); crown.castShadow = true; root.add(crown);
  }

  return {
    root,
    colliders,
    rails,
    spawn: { pos: new THREE.Vector3(-7, 0, 12), fwd: new THREE.Vector3(0, 0, -1) },
  };
}
