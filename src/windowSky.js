// Window frame, star curtains and the night world outside (sky, moon, stars, tiny village, trees) + PMREM sky environment.
import * as THREE from 'three';
import { canvasTex, mulberry32, xf, starPath, lerp } from './util.js';
import { WINDOW, ROOM } from './room.js';

/** Night panorama painted once on a canvas and shown on a distant plane. */
function nightTexture() {
  const W = 2048, H = 1024, rnd = mulberry32(42);
  return canvasTex(W, H, (c) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1538'); g.addColorStop(0.55, '#26356f'); g.addColorStop(0.85, '#4a5a98'); g.addColorStop(1, '#5d6aa3');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // stars
    for (let i = 0; i < 140; i++) {
      const x = rnd() * W, y = rnd() * H * 0.62, r = 0.8 + rnd() * 2.0;
      c.fillStyle = `rgba(255,248,220,${0.5 + rnd() * 0.5})`;
      if (rnd() < 0.12) { starPath(c, x, y, 7 + rnd() * 5, 3, 0); c.fill(); } else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    }
    // moon with halo
    const mx = 1000, my = 250;
    const halo = c.createRadialGradient(mx, my, 20, mx, my, 220);
    halo.addColorStop(0, 'rgba(255,240,200,.55)'); halo.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = halo; c.fillRect(mx - 230, my - 230, 460, 460);
    c.fillStyle = '#fff2c8'; c.beginPath(); c.arc(mx, my, 62, 0, 7); c.fill();
    c.fillStyle = '#26356f'; c.beginPath(); c.arc(mx + 30, my - 10, 58, 0, 7); c.fill();
    // distant hills
    c.fillStyle = '#1b2650'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, 720 + Math.sin(x * 0.004) * 50 + Math.sin(x * 0.011) * 22);
    c.lineTo(W, H); c.fill();
    // village
    const house = (x, y, w, h, wins) => {
      c.fillStyle = '#141b3d'; c.fillRect(x, y, w, h);
      c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + w / 2, y - w * 0.45); c.lineTo(x + w + 8, y); c.fill();
      for (let i = 0; i < wins; i++) {
        const wx = x + 12 + (i % 2) * (w - 38), wy = y + 14 + ((i / 2) | 0) * 34;
        const lit = rnd() < 0.8;
        c.fillStyle = lit ? '#ffcf72' : '#26305e'; c.fillRect(wx, wy, 18, 22);
        if (lit) { const gg = c.createRadialGradient(wx + 9, wy + 11, 2, wx + 9, wy + 11, 34); gg.addColorStop(0, 'rgba(255,200,110,.5)'); gg.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = gg; c.fillRect(wx - 30, wy - 28, 78, 78); c.fillStyle = '#ffd98a'; c.fillRect(wx, wy, 18, 22); }
      }
    };
    let x = 120;
    while (x < W - 100) { const w = 70 + rnd() * 50, h = 80 + rnd() * 70; house(x, 800 - h + Math.sin(x * 0.004) * 12, w, h, 2 + ((rnd() * 3) | 0)); x += w + 30 + rnd() * 70; }
    // dark trees
    for (let i = 0; i < 26; i++) {
      const tx = rnd() * W, ty = 820 + rnd() * 80, s = 0.8 + rnd() * 1.3;
      c.fillStyle = '#0c1330'; c.beginPath(); c.ellipse(tx, ty - 60 * s, 34 * s, 62 * s, 0, 0, 7); c.fill();
      c.fillRect(tx - 5 * s, ty - 20, 10 * s, 60 * s);
    }
    c.fillStyle = '#0a1028'; c.fillRect(0, 900, W, H - 900);
  }, { aniso: 4 });
}

/** Star-pattern curtain texture. */
function curtainTexture() {
  const rnd = mulberry32(8);
  return canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#6a86cf'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 8; i++) c.fillRect(i * 32 + 6, 0, 10, h);
    for (let i = 0; i < 12; i++) { starPath(c, rnd() * w, rnd() * h, 24, 11, rnd()); c.fillStyle = rnd() < 0.3 ? '#f5d77a' : '#fbf9f0'; c.fill(); }
  });
}

