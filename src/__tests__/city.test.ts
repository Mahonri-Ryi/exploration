import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_BY_ID, isWaterTile } from "../game/catalog";
import { City } from "../game/city";

function emptyLand(city: City): { x: number; y: number } {
  for (let y = 2; y < city.size - 2; y++) {
    for (let x = 2; x < city.size - 2; x++) {
      const t = city.get(x, y)!;
      if (!t.water) return { x, y };
    }
  }
  throw new Error("no land");
}

function landPair(city: City): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const a = emptyLand(city);
  const b = { x: a.x + 1, y: a.y };
  const tb = city.get(b.x, b.y);
  if (!tb || tb.water) {
    return { a, b: { x: a.x, y: a.y + 1 } };
  }
  return { a, b };
}

describe("catalog", () => {
  it("has unique ids and required fields", () => {
    const ids = new Set(CATALOG.map((b) => b.id));
    expect(ids.size).toBe(CATALOG.length);
    for (const b of CATALOG) {
      expect(b.cost).toBeGreaterThan(0);
      expect(CATALOG_BY_ID[b.id]).toBe(b);
    }
  });

  it("marks a river and a lake as water", () => {
    let water = 0;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        if (isWaterTile(x, y, 40)) water += 1;
      }
    }
    expect(water).toBeGreaterThan(40);
    expect(water).toBeLessThan(400);
  });
});

describe("city placement", () => {
  it("rejects water, occupancy, and unaffordable builds", () => {
    const city = new City(40, "Test");
    let wx = 0;
    let wy = 0;
    for (const t of city.tiles) {
      if (t.water) {
        wx = t.x;
        wy = t.y;
        break;
      }
    }
    expect(city.canPlace("cottage", wx, wy).ok).toBe(false);
    const { a, b } = landPair(city);
    expect(city.place("cottage", a.x, a.y)).toBe(true);
    expect(city.canPlace("shop", a.x, a.y).ok).toBe(false);
    city.money = 10;
    expect(city.canPlace("shop", b.x, b.y).ok).toBe(false);
  });

  it("refunds 40% on demolish", () => {
    const city = new City(16, "Test");
    const { x, y } = emptyLand(city);
    const before = city.money;
    expect(city.place("cottage", x, y)).toBe(true);
    const afterPlace = city.money;
    const result = city.demolish(x, y);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(Math.floor(220 * 0.4));
    expect(city.money).toBe(afterPlace + result.refund);
    expect(city.money).toBeGreaterThan(afterPlace);
    expect(before - afterPlace).toBe(220);
  });

  it("allows only one city hall", () => {
    const city = new City(24, "Test");
    city.money = 100000;
    // unlock requires 30 pop — bypass by placing after setting unlock via fake residents
    const { a, b } = landPair(city);
    const t = city.get(a.x, a.y)!;
    t.buildingId = "cottage";
    t.residents = 40;
    expect(city.place("cityhall", b.x, b.y)).toBe(true);
    const c = { x: b.x + 1, y: b.y };
    const tc = city.get(c.x, c.y);
    if (tc && !tc.water && !tc.buildingId) {
      expect(city.canPlace("cityhall", c.x, c.y).ok).toBe(false);
    }
  });
});

