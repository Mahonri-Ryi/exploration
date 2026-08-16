import * as THREE from "three";
import { AudioEngine } from "./audio/engine";
import { CATALOG_BY_ID, type ToolId } from "./game/catalog";
import { City } from "./game/city";
import { hasSave, loadCity, saveCity } from "./game/save";
import { Hud, toast } from "./ui/hud";
import { OrbitCam } from "./world/camera";
import { World, worldToTile } from "./world/world";
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
    hudRoot.hidden = true;
    running = false;
    refreshContinue();
  },
});

function setTool(id: ToolId): void {
  tool = id;
  hud.setTool(id);
  if (id !== "inspect") hud.hideInspect();
  audio.play("ui_click");
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
  hud.lockTools(city.population());
  hud.setTool(tool);
  title.hidden = true;
  hudRoot.hidden = false;
  running = true;
  audio.play("whoosh");
}

async function bootGame(): Promise<void> {
  await world.loadTextures();
  world.bindCity(city);
  refreshContinue();
  boot.remove();
}

document.getElementById("btn-new")!.addEventListener("click", async () => {
  await audio.unlock();
  const name = nameInput.value.trim() || "Aetheris";
  startCity(new City(40, name));
  toast(`${name} is founded on the river.`);
});

continueBtn.addEventListener("click", async () => {
  await audio.unlock();
  const loaded = loadCity();
  if (loaded) startCity(loaded);
});

title.addEventListener("pointerdown", () => {
  void audio.unlock();
}, { once: true });

const pointer = new THREE.Vector2();
function ndc(e: PointerEvent): THREE.Vector2 {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  return pointer;
}

function hoverTile(e: PointerEvent): { x: number; y: number } | null {
  const hit = world.pickGround(ndc(e));
  if (!hit) return null;
  const t = worldToTile(hit, city.size);
  if (!city.inBounds(t.x, t.y)) return null;
  return t;
}

function applyTool(x: number, y: number): void {
  if (tool === "inspect") {
    hud.inspect(city, x, y);
    audio.play("ui_hover");
    return;
  }
  if (tool === "bulldoze") {
    const res = city.demolish(x, y);
    if (res.ok) {
      world.syncTile(city, x, y);
      audio.play("demolish");
      if (res.refund) toast(`Salvage returned $${res.refund.toLocaleString()}.`);
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
}

canvas.addEventListener("pointermove", (e) => {
  if (!running) return;
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
  if (painting && (tool === "road" || tool === "bulldoze")) {
    const key = `${t.x},${t.y}`;
    if (key !== lastPaint) {
      lastPaint = key;
      applyTool(t.x, t.y);
    }
  }
});

canvas.addEventListener("pointerdown", (e) => {
  if (!running || e.button !== 0 || e.altKey || e.shiftKey) return;
  const t = hoverTile(e);
  if (!t) return;
  painting = true;
  lastPaint = `${t.x},${t.y}`;
  applyTool(t.x, t.y);
});

window.addEventListener("pointerup", () => {
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
  if (e.key === " ") {
    e.preventDefault();
    speed = speed === 0 ? 1 : 0;
    hud.setSpeed(speed);
  }
  if (e.key.toLowerCase() === "r") cam.reset();
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
          toast(ev.message);
          if (ev.type === "milestone") audio.play("unlock");
          if (ev.type === "budget") audio.play("coin");
        }
        hud.lockTools(city.population());
      }
    }
    world.update(dt, city);
    hud.update(city, city.stats());
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
