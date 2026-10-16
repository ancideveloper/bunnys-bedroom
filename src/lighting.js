// Lights, glow sprites, dust motes and the single mood parameter (1 = room lit, 0 = night) that drives them.
import * as THREE from 'three';
import { glowTexture, lerp, mulberry32 } from './util.js';

const ON = { hemi: 0.55, ceil: 9, lamp: 9, moon: 0.22, env: 0.35, exposure: 1.0 };
const OFF = { hemi: 0.22, ceil: 0, lamp: 0, moon: 1.15, env: 0.22, exposure: 1.15 };

export function buildLighting(scene, renderer, furniture, shadowSize) {
  const out = {};
  const hemi = new THREE.HemisphereLight(0xcfdcff, 0xffd8a8, ON.hemi); scene.add(hemi);

  // Ceiling light (soft shadows from the ceiling centre)
  const ceil = new THREE.PointLight(0xffd29a, ON.ceil, 14, 2);   // warm ~2700K incandescent
  ceil.position.copy(furniture.chandelier.pos); ceil.castShadow = true;
  ceil.shadow.mapSize.set(shadowSize, shadowSize); ceil.shadow.bias = -0.002; ceil.shadow.normalBias = 0.03; ceil.shadow.radius = 4;
  scene.add(ceil);

  // Faint warm bounce from the ceiling above the fixture (no shadow): lights the ceiling plane softly
  const bounce = new THREE.PointLight(0xffc88a, 0, 6, 2); bounce.position.set(furniture.chandelier.pos.x, 2.6, furniture.chandelier.pos.z); scene.add(bounce);

  // Floor lamp
  const lamp = new THREE.PointLight(0xffb36a, ON.lamp, 9, 2);
  lamp.position.copy(furniture.lamp.pos); lamp.castShadow = true;
  lamp.shadow.mapSize.set(shadowSize, shadowSize); lamp.shadow.bias = -0.002; lamp.shadow.normalBias = 0.03; lamp.shadow.radius = 4;
  scene.add(lamp);

  // Moon / sky light entering through the window
  const moon = new THREE.DirectionalLight(0x86a3ff, ON.moon);
  moon.position.set(-3.2, 3.2, -8); moon.target.position.set(-1.6, 0.3, -0.8);
  moon.castShadow = true; moon.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = moon.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 18;
  moon.shadow.bias = -0.0015; moon.shadow.normalBias = 0.04; moon.shadow.radius = 5;
  scene.add(moon, moon.target);

  // Cool fill so the sleeping rabbit stays readable at night (no shadow)
  const fill = new THREE.PointLight(0x9db4ff, 0, 7, 2); fill.position.set(-0.9, 1.5, 0.9); scene.add(fill);

  // Bunny night light (small point light, no shadow)
  const nl = new THREE.PointLight(0xffc98f, 1.2, 4, 2);
  nl.position.copy(furniture.nightlight.pos).add(new THREE.Vector3(0, -0.1, 0.05)); scene.add(nl);

  // ---- dust motes drifting in the lamp's light ----
  const N = 110, rnd = mulberry32(5), base = new Float32Array(N * 3), pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = 0.9 + rnd() * 1.4; base[i * 3 + 1] = 0.5 + rnd() * 1.7; base[i * 3 + 2] = -2.6 + rnd() * 2.6; ph[i] = rnd() * 100;
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ map: glowTexture(), color: 0xffe2b0, size: 0.05, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dg, dustMat); dust.frustumCulled = false; scene.add(dust);

  const shade = furniture.lamp, nlight = furniture.nightlight;
  let nightOn = 1, nightLevel = 1, mood = 1;

  /** m in [0,1]; nightOn in [0,1] is the (separately toggleable) night light. */
  function apply() {
    const m = mood;
    hemi.intensity = lerp(OFF.hemi, ON.hemi, m);
    ceil.intensity = lerp(OFF.ceil, ON.ceil, m);
    bounce.intensity = 1.6 * m;
    const cd = furniture.chandelier;
    cd.bulbMat.emissiveIntensity = lerp(0.0, 1.9, m); cd.bulbMat.color.setScalar(lerp(0.55, 1, m));
    for (const g of cd.glows) { g.material.opacity = 0.75 * m; g.visible = m > 0.01; }
    cd.halo.material.opacity = 0.5 * m; cd.halo.visible = m > 0.01;
    lamp.intensity = lerp(OFF.lamp, ON.lamp, m);
    fill.intensity = 2.7 * (1 - m);
    moon.intensity = lerp(OFF.moon, ON.moon, m);
    scene.environmentIntensity = lerp(OFF.env, ON.env, m);
    renderer.toneMappingExposure = lerp(OFF.exposure, ON.exposure, m);
    shade.mat.emissiveIntensity = lerp(0.04, 0.95, m);
    shade.glow.material.opacity = lerp(0, 0.5, m);
    shade.glow.visible = m > 0.01;
    const nlv = nightLevel * (0.55 + 0.45 * (1 - m));
    nl.intensity = 2.2 * nlv; nlight.mat.emissiveIntensity = 0.15 + 1.1 * nlv * (nightLevel > 0.01 ? 1 : 0);
    nlight.glow.material.opacity = 0.65 * nlv; nlight.glow.visible = nlv > 0.01;
    dustMat.opacity = 0.55 * m;
  }
  out.setMood = (m) => { mood = m; apply(); };
  out.setNight = (v) => { nightLevel = v; apply(); };
  out.update = (dt, t) => {
    if (mood < 0.02) return;
    for (let i = 0; i < N; i++) {
      const p = ph[i];
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.21 + p) * 0.18;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.17 + p * 1.7) * 0.12 + ((t * 0.02 + p) % 0.3);
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.19 + p * 0.6) * 0.18;
    }
    dg.attributes.position.needsUpdate = true;
  };
  out.lights = { hemi, ceil, lamp, moon, nl, fill, bounce };
  return out;
}
