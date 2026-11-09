import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { ITEMS, ITEM_BY_ID, CATEGORIES, PALETTE, buildItem, defaultOptions, M, shade } from './catalog.js';

const $ = s => document.querySelector(s);
const SNAP = 0.05;
const AUTOSAVE_KEY = 'rita-room-autosave';
const DESIGNS_KEY = 'rita-room-designs';
const NO_STACK = new Set(['chair', 'stool', 'plant', 'lamp', 'beanbag', 'pet-bed', 'trampoline', 'teepee', 'tunnel', 'ladder', 'rail', 'post', 'slide', 'pole', 'screen', 'floor-line', 'divider-curtain', 'curtain', 'sliding-panel', 'half-wall', 'ball-pit', 'balance-beam', 'daybed', 'canopy-bed']);
const WALL_NAMES = { n: 'Wardrobe wall (north)', e: 'Door wall (east)', s: 'Front wall (south)', w: 'Window wall (west)' };

// ---------------- state ----------------
function defaultRoom() {
  return {
    w: 3.0, l: 4.4, h: 2.7, robe: true, grid: false, split: 'none',
    floor: '#e3cfae', walls: { n: '#f7f3ec', e: '#f7f3ec', s: '#f7f3ec', w: '#f7f3ec' },
    door: { wall: 'e', from: 0.65, width: 0.82, hinge: 'left' },
    window: { wall: 'w', from: 1.9, width: 1.6, sill: 0.9, height: 1.2 },
  };
}
let state = { room: defaultRoom(), names: { a: 'Rita', b: 'Sister' }, items: [] };
const uid = () => Math.random().toString(36).slice(2, 9);
const snap = (v, s = SNAP) => Math.round(v / s) * s;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- three.js setup ----------------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e6f0fb');
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
camera.position.set(3.6, 3.4, 5.2);

const hemi = new THREE.HemisphereLight(0xffffff, 0xcbbba0, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(2.5, 7, 4); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(-4, 4, -3); scene.add(fill);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 1.2; controls.maxDistance = 14;
controls.screenSpacePanning = true;

const roomGroup = new THREE.Group(); scene.add(roomGroup);
const itemsGroup = new THREE.Group(); scene.add(itemsGroup);
const objects = new Map();          // uid -> THREE.Group
let wallMeshes = {};                // id -> mesh
const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffb703); selBox.visible = false; scene.add(selBox);
const raycaster = new THREE.Raycaster();

function resize() {
  const el = $('#viewport'); const w = el.clientWidth, h = el.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('#viewport'));
resize();

