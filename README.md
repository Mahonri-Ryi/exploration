# Aetheris

A cinematic 3D city builder. The **graphics target is Unreal Engine 5** (Lumen, virtual shadows, sky atmosphere). The browser build is a prototype only.

## Play in Unreal Engine 5 (native)

This is how you get the lighting and atmosphere the web build cannot do.

1. Install [Unreal Engine 5.5](https://www.unrealengine.com/download).
2. Open `Unreal/Aetheris/Aetheris.uproject` and let it compile the C++ modules.
3. Press **Play**.

WASD pans, middle-mouse orbits, **1–7** pick tools, left click places, right click razes. Full notes: [`Unreal/Aetheris/README.md`](Unreal/Aetheris/README.md).

## Browser prototype (optional)

The Three.js sketch still runs in a tab if you want a quick look without the editor. It will never look like UE5.

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

That is the game. On a phone, tools sit along the bottom; tap to build, two fingers to orbit, and **Look** to drag the view. On a computer, use the left toolbar. Press `H` for field notes and `A` for laurels.

### Play from a production build (optional)

Same project folder, different commands:

```bash
npm run build
npm run preview
```

Then open **http://localhost:4173**.

### Play online for free (no local install)

Aetheris is a static web game. Anyone can play it in a browser once it is published. **GitHub Pages is free** for public repositories, and this repo already has a deploy workflow (`.github/workflows/pages.yml`).

**Turn it on (one-time):**

1. Merge the Aetheris branch into `main` (the workflow only runs on `main`).
2. Make the repository **public** (GitHub Free includes Pages for public repos; private Pages needs GitHub Pro). In the repo: **Settings → General → Danger Zone → Change repository visibility → Public**.
3. Enable Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push (or re-run the **Deploy Aetheris** workflow). When it is green, GitHub shows the site URL on the Pages settings page.

The usual URL is:

**https://mahonri-ryi.github.io/exploration/**

Open that link, wait for the title screen, then click **Found City**. No Node, no `npm`, no clone.

**Other free hosts** (work even if the repo stays private):

- [Cloudflare Pages](https://pages.cloudflare.com/) — connect this GitHub repo, build command `npm run build`, output folder `dist`.
- [Netlify](https://www.netlify.com/) — same build settings, or drag-and-drop a `dist` folder.
- [itch.io](https://itch.io/) — create an HTML5 project and upload a zip of `dist`.

Vite is already set to `base: "./"`, so the game works in a subdirectory (GitHub Pages project sites) as well as at a domain root.


## How to play

- **Found City** starts a new map with a $75,000 treasury and a short **primer** that teaches roads, power, water, homes, jobs, parks, upgrades, the river, fires, and laurels. Skip it anytime.
- **Continue** restores the last save from this browser.
- **Phone / tablet:** tap to place, drag Avenue or Raze to paint, two fingers to orbit and pinch to zoom. **Look** (or `L`) lets one finger orbit without building. Tools, Look, Charter, and Notes sit along the bottom.
- **Android:** Chrome or Samsung Internet. Pinch on the vale zooms the camera (not the page). You can also Add to Home screen for a full-screen tab.
- **Computer:** pick a category on the bottom dock (Roads, Homes, Shops, Works, Parks, Grid, Civic, Wonders), then a building. Left click places. Drag to paint roads or raze. Right-drag orbits. Scroll zooms. **Power / Water / Spirit** layers tint the map like Cities: Skylines.
- `WASD` or arrows travel. `Q`/`E` yaw. `R` resets the camera. `L` toggles look mode.
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

- `Unreal/Aetheris` — native UE5 game (Lumen, city sim, placement)
- `src/game` — browser catalog and simulation
- `src/world` — Three.js prototype renderer
- `src/ui` — browser HUD
- `src/audio` — Web Audio playback
- `public/assets` — generated branding, icons, textures, and sound
- `scripts/generate-audio.py` — rebuilds the OGG library

## Tests

```bash
npm test
npm run unreal:check   # native project files and Lumen config
npm run smoke          # live Chrome playtest of the browser prototype
```

Agents must also playtest every new feature individually in the running game (`npm run dev` → http://localhost:5173), not only with unit tests.
