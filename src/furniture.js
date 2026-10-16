const ROOMX1 = 2.3;
// Furniture and props. Static pieces go into the shared Batcher; textured / animated pieces are separate meshes.
import * as THREE from 'three';
import { noiseTexture, canvasTex, mulberry32, xf, softBox, starShape, starPath, ellipsoid, glowSprite, roundRectShape } from './util.js';

const PI = Math.PI;
const WOOD = 0xe9b676, WOOD_D = 0xc98f55, CREAM = 0xf7efdc, BLUE = 0x4a6fb8;

// Bed layout (shared with rabbit.js)
export const BED = { x: -1.5, w: 1.2, zHead: -2.95, zFoot: -0.35, top: 0.56 };

function quiltTexture() {
  const rnd = mulberry32(5);
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#3f63ad'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 6; i++) c.fillRect(0, i * 90, w, 2);
    for (let i = 0; i < 26; i++) {
      starPath(c, rnd() * w, rnd() * h, 20 + rnd() * 10, 9 + rnd() * 4, rnd() * 1.2);
      c.fillStyle = rnd() < 0.2 ? '#f4d46e' : '#f3f1ea'; c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.setLineDash([8, 7]);
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, h); c.stroke(); }
  }, { repeat: [1, 1] });
}

function plaidTexture() {
  return canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#f5ecd2'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(244,206,110,.55)';
    for (let i = 0; i < 4; i++) { c.fillRect(i * 32 + 8, 0, 14, h); c.fillRect(0, i * 32 + 8, w, 14); }
    c.fillStyle = 'rgba(255,255,255,.4)';
    for (let i = 0; i < 4; i++) c.fillRect(i * 32 + 12, 0, 4, h);
  });
}

