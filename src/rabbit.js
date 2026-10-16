// Original blue plush rabbit (human-sized) lying in bed. Procedural geometry only: ellipsoids, tube ears, shell-fur.
// Eyes: dark glossy balls with highlights and fur eyelids that rotate down (closed) / up (open).
import * as THREE from 'three';
import { canvasTex, mulberry32, ellipsoid, smooth, clamp, lerp, vnoise, noiseTexture } from './util.js';
import { BED } from './furniture.js';

const FUR = 0x5f9fe6, FUR_LIGHT = 0x8dbbf2, MUZZLE = 0xb4d0f4, PINK = 0xf3a9bb;
const _c = new THREE.Color();

/** Noise alpha map for fur shells (random speckles, slightly blurred). */
function furNoise() {
  const rnd = mulberry32(99);
  const t = canvasTex(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const v = (rnd() * 255) | 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((y + dy) * w + x + dx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, { linear: true, repeat: [7, 5], aniso: 1 });
  return t;
}

const stitchGeo = new THREE.BoxGeometry(0.03, 0.007, 0.01);
const stitchMat = new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.9 });
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1), _t = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);
function stitches(points, count, parent, closed) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const im = new THREE.InstancedMesh(stitchGeo, stitchMat, count);
  const p = new THREE.Vector3(), tan = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = i / count; curve.getPointAt(u, p); curve.getTangentAt(u, tan);
    _q.setFromUnitVectors(_x, tan.normalize()); _m.compose(p, _q, _s); im.setMatrixAt(i, _m);
  }
  im.castShadow = false; parent.add(im); return im;
}

