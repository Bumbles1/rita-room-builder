// Catalog of everything Rita can put in her room.
// Every item is built from simple shapes so it can be resized and recoloured.
// Conventions: group origin is the centre of the footprint, y = 0 is the bottom.
// The "front" of an item faces +z. Wall items have their back at z = -d/2.
import * as THREE from 'three';

// ---------- shared geometry & materials ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 24),
  cone5: new THREE.ConeGeometry(1, 1, 6),
  sph: new THREE.SphereGeometry(1, 20, 14),
  tor: new THREE.TorusGeometry(1, 0.12, 10, 32),
  tube: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
};
const mats = new Map();
export function M(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...(extra || {}) });
    mats.set(key, m);
  }
  return m;
}
function mk(geo, sx, sy, sz, x, y, z, c, extra) {
  const m = new THREE.Mesh(geo, M(c, extra));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.sharedGeo = true;
  return m;
}
// box: w,h,d with bottom at y
export function bx(g, w, h, d, x, y, z, c, extra) { const m = mk(G.box, w, h, d, x, y + h / 2, z, c, extra); g.add(m); return m; }
// cylinder: radius r, height h, bottom at y
export function cy(g, r, h, x, y, z, c, extra) { const m = mk(G.cyl, r, h, r, x, y + h / 2, z, c, extra); g.add(m); return m; }
// cone: radius r, height h, bottom at y
export function cone(g, r, h, x, y, z, c, sides) { const m = mk(sides ? G.cone5 : G.cone, r, h, r, x, y + h / 2, z, c); g.add(m); return m; }
// sphere centred at y, optional squash
export function sp(g, r, x, y, z, c, extra, sy, sz) { const m = mk(G.sph, r, sy ?? r, sz ?? r, x, y, z, c, extra); g.add(m); return m; }
// torus: radius r, tube t, centred at y
export function tor(g, r, t, x, y, z, c, rx = 0, ry = 0) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 32), M(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.castShadow = m.receiveShadow = true; g.add(m); return m; }

export const WOOD = '#c69c6d', WOOD2 = '#9b7449', WHITE = '#f6f5f1', METAL = '#9ba4ad', ROPE = '#d8c48e', MAT = '#fbfbf8', DARK = '#3b3b3b', LEAF = '#4caf50';

export function shade(c, amt) {
  const col = new THREE.Color(c); const hsl = { h: 0, s: 0, l: 0 }; col.getHSL(hsl);
  col.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + col.getHexString();
}
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export const PALETTE = [
  ['#ff6b6b', 'Cherry'], ['#ff9f43', 'Orange'], ['#feca57', 'Sunshine'], ['#b8e994', 'Lime'], ['#1dd1a1', 'Mint'],
  ['#10ac84', 'Forest'], ['#48dbfb', 'Aqua'], ['#54a0ff', 'Sky'], ['#2e86de', 'Ocean'], ['#5f27cd', 'Grape'],
  ['#e6d7ff', 'Lavender'], ['#ff9ff3', 'Candy'], ['#f368e0', 'Pink'], ['#ff7eb3', 'Blush'], ['#ffffff', 'White'],
  ['#f1e4c8', 'Cream'], ['#c8d6e5', 'Cloud'], ['#8395a7', 'Slate'], ['#222f3e', 'Navy'], ['#c69c6d', 'Wood'], ['#8d6e4a', 'Dark wood'],
];
const FUN = ['#ff6b6b', '#54a0ff', '#feca57', '#1dd1a1', '#5f27cd', '#ff9ff3', '#ff9f43', '#48dbfb'];

export const CATEGORIES = [
  { id: 'beds', name: 'Beds', emoji: '🛏️' },
  { id: 'build', name: 'Build it', emoji: '🧱' },
  { id: 'study', name: 'Desk & study', emoji: '✏️' },
  { id: 'storage', name: 'Storage', emoji: '🧺' },
  { id: 'play', name: 'Play & climb', emoji: '🧗' },
  { id: 'split', name: 'Split the room', emoji: '🪟' },
  { id: 'decor', name: 'Decorate', emoji: '🌈' },
];