// ---------------- walls geometry helpers ----------------
function wallInfo(id) {
  const { w: W, l: L } = state.room;
  switch (id) {
    case 'n': return { id, pos: new THREE.Vector3(0, 0, -L / 2), rotY: 0, len: W, uAxis: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1) };
    case 'e': return { id, pos: new THREE.Vector3(W / 2, 0, 0), rotY: -Math.PI / 2, len: L, uAxis: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(-1, 0, 0) };
    case 's': return { id, pos: new THREE.Vector3(0, 0, L / 2), rotY: Math.PI, len: W, uAxis: new THREE.Vector3(-1, 0, 0), normal: new THREE.Vector3(0, 0, -1) };
    default: return { id, pos: new THREE.Vector3(-W / 2, 0, 0), rotY: Math.PI / 2, len: L, uAxis: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(1, 0, 0) };
  }
}
function disposeGroup(g) {
  g.traverse(o => { if (o.isReflector) o.getRenderTarget().dispose(); if (o.isMesh) { if (!o.userData.sharedGeo) o.geometry.dispose(); if (o.material.map) { o.material.map.dispose(); o.material.dispose(); } } });
  while (g.children.length) g.remove(g.children[0]);
}
function labelPlane(text, w, color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const ctx = cv.getContext('2d');
  ctx.fillStyle = color; ctx.font = 'bold 110px Nunito, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 80);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

function buildRoom() {
  disposeGroup(roomGroup); wallMeshes = {};
  const R = state.room, { w: W, l: L, h: H } = R;

  // floor + ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), M(R.floor, { roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.surface = 'floor'; roomGroup.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), M('#ffffff'));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.userData.surface = 'ceiling'; roomGroup.add(ceil);

  // walls with openings
  for (const id of ['n', 'e', 's', 'w']) {
    const wi = wallInfo(id);
    const shape = new THREE.Shape([new THREE.Vector2(-wi.len / 2, 0), new THREE.Vector2(wi.len / 2, 0), new THREE.Vector2(wi.len / 2, H), new THREE.Vector2(-wi.len / 2, H)]);
    const holes = [];
    if (R.door.wall === id) { const x0 = -wi.len / 2 + R.door.from; holes.push([x0, 0, x0 + R.door.width, 2.04]); }
    if (R.window.wall === id) { const x0 = -wi.len / 2 + R.window.from; holes.push([x0, R.window.sill, x0 + R.window.width, R.window.sill + R.window.height]); }
    for (const [x0, y0, x1, y1] of holes) {
      const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.closePath(); shape.holes.push(p);
    }
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), M(R.walls[id], { roughness: 0.95 }));
    mesh.position.copy(wi.pos); mesh.rotation.y = wi.rotY; mesh.receiveShadow = true; mesh.userData.wall = id; mesh.userData.surface = 'wall';
    roomGroup.add(mesh); wallMeshes[id] = mesh;

    const wg = new THREE.Group(); wg.position.copy(wi.pos); wg.rotation.y = wi.rotY; roomGroup.add(wg);
    // skirting board (skipping the door)
    const segs = R.door.wall === id ? [[-wi.len / 2, -wi.len / 2 + R.door.from], [-wi.len / 2 + R.door.from + R.door.width, wi.len / 2]] : [[-wi.len / 2, wi.len / 2]];
    for (const [a, b] of segs) if (b - a > 0.01) { const sk = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.08, 0.015), M('#ffffff')); sk.position.set((a + b) / 2, 0.04, 0.008); wg.add(sk); }

    if (R.door.wall === id) {
      const x0 = -wi.len / 2 + R.door.from, dw = R.door.width, hingeX = R.door.hinge === 'left' ? x0 : x0 + dw;
      const jamb = M('#ffffff');
      for (const x of [x0 - 0.02, x0 + dw + 0.02]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.08, 0.12), jamb); j.position.set(x, 1.04, 0); wg.add(j); }
      const head = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.1, 0.06, 0.12), jamb); head.position.set(x0 + dw / 2, 2.07, 0); wg.add(head);
      const leaf = new THREE.Group(); leaf.position.set(hingeX, 0, 0); leaf.rotation.y = R.door.hinge === 'left' ? -1.25 : 1.25;
      const sgn = R.door.hinge === 'left' ? 1 : -1;
      const door = new THREE.Mesh(new THREE.BoxGeometry(dw, 2.02, 0.04), M('#fdfbf7')); door.position.set(sgn * dw / 2, 1.02, 0); door.castShadow = true; leaf.add(door);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), M('#c9a227', { metalness: 0.6, roughness: 0.3 })); knob.position.set(sgn * (dw - 0.08), 1.0, 0.04); leaf.add(knob);
      wg.add(leaf);
      const t0 = R.door.hinge === 'left' ? 0 : Math.PI / 2;
      const arc = new THREE.Mesh(new THREE.RingGeometry(dw - 0.015, dw, 40, 1, t0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8d6e4a', side: THREE.DoubleSide }));
      arc.rotation.x = Math.PI / 2; arc.position.set(hingeX, 0.004, 0); wg.add(arc);
      const pie = new THREE.Mesh(new THREE.CircleGeometry(dw, 40, t0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8d6e4a', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      pie.rotation.x = Math.PI / 2; pie.position.set(hingeX, 0.003, 0); wg.add(pie);
    }
    if (R.window.wall === id) {
      const x0 = -wi.len / 2 + R.window.from, ww = R.window.width, y0 = R.window.sill, wh = R.window.height;
      const fm = M('#ffffff');
      for (const [x, y, sx, sy] of [[x0, y0 + wh / 2, 0.06, wh + 0.06], [x0 + ww, y0 + wh / 2, 0.06, wh + 0.06], [x0 + ww / 2, y0, ww + 0.06, 0.06], [x0 + ww / 2, y0 + wh, ww + 0.06, 0.06], [x0 + ww / 2, y0 + wh / 2, 0.04, wh]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.1), fm); f.position.set(x, y, 0); wg.add(f);
      }
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshStandardMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.1 }));
      glass.position.set(x0 + ww / 2, y0 + wh / 2, 0); wg.add(glass);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.16, 0.04, 0.16), fm); sill.position.set(x0 + ww / 2, y0 - 0.02, 0.04); sill.castShadow = true; wg.add(sill);
    }
  }

  // built-in wardrobe behind the north wall: the wall itself is floor-to-ceiling mirrored sliding doors
  // (the wardrobe sits outside the 3.0 x 4.4 m of the floorplan, so it takes no floor space)
  if (R.robe) {
    const rg = new THREE.Group(); rg.position.set(0, 0, -L / 2); roomGroup.add(rg);
    const mirrorRes = Math.min(window.innerWidth, window.innerHeight) < 900 ? 512 : 1024;   // keep the reflection cheap on tablets / phones
    const mirror = new Reflector(new THREE.PlaneGeometry(W - 0.04, H - 0.1), { clipBias: 0.003, textureWidth: mirrorRes, textureHeight: mirrorRes, color: 0xc3ccd3 });
    mirror.position.set(0, H / 2, 0.012); rg.add(mirror);
    const trim = M('#cfd6dc', { metalness: 0.7, roughness: 0.35 });
    const panels = Math.max(2, Math.round(W / 1.0));
    for (let i = 1; i < panels; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.025, H - 0.1, 0.02), trim); f.position.set(-W / 2 + i * (W / panels), H / 2, 0.02); rg.add(f); }
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.025, H - 0.1, 0.02), trim); f.position.set(sx * (W / 2 - 0.0125), H / 2, 0.02); rg.add(f); }
    for (const y of [0.025, H - 0.025]) { const t = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, 0.04), trim); t.position.set(0, y, 0.02); rg.add(t); }
  }

  // halfway line + names
  if (R.split !== 'none') {
    const long = R.split === 'long';   // split the long way = line runs along z
    const len = long ? L : W, step = 0.3;
    for (let t = -len / 2; t < len / 2; t += step) {
      const seg = Math.min(0.18, len / 2 - t);
      const m = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.04 : seg, 0.006, long ? seg : 0.04), M('#ff6b6b'));
      m.position.set(long ? 0 : t + seg / 2, 0.003, long ? t + seg / 2 : 0); roomGroup.add(m);
    }
    const a = labelPlane(state.names.a || 'Rita', 1.0, '#ff6b6b'), b = labelPlane(state.names.b || 'Sister', 1.0, '#54a0ff');
    if (long) { a.position.set(-W / 4, 0.005, L / 2 - 0.5); b.position.set(W / 4, 0.005, L / 2 - 0.5); }
    else { a.position.set(0, 0.005, L / 4); b.position.set(0, 0.005, -L / 4); }
    roomGroup.add(a, b);
  }
  if (R.grid) {
    const pts = [];
    for (let x = -W / 2; x <= W / 2 + 0.001; x += 0.5) pts.push(x, 0.002, -L / 2, x, 0.002, L / 2);
    for (let z = -L / 2; z <= L / 2 + 0.001; z += 0.5) pts.push(-W / 2, 0.002, z, W / 2, 0.002, z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    roomGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#b9ad9c', transparent: true, opacity: 0.6 })));
  }
  for (const it of state.items) { clampItem(it); applyTransform(it); }
}

