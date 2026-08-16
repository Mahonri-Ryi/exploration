import { CATALOG_BY_ID, TOOL_ORDER, type ToolId } from "../game/catalog";
import { MONTHS, FIRE_BURN_TICKS, type City, type CityStats } from "../game/city";

export interface HudHandlers {
  onTool: (id: ToolId) => void;
  onSpeed: (n: number) => void;
  onTax: (n: number) => void;
  onMute: () => void;
  onSave: () => void;
  onMenu: () => void;
  onUpgrade: (x: number, y: number) => void;
}

const ICONS: Record<string, string> = {
  inspect: "icon-inspect.png",
  bulldoze: "icon-bulldoze.png",
};

export class Hud {
  readonly root: HTMLElement;
  private handlers: HudHandlers;
  tool: ToolId = "inspect";

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.renderChrome();
  }

  private renderChrome(): void {
    this.root.innerHTML = `
      <header class="topbar">
        <div class="brand">
          <img src="./assets/branding/favicon-64.png" alt="" />
          <div>
            <div class="city-name" id="city-name">Aetheris</div>
            <div class="date" id="date-line">Hamlet · Year 1</div>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat" title="Treasury"><span>Treasury</span><b id="stat-money">$0</b></div>
          <div class="stat" title="Population"><span>Souls</span><b id="stat-pop">0</b></div>
          <div class="stat" title="Happiness"><span>Spirit</span><b id="stat-happy">—</b></div>
          <div class="stat" title="Jobs"><span>Labor</span><b id="stat-jobs">0</b></div>
          <div class="stat" title="Power"><span>Power</span><b id="stat-power">0/0</b></div>
          <div class="stat" title="Water"><span>Water</span><b id="stat-water">0/0</b></div>
          <div class="stat fire-stat" id="stat-fire-wrap" hidden title="Fires"><span>Blaze</span><b id="stat-fire">0</b></div>
        </div>
        <div class="clock">
          <button data-speed="0">❚❚</button>
          <button data-speed="1" class="on">1×</button>
          <button data-speed="2">2×</button>
          <button data-speed="3">3×</button>
          <button id="btn-mute" title="Mute">♪</button>
          <button id="btn-save">Save</button>
          <button id="btn-menu">Menu</button>
        </div>
      </header>
      <aside class="toolbar" id="toolbar"></aside>
      <section class="inspect" id="inspect-panel" hidden></section>
      <section class="charter" id="charter">
        <h3>Charter</h3>
        <ol id="charter-list"></ol>
        <canvas id="minimap" width="40" height="40" aria-label="Minimap"></canvas>
      </section>
      <footer class="bottom">
        <div class="demand">
          <label>R <i id="bar-r"></i></label>
          <label>C <i id="bar-c"></i></label>
          <label>I <i id="bar-i"></i></label>
        </div>
        <div class="hint" id="hint">Select a tool. Right-drag to orbit. Scroll to zoom. WASD to pan.</div>
        <label class="tax">Levy
          <input id="tax" type="range" min="4" max="16" value="9" />
          <b id="tax-val">9%</b>
        </label>
      </footer>
      <aside class="help" id="help-sheet" hidden>
        <h3>Field notes</h3>
        <ul>
          <li><kbd>1</kbd>–<kbd>8</kbd> tools · <kbd>I</kbd> survey · <kbd>X</kbd> raze · <kbd>U</kbd> upgrade</li>
          <li><kbd>H</kbd> this sheet · <kbd>Space</kbd> pause · <kbd>R</kbd> reset camera</li>
          <li>Right-drag orbits. WASD pans. Scroll zooms. Paint avenues across water for bridges.</li>
          <li>Windmills make clean power. Docks need shore. The Beacon doubles trader dues.</li>
          <li>Fires consume a plot unless a live Fire Hall stands nearby. Press U on a surveyed home to raise it.</li>
        </ul>
      </aside>
    `;
    const bar = this.root.querySelector("#toolbar")!;
    for (const id of TOOL_ORDER) {
      const def = CATALOG_BY_ID[id];
      const icon = def ? def.icon : ICONS[id];
      const name = def ? def.name : id === "inspect" ? "Survey" : "Raze";
      const cost = def ? `$${def.cost.toLocaleString()}` : "";
      const btn = document.createElement("button");
      btn.className = id === "bulldoze" ? "tool danger" : "tool";
      btn.dataset.tool = id;
      btn.title = def ? `${def.name} — ${def.description}` : name;
      btn.innerHTML = `
        <img src="./assets/icons/${icon}" alt="${name}" />
        <em>${name}</em>
        <small>${cost}</small>
      `;
      btn.addEventListener("click", () => this.handlers.onTool(id));
      bar.appendChild(btn);
    }
    this.root.querySelectorAll("[data-speed]").forEach((el) => {
      el.addEventListener("click", () => {
        const n = Number((el as HTMLElement).dataset.speed);
        this.handlers.onSpeed(n);
        this.root.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("on", b === el));
      });
    });
    this.root.querySelector("#btn-mute")!.addEventListener("click", () => this.handlers.onMute());
    this.root.querySelector("#btn-save")!.addEventListener("click", () => this.handlers.onSave());
    this.root.querySelector("#btn-menu")!.addEventListener("click", () => this.handlers.onMenu());
    const tax = this.root.querySelector("#tax") as HTMLInputElement;
    tax.addEventListener("input", () => {
      const n = Number(tax.value) / 100;
      (this.root.querySelector("#tax-val") as HTMLElement).textContent = `${tax.value}%`;
      this.handlers.onTax(n);
    });
  }

  setTool(id: ToolId): void {
    this.tool = id;
    this.root.querySelectorAll(".tool").forEach((b) => {
      b.classList.toggle("on", (b as HTMLElement).dataset.tool === id);
    });
    const def = CATALOG_BY_ID[id];
    const hint = this.root.querySelector("#hint")!;
    if (id === "inspect") hint.textContent = "Survey a plot. Press U to upgrade a building.";
    else if (id === "bulldoze") hint.textContent = "Raze a structure. The treasury recovers 40%.";
    else if (id === "road") hint.textContent = "Avenue: paint land, or span water as a gold bridge ($90).";
    else if (id === "mill") hint.textContent = "Windmill: cheap clean power. Needs an avenue, not a water main.";
    else if (id === "beacon") hint.textContent = "River Beacon: unique lighthouse on the shore. Doubles dock dues.";
    else if (id === "observatory") hint.textContent = "Observatory: unique wonder. Lifts spirit across the city.";
    else if (id === "inn") hint.textContent = "Hearth Inn: rooms for travelers. Nearby homes sleep easier.";
    else if (def) hint.textContent = `${def.name}: ${def.description}`;
  }

  setSpeed(n: number): void {
    this.root.querySelectorAll("[data-speed]").forEach((b) => {
      b.classList.toggle("on", Number((b as HTMLElement).dataset.speed) === n);
    });
  }

  setMuted(muted: boolean): void {
    const btn = this.root.querySelector("#btn-mute") as HTMLButtonElement;
    btn.textContent = muted ? "🔇" : "♪";
  }

  update(city: City, stats: CityStats): void {
    (this.root.querySelector("#city-name") as HTMLElement).textContent = city.name;
    (this.root.querySelector("#date-line") as HTMLElement).textContent =
      `${stats.era} · ${MONTHS[stats.month - 1]} ${stats.day}, Year ${stats.year}  ·  ${String(stats.hour).padStart(2, "0")}:00`;
    (this.root.querySelector("#stat-money") as HTMLElement).textContent = `$${Math.floor(stats.money).toLocaleString()}`;
    (this.root.querySelector("#stat-pop") as HTMLElement).textContent = Math.floor(stats.population).toLocaleString();
    (this.root.querySelector("#stat-happy") as HTMLElement).textContent = `${Math.round(stats.happiness)}%`;
    (this.root.querySelector("#stat-jobs") as HTMLElement).textContent =
      `${Math.floor(stats.employed)}/${Math.floor(stats.jobs)}`;
    (this.root.querySelector("#stat-power") as HTMLElement).textContent =
      `${stats.powerDemand}/${stats.powerSupply}`;
    (this.root.querySelector("#stat-water") as HTMLElement).textContent =
      `${stats.waterDemand}/${stats.waterSupply}`;
    (this.root.querySelector("#bar-r") as HTMLElement).style.width = `${stats.demandR * 100}%`;
    (this.root.querySelector("#bar-c") as HTMLElement).style.width = `${stats.demandC * 100}%`;
    (this.root.querySelector("#bar-i") as HTMLElement).style.width = `${stats.demandI * 100}%`;
    const money = this.root.querySelector("#stat-money")!;
    money.classList.toggle("bad", stats.money < 0);
    const pwr = this.root.querySelector("#stat-power")!;
    pwr.classList.toggle("bad", stats.powerDemand > stats.powerSupply);
    const wtr = this.root.querySelector("#stat-water")!;
    wtr.classList.toggle("bad", stats.waterDemand > stats.waterSupply);
    const fireWrap = this.root.querySelector("#stat-fire-wrap") as HTMLElement | null;
    if (fireWrap) {
      fireWrap.hidden = stats.fires <= 0;
      const fireStat = this.root.querySelector("#stat-fire") as HTMLElement | null;
      if (fireStat) fireStat.textContent = String(stats.fires);
    }
    this.renderCharter(city);
  }

  private renderCharter(city: City): void {
    const list = this.root.querySelector("#charter-list");
    if (!list) return;
    const open = city.activeMissions();
    list.innerHTML = open
      .map(
        (m) =>
          `<li><strong>${m.title}</strong><span>${m.detail}</span><em>+$${m.reward.toLocaleString()}</em></li>`,
      )
      .join("");
    if (!open.length) list.innerHTML = "<li><strong>Charter fulfilled.</strong><span>The city writes its own fate.</span></li>";
  }

  get minimap(): HTMLCanvasElement {
    return this.root.querySelector("#minimap") as HTMLCanvasElement;
  }

  inspect(city: City, x: number, y: number): void {
    const panel = this.root.querySelector("#inspect-panel") as HTMLElement;
    const tile = city.get(x, y);
    if (!tile) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const def = tile.buildingId ? city.def(tile.buildingId) : null;
    const cov = city.coverageAt(x, y);
    const access = city.hasRoadAccess(x, y);
    const plan = def && !def.isRoad ? city.upgradeCostAt(x, y) : null;
    const waterText = tile.water
      ? tile.road
        ? "A bridge spans the watercourse."
        : "A watercourse. Paint an avenue from shore to raise a bridge."
      : "A plot awaiting a purpose.";
    panel.innerHTML = `
      <h3>${tile.road && tile.water ? "Bridge" : def ? def.name : tile.water ? "River" : "Open land"}</h3>
      <p>${def ? def.description : waterText}</p>
      <ul>
        <li>Parcel ${x}, ${y}</li>
        <li>Road ${access ? "connected" : "isolated"}</li>
        <li>Power ${tile.powered ? "live" : "dark"} · Water ${tile.watered ? "flowing" : "dry"}</li>
        ${tile.onFire ? `<li class="blaze">Ablaze — ${Math.max(0, FIRE_BURN_TICKS - tile.fireAge)} ticks until the plot is lost</li>` : ""}
        ${def && !def.isRoad ? `<li>Residents ${tile.residents}/${def.residents || 0} · Workers ${tile.workers}/${def.jobs || 0}</li>` : ""}
        <li>Park ${cov.park.toFixed(1)} · Watch ${cov.service.toFixed(1)} · Smoke ${cov.pollution.toFixed(1)}</li>
      </ul>
      ${
        plan
          ? `<button class="upgrade" data-x="${x}" data-y="${y}">
              <img src="./assets/icons/icon-upgrade.png" alt="" />
              Raise to ${plan.name} · $${plan.cost.toLocaleString()}
            </button>`
          : ""
      }
    `;
    const btn = panel.querySelector(".upgrade") as HTMLButtonElement | null;
    btn?.addEventListener("click", () => this.handlers.onUpgrade(x, y));
  }

  hideInspect(): void {
    (this.root.querySelector("#inspect-panel") as HTMLElement).hidden = true;
  }

  toggleHelp(): boolean {
    const sheet = this.root.querySelector("#help-sheet") as HTMLElement | null;
    if (!sheet) return false;
    sheet.hidden = !sheet.hidden;
    return !sheet.hidden;
  }

  lockTools(pop: number): void {
    this.root.querySelectorAll(".tool").forEach((b) => {
      const id = (b as HTMLElement).dataset.tool!;
      const def = CATALOG_BY_ID[id];
      const locked = Boolean(def && pop < def.unlockPop);
      b.classList.toggle("locked", locked);
      (b as HTMLButtonElement).disabled = locked;
    });
  }
}

export function toast(message: string, kind?: "warn"): void {
  const host = document.getElementById("toasts")!;
  const el = document.createElement("div");
  el.className = kind ? `toast ${kind}` : "toast";
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => {
    el.classList.remove("in");
    setTimeout(() => el.remove(), 400);
  }, 3200);
}
