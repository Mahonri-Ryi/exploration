import * as THREE from "three";
import { AudioEngine } from "./audio/engine";
import { CATALOG_BY_ID, type InfoLayer, type ToolId } from "./game/catalog";
import { City } from "./game/city";
import { tutorialStep } from "./game/tutorial";
import { hasSave, loadCity, saveCity } from "./game/save";
import { Hud, toast } from "./ui/hud";
import { OrbitCam } from "./world/camera";
import { World, tileToWorld } from "./world/world";
import "./style.css";

const canvas = document.getElementById("viewport") as HTMLCanvasElement;
const title = document.getElementById("title-screen")!;
const hudRoot = document.getElementById("hud")!;
const boot = document.getElementById("boot")!;
const nameInput = document.getElementById("city-input") as HTMLInputElement;
const continueBtn = document.getElementById("btn-continue") as HTMLButtonElement;

const audio = new AudioEngine();
const world = new World(canvas);
const cam = new OrbitCam(world.camera, canvas);

let city = new City(40, "Aetheris");
let tool: ToolId = "inspect";
let speed = 1;
let acc = 0;
let painting = false;
let lastPaint = "";
let running = false;
let inspectAt: { x: number; y: number } | null = null;
let infoLayer: InfoLayer = "none";
let touchPlace: { id: number; sx: number; sy: number; moved: boolean; x: number; y: number } | null = null;

const TAP_PX = 14;
const PAN_CANCEL_PX = 28;

const hud = new Hud(hudRoot, {
  onTool: (id) => setTool(id),
  onSpeed: (n) => {
    speed = n;
    audio.play("ui_click");
  },
  onTax: (n) => {
    city.taxRate = n;
  },
  onMute: () => {
    audio.setMuted(!audio.muted);
    hud.setMuted(audio.muted);
    audio.play("ui_click");
  },
  onSave: () => persist("City sealed in the archive."),
  onMenu: () => {
    persist();
    title.hidden = false;
    title.style.display = "";
    hudRoot.hidden = true;
    running = false;
    refreshContinue();
  },
  onUpgrade: (x, y) => tryUpgrade(x, y),
  onSkipTutorial: () => {
    city.skipTutorial();
    audio.play("ui_click");
    toast("Primer closed. Press H for field notes, A for laurels.");
    hud.update(city, city.stats());
  },
  onTutorialContinue: () => {
    if (!city.continueTutorial()) {
      audio.play("error");
      toast("Finish this step in the world first.");
      return;
    }
    audio.play("ui_click");
    if (city.tutorialDone) toast("Primer complete. The vale is yours.");
    hud.update(city, city.stats());
  },
  onToggleLaurels: () => {
    const open = hud.toggleLaurels(city);
    if (open) city.note("laurels");
    audio.play("ui_click");
    hud.update(city, city.stats());
  },
  onReplayTutorial: () => {
    city.restartTutorial();
    hud.laurelsOpen = false;
    const panel = hudRoot.querySelector("#laurels-panel") as HTMLElement | null;
    if (panel) panel.hidden = true;
    audio.play("ui_click");
    toast("The primer begins again.");
    hud.update(city, city.stats());
  },
  onLook: (on) => {
    cam.setLookMode(on);
    audio.play("ui_click");
    if (on) toast("Look mode: drag to orbit, pinch to zoom.");
  },
  onLayer: (id) => {
    infoLayer = id;
    world.setLayer(id);
    audio.play("ui_click");
    if (id === "none") toast("City view.");
    else toast(`${id[0]!.toUpperCase()}${id.slice(1)} layer.`);
  },
  onToggleHelp: () => {
    const open = hud.toggleHelp();
    if (open) city.note("helpOpened");
    audio.play("ui_click");
  },
});

function setTool(id: ToolId): void {
  tool = id;
  hud.setTool(id);
  if (id !== "inspect") hud.hideInspect();
  audio.play("ui_click");
}