// ---------------- items ----------------
function defOf(it) { return ITEM_BY_ID[it.type]; }
function footprint(it) {
  const { w, d } = it.size, c = Math.abs(Math.cos(it.rot || 0)), s = Math.abs(Math.sin(it.rot || 0));
  return { hw: (w * c + d * s) / 2, hd: (w * s + d * c) / 2 };
}
function clampItem(it) {
  const def = defOf(it), R = state.room;
  it.size.h = Math.min(it.size.h, R.h - 0.05);
  if (def.mount === 'wall') {
    const wi = wallInfo(it.wall);
    it.u = clamp(it.u, -wi.len / 2 + it.size.w / 2, wi.len / 2 - it.size.w / 2);
    it.y = clamp(it.y, 0, R.h - it.size.h);
  } else {
    const { hw, hd } = footprint(it);
    it.x = hw >= R.w / 2 ? 0 : clamp(it.x, -R.w / 2 + hw, R.w / 2 - hw);
    it.z = hd >= R.l / 2 ? 0 : clamp(it.z, -R.l / 2 + hd, R.l / 2 - hd);
    if (def.mount === 'floor') it.y = clamp(it.y || 0, 0, R.h - it.size.h);
  }
}
// ---- collisions: keep things out of walls, the wardrobe, the door swing and each other ----
function solidRange(it) {
  const def = defOf(it), base = def.mount === 'ceiling' ? state.room.h - it.size.h : (it.y || 0);
  const under = typeof def.under === 'function' ? def.under(it.size) : (def.under || 0);
  const top = typeof def.collideH === 'function' ? def.collideH(it.size) : (def.collideH ?? it.size.h);
  return [base + under, base + Math.min(top, it.size.h)];
}
function itemBox(it) {
  const { hw, hd } = footprint(it), [y0, y1] = solidRange(it);
  return { x0: it.x - hw, x1: it.x + hw, z0: it.z - hd, z1: it.z + hd, y0, y1 };
}
function doorZone() {
  const R = state.room, wi = wallInfo(R.door.wall), u0 = -wi.len / 2 + R.door.from, u1 = u0 + R.door.width, depth = R.door.width;
  const a = wi.pos.clone().addScaledVector(wi.uAxis, u0), b = wi.pos.clone().addScaledVector(wi.uAxis, u1).addScaledVector(wi.normal, depth);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), y0: 0, y1: 2.04, what: 'door' };
}
function blockersFor(it) {
  const R = state.room, out = [doorZone()];
  if (R.robe) out.push({ x0: -R.w, x1: R.w, z0: -R.l, z1: -R.l / 2 + 0.04, y0: 0, y1: R.h, what: 'wardrobe' });   // the door tracks
  for (const o of state.items) { if (o === it || o.uid === it.uid) continue; const d = defOf(o); if (d.mount === 'wall' || d.soft) continue; out.push({ ...itemBox(o), what: 'item' }); }
  return out;
}
const overlaps = (a, b) => a.x0 < b.x1 - 1e-4 && a.x1 > b.x0 + 1e-4 && a.z0 < b.z1 - 1e-4 && a.z1 > b.z0 + 1e-4 && a.y0 < b.y1 - 1e-4 && a.y1 > b.y0 + 1e-4;
function collides(it) {
  const def = defOf(it);
  if (def.soft) return false;
  if (def.mount === 'wall') return wallCollisions(it).length > 0;
  const box = itemBox(it); if (box.y1 <= box.y0) return false;
  return blockersFor(it).some(b => overlaps(box, b));
}
// push a floor / ceiling item out of whatever it overlaps; if that doesn't work, find the nearest free spot.
// Returns true if it ended up clear (if not, it is put back where it was asked to go).
function clearAt(it, bl) { const box = itemBox(it); return box.y1 <= box.y0 || !bl.some(b => overlaps(box, b)); }
function resolveCollisions(it) {
  const def = defOf(it);
  if (def.soft) return true;
  if (def.mount === 'wall') return resolveWallCollisions(it);
  const bl = blockersFor(it); clampItem(it);
  if (clearAt(it, bl)) return true;
  const ox = it.x, oz = it.z;
  for (let n = 0; n < 6; n++) {
    const box = itemBox(it), hit = bl.find(b => overlaps(box, b)); if (!hit) break;
    const moves = [[box.x1 - hit.x0, -1, 0], [hit.x1 - box.x0, 1, 0], [box.z1 - hit.z0, 0, -1], [hit.z1 - box.z0, 0, 1]].sort((a, b) => a[0] - b[0]);
    let moved = false;
    for (const [amt, dx, dz] of moves) {
      const tx = it.x, tz = it.z;
      it.x = snap(it.x + dx * (amt + 0.005)); it.z = snap(it.z + dz * (amt + 0.005)); clampItem(it);
      if (!overlaps(itemBox(it), hit)) { moved = true; break; }
      it.x = tx; it.z = tz;
    }
    if (!moved) break;
  }
  if (clearAt(it, bl)) return true;
  for (let r = SNAP; r <= 1.6; r += SNAP) {
    const n = Math.max(8, Math.round(r * 2 * Math.PI / SNAP));
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      it.x = snap(ox + r * Math.cos(a)); it.z = snap(oz + r * Math.sin(a)); clampItem(it);
      if (clearAt(it, bl)) return true;
    }
  }
  it.x = ox; it.z = oz; clampItem(it); return false;
}
function wallRect(it) { return { u0: it.u - it.size.w / 2, u1: it.u + it.size.w / 2, y0: it.y, y1: it.y + it.size.h }; }
function wallBlockers(it) {
  const R = state.room, wi = wallInfo(it.wall), out = [];
  for (const [op, y0, y1] of [[R.door, 0, 2.04], [R.window, R.window.sill, R.window.sill + R.window.height]]) if (op.wall === it.wall) { const u0 = -wi.len / 2 + op.from; out.push({ u0, u1: u0 + op.width, y0, y1 }); }
  for (const o of state.items) { if (o.uid === it.uid || defOf(o).mount !== 'wall' || o.wall !== it.wall || defOf(o).soft) continue; out.push(wallRect(o)); }
  return out;
}
const rOverlap = (a, b) => a.u0 < b.u1 - 1e-4 && a.u1 > b.u0 + 1e-4 && a.y0 < b.y1 - 1e-4 && a.y1 > b.y0 + 1e-4;
function wallCollisions(it) { const r = wallRect(it); return wallBlockers(it).filter(b => rOverlap(r, b)); }
function resolveWallCollisions(it) {
  const bl = wallBlockers(it), clear = () => !bl.some(b => rOverlap(wallRect(it), b));
  clampItem(it); if (clear()) return true;
  const ou = it.u, oy = it.y;
  for (let n = 0; n < 6; n++) {
    const r = wallRect(it), hit = bl.find(b => rOverlap(r, b)); if (!hit) break;
    const moves = [[r.u1 - hit.u0, -1, 0], [hit.u1 - r.u0, 1, 0], [r.y1 - hit.y0, 0, -1], [hit.y1 - r.y0, 0, 1]].sort((a, b) => a[0] - b[0]);
    let moved = false;
    for (const [amt, du, dy] of moves) {
      const tu = it.u, ty = it.y;
      it.u = snap(it.u + du * (amt + 0.005)); it.y = snap(it.y + dy * (amt + 0.005)); clampItem(it);
      if (!rOverlap(wallRect(it), hit)) { moved = true; break; }
      it.u = tu; it.y = ty;
    }
    if (!moved) break;
  }
  if (clear()) return true;
  for (let r = SNAP; r <= 2.0; r += SNAP) {
    const n = Math.max(8, Math.round(r * 2 * Math.PI / SNAP));
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      it.u = snap(ou + r * Math.cos(a)); it.y = snap(oy + r * Math.sin(a)); clampItem(it);
      if (clear()) return true;
    }
  }
  it.u = ou; it.y = oy; clampItem(it); return false;
}
// clamp to the room, then nudge out of anything solid
function settle(it) { clampItem(it); return resolveCollisions(it); }

