import { CATALOG_BY_ID, isWaterTile, type BuildingDef } from "./catalog";
import { ACHIEVEMENTS } from "./achievements";
import { BRIDGE_COST, MISSIONS, UPGRADE_OF, upgradeCost } from "./missions";
import { TUTORIAL } from "./tutorial";

export interface Tile {
  x: number;
  y: number;
  water: boolean;
  buildingId: string | null;
  road: boolean;
  powered: boolean;
  watered: boolean;
  residents: number;
  workers: number;
  age: number;
  onFire: boolean;
  fireAge: number;
}

export interface CityStats {
  money: number;
  population: number;
  jobs: number;
  employed: number;
  unemployment: number;
  happiness: number;
  powerSupply: number;
  powerDemand: number;
  waterSupply: number;
  waterDemand: number;
  income: number;
  expenses: number;
  day: number;
  month: number;
  year: number;
  hour: number;
  demandR: number;
  demandC: number;
  demandI: number;
  pollution: number;
  era: string;
  prestige: number;
  fires: number;
}

export interface CityFlags {
  surveyed: boolean;
  upgraded: boolean;
  razed: boolean;
  paused: boolean;
  helpOpened: boolean;
  laurels: boolean;
  quenched: boolean;
  taxed: boolean;
}

export interface CityEvent {
  type: "milestone" | "budget" | "info" | "mission" | "event" | "tutorial" | "laurel";
  message: string;
}

export interface SerializedCity {
  version: 1;
  name: string;
  size: number;
  money: number;
  taxRate: number;
  tickCount: number;
  tiles: Array<{
    x: number;
    y: number;
    buildingId: string | null;
    road: boolean;
    residents: number;
    workers: number;
    age: number;
    onFire?: boolean;
    fireAge?: number;
  }>;
  completedMissions?: string[];
  completedAchievements?: string[];
  flags?: Partial<CityFlags>;
  tutorialIndex?: number;
  tutorialDone?: boolean;
  happyBoost?: number;
  happyBoostUntil?: number;
}

const TICKS_PER_DAY = 24;
const DAYS_PER_MONTH = 8;
export const FIRE_BURN_TICKS = 12;

export const EMPTY_FLAGS: CityFlags = {
  surveyed: false,
  upgraded: false,
  razed: false,
  paused: false,
  helpOpened: false,
  laurels: false,
  quenched: false,
  taxed: false,
};

export function eraName(pop: number): string {
  if (pop >= 800) return "Metropolis";
  if (pop >= 400) return "City";
  if (pop >= 120) return "Town";
  if (pop >= 40) return "Village";
  return "Hamlet";
}

export class City {
  readonly size: number;
  readonly tiles: Tile[];
  name: string;
  money: number;
  taxRate: number;
  tickCount: number;
  lastIncome = 0;
  lastExpenses = 0;
  events: CityEvent[] = [];
  completedMissions = new Set<string>();
  completedAchievements = new Set<string>();
  flags: CityFlags = { ...EMPTY_FLAGS };
  tutorialIndex = 0;
  tutorialDone = false;
  happyBoost = 0;
  happyBoostUntil = 0;
  dirty = new Set<string>();
  private milestones = new Set<number>();

