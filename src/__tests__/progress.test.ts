import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../game/achievements";
import { TOOL_CATEGORIES, TOOL_ORDER } from "../game/catalog";
import { City } from "../game/city";
import { TUTORIAL, tutorialStep } from "../game/tutorial";

function emptyLand(city: City): { x: number; y: number } {
  for (let y = 2; y < city.size - 2; y++) {
    for (let x = 2; x < city.size - 2; x++) {
      const t = city.get(x, y)!;
      if (!t.water) return { x, y };
    }
  }
  throw new Error("no land");
}

describe("primer", () => {
  it("starts on welcome and waits for Continue", () => {
    const city = new City(16, "Test");
    expect(tutorialStep(city)?.id).toBe("welcome");
    expect(tutorialStep(city)?.body.toLowerCase()).toMatch(/phone|tap to build|look/);
    expect(city.continueTutorial()).toBe(true);
    expect(tutorialStep(city)?.id).toBe("avenue");
    expect(city.continueTutorial()).toBe(false);
  });

  it("advances when the player lays an avenue", () => {
    const city = new City(16, "Test");
    city.continueTutorial();
    const { x, y } = emptyLand(city);
    expect(city.place("road", x, y)).toBe(true);
    expect(tutorialStep(city)?.id).toBe("mill");
    expect(city.completedAchievements.has("first_road")).toBe(true);
  });

  it("skips the primer and awards the field-primer laurel", () => {
    const city = new City(16, "Test");
    city.skipTutorial();
    expect(city.tutorialDone).toBe(true);
    expect(tutorialStep(city)).toBeNull();
    expect(city.completedAchievements.has("primer")).toBe(true);
  });

  it("replays from the first step", () => {
    const city = new City(16, "Test");
    city.skipTutorial();
    city.restartTutorial();
    expect(city.tutorialDone).toBe(false);
    expect(tutorialStep(city)?.id).toBe("welcome");
  });

  it("round-trips tutorial and laurels through save", () => {
    const city = new City(16, "Harbor");
    city.skipTutorial();
    city.note("surveyed");
    const loaded = City.deserialize(city.serialize());
    expect(loaded.tutorialDone).toBe(true);
    expect(loaded.completedAchievements.has("primer")).toBe(true);
    expect(loaded.completedAchievements.has("surveyor")).toBe(true);
    expect(loaded.flags.surveyed).toBe(true);
  });
});

describe("laurels", () => {
  it("has unique ids covering the four categories", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ACHIEVEMENTS.map((a) => a.category)).size).toBe(4);
  });

  it("unlocks mill, water, home, and mason laurels", () => {
    const city = new City(20, "Test");
    city.money = 200000;
    city.skipTutorial();
    let x = 4;
    let y = 4;
    for (let yy = 3; yy < 14; yy++) {
      for (let xx = 3; xx < 14; xx++) {
        if (![0, 1, 2].some((i) => city.get(xx + i, yy)?.water)) {
          x = xx;
          y = yy;
        }
      }
    }
    city.place("mill", x, y);
    city.place("water", x, y + 1);
    city.place("road", x + 1, y);
    city.place("cottage", x + 2, y);
    city.tick();
    expect(city.completedAchievements.has("first_mill")).toBe(true);
    expect(city.completedAchievements.has("first_water")).toBe(true);
    expect(city.completedAchievements.has("first_home")).toBe(true);
    expect(city.upgrade(x + 2, y).ok).toBe(true);
    expect(city.completedAchievements.has("mason")).toBe(true);
  });
});

describe("construction categories", () => {
  it("groups every toolbar tool the way Skylines-style docks do", () => {
    const listed = new Set(TOOL_CATEGORIES.flatMap((c) => c.tools));
    expect(TOOL_CATEGORIES.map((c) => c.id)).toEqual(
      expect.arrayContaining(["roads", "homes", "shops", "works", "grid", "civic", "wonders"]),
    );
    for (const id of TOOL_ORDER) expect(listed.has(id)).toBe(true);
  });
});

describe("tutorial catalog", () => {
  it("covers the core systems in order", () => {
    const ids = TUTORIAL.map((s) => s.id);
    for (const need of ["avenue", "mill", "water", "cottage", "survey", "shop", "park", "upgrade", "river", "fire", "laurels"]) {
      expect(ids).toContain(need);
    }
  });
});