function applyTransform(it) {
  const g = objects.get(it.uid); if (!g) return;
  const def = defOf(it);
  if (def.mount === 'wall') {
    const wi = wallInfo(it.wall);
    const p = wi.pos.clone().addScaledVector(wi.uAxis, it.u).addScaledVector(wi.normal, it.size.d / 2); p.y = it.y;
    g.position.copy(p); g.rotation.y = wi.rotY;
  } else if (def.mount === 'ceiling') {
    g.position.set(it.x, state.room.h - it.size.h, it.z); g.rotation.y = it.rot || 0;
  } else {
    g.position.set(it.x, it.y || 0, it.z); g.rotation.y = it.rot || 0;
  }
}
function makeObject(it) {
  const def = defOf(it);
  const g = buildItem(def, it.size, it.color, it.options);
  g.userData.uid = it.uid; itemsGroup.add(g); objects.set(it.uid, g); applyTransform(it); return g;
}
function rebuildObject(it) {
  const g = objects.get(it.uid); if (!g) return;
  disposeGroup(g); defOf(it).build(g, it.size, it.color, it.options || defaultOptions(defOf(it))); clampItem(it); applyTransform(it);
}
function removeObject(uidv) { const g = objects.get(uidv); if (g) { disposeGroup(g); itemsGroup.remove(g); objects.delete(uidv); } }
function rebuildAll() {
  for (const k of [...objects.keys()]) removeObject(k);
  buildRoom();
  for (const it of state.items) { it.options = { ...defaultOptions(defOf(it)), ...(it.options || {}) }; makeObject(it); }
  for (const it of state.items) { settle(it); applyTransform(it); }
  select(null);
}
function wallFacingCamera() {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  let best = 'n', bd = -2;
  for (const id of ['n', 'e', 's', 'w']) { if (id === 'n' && state.room.robe) continue; const d = -wallInfo(id).normal.dot(dir); if (d > bd) { bd = d; best = id; } }
  return best;
}
function addItem(typeId) {
  const def = ITEM_BY_ID[typeId], R = state.room;
  const it = { uid: uid(), type: typeId, size: { ...def.size }, color: def.color, options: defaultOptions(def), rot: 0, x: 0, y: 0, z: 0, floating: false };
  if (def.mount === 'wall') { it.wall = wallFacingCamera(); it.u = 0; it.y = def.y ?? 1.0; }
  else {
    // find a spot near the middle that isn't already taken
    let placed = false;
    for (let r = 0; r < 3 && !placed; r += 0.3) for (let a = 0; a < Math.PI * 2 && !placed; a += Math.PI / 6) {
      it.x = snap(Math.cos(a) * r); it.z = snap(Math.sin(a) * r + (R.robe ? 0.3 : 0));
      clampItem(it); if (!collides(it)) placed = true;
    }
    if (!placed) { it.x = 0; it.z = 0; }
  }
  settle(it); state.items.push(it); makeObject(it); select(it.uid); commit();
  hint(def.mount === 'wall' ? 'Drag it along the wall 🧱' : def.mount === 'ceiling' ? 'Drag it around the ceiling ☁️' : 'Drag it around. Drop it on other things to stack! 🧱');
}
function duplicateItem(it) {
  const c = JSON.parse(JSON.stringify(it)); c.uid = uid();
  if (defOf(it).mount === 'wall') c.u += 0.3; else { c.x += 0.3; c.z += 0.3; }
  if (!settle(c)) { for (let r = 0.3; r < 3 && collides(c); r += 0.3) for (let a = 0; a < Math.PI * 2 && collides(c); a += Math.PI / 6) { c.x = snap(it.x + Math.cos(a) * r); c.z = snap(it.z + Math.sin(a) * r); clampItem(c); } } state.items.push(c); makeObject(c); select(c.uid); commit();
}
function deleteItem(uidv) { state.items = state.items.filter(i => i.uid !== uidv); removeObject(uidv); select(null); commit(); }

