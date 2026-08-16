import { CATALOG_BY_ID, isWaterTile, type BuildingDef } from "./catalog";

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
}

export interface CityEvent {
  type: "milestone" | "budget" | "info";
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
  }>;
}

const TICKS_PER_DAY = 24;
const DAYS_PER_MONTH = 8;

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
    if (tile.water) return { ok: false, reason: "Cannot build on water." };
    if (tile.buildingId || tile.road) return { ok: false, reason: "Tile is occupied." };
    if (this.money < def.cost) return { ok: false, reason: "The treasury cannot afford this." };
    if (def.unique && this.hasUnique(def.id)) return { ok: false, reason: "Only one City Hall may stand." };
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
    this.money -= def.cost;
    if (def.isRoad) {
      tile.road = true;
      tile.buildingId = "road";
    } else {
      tile.buildingId = def.id;
    }
    tile.age = 0;
    tile.residents = 0;
    tile.workers = 0;
    this.floodUtilities();
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
    this.money += refund;
    this.floodUtilities();
    return { ok: true, refund };
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
        if (dist > 4) continue;
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
    }
    return { park, service, pollution };
  }

  private operating(tile: Tile, def: BuildingDef): boolean {
    if (def.isRoad) return true;
    if (!this.hasRoadAccess(tile.x, tile.y)) return false;
    if (def.powerUse > 0 && !tile.powered) return false;
    if (def.waterUse > 0 && !tile.watered) return false;
    return true;
  }

  tick(): CityEvent[] {
    this.events = [];
    this.tickCount += 1;
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
    }

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
      }
    }
    const income = Math.floor((residential + commercial + industrial) * this.taxRate * 18);
    this.lastIncome = income;
    this.money += income - this.lastExpenses;
    this.events.push({
      type: "budget",
      message: `Ledger closed: +$${income.toLocaleString()} income, −$${this.lastExpenses.toLocaleString()} upkeep.`,
    });
    void employed;
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
        happinessAcc += Math.max(8, Math.min(100, h));
        happyTiles += 1;
      }
    }

    const population = rHave;
    const unemployment = population === 0 ? 0 : Math.max(0, 1 - employed / Math.max(1, population));
    const demandR = Math.max(0, Math.min(1, (jobs - population) / 40 + 0.25));
    const demandC = Math.max(0, Math.min(1, cJobs / 40 + population / 200));
    const demandI = Math.max(0, Math.min(1, iJobs / 40 + population / 260));

    return {
      money: this.money,
      population,
      jobs,
      employed,
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
        })),
    };
  }

  static deserialize(data: SerializedCity): City {
    const city = new City(data.size, data.name);
    city.money = data.money;
    city.taxRate = data.taxRate;
    city.tickCount = data.tickCount;
    for (const rec of data.tiles) {
      const tile = city.get(rec.x, rec.y);
      if (!tile || tile.water) continue;
      tile.buildingId = rec.buildingId;
      tile.road = rec.road;
      tile.residents = rec.residents;
      tile.workers = rec.workers;
      tile.age = rec.age;
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