  constructor(size = 40, name = "Aetheris") {
    this.size = size;
    this.name = name;
    this.money = 75000;
    this.taxRate = 0.09;
    this.tickCount = 8 * TICKS_PER_DAY;
    this.tiles = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.tiles.push({
          x,
          y,
          water: isWaterTile(x, y, size),
          buildingId: null,
          road: false,
          powered: false,
          watered: false,
          residents: 0,
          workers: 0,
          age: 0,
          onFire: false,
          fireAge: 0,
        });
      }
    }
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  get(x: number, y: number): Tile | null {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[this.idx(x, y)];
  }

  def(id: string): BuildingDef | undefined {
    return CATALOG_BY_ID[id];
  }

  hasUnique(id: string): boolean {
    return this.tiles.some((t) => t.buildingId === id);
  }

  neighbors4(x: number, y: number): Tile[] {
    return this.neighbors(x, y, false);
  }

  neighbors8(x: number, y: number): Tile[] {
    return this.neighbors(x, y, true);
  }

  private neighbors(x: number, y: number, diag: boolean): Tile[] {
    const out: Tile[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!diag && dx !== 0 && dy !== 0) continue;
        const t = this.get(x + dx, y + dy);
        if (t) out.push(t);
      }
    }
    return out;
  }

  hasRoadAccess(x: number, y: number): boolean {
    const t = this.get(x, y);
    if (!t) return false;
    if (t.road) return true;
    return this.neighbors8(x, y).some((n) => n.road);
  }

  canPlace(id: string, x: number, y: number): { ok: boolean; reason?: string } {
    const tile = this.get(x, y);
    const def = this.def(id);
    if (!tile || !def) return { ok: false, reason: "Invalid tile." };
    if (tile.buildingId || tile.road) return { ok: false, reason: "Tile is occupied." };
    const cost = tile.water && def.isRoad ? BRIDGE_COST : def.cost;
    if (tile.water && !def.isRoad) return { ok: false, reason: "Cannot build on water." };
    if (tile.water && def.isRoad && !this.neighbors8(x, y).some((n) => n.road)) {
      return { ok: false, reason: "Bridges must join an avenue." };
    }
    if (def.waterfront && !this.neighbors4(x, y).some((n) => n.water)) {
      return { ok: false, reason: "Docks must face the river." };
    }
    if (this.money < cost) return { ok: false, reason: "The treasury cannot afford this." };
    if (def.unique && this.hasUnique(def.id)) {
      return { ok: false, reason: `Only one ${def.name} may stand.` };
    }
    const pop = this.population();
    if (pop < def.unlockPop) {
      return { ok: false, reason: `Unlocks at ${def.unlockPop} citizens.` };
    }
    return { ok: true };
  }

  place(id: string, x: number, y: number): boolean {
    const check = this.canPlace(id, x, y);
    if (!check.ok) return false;
    const def = this.def(id)!;
    const tile = this.get(x, y)!;
    this.money -= tile.water && def.isRoad ? BRIDGE_COST : def.cost;
    if (def.isRoad) {
      tile.road = true;
      tile.buildingId = "road";
    } else {
      tile.buildingId = def.id;
    }
    tile.age = 0;
    tile.residents = 0;
    tile.workers = 0;
    tile.onFire = false;
    tile.fireAge = 0;
    this.markDirty(x, y);
    this.floodUtilities();
    this.refreshProgress();
    return true;
  }

  demolish(x: number, y: number): { ok: boolean; refund: number; reason?: string } {
    const tile = this.get(x, y);
    if (!tile || (!tile.buildingId && !tile.road)) {
      return { ok: false, refund: 0, reason: "Nothing to remove." };
    }
    const def = this.def(tile.buildingId ?? "road");
    const refund = def ? Math.floor(def.cost * 0.4) : 0;
    tile.buildingId = null;
    tile.road = false;
    tile.residents = 0;
    tile.workers = 0;
    tile.powered = false;
    tile.watered = false;
    tile.age = 0;
    tile.onFire = false;
    tile.fireAge = 0;
    this.money += refund;
    this.markDirty(x, y);
    this.flags.razed = true;
    this.floodUtilities();
    this.refreshProgress();
    return { ok: true, refund };
  }

  upgradeCostAt(x: number, y: number): { nextId: string; cost: number; name: string } | null {
    const tile = this.get(x, y);
    if (!tile?.buildingId) return null;
    const nextId = UPGRADE_OF[tile.buildingId];
    const from = this.def(tile.buildingId);
    const to = nextId ? this.def(nextId) : undefined;
    if (!from || !to) return null;
    return { nextId, cost: upgradeCost(from.cost, to.cost), name: to.name };
  }

  upgrade(x: number, y: number): { ok: boolean; reason?: string; name?: string } {
    const plan = this.upgradeCostAt(x, y);
    const tile = this.get(x, y);
    if (!plan || !tile) return { ok: false, reason: "Nothing here will rise further." };
    const to = this.def(plan.nextId);
    if (!to) return { ok: false, reason: "Nothing here will rise further." };
    if (this.money < plan.cost) return { ok: false, reason: "The treasury cannot afford this." };
    this.money -= plan.cost;
    const keep = tile.residents;
    tile.buildingId = plan.nextId;
    tile.residents = Math.min(keep, to.residents);
    tile.workers = 0;
    tile.age = 0;
    this.floodUtilities();
    this.flags.upgraded = true;
    this.markDirty(x, y);
    this.refreshProgress();
    return { ok: true, name: to.name };
  }

  markDirty(x: number, y: number): void {
    this.dirty.add(`${x},${y}`);
  }

  takeDirty(): Array<{ x: number; y: number }> {
    const out = [...this.dirty].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });
    this.dirty.clear();
    return out;
  }

  hasFireCover(x: number, y: number): boolean {
    const hall = this.def("fire");
    const radius = hall?.serviceRadius ?? 8;
    for (const t of this.tiles) {
      if (t.buildingId !== "fire") continue;
      const def = this.def("fire");
      if (!def) continue;
      if (!this.hasRoadAccess(t.x, t.y)) continue;
      if (def.powerUse > 0 && !t.powered) continue;
      if (def.waterUse > 0 && !t.watered) continue;
      const dist = Math.abs(t.x - x) + Math.abs(t.y - y);
      if (dist <= radius) return true;
    }
    return false;
  }

  ignite(x: number, y: number): boolean {
    const tile = this.get(x, y);
    if (!tile?.buildingId || tile.road) return false;
    if (tile.buildingId === "fire" || tile.buildingId === "park" || tile.buildingId === "plaza") return false;
    if (tile.onFire) return false;
    tile.onFire = true;
    tile.fireAge = 0;
    this.markDirty(x, y);
    return true;
  }

  activeMissions(): typeof MISSIONS {
    return MISSIONS.filter((m) => !this.completedMissions.has(m.id)).slice(0, 4);
  }

  collectMissions(): CityEvent[] {
    const found: CityEvent[] = [];
    for (const mission of MISSIONS) {
      if (this.completedMissions.has(mission.id)) continue;
      if (!mission.check(this)) continue;
      this.completedMissions.add(mission.id);
      this.money += mission.reward;
      const ev: CityEvent = {
        type: "mission",
        message: `Charter complete: ${mission.title}  ·  +$${mission.reward.toLocaleString()}`,
      };
      found.push(ev);
      this.events.push(ev);
    }
    return found;
  }

  note(flag: keyof CityFlags): void {
    this.flags[flag] = true;
    this.refreshProgress();
  }

  refreshProgress(): void {
    this.collectMissions();
    this.tryAdvanceTutorial();
    this.collectAchievements();
  }

  tryAdvanceTutorial(): void {
    if (this.tutorialDone) return;
    while (this.tutorialIndex < TUTORIAL.length) {
      const step = TUTORIAL[this.tutorialIndex];
      if (!step.wait || !step.wait(this)) break;
      this.events.push({ type: "tutorial", message: `Primer: ${step.title}.` });
      this.tutorialIndex += 1;
    }
    if (this.tutorialIndex >= TUTORIAL.length) this.finishTutorial();
  }

  continueTutorial(): boolean {
    if (this.tutorialDone) return false;
    const step = TUTORIAL[this.tutorialIndex];
    if (!step) {
      this.finishTutorial();
      return true;
    }
    if (step.wait && !step.wait(this)) return false;
    this.tutorialIndex += 1;
    this.tryAdvanceTutorial();
    this.collectAchievements();
    return true;
  }

  skipTutorial(): void {
    this.finishTutorial();
    this.collectAchievements();
  }

  restartTutorial(): void {
    this.tutorialDone = false;
    this.tutorialIndex = 0;
  }

  private finishTutorial(): void {
    this.tutorialDone = true;
    this.tutorialIndex = TUTORIAL.length;
  }

  collectAchievements(): CityEvent[] {
    const found: CityEvent[] = [];
    for (const laurel of ACHIEVEMENTS) {
      if (this.completedAchievements.has(laurel.id)) continue;
      if (!laurel.check(this)) continue;
      this.completedAchievements.add(laurel.id);
      const ev: CityEvent = {
        type: "laurel",
        message: `Laurel: ${laurel.title} — ${laurel.detail}`,
      };
      found.push(ev);
      this.events.push(ev);
    }
    return found;
  }

  population(): number {
    let n = 0;
    for (const t of this.tiles) n += t.residents;
    return n;
  }

  floodUtilities(): void {
    for (const t of this.tiles) {
      t.powered = false;
      t.watered = false;
    }
    this.flood("powered", (d) => (d.powerGen ?? 0) > 0);
    this.flood("watered", (d) => (d.waterGen ?? 0) > 0);
    this.radiusUtilities();
  }

  private radiusUtilities(): void {
    for (const src of this.tiles) {
      if (!src.buildingId) continue;
      const def = this.def(src.buildingId);
      if (!def) continue;
      if (def.powerGen <= 0 && def.waterGen <= 0) continue;
      for (const t of this.tiles) {
        const dist = Math.abs(t.x - src.x) + Math.abs(t.y - src.y);
        if (dist > 12) continue;
        if (!t.road && !t.buildingId) continue;
        if (def.powerGen > 0) t.powered = true;
        if (def.waterGen > 0) t.watered = true;
      }
    }
  }

  private flood(flag: "powered" | "watered", isSource: (d: BuildingDef) => boolean): void {
    const q: Tile[] = [];
    for (const t of this.tiles) {
      if (!t.buildingId) continue;
      const d = this.def(t.buildingId);
      if (d && isSource(d)) {
        t[flag] = true;
        q.push(t);
      }
    }
    while (q.length) {
      const cur = q.pop()!;
      for (const n of this.neighbors8(cur.x, cur.y)) {
        if (n[flag]) continue;
        if (n.water) continue;
        if (!n.road && !n.buildingId) continue;
        n[flag] = true;
        q.push(n);
      }
    }
  }

  coverageAt(x: number, y: number): { park: number; service: number; pollution: number } {
    let park = 0;
    let service = 0;
    let pollution = 0;
    for (const t of this.tiles) {
      if (!t.buildingId) continue;
      const d = this.def(t.buildingId);
      if (!d) continue;
      const dist = Math.abs(t.x - x) + Math.abs(t.y - y);
      if (d.pollution) {
        const falloff = Math.max(0, 6 - dist);
        pollution += d.pollution * falloff * 0.18;
      }
      if (d.parkValue && dist <= Math.max(1, d.serviceRadius || 4)) {
        park += d.parkValue * (1 - dist / (d.serviceRadius + 1));
      }
      if (d.category === "service" && dist <= d.serviceRadius) {
        service += 1 - dist / (d.serviceRadius + 1);
      }
      if (d.id === "cityhall" && dist <= d.serviceRadius) {
        service += 0.4;
        park += 2;
      }
      if (d.id === "inn" && dist <= d.serviceRadius) {
        service += 0.35;
      }
      if (d.id === "beacon" && dist <= d.serviceRadius) {
        service += 0.25;
        park += 1.5;
      }
      if (d.id === "observatory") {
        service += 0.2;
        park += 1.2;
      }
    }
    return { park, service, pollution };
  }

  private operating(tile: Tile, def: BuildingDef): boolean {
    if (def.isRoad) return true;
    if (tile.onFire) return false;
    if (!this.hasRoadAccess(tile.x, tile.y)) return false;
    if (def.powerUse > 0 && !tile.powered) return false;
    if (def.waterUse > 0 && !tile.watered) return false;
    return true;
  }

  tick(): CityEvent[] {
    this.events = [];
    this.tickCount += 1;
    this.floodUtilities();
    this.resolveFires();
    this.floodUtilities();

    let jobs = 0;
    let jobNeed: Array<{ tile: Tile; def: BuildingDef; open: number }> = [];
    let popCap = 0;
    let powerSupply = 0;
    let powerDemand = 0;
    let waterSupply = 0;
    let waterDemand = 0;
    let expenses = 0;

    for (const tile of this.tiles) {
      if (!tile.buildingId) continue;
      const def = this.def(tile.buildingId);
      if (!def) continue;
      expenses += def.upkeep;
      powerSupply += def.powerGen;
      waterSupply += def.waterGen;
      const on = this.operating(tile, def);
      if (on) {
        powerDemand += def.powerUse;
        waterDemand += def.waterUse;
        popCap += def.residents;
        if (def.jobs > 0) {
          jobs += def.jobs;
          jobNeed.push({ tile, def, open: def.jobs });
        }
      } else {
        tile.workers = Math.max(0, tile.workers - 1);
        if (def.residents) tile.residents = Math.max(0, tile.residents - 1);
      }
      tile.age += 1;
    }

    const labor = this.population();
    let remainingWorkers = labor;
    for (const slot of jobNeed) {
      const hire = Math.min(slot.open, remainingWorkers);
      slot.tile.workers = hire;
      remainingWorkers -= hire;
    }

    const employed = labor - remainingWorkers;
    const employment = labor === 0 ? 0.7 : employed / labor;

    let happinessAcc = 0;
    let happyTiles = 0;
    for (const tile of this.tiles) {
      if (!tile.buildingId) continue;
      const def = this.def(tile.buildingId);
      if (!def || !def.residents) continue;
      const on = this.operating(tile, def);
      const cov = this.coverageAt(tile.x, tile.y);
      let h = 52;
      h += Math.min(22, cov.park * 1.4);
      h += Math.min(16, cov.service * 10);
      h += employment * 14;
      h -= Math.min(28, cov.pollution);
      if (!on) h -= 22;
      if (this.taxRate > 0.12) h -= (this.taxRate - 0.12) * 180;
      if (this.tickCount < this.happyBoostUntil) h += this.happyBoost;
      h += this.wonderSpirit();
      h = Math.max(8, Math.min(100, h));
      happinessAcc += h;
      happyTiles += 1;

      if (on) {
        const target = Math.max(1, Math.round(def.residents * (0.4 + (h / 100) * 0.6)));
        if (tile.residents === 0) {
          tile.residents = Math.min(def.residents, Math.max(2, Math.floor(def.residents * 0.35)));
        } else if (tile.residents < target) {
          tile.residents = Math.min(def.residents, tile.residents + 2);
        } else if (tile.residents > target + 1) {
          tile.residents -= 1;
        }
      }
    }

    const happiness = happyTiles ? happinessAcc / happyTiles : 55;
    this.lastExpenses = expenses;

    if (this.tickCount % TICKS_PER_DAY === 0 && this.dayOfMonth() === 0) {
      this.collectTaxes(happiness, employed);
      this.rollEvent();
    }

    this.refreshProgress();

    const pop = this.population();
    for (const mark of [50, 150, 400, 800, 1500]) {
      if (pop >= mark && !this.milestones.has(mark)) {
        this.milestones.add(mark);
        this.events.push({
          type: "milestone",
          message: `${this.name} now shelters ${mark.toLocaleString()} souls.`,
        });
      }
    }

    void powerSupply;
    void powerDemand;
    void waterSupply;
    void waterDemand;
    void jobs;
    void happiness;
    return this.events;
  }

  private collectTaxes(happiness: number, employed: number): void {
    let residential = 0;
    let commercial = 0;
    let industrial = 0;
    for (const tile of this.tiles) {
      if (!tile.buildingId) continue;
      const def = this.def(tile.buildingId);
      if (!def) continue;
      if (def.category === "residential") {
        residential += tile.residents * 3.1 * (happiness / 100);
      } else if (def.category === "commercial") {
        commercial += tile.workers * 5.4;
      } else if (def.category === "industrial") {
        industrial += tile.workers * 4.6;
      } else if (def.id === "dock") {
        const beaconLit = this.tiles.some((t) => {
          if (t.buildingId !== "beacon") return false;
          const b = this.def("beacon");
          return Boolean(b && this.operating(t, b));
        });
        commercial += this.operating(tile, def) ? (beaconLit ? 184 : 92) : 12;
      }
    }
    const income = Math.floor((residential + commercial + industrial) * this.taxRate * 18);
    this.lastIncome = income;
    this.money += income - this.lastExpenses;
    this.events.push({
      type: "budget",
      message: `Ledger closed: +$${income.toLocaleString()} income, −$${this.lastExpenses.toLocaleString()} upkeep.`,
    });
    this.flags.taxed = true;
    void employed;
  }

  private wonderSpirit(): number {
    let n = 0;
    for (const t of this.tiles) {
      if (!t.buildingId) continue;
      const def = this.def(t.buildingId);
      if (!def || !this.operating(t, def)) continue;
      if (def.id === "observatory") n += 8;
      if (def.id === "beacon") n += 3;
      if (def.id === "cityhall") n += 2;
    }
    return n;
  }

  private resolveFires(): void {
    for (const tile of this.tiles) {
      if (!tile.onFire) continue;
      if (this.hasFireCover(tile.x, tile.y)) {
        tile.onFire = false;
        tile.fireAge = 0;
        this.markDirty(tile.x, tile.y);
        this.flags.quenched = true;
        this.events.push({ type: "event", message: "The fire hall quells a blaze." });
        continue;
      }
      tile.fireAge += 1;
      tile.residents = Math.max(0, tile.residents - 2);
      tile.workers = 0;
      if (tile.fireAge < FIRE_BURN_TICKS) continue;
      const def = tile.buildingId ? this.def(tile.buildingId) : undefined;
      const name = def?.name ?? "plot";
      tile.buildingId = null;
      tile.road = false;
      tile.residents = 0;
      tile.workers = 0;
      tile.onFire = false;
      tile.fireAge = 0;
      tile.powered = false;
      tile.watered = false;
      this.markDirty(tile.x, tile.y);
      this.events.push({ type: "event", message: `Fire consumed the ${name}.` });
    }
  }

  private startRandomFire(): void {
    const candidates = this.tiles.filter((t) => {
      if (!t.buildingId || t.road || t.onFire) return false;
      if (t.buildingId === "fire" || t.buildingId === "park" || t.buildingId === "plaza") return false;
      const d = this.def(t.buildingId);
      return Boolean(d && (d.category === "industrial" || d.category === "residential" || d.category === "commercial"));
    });
    if (!candidates.length) return;
    const heavy = candidates.filter((t) => this.def(t.buildingId!)?.category === "industrial");
    const pool = heavy.length ? heavy : candidates;
    const tile = pool[Math.floor(Math.random() * pool.length)]!;
    if (!this.ignite(tile.x, tile.y)) return;
    const name = this.def(tile.buildingId!)?.name ?? "building";
    const covered = this.hasFireCover(tile.x, tile.y);
    this.events.push({
      type: "event",
      message: covered
        ? `Sparks catch the ${name}. The brigade is already moving.`
        : `Fire at the ${name}! Raise a fire hall or it will burn.`,
    });
  }

  private rollEvent(): void {
    if (this.population() < 8) return;
    if (Math.random() > 0.4) return;
    const roll = Math.random();
    if (roll < 0.22) {
      this.happyBoost = 14;
      this.happyBoostUntil = this.tickCount + 40;
      this.events.push({ type: "event", message: "Lanterns drift the river. Spirit lifts for a season." });
    } else if (roll < 0.42) {
      const purse = 900 + Math.floor(Math.random() * 1600);
      this.money += purse;
      this.events.push({ type: "event", message: `River traders pay harbor dues: +$${purse.toLocaleString()}.` });
    } else if (roll < 0.6) {
      let gained = 0;
      for (const tile of this.tiles) {
        const def = tile.buildingId ? this.def(tile.buildingId) : undefined;
        if (!def?.residents || !this.operating(tile, def)) continue;
        if (tile.residents < def.residents) {
          tile.residents += 1;
          gained += 1;
        }
      }
      if (gained) {
        this.events.push({ type: "event", message: `A generous harvest. ${gained} new souls arrive.` });
      }
    } else if (roll < 0.78) {
      this.startRandomFire();
    } else {
      this.happyBoost = -10;
      this.happyBoostUntil = this.tickCount + 28;
      this.events.push({ type: "event", message: "A dry wind. The city drinks deeper and tempers fray." });
    }
  }

  hour(): number {
    return this.tickCount % TICKS_PER_DAY;
  }

  dayOfMonth(): number {
    return Math.floor(this.tickCount / TICKS_PER_DAY) % DAYS_PER_MONTH;
  }

  monthIndex(): number {
    return Math.floor(this.tickCount / (TICKS_PER_DAY * DAYS_PER_MONTH)) % 12;
  }

  year(): number {
    return 1 + Math.floor(this.tickCount / (TICKS_PER_DAY * DAYS_PER_MONTH * 12));
  }

  /** 0 sunrise-ish through 1 full day cycle. */
  dayPhase(): number {
    return (this.tickCount % TICKS_PER_DAY) / TICKS_PER_DAY;
  }

  stats(): CityStats {
    let jobs = 0;
    let employed = 0;
    let powerSupply = 0;
    let powerDemand = 0;
    let waterSupply = 0;
    let waterDemand = 0;
    let expenses = 0;
    let rCap = 0;
    let rHave = 0;
    let cJobs = 0;
    let iJobs = 0;
    let pollution = 0;
    let happinessAcc = 0;
    let happyTiles = 0;

    for (const tile of this.tiles) {
      if (!tile.buildingId) continue;
      const def = this.def(tile.buildingId);
      if (!def) continue;
      expenses += def.upkeep;
      powerSupply += def.powerGen;
      waterSupply += def.waterGen;
      pollution += Math.max(0, def.pollution);
      const on = this.operating(tile, def);
      if (on) {
        powerDemand += def.powerUse;
        waterDemand += def.waterUse;
        jobs += def.jobs;
        employed += tile.workers;
        if (def.category === "commercial") cJobs += def.jobs - tile.workers;
        if (def.category === "industrial") iJobs += def.jobs - tile.workers;
      }
      if (def.residents) {
        rCap += def.residents;
        rHave += tile.residents;
        const cov = this.coverageAt(tile.x, tile.y);
        let h = 52 + Math.min(22, cov.park * 1.4) + Math.min(16, cov.service * 10);
        h -= Math.min(28, cov.pollution);
        if (!on) h -= 22;
        if (tile.onFire) h -= 18;
        h += this.wonderSpirit();
        happinessAcc += Math.max(8, Math.min(100, h));
        happyTiles += 1;
      }
    }

    const population = rHave;
    const employedClamped = Math.min(employed, population);
    const unemployment = population === 0 ? 0 : Math.max(0, 1 - employedClamped / Math.max(1, population));
    const demandR = Math.max(0, Math.min(1, (jobs - population) / 40 + 0.25));
    const demandC = Math.max(0, Math.min(1, cJobs / 40 + population / 200));
    const demandI = Math.max(0, Math.min(1, iJobs / 40 + population / 260));
    const prestige =
      (this.hasUnique("cityhall") ? 4 : 0) +
      (this.hasUnique("beacon") ? 5 : 0) +
      (this.hasUnique("observatory") ? 6 : 0);
    const fires = this.tiles.reduce((n, t) => n + (t.onFire ? 1 : 0), 0);

    return {
      money: this.money,
      population,
      jobs,
      employed: employedClamped,
      unemployment,
      happiness: happyTiles ? happinessAcc / happyTiles : 58,
      powerSupply,
      powerDemand,
      waterSupply,
      waterDemand,
      income: this.lastIncome,
      expenses,
      day: this.dayOfMonth() + 1,
      month: this.monthIndex() + 1,
      year: this.year(),
      hour: this.hour(),
      demandR,
      demandC,
      demandI,
      pollution,
      era: eraName(population),
      prestige,
      fires,
    };
  }

  serialize(): SerializedCity {
    return {
      version: 1,
      name: this.name,
      size: this.size,
      money: this.money,
      taxRate: this.taxRate,
      tickCount: this.tickCount,
      completedMissions: [...this.completedMissions],
      completedAchievements: [...this.completedAchievements],
      flags: { ...this.flags },
      tutorialIndex: this.tutorialIndex,
      tutorialDone: this.tutorialDone,
      happyBoost: this.happyBoost,
      happyBoostUntil: this.happyBoostUntil,
      tiles: this.tiles
        .filter((t) => t.buildingId || t.road)
        .map((t) => ({
          x: t.x,
          y: t.y,
          buildingId: t.buildingId,
          road: t.road,
          residents: t.residents,
          workers: t.workers,
          age: t.age,
          onFire: t.onFire,
          fireAge: t.fireAge,
        })),
    };
  }

  static deserialize(data: SerializedCity): City {
    const city = new City(data.size, data.name);
    city.money = data.money;
    city.taxRate = data.taxRate;
    city.tickCount = data.tickCount;
    city.completedMissions = new Set(data.completedMissions ?? []);
    city.completedAchievements = new Set(data.completedAchievements ?? []);
    city.flags = { ...EMPTY_FLAGS, ...data.flags };
    city.tutorialIndex = data.tutorialIndex ?? 0;
    city.tutorialDone = data.tutorialDone ?? (data.tiles?.length ?? 0) > 0;
    city.happyBoost = data.happyBoost ?? 0;
    city.happyBoostUntil = data.happyBoostUntil ?? 0;
    for (const rec of data.tiles) {
      const tile = city.get(rec.x, rec.y);
      if (!tile) continue;
      if (tile.water && !rec.road) continue;
      tile.buildingId = rec.buildingId;
      tile.road = rec.road;
      tile.residents = rec.residents;
      tile.workers = rec.workers;
      tile.age = rec.age;
      tile.onFire = Boolean(rec.onFire);
      tile.fireAge = rec.fireAge ?? 0;
    }
    city.floodUtilities();
    return city;
  }
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