// ---------------- selection & inspector ----------------
let selected = null;           // uid of selected item
let selectedSurface = null;    // {kind:'wall', id} | {kind:'floor'}
function select(uidv, surface = null) {
  selected = uidv; selectedSurface = uidv ? null : surface;
  const g = uidv ? objects.get(uidv) : null;
  if (g) { selBox.setFromObject(g); selBox.visible = true; } else selBox.visible = false;
  renderInspector();
}
function cm(v) { return Math.round(v * 100); }
function sizeLabel(s) { return `${cm(s.w)} × ${cm(s.h)} × ${cm(s.d)} cm`; }
function paletteHtml(current, cls = '') {
  return `<div class="palette ${cls}">` + PALETTE.map(([c, n]) => `<div class="swatch ${current === c ? 'active' : ''}" data-color="${c}" title="${n}" style="background:${c}"></div>`).join('') + '</div>';
}
function renderInspector() {
  const panel = $('#inspector'), box = $('#insp-content');
  const it = selected ? state.items.find(i => i.uid === selected) : null;
  if (!it && !selectedSurface) { panel.classList.add('hidden'); box.innerHTML = ''; return; }
  panel.classList.remove('hidden');
  if (selectedSurface) {
    const label = selectedSurface.kind === 'floor' ? 'the floor' : 'the ' + WALL_NAMES[selectedSurface.id].toLowerCase();
    const cur = selectedSurface.kind === 'floor' ? state.room.floor : state.room.walls[selectedSurface.id];
    box.innerHTML = `<div class="insp-title">🎨 Paint ${label}</div><div class="insp-sub">Pick a colour</div>${paletteHtml(cur)}
      ${selectedSurface.kind === 'wall' ? '<div class="btn-row" style="margin-top:12px"><button class="act" id="paint-all">Paint all walls this colour</button><button class="act" id="insp-close">Done</button></div>' : '<div class="btn-row" style="margin-top:12px"><button class="act" id="insp-close">Done</button></div>'}`;
    box.querySelectorAll('.swatch').forEach(s => s.onclick = () => { const c = s.dataset.color; if (selectedSurface.kind === 'floor') state.room.floor = c; else state.room.walls[selectedSurface.id] = c; buildRoom(); commit(); renderInspector(); });
    const pa = box.querySelector('#paint-all'); if (pa) pa.onclick = () => { const c = state.room.walls[selectedSurface.id]; for (const k in state.room.walls) state.room.walls[k] = c; buildRoom(); commit(); };
    box.querySelector('#insp-close').onclick = () => select(null);
    return;
  }
  const def = defOf(it), R = state.room, res = def.res || '', mount = def.mount || 'floor';
  let html = `<div class="insp-title">${def.emoji} ${def.name}<button class="close" id="insp-done" title="Done" style="margin-left:auto">✕</button></div><div class="insp-sub">${sizeLabel(it.size)}</div>`;
  html += `<div class="btn-row four">${mount !== 'wall' ? '<button class="act" data-act="turnL" title="Turn left">↺</button><button class="act" data-act="turnR" title="Turn right">↻</button>' : '<button class="act" data-act="flipWall" title="Jump to the next wall">🔄</button><span></span>'}<button class="act" data-act="copy" title="Make a copy">📋</button><button class="act danger" data-act="delete" title="Remove">🗑️</button></div>`;
  const slider = (key, label, val, min, max, step = 1) => `<div class="field"><label>${label}<b id="val-${key}">${val} cm</b></label><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  if (res.includes('w')) html += slider('w', 'Width ↔', cm(it.size.w), 10, cm(mount === 'wall' ? wallInfo(it.wall).len : R.w));
  if (res.includes('h')) html += slider('h', mount === 'ceiling' ? 'Hang down ↕' : 'Height ↕', cm(it.size.h), 5, cm(R.h - 0.05));
  if (res.includes('d')) html += slider('d', 'Depth ⤢', cm(it.size.d), 10, cm(mount === 'wall' ? 1.2 : R.l));
  if (mount === 'floor') html += slider('lift', 'Lift off the floor ⬆️', cm(it.y || 0), 0, cm(R.h - it.size.h));
  if (mount === 'wall') html += slider('wally', 'Height on the wall ⬆️', cm(it.y), 0, cm(R.h - it.size.h));
  if (mount !== 'wall') html += `<div class="field"><label>Spin 🔄<b id="val-rot">${Math.round(((it.rot || 0) * 180 / Math.PI) % 360)}°</b></label><input type="range" data-key="rot" min="0" max="355" step="5" value="${((Math.round((it.rot || 0) * 180 / Math.PI) % 360) + 360) % 360}"></div>`;
  for (const op of def.options || []) {
    if (op.type === 'toggle') html += `<label class="toggle">${op.label}<input type="checkbox" data-opt="${op.key}" ${it.options[op.key] ? 'checked' : ''}></label>`;
    if (op.type === 'text') html += `<div class="field"><label>${op.label}</label><input type="text" data-opt="${op.key}" value="${(it.options[op.key] || '').replace(/"/g, '&quot;')}" maxlength="16"></div>`;
  }
  html += `<div class="section-title">Colour</div>${paletteHtml(it.color)}`;
  if (mount === 'floor' && (it.y || 0) > 0) html += `<div class="btn-row" style="margin-top:12px"><button class="act" data-act="drop">⬇️ Drop to floor</button><span></span></div>`;
  box.innerHTML = html;
  box.querySelector('#insp-done').onclick = () => select(null);

  box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'turnL' || a === 'turnR') { const q = Math.PI / 2; const was = it.rot || 0; it.rot = Math.round((was + (a === 'turnL' ? q : -q)) / q) * q; if (!settle(it)) { it.rot = was; settle(it); hint("No room to turn it there 🙈"); } applyTransform(it); commit(); renderInspector(); }
    if (a === 'flipWall') { const order = ['e', 's', 'w', 'n'].filter(w => !(w === 'n' && R.robe)); it.wall = order[(order.indexOf(it.wall) + 1) % order.length]; it.u = 0; settle(it); applyTransform(it); commit(); }
    if (a === 'copy') duplicateItem(it);
    if (a === 'delete') deleteItem(it.uid);
    if (a === 'drop') { const was = it.y; it.y = 0; it.floating = false; if (!settle(it)) { it.y = was; it.floating = was > 0; settle(it); hint("Something is in the way down there 🙈"); } applyTransform(it); commit(); renderInspector(); }
  });
  box.querySelectorAll('input[type=range]').forEach(inp => {
    inp.oninput = () => {
      const k = inp.dataset.key, v = +inp.value;
      const keep = { x: it.x, y: it.y, z: it.z, u: it.u, rot: it.rot, size: { ...it.size }, floating: it.floating };
      if (k === 'rot') { it.rot = v * Math.PI / 180; $('#val-rot').textContent = v + '°'; }
      else if (k === 'lift') { it.y = v / 100; it.floating = v > 0; $('#val-lift').textContent = v + ' cm'; }
      else if (k === 'wally') { it.y = v / 100; $('#val-wally').textContent = v + ' cm'; }
      else { it.size[k] = v / 100; $('#val-' + k).textContent = v + ' cm'; box.querySelector('.insp-sub').textContent = sizeLabel(it.size); }
      if (!settle(it)) { Object.assign(it, keep, { size: { ...keep.size } }); settle(it); inp.value = inp.dataset.key === 'rot' ? Math.round((((it.rot || 0) * 180 / Math.PI) % 360 + 360) % 360) : inp.dataset.key === 'lift' || inp.dataset.key === 'wally' ? cm(it.y || 0) : cm(it.size[k]); hint("It won't fit there 🙈"); }
      if (k === 'rot' || k === 'lift' || k === 'wally') applyTransform(it); else rebuildObject(it);
    };
    inp.onchange = () => { commit(); if (inp.dataset.key === 'lift' || inp.dataset.key === 'h') renderInspector(); };
  });
  box.querySelectorAll('[data-opt]').forEach(inp => {
    const apply = () => { it.options[inp.dataset.opt] = inp.type === 'checkbox' ? inp.checked : inp.value; rebuildObject(it); commit(); };
    if (inp.type === 'checkbox') inp.onchange = apply; else { inp.oninput = () => { it.options[inp.dataset.opt] = inp.value; rebuildObject(it); }; inp.onchange = () => commit(); }
  });
  box.querySelectorAll('.swatch').forEach(s => s.onclick = () => { it.color = s.dataset.color; rebuildObject(it); commit(); box.querySelectorAll('.swatch').forEach(x => x.classList.toggle('active', x === s)); });
}