function tryUpgrade(x: number, y: number): void {
  const res = city.upgrade(x, y);
  if (!res.ok) {
    audio.play("error");
    if (res.reason) toast(res.reason);
    return;
  }
  world.syncTile(city, x, y);
  audio.play("unlock");
  toast(`${res.name} rises on the plot.`);
  for (const ev of city.events) {
    if (ev.type !== "mission") continue;
    toast(ev.message);
    audio.play("unlock");
  }
  hud.inspect(city, x, y);
  hud.lockTools(city.population());
  emitCityEvents();
}

function emitCityEvents(): void {
  for (const ev of city.events) {
    if (ev.type === "laurel") {
      toast(ev.message);
      audio.play("unlock");
    } else if (ev.type === "tutorial") {
      toast(ev.message);
      audio.play("ui_hover");
    }
  }
}

function persist(message?: string): void {
  saveCity(city);
  if (message) toast(message);
}

function refreshContinue(): void {
  continueBtn.hidden = !hasSave();
}

function startCity(next: City): void {
  city = next;
  world.bindCity(city);
  hud.update(city, city.stats());
  world.drawMinimap(hud.minimap, city);
  hud.lockTools(city.population());
  hud.setTool(tool);
  title.hidden = true;
  title.style.display = "none";
  hudRoot.hidden = false;
  running = true;
  audio.play("whoosh");
}

async function bootGame(): Promise<void> {
  await world.loadTextures();
  if (!running) world.bindCity(city);
  refreshContinue();
  boot.remove();
}

document.getElementById("btn-new")!.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Aetheris";
  startCity(new City(40, name));
  toast(`${name} is founded on the river.`);
  toast("A short primer will walk you through the vale. Skip it anytime.");
  void audio.unlock();
});

continueBtn.addEventListener("click", () => {
  const loaded = loadCity();
  if (!loaded) {
    toast("No archive remains.");
    return;
  }
  startCity(loaded);
  void audio.unlock();
});

title.addEventListener("pointerdown", () => {
  void audio.unlock();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void audio.unlock();
});

const pointer = new THREE.Vector2();
function ndc(e: { clientX: number; clientY: number }): THREE.Vector2 {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  pointer.x = ((e.clientX - r.left) / w) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / h) * 2 + 1;
  return pointer;
}

function hoverTile(e: PointerEvent): { x: number; y: number } | null {
  const t = world.pickTile(ndc(e), city.size);
  if (!t || !city.inBounds(t.x, t.y)) return null;
  return t;
}

function applyTool(x: number, y: number): void {
  if (tool === "inspect") {
    inspectAt = { x, y };
    city.note("surveyed");
    hud.inspect(city, x, y);
    audio.play("ui_hover");
    emitCityEvents();
    return;
  }
  if (tool === "bulldoze") {
    const res = city.demolish(x, y);
    if (res.ok) {
      world.syncTile(city, x, y);
      audio.play("demolish");
      if (res.refund) toast(`Salvage returned $${res.refund.toLocaleString()}.`);
      emitCityEvents();
    } else if (res.reason) {
      audio.play("error");
    }
    return;
  }
  const def = CATALOG_BY_ID[tool];
  if (!def) return;
  const check = city.canPlace(def.id, x, y);
  if (!check.ok) {
    audio.play("error");
    if (check.reason) toast(check.reason);
    return;
  }
  city.place(def.id, x, y);
  world.syncTile(city, x, y);
  audio.play(def.isRoad ? "place" : "construction");
  hud.lockTools(city.population());
  emitCityEvents();
  for (const ev of city.events) {
    if (ev.type !== "mission") continue;
    toast(ev.message);
    audio.play("unlock");
  }
  if (!def.isRoad) {
    const tile = city.get(x, y)!;
    city.floodUtilities();
    if (!city.hasRoadAccess(x, y)) toast("This plot has no avenue. It will sit idle.");
    else if (def.powerUse > 0 && !tile.powered) toast("No power reaches this plot yet.");
    else if (def.waterUse > 0 && !tile.watered) toast("No water reaches this plot yet.");
  }
}

