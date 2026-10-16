// The huge toddler light switch on the right wall: rounded plate, big rocker, glowing bulb icon (stays visible in the dark).
import * as THREE from 'three';
import { canvasTex, roundRectShape, softBox, glowSprite, lerp, clamp } from './util.js';
import { ROOM } from './room.js';

export const SWITCH = { x: ROOM.x1, y: 1.2, z: 0.55, w: 1.05, h: 1.5 };

function bulbTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.lineCap = 'round';
    c.strokeStyle = '#ffd25a'; c.lineWidth = 11;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI, r0 = 92, r1 = 120;
      if (i === 3 && false) continue;
      c.beginPath(); c.moveTo(128 + Math.cos(a) * r0, 120 + Math.sin(a) * r0); c.lineTo(128 + Math.cos(a) * r1, 120 + Math.sin(a) * r1); c.stroke();
    }
    c.beginPath(); c.moveTo(128 - 112, 130); c.lineTo(128 - 134 + 20, 130); c.moveTo(128 + 112, 130); c.lineTo(128 + 134 - 20, 130); c.stroke();
    // bulb
    const g = c.createRadialGradient(128, 105, 8, 128, 110, 70);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffe27a'); g.addColorStop(1, '#ffc233');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(98, 150); c.bezierCurveTo(60, 112, 78, 48, 128, 46); c.bezierCurveTo(178, 48, 196, 112, 158, 150);
    c.lineTo(158, 168); c.lineTo(98, 168); c.closePath(); c.fill();
    c.fillStyle = '#e6b44a'; c.fillRect(100, 172, 56, 12); c.fillRect(106, 190, 44, 10); c.fillStyle = '#d29f3a'; c.fillRect(116, 204, 24, 8);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 7; c.beginPath(); c.arc(128, 100, 34, Math.PI * 1.05, Math.PI * 1.5); c.stroke();
  });
}

export function buildSwitch(scene) {
  const g = new THREE.Group(); g.name = 'switch';
  g.position.set(SWITCH.x, SWITCH.y, SWITCH.z); g.rotation.y = -Math.PI / 2; scene.add(g);
  const ridgeDark = new THREE.MeshStandardMaterial({ color: 0x8c8068, roughness: 0.6 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf6eddb, roughness: 0.45 });
  const creamD = new THREE.MeshStandardMaterial({ color: 0xe6d9bd, roughness: 0.55 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.35 });

  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(SWITCH.w, SWITCH.h, 0.22), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 10 }), cream);
  plate.position.z = 0.0; plate.castShadow = plate.receiveShadow = true; g.add(plate);
  // outer rim, soft shadow ring and screws make it read as a physical object bolted to the wall
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(SWITCH.w + 0.1, SWITCH.h + 0.1, 0.27), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10 }), new THREE.MeshStandardMaterial({ color: 0xe2d4b6, roughness: 0.6 }));
  rim.position.z = -0.03; rim.receiveShadow = true; g.add(rim);
  const screwMat = new THREE.MeshStandardMaterial({ color: 0xc9bfa6, roughness: 0.4, metalness: 0.5 });
  for (const sy of [-1, 1]) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14).rotateX(Math.PI / 2), screwMat); sc.position.set(0, sy * (SWITCH.h / 2 - 0.1), 0.095); g.add(sc); const sl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.004), ridgeDark); sl.position.set(0, sy * (SWITCH.h / 2 - 0.1), 0.107); sl.rotation.z = sy * 0.6; g.add(sl); }
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(0.94, 1.42, 0.17), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 }), creamD);
  bezel.position.z = 0.1; bezel.receiveShadow = true; g.add(bezel);

  // glowing bulb icon
  const bulbMat = new THREE.MeshBasicMaterial({ map: bulbTexture(), transparent: true, toneMapped: false, depthWrite: false });
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), bulbMat); bulb.position.set(0, 0.48, 0.135); g.add(bulb);
  const bulbGlow = glowSprite(0xffd060, 1.5); bulbGlow.position.set(0, 0.48, 0.2); g.add(bulbGlow);

  // rocker
  const pivot = new THREE.Group(); pivot.position.set(0, -0.2, 0.12); g.add(pivot);
  const rocker = new THREE.Mesh(softBox(0.66, 0.78, 0.1, 0.04), rockMat); rocker.position.z = 0.04; rocker.castShadow = rocker.receiveShadow = true; pivot.add(rocker);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xddd0b4, roughness: 0.7 });
  for (let i = -1; i <= 1; i++) { const r = new THREE.Mesh(softBox(0.46, 0.022, 0.02, 0.008), ridgeMat); r.position.set(0, i * 0.1 + 0.02, 0.095); pivot.add(r); }

  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.z = 0.25; hit.name = 'switch'; g.add(hit);

  const ANG_ON = -0.27, ANG_OFF = 0.27;
  const st = { from: ANG_ON, to: ANG_ON, t0: -10, angle: ANG_ON, press: 0, mood: 1 };
  const easeOutBack = (p) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  let clock = 0;
  const DUR = 0.28;

  function apply() {
    const p = clamp((clock - st.t0) / DUR, 0, 1);
    st.angle = lerp(st.from, st.to, easeOutBack(p));
    pivot.rotation.x = st.angle;
    pivot.position.z = 0.12 - 0.025 * Math.sin(Math.PI * p) * (p < 1 ? 1 : 0);
  }
  apply();
  return {
    group: g, hit, state: st,
    /** Flip the rocker toward the new state (on = true -> light on). */
    flip(on) { st.from = st.angle; st.to = on ? ANG_ON : ANG_OFF; st.t0 = clock; },
    setMood(m) {
      st.mood = m;
      bulbMat.color.setScalar(lerp(0.85, 1.0, m)); creamD.emissive.setRGB(1, 0.85, 0.55); creamD.emissiveIntensity = 0.1 * m; cream.emissive.setRGB(1, 0.85, 0.55); cream.emissiveIntensity = 0.05 * m;
      bulbGlow.material.opacity = lerp(0.35, 0.6, m);
    },
    update(dt) { clock += dt; apply(); },
    snap(on) { st.from = st.to = on ? ANG_ON : ANG_OFF; st.t0 = -10; apply(); },
  };
}
