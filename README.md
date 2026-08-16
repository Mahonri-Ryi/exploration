# Aetheris

A cinematic 3D city builder you can play in the browser. Found a riverside metropolis, lay avenues, raise cottages and glass towers, keep the lights and water flowing, and watch the skyline change from golden hour to night.

## Play

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

After this repository enables GitHub Pages, the `Deploy Aetheris` workflow publishes the `dist` folder on every push to `main`.

## How to play

- **Found City** starts a new map with a $75,000 treasury.
- **Continue** restores the last save from this browser.
- Left click places the selected tool. Drag to paint roads or raze.
- Right-drag or middle-drag orbits. Alt/Shift-drag pans. Scroll zooms.
- `WASD` or arrows travel. `Q`/`E` yaw. `R` resets the camera.
- `1`–`8` pick common tools. `X` razes. `I` surveys. `Space` pauses.
- Buildings need **road access**, **power**, and **water** to operate.
- Parks and services lift spirit. Industry pays well and fouls the air.
- Taxes arrive each month. The levy slider trades income for happiness.
- Larger buildings unlock as the population grows.

## Project layout

- `src/game` — catalog, simulation, save data
- `src/world` — Three.js terrain, buildings, lighting, camera
- `src/ui` — cinematic HUD
- `src/audio` — Web Audio playback
- `public/assets` — generated branding, icons, textures, and sound
- `scripts/generate-audio.py` — rebuilds the OGG library

## Tests

```bash
npm test
```