function cameraStealsTool(): boolean {
  return cam.isBusy();
}

canvas.addEventListener("pointermove", (e) => {
  if (!running) return;
  if (cameraStealsTool()) {
    painting = false;
    if (cam.pointerCount() >= 2) touchPlace = null;
    world.setHover(0, 0, false);
    world.setGhost(null, 0, 0, false);
    return;
  }
  const t = hoverTile(e);
  if (!t) {
    world.setHover(0, 0, false);
    world.setGhost(null, 0, 0, false);
    return;
  }
  world.setHover(t.x, t.y, true);
  const def = CATALOG_BY_ID[tool];
  if (def) {
    const valid = city.canPlace(def.id, t.x, t.y).ok;
    world.setGhost(def, t.x, t.y, valid);
  } else {
    world.setGhost(null, 0, 0, false);
  }
  if (touchPlace && e.pointerId === touchPlace.id) {
    const dist = Math.hypot(e.clientX - touchPlace.sx, e.clientY - touchPlace.sy);
    if (dist > TAP_PX) touchPlace.moved = true;
    if ((tool === "road" || tool === "bulldoze") && dist > TAP_PX) {
      painting = true;
      if (!lastPaint) {
        lastPaint = `${touchPlace.x},${touchPlace.y}`;
        applyTool(touchPlace.x, touchPlace.y);
      }
      const key = `${t.x},${t.y}`;
      if (key !== lastPaint) {
        lastPaint = key;
        applyTool(t.x, t.y);
      }
      return;
    }
    if (tool !== "road" && tool !== "bulldoze" && dist > PAN_CANCEL_PX) {
      touchPlace = null;
    }
    return;
  }
  if (painting && (tool === "road" || tool === "bulldoze")) {
    const key = `${t.x},${t.y}`;
    if (key !== lastPaint) {
      lastPaint = key;
      applyTool(t.x, t.y);
    }
  }
});

canvas.addEventListener("pointerdown", (e) => {
  void audio.unlock();
  if (!running || e.altKey || e.shiftKey) return;
  if (e.button !== 0 && e.pointerType !== "touch") return;
  if (cam.lookMode || cam.isBusy()) {
    touchPlace = null;
    painting = false;
    return;
  }
  if (e.pointerType === "touch") {
    const start = hoverTile(e);
    if (!start) return;
    touchPlace = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, x: start.x, y: start.y };
    lastPaint = "";
    return;
  }
  const t = hoverTile(e);
  if (!t) return;
  painting = true;
  lastPaint = `${t.x},${t.y}`;
  applyTool(t.x, t.y);
});

window.addEventListener("pointerup", (e) => {
  if (touchPlace && e.pointerId === touchPlace.id) {
    const pending = touchPlace;
    touchPlace = null;
    if (!cam.isBusy() && !pending.moved) {
      const t = hoverTile(e);
      if (t) applyTool(t.x, t.y);
    }
  }
  painting = false;
});
window.addEventListener("pointercancel", () => {
  touchPlace = null;
  painting = false;
});