// ---------------- pointer interaction ----------------
const ndc = new THREE.Vector2();
let drag = null, downPos = null;
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function itemUnderPointer() {
  const hits = raycaster.intersectObjects(itemsGroup.children, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.uid) o = o.parent; if (o) return { uid: o.userData.uid, point: h.point }; }
  return null;
}
function planeHit(y) {
  const p = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(p, out) ? out : null;
}
const _n = new THREE.Vector3();
function topSurfaceHit(excludeUid) {
  const targets = [];
  for (const [k, g] of objects) { if (k === excludeUid) continue; const it = state.items.find(i => i.uid === k); if (!it || defOf(it).mount !== 'floor' || NO_STACK.has(it.type)) continue; targets.push(g); }
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    if (!h.face) continue;
    _n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
    if (_n.y > 0.7) return h;
  }
  return null;
}
// chairs, desks and the like slide under a loft / desk when they fit, instead of climbing on top
function tucksUnder(it, hitObj) {
  if (!defOf(it).tuck) return false;
  let o = hitObj; while (o && !o.userData.uid) o = o.parent; if (!o) return false;
  const target = state.items.find(i => i.uid === o.userData.uid); if (!target) return false;
  const td = defOf(target), under = typeof td.under === 'function' ? td.under(target.size) : (td.under || 0);
  if (!under) return false;
  const [y0, y1] = solidRange({ ...it, y: 0 });
  return y1 <= (target.y || 0) + under + 0.01;
}
function wallHit() {
  const dir = raycaster.ray.direction;
  const hits = raycaster.intersectObjects(Object.values(wallMeshes), false);
  for (const h of hits) { const id = h.object.userData.wall; if (id === 'n' && state.room.robe) continue; if (wallInfo(id).normal.dot(dir) < 0) return { id, point: h.point }; }
  return null;
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  setRay(e); downPos = { x: e.clientX, y: e.clientY };
  const hit = itemUnderPointer();
  if (!hit) return;
  const it = state.items.find(i => i.uid === hit.uid); if (!it) return;
  select(it.uid);
  const def = defOf(it);
  drag = { it, def, moved: false, good: { x: it.x, y: it.y, z: it.z, u: it.u, wall: it.wall }, grabDY: hit.point.y - (def.mount === 'ceiling' ? state.room.h - it.size.h : it.y || 0), offX: it.x - hit.point.x, offZ: it.z - hit.point.z, offU: 0 };
  if (def.mount === 'wall') { const wi = wallInfo(it.wall); drag.offU = it.u - hit.point.clone().sub(wi.pos).dot(wi.uAxis); drag.grabDY = hit.point.y - it.y; }
  controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
}, { capture: true });
canvas.addEventListener('pointermove', e => {
  if (!drag) {
    if (e.pointerType === 'mouse') { setRay(e); canvas.style.cursor = itemUnderPointer() ? 'grab' : ''; }
    return;
  }
  if (!drag.moved && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 3) return;
  drag.moved = true; canvas.style.cursor = 'grabbing';
  setRay(e);
  const { it, def } = drag, R = state.room;
  if (def.mount === 'wall') {
    const h = wallHit(); if (!h) return;
    const wi = wallInfo(h.id);
    if (h.id !== it.wall) { it.wall = h.id; drag.offU = 0; }
    it.u = snap(h.point.clone().sub(wi.pos).dot(wi.uAxis) + drag.offU);
    it.y = snap(h.point.y - drag.grabDY);
  } else if (def.mount === 'ceiling') {
    const p = planeHit(R.h); if (!p) return;
    it.x = snap(p.x + drag.offX); it.z = snap(p.z + drag.offZ);
  } else {
    if (!it.floating) {
      const top = topSurfaceHit(it.uid);
      if (top && !tucksUnder(it, top.object)) it.y = snap(top.point.y, 0.01); else if (planeHit(0)) it.y = 0;
    }
    const p = planeHit((it.y || 0) + drag.grabDY); if (!p) return;
    it.x = snap(p.x + drag.offX); it.z = snap(p.z + drag.offZ);
  }
  if (settle(it)) drag.good = { x: it.x, y: it.y, z: it.z, u: it.u, wall: it.wall };
  else { Object.assign(it, drag.good); drag.blocked = true; }
  applyTransform(it);
});
function endDrag(e) {
  if (drag) {
    if (drag.moved) { if (drag.blocked && collides(drag.it)) hint("It won't fit there 🙈"); commit(); renderInspector(); }
    drag = null; controls.enabled = true; canvas.style.cursor = '';
    return;
  }
  // a tap on empty space: pick a wall / floor to paint, or deselect
  if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 4) {
    setRay(e);
    const hits = raycaster.intersectObjects([...Object.values(wallMeshes), roomGroup.children[0]], false).filter(h => {
      if (h.object.userData.surface === 'floor') return true;
      return wallInfo(h.object.userData.wall).normal.dot(raycaster.ray.direction) < 0;
    });
    if (hits.length) { const o = hits[0].object; select(null, o.userData.surface === 'floor' ? { kind: 'floor' } : { kind: 'wall', id: o.userData.wall }); }
    else select(null);
  }
  downPos = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const it = selected ? state.items.find(i => i.uid === selected) : null;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (!it) return;
  const def = defOf(it), before = { x: it.x, y: it.y, z: it.z, u: it.u, rot: it.rot }; let handled = true;
  if (e.key === 'Delete' || e.key === 'Backspace') deleteItem(it.uid);
  else if (e.key.toLowerCase() === 'r' && def.mount !== 'wall') { const q = Math.PI / 2; it.rot = Math.round(((it.rot || 0) + (e.shiftKey ? -q : q)) / q) * q; }
  else if (e.key.toLowerCase() === 'd') duplicateItem(it);
  else if (e.key === 'Escape') select(null);
  else if (e.key.startsWith('Arrow')) {
    const s = e.shiftKey ? 0.2 : SNAP;
    if (def.mount === 'wall') { if (e.key === 'ArrowLeft') it.u -= s; if (e.key === 'ArrowRight') it.u += s; if (e.key === 'ArrowUp') it.y += s; if (e.key === 'ArrowDown') it.y -= s; }
    else { if (e.key === 'ArrowLeft') it.x -= s; if (e.key === 'ArrowRight') it.x += s; if (e.key === 'ArrowUp') it.z -= s; if (e.key === 'ArrowDown') it.z += s; }
  } else handled = false;
  if (handled) { e.preventDefault(); if (state.items.includes(it)) { if (!settle(it)) { Object.assign(it, before); settle(it); hint("Something is in the way 🙈"); } applyTransform(it); commit(); renderInspector(); } }
});

// ---------------- undo / redo / save ----------------
let history = [], hIndex = -1;
function commit() {
  const snap = JSON.stringify(state);
  if (history[hIndex] === snap) return;
  history = history.slice(0, hIndex + 1); history.push(snap); if (history.length > 60) history.shift(); hIndex = history.length - 1;
  try { localStorage.setItem(AUTOSAVE_KEY, snap); } catch (_) { }
  updateUndoButtons();
}
function restore(snap) { state = JSON.parse(snap); delete state.room.robeDepth; rebuildAll(); updateUndoButtons(); }
function undo() { if (hIndex > 0) { hIndex--; restore(history[hIndex]); } }
function redo() { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); } }
function updateUndoButtons() { $('#btn-undo').disabled = hIndex <= 0; $('#btn-redo').disabled = hIndex >= history.length - 1; }
$('#btn-undo').onclick = undo; $('#btn-redo').onclick = redo;

function starterItems() {
  return [
    { type: 'single-bed', x: -0.95, z: -0.5, rot: 0 },
    { type: 'side-table', x: -0.3, z: -1.3, rot: 0 },
    { type: 'desk', x: 0, z: 1.9, rot: Math.PI },
    { type: 'chair', x: 0, z: 1.4, rot: Math.PI },
    { type: 'rug', x: 0.3, z: 0.4, rot: 0, color: '#1dd1a1' },
    { type: 'bookshelf', x: 1.3, z: 1.0, rot: -Math.PI / 2, color: '#ffffff' },
    { type: 'picture', wall: 's', u: 0.9, y: 1.3 },
    { type: 'fairy-lights', wall: 'w', u: 0.2, y: 2.1 },
  ].map(o => { const def = ITEM_BY_ID[o.type]; return { uid: uid(), type: o.type, size: { ...def.size }, color: o.color || def.color, options: defaultOptions(def), rot: o.rot || 0, x: o.x || 0, y: o.y || 0, z: o.z || 0, wall: o.wall, u: o.u || 0, floating: false }; });
}
function loadStarter() { state = { room: defaultRoom(), names: { a: 'Rita', b: 'Sister' }, items: starterItems() }; rebuildAll(); commit(); }
function loadEmpty() { state = { room: defaultRoom(), names: { a: 'Rita', b: 'Sister' }, items: [] }; rebuildAll(); commit(); }