describe("utilities and economy", () => {
  it("conducts power along roads to adjacent buildings", () => {
    const city = new City(20, "Test");
    city.money = 200000;
    // find three consecutive land tiles
    let x = 0;
    let y = 0;
    for (let yy = 3; yy < 17; yy++) {
      for (let xx = 3; xx < 16; xx++) {
        const t0 = city.get(xx, yy)!;
        const t1 = city.get(xx + 1, yy)!;
        const t2 = city.get(xx + 2, yy)!;
        if (!t0.water && !t1.water && !t2.water) {
          x = xx;
          y = yy;
          break;
        }
      }
      if (x) break;
    }
    expect(city.place("power", x, y)).toBe(true);
    expect(city.place("road", x + 1, y)).toBe(true);
    expect(city.place("cottage", x + 2, y)).toBe(true);
    city.floodUtilities();
    expect(city.get(x + 2, y)!.powered).toBe(true);
  });

  it("powers nearby buildings even without a perfect street chain", () => {
    const city = new City(20, "Test");
    city.money = 200000;
    let x = 5;
    let y = 5;
    for (let yy = 3; yy < 14; yy++) {
      for (let xx = 3; xx < 14; xx++) {
        if (!city.get(xx, yy)?.water && !city.get(xx + 2, yy)?.water) {
          x = xx;
          y = yy;
          break;
        }
      }
    }
    city.place("power", x, y);
    city.place("cottage", x + 2, y);
    city.floodUtilities();
    expect(city.get(x + 2, y)!.powered).toBe(true);
  });

  it("powers a home across a modest gap from the plant", () => {
    const city = new City(24, "Test");
    city.money = 200000;
    let x = 6;
    let y = 8;
    for (let yy = 5; yy < 16; yy++) {
      for (let xx = 5; xx < 12; xx++) {
        if (!city.get(xx, yy)?.water && !city.get(xx + 8, yy)?.water) {
          x = xx;
          y = yy;
          break;
        }
      }
    }
    city.place("power", x, y);
    city.place("cottage", x + 8, y);
    city.floodUtilities();
    expect(city.get(x + 8, y)!.powered).toBe(true);
  });

  it("treats diagonal tiles as road-adjacent", () => {
    const city = new City(16, "Test");
    city.money = 50000;
    let x = 4;
    let y = 4;
    for (let yy = 3; yy < 12; yy++) {
      for (let xx = 3; xx < 12; xx++) {
        if (!city.get(xx, yy)?.water && !city.get(xx + 1, yy + 1)?.water) {
          x = xx;
          y = yy;
          break;
        }
      }
    }
    city.place("road", x, y);
    expect(city.hasRoadAccess(x + 1, y + 1)).toBe(true);
  });

  it("grows residents when a home is serviced", () => {
    const city = new City(20, "Test");
    city.money = 200000;
    let x = 0;
    let y = 0;
    for (let yy = 3; yy < 17; yy++) {
      for (let xx = 3; xx < 16; xx++) {
        if (![0, 1, 2].some((i) => city.get(xx + i, yy)?.water)) {
          x = xx;
          y = yy;
          break;
        }
      }
      if (x) break;
    }
    city.place("power", x, y);
    city.place("water", x, y + 1);
    city.place("road", x + 1, y);
    city.place("road", x + 1, y + 1);
    city.place("cottage", x + 2, y);
    const home = city.get(x + 2, y)!;
    expect(home.residents).toBe(0);
    city.tick();
    expect(home.residents).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) city.tick();
    expect(home.residents).toBeGreaterThan(1);
    const stats = city.stats();
    expect(stats.population).toBeGreaterThan(0);
    expect(stats.powerSupply).toBeGreaterThan(0);
  });

  it("runs a starter town through taxes and save", () => {
    const city = new City(24, "Harbor");
    city.money = 200000;
    let x = 6;
    let y = 6;
    for (let yy = 4; yy < 18; yy++) {
      for (let xx = 4; xx < 16; xx++) {
        const tiles = [0, 1, 2, 3].map((i) => city.get(xx + i, yy));
        if (tiles.every((t) => t && !t.water)) {
          x = xx;
          y = yy;
          break;
        }
      }
    }
    expect(city.place("power", x, y)).toBe(true);
    expect(city.place("water", x, y + 1)).toBe(true);
    expect(city.place("road", x + 1, y)).toBe(true);
    expect(city.place("road", x + 2, y)).toBe(true);
    expect(city.place("road", x + 1, y + 1)).toBe(true);
    expect(city.place("cottage", x + 2, y + 1)).toBe(true);
    expect(city.place("shop", x + 3, y)).toBe(true);
    expect(city.place("park", x + 3, y + 1)).toBe(true);
    for (let i = 0; i < 40; i++) city.tick();
    const stats = city.stats();
    expect(stats.population).toBeGreaterThan(0);
    expect(stats.powerDemand).toBeGreaterThan(0);
    expect(stats.waterDemand).toBeGreaterThan(0);
    expect(stats.jobs).toBeGreaterThan(0);
    const loaded = City.deserialize(city.serialize());
    expect(loaded.population()).toBe(city.population());
    expect(loaded.stats().powerSupply).toBe(stats.powerSupply);
    const home = city.get(x + 2, y + 1)!;
    const refund = city.demolish(home.x, home.y);
    expect(refund.ok).toBe(true);
    expect(city.get(home.x, home.y)?.buildingId).toBeNull();
  });

  it("round-trips through serialize", () => {
    const city = new City(16, "Harbor");
    const { x, y } = emptyLand(city);
    city.place("road", x, y);
    const json = city.serialize();
    const loaded = City.deserialize(json);
    expect(loaded.name).toBe("Harbor");
    expect(loaded.get(x, y)?.road).toBe(true);
    expect(loaded.money).toBe(city.money);
  });

  it("spans water with a bridge joined to an avenue", () => {
    const city = new City(24, "Test");
    city.money = 50000;
    let land = { x: 0, y: 0 };
    let water = { x: 0, y: 0 };
    outer: for (let y = 2; y < 22; y++) {
      for (let x = 2; x < 22; x++) {
        const t = city.get(x, y)!;
        if (t.water) continue;
        const n = city.neighbors4(x, y).find((q) => q.water);
        if (n) {
          land = { x, y };
          water = { x: n.x, y: n.y };
          break outer;
        }
      }
    }
    expect(city.canPlace("road", water.x, water.y).ok).toBe(false);
    expect(city.place("road", land.x, land.y)).toBe(true);
    expect(city.place("road", water.x, water.y)).toBe(true);
    expect(city.get(water.x, water.y)?.road).toBe(true);
    expect(city.get(water.x, water.y)?.water).toBe(true);
    const loaded = City.deserialize(city.serialize());
    expect(loaded.get(water.x, water.y)?.road).toBe(true);
  });

  it("upgrades a cottage into a villa and docks must face water", () => {
    const city = new City(20, "Test");
    city.money = 200000;
    const { x, y } = emptyLand(city);
    expect(city.place("cottage", x, y)).toBe(true);
    const up = city.upgrade(x, y);
    expect(up.ok).toBe(true);
    expect(city.get(x, y)?.buildingId).toBe("villa");
    let inland = { x: 2, y: 2 };
    for (let yy = 2; yy < 18; yy++) {
      for (let xx = 2; xx < 18; xx++) {
        const t = city.get(xx, yy)!;
        if (!t.water && !t.buildingId && !city.neighbors4(xx, yy).some((n) => n.water)) {
          inland = { x: xx, y: yy };
        }
      }
    }
    expect(city.canPlace("dock", inland.x, inland.y).ok).toBe(false);
  });

  it("pays a charter reward for the first avenue", () => {
    const city = new City(16, "Test");
    const before = city.money;
    const { x, y } = emptyLand(city);
    city.place("road", x, y);
    expect(city.completedMissions.has("avenue")).toBe(true);
    expect(city.money).toBeGreaterThan(before - 25);
  });
});