window.addEventListener("keydown", (e) => {
  if (!running) return;
  if (e.target instanceof HTMLInputElement) return;
  const map: Record<string, ToolId> = {
    "1": "inspect",
    "2": "road",
    "3": "cottage",
    "4": "shop",
    "5": "workshop",
    "6": "park",
    "7": "power",
    "8": "water",
    x: "bulldoze",
    i: "inspect",
  };
  if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
  if (e.key === "Escape") setTool("inspect");
  if (e.key.toLowerCase() === "u" && inspectAt) tryUpgrade(inspectAt.x, inspectAt.y);
  if (e.key.toLowerCase() === "r") cam.reset();
  if (e.key.toLowerCase() === "l") hud.toggleLook();
  if (e.key.toLowerCase() === "h") {
    const open = hud.toggleHelp();
    if (open) city.note("helpOpened");
    audio.play("ui_click");
  }
  if (e.key.toLowerCase() === "a") {
    const open = hud.toggleLaurels(city);
    if (open) city.note("laurels");
    audio.play("ui_click");
    hud.update(city, city.stats());
  }
  if (e.key === " ") {
    e.preventDefault();
    speed = speed === 0 ? 1 : 0;
    hud.setSpeed(speed);
    if (speed === 0) city.note("paused");
  }
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.update(dt);
  if (running) {
    if (speed > 0) {
      acc += dt * speed;
      const step = 0.55;
      while (acc >= step) {
        acc -= step;
        const events = city.tick();
        for (const ev of events) {
          toast(ev.message, ev.message.toLowerCase().includes("fire") || ev.message.toLowerCase().includes("blaze") || ev.message.includes("consumed") ? "warn" : undefined);
          if (ev.type === "milestone" || ev.type === "mission" || ev.type === "laurel") audio.play("unlock");
          else if (ev.type === "tutorial") audio.play("ui_hover");
          else if (ev.type === "event" && /fire|blaze|consumed/i.test(ev.message)) audio.play("fire");
          else if (ev.type === "budget" || ev.type === "event") audio.play("coin");
        }
        hud.lockTools(city.population());
        for (const tile of city.takeDirty()) world.syncTile(city, tile.x, tile.y);
      }
    }
    world.update(dt, city);
    world.updateLayer(city, infoLayer);
    hud.update(city, city.stats());
    world.drawMinimap(hud.minimap, city);
    audio.setDayNight(world.nightAmount(city));
    if (city.tickCount % 40 === 0) saveCity(city);
  } else {
    world.update(dt, city);
  }
  world.render();
  requestAnimationFrame(frame);
}

refreshContinue();
void bootGame();
requestAnimationFrame(frame);

declare global {
  interface Window {
    __AETHERIS__?: {
      city: () => City;
      stats: () => ReturnType<City["stats"]>;
      running: () => boolean;
      tool: () => ToolId;
      lookMode: () => boolean;
      speed: () => number;
      startNew: (name?: string) => void;
      setTool: (id: ToolId) => void;
      place: (id: string, x: number, y: number) => boolean;
      demolish: (x: number, y: number) => boolean;
      upgrade: (x: number, y: number) => boolean;
      inspect: (x: number, y: number) => void;
      ignite: (x: number, y: number) => boolean;
      tick: (n?: number) => void;
      skipTutorial: () => void;
      continueTutorial: () => boolean;
      tutorial: () => { done: boolean; index: number; id: string | null };
      achievements: () => string[];
      project: (x: number, y: number, height?: number) => { x: number; y: number } | null;
      lookAt: (x: number, y: number) => void;
      hud: () => {
        cityName: string;
        date: string;
        money: string;
        souls: string;
        spirit: string;
        labor: string;
        power: string;
        water: string;
        blaze: string | null;
        hint: string;
        tax: string;
        primer: { visible: boolean; title: string; wait: string; continueDisabled: boolean };
        helpOpen: boolean;
        laurelsOpen: boolean;
        charterOpen: boolean;
        inspectOpen: boolean;
        inspectTitle: string;
        lookOn: boolean;
        lockedTools: string[];
        missions: string[];
        laurelsEarned: string;
        category: string;
        layer: string;
      };
    };
  }
}

function readHud() {
  const q = (sel: string) => hudRoot.querySelector(sel) as HTMLElement | null;
  const coach = q("#coach");
  const inspect = q("#inspect-panel");
  const help = q("#help-sheet");
  const laurels = q("#laurels-panel");
  const fireWrap = q("#stat-fire-wrap");
  return {
    cityName: q("#city-name")?.textContent ?? "",
    date: q("#date-line")?.textContent ?? "",
    money: q("#stat-money")?.textContent ?? "",
    souls: q("#stat-pop")?.textContent ?? "",
    spirit: q("#stat-happy")?.textContent ?? "",
    labor: q("#stat-jobs")?.textContent ?? "",
    power: q("#stat-power")?.textContent ?? "",
    water: q("#stat-water")?.textContent ?? "",
    blaze: fireWrap && !fireWrap.hidden ? q("#stat-fire")?.textContent ?? "0" : null,
    hint: q("#hint")?.textContent ?? "",
    tax: q("#tax-val")?.textContent ?? "",
    primer: {
      visible: Boolean(coach && !coach.hidden),
      title: coach?.querySelector("h3")?.textContent ?? "",
      wait: coach?.querySelector("[data-wait]")?.textContent ?? "",
      continueDisabled: Boolean((coach?.querySelector("[data-next]") as HTMLButtonElement | null)?.disabled),
    },
    helpOpen: Boolean(help && !help.hidden),
    laurelsOpen: Boolean(laurels && !laurels.hidden),
    charterOpen: Boolean(q("#charter")?.classList.contains("open")),
    inspectOpen: Boolean(inspect && !inspect.hidden),
    inspectTitle: inspect?.querySelector("h3")?.textContent ?? "",
    lookOn: hud.lookMode,
    lockedTools: [...hudRoot.querySelectorAll(".tool.locked")].map((el) => (el as HTMLElement).dataset.tool ?? ""),
    missions: [...hudRoot.querySelectorAll("#charter-list li strong")].map((el) => el.textContent ?? ""),
    laurelsEarned: laurels?.querySelector("header span")?.textContent ?? "",
    category: hud.category,
    layer: hud.layer,
  };
}

window.__AETHERIS__ = {
  city: () => city,
  stats: () => city.stats(),
  running: () => running,
  tool: () => tool,
  lookMode: () => cam.lookMode,
  speed: () => speed,
  startNew: (name = "Aetheris") => {
    startCity(new City(40, name));
  },
  setTool: (id) => setTool(id),
  place: (id, x, y) => {
    const ok = city.place(id, x, y);
    if (ok) world.syncTile(city, x, y);
    hud.update(city, city.stats());
    hud.lockTools(city.population());
    return ok;
  },
  demolish: (x, y) => {
    const res = city.demolish(x, y);
    if (res.ok) world.syncTile(city, x, y);
    hud.update(city, city.stats());
    return res.ok;
  },
  upgrade: (x, y) => {
    const res = city.upgrade(x, y);
    if (res.ok) world.syncTile(city, x, y);
    hud.update(city, city.stats());
    return res.ok;
  },
  inspect: (x, y) => {
    inspectAt = { x, y };
    city.note("surveyed");
    hud.inspect(city, x, y);
    emitCityEvents();
  },
  ignite: (x, y) => {
    const ok = city.ignite(x, y);
    if (ok) world.syncTile(city, x, y);
    hud.update(city, city.stats());
    return ok;
  },
  tick: (n = 1) => {
    for (let i = 0; i < n; i++) city.tick();
    for (const tile of city.takeDirty()) world.syncTile(city, tile.x, tile.y);
    hud.update(city, city.stats());
    hud.lockTools(city.population());
  },
  skipTutorial: () => {
    city.skipTutorial();
    hud.update(city, city.stats());
  },
  continueTutorial: () => {
    const ok = city.continueTutorial();
    hud.update(city, city.stats());
    return ok;
  },
  tutorial: () => ({
    done: city.tutorialDone,
    index: city.tutorialIndex,
    id: tutorialStep(city)?.id ?? null,
  }),
  achievements: () => [...city.completedAchievements],
  project: (x, y, height = 0) => {
    const p = tileToWorld(x, y, city.size);
    p.y = height;
    p.project(world.camera);
    if (p.z > 1) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: (p.x * 0.5 + 0.5) * r.width + r.left,
      y: (-p.y * 0.5 + 0.5) * r.height + r.top,
    };
  },
  lookAt: (x, y) => {
    const p = tileToWorld(x, y, city.size);
    cam.target.set(p.x, 0, p.z);
    cam.spherical.radius = 28;
  },
  hud: () => readHud(),
};
