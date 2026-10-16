// Fixed cinematic camera with a very gentle pointer/drag sway. fit(aspect) picks FOV + distance so the bed and the
// big switch are always inside the view (verified numerically via check()).
import * as THREE from 'three';
import { BED } from './furniture.js';
import { SWITCH } from './switchPlate.js';
import { clamp } from './util.js';

const SAFE = 0.9; // keep key points inside |ndc| <= SAFE (leaves room for sway)

export function buildCameraRig() {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
  // Key points that must stay visible: bed + rabbit box corners, switch plate corners.
  const pts = [];
  const bx0 = BED.x - BED.w / 2 - 0.05, bx1 = BED.x + BED.w / 2 + 0.05;
  for (const x of [bx0, bx1]) for (const y of [0.05, 1.75]) for (const z of [BED.zHead, BED.zFoot]) pts.push(new THREE.Vector3(x, y, z));
  for (const y of [SWITCH.y - SWITCH.h / 2, SWITCH.y + SWITCH.h / 2]) for (const z of [SWITCH.z - SWITCH.w / 2, SWITCH.z + SWITCH.w / 2]) pts.push(new THREE.Vector3(SWITCH.x, y, z));

  const base = new THREE.Vector3(0.5, 1.25, 3.9);   // camera "dolly line" start
  const back = new THREE.Vector3(0.12, 0.02, 1).normalize();
  const target = new THREE.Vector3(-0.1, 1.2, -1.2);
  const fitState = { fov: 55, dist: 0, aspect: 1, pos: base.clone(), look: target.clone() };
  const sway = { x: 0, y: 0, tx: 0, ty: 0 };
  const _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
  const _c = new THREE.PerspectiveCamera();

  /** Max |ndc| over the key points for a candidate camera. Returns [maxX, maxY, minZ(depth)]. */
  function extents(cam, aspectForCheck) {
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    let mx = 0, my = 0, front = true;
    for (const p of pts) {
      _p.copy(p).project(cam);
      mx = Math.max(mx, Math.abs(_p.x)); my = Math.max(my, Math.abs(_p.y));
      if (_p.z > 1 || _p.z < -1) front = false;
    }
    return { mx, my, front };
  }

  /** Solve camera pose for an aspect ratio. Pure function of aspect; also used by the numeric tests. */
  function solve(aspect, out = _c) {
    let best = null;
    // Try increasing distances; at each, centre the look target on the points' angular box and pick the smallest FOV that fits.
    for (let d = 0; d <= 7; d += 0.25) {
      out.position.copy(base).addScaledVector(back, d);
      out.aspect = aspect;
      const look = target.clone();
      for (let it = 0; it < 3; it++) {            // iterate so the look direction centres the angular extent
        out.lookAt(look); out.fov = 60; out.updateMatrixWorld(true);
        let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
        _m.copy(out.matrixWorld).invert();
        for (const p of pts) {
          _p.copy(p).applyMatrix4(_m);
          const tx = _p.x / -_p.z, ty = _p.y / -_p.z;
          minx = Math.min(minx, tx); maxx = Math.max(maxx, tx); miny = Math.min(miny, ty); maxy = Math.max(maxy, ty);
        }
        const dist = out.position.distanceTo(look);
        const right = new THREE.Vector3().setFromMatrixColumn(out.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(out.matrixWorld, 1);
        look.addScaledVector(right, ((minx + maxx) / 2) * dist).addScaledVector(up, ((miny + maxy) / 2) * dist * 0.6);
      }
      out.lookAt(look); out.updateMatrixWorld(true);
      const fitFov = () => {
        out.updateMatrixWorld(true); _m.copy(out.matrixWorld).invert();
        let need = 0;
        for (const p of pts) { _p.copy(p).applyMatrix4(_m); need = Math.max(need, Math.abs(_p.y / -_p.z), Math.abs(_p.x / -_p.z) / aspect); }
        return { need, fov: (2 * Math.atan(need / SAFE) * 180) / Math.PI };
      };
      let r = fitFov();
      // Tilt down a little: spend most of the vertical slack on less empty ceiling (content moves up in the frame).
      const tanHalf = r.need / SAFE;
      let ymax = 0;
      for (const p of pts) { _p.copy(p).applyMatrix4(_m); ymax = Math.max(ymax, Math.abs(_p.y / -_p.z)); }
      const slack = Math.max(0, SAFE - ymax / tanHalf);
      const upv = new THREE.Vector3().setFromMatrixColumn(out.matrixWorld, 1);
      look.addScaledVector(upv, -slack * (aspect > 1.1 ? 0.8 : 0.0) * tanHalf * out.position.distanceTo(look));
      out.lookAt(look);
      r = fitFov(); r = fitFov();
      const fov = r.fov;
      best = { d, fov, look: look.clone() };
      if (fov <= 64 || d >= 7) break;
    }
    out.fov = clamp(best.fov, 18, 100);
    out.updateProjectionMatrix();
    return best;
  }

  function fit(aspect) {
    const b = solve(aspect, camera);
    fitState.fov = camera.fov; fitState.aspect = aspect; fitState.pos.copy(camera.position); fitState.look.copy(b.look); fitState.dist = b.d;
    camera.position.copy(fitState.pos); camera.lookAt(fitState.look);
  }

  /** Numeric visibility test at any aspect (does not touch the live camera). */
  function check(aspect) {
    const c = new THREE.PerspectiveCamera(); solve(aspect, c);
    const e = extents(c, aspect);
    // Report per-group extents too
    const grp = (list) => { let mx = 0, my = 0; for (const p of list) { _p.copy(p).project(c); mx = Math.max(mx, Math.abs(_p.x)); my = Math.max(my, Math.abs(_p.y)); } return [+mx.toFixed(3), +my.toFixed(3)]; };
    return { aspect: +aspect.toFixed(3), fov: +c.fov.toFixed(1), pos: c.position.toArray().map((v) => +v.toFixed(2)), bedMaxNdc: grp(pts.slice(0, 8)), switchMaxNdc: grp(pts.slice(8)), allInside: e.mx <= 1 && e.my <= 1 && e.front };
  }

  function update(dt) {
    const k = 1 - Math.exp(-dt * 3);
    sway.x += (sway.tx - sway.x) * k; sway.y += (sway.ty - sway.y) * k;
    camera.position.copy(fitState.pos);
    camera.position.x += sway.x * 0.07; camera.position.y += sway.y * 0.04;
    _m.lookAt(camera.position, fitState.look, _up); _q.setFromRotationMatrix(_m);
    camera.quaternion.copy(_q);
    camera.rotateY(-sway.x * 0.018); camera.rotateX(sway.y * 0.012);
  }

  return { camera, fit, check, update, sway, setSway(x, y) { sway.tx = clamp(x, -1, 1); sway.ty = clamp(y, -1, 1); }, fitState };
}