export function buildWindowSky(scene, B, renderer) {
  const out = {};
  const root = new THREE.Group(); root.name = 'window'; scene.add(root);
  const { x0, x1, y0, y1 } = WINDOW, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0, zw = ROOM.z0;

  // ---- frame: outer frame, 2 vertical + 1 horizontal mullions, sill ----
  const box = new THREE.BoxGeometry(1, 1, 1), FR = 0xfaf6ec;
  const t = 0.11, d = 0.14;
  B.add(box, 'satin', xf(cx, y1 + t / 2, zw + d / 2, 0, 0, 0, w + 2 * t, t, d), FR);
  B.add(box, 'satin', xf(cx, y0 - t / 2, zw + d / 2, 0, 0, 0, w + 2 * t, t, d), FR);
  for (const sx of [-1, 1]) B.add(box, 'satin', xf(cx + sx * (w / 2 + t / 2), cy, zw + d / 2, 0, 0, 0, t, h, d), FR);
  for (let i = 1; i <= 2; i++) B.add(box, 'satin', xf(x0 + (w * i) / 3, cy, zw + 0.04, 0, 0, 0, 0.04, h, 0.05), FR);
  B.add(box, 'satin', xf(cx, cy, zw + 0.04, 0, 0, 0, w, 0.04, 0.05), FR);
  B.add(box, 'satin', xf(cx, y0 - t - 0.02, zw + 0.17, 0, 0, 0, w + 0.4, 0.04, 0.26), FR);
  B.add(box, 'satin', xf(cx, y0 - t - 0.075, zw + 0.1, 0, 0, 0, w + 0.3, 0.07, 0.03), FR);        // apron under the sill
  for (const sx of [-1, 1]) B.add(box, 'satin', xf(cx + sx * (w / 2 + t + 0.02), cy, zw + 0.02, 0, 0, 0, 0.04, h + 2 * t + 0.1, 0.04), FR);  // outer casing
  B.add(box, 'satin', xf(cx, y1 + t + 0.03, zw + 0.03, 0, 0, 0, w + 2 * t + 0.1, 0.06, 0.06), FR);
  // glass: faint, glossy, reflects the environment
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xbcd0ff, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 2.5 }));
  glass.position.set(cx, cy, zw + 0.05); glass.renderOrder = 2; root.add(glass);

  // ---- outside world ----
  const skyMat = new THREE.MeshBasicMaterial({ map: nightTexture(), toneMapped: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), skyMat);
  sky.position.set(cx - 0.6, 2.0, zw - 5.5); root.add(sky);
  // twinkling stars close to the glass (cheap points)
  const rnd = mulberry32(77), sp = new Float32Array(60 * 3);
  for (let i = 0; i < 60; i++) { sp[i * 3] = cx + (rnd() - 0.5) * 4.5; sp[i * 3 + 1] = 1.7 + rnd() * 1.4; sp[i * 3 + 2] = zw - 3 - rnd(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfff6d0, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
  root.add(new THREE.Points(sg, starMat));
  out.sky = skyMat; out.stars = starMat;

  // ---- curtains (pinched by tie-backs) ----
  const curtainTex = curtainTexture();
  const curtainMat = new THREE.MeshPhysicalMaterial({ map: curtainTex, bumpMap: curtainTex, bumpScale: 1.6, roughness: 1, side: THREE.DoubleSide, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xa9bdff) });
  const liningMat = new THREE.MeshStandardMaterial({ color: 0xe9e1cf, roughness: 1, side: THREE.DoubleSide });
  const curtain = (xa, xb, side) => {
    const nx = 24, ny = 28, pos = [], uv = [], idx = [], top = 2.55, bot = 0.12, tieY = 1.15;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny, y = top + (bot - top) * v;
      const pinch = Math.exp(-Math.pow((y - tieY) / 0.35, 2)); // narrower at the tie
      const inner = side < 0 ? xb : xa, outer = side < 0 ? xa : xb;
      const edgeIn = lerp(inner, outer, pinch * 0.62);
      const x = lerp(outer, edgeIn, u);
      const wave = (Math.sin(u * Math.PI * 5 + v * 1.5) * 0.06 + Math.sin(u * Math.PI * 11 + v * 3) * 0.015) * (1 - pinch * 0.4);
      pos.push(x, y, zw + 0.12 + wave + 0.04 * pinch + 0.07 * Math.max(0, 1 - v * 1.5) * 0); uv.push(u, v * 1.2);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, curtainMat); m.castShadow = true; m.receiveShadow = true; root.add(m);
    const lining = new THREE.Mesh(g, liningMat); lining.position.z = -0.035; lining.receiveShadow = true; root.add(lining);   // second layer gives the cloth thickness
    // tie-back band + button
    const tx = lerp(side < 0 ? xb : xa, side < 0 ? xa : xb, 0.3);
    B.add(new THREE.TorusGeometry(0.18, 0.03, 8, 16), 'matte', xf(tx, tieY, zw + 0.2, 0, Math.PI / 2, 0, 1, 1, 1), 0xf3e7c3);
    B.add(new THREE.SphereGeometry(0.045, 12, 8), 'matte', xf(tx, tieY, zw + 0.14), 0xe9c25a);
  };
  curtain(-3.0, -2.25, -1); curtain(-0.75, 0.05, 1);
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 3.5, 10).rotateZ(Math.PI / 2), 'gloss', xf(-1.45, 2.6, zw + 0.1), 0xb08a4a);
  for (const sx of [-3.15, 0.25]) B.add(new THREE.SphereGeometry(0.04, 10, 8), 'gloss', xf(sx, 2.6, zw + 0.1), 0xb08a4a);

  // ---- environment: procedural night sky -> PMREM (subtle reflections) ----
  const envScene = new THREE.Scene();
  const envTex = canvasTex(256, 128, (c, wd, ht) => {
    const g = c.createLinearGradient(0, 0, 0, ht);
    g.addColorStop(0, '#0e1740'); g.addColorStop(0.5, '#3a4a8c'); g.addColorStop(1, '#6a5f78');
    c.fillStyle = g; c.fillRect(0, 0, wd, ht);
    c.fillStyle = '#fff0c0'; c.beginPath(); c.arc(wd * 0.3, ht * 0.3, 7, 0, 7); c.fill();
  });
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide, toneMapped: false })));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.3;
  pm.dispose();

  /** m: 1 = room lit, 0 = night */
  out.setMood = (m) => { skyMat.color.setScalar(lerp(1.0, 0.72, m)); starMat.opacity = lerp(0.95, 0.55, m); };
  out.update = (dt, t) => { starMat.size = 2.6 + Math.sin(t * 1.7) * 0.5; };
  return out;
}