// ---------------- views ----------------
let camAnim = null;
function setView(name) {
  const R = state.room; let pos, tgt;
  if (name === 'top') { pos = new THREE.Vector3(0, Math.max(R.w, R.l) * 1.9, 0.01); tgt = new THREE.Vector3(0, 0, 0); }
  else if (name === 'door') { const wi = wallInfo(R.door.wall); const u = -wi.len / 2 + R.door.from + R.door.width / 2; pos = wi.pos.clone().addScaledVector(wi.uAxis, u).addScaledVector(wi.normal, 0.25); pos.y = 1.45; tgt = pos.clone().addScaledVector(wi.normal, 2).add(new THREE.Vector3(-pos.x * 0.6, -0.5, -pos.z * 0.6)); }
  else { pos = new THREE.Vector3(R.w * 1.2, 3.4, R.l * 0.55 + 3.1); tgt = new THREE.Vector3(0, 0.9, 0); }
  camAnim = { from: camera.position.clone(), to: pos, tf: controls.target.clone(), tt: tgt, t: 0, start: performance.now(), ms: 550 };
  camera.fov = name === 'door' ? 72 : 50; camera.updateProjectionMatrix();
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}
document.querySelectorAll('.view-btn').forEach(b => b.onclick = () => setView(b.dataset.view));

// ---------------- catalog UI ----------------
let activeCat = CATEGORIES[0].id;
function renderCats() {
  $('#cats').innerHTML = CATEGORIES.map(c => `<button class="cat-btn ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}"><span class="em">${c.emoji}</span>${c.name}</button>`).join('');
  $('#cats').querySelectorAll('.cat-btn').forEach(b => b.onclick = () => { activeCat = b.dataset.cat; renderCats(); renderItems(); });
}
function renderItems() {
  const list = ITEMS.filter(i => i.cat === activeCat);
  $('#items').innerHTML = list.map(i => `<button class="item-card" data-id="${i.id}">${i.thumb ? `<img src="${i.thumb}" alt="">` : `<div class="ph">${i.emoji}</div>`}<span>${i.name}</span></button>`).join('');
  $('#items').querySelectorAll('.item-card').forEach(b => b.onclick = () => addItem(b.dataset.id));
}

// thumbnails: render each item once with a tiny offscreen renderer
const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setSize(160, 160); thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
const thumbScene = new THREE.Scene();
thumbScene.add(new THREE.HemisphereLight(0xffffff, 0xcbbba0, 1.1));
const tl = new THREE.DirectionalLight(0xffffff, 1.6); tl.position.set(2, 4, 3); thumbScene.add(tl);
const thumbCam = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
function makeThumb(def) {
  const g = buildItem(def, def.size, def.color, defaultOptions(def)); thumbScene.add(g);
  const box = new THREE.Box3().setFromObject(g), sph = box.getBoundingSphere(new THREE.Sphere());
  const dir = def.mount === 'ceiling' ? new THREE.Vector3(1, 0.5, 1.3) : new THREE.Vector3(1, 0.75, 1.3);
  const dist = sph.radius / Math.sin(THREE.MathUtils.degToRad(32) / 2) * 1.05;
  thumbCam.position.copy(sph.center).addScaledVector(dir.normalize(), dist); thumbCam.lookAt(sph.center);
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(g); disposeGroup(g);
  return url;
}
function buildThumbs() {
  let i = 0;
  const step = () => {
    const end = Math.min(i + 5, ITEMS.length);
    for (; i < end; i++) { try { ITEMS[i].thumb = makeThumb(ITEMS[i]); } catch (err) { console.warn('thumb failed', ITEMS[i].id, err); } }
    const changed = ITEMS.slice(end - 5, end).some(d => d.cat === activeCat);
    if (changed) renderItems();
    if (i < ITEMS.length) setTimeout(step, 10);
  };
  setTimeout(step, 50);
}

// ---------------- room panel ----------------
function renderRoomPanel() {
  const R = state.room, N = state.names;
  const wallOpts = sel => ['n', 'e', 's', 'w'].map(w => `<option value="${w}" ${sel === w ? 'selected' : ''}>${WALL_NAMES[w]}</option>`).join('');
  const num = (key, label, val, min, max, step = 1) => `<div class="field"><label>${label}</label><input type="number" data-room="${key}" value="${val}" min="${min}" max="${max}" step="${step}"></div>`;
  const paint = (key, label, cur) => `<div class="paint-row"><div class="lbl">${label}</div>${paletteHtml(cur).replace('class="palette "', `class="palette" data-paint="${key}"`)}</div>`;
  $('#room-body').innerHTML = `
    <div class="section-title">Room size (cm)</div>
    <div class="row3">${num('w', 'Width', cm(R.w), 150, 800)}${num('l', 'Length', cm(R.l), 150, 800)}${num('h', 'Ceiling', cm(R.h), 200, 400)}</div>
    <label class="toggle">Built-in mirror wardrobe on the north wall<input type="checkbox" data-room="robe" ${R.robe ? 'checked' : ''}></label>
    <label class="toggle">Show a 50 cm grid on the floor<input type="checkbox" data-room="grid" ${R.grid ? 'checked' : ''}></label>
    <div class="section-title">Door</div>
    <div class="row2"><div class="field"><label>Which wall</label><select data-room="door.wall">${wallOpts(R.door.wall)}</select></div><div class="field"><label>Hinge side</label><select data-room="door.hinge"><option value="left" ${R.door.hinge === 'left' ? 'selected' : ''}>Left</option><option value="right" ${R.door.hinge === 'right' ? 'selected' : ''}>Right</option></select></div></div>
    <div class="row2">${num('door.from', 'From the left corner (cm)', cm(R.door.from), 0, 800)}${num('door.width', 'Width (cm)', cm(R.door.width), 60, 120)}</div>
    <div class="section-title">Window</div>
    <div class="row2"><div class="field"><label>Which wall</label><select data-room="window.wall">${wallOpts(R.window.wall)}</select></div>${num('window.from', 'From the left corner (cm)', cm(R.window.from), 0, 800)}</div>
    <div class="row3">${num('window.width', 'Width', cm(R.window.width), 30, 400)}${num('window.sill', 'Sill height', cm(R.window.sill), 0, 200)}${num('window.height', 'Height', cm(R.window.height), 30, 250)}</div>
    <div class="section-title">Sharing the room</div>
    <div class="field"><label>Halfway line</label><select data-room="split"><option value="none" ${R.split === 'none' ? 'selected' : ''}>No line</option><option value="long" ${R.split === 'long' ? 'selected' : ''}>Split the long way (side by side)</option><option value="short" ${R.split === 'short' ? 'selected' : ''}>Split the short way (front and back)</option></select></div>
    <div class="row2"><div class="field"><label>Name 1</label><input type="text" data-name="a" value="${N.a}" maxlength="12"></div><div class="field"><label>Name 2</label><input type="text" data-name="b" value="${N.b}" maxlength="12"></div></div>
    <div class="section-title">Paint</div>
    ${paint('floor', 'Floor', R.floor)}${paint('n', 'North wall', R.walls.n)}${paint('e', 'East wall', R.walls.e)}${paint('s', 'South wall', R.walls.s)}${paint('w', 'West wall', R.walls.w)}
    <div class="section-title">Start again</div>
    <div class="row2"><button class="act" id="btn-starter">🏠 Starter room</button><button class="act danger" id="btn-empty">🧹 Empty room</button></div>`;
  const body = $('#room-body');
  const setPath = (path, v) => { const ks = path.split('.'); let o = R; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; };
  body.querySelectorAll('[data-room]').forEach(inp => inp.onchange = () => {
    const k = inp.dataset.room;
    if (inp.type === 'checkbox') setPath(k, inp.checked);
    else if (inp.type === 'number') { const v = +inp.value; if (isNaN(v)) return; setPath(k, clamp(v, +inp.min, +inp.max) / 100); inp.value = Math.round(clamp(v, +inp.min, +inp.max)); }
    else setPath(k, inp.value);
    // keep openings on the wall
    for (const op of [R.door, R.window]) { const len = wallInfo(op.wall).len; op.width = Math.min(op.width, len); op.from = clamp(op.from, 0, len - op.width); }
    R.window.height = Math.min(R.window.height, R.h - R.window.sill - 0.1);
    buildRoom(); commit(); renderRoomPanel();
  });
  body.querySelectorAll('[data-name]').forEach(inp => inp.onchange = () => { state.names[inp.dataset.name] = inp.value || (inp.dataset.name === 'a' ? 'Rita' : 'Sister'); buildRoom(); commit(); });
  body.querySelectorAll('[data-paint] .swatch').forEach(s => s.onclick = () => { const k = s.parentElement.dataset.paint; if (k === 'floor') R.floor = s.dataset.color; else R.walls[k] = s.dataset.color; buildRoom(); commit(); renderRoomPanel(); });
  $('#btn-starter').onclick = () => { if (confirm('Replace everything with the starter room?')) { loadStarter(); renderRoomPanel(); } };
  $('#btn-empty').onclick = () => { if (confirm('Clear the whole room?')) { loadEmpty(); renderRoomPanel(); } };
}

