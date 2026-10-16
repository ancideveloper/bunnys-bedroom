// Toddler-friendly input: tap anywhere / any key toggles the light; taps on the rabbit, train and night light do small extras.
// Also blocks scroll, pinch zoom and context menus (browser shortcuts keep working).
import * as THREE from 'three';

export function setupInput({ canvas, camera, rig, hits, onToggle, onRabbit, onTrain, onNight, onGesture }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const targets = [hits.switch, hits.rabbit, hits.train, hits.night];
  let dragging = false, lastX = 0, lastY = 0;

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(targets, false)[0];
    return h ? h.object.name : null;
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    onGesture(ev);
    dragging = true; lastX = ev.clientX; lastY = ev.clientY;
    const what = pick(ev);
    if (what === 'rabbit') onRabbit(); else if (what === 'train') onTrain(); else if (what === 'nightlight') onNight(); else onToggle('pointer');
  });
  window.addEventListener('pointermove', (ev) => {
    const w = window.innerWidth, h = window.innerHeight;
    rig.setSway((ev.clientX / w - 0.5) * 2, -((ev.clientY / h - 0.5) * 2));
  });
  const end = () => { dragging = false; };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  window.addEventListener('pointerleave', () => rig.setSway(0, 0));

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;                         // keep browser shortcuts
    if (['Control', 'Alt', 'Meta', 'OS', 'Shift', 'CapsLock', 'ContextMenu'].includes(ev.key)) return;
    if (/^F\d{1,2}$/.test(ev.key)) return;                                      // F5, F11, F12 ...
    onGesture(ev);
    if (ev.key === ' ' || ev.key.startsWith('Arrow') || ev.key === 'PageDown' || ev.key === 'PageUp') ev.preventDefault();
    onToggle('key');
  });

  // No scroll, zoom or context menu
  const stop = (e) => e.preventDefault();
  window.addEventListener('contextmenu', stop);
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', stop, { passive: false });
  window.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, stop);
  document.addEventListener('dblclick', stop);
}
