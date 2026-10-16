// Room shell: floor, walls (with a window opening), ceiling, baseboards. Wallpaper and floor boards are canvas textures,
// corner ambient occlusion is baked into vertex colours.
import * as THREE from 'three';
import { canvasTex, mulberry32, xf, Batcher, noiseTexture } from './util.js';

export const ROOM = { x0: -3, x1: 2.3, z0: -3, z1: 10, h: 2.8 };
export const WINDOW = { x0: -2.4, x1: -0.6, y0: 0.9, y1: 2.3 };

/** Baked AO: darkens points close to the room's other surfaces. `own` is the surface the point lies on. */
// Furniture footprints that darken the floor around them (contact shadows): [x0, x1, z0, z1, strength, softness]
const FLOOR_OCC = [
  [-2.17, -0.83, -2.95, -0.33, 0.62, 0.3],   // bed
  [-2.88, -2.32, -2.55, -2.05, 0.5, 0.22],   // bedside table
  [0.08, 1.42, -2.95, -2.28, 0.5, 0.25],     // desk
  [0.62, 1.0, -2.02, -1.58, 0.42, 0.2],      // chair
  [1.68, 2.12, -2.17, -1.73, 0.55, 0.22],    // lamp base
  [-1.98, -1.12, 2.1, 3.0, 0.5, 0.25],       // toy basket
];
// Wall footprints on the back wall: [x0, x1, yTop, strength, softness]
const BACK_OCC = [[-2.2, -0.8, 1.15, 0.35, 0.3], [0.05, 1.45, 0.8, 0.3, 0.25], [-2.9, -2.3, 0.65, 0.25, 0.2]];

function rectDist(px, pz, x0, x1, z0, z1) {
  const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1);
  return Math.hypot(dx, dz);
}

function aoAt(x, y, z, own) {
  const k = 0.42;
  let s = 0;
  let occ = 1;
  if (own === 'floor') for (const [a, b, c, d, st, so] of FLOOR_OCC) occ *= 1 - st * Math.exp(-rectDist(x, z, a, b, c, d) / so);
  if (own === 'back') for (const [a, b, yt, st, so] of BACK_OCC) occ *= 1 - st * Math.exp(-Math.hypot(Math.max(a - x, 0, x - b), Math.max(y - yt, 0)) / so);
  if (own !== 'floor') s += Math.exp(-Math.max(0, y) / k);
  if (own !== 'ceil') s += Math.exp(-Math.max(0, ROOM.h - y) / k) * 0.6;
  if (own !== 'back') s += Math.exp(-Math.max(0, z - ROOM.z0) / k);
  if (own !== 'right') s += Math.exp(-Math.max(0, ROOM.x1 - x) / k);
  if (own !== 'left') s += Math.exp(-Math.max(0, x - ROOM.x0) / k);
  return Math.max(0.28, Math.max(0.5, 1 - 0.3 * s) * occ);
}

/** Grid surface with vertex AO. O + U*s + V*t, normal = U x V. */
function surface(O, U, V, su, sv, own, uvFn) {
  const pos = [], uv = [], col = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3().crossVectors(U, V).normalize();
  for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) {
    p.copy(O).addScaledVector(U, i / su).addScaledVector(V, j / sv);
    pos.push(p.x, p.y, p.z);
    const a = aoAt(p.x, p.y, p.z, own);
    col.push(a, a, a);
    const t = uvFn(p); uv.push(t[0], t[1]);
  }
  const w = su + 1;
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
    const a = j * w + i, b = a + 1, c = a + w + 1, d = a + w;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: pos.length / 3 }, () => [n.x, n.y, n.z]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Hand-drawn wallpaper: hills, forest, balloons, deer, bears, clouds, little train track. Tiles horizontally. */