/** Plush ear: flattened tube along a curve; inner side pink, outside blue (vertex colours). */
function earGeometry(points, width, thick) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], 0)), false, 'catmullrom', 0.5);
  const N = 56, M = 22, pos = [], col = [], uv = [], idx = [];
  const T = new THREE.Vector3(), Nz = new THREE.Vector3(0, 0, 1), Bv = new THREE.Vector3(), P = new THREE.Vector3();
  const pink = new THREE.Color(PINK), blue = new THREE.Color(FUR), out = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    curve.getPointAt(u, P); curve.getTangentAt(u, T);
    Bv.crossVectors(T, Nz).normalize();
    const w = width * (0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, u * 1.25))) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 7)));
    const th = thick * (0.7 + 0.3 * Math.sin(Math.PI * u)) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 7)));
    for (let k = 0; k < M; k++) {
      const a = (k / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(P.x + Bv.x * w * ca, P.y + Bv.y * w * ca, P.z + Nz.z * th * sa);
      const inner = smooth(clamp(sa / 0.4, 0, 1)) * (1 - smooth(clamp((Math.abs(ca) - 0.55) / 0.35, 0, 1))) * smooth(clamp((u - 0.02) / 0.12, 0, 1)) * (1 - smooth(clamp((u - 0.9) / 0.1, 0, 1)));
      out.copy(blue).lerp(pink, inner * 0.95); col.push(out.r, out.g, out.b);
      uv.push(u * 3, (k / M) * 2);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < M; k++) {
    const a = i * M + k, b = i * M + ((k + 1) % M), c = (i + 1) * M + k, d = (i + 1) * M + ((k + 1) % M);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildRabbit(scene, furged) {
  const root = new THREE.Group(); root.name = 'rabbit'; scene.add(root);
  const noise = furNoise();
  // Knit-like bump for the base fabric, plus two shell sets: fine plush (body) and coarser/lighter (belly patch)
  const fabricBump = noiseTexture(128, 12, 60); fabricBump.wrapS = fabricBump.wrapT = THREE.RepeatWrapping; fabricBump.repeat.set(10, 7);
  const baseMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, bumpMap: fabricBump, bumpScale: 1.4, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x9ec6ff) });
  const bellyNoise = noise.clone(); bellyNoise.repeat.set(4, 3); bellyNoise.needsUpdate = true;
  const mkShells = (alphaMap, ts, tint) => ts.map((t, i) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, alphaMap, alphaTest: t });
    m.color.setScalar(tint + i * 0.04); return m;
  });
  const shellSets = { body: mkShells(noise, [0.3, 0.45, 0.6], 1.03), belly: mkShells(bellyNoise, [0.4, 0.6], 1.1) };

  /** Mesh with (noisy) vertex colour + fuzzy shells. variant: 'body' | 'belly'. */
  const fur = (geo, color, parent, shells = true, variant = 'body') => {
    {
      const n = geo.attributes.position.count, p = geo.attributes.position;
      let a = geo.attributes.color ? geo.attributes.color.array : null;
      if (!a) { a = new Float32Array(n * 3); _c.set(color); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } }
      // gentle fabric tone variation (soft blotches + fine mottling)
      for (let i = 0; i < n; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 0.9 + 0.1 * vnoise(x * 4, y * 4, z * 4) * 2 + 0.05 * (vnoise(x * 23, y * 23, z * 23) - 0.5);
        a[i * 3] *= k; a[i * 3 + 1] *= k; a[i * 3 + 2] *= k * 1.01;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    const g = new THREE.Group();
    const base = new THREE.Mesh(geo, baseMat); base.castShadow = true; base.receiveShadow = true; g.add(base);
    if (shells) shellSets[variant].forEach((m, i) => {
      const sg = geo.clone(), p = sg.attributes.position, nrm = sg.attributes.normal, d = (variant === "belly" ? 0.018 : 0.013) * (i + 1);
      for (let v = 0; v < p.count; v++) p.setXYZ(v, p.getX(v) + nrm.getX(v) * d, p.getY(v) + nrm.getY(v) * d, p.getZ(v) + nrm.getZ(v) * d);
      const sm = new THREE.Mesh(sg, m); sm.receiveShadow = true; g.add(sm);
    });
    parent.add(g);
    return g;
  };

  // ---- Breathing body group (chest, arms, paws, quilt, blanket) ----
  const pivot = new THREE.Vector3(BED.x, 0.6, -1.8);
  const breath = new THREE.Group(); breath.position.copy(pivot); root.add(breath);
  const inner = new THREE.Group(); inner.position.copy(pivot).negate(); breath.add(inner);

  const chest = fur(ellipsoid(0.5, 0.27, 0.4, 32, 20), FUR, inner); chest.position.set(BED.x, 0.74, -2.1);
  const belly = fur(ellipsoid(0.2, 0.14, 0.07, 28, 16), 0xaed0f6, inner, true, 'belly'); belly.position.set(BED.x, 0.86, -1.9); belly.rotation.x = -0.4;
  // stitched outline around the patch
  const bellyRing = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; bellyRing.push(new THREE.Vector3(Math.cos(a) * 0.21, Math.sin(a) * 0.15, 0.035)); }
  const bring = new THREE.Group(); bring.position.copy(belly.position); bring.rotation.copy(belly.rotation); inner.add(bring);
  stitches(bellyRing, 44, bring, true);
  const arm = (side) => {
    const g = fur(ellipsoid(0.13, 0.125, 0.36, 24, 16), FUR, inner);
    const S = new THREE.Vector3(BED.x + side * 0.4, 0.86, -2.2), Pw = new THREE.Vector3(BED.x + side * 0.36, 0.79, -1.66);
    g.position.copy(S).add(Pw).multiplyScalar(0.5);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), Pw.clone().sub(S).normalize());
    // paw: round mitten with three tiny toe bumps and a pink pad
    const paw = fur(ellipsoid(0.15, 0.115, 0.155, 24, 16), FUR_LIGHT, inner); paw.position.set(BED.x + side * 0.36, 0.785, -1.6);
    const pad = new THREE.Mesh(ellipsoid(0.055, 0.02, 0.05, 12, 8), new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.9 }));
    pad.position.set(BED.x + side * 0.36, 0.835, -1.58); inner.add(pad);
    for (let t = -1; t <= 1; t++) {
      const toe = new THREE.Mesh(ellipsoid(0.026, 0.022, 0.03, 10, 8), new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.9 }));
      toe.position.set(BED.x + side * 0.36 + t * 0.045, 0.835, -1.52 + (t === 0 ? 0.01 : 0)); inner.add(toe);
    }
    return g;
  };
  arm(-1); arm(1);
  inner.add(furged.quilt, furged.blanket);

  // ---- Head group ----
  const head = new THREE.Group(); head.position.set(BED.x, 1.3, -2.5); head.rotation.x = -0.2; root.add(head);
  const R = { x: 0.5, y: 0.43, z: 0.45 };
  fur(ellipsoid(R.x, R.y, R.z, 40, 26), FUR, head);
  // cheeks + muzzle
  for (const s of [-1, 1]) { const ch = fur(ellipsoid(0.17, 0.13, 0.15, 20, 14), MUZZLE, head, false); ch.position.set(s * 0.17, -0.15, 0.31); }
  const muz = fur(ellipsoid(0.17, 0.12, 0.13, 20, 14), MUZZLE, head, false); muz.position.set(0, -0.1, 0.35);
  const nose = new THREE.Mesh(ellipsoid(0.055, 0.04, 0.035, 16, 10), new THREE.MeshStandardMaterial({ color: 0xf08aa4, roughness: 0.35 }));
  nose.position.set(0, -0.045, 0.475); head.add(nose);
  // gentle smile
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7b3b52, roughness: 0.7 });
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.13, -0.158, 0.44), new THREE.Vector3(-0.07, -0.208, 0.468), new THREE.Vector3(0, -0.226, 0.476), new THREE.Vector3(0.07, -0.208, 0.468), new THREE.Vector3(0.13, -0.158, 0.44)]), 24, 0.0105, 6), mouthMat);
  head.add(mouth);
  const noseLine = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), mouthMat); noseLine.position.set(0, -0.12, 0.478); head.add(noseLine);
  // little blush
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xff9db5, transparent: true, opacity: 0.28, depthWrite: false });
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), blushMat); b.position.set(s * 0.3, -0.12, 0.37); b.rotation.y = s * 0.7; head.add(b); }

  // eyes
  const irisTex = canvasTex(8, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#05070f'); g.addColorStop(0.07, '#05070f'); g.addColorStop(0.11, '#25376a'); g.addColorStop(0.2, '#3a5896');
    g.addColorStop(0.27, '#1d2a52'); g.addColorStop(0.3, '#0a0f22'); g.addColorStop(1, '#0a0f22');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, { aniso: 1 });
  const irisMat = new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.25, metalness: 0 });
  const corneaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0, depthWrite: false, envMapIntensity: 2.2 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x151a2e, roughness: 0.12, metalness: 0.1 });
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lidMat = new THREE.MeshStandardMaterial({ color: FUR, roughness: 1 });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1d2442, roughness: 0.8 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const dir = new THREE.Vector3(s * 0.4, 0.17, 0.9).normalize();
    const eg = new THREE.Group();
    eg.position.set(dir.x * R.x * 1.03, dir.y * R.y * 1.03, dir.z * R.z * 1.03);
    eg.rotation.y = s * 0.3;
    const ball = new THREE.Group();
    const eb = new THREE.Mesh(ellipsoid(0.1, 0.112, 0.08, 24, 16), eyeMat);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, 0.82).rotateX(Math.PI / 2).scale(0.1 * 1.012, 0.112 * 1.012, 0.08 * 1.012), irisMat);
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14).scale(0.104, 0.116, 0.085), corneaMat); cornea.renderOrder = 3;
    ball.add(iris, cornea);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), hiMat); h1.position.set(0.034, 0.042, 0.062);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), hiMat); h2.position.set(-0.03, -0.036, 0.068);
    ball.add(eb, h1, h2); eg.add(ball);
    const lid = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1.08, 1), lidMat);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.011, 6, 18, Math.PI).rotateZ(Math.PI), lashMat);
    lash.position.set(0, 0.0, 0.094);
    lid.add(dome, lash); eg.add(lid);
    head.add(eg); eyes.push({ ball, lid, lash });
  }

  // ears
  const earL = new THREE.Group(), earR = new THREE.Group(); head.add(earL, earR);
  const earLeftGeo = earGeometry([[0, 0], [-0.03, 0.34], [-0.14, 0.62], [-0.36, 0.78], [-0.62, 0.74], [-0.82, 0.52], [-0.92, 0.2], [-0.95, -0.12], [-0.97, -0.36]].map(([x, y]) => [x * 0.72, y * 0.72]), 0.17, 0.078);
  const earRightGeo = earGeometry([[0, 0], [0.02, 0.4], [0.05, 0.8], [0.16, 1.15], [0.32, 1.38], [0.52, 1.46], [0.66, 1.36], [0.7, 1.2]].map(([x, y]) => [x * 0.66, y * 0.66]), 0.19, 0.078);
  const eL = fur(earLeftGeo, 0, earL), eR = fur(earRightGeo, 0, earR);
  earL.position.set(-0.24, 0.3, -0.12); earL.rotation.set(0.05, 0.28, 0.0);
  earR.position.set(0.24, 0.3, -0.12); earR.rotation.set(0.05, -0.25, -0.08);

  // stitched head seam (forehead -> nose bridge) and muzzle outline
  {
    const seam = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, d = new THREE.Vector3(0, lerp(0.93, 0.28, t), lerp(0.3, 0.95, t)).normalize(); seam.push(new THREE.Vector3(d.x * R.x, d.y * R.y, d.z * R.z).multiplyScalar(1.012)); }
    stitches(seam, 14, head, false);
    const mz = [];
    for (let i = 0; i <= 14; i++) { const a = Math.PI * (0.05 + 0.9 * (i / 14)); mz.push(new THREE.Vector3(Math.cos(a) * 0.2, -0.2 - Math.sin(a) * 0.06 + 0.04, 0.42 + Math.sin(a) * 0.04)); }
  }
  // tiny tuft on the forehead
  const tuftMat = new THREE.MeshStandardMaterial({ color: FUR_LIGHT, roughness: 1 });
  for (let i = -1; i <= 1; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 8), tuftMat); t.position.set(i * 0.05, 0.4, 0.14); t.rotation.set(-0.5, 0, -i * 0.5); head.add(t); }

  // tap hit-box
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.5), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(BED.x, 1.3, -2.2); hit.name = 'rabbit'; root.add(hit);

  // ---- Animation state ----
  const rnd = mulberry32(3);
  const st = { eyeOpen: 1, blinkT: 3, blink: -1, look: { x: 0, y: 0, tx: 0, ty: 0, t: 2 }, wiggle: 0, t: 0 };

  function update(dt, t, eyeTarget) {
    st.t = t;
    // eyelids follow the light state; blink only layers on top while awake
    const step = dt / 0.35;
    st.eyeOpen += clamp(eyeTarget - st.eyeOpen, -step, step);
    let blink = 0;
    if (eyeTarget > 0.99) {
      st.blinkT -= dt;
      if (st.blinkT <= 0 && st.blink < 0) { st.blink = 0; st.blinkT = 2.4 + rnd() * 3.2; }
      if (st.blink >= 0) { st.blink += dt; const k = st.blink / 0.18; blink = k >= 1 ? 0 : Math.sin(k * Math.PI); if (k >= 1) st.blink = -1; }
    } else st.blink = -1;
    const shown = smooth(st.eyeOpen) * (1 - blink * 0.97);
    const ang = lerp(0, -2.3, shown);
    for (const e of eyes) { e.lid.rotation.x = ang; e.lash.visible = shown < 0.9; }
    // gentle look-around while awake
    st.look.t -= dt;
    if (st.look.t <= 0) { st.look.t = 1.5 + rnd() * 2.5; st.look.tx = (rnd() - 0.5) * 0.5; st.look.ty = (rnd() - 0.5) * 0.3; }
    const lk = 1 - Math.exp(-dt * 6);
    st.look.x += (st.look.tx - st.look.x) * lk; st.look.y += (st.look.ty - st.look.y) * lk;
    for (const e of eyes) { e.ball.rotation.y = st.look.x * 0.5; e.ball.rotation.x = -st.look.y * 0.5; e.ball.position.x = st.look.x * 0.012; }
    // breathing: slower and deeper when asleep
    const asleep = 1 - smooth(st.eyeOpen);
    const f = lerp(0.42, 0.22, asleep), amp = lerp(0.012, 0.022, asleep);
    const b = Math.sin(t * Math.PI * 2 * f);
    breath.scale.set(1 + b * amp * 0.4, 1 + b * amp, 1 + b * amp * 0.5);
    head.position.y = 1.3 + b * 0.006 * (0.5 + asleep);
    head.rotation.z = Math.sin(t * 0.5) * 0.012 + asleep * 0.04;
    head.rotation.x = -0.2 + asleep * 0.03;
    mouth.scale.set(1 + asleep * 0.15, 1 + asleep * 0.3, 1);
    // ears: idle drift + tap wiggle
    st.wiggle = Math.max(0, st.wiggle - dt);
    const w = st.wiggle > 0 ? Math.sin(st.wiggle * 26) * Math.min(1, st.wiggle * 3) * 0.16 : 0;
    earL.rotation.z = Math.sin(t * 0.7) * 0.01 + w; earR.rotation.z = -0.08 + Math.sin(t * 0.6 + 1) * 0.015 - w * 1.2;
  }

  return { root, head, hit, update, wiggle: () => { st.wiggle = 0.9; }, state: st };
}
