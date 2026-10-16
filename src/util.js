// Shared helpers: seeded RNG, canvas textures, transforms, geometry builders and a per-material geometry batcher.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small deterministic RNG so the room looks identical on every load. */
export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

/** Draw into a 2D canvas and wrap it as a texture. */
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

const _o = new THREE.Object3D();
/** Build a Matrix4 from position / euler rotation / scale. */
export function xf(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _o.position.set(px, py, pz); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz);
  _o.updateMatrix();
  return _o.matrix.clone();
}

/** Box with rounded/bevelled edges (centered). */
export function softBox(w, h, d, b = 0.02) {
  b = Math.min(b, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const iw = w - 2 * b, ih = h - 2 * b, r = Math.min(b * 1.5, iw / 2, ih / 2);
  const s = new THREE.Shape();
  s.moveTo(-iw / 2 + r, -ih / 2); s.lineTo(iw / 2 - r, -ih / 2); s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + r);
  s.lineTo(iw / 2, ih / 2 - r); s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - r, ih / 2);
  s.lineTo(-iw / 2 + r, ih / 2); s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - r);
  s.lineTo(-iw / 2, -ih / 2 + r); s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + r, -ih / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

/** Rounded rectangle shape (centered) for plates / panels. */
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** 5-point (or n-point) star outline. */
export function starShape(R, r, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** Draw a star path on a 2D canvas context. */
export function starPath(ctx, cx, cy, R, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rot + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

/** Cheap smooth value noise in [0,1) for vertex colour variation. */
export function vnoise(x, y, z) {
  const h = (i, j, k) => { const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    r += h(xi + a, yi + b, zi + c) * (a ? s(xf) : 1 - s(xf)) * (b ? s(yf) : 1 - s(yf)) * (c ? s(zf) : 1 - s(zf));
  }
  return r;
}

/** Soft pine grain: near-white with warm brown streaks (multiplies the vertex colour). */
export function woodGrainTexture() {
  const rnd = mulberry32(31);
  return canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#f4ead8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * w, a = 0.03 + rnd() * 0.07, lw = 0.6 + rnd() * 2.2, ph = rnd() * 6;
      c.strokeStyle = `rgba(140,86,40,${a})`; c.lineWidth = lw; c.beginPath();
      for (let y = 0; y <= h; y += 16) {
        const xx = x + Math.sin(y * 0.02 + ph) * 5 + Math.sin(y * 0.07 + ph) * 1.2;
        if (y) c.lineTo(xx, y); else c.moveTo(xx, y);
      }
      c.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const kx = rnd() * w, ky = rnd() * h, g = c.createRadialGradient(kx, ky, 1, kx, ky, 14);
      g.addColorStop(0, 'rgba(120,70,30,.14)'); g.addColorStop(1, 'rgba(120,70,30,0)');
      c.fillStyle = g; c.fillRect(kx - 16, ky - 16, 32, 32);
    }
  }, { repeat: [1, 1], aniso: 4 });
}

/** Soft plaster / fabric speckle used as a bump map. */
export function noiseTexture(size = 256, seed = 4, contrast = 40) {
  const rnd = mulberry32(seed);
  return canvasTex(size, size, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 128 + (rnd() - 0.5) * contrast * 2; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  }, { linear: true, repeat: [1, 1], aniso: 1 });
}

export const ellipsoid = (rx, ry, rz, ws = 28, hs = 18) => new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz);

/** Radial glow texture used by additive sprites. */
let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  _glow = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  return _glow;
}

/** Additive glow sprite (cheap bloom substitute). */
export function glowSprite(color, scale) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  s.renderOrder = 10;
  return s;
}

/**
 * Collects many static geometries (already positioned) and merges them per shared material.
 * Per-vertex colours carry the tint, so a handful of PBR materials covers the whole room.
 */
export class Batcher {
  constructor() {
    this.mats = {
      matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
      satin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 }),
      gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0 }),
      wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, map: woodGrainTexture() }),
    };
    this.mats.wood.map.wrapS = this.mats.wood.map.wrapT = THREE.RepeatWrapping;
    this.mats.wood.bumpMap = this.mats.wood.map; this.mats.wood.bumpScale = 0.3;
    this.lists = { matte: [], satin: [], gloss: [], wood: [] };
    this.noShadow = { matte: [], satin: [], gloss: [], wood: [] };
  }

  /** Add a geometry: kind = matte|satin|gloss, matrix optional, color = sRGB hex (multiplies any existing colour attr). */
  add(geo, kind, matrix, color = 0xffffff, castShadow = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (kind === 'wood') {              // planar projection along the dominant normal axis so grain follows each board
      const p = g.attributes.position, nn = g.attributes.normal, uvs = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i));
        let u, v;
        if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
        uvs[i * 2] = u * 1.7; uvs[i * 2 + 1] = v * 1.7;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const c = new THREE.Color(color);
    const col = g.attributes.color;
    if (col && col.itemSize === 3) {
      for (let i = 0; i < n; i++) col.setXYZ(i, col.getX(i) * c.r, col.getY(i) * c.g, col.getZ(i) * c.b);
    } else {
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    (castShadow ? this.lists : this.noShadow)[kind].push(g);
    return g;
  }

  /** Merge and add the meshes to a parent. Returns stats. */
  build(parent) {
    let tris = 0, meshes = 0;
    for (const [lists, cast] of [[this.lists, true], [this.noShadow, false]]) {
      for (const kind of Object.keys(lists)) {
        if (!lists[kind].length) continue;
        const merged = mergeGeometries(lists[kind], false);
        lists[kind].forEach((g) => g.dispose());
        const mesh = new THREE.Mesh(merged, this.mats[kind]);
        mesh.castShadow = cast; mesh.receiveShadow = true;
        mesh.name = `static-${kind}-${cast ? 'cast' : 'nocast'}`;
        parent.add(mesh);
        tris += merged.attributes.position.count / 3; meshes++;
        lists[kind].length = 0;
      }
    }
    return { tris, meshes };
  }
}