/** Quilt / blanket height field draped over the lower part of the bed and the sleeping rabbit. */
function quiltGeometry(zA, zB, lift, hw) {
  const nx = 28, nz = 40, pos = [], uv = [], idx = [];
  const x0 = BED.x;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / nz;
    const lx = (u - 0.5) * 2 * hw;                 // local x (−hw..hw)
    const z = zA + (zB - zA) * v;
    const body = Math.max(0, 1 - Math.pow(Math.abs(lx) / 0.62, 2.2)) * (0.3 * Math.min(1, (z - zA) / 0.25 + 0.15) * (1 - 0.5 * Math.max(0, (z + 1.1) / 0.8)));
    const edge = Math.max(0, Math.abs(lx) - 0.5);
    const drape = Math.min(0.5, edge * edge * 3.6) + Math.max(0, z - (BED.zFoot - 0.18)) * 2.4;
    const puff = 0.014 * Math.abs(Math.sin(u * Math.PI * 4)) + 0.01 * Math.abs(Math.sin(v * Math.PI * 7));
    const fold = 0.022 * Math.sin(lx * 5.5 + z * 2.2) + 0.012 * Math.sin(lx * 13 - z * 5) * Math.min(1, edge * 6 + 0.3);
    const wr = puff + fold;
    const y = BED.top + 0.03 + lift + body - drape + wr;
    pos.push(x0 + lx * (1 + drape * 0.1), y, z); uv.push(u, v);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
    idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildFurniture(scene, B, ctx) {
  const out = { quilt: null, glowTargets: {}, hit: {}, anim: {} };
  const root = new THREE.Group(); root.name = 'furniture'; scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);
  const sph = new THREE.SphereGeometry(1, 20, 14);

  // ---------------- Bed ----------------
  const bx = BED.x, bw = BED.w, zh = BED.zHead, zf = BED.zFoot, zc = (zh + zf) / 2, bl = zf - zh;
  // posts + knobs
  for (const [sx, zz, hgt] of [[-1, zh + 0.05, 1.12], [1, zh + 0.05, 1.12], [-1, zf - 0.05, 0.82], [1, zf - 0.05, 0.82]]) {
    B.add(softBox(0.09, hgt, 0.09, 0.02), 'wood', xf(bx + sx * (bw / 2 + 0.03), hgt / 2, zz), WOOD);
    B.add(sph, 'wood', xf(bx + sx * (bw / 2 + 0.03), hgt + 0.045, zz, 0, 0, 0, 0.068, 0.068, 0.068), WOOD_D);
  }
  // side rails + slats base
  for (const sx of [-1, 1]) B.add(softBox(0.05, 0.17, bl - 0.1, 0.012), 'wood', xf(bx + sx * (bw / 2 + 0.03), 0.34, zc), WOOD);
  B.add(softBox(bw + 0.02, 0.05, bl - 0.1, 0.012), 'wood', xf(bx, 0.3, zc), WOOD_D);
  // headboard (tall panel) and footboard with star cut-out
  B.add(softBox(bw + 0.12, 0.6, 0.06, 0.015), 'wood', xf(bx, 0.7, zh + 0.04), WOOD);
  {
    const fw = bw + 0.12, fh = 0.46;
    const s = roundRectShape(fw, fh, 0.05);
    const hole = starShape(0.095, 0.042, 5); hole.autoClose = true;
    const path = new THREE.Path(hole.getPoints()); s.holes.push(path);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -0.0175);
    B.add(g, 'wood', xf(bx, 0.5, zf - 0.04), WOOD);
    B.add(softBox(fw + 0.02, 0.06, 0.07, 0.02), 'wood', xf(bx, 0.76, zf - 0.04), WOOD_D);
  }
  // mattress, sheet edge
  B.add(softBox(bw - 0.02, 0.2, bl - 0.12, 0.07), 'matte', xf(bx, BED.top - 0.11, zc), 0xf1ead8);

  // pillows
  const plaidTex = plaidTexture(); plaidTex.wrapS = plaidTex.wrapT = THREE.RepeatWrapping; plaidTex.repeat.set(2.2, 2.2);
  const plaid = new THREE.MeshPhysicalMaterial({ map: plaidTex, bumpMap: plaidTex, bumpScale: 1.2, roughness: 1, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff2d0) });
  const pillowGeo = softBox(0.66, 0.16, 0.5, 0.07);
  const p1 = new THREE.Mesh(pillowGeo, plaid); p1.position.set(bx, BED.top + 0.13, zh + 0.38); p1.rotation.set(-0.12, 0, 0); p1.scale.set(1, 1.6, 1);
  const p2 = new THREE.Mesh(pillowGeo, plaid); p2.position.set(bx + 0.1, BED.top + 0.32, zh + 0.2); p2.rotation.set(-0.35, 0.1, 0.0); p2.scale.set(0.9, 1.5, 0.9);
  for (const p of [p1, p2]) { p.castShadow = p.receiveShadow = true; root.add(p); }
  // yellow star cushion
  {
    const g = new THREE.ExtrudeGeometry(starShape(0.2, 0.1, 5), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4 });
    g.translate(0, 0, -0.035);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xf7cc4c, roughness: 0.9 }));
    m.position.set(bx + 0.62, BED.top + 0.34, zh + 0.38); m.rotation.set(-0.5, -0.5, 0.35);
    m.castShadow = m.receiveShadow = true; root.add(m);
  }

  // quilt + cream blanket (animated gently by the rabbit's breathing group)
  const quiltTex = quiltTexture();   // the same texture drives a bump map so the stars read as raised appliqué on the fabric
  const qMat = new THREE.MeshPhysicalMaterial({ map: quiltTex, bumpMap: quiltTex, bumpScale: 2.2, roughness: 1, side: THREE.DoubleSide, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x9bb4ff) });
  const quilt = new THREE.Mesh(quiltGeometry(zh + 0.8, zf + 0.02, 0, 0.74), qMat); quilt.castShadow = quilt.receiveShadow = true;
  const blanket = new THREE.Mesh(quiltGeometry(zh + 0.66, zh + 0.98, 0.03, 0.72), new THREE.MeshPhysicalMaterial({ color: 0xf6ecd4, roughness: 1, side: THREE.DoubleSide, bumpMap: noiseTexture(128, 6, 50), bumpScale: 1.5, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff4dc) }));
  blanket.castShadow = blanket.receiveShadow = true;
  out.quilt = quilt; out.blanket = blanket;

  // ---------------- Bedside table + bunny night light ----------------
  const tx = -2.6, tz = -2.3;
  B.add(softBox(0.52, 0.06, 0.46, 0.02), 'wood', xf(tx, 0.6, tz), WOOD);
  B.add(softBox(0.46, 0.44, 0.4, 0.015), 'wood', xf(tx, 0.35, tz), WOOD_D);
  B.add(softBox(0.38, 0.16, 0.02, 0.008), 'wood', xf(tx, 0.45, tz + 0.205), WOOD);
  B.add(sph, 'gloss', xf(tx, 0.45, tz + 0.225, 0, 0, 0, 0.022, 0.022, 0.022), 0xb9783d);
  B.add(softBox(0.38, 0.16, 0.02, 0.008), 'wood', xf(tx, 0.27, tz + 0.205), WOOD);
  B.add(sph, 'gloss', xf(tx, 0.27, tz + 0.225, 0, 0, 0, 0.022, 0.022, 0.022), 0xb9783d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(softBox(0.05, 0.14, 0.05, 0.01), 'wood', xf(tx + sx * 0.22, 0.07, tz + sz * 0.19), WOOD);
  // books on the table
  B.add(softBox(0.28, 0.035, 0.2, 0.008), 'matte', xf(tx + 0.0, 0.65, tz + 0.1, 0, 0.15, 0), 0x6aa5c8);
  B.add(softBox(0.26, 0.03, 0.19, 0.008), 'matte', xf(tx + 0.01, 0.68, tz + 0.1, 0, -0.1, 0), 0xe9c25a);
  // night light bunny (emissive, separate material so we can animate it)
  const nlMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd49a, emissiveIntensity: 0.9, roughness: 0.6 });
  const nl = new THREE.Group(); nl.position.set(tx - 0.04, 0.63, tz - 0.08);
  const nlBody = new THREE.Mesh(ellipsoid(0.065, 0.075, 0.06), nlMat); nlBody.position.y = 0.075;
  const nlHead = new THREE.Mesh(ellipsoid(0.05, 0.05, 0.045), nlMat); nlHead.position.y = 0.17;
  const nlEarL = new THREE.Mesh(ellipsoid(0.017, 0.06, 0.014), nlMat); nlEarL.position.set(-0.025, 0.25, 0); nlEarL.rotation.z = 0.12;
  const nlEarR = nlEarL.clone(); nlEarR.position.x = 0.025; nlEarR.rotation.z = -0.12;
  nl.add(nlBody, nlHead, nlEarL, nlEarR);
  nl.rotation.y = 0.5;
  root.add(nl);
  const nlGlow = glowSprite(0xffc88a, 0.7); nlGlow.position.set(tx - 0.04, 0.8, tz - 0.08); root.add(nlGlow);
  const nlHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  nlHit.position.set(tx - 0.04, 0.8, tz - 0.08); nlHit.name = 'nightlight'; root.add(nlHit);
  out.nightlight = { mat: nlMat, glow: nlGlow, pos: nlGlow.position.clone(), hit: nlHit };

  // ---------------- Desk, chair ----------------
  const dx = 0.75, dz = -2.6, dh = 0.72;
  B.add(softBox(1.3, 0.05, 0.62, 0.015), 'wood', xf(dx, dh, dz), WOOD);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(softBox(0.06, dh, 0.06, 0.012), 'wood', xf(dx + sx * 0.6, dh / 2, dz + sz * 0.26), WOOD_D);
  B.add(softBox(1.1, 0.12, 0.5, 0.01), 'wood', xf(dx, dh - 0.1, dz), WOOD);
  B.add(softBox(0.45, 0.1, 0.02, 0.008), 'wood', xf(dx - 0.25, dh - 0.1, dz + 0.255), WOOD_D);
  B.add(sph, 'gloss', xf(dx - 0.25, dh - 0.1, dz + 0.275, 0, 0, 0, 0.02, 0.02, 0.02), 0xb9783d);
  B.add(softBox(0.45, 0.1, 0.02, 0.008), 'wood', xf(dx + 0.25, dh - 0.1, dz + 0.255), WOOD_D);
  B.add(sph, 'gloss', xf(dx + 0.25, dh - 0.1, dz + 0.275, 0, 0, 0, 0.02, 0.02, 0.02), 0xb9783d);
  // chair
  {
    const cx = dx + 0.05, cz = dz + 0.85;
    B.add(softBox(0.4, 0.045, 0.4, 0.012), 'wood', xf(cx, 0.4, cz), WOOD);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(softBox(0.045, 0.4, 0.045, 0.01), 'wood', xf(cx + sx * 0.17, 0.2, cz + sz * 0.17), WOOD_D);
    for (const sx of [-1, 1]) B.add(softBox(0.045, 0.45, 0.045, 0.01), 'wood', xf(cx + sx * 0.17, 0.65, cz + 0.17), WOOD_D);
    const shp = roundRectShape(0.4, 0.34, 0.12);
    const bg = new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    B.add(bg, 'wood', xf(cx, 0.76, cz + 0.15), WOOD);
    const kn = new THREE.Shape(); kn.absarc(0, 0, 0.06, 0, PI * 2);
    B.add(new THREE.ExtrudeGeometry(kn, { depth: 0.04, bevelEnabled: false }), 'matte', xf(cx, 0.775, cz + 0.186), WOOD_D);
  }

  // ---------------- Toy train on desk (also tappable) ----------------
  const train = new THREE.Group(); train.position.set(dx - 0.1, dh + 0.025, dz + 0.05);
  const tm = (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const matBlue = tm(0x3a6fc0), matRed = tm(0xd8493b), matYel = tm(0xf3c43b), matGrn = tm(0x6bb558), matOrg = tm(0xf08a35), matWood = tm(0xd9a566), matWheel = tm(0x4a3a2c);
  const mk = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; train.add(m); return m; };
  const wheelGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12).rotateZ(PI / 2);
  const car = (x, mat, load) => {
    mk(softBox(0.15, 0.05, 0.1, 0.01), matWood, x, 0.03, 0);
    mk(softBox(0.14, 0.07, 0.09, 0.012), mat, x, 0.095, 0);
    if (load) mk(softBox(0.1, 0.03, 0.07, 0.01), load, x, 0.15, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(wheelGeo, matWheel, x + sx * 0.045, 0.028, sz * 0.055, false);
  };
  // engine
  mk(softBox(0.2, 0.05, 0.1, 0.01), matWood, 0.38, 0.03, 0);
  mk(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 16).rotateZ(PI / 2), matBlue, 0.35, 0.09, 0);
  mk(softBox(0.08, 0.11, 0.095, 0.012), matRed, 0.44, 0.115, 0);
  mk(new THREE.CylinderGeometry(0.018, 0.026, 0.06, 12), matYel, 0.3, 0.17, 0);
  mk(new THREE.SphereGeometry(0.03, 10, 8), matYel, 0.33, 0.14, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(wheelGeo, matWheel, 0.38 + sx * 0.06, 0.028, sz * 0.055, false);
  car(0.2, matGrn, matYel); car(0.03, matOrg, matRed); car(-0.14, matYel, matBlue);
  const matWin = new THREE.MeshStandardMaterial({ color: 0x9fd0f0, roughness: 0.1, metalness: 0.2 });
  const matLamp = new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd36a, emissiveIntensity: 0.7, roughness: 0.3 });
  for (const sz of [-1, 1]) { mk(softBox(0.04, 0.045, 0.006, 0.002), matWin, 0.44, 0.13, sz * 0.049, false); mk(new THREE.BoxGeometry(0.04, 0.012, 0.01), matYel, 0.44, 0.18, sz * 0.0, false); }
  mk(new THREE.SphereGeometry(0.017, 10, 8), matLamp, 0.485, 0.095, 0, false);
  mk(new THREE.BoxGeometry(0.03, 0.02, 0.095), matRed, 0.495, 0.03, 0, false);
  mk(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 14).rotateZ(PI / 2), matYel, 0.42, 0.09, 0, false);
  for (const cx of [0.27, 0.115, -0.055]) mk(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6).rotateZ(PI / 2), matWheel, cx, 0.035, 0, false);
  for (const cx of [0.2, 0.03, -0.14]) for (const sz of [-1, 1]) mk(softBox(0.04, 0.03, 0.006, 0.002), matWin, cx, 0.1, sz * 0.046, false);
  train.scale.setScalar(1.15); train.position.z += 0.06;
  root.add(train);
  out.anim.train = train;
  const trainHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  trainHit.position.set(dx + 0.1, dh + 0.12, dz + 0.05); trainHit.name = 'train'; root.add(trainHit);
  out.hit.train = trainHit;

  // crayon cup + books on desk
  B.add(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 18), 'matte', xf(dx + 0.52, dh + 0.075, dz - 0.12), 0xf4e6c4);
  const cols = [0xe0584a, 0xf0b13b, 0x5aa66b, 0x4a8fd0, 0xa66bc4, 0xf08aa0];
  cols.forEach((c, i) => {
    const a = (i / cols.length) * PI * 2;
    B.add(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 8), 'matte', xf(dx + 0.52 + Math.cos(a) * 0.022, dh + 0.17, dz - 0.12 + Math.sin(a) * 0.022, Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18), c);
  });
  [[0x4aa4a8, 0.27, 0.04], [0xe9a14b, 0.25, 0.035], [0xd8657a, 0.23, 0.04]].forEach(([c, w, h], i) => {
    const y = dh + 0.025 + h / 2 + [0, 0.04, 0.075][i];
    B.add(softBox(w, h, 0.19, 0.008), 'matte', xf(dx - 0.5 + (i === 1 ? 0.01 : -0.01), y, dz - 0.1, 0, [0.1, -0.08, 0.05][i], 0), c);
    B.add(softBox(w - 0.02, h - 0.012, 0.185, 0.004), 'matte', xf(dx - 0.5 + (i === 1 ? 0.01 : -0.01) + 0.012, y, dz - 0.1 + 0.005, 0, [0.1, -0.08, 0.05][i], 0), 0xf6efde);
  });

  // ---------------- Wall shelves: plant, house, teddy, books ----------------
  const sx0 = 0.95;
  const shelf = (y) => {
    B.add(softBox(0.95, 0.04, 0.24, 0.01), 'wood', xf(sx0, y, ctx.zWall + 0.12), WOOD);
    for (const sx of [-1, 1]) B.add(softBox(0.04, 0.14, 0.2, 0.01), 'wood', xf(sx0 + sx * 0.33, y - 0.09, ctx.zWall + 0.1), WOOD_D);
  };
  shelf(1.58); shelf(2.02);
  const teddyCol = 0xd69b5c;
  // teddy on lower shelf
  const ty = 1.6;
  B.add(ellipsoid(0.1, 0.11, 0.08), 'matte', xf(sx0 + 0.25, ty + 0.11, ctx.zWall + 0.13), teddyCol);
  B.add(ellipsoid(0.08, 0.075, 0.07), 'matte', xf(sx0 + 0.25, ty + 0.25, ctx.zWall + 0.14), teddyCol);
  for (const sx of [-1, 1]) {
    B.add(ellipsoid(0.03, 0.03, 0.02), 'matte', xf(sx0 + 0.25 + sx * 0.06, ty + 0.31, ctx.zWall + 0.14), teddyCol);
    B.add(ellipsoid(0.035, 0.06, 0.035), 'matte', xf(sx0 + 0.25 + sx * 0.12, ty + 0.12, ctx.zWall + 0.14, 0, 0, sx * 0.4), teddyCol);
    B.add(ellipsoid(0.04, 0.05, 0.04), 'matte', xf(sx0 + 0.25 + sx * 0.06, ty + 0.03, ctx.zWall + 0.17), teddyCol);
    B.add(sph, 'gloss', xf(sx0 + 0.25 + sx * 0.03, ty + 0.265, ctx.zWall + 0.205, 0, 0, 0, 0.009), 0x2a1c14);
  }
  B.add(ellipsoid(0.035, 0.026, 0.02), 'matte', xf(sx0 + 0.25, ty + 0.235, ctx.zWall + 0.205), 0xefd7b0);
  // books lower shelf
  [[0xd8574a, 0.2], [0x4b7fbf, 0.17], [0x5aa66b, 0.19], [0xf0b13b, 0.16]].forEach(([c, h], i) => {
    B.add(softBox(0.035, h, 0.16, 0.006), 'matte', xf(sx0 - 0.38 + i * 0.045, 1.6 + h / 2, ctx.zWall + 0.13, 0, 0, i === 3 ? 0.18 : 0), c);
  });
  // upper shelf: bird house + plant
  B.add(softBox(0.12, 0.1, 0.1, 0.008), 'satin', xf(sx0 - 0.28, 2.09, ctx.zWall + 0.13), 0xf1dcb0);
  B.add(new THREE.ConeGeometry(0.1, 0.07, 4), 'satin', xf(sx0 - 0.28, 2.18, ctx.zWall + 0.13, 0, PI / 4, 0), 0xd8574a);
  B.add(cyl, 'matte', xf(sx0 - 0.28, 2.09, ctx.zWall + 0.18, PI / 2, 0, 0, 0.022, 0.01, 0.022), 0x6a4a35);
  B.add(new THREE.CylinderGeometry(0.075, 0.06, 0.12, 14), 'matte', xf(sx0 + 0.2, 2.1, ctx.zWall + 0.13), 0xc8c0b0);
  B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 14), 'matte', xf(sx0 + 0.2, 2.16, ctx.zWall + 0.13), 0x4a3524);
  // plant leaves (hanging vines, instanced)
  {
    const rnd = mulberry32(11), leaf = new THREE.SphereGeometry(1, 8, 6);
    const im = new THREE.InstancedMesh(leaf, new THREE.MeshStandardMaterial({ color: 0x4f8f4a, roughness: 0.8 }), 70);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < 70; i++) {
      const vine = i % 5, t = (i / 5 | 0) / 14;
      const hang = [0.0, 0.1, -0.1, 0.18, -0.2][vine];
      p.set(sx0 + 0.2 + hang + (rnd() - 0.5) * 0.05 + Math.sin(t * 4 + vine) * 0.03, 2.2 - t * [0.5, 0.65, 0.4, 0.3, 0.55][vine] - (vine === 0 ? 0 : 0.0), ctx.zWall + 0.17 + (rnd() - 0.5) * 0.04);
      if (t < 0.05) p.y += 0.08 + rnd() * 0.08;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
      s.set(0.04, 0.012, 0.025).multiplyScalar(0.9 + rnd() * 0.9);
      m.compose(p, q, s); im.setMatrixAt(i, m);
      im.setColorAt(i, c.setHSL(0.3 + rnd() * 0.05, 0.4 + rnd() * 0.15, 0.3 + rnd() * 0.12));
    }
    im.castShadow = true; root.add(im);
  }

  // ---------------- Floor lamp ----------------
  const lx = 1.9, lz = -1.95;
  {
    const prof = [[0.0, 0], [0.23, 0], [0.235, 0.012], [0.22, 0.026], [0.16, 0.04], [0.08, 0.07], [0.045, 0.12], [0.03, 0.2], [0.026, 0.3]].map(([r, y]) => new THREE.Vector2(r, y));
    B.add(new THREE.LatheGeometry(prof, 32), 'gloss', xf(lx, 0, lz), 0x8e6c3c);
    for (const y of [0.55, 0.9, 1.25]) B.add(new THREE.TorusGeometry(0.024, 0.009, 8, 16).rotateX(PI / 2), 'gloss', xf(lx, y, lz), 0xc2a05a);
  }
  B.add(new THREE.CylinderGeometry(0.018, 0.018, 1.45, 10), 'gloss', xf(lx, 0.74, lz), 0xa2803f);
  B.add(sph, 'gloss', xf(lx, 1.5, lz, 0, 0, 0, 0.035), 0xa2803f);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf8e7bd, emissive: 0xffbf70, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.31, 0.38, 40, 1, true), shadeMat);
  shadeMat.bumpMap = noiseTexture(128, 15, 45); shadeMat.bumpMap.wrapS = shadeMat.bumpMap.wrapT = THREE.RepeatWrapping; shadeMat.bumpMap.repeat.set(8, 2); shadeMat.bumpScale = 1.2;
  for (const [y, r] of [[1.5, 0.31], [1.88, 0.2]]) { const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 40).rotateX(PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a45a, roughness: 0.4, metalness: 0.3 })); trim.position.set(lx, y + 0.0, lz); root.add(trim); }
  shade.position.set(lx, 1.69, lz); root.add(shade); // does not cast shadows (light sits inside)
  const lampGlow = glowSprite(0xffb870, 1.7); lampGlow.position.set(lx, 1.69, lz + 0.05); root.add(lampGlow);
  out.lamp = { mat: shadeMat, glow: lampGlow, pos: new THREE.Vector3(lx, 1.62, lz) };

  // ---------------- Rug with train track + trees ----------------
  const rugTex = canvasTex(1024, 1024, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.fillStyle = '#efe6cf'; c.beginPath(); c.arc(cx, cy, 500, 0, 7); c.fill();
    c.fillStyle = '#5f86c4'; c.beginPath(); c.arc(cx, cy, 470, 0, 7); c.fill();
    c.fillStyle = '#f3ead2'; c.beginPath(); c.arc(cx, cy, 400, 0, 7); c.fill();
    c.fillStyle = '#c9dfc1'; c.beginPath(); c.arc(cx, cy, 380, 0, 7); c.fill();
    c.strokeStyle = '#a07650'; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.ellipse(cx, cy + 30, 250, 150, -0.15, 0, 7); c.stroke();
    c.lineWidth = 6; c.strokeStyle = '#7e5a3a';
    for (let a = 0; a < 40; a++) { const t = (a / 40) * PI * 2; const x = cx + Math.cos(t) * 250, y = cy + 30 + Math.sin(t) * 150; c.beginPath(); c.moveTo(x - 14, y - 4); c.lineTo(x + 14, y + 4); c.stroke(); }
    const tree = (x, y, s, col) => { c.fillStyle = '#80644a'; c.fillRect(x - 5 * s, y, 10 * s, 36 * s); c.fillStyle = col; c.beginPath(); c.ellipse(x, y - 14 * s, 34 * s, 50 * s, 0, 0, 7); c.fill(); };
    [[300, 400, 1.2, '#5e9a6e'], [700, 330, 1, '#79ad72'], [560, 700, 1.1, '#4f9188'], [330, 640, 0.9, '#79ad72'], [760, 620, 1.2, '#5e9a6e']].forEach((t) => tree(...t));
    [[420, 300], [640, 440], [250, 520], [540, 560], [800, 480]].forEach(([x, y], i) => { starPath(c, x, y, 24, 10, i); c.fillStyle = ['#f3cf62', '#e98c6a', '#f3cf62', '#7fb3e8', '#f3cf62'][i]; c.fill(); });
    for (let i = 0; i < 20; i++) { const t = (i / 20) * PI * 2; starPath(c, cx + Math.cos(t) * 435, cy + Math.sin(t) * 435, 18, 8, t); c.fillStyle = '#f3ead2'; c.fill(); }
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.15, 64).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.position.set(0.35, 0.008, 1.35); rug.receiveShadow = true; root.add(rug);

  // ---------------- Toy basket with plushies ----------------
  {
    const bx0 = -1.55, bz0 = 2.55;
    const wicker = canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#c9944f'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 12) { c.fillStyle = y % 24 ? '#b07a3a' : '#dba95f'; c.fillRect(0, y, w, 7); }
      for (let x = 0; x < w; x += 22) { c.fillStyle = 'rgba(100,60,20,.45)'; c.fillRect(x, 0, 4, h); }
    }, { repeat: [3, 1] });
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.48, 28, 1, true), new THREE.MeshStandardMaterial({ map: wicker, roughness: 1, side: THREE.DoubleSide }));
    basket.position.set(bx0, 0.24, bz0); basket.castShadow = basket.receiveShadow = true; root.add(basket);
    B.add(new THREE.TorusGeometry(0.4, 0.02, 8, 28), 'matte', xf(bx0, 0.48, bz0, PI / 2), 0xb07a3a);
    B.add(new THREE.CircleGeometry(0.3, 20), 'matte', xf(bx0, 0.03, bz0, -PI / 2), 0x9a6a30);
    const pc = [0xe9b3c4, 0xf3d078, 0x8fc4a2, 0xf0f0f0, 0xd69b5c, 0x9bb7e8];
    pc.forEach((c, i) => {
      const a = (i / pc.length) * PI * 2, r = i < 4 ? 0.2 : 0;
      B.add(ellipsoid(0.15, 0.17, 0.13), 'matte', xf(bx0 + Math.cos(a) * r, 0.52 + (i > 3 ? 0.14 : 0.0), bz0 + Math.sin(a) * r, 0, a, 0), c);
      B.add(ellipsoid(0.1, 0.1, 0.09), 'matte', xf(bx0 + Math.cos(a) * r * 1.1, 0.74 + (i > 3 ? 0.14 : 0), bz0 + Math.sin(a) * r * 1.1), c);
      if (i % 2 === 0) for (const sx of [-1, 1]) B.add(ellipsoid(0.03, 0.12, 0.02), 'matte', xf(bx0 + Math.cos(a) * r * 1.1 + sx * 0.05, 0.9 + (i > 3 ? 0.14 : 0), bz0 + Math.sin(a) * r * 1.1, 0, 0, sx * 0.2), c);
    });
    // wooden toys on the floor: track loop, blocks, tree block
    const tz0 = 3.1, tx0 = -0.9;
    B.add(new THREE.TorusGeometry(0.46, 0.018, 8, 40, PI * 1.5), 'wood', xf(tx0, 0.02, tz0, -PI / 2, 0, 0, 1, 1, 1), 0xd5a05f);
    B.add(new THREE.TorusGeometry(0.5, 0.018, 8, 40, PI * 1.5), 'wood', xf(tx0, 0.02, tz0, -PI / 2, 0, 0, 1, 1, 1), 0xd5a05f);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 1.5;
      B.add(box, 'wood', xf(tx0 + Math.cos(a) * 0.48, 0.012, tz0 - Math.sin(a) * 0.48, 0, a, 0, 0.1, 0.012, 0.03), 0xa4723d);
    }
    B.add(box, 'wood', xf(tx0 + 0.48, 0.02, tz0 + 0.55, 0, PI / 2, 0, 0.6, 0.02, 0.03), 0xd5a05f);
    const blocks = [[0xd8574a, -0.3, 3.3, 0.3], [0x4b7fbf, -0.05, 3.45, -0.2], [0xf0b13b, -0.2, 3.5, 0.8], [0x5aa66b, 0.1, 3.15, 0.1]];
    blocks.forEach(([c, x, z, r]) => B.add(softBox(0.14, 0.14, 0.14, 0.015), 'satin', xf(x - 1.0, 0.07, z, 0, r, 0), c));
    // tree block (rounded top on a stem)
    B.add(softBox(0.1, 0.1, 0.1, 0.012), 'wood', xf(-2.0, 0.05, 3.5), 0x8d6a45);
    B.add(ellipsoid(0.13, 0.19, 0.13), 'satin', xf(-2.0, 0.22, 3.5), 0x5f9b6a);
    // red toy cart with blue wheel
    B.add(softBox(0.18, 0.1, 0.12, 0.012), 'satin', xf(-1.6, 0.09, 3.7, 0, 0.4, 0), 0xd8493b);
    for (const sx of [-1, 1]) B.add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), 'satin', xf(-1.6 + sx * 0.06 * Math.cos(0.4), 0.04, 3.7 - sx * 0.06 * Math.sin(0.4), PI / 2, 0.4, 0), 0x3a6fc0);
  }

  // toy crate beside the desk
  {
    const cx = 1.58, cz = -2.5;
    B.add(softBox(0.34, 0.03, 0.26, 0.008), 'wood', xf(cx, 0.015, cz), WOOD_D);
    for (const [sx, sz, w, d] of [[0, 1, 0.34, 0.03], [0, -1, 0.34, 0.03], [1, 0, 0.03, 0.26], [-1, 0, 0.03, 0.26]]) B.add(softBox(w, 0.2, d, 0.008), 'wood', xf(cx + sx * 0.155, 0.12, cz + sz * 0.115), WOOD);
    [[0x4b7fbf, -0.07, -0.04, 0.3], [0xd8574a, 0.06, 0.02, -0.2], [0xf0b13b, -0.05, 0.06, 0.6], [0x5aa66b, 0.08, -0.06, 0.1]].forEach(([c, x, z, r], i) => B.add(softBox(0.09, 0.09, 0.09, 0.012), 'satin', xf(cx + x, 0.12 + (i > 1 ? 0.085 : 0), cz + z, 0, r, 0), c));
    B.add(ellipsoid(0.06, 0.07, 0.05), 'matte', xf(cx + 0.02, 0.27, cz), 0xe9b3c4);
  }
  // framed picture on the right wall
  {
    const fr = new THREE.Group(); fr.position.set(ROOMX1 - 0.02, 1.6, -1.15); fr.rotation.y = -PI / 2; root.add(fr);
    const art = canvasTex(256, 200, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1d2a66'); g.addColorStop(1, '#5d78c0'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(170, 62, 26, 0, 7); c.fill(); c.fillStyle = '#1d2a66'; c.beginPath(); c.arc(182, 56, 24, 0, 7); c.fill();
      for (let i = 0; i < 16; i++) { starPath(c, 20 + (i * 53) % 230, 14 + (i * 37) % 90, 5, 2.2, 0); c.fillStyle = '#fff'; c.fill(); }
      c.fillStyle = '#2f6b57'; c.beginPath(); c.moveTo(0, 200); c.quadraticCurveTo(80, 120, 160, 170); c.quadraticCurveTo(220, 140, 256, 160); c.lineTo(256, 200); c.fill();
    });
    B.add(softBox(0.6, 0.48, 0.04, 0.012), 'wood', xf(0, 0, 0.02), WOOD_D); const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshStandardMaterial({ map: art, roughness: 0.6 })); pic.position.z = 0.045; fr.add(pic);
    fr.updateMatrix();
    const g = B.lists.wood[B.lists.wood.length - 1]; g.applyMatrix4(fr.matrix);
  }
  // soft pouf near the desk
  {
    const pm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16).scale(0.3, 0.17, 0.3), new THREE.MeshPhysicalMaterial({ color: 0xf2c867, roughness: 1, bumpMap: noiseTexture(128, 21, 60), bumpScale: 1.5, sheen: 1, sheenColor: new THREE.Color(0xffe9a8), sheenRoughness: 0.6 }));
    pm.position.set(1.45, 0.17, -0.55); pm.castShadow = pm.receiveShadow = true; root.add(pm);
  }

  // ---------------- Modern chandelier (starburst of frosted globes; the ceiling light) ----------------
  {
    // Sits right of centre and high, so it never hangs in front of the rabbit from the gameplay camera.
    const cx = 0.3, cz = 0.2, yc = 2.34;
    const ch = new THREE.Group(); ch.position.set(cx, 0, cz); root.add(ch);
    const black = new THREE.MeshStandardMaterial({ color: 0x23242b, metalness: 0.5, roughness: 0.45, envMapIntensity: 1.2 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd8b873, metalness: 0.9, roughness: 0.28, envMapIntensity: 2.2 });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffc878, emissiveIntensity: 1.8, roughness: 0.55 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; ch.add(m); return m; };
    const up = new THREE.Vector3(0, 1, 0), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    const rod = (p, q, r, mat) => {      // thin cylinder between two points
      v1.copy(q).sub(p); const len = v1.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
      m.position.copy(p).addScaledVector(v1, 0.5); m.quaternion.setFromUnitVectors(up, v1.normalize()); m.castShadow = false; ch.add(m); return m;
    };
    // slim canopy + suspension rod (shadows are off for all parts: the light sits inside the fixture)
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 32), black, 0, 2.785, 0);
    rod(new THREE.Vector3(0, 2.77, 0), new THREE.Vector3(0, yc + 0.04, 0), 0.007, black);
    add(new THREE.SphereGeometry(0.05, 20, 14), brass, 0, yc, 0);
    add(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 20), black, 0, yc + 0.07, 0);
    // eight straight arms at alternating heights, each ending in a frosted globe
    const glows = [], N = 8, hub = new THREE.Vector3(0, yc, 0);
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + 0.2, L = i % 2 ? 0.34 : 0.44, dy = i % 2 ? 0.1 : -0.06;
      const end = new THREE.Vector3(Math.cos(ang) * L, yc + dy, Math.sin(ang) * L);
      rod(hub, end, 0.0065, black);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), brass, end.x, end.y, end.z);
      add(new THREE.SphereGeometry(0.058, 20, 14), bulbMat, end.x, end.y - 0.045, end.z);
      const g = glowSprite(0xffc070, 0.36); g.position.set(end.x, end.y - 0.045, end.z); ch.add(g); glows.push(g);
    }
    // thin brass halo ring and a centre globe underneath
    add(new THREE.TorusGeometry(0.2, 0.005, 6, 48).rotateX(Math.PI / 2), brass, 0, yc - 0.14, 0);
    for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2; rod(hub, new THREE.Vector3(Math.cos(ang) * 0.2, yc - 0.14, Math.sin(ang) * 0.2), 0.004, brass); }
    add(new THREE.SphereGeometry(0.07, 20, 14), bulbMat, 0, yc - 0.15, 0);
    const halo = glowSprite(0xffc27a, 1.4); halo.position.set(0, yc - 0.05, 0); ch.add(halo);
    out.chandelier = { pos: new THREE.Vector3(cx, yc - 0.1, cz), bulbMat, glows, halo };
  }

  root.add(quilt, blanket);
  return out;
}
