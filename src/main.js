// Bunny's Bedroom: renderer, scene assembly, fixed-step loop, light state machine and the test hook window.__app.
import * as THREE from 'three';
import { Batcher, smooth, lerp } from './util.js';
import { buildRoom, ROOM } from './room.js';
import { buildFurniture } from './furniture.js';
import { buildRabbit } from './rabbit.js';
import { buildWindowSky } from './windowSky.js';
import { buildLighting } from './lighting.js';
import { buildSwitch } from './switchPlate.js';
import { buildCameraRig } from './cameraRig.js';
import { createAudio } from './audio.js';
import { setupInput } from './input.js';
import { setupUI } from './ui.js';

const tBuild0 = performance.now();
const canvas = document.getElementById('view');
const isTouch = matchMedia('(pointer: coarse)').matches;
const SHADOW = isTouch ? 512 : 1024;
const STEP = 1 / 60;
const TRANSITION = 0.4;          // seconds for the light change
const MIN_TOGGLE_GAP = 0.09;     // debounce: ignore toggles closer than this (seconds)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;   // shadows are refreshed every few frames (see loop)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141a33);

// ---- build the world ----
const batch = new Batcher();
buildRoom(scene, batch);
const furniture = buildFurniture(scene, batch, { zWall: ROOM.z0 });
const sky = buildWindowSky(scene, batch, renderer);
const staticStats = batch.build(scene);
const rabbit = buildRabbit(scene, furniture);
const sw = buildSwitch(scene);
const lighting = buildLighting(scene, renderer, furniture, SHADOW);
const rig = buildCameraRig();
const audio = createAudio();
setupUI(audio);

// ---- state ----
const S = {
  light: true, target: 1, from: 1, mood: 1, tween: 1, toggles: 0, ignored: 0, time: 0, simTime: 0, paused: false,
  nightOn: true, night: 1, frame: 0, lastToggle: -10,
};

function applyMood() {
  const m = S.mood;
  lighting.setMood(m); sky.setMood(m); sw.setMood(m);
}

/** Flip the light (debounced). Returns true if accepted. */
function toggle(source = 'api') {
  if (S.simTime - S.lastToggle < MIN_TOGGLE_GAP) { S.ignored++; return false; }
  S.lastToggle = S.simTime;
  setLight(!S.light);
  S.toggles++;
  audio.click(S.light);
  return true;
}
function setLight(on) {
  S.light = on; S.from = S.mood; S.target = on ? 1 : 0; S.tween = 0;
  sw.flip(on);
  audio.setMood(S.target, !on);
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  rig.fit(w / h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

setupInput({
  canvas, camera: rig.camera, rig,
  hits: { switch: sw.hit, rabbit: rabbit.hit, train: furniture.hit.train, night: furniture.nightlight.hit },
  onToggle: toggle,
  onRabbit: () => { rabbit.wiggle(); audio.wiggle(); },
  onTrain: () => { S.trainT = 0.5; audio.toot(); },
  onNight: () => { S.nightOn = !S.nightOn; },
  onGesture: () => audio.unlock(),
});

const trainBase = furniture.anim.train.position.clone();
// ---- simulation ----
let shadowCountdown = 0;
function update(dt) {
  S.simTime += dt; S.time += dt;
  if (S.tween < 1) {
    S.tween = Math.min(1, S.tween + dt / TRANSITION);
    S.mood = lerp(S.from, S.target, smooth(S.tween));
  }
  S.night += ((S.nightOn ? 1 : 0) - S.night) * (1 - Math.exp(-dt * 8));
  lighting.setNight(S.night);
  applyMood();
  sw.update(dt);
  rabbit.update(dt, S.time, S.target);
  sky.update(dt, S.time);
  lighting.update(dt, S.time);
  rig.update(dt);
  // toy train gives a tiny hop when tapped
  if (S.trainT > 0) { S.trainT -= dt; const k = Math.max(0, S.trainT); furniture.anim.train.position.y = trainBase.y + Math.abs(Math.sin(k * 18)) * 0.02 * Math.min(1, k * 3); furniture.anim.train.position.x = trainBase.x + Math.sin(k * 30) * 0.004; }
  audio.peak();
  if (--shadowCountdown <= 0) { renderer.shadowMap.needsUpdate = true; shadowCountdown = isTouch ? 10 : 6; }
}

function render() { renderer.render(scene, rig.camera); }

// ---- frame loop (fixed step accumulator) ----
let acc = 0, last = performance.now(), frames = 0, fpsT = performance.now(), fps = 0;
const frameTimes = new Float32Array(240); let ftI = 0;
let sizeW = 0, sizeH = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (canvas.clientWidth !== sizeW || canvas.clientHeight !== sizeH) { sizeW = canvas.clientWidth; sizeH = canvas.clientHeight; resize(); }
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frameTimes[ftI++ % frameTimes.length] = dt * 1000;
  if (!S.paused) { acc += dt; while (acc >= STEP) { update(STEP); acc -= STEP; S.frame++; } }
  render();
  frames++; if (now - fpsT > 1000) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
}

resize();
S.mood = 1; applyMood(); sw.snap(true);
for (let i = 0; i < 3; i++) update(STEP);            // warm up animation state and shadows
renderer.shadowMap.needsUpdate = true;
const buildMs = performance.now() - tBuild0;
requestAnimationFrame((t) => { last = t; frame(t); });

// ---- test hook ----
function counts() {
  let meshes = 0, tris = 0, objects = 0;
  scene.traverse((o) => { objects++; if (o.isMesh || o.isPoints || o.isSprite) { meshes++; const g = o.geometry; if (g && o.isMesh) tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
  return { objects, meshes, sceneTriangles: Math.round(tris) };
}
window.__app = {
  THREE, scene, renderer, camera: rig.camera, rig, rabbit, lighting, furniture, sw, audio, S,
  pause() { S.paused = true; }, resume() { S.paused = false; },
  /** Advance n fixed steps (works while paused) and render. */
  step(n = 1) { for (let i = 0; i < n; i++) { update(STEP); S.frame++; } render(); },
  toggle: () => toggle('api'), setLight: (on) => setLight(!!on),
  state: () => ({ light: S.light, mood: +S.mood.toFixed(4), eyeOpen: +rabbit.state.eyeOpen.toFixed(4), lidAngle: +(S.light ? 0 : 0), toggles: S.toggles, ignored: S.ignored, rocker: +sw.state.angle.toFixed(3), audioStarted: audio.started, audioState: audio.ctx ? audio.ctx.state : 'none' }),
  stats() {
    const ri = renderer.info;
    return { buildMs: +buildMs.toFixed(0), fps: +fps.toFixed(1), frameMsAvg: +(frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length).toFixed(2),
      calls: ri.render.calls, triangles: ri.render.triangles, geometries: ri.memory.geometries, textures: ri.memory.textures, programs: ri.programs.length, static: staticStats, ...counts(), pixelRatio: renderer.getPixelRatio() };
  },
  cameraCheck: (w, h) => rig.check(w / h),
  fps: () => fps,
};