function wallpaperTexture() {
  const W = 1792, H = 1434;
  const rnd = mulberry32(7);
  return canvasTex(W, H, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#b4d3ea'); sky.addColorStop(0.55, '#d4e6ea'); sky.addColorStop(1, '#eaeed6');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    const cloud = (x, y, s, a = 0.9) => {
      c.fillStyle = `rgba(255,255,255,${a})`;
      for (const [dx, dy, r] of [[0, 0, 40], [38, -14, 48], [84, 0, 38], [42, 14, 44], [-30, 10, 28], [110, 12, 26]]) {
        c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill();
      }
    };
    for (let i = 0; i < 7; i++) cloud((i / 7) * W + rnd() * 90, 90 + rnd() * 380, 1.1 + rnd() * 1.0, 0.75 + rnd() * 0.2);

    // Hot-air balloons
    const balloon = (x, y, s, cols) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = cols[0]; c.beginPath(); c.ellipse(0, 0, 54, 66, 0, 0, 7); c.fill();
      c.fillStyle = cols[1]; c.beginPath(); c.ellipse(0, 0, 30, 66, 0, 0, 7); c.fill();
      c.fillStyle = cols[2]; c.beginPath(); c.ellipse(0, 0, 11, 66, 0, 0, 7); c.fill();
      c.strokeStyle = '#6b5a45'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-26, 58); c.lineTo(-14, 98); c.moveTo(26, 58); c.lineTo(14, 98); c.stroke();
      c.fillStyle = '#b98a58'; c.fillRect(-16, 98, 32, 22);
      c.restore();
    };
    balloon(330, 250, 1.5, ['#8bb7d9', '#f0cf7a', '#e8e1c8']);
    balloon(1010, 430, 1.0, ['#e9c46b', '#8fb6d4', '#f1e7c9']);
    balloon(1560, 210, 1.2, ['#9cc5a2', '#ecc977', '#efe6c8']);

    // Seamless hill layers (sine sums with integer periods)
    const hill = (base, amp, col, seed) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const t = (x / W) * Math.PI * 2;
        c.lineTo(x, base + Math.sin(t + seed) * amp + Math.sin(t * 2 + seed * 2) * amp * 0.45 + Math.sin(t * 3 + seed) * amp * 0.2);
      }
      c.lineTo(W, H); c.fill();
    };
    hill(820, 70, '#cfe3b6', 1); hill(950, 60, '#a8d1a0', 2.4); hill(1100, 55, '#86bd8c', 4); hill(1250, 40, '#6fae7c', 5.5);

    // Little wooden train track on the middle hill
    c.strokeStyle = '#a77d55'; c.lineWidth = 7;
    c.beginPath();
    for (let x = 0; x <= W; x += 8) { const t = (x / W) * Math.PI * 2; const y = 1010 + Math.sin(t * 2 + 0.5) * 24; c[x ? 'lineTo' : 'moveTo'](x, y); }
    c.stroke();
    c.lineWidth = 5;
    for (let x = 0; x < W; x += 30) { const t = (x / W) * Math.PI * 2; const y = 1010 + Math.sin(t * 2 + 0.5) * 24; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x, y + 14); c.stroke(); }

    // Trees
    const tree = (x, y, s, col) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = '#8a6a4b'; c.fillRect(-6, -20, 12, 60);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, -62, 40, 62, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(-12, -78, 14, 30, 0.2, 0, 7); c.fill();
      c.restore();
    };
    const tcols = ['#6fa88b', '#7cb48a', '#5f9a86', '#8bbb86', '#6aa8a4'];
    for (let i = 0; i < 22; i++) tree(rnd() * W, 960 + rnd() * 300, 0.85 + rnd() * 0.9, tcols[(rnd() * tcols.length) | 0]);

    // Deer
    const deer = (x, y, s) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = '#c99361';
      c.beginPath(); c.ellipse(0, 0, 44, 24, 0, 0, 7); c.fill();
      c.fillRect(-34, 10, 7, 38); c.fillRect(-14, 12, 7, 38); c.fillRect(16, 12, 7, 38); c.fillRect(32, 10, 7, 38);
      c.beginPath(); c.moveTo(26, -10); c.lineTo(48, -52); c.lineTo(64, -46); c.lineTo(46, -4); c.fill();
      c.beginPath(); c.ellipse(58, -52, 16, 11, 0.3, 0, 7); c.fill();
      c.fillStyle = '#e8d2b0'; c.beginPath(); c.ellipse(-4, 8, 30, 12, 0, 0, 7); c.fill();
      c.fillStyle = '#6d4a31'; c.beginPath(); c.arc(63, -54, 2.6, 0, 7); c.fill();
      c.strokeStyle = '#8c6a4c'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(52, -62); c.lineTo(48, -84); c.moveTo(60, -62); c.lineTo(62, -84); c.stroke();
      c.restore();
    };
    deer(560, 1010, 1.25); deer(1350, 1090, 1.0);

    // Bears
    const bear = (x, y, s) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = '#c4915d';
      c.beginPath(); c.ellipse(0, 0, 30, 22, 0, 0, 7); c.fill();
      c.beginPath(); c.arc(24, -14, 15, 0, 7); c.fill();
      c.beginPath(); c.arc(16, -26, 6, 0, 7); c.arc(32, -26, 6, 0, 7); c.fill();
      c.fillRect(-22, 10, 9, 18); c.fillRect(8, 10, 9, 18);
      c.restore();
    };
    bear(200, 1150, 1.1); bear(900, 1180, 1.3); bear(1650, 1060, 0.95);

    // Flowers and sparkles
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = 1000 + rnd() * 400;
      c.fillStyle = ['#f5e08f', '#f2f0e0', '#f0b6a6'][(rnd() * 3) | 0];
      c.beginPath(); c.arc(x, y, 4 + rnd() * 4, 0, 7); c.fill();
    }
  }, { repeat: [1, 1], aniso: 8 });
}

