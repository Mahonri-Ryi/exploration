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
- `1`–`8` pick common tools. `X` razes. `I` surveys. `U` upgrades. `H` field notes. `Space` pauses.
- Buildings need **road access**, **power**, and **water** to operate. **Windmills** make clean power without a water main.
- Paint an avenue onto the river to raise a **bridge**. **Docks** must face the water. The unique **River Beacon** doubles dock dues.
- Survey a cottage or shop and press **U** (or the upgrade button) to raise it in place.
- The **Charter** panel pays gold for first-hour goals. Monthly events can bless the city — or start a **fire**.
- A live **Fire Hall** quells nearby blazes. Unguarded fires consume the plot.
- Parks, schools, inns, and services lift spirit. The **Observatory** lifts the whole city.
- Taxes arrive each month. The levy slider trades income for happiness.
- Larger buildings also unlock from the toolbar as the population grows. The date line shows your era (Hamlet through Metropolis).

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
npm run smoke   # live Chrome playtest against npm run dev
```
