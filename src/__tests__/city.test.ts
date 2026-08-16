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
    for (let i = 0; i < 20; i++) city.tick();
    expect(home.residents).toBeGreaterThan(0);
    const stats = city.stats();
    expect(stats.population).toBeGreaterThan(0);
    expect(stats.powerSupply).toBeGreaterThan(0);
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
});