/** Floor boards (planks run along z). */
function floorTexture() {
  const S = 1024, planks = 10, pw = S / planks;
  const rnd = mulberry32(21);
  return canvasTex(S, S, (c) => {
    for (let i = 0; i < planks; i++) {
      let y = -rnd() * 300;
      while (y < S) {
        const len = 520 + rnd() * 420;
        const h = 31 + rnd() * 6, l = 61 + rnd() * 6;
        c.fillStyle = `hsl(${h},${46 + rnd() * 8}%,${l}%)`;
        c.fillRect(i * pw, y, pw, len);
        // grain
        c.strokeStyle = `rgba(120,70,30,${0.07 + rnd() * 0.06})`;
        c.lineWidth = 1;
        for (let g = 0; g < 7; g++) {
          const gx = i * pw + 6 + rnd() * (pw - 12);
          c.beginPath(); c.moveTo(gx, y); c.bezierCurveTo(gx + 6, y + len * 0.3, gx - 6, y + len * 0.6, gx + 2, y + len); c.stroke();
        }
        c.fillStyle = 'rgba(70,35,10,.5)'; c.fillRect(i * pw, y, pw, 3);
        y += len;
      }
      c.fillStyle = 'rgba(70,35,10,.45)'; c.fillRect(i * pw, 0, 3, S);
    }
  }, { aniso: 8, repeat: [1, 1] });
}

/** Build the room shell; returns the meshes that need to be shadow receivers. */
export function buildRoom(scene, B) {
  const { x0, x1, z0, z1, h } = ROOM;
  const wall = new THREE.MeshStandardMaterial({ map: wallpaperTexture(), vertexColors: true, roughness: 0.92 });
  wall.map.wrapS = wall.map.wrapT = THREE.RepeatWrapping;
  // subtle plaster grain so the walls are not perfectly flat
  wall.bumpMap = noiseTexture(256, 9, 36); wall.bumpMap.wrapS = wall.bumpMap.wrapT = THREE.RepeatWrapping; wall.bumpMap.repeat.set(18, 14); wall.bumpScale = 0.5;
  const floorTex = floorTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: 0.9, vertexColors: true, roughness: 0.46, envMapIntensity: 0.8 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf6efe2, vertexColors: true, roughness: 1 });
  const group = new THREE.Group(); group.name = 'room';

  const TILE = 3.5; // wallpaper tile width in metres (tile height = room height)
  const wallUV = (axis, off = 0) => (p) => [(p[axis] / TILE) + off, p.y / h];

  const add = (geo, mat, cast, name) => {
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; m.name = name; group.add(m); return m;
  };

  // Floor
  const fl = surface(new THREE.Vector3(x0, 0, z1), new THREE.Vector3(x1 - x0, 0, 0), new THREE.Vector3(0, 0, z0 - z1), 40, 130, 'floor',
    (p) => [p.x / 2.4, p.z / 2.4]);
  add(fl, floorMat, false, 'floor');

  // Back wall in four pieces around the window opening
  const bw = (xa, xb, ya, yb, name) => {
    const nx = Math.max(2, Math.round((xb - xa) * 10)), ny = Math.max(2, Math.round((yb - ya) * 10));
    add(surface(new THREE.Vector3(xa, ya, z0), new THREE.Vector3(xb - xa, 0, 0), new THREE.Vector3(0, yb - ya, 0), nx, ny, 'back', wallUV('x')), wall, true, name);
  };
  const Wn = WINDOW;
  bw(x0, Wn.x0, 0, h, 'wall-back-l'); bw(Wn.x1, x1, 0, h, 'wall-back-r');
  bw(Wn.x0, Wn.x1, 0, Wn.y0, 'wall-back-b'); bw(Wn.x0, Wn.x1, Wn.y1, h, 'wall-back-t');

  // Right wall (switch wall), left wall, ceiling
  add(surface(new THREE.Vector3(x1, 0, z0), new THREE.Vector3(0, 0, z1 - z0), new THREE.Vector3(0, h, 0), 130, 20, 'right', wallUV('z', 0.35)), wall, true, 'wall-right');
  add(surface(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(0, h, 0), new THREE.Vector3(0, 0, z1 - z0), 20, 130, 'left', (p) => [p.z / TILE + 0.1, p.y / h]), wall, true, 'wall-left');
  add(surface(new THREE.Vector3(x0, h, z0), new THREE.Vector3(x1 - x0, 0, 0), new THREE.Vector3(0, 0, z1 - z0), 20, 52, 'ceil', () => [0, 0]), ceilMat, false, 'ceiling');
  scene.add(group);

  // Baseboards
  const bb = new THREE.BoxGeometry(1, 0.13, 0.035);
  B.add(bb, 'satin', xf(0, 0.065, z0 + 0.0175, 0, 0, 0, x1 - x0, 1, 1), 0xfaf6ee);
  B.add(bb, 'satin', xf(x1 - 0.0175, 0.065, (z0 + z1) / 2, 0, Math.PI / 2, 0, z1 - z0, 1, 1), 0xfaf6ee);
  B.add(bb, 'satin', xf(x0 + 0.0175, 0.065, (z0 + z1) / 2, 0, Math.PI / 2, 0, z1 - z0, 1, 1), 0xfaf6ee);
  return group;
}