// ---------- little helpers used by several builders ----------
function books(g, x0, y, z, w, seed = 1) {
  const r = rng(seed); let x = x0;
  while (x < x0 + w - 0.03) {
    const bw = 0.025 + r() * 0.03, bh = 0.15 + r() * 0.1;
    bx(g, bw, bh, 0.18, x + bw / 2, y, z, FUN[Math.floor(r() * FUN.length)]);
    x += bw + 0.005;
  }
}
function pillow(g, w, y, z) { bx(g, w, 0.09, 0.32, 0, y, z, WHITE); }
function mattress(g, w, d, y, c) {
  bx(g, w, 0.18, d, 0, y, 0, MAT);
  bx(g, w - 0.04, 0.06, d * 0.6, 0, y + 0.18, d * 0.2, c);
  pillow(g, w * 0.55, y + 0.18, -d / 2 + 0.22);
}
function ladder(g, x, z, h, c, rotY = 0) {
  const l = new THREE.Group(); l.position.set(x, 0, z); l.rotation.y = rotY;
  bx(l, 0.04, h, 0.04, -0.18, 0, 0, c); bx(l, 0.04, h, 0.04, 0.18, 0, 0, c);
  for (let y = 0.25; y < h - 0.1; y += 0.3) cy(l, 0.015, 0.36, 0, y, 0, c).rotation.z = Math.PI / 2;
  g.add(l); return l;
}
function rails(g, w, d, y, c, skipFootRight) {
  // guard rails around a platform top; leaves a gap at the foot on the right for the ladder
  const t = 0.04;
  bx(g, w, t, t, 0, y - t, -d / 2 + t / 2, c);
  bx(g, t, t, d, -w / 2 + t / 2, y - t, 0, c);
  bx(g, t, t, d, w / 2 - t / 2, y - t, 0, c);
  bx(g, skipFootRight ? w * 0.5 : w, t, t, skipFootRight ? -w * 0.25 : 0, y - t, d / 2 - t / 2, c);
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.1; x += 0.3) { bx(g, 0.025, 0.33, 0.025, x, y - 0.36, -d / 2 + 0.02, c); }
  for (let z = -d / 2 + 0.3; z < d / 2 - 0.1; z += 0.3) { bx(g, 0.025, 0.33, 0.025, -w / 2 + 0.02, y - 0.36, z, c); bx(g, 0.025, 0.33, 0.025, w / 2 - 0.02, y - 0.36, z, c); }
}
function cubeUnit(g, s, c, open) {
  const t = 0.02, mod = 0.39;
  const cols = Math.max(1, Math.round(s.w / mod)), rows = Math.max(1, Math.round(s.h / mod));
  const cw = s.w / cols, rh = s.h / rows;
  bx(g, s.w, t, s.d, 0, 0, 0, c); bx(g, s.w, t, s.d, 0, s.h - t, 0, c);
  bx(g, t, s.h, s.d, -s.w / 2 + t / 2, 0, 0, c); bx(g, t, s.h, s.d, s.w / 2 - t / 2, 0, 0, c);
  if (!open) bx(g, s.w, s.h, t, 0, 0, -s.d / 2 + t / 2, shade(c, 0.12));
  for (let i = 1; i < cols; i++) bx(g, t, s.h, s.d, -s.w / 2 + i * cw, 0, 0, c);
  for (let j = 1; j < rows; j++) bx(g, s.w, t, s.d, 0, j * rh, 0, c);
  const r = rng(7);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = r(); const x = -s.w / 2 + (i + 0.5) * cw, y = j * rh + t;
    if (k < 0.3) bx(g, cw * 0.7, rh * 0.6, s.d * 0.7, x, y, 0, FUN[Math.floor(r() * FUN.length)]);
    else if (k < 0.5) sp(g, Math.min(cw, rh) * 0.3, x, y + Math.min(cw, rh) * 0.3, 0, FUN[Math.floor(r() * FUN.length)]);
    else if (k < 0.7) books(g, x - cw * 0.35, y, 0, cw * 0.7, i * 7 + j * 3 + 1);
  }
}
function curtain(parent, w, h, c, y = 0) {
  const g = new THREE.Group(); parent.add(g);
  const n = Math.max(3, Math.round(w / 0.07)), sw = w / n;
  for (let i = 0; i < n; i++) bx(g, sw * 1.05, h, 0.025, -w / 2 + (i + 0.5) * sw, y, (i % 2 ? 0.012 : -0.012), i % 2 ? shade(c, -0.06) : c);
  cy(g, 0.012, w + 0.06, 0, y + h, 0, METAL).rotation.z = Math.PI / 2;
  return g;
}
function textPlane(g, w, h, x, y, z, text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = fg; ctx.font = `bold ${Math.round(cv.height * 0.6)}px "Nunito", "Arial Rounded MT Bold", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = cv.height * 0.6; while (ctx.measureText(text).width > cv.width * 0.9 && size > 10) { size -= 4; ctx.font = `bold ${size}px "Nunito", Arial, sans-serif`; }
  ctx.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  m.position.set(x, y, z); g.add(m); return m;
}

// ---------- the items ----------
// size = default size in metres, res = which dimensions can be changed, mount = floor | wall | ceiling
// y = default height of the bottom of a wall item, options = extra controls
export const ITEMS = [
  // ---- Beds ----
  { id: 'single-bed', tuck: true, name: 'Single bed', emoji: '🛏️', cat: 'beds', size: { w: 0.95, h: 0.65, d: 1.95 }, color: '#54a0ff', res: 'wd',
    build(g, s, c) { bx(g, s.w, 0.3, s.d, 0, 0, 0, WOOD); mattress(g, s.w - 0.06, s.d - 0.08, 0.3, c); bx(g, s.w, 0.35, 0.05, 0, 0.3, -s.d / 2 + 0.025, WOOD); } },
  { id: 'floor-bed', tuck: true, name: 'Mattress on floor', emoji: '🛌', cat: 'beds', size: { w: 0.95, h: 0.3, d: 1.95 }, color: '#1dd1a1', res: 'wd',
    build(g, s, c) { mattress(g, s.w, s.d, 0, c); } },
  { id: 'loft-bed', under: s => s.h - 0.42, name: 'Loft bed', emoji: '🪜', cat: 'beds', size: { w: 1.0, h: 1.7, d: 2.0 }, color: '#feca57', res: 'whd',
    build(g, s, c) {
      const p = 0.07; for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, p, s.h, p, sx * (s.w / 2 - p / 2), 0, sz * (s.d / 2 - p / 2), WOOD);
      const deck = s.h - 0.42; bx(g, s.w, 0.1, s.d, 0, deck, 0, WOOD); mattress(g, s.w - 0.12, s.d - 0.12, deck + 0.1, c);
      rails(g, s.w, s.d, s.h, WOOD, true); ladder(g, s.w / 2 - 0.25, s.d / 2 + 0.04, s.h - 0.08, WOOD);
    } },
  { id: 'bunk-bed', name: 'Bunk bed', emoji: '🛏️', cat: 'beds', size: { w: 1.0, h: 1.75, d: 2.0 }, color: '#ff6b6b', res: 'whd',
    build(g, s, c) {
      const p = 0.07; for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, p, s.h, p, sx * (s.w / 2 - p / 2), 0, sz * (s.d / 2 - p / 2), WOOD);
      bx(g, s.w, 0.1, s.d, 0, 0.2, 0, WOOD); mattress(g, s.w - 0.12, s.d - 0.12, 0.3, shade(c, 0.15));
      const deck = s.h - 0.42; bx(g, s.w, 0.1, s.d, 0, deck, 0, WOOD); mattress(g, s.w - 0.12, s.d - 0.12, deck + 0.1, c);
      rails(g, s.w, s.d, s.h, WOOD, true); ladder(g, s.w / 2 - 0.25, s.d / 2 + 0.04, s.h - 0.08, WOOD);
    } },
  { id: 'cabin-bed', tuck: true, name: 'Cabin bed (drawers)', emoji: '🗄️', cat: 'beds', size: { w: 1.0, h: 1.0, d: 2.0 }, color: '#ff9ff3', res: 'wd',
    build(g, s, c) {
      bx(g, s.w, 0.7, s.d, 0, 0, 0, c);
      for (let i = 0; i < 3; i++) { bx(g, 0.02, 0.28, s.d / 3 - 0.06, s.w / 2 + 0.005, 0.08, -s.d / 2 + (i + 0.5) * s.d / 3, shade(c, 0.15)); bx(g, 0.02, 0.28, s.d / 3 - 0.06, s.w / 2 + 0.005, 0.4, -s.d / 2 + (i + 0.5) * s.d / 3, shade(c, 0.15)); cy(g, 0.01, 0.12, s.w / 2 + 0.03, 0.2, -s.d / 2 + (i + 0.5) * s.d / 3, METAL).rotation.x = Math.PI / 2; }
      mattress(g, s.w - 0.06, s.d - 0.06, 0.7, shade(c, -0.25)); bx(g, s.w, 0.35, 0.05, 0, 0.7, -s.d / 2 + 0.025, WOOD);
    } },
  { id: 'canopy-bed', name: 'Canopy bed', emoji: '👑', cat: 'beds', size: { w: 1.0, h: 1.9, d: 2.0 }, color: '#e6d7ff', res: 'wd',
    build(g, s, c) {
      bx(g, s.w - 0.1, 0.3, s.d - 0.1, 0, 0, 0, WOOD); mattress(g, s.w - 0.16, s.d - 0.18, 0.3, shade(c, -0.2));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(g, 0.025, s.h, sx * (s.w / 2 - 0.03), 0, sz * (s.d / 2 - 0.03), WHITE);
      bx(g, s.w, 0.04, s.d, 0, s.h - 0.04, 0, c); curtain(g, s.w - 0.1, s.h - 0.5, c, 0.4).position.z = -s.d / 2 + 0.03;
    } },
  { id: 'daybed', tuck: true, name: 'Day bed / sofa', emoji: '🛋️', cat: 'beds', size: { w: 1.9, h: 0.8, d: 0.9 }, color: '#2e86de', res: 'w',
    build(g, s, c) { bx(g, s.w, 0.4, s.d, 0, 0, 0, c); bx(g, s.w, 0.4, 0.2, 0, 0.4, -s.d / 2 + 0.1, c); bx(g, 0.15, 0.25, s.d, -s.w / 2 + 0.075, 0.4, 0, shade(c, -0.1)); bx(g, 0.15, 0.25, s.d, s.w / 2 - 0.075, 0.4, 0, shade(c, -0.1)); for (let i = 0; i < 3; i++) bx(g, 0.4, 0.3, 0.12, -0.6 + i * 0.6, 0.4, -s.d / 2 + 0.26, FUN[i * 2]); } },

  // ---- Build it yourself ----
  { id: 'tall-frame', under: s => s.h - 0.4, name: 'Tall frame (make a loft!)', emoji: '🏗️', cat: 'build', size: { w: 1.0, h: 1.5, d: 2.0 }, color: '#c69c6d', res: 'whd',
    build(g, s, c) { const p = 0.07; for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, p, s.h, p, sx * (s.w / 2 - p / 2), 0, sz * (s.d / 2 - p / 2), c); bx(g, s.w, 0.1, s.d, 0, s.h - 0.1, 0, c); bx(g, s.w, 0.08, 0.04, 0, s.h - 0.4, -s.d / 2 + 0.02, c); bx(g, 0.04, 0.08, s.d, -s.w / 2 + 0.02, s.h - 0.4, 0, c); bx(g, 0.04, 0.08, s.d, s.w / 2 - 0.02, s.h - 0.4, 0, c); } },
  { id: 'bed-base', tuck: true, name: 'Low bed base', emoji: '🟫', cat: 'build', size: { w: 1.0, h: 0.3, d: 2.0 }, color: '#c69c6d', res: 'whd',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); bx(g, s.w - 0.04, 0.02, s.d - 0.04, 0, s.h, 0, shade(c, 0.1)); } },
  { id: 'mattress', name: 'Mattress', emoji: '⬜', cat: 'build', size: { w: 0.95, h: 0.26, d: 1.95 }, color: '#48dbfb', res: 'wd',
    build(g, s, c) { mattress(g, s.w, s.d, 0, c); } },
  { id: 'ladder', name: 'Ladder', emoji: '🪜', cat: 'build', size: { w: 0.45, h: 1.6, d: 0.08 }, color: '#c69c6d', res: 'h',
    build(g, s, c) { ladder(g, 0, 0, s.h, c); } },
  { id: 'stairs', name: 'Storage stairs', emoji: '🪜', cat: 'build', size: { w: 0.6, h: 1.2, d: 1.2 }, color: '#ff9f43', res: 'whd',
    build(g, s, c) { const n = Math.max(2, Math.round(s.h / 0.28)); const sd = s.d / n; for (let i = 0; i < n; i++) { const z = s.d / 2 - (i + 0.5) * sd; bx(g, s.w, (i + 1) * s.h / n, sd, 0, 0, z, i % 2 ? c : shade(c, 0.1)); bx(g, s.w * 0.6, (s.h / n) * 0.6, 0.02, 0, i * s.h / n + 0.04, z + sd / 2 + 0.01, shade(c, 0.2)); } } },
  { id: 'rail', name: 'Safety rail', emoji: '🚧', cat: 'build', size: { w: 1.0, h: 0.4, d: 0.05 }, color: '#feca57', res: 'w',
    build(g, s, c) { bx(g, s.w, 0.04, 0.04, 0, s.h - 0.04, 0, c); bx(g, s.w, 0.03, 0.03, 0, 0.0, 0, c); for (let x = -s.w / 2 + 0.03; x <= s.w / 2 - 0.02; x += 0.24) bx(g, 0.03, s.h, 0.03, x, 0, 0, c); } },
  { id: 'post', name: 'Post', emoji: '🪵', cat: 'build', size: { w: 0.1, h: 1.5, d: 0.1 }, color: '#c69c6d', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, s.w, 0, 0, 0, c); } },
  { id: 'plank', name: 'Plank / board', emoji: '📏', cat: 'build', size: { w: 1.0, h: 0.04, d: 0.5 }, color: '#c69c6d', res: 'whd',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); } },
  { id: 'block', name: 'Block', emoji: '🧊', cat: 'build', size: { w: 0.4, h: 0.4, d: 0.4 }, color: '#ff6b6b', res: 'whd',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); } },
  { id: 'cube-shelf', name: 'Cube shelf', emoji: '🔲', cat: 'build', size: { w: 0.78, h: 0.78, d: 0.35 }, color: '#ffffff', res: 'wh',
    build(g, s, c) { cubeUnit(g, s, c, false); } },
  { id: 'curtain', name: 'Curtain', emoji: '🎭', cat: 'build', size: { w: 1.0, h: 1.0, d: 0.06 }, color: '#ff9ff3', res: 'wh',
    build(g, s, c) { curtain(g, s.w, s.h, c); } },
  { id: 'slide', name: 'Slide', emoji: '🛝', cat: 'build', size: { w: 0.55, h: 1.0, d: 1.6 }, color: '#1dd1a1', res: 'hd',
    build(g, s, c) {
      const run = s.d - 0.2, len = Math.hypot(s.h, run), a = Math.asin(s.h / len);
      const m = bx(g, s.w, 0.05, len, 0, 0, 0, c); m.position.set(0, s.h / 2, 0.1); m.rotation.x = a;
      for (const sx of [-1, 1]) { const r = bx(g, 0.05, 0.14, len, 0, 0, 0, shade(c, -0.15)); r.position.set(sx * (s.w / 2 - 0.025), s.h / 2 + 0.06, 0.1); r.rotation.x = a; }
      bx(g, s.w, 0.05, 0.2, 0, s.h - 0.03, -s.d / 2 + 0.1, c);
    } },
  { id: 'pole', name: 'Fire pole', emoji: '🚒', cat: 'build', size: { w: 0.08, h: 2.7, d: 0.08 }, color: '#9ba4ad', res: 'h',
    build(g, s, c) { cy(g, 0.025, s.h, 0, 0, 0, c, { metalness: 0.6, roughness: 0.3 }); cy(g, 0.12, 0.02, 0, 0, 0, DARK); } },
  { id: 'cubby', soft: true, name: 'Cubby house frame', emoji: '🏠', cat: 'build', size: { w: 1.2, h: 1.5, d: 1.2 }, color: '#ff6b6b', res: 'whd',
    build(g, s, c) {
      const hw = s.h - 0.4; for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.06, hw, 0.06, sx * (s.w / 2 - 0.03), 0, sz * (s.d / 2 - 0.03), WOOD);
      bx(g, s.w, 0.5, 0.03, 0, 0, -s.d / 2 + 0.015, shade(c, 0.2)); bx(g, 0.03, 0.5, s.d, -s.w / 2 + 0.015, 0, 0, shade(c, 0.2));
      const len = Math.hypot(s.w / 2, 0.42), a = Math.atan2(0.42, s.w / 2);
      const l = bx(g, len + 0.1, 0.04, s.d + 0.1, 0, 0, 0, c); l.position.set(-s.w / 4, hw + 0.2, 0); l.rotation.z = a;
      const r = bx(g, len + 0.1, 0.04, s.d + 0.1, 0, 0, 0, c); r.position.set(s.w / 4, hw + 0.2, 0); r.rotation.z = -a;
    } },

  // ---- Desk & study ----
  { id: 'desk', tuck: true, under: s => s.h - 0.06, name: 'Desk', emoji: '🖥️', cat: 'study', size: { w: 1.0, h: 0.74, d: 0.5 }, color: '#ffffff', res: 'wd',
    build(g, s, c) { bx(g, s.w, 0.04, s.d, 0, s.h - 0.04, 0, c); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.04, s.h - 0.04, 0.04, sx * (s.w / 2 - 0.03), 0, sz * (s.d / 2 - 0.03), WOOD); cy(g, 0.04, 0.1, s.w / 2 - 0.12, s.h, -s.d / 2 + 0.12, '#ff6b6b'); bx(g, 0.3, 0.02, 0.2, -0.1, s.h, 0, DARK); bx(g, 0.3, 0.2, 0.01, -0.1, s.h + 0.02, -0.1, '#8395a7'); } },
  { id: 'wall-desk', name: 'Fold-down wall desk', emoji: '📐', cat: 'study', mount: 'wall', y: 0.72, size: { w: 0.9, h: 0.5, d: 0.5 }, color: '#feca57', res: 'wh',
    options: [{ key: 'open', label: 'Desk folded down', type: 'toggle', default: true }],
    build(g, s, c, o) {
      const bz = -s.d / 2; bx(g, s.w, s.h, 0.12, 0, 0, bz + 0.06, c);
      bx(g, s.w - 0.06, s.h - 0.06, 0.1, 0, 0.03, bz + 0.07, shade(c, 0.25));
      bx(g, s.w - 0.1, 0.02, 0.09, 0, s.h * 0.55, bz + 0.07, c); books(g, -s.w / 2 + 0.06, 0.03, bz + 0.07, s.w * 0.45, 3);
      if (o.open) {
        bx(g, s.w - 0.02, 0.03, s.d - 0.12, 0, 0, 0.06, shade(c, 0.12));
        const run = s.d - 0.2, len = Math.hypot(run, 0.35), a = -Math.atan2(0.35, run);
        for (const sx of [-1, 1]) { const st = bx(g, 0.03, 0.03, len, 0, 0, 0, METAL); st.position.set(sx * (s.w / 2 - 0.06), -0.17, 0.02); st.rotation.x = a; }
        cy(g, 0.035, 0.09, s.w / 2 - 0.1, 0.03, s.d / 2 - 0.1, '#54a0ff');
      } else {
        bx(g, s.w - 0.02, s.h - 0.02, 0.03, 0, 0.01, bz + 0.135, shade(c, 0.12)); bx(g, 0.1, 0.02, 0.02, 0, s.h - 0.08, bz + 0.16, METAL);
      }
    } },
  { id: 'chair', tuck: true, collideH: 0.47, name: 'Chair', emoji: '🪑', cat: 'study', size: { w: 0.45, h: 0.85, d: 0.45 }, color: '#ff6b6b', res: '',
    build(g, s, c) { bx(g, 0.42, 0.05, 0.42, 0, 0.42, 0, c); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.03, 0.42, 0.03, sx * 0.18, 0, sz * 0.18, WOOD); bx(g, 0.42, 0.38, 0.03, 0, 0.47, -0.19, c); } },
  { id: 'stool', tuck: true, name: 'Stool / pouf', emoji: '🟠', cat: 'study', size: { w: 0.4, h: 0.4, d: 0.4 }, color: '#ff9f43', res: 'wh',
    build(g, s, c) { cy(g, s.w / 2, s.h, 0, 0, 0, c); cy(g, s.w / 2 - 0.02, 0.03, 0, s.h, 0, shade(c, 0.15)); } },
  { id: 'bookshelf', tuck: true, name: 'Bookshelf', emoji: '📚', cat: 'study', size: { w: 0.8, h: 1.8, d: 0.3 }, color: '#ffffff', res: 'wh',
    build(g, s, c) { const t = 0.02; bx(g, t, s.h, s.d, -s.w / 2 + t / 2, 0, 0, c); bx(g, t, s.h, s.d, s.w / 2 - t / 2, 0, 0, c); bx(g, s.w, s.h, t, 0, 0, -s.d / 2 + t / 2, shade(c, 0.08)); const n = Math.max(2, Math.round(s.h / 0.36)); for (let i = 0; i <= n; i++) { const y = Math.min(i * s.h / n, s.h - t); bx(g, s.w, t, s.d, 0, y, 0, c); if (i < n) books(g, -s.w / 2 + 0.04, y + t, 0, s.w * (0.5 + 0.4 * ((i * 7) % 3) / 3), i + 11); } } },
  { id: 'shelf', name: 'Floating shelf', emoji: '📏', cat: 'study', mount: 'wall', y: 1.4, size: { w: 0.8, h: 0.3, d: 0.22 }, color: '#c69c6d', res: 'w',
    build(g, s, c) { bx(g, s.w, 0.04, s.d, 0, 0, 0, c); books(g, -s.w / 2 + 0.03, 0.04, 0, s.w * 0.6, 5); sp(g, 0.05, s.w / 2 - 0.1, 0.09, 0.02, '#1dd1a1'); } },
  { id: 'pinboard', name: 'Pinboard', emoji: '📌', cat: 'study', mount: 'wall', y: 1.0, size: { w: 0.9, h: 0.6, d: 0.04 }, color: '#f1e4c8', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, 0.02, 0, 0, -0.01, c); bx(g, s.w, 0.03, 0.03, 0, s.h - 0.03, 0, WOOD2); bx(g, s.w, 0.03, 0.03, 0, 0, 0, WOOD2); bx(g, 0.03, s.h, 0.03, -s.w / 2 + 0.015, 0, 0, WOOD2); bx(g, 0.03, s.h, 0.03, s.w / 2 - 0.015, 0, 0, WOOD2); const r = rng(5); for (let i = 0; i < 5; i++) { const x = -s.w / 2 + 0.1 + r() * (s.w - 0.3), y = 0.06 + r() * (s.h - 0.25); bx(g, 0.14, 0.14, 0.005, x, y, 0.01, i % 2 ? WHITE : FUN[i]); sp(g, 0.012, x, y + 0.13, 0.02, FUN[(i + 3) % FUN.length]); } } },

  // ---- Storage ----
  { id: 'wardrobe', tuck: true, name: 'Wardrobe', emoji: '🚪', cat: 'storage', size: { w: 1.0, h: 2.0, d: 0.6 }, color: '#ffffff', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); bx(g, s.w / 2 - 0.02, s.h - 0.12, 0.02, -s.w / 4 - 0.005, 0.08, s.d / 2 + 0.005, shade(c, -0.05)); bx(g, s.w / 2 - 0.02, s.h - 0.12, 0.02, s.w / 4 + 0.005, 0.08, s.d / 2 + 0.005, shade(c, -0.05)); cy(g, 0.01, 0.12, -0.04, s.h / 2, s.d / 2 + 0.03, METAL); cy(g, 0.01, 0.12, 0.04, s.h / 2, s.d / 2 + 0.03, METAL); } },
  { id: 'drawers', tuck: true, name: 'Chest of drawers', emoji: '🗄️', cat: 'storage', size: { w: 0.8, h: 0.9, d: 0.45 }, color: '#54a0ff', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); const n = 3, dh = (s.h - 0.08) / n; for (let i = 0; i < n; i++) { bx(g, s.w - 0.06, dh - 0.03, 0.02, 0, 0.05 + i * dh, s.d / 2 + 0.005, shade(c, 0.15)); cy(g, 0.01, 0.14, 0, 0.05 + i * dh + dh / 2, s.d / 2 + 0.03, METAL).rotation.z = Math.PI / 2; } } },
  { id: 'toybox', tuck: true, name: 'Toy box', emoji: '🧸', cat: 'storage', size: { w: 0.8, h: 0.5, d: 0.45 }, color: '#1dd1a1', res: 'wd',
    build(g, s, c) { bx(g, s.w, s.h - 0.06, s.d, 0, 0, 0, c); bx(g, s.w + 0.02, 0.06, s.d + 0.02, 0, s.h - 0.06, 0, shade(c, -0.12)); sp(g, 0.08, s.w / 2 - 0.15, s.h + 0.05, 0, '#feca57'); } },
  { id: 'cube-shelf-3', tuck: true, name: 'Big cube shelf', emoji: '🔲', cat: 'storage', size: { w: 1.17, h: 1.17, d: 0.35 }, color: '#ffffff', res: 'wh',
    build(g, s, c) { cubeUnit(g, s, c, false); } },
  { id: 'side-table', tuck: true, name: 'Bedside table', emoji: '🪑', cat: 'storage', size: { w: 0.4, h: 0.5, d: 0.4 }, color: '#ffffff', res: '',
    build(g, s, c) { bx(g, 0.4, 0.5, 0.4, 0, 0, 0, c); bx(g, 0.34, 0.14, 0.02, 0, 0.3, 0.2, shade(c, 0.1)); cy(g, 0.01, 0.1, 0, 0.37, 0.22, METAL).rotation.z = Math.PI / 2; cy(g, 0.08, 0.02, 0, 0.5, 0, '#54a0ff'); cy(g, 0.02, 0.2, 0, 0.52, 0, WHITE); cone(g, 0.1, 0.12, 0, 0.7, 0, '#feca57'); } },
  { id: 'hooks', name: 'Hooks', emoji: '🪝', cat: 'storage', mount: 'wall', y: 1.3, size: { w: 0.6, h: 0.12, d: 0.08 }, color: '#c69c6d', res: 'w',
    build(g, s, c) { bx(g, s.w, 0.08, 0.02, 0, 0.02, -0.03, c); const n = Math.max(2, Math.round(s.w / 0.15)); for (let i = 0; i < n; i++) { const x = -s.w / 2 + (i + 0.5) * s.w / n; cy(g, 0.01, 0.06, x, 0.04, 0, METAL).rotation.x = Math.PI / 2; } sp(g, 0.07, -s.w / 2 + 0.5 * s.w / n, -0.1, 0.03, '#ff6b6b', null, 0.09, 0.05); } },
  { id: 'wall-cube', name: 'Wall cube', emoji: '🔳', cat: 'storage', mount: 'wall', y: 1.2, size: { w: 0.4, h: 0.4, d: 0.3 }, color: '#feca57', res: 'wh',
    build(g, s, c) { const t = 0.02; bx(g, s.w, t, s.d, 0, 0, 0, c); bx(g, s.w, t, s.d, 0, s.h - t, 0, c); bx(g, t, s.h, s.d, -s.w / 2 + t / 2, 0, 0, c); bx(g, t, s.h, s.d, s.w / 2 - t / 2, 0, 0, c); bx(g, s.w, s.h, t, 0, 0, -s.d / 2 + t / 2, shade(c, 0.1)); sp(g, Math.min(s.w, s.h) * 0.25, 0, Math.min(s.w, s.h) * 0.27, 0, '#1dd1a1'); } },

  // ---- Play & climb ----
  { id: 'climb-wall', name: 'Climbing wall', emoji: '🧗', cat: 'play', mount: 'wall', y: 0, size: { w: 1.2, h: 2.2, d: 0.12 }, color: '#c8d6e5', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, 0.04, 0, 0, -s.d / 2 + 0.02, c); const r = rng(42); const n = Math.round(s.w * s.h * 9); for (let i = 0; i < n; i++) { const x = -s.w / 2 + 0.08 + r() * (s.w - 0.16), y = 0.1 + r() * (s.h - 0.2); const col = FUN[Math.floor(r() * FUN.length)]; if (r() < 0.5) bx(g, 0.09, 0.06, 0.07, x, y, -s.d / 2 + 0.04, col); else sp(g, 0.045, x, y + 0.04, -s.d / 2 + 0.05, col); } } },
  { id: 'crash-mat', soft: true, name: 'Crash mat', emoji: '🟦', cat: 'play', size: { w: 1.2, h: 0.12, d: 1.2 }, color: '#54a0ff', res: 'wd',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); bx(g, s.w - 0.06, 0.01, s.d - 0.06, 0, s.h, 0, shade(c, 0.15)); } },
  { id: 'monkey-bars', name: 'Monkey bars', emoji: '🐒', cat: 'play', mount: 'ceiling', size: { w: 0.6, h: 0.5, d: 2.0 }, color: '#ff6b6b', res: 'hd',
    build(g, s, c) { for (const sx of [-1, 1]) { bx(g, 0.04, 0.04, s.d, sx * s.w / 2, 0, 0, METAL); for (const sz of [-1, 1]) cy(g, 0.02, s.h - 0.04, sx * s.w / 2, 0.04, sz * (s.d / 2 - 0.05), METAL); } for (let z = -s.d / 2 + 0.15; z < s.d / 2 - 0.05; z += 0.3) cy(g, 0.017, s.w, 0, 0.02, z, c).rotation.z = Math.PI / 2; } },
  { id: 'swing', name: 'Swing', emoji: '🎠', cat: 'play', mount: 'ceiling', size: { w: 0.5, h: 2.0, d: 0.25 }, color: '#feca57', res: 'wh',
    build(g, s, c) { bx(g, s.w, 0.04, 0.22, 0, 0, 0, c); for (const sx of [-1, 1]) cy(g, 0.012, s.h - 0.04, sx * (s.w / 2 - 0.03), 0.04, 0, ROPE); } },
  { id: 'rope-ladder', name: 'Rope ladder', emoji: '🪢', cat: 'play', mount: 'ceiling', size: { w: 0.4, h: 2.2, d: 0.06 }, color: '#c69c6d', res: 'h',
    build(g, s, c) { for (const sx of [-1, 1]) cy(g, 0.012, s.h, sx * 0.18, 0, 0, ROPE); for (let y = 0.15; y < s.h - 0.1; y += 0.3) cy(g, 0.018, 0.4, 0, y, 0, c).rotation.z = Math.PI / 2; } },
  { id: 'cargo-net', name: 'Cargo net', emoji: '🕸️', cat: 'play', mount: 'wall', y: 0.2, size: { w: 1.2, h: 1.8, d: 0.06 }, color: '#d8c48e', res: 'wh',
    build(g, s, c) { const st = 0.2; for (let x = -s.w / 2; x <= s.w / 2 + 0.001; x += st) cy(g, 0.012, s.h, x, 0, 0, c); for (let y = 0; y <= s.h + 0.001; y += st) cy(g, 0.012, s.w, 0, y, 0, c).rotation.z = Math.PI / 2; } },
  { id: 'trampoline', tuck: true, name: 'Mini trampoline', emoji: '🤸', cat: 'play', size: { w: 1.0, h: 0.3, d: 1.0 }, color: '#5f27cd', res: 'w',
    build(g, s, c) { const r = s.w / 2; cy(g, r, 0.04, 0, s.h - 0.04, 0, DARK); tor(g, r, 0.04, 0, s.h - 0.02, 0, c, Math.PI / 2); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cy(g, 0.015, s.h - 0.04, Math.cos(a) * (r - 0.05), 0, Math.sin(a) * (r - 0.05), METAL); } } },
  { id: 'teepee', tuck: true, name: 'Teepee', emoji: '⛺', cat: 'play', size: { w: 1.2, h: 1.6, d: 1.2 }, color: '#ff9ff3', res: 'wh',
    build(g, s, c) { const m = cone(g, s.w / 2, s.h - 0.15, 0, 0, 0, c, true); m.scale.z = s.d / 2; m.rotation.y = Math.PI / 6; cone(g, 0.3, 0.5, 0, 0.2, s.d / 2 * 0.72, shade(c, -0.3), true); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const p = cy(g, 0.012, s.h + 0.2, 0, 0, 0, WOOD); p.position.set(Math.cos(a) * 0.12, s.h - 0.1, Math.sin(a) * 0.12); p.rotation.z = Math.cos(a) * 0.1; p.rotation.x = -Math.sin(a) * 0.1; } } },
  { id: 'ball-pit', tuck: true, name: 'Ball pit', emoji: '🎱', cat: 'play', size: { w: 1.2, h: 0.45, d: 1.2 }, color: '#48dbfb', res: 'wd',
    build(g, s, c) { const t = 0.06; bx(g, s.w, s.h, t, 0, 0, -s.d / 2 + t / 2, c); bx(g, s.w, s.h, t, 0, 0, s.d / 2 - t / 2, c); bx(g, t, s.h, s.d, -s.w / 2 + t / 2, 0, 0, c); bx(g, t, s.h, s.d, s.w / 2 - t / 2, 0, 0, c); bx(g, s.w, 0.02, s.d, 0, 0, 0, shade(c, -0.1)); const r = rng(99); const n = Math.round(s.w * s.d * 40); for (let i = 0; i < n; i++) sp(g, 0.055, -s.w / 2 + 0.12 + r() * (s.w - 0.24), 0.08 + r() * (s.h - 0.12), -s.d / 2 + 0.12 + r() * (s.d - 0.24), FUN[Math.floor(r() * FUN.length)]); } },
  { id: 'pod-chair', name: 'Hanging pod chair', emoji: '🥚', cat: 'play', mount: 'ceiling', size: { w: 0.8, h: 1.9, d: 0.8 }, color: '#1dd1a1', res: 'h',
    build(g, s, c) { cy(g, 0.012, s.h - 0.75, 0, 0.75, 0, ROPE); sp(g, s.w / 2, 0, 0.42, 0, c, null, 0.4, s.d / 2); bx(g, s.w * 0.55, 0.08, s.d * 0.55, 0, 0.42, 0, shade(c, 0.3)); } },
  { id: 'climb-rope', name: 'Climbing rope', emoji: '🪢', cat: 'play', mount: 'ceiling', size: { w: 0.1, h: 2.5, d: 0.1 }, color: '#d8c48e', res: 'h',
    build(g, s, c) { cy(g, 0.02, s.h, 0, 0, 0, c); for (let y = 0.15; y < s.h - 0.3; y += 0.4) sp(g, 0.045, 0, y, 0, shade(c, -0.1)); } },
  { id: 'rings', name: 'Gym rings', emoji: '⭕', cat: 'play', mount: 'ceiling', size: { w: 0.5, h: 2.0, d: 0.15 }, color: '#c69c6d', res: 'h',
    build(g, s, c) { for (const sx of [-1, 1]) { cy(g, 0.012, s.h - 0.2, sx * 0.25, 0.2, 0, ROPE); tor(g, 0.1, 0.015, sx * 0.25, 0.1, 0, c); } } },
  { id: 'stall-bars', name: 'Wall ladder bars', emoji: '🪜', cat: 'play', mount: 'wall', y: 0, size: { w: 0.9, h: 2.2, d: 0.14 }, color: '#c69c6d', res: 'wh',
    build(g, s, c) { for (const sx of [-1, 1]) bx(g, 0.05, s.h, s.d, sx * (s.w / 2 - 0.025), 0, 0, c); for (let y = 0.2; y < s.h - 0.1; y += 0.25) cy(g, 0.018, s.w - 0.05, 0, y, 0.02, shade(c, 0.1)).rotation.z = Math.PI / 2; } },
  { id: 'balance-beam', name: 'Balance beam', emoji: '🤸', cat: 'play', size: { w: 0.15, h: 0.3, d: 2.0 }, color: '#feca57', res: 'd',
    build(g, s, c) { bx(g, s.w, 0.08, s.d, 0, s.h - 0.08, 0, c); for (const sz of [-1, 1]) bx(g, 0.3, s.h - 0.08, 0.08, 0, 0, sz * (s.d / 2 - 0.2), WOOD); } },
  { id: 'tunnel', tuck: true, name: 'Crawl tunnel', emoji: '🐛', cat: 'play', size: { w: 0.5, h: 0.5, d: 1.2 }, color: '#ff9f43', res: 'd',
    build(g, s, c) { const m = mk(G.tube, s.w / 2, s.d, s.w / 2, 0, s.w / 2, 0, c, { side: THREE.DoubleSide }); m.rotation.x = Math.PI / 2; g.add(m); for (let z = -s.d / 2 + 0.1; z < s.d / 2; z += 0.3) tor(g, s.w / 2 + 0.01, 0.015, 0, s.w / 2, z, shade(c, -0.2)); } },
  { id: 'nook', tuck: true, name: 'Cushion nook', emoji: '🛋️', cat: 'play', size: { w: 1.0, h: 0.5, d: 1.0 }, color: '#5f27cd', res: 'wd',
    build(g, s, c) { bx(g, s.w, 0.22, s.d, 0, 0, 0, c); bx(g, s.w * 0.45, 0.15, s.d * 0.45, -s.w * 0.22, 0.22, -s.d * 0.2, shade(c, 0.3)); bx(g, s.w * 0.4, 0.12, s.d * 0.4, s.w * 0.22, 0.22, s.d * 0.15, '#feca57'); sp(g, 0.12, s.w * 0.1, 0.42, -s.d * 0.25, '#ff9ff3', null, 0.08, 0.12); } },
  { id: 'hoop', name: 'Basketball hoop', emoji: '🏀', cat: 'play', mount: 'wall', y: 1.6, size: { w: 0.5, h: 0.4, d: 0.35 }, color: '#ffffff', res: '',
    build(g, s, c) { bx(g, 0.5, 0.35, 0.02, 0, 0.05, -s.d / 2 + 0.01, c); bx(g, 0.22, 0.16, 0.025, 0, 0.07, -s.d / 2 + 0.013, '#ff6b6b'); tor(g, 0.11, 0.01, 0, 0.06, -s.d / 2 + 0.14, '#ff9f43', Math.PI / 2); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cy(g, 0.004, 0.12, Math.cos(a) * 0.09, -0.06, -s.d / 2 + 0.14 + Math.sin(a) * 0.09, WHITE); } } },

  // ---- Split the room ----
  { id: 'divider-curtain', name: 'Curtain divider', emoji: '🎭', cat: 'split', size: { w: 1.5, h: 2.6, d: 0.08 }, color: '#e6d7ff', res: 'wh',
    build(g, s, c) { curtain(g, s.w, s.h - 0.04, c); } },
  { id: 'divider-shelf', name: 'Shelf divider (both sides)', emoji: '📚', cat: 'split', size: { w: 1.2, h: 1.6, d: 0.4 }, color: '#ffffff', res: 'wh',
    build(g, s, c) { cubeUnit(g, s, c, true); } },
  { id: 'half-wall', name: 'Half wall', emoji: '🧱', cat: 'split', size: { w: 1.5, h: 1.4, d: 0.1 }, color: '#1dd1a1', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); bx(g, s.w + 0.04, 0.04, s.d + 0.06, 0, s.h, 0, WOOD); } },
  { id: 'screen', name: 'Folding screen', emoji: '🪭', cat: 'split', size: { w: 1.2, h: 1.7, d: 0.3 }, color: '#ff7eb3', res: 'wh',
    build(g, s, c) { const pw = s.w / 3; for (let i = 0; i < 3; i++) { const m = bx(g, pw, s.h, 0.03, 0, 0, 0, i % 2 ? shade(c, 0.1) : c); m.position.set(-s.w / 2 + (i + 0.5) * pw, s.h / 2, 0); m.rotation.y = (i % 2 ? -1 : 1) * 0.45; } } },
  { id: 'sliding-panel', name: 'Sliding door wall', emoji: '🚪', cat: 'split', size: { w: 1.0, h: 2.5, d: 0.06 }, color: '#c8d6e5', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, 0.02, 0, 0, 0, c, { transparent: true, opacity: 0.7 }); bx(g, s.w, 0.05, 0.05, 0, s.h - 0.05, 0, WOOD); bx(g, s.w, 0.05, 0.05, 0, 0, 0, WOOD); bx(g, 0.05, s.h, 0.05, -s.w / 2 + 0.025, 0, 0, WOOD); bx(g, 0.05, s.h, 0.05, s.w / 2 - 0.025, 0, 0, WOOD); bx(g, s.w + 0.2, 0.06, 0.1, 0, s.h, 0, METAL); } },
  { id: 'name-sign', name: 'Name sign', emoji: '🔤', cat: 'split', mount: 'wall', y: 1.7, size: { w: 0.7, h: 0.25, d: 0.03 }, color: '#ff6b6b', res: 'w',
    options: [{ key: 'text', label: 'Words on the sign', type: 'text', default: 'RITA' }],
    build(g, s, c, o) { bx(g, s.w, s.h, 0.03, 0, 0, 0, c); textPlane(g, s.w - 0.04, s.h - 0.04, 0, s.h / 2, 0.016, o.text || 'RITA', c, '#ffffff'); } },
  { id: 'floor-line', soft: true, name: 'Floor tape line', emoji: '➖', cat: 'split', size: { w: 0.06, h: 0.01, d: 3.0 }, color: '#feca57', res: 'd',
    build(g, s, c) { for (let z = -s.d / 2; z < s.d / 2; z += 0.3) bx(g, s.w, s.h, Math.min(0.2, s.d / 2 - z), 0, 0, z + Math.min(0.2, s.d / 2 - z) / 2, c); } },

  // ---- Decorate ----
  { id: 'rug', soft: true, name: 'Rug', emoji: '🟪', cat: 'decor', size: { w: 1.6, h: 0.02, d: 1.1 }, color: '#5f27cd', res: 'wd',
    build(g, s, c) { bx(g, s.w, s.h, s.d, 0, 0, 0, c); bx(g, s.w - 0.2, 0.005, s.d - 0.2, 0, s.h, 0, shade(c, 0.2)); } },
  { id: 'round-rug', soft: true, name: 'Round rug', emoji: '🟡', cat: 'decor', size: { w: 1.2, h: 0.02, d: 1.2 }, color: '#feca57', res: 'w',
    build(g, s, c) { cy(g, s.w / 2, s.h, 0, 0, 0, c); cy(g, s.w / 2 - 0.12, 0.005, 0, s.h, 0, shade(c, 0.15)); } },
  { id: 'beanbag', tuck: true, name: 'Beanbag', emoji: '🫘', cat: 'decor', size: { w: 0.75, h: 0.5, d: 0.75 }, color: '#ff6b6b', res: 'w',
    build(g, s, c) { sp(g, s.w / 2, 0, s.h * 0.5, 0, c, null, s.h * 0.55, s.w / 2); sp(g, s.w * 0.3, 0, s.h * 0.75, 0, shade(c, 0.1), null, s.h * 0.2, s.w * 0.3); } },
  { id: 'plant', name: 'Plant', emoji: '🪴', cat: 'decor', size: { w: 0.4, h: 1.0, d: 0.4 }, color: '#ff9f43', res: 'h',
    build(g, s, c) { cy(g, 0.15, 0.3, 0, 0, 0, c); cy(g, 0.02, s.h - 0.5, 0, 0.3, 0, WOOD2); sp(g, 0.2, 0, s.h - 0.2, 0, LEAF); sp(g, 0.14, 0.14, s.h - 0.35, 0.05, shade(LEAF, 0.1)); sp(g, 0.12, -0.13, s.h - 0.3, -0.08, shade(LEAF, -0.08)); } },
  { id: 'lamp', name: 'Floor lamp', emoji: '💡', cat: 'decor', size: { w: 0.35, h: 1.5, d: 0.35 }, color: '#feca57', res: 'h',
    build(g, s, c) { cy(g, 0.14, 0.02, 0, 0, 0, DARK); cy(g, 0.015, s.h - 0.3, 0, 0.02, 0, METAL); cone(g, 0.17, 0.3, 0, s.h - 0.3, 0, c); sp(g, 0.05, 0, s.h - 0.2, 0, '#fff6c2', { emissive: '#ffe28a', emissiveIntensity: 1 }); } },
  { id: 'pendant', name: 'Hanging light', emoji: '🔆', cat: 'decor', mount: 'ceiling', size: { w: 0.4, h: 0.6, d: 0.4 }, color: '#ff9ff3', res: 'h',
    build(g, s, c) { cy(g, 0.006, s.h - 0.25, 0, 0.25, 0, DARK); const m = sp(g, s.w / 2, 0, 0.2, 0, c, { transparent: true, opacity: 0.85 }); sp(g, 0.06, 0, 0.2, 0, '#fff6c2', { emissive: '#ffe28a', emissiveIntensity: 1.5 }); } },
  { id: 'picture', name: 'Picture', emoji: '🖼️', cat: 'decor', mount: 'wall', y: 1.4, size: { w: 0.5, h: 0.4, d: 0.03 }, color: '#54a0ff', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, 0.03, 0, 0, 0, WOOD2); bx(g, s.w - 0.06, s.h - 0.06, 0.005, 0, 0.03, 0.013, c); sp(g, Math.min(s.w, s.h) * 0.18, s.w * 0.2, s.h * 0.65, 0.018, '#feca57', null, Math.min(s.w, s.h) * 0.18, 0.003); bx(g, s.w - 0.1, s.h * 0.25, 0.004, 0, 0.04, 0.016, '#1dd1a1'); } },
  { id: 'mirror', name: 'Mirror', emoji: '🪞', cat: 'decor', mount: 'wall', y: 0.4, size: { w: 0.45, h: 1.3, d: 0.03 }, color: '#ffffff', res: 'wh',
    build(g, s, c) { bx(g, s.w, s.h, 0.03, 0, 0, 0, c); bx(g, s.w - 0.06, s.h - 0.06, 0.005, 0, 0.03, 0.014, '#dfe9f3', { metalness: 0.5, roughness: 0.1 }); } },
  { id: 'fairy-lights', soft: true, name: 'Fairy lights', emoji: '✨', cat: 'decor', mount: 'wall', y: 2.0, size: { w: 1.6, h: 0.3, d: 0.06 }, color: '#feca57', res: 'w',
    build(g, s, c) { const n = Math.round(s.w / 0.12); for (let i = 0; i <= n; i++) { const t = i / n, x = -s.w / 2 + t * s.w, y = s.h - 0.03 - Math.sin(t * Math.PI) * (s.h - 0.08); sp(g, 0.022, x, y, 0, i % 3 === 0 ? c : (i % 3 === 1 ? '#ff9ff3' : '#48dbfb'), { emissive: i % 3 === 0 ? c : (i % 3 === 1 ? '#ff9ff3' : '#48dbfb'), emissiveIntensity: 0.8 }); if (i < n) { const x2 = -s.w / 2 + (i + 1) / n * s.w, y2 = s.h - 0.03 - Math.sin((i + 1) / n * Math.PI) * (s.h - 0.08); const L = Math.hypot(x2 - x, y2 - y); const w = cy(g, 0.003, L, 0, 0, 0, DARK); w.position.set((x + x2) / 2, (y + y2) / 2, 0); w.rotation.z = Math.atan2(y2 - y, x2 - x) - Math.PI / 2; } } } },
  { id: 'clock', name: 'Clock', emoji: '🕒', cat: 'decor', mount: 'wall', y: 1.8, size: { w: 0.3, h: 0.3, d: 0.05 }, color: '#ff6b6b', res: '',
    build(g, s, c) { const m = cy(g, 0.15, 0.04, 0, 0, 0, c); m.rotation.x = Math.PI / 2; m.position.set(0, 0.15, 0.02); const f = cy(g, 0.13, 0.01, 0, 0, 0, WHITE); f.rotation.x = Math.PI / 2; f.position.set(0, 0.15, 0.045); bx(g, 0.012, 0.09, 0.005, 0, 0.15, 0.052, DARK); bx(g, 0.07, 0.012, 0.005, 0.035, 0.15, 0.052, DARK); } },
  { id: 'pet-bed', tuck: true, name: 'Pet bed', emoji: '🐾', cat: 'decor', size: { w: 0.55, h: 0.18, d: 0.55 }, color: '#8395a7', res: 'w',
    build(g, s, c) { tor(g, s.w / 2 - 0.08, 0.08, 0, 0.08, 0, c, Math.PI / 2); cy(g, s.w / 2 - 0.1, 0.05, 0, 0, 0, shade(c, 0.25)); } },
  { id: 'bunting', soft: true, name: 'Bunting flags', emoji: '🎏', cat: 'decor', mount: 'wall', y: 2.2, size: { w: 2.0, h: 0.25, d: 0.03 }, color: '#ff6b6b', res: 'w',
    build(g, s, c) { cy(g, 0.004, s.w, 0, s.h, 0, DARK).rotation.z = Math.PI / 2; const n = Math.round(s.w / 0.18); for (let i = 0; i < n; i++) { const x = -s.w / 2 + (i + 0.5) * s.w / n; const f = cone(g, 0.08, 0.18, 0, 0, 0, i % 2 ? c : FUN[(i + 2) % FUN.length]); f.scale.z = 0.01; f.position.set(x, s.h - 0.09, 0); f.rotation.x = Math.PI; } } },
];

// collision hints: `soft` never blocks anything (rugs, lights); `under` = height below which the item is open (loft beds, desks);
// `tuck` = slides under a loft / desk when it fits instead of stacking on top. `collideH` = height of the solid part (a chair's seat, so it slides under a desk). Both may be numbers or functions of the size.
for (const d of ITEMS) { d.mount = d.mount || 'floor'; d.res = d.res || ''; }
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export function defaultOptions(def) { const o = {}; for (const op of def.options || []) o[op.key] = op.default; return o; }
export function buildItem(def, size, color, options) {
  const g = new THREE.Group();
  def.build(g, size, color, options || defaultOptions(def));
  return g;
}
