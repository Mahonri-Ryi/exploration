# Aetheris

A cinematic 3D city builder you can play in the browser. Found a riverside metropolis, lay avenues, raise cottages and glass towers, keep the lights and water flowing, and watch the skyline change from golden hour to night.

## How to access the game

Aetheris runs in a web browser. You do not install a desktop app — you start a local server, then open the printed URL.

### 1. Install Node.js

You need **Node.js 20 or newer** (22 is what CI uses) and npm, which ships with Node.

- Download: https://nodejs.org
- Check: `node -v` and `npm -v`

### 2. Get the project

```bash
git clone https://github.com/Mahonri-Ryi/exploration.git
cd exploration
```

If you already have the folder, `cd` into it and skip the clone.

### 3. Install dependencies

```bash
npm install
```

### 4. Start the local server

```bash
npm run dev
```

Vite prints a local URL. Leave this terminal open while you play.

### 5. Open it in a browser

1. Go to **http://localhost:5173** (or the Network URL Vite printed, if you are on another device on the same LAN).
2. Wait until the title screen shows **Aetheris** and **Found City**.
3. Type a city name, or keep `Aetheris`.
4. Click **Found City** for a new map (a short primer starts).
5. Click **Continue** if you already saved a city in this browser.

That is the game. Use the left toolbar to build. Press `H` for field notes and `A` for laurels.

### Play from a production build (optional)

Same project folder, different commands:

```bash
npm run build
npm run preview
```

Then open **http://localhost:4173**.

### Play on GitHub Pages (optional)

The `Deploy Aetheris` workflow publishes the `dist` folder on every push to `main` once GitHub Pages is enabled for this repository (Settings → Pages → GitHub Actions). After that, the live URL is the Pages URL GitHub shows for the repo.

## How to play

- **Found City** starts a new map with a $75,000 treasury and a short **primer** that teaches roads, power, water, homes, jobs, parks, upgrades, the river, fires, and laurels. Skip it anytime.
- **Continue** restores the last save from this browser.
- Left click places the selected tool. Drag to paint roads or raze.
- Right-drag or middle-drag orbits. Alt/Shift-drag pans. Scroll zooms.
- `WASD` or arrows travel. `Q`/`E` yaw. `R` resets the camera.
- `1`–`8` pick common tools. `X` razes. `I` surveys. `U` upgrades. `H` field notes. `A` laurels. `Space` pauses.
- Buildings need **road access**, **power**, and **water** to operate. **Windmills** make clean power without a water main.
- Paint an avenue onto the river to raise a **bridge**. **Docks** must face the water. The unique **River Beacon** doubles dock dues.
- Survey a cottage or shop and press **U** (or the upgrade button) to raise it in place.
- The **Charter** panel pays gold for first-hour goals. **Laurels** are trophies for exploring every system.
- Monthly events can bless the city — or start a **fire**. A live **Fire Hall** quells nearby blazes.
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
