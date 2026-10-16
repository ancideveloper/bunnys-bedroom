# Bunny's Bedroom

A cozy procedural 3D bedroom (Three.js r186) with a human-sized blue plush rabbit and one huge light switch.
Tap the switch, tap anywhere, or press any key: the room flips between warm lamp light (rabbit's eyes open) and a soft
moonlit night (eyes closed, sleeping). No text, score or timer.

## Run
```
node serve.mjs 8137      # then open http://localhost:8137/
```
`serve.mjs` is a tiny no-cache static server (it also has a dev-only `POST /__shot/<name>.png` used to save test screenshots
into `screenshots/`). Everything uses relative paths, so the folder also works as-is on GitHub Pages. No CDN, no bundler.

## Files
- `index.html` – import map, canvas, icon-only mute button.
- `src/main.js` – renderer, scene assembly, fixed-step loop, light state machine, `window.__app` test hook.
- `src/room.js` – walls/floor/ceiling with baked vertex AO, canvas wallpaper + floor boards.
- `src/furniture.js` – bed (star footboard), quilt, desk, train, shelf, lamp, rug, basket, floor toys, night light.
- `src/rabbit.js` – original plush rabbit: ellipsoids, tube ears, shell fur, eyelids, breathing/blinking.
- `src/windowSky.js` – window, star curtains, night panorama, PMREM environment.
- `src/lighting.js` – lights, glow sprites, dust motes, the single `mood` parameter.
- `src/switchPlate.js` – big switch with rocker and glowing bulb icon.
- `src/cameraRig.js` – fixed camera, gentle pointer sway, `fit(aspect)` and numeric `check(aspect)`.
- `src/audio.js`, `src/input.js`, `src/ui.js`, `src/util.js`.
- `vendor/` – `three.module.min.js`, `three.core.min.js` (r186, MIT, minified from the npm build with esbuild because
  the npm package ships only unminified files) and `addons/utils/BufferGeometryUtils.js`.

## Controls
Switch / anywhere tap / any key (no Ctrl/Alt/Meta combos, no F-keys) toggles the light; toggles closer than 90 ms are ignored.
Extras: tap the rabbit (ear wiggle), the toy train (toot), the bunny night light (night light only).

## Test hook
`__app.pause() / resume() / step(n) / toggle() / setLight(bool) / state() / stats() / cameraCheck(w,h)`, `__app.audio.peak()`.

## Credits and legal
Three.js (MIT, `vendor/THREE_LICENSE`). All geometry, textures (canvas), the music-box melody and sounds are original and
generated at runtime. The rabbit is an original design; the reference image was used only for mood and composition, nothing traced.