// ---------------- designs panel ----------------
function loadDesigns() { try { return JSON.parse(localStorage.getItem(DESIGNS_KEY) || '[]'); } catch (_) { return []; } }
function saveDesigns(list) { try { localStorage.setItem(DESIGNS_KEY, JSON.stringify(list)); } catch (_) { alert('Could not save. Your browser might be full or in private mode.'); } }
function renderDesignsPanel() {
  const list = loadDesigns();
  $('#designs-body').innerHTML = `
    <div class="input-row"><input type="text" id="design-name" placeholder="Name this design, e.g. Bunk bed castle" maxlength="40"><button class="small-btn primary" id="design-save">Save</button></div>
    ${list.length ? list.map((d, i) => `<div class="design-row"><div class="nm">${d.name}<small>${new Date(d.date).toLocaleString()} · ${d.data.items.length} things</small></div><button class="small-btn primary" data-load="${i}">Open</button><button class="small-btn danger" data-del="${i}">✕</button></div>`).join('') : '<p style="color:var(--muted)">No saved designs yet. Your room is always auto-saved on this device, but a named design is safe to come back to.</p>'}
    <div class="section-title">Share or back up</div>
    <div class="row2"><button class="act" id="design-export">⬇️ Download file</button><label class="act" style="text-align:center">⬆️ Open a file<input type="file" id="design-import" accept=".json,application/json" style="display:none"></label></div>`;
  $('#design-save').onclick = () => {
    const name = $('#design-name').value.trim() || 'My room ' + (list.length + 1);
    list.unshift({ name, date: Date.now(), data: JSON.parse(JSON.stringify(state)) }); saveDesigns(list); renderDesignsPanel();
  };
  $('#designs-body').querySelectorAll('[data-load]').forEach(b => b.onclick = () => { restore(JSON.stringify(list[+b.dataset.load].data)); commit(); closeModals(); });
  $('#designs-body').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm(`Delete "${list[+b.dataset.del].name}"?`)) { list.splice(+b.dataset.del, 1); saveDesigns(list); renderDesignsPanel(); } });
  $('#design-export').onclick = () => download(`${(state.names.a || 'rita').toLowerCase()}s-room.json`, 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 1)));
  $('#design-import').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!d.room || !Array.isArray(d.items)) throw new Error('bad'); restore(JSON.stringify(d)); commit(); closeModals(); }).catch(() => alert('That file is not a room design.'));
  };
}
function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

// ---------------- modals / top bar ----------------
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModals);
document.querySelectorAll('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) closeModals(); }));
$('#btn-room').onclick = () => { renderRoomPanel(); $('#room-panel').classList.remove('hidden'); };
$('#btn-designs').onclick = () => { renderDesignsPanel(); $('#designs-panel').classList.remove('hidden'); };
$('#btn-help').onclick = () => $('#help-panel').classList.remove('hidden');
$('#btn-photo').onclick = () => {
  const wasVisible = selBox.visible; selBox.visible = false;
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  selBox.visible = wasVisible;
  download(`${(state.names.a || 'rita').toLowerCase()}s-room.png`, url);
  hint('Photo saved! 📸');
};
let hintTimer = null;
function hint(text) { const h = $('#hint'); h.textContent = text; h.classList.remove('fade'); clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.add('fade'), 3500); }

// ---------------- boot ----------------
renderCats(); renderItems(); buildThumbs();
let saved = null; try { saved = localStorage.getItem(AUTOSAVE_KEY); } catch (_) { }
if (saved) { try { restore(saved); } catch (_) { saved = null; } }
if (!saved) loadStarter(); else commit();
setView('3d'); camera.position.copy(camAnim.to); controls.target.copy(camAnim.tt); camAnim = null;
setTimeout(() => $('#hint').classList.add('fade'), 6000);

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (camAnim) {
    camAnim.t = Math.min(1, (now - camAnim.start) / camAnim.ms); const k = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.from, camAnim.to, k); controls.target.lerpVectors(camAnim.tf, camAnim.tt, k);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
  if (selected && selBox.visible) { const g = objects.get(selected); if (g) selBox.setFromObject(g); }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

// small debugging hook (used by automated checks; harmless in normal use)
window.rita = { get state() { return state; }, settle, collides, applyTransform, commit, renderInspector, select, addItem };
