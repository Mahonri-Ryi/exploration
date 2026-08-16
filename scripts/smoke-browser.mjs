#!/usr/bin/env node
/**
 * Live Chrome playtest. Each feature is a named check against the running game
 * (title, HUD clicks, canvas placement, simulation). Failures name the feature.
 */
import puppeteer from "puppeteer-core";

const url = process.env.AETHERIS_URL ?? "http://localhost:5173/";
const chrome = process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--no-sandbox",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--use-gl=angle",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("response", (res) => {
  if (res.status() === 404) errors.push(`404 ${res.url()}`);
});

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: String(err?.message ?? err) });
    console.error(`FAIL ${name}: ${err?.message ?? err}`);
    throw err;
  }
}

async function api(fn, ...args) {
  return page.evaluate(fn, ...args);
}

async function clickSel(sel) {
  await page.waitForSelector(sel, { visible: true });
  await page.click(sel);
}

async function clickTool(id) {
  await clickSel(`.tool[data-tool="${id}"]`);
  const tool = await api(() => window.__AETHERIS__.tool());
  if (tool !== id) throw new Error(`tool is ${tool}, expected ${id}`);
}

async function clickTile(x, y) {
  const pt = await api((tx, ty) => window.__AETHERIS__.project(tx, ty), x, y);
  if (!pt) throw new Error(`tile ${x},${y} is not on screen`);
  await page.mouse.click(pt.x, pt.y);
}

function findPatch() {
  return page.evaluate(() => {
    const city = window.__AETHERIS__.city();
    for (let yy = 10; yy < 28; yy++) {
      for (let xx = 10; xx < 28; xx++) {
        const rows = [0, 1, 2, 3].map((dy) =>
          [0, 1, 2, 3].map((dx) => city.get(xx + dx, yy + dy)),
        );
        if (rows.every((row) => row.every((t) => t && !t.water && !t.buildingId && !t.road))) {
          return { x: xx, y: yy };
        }
      }
    }
    throw new Error("no empty 4x4 land patch");
  });
}

function findShore() {
  return page.evaluate(() => {
    const city = window.__AETHERIS__.city();
    for (let y = 2; y < 38; y++) {
      for (let x = 2; x < 38; x++) {
        const t = city.get(x, y);
        if (!t || t.water || t.buildingId || t.road) continue;
        const n = city.neighbors4(x, y).find((q) => q.water && !q.road && !q.buildingId);
        if (n) return { land: { x, y }, water: { x: n.x, y: n.y } };
      }
    }
    throw new Error("no shore");
  });
}

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__AETHERIS__), { timeout: 20000 });
await page.waitForSelector("#title-screen .title-card", { timeout: 20000 });

await check("title screen shows Found City", async () => {
  const visible = await page.$eval("#title-screen", (el) => !el.hidden && el.style.display !== "none");
  if (!visible) throw new Error("title screen hidden");
  const label = await page.$eval("#btn-new", (el) => el.textContent?.trim());
  if (label !== "Found City") throw new Error(`Found City label is ${label}`);
  const logo = await page.$eval(".title-card .logo", (el) => el.getAttribute("alt"));
  if (logo !== "Aetheris") throw new Error("logo alt missing");
});

await check("city name field can be typed", async () => {
  await page.click("#city-input", { clickCount: 3 });
  await page.type("#city-input", "Playtest Vale");
  const value = await page.$eval("#city-input", (el) => el.value);
  if (value !== "Playtest Vale") throw new Error(`name is ${value}`);
});

await check("Found City starts the game and primer", async () => {
  await clickSel("#btn-new");
  await page.waitForFunction(() => window.__AETHERIS__.running() === true, { timeout: 10000 });
  const titleGone = await page.$eval("#title-screen", (el) => el.hidden || el.style.display === "none");
  if (!titleGone) throw new Error("title still visible");
  const hudVisible = await page.$eval("#hud", (el) => !el.hidden);
  if (!hudVisible) throw new Error("HUD hidden");
  const hud = await api(() => window.__AETHERIS__.hud());
  if (hud.cityName !== "Playtest Vale") throw new Error(`city name is ${hud.cityName}`);
  if (!hud.primer.visible) throw new Error("primer coach hidden");
  if (hud.primer.title !== "The vale is yours") throw new Error(`primer title ${hud.primer.title}`);
  const tutorial = await api(() => window.__AETHERIS__.tutorial());
  if (tutorial.id !== "welcome") throw new Error(`expected welcome, got ${tutorial.id}`);
  await page.evaluate(() => document.getElementById("city-input")?.blur());
});

await check("primer Continue advances to Lay an avenue", async () => {
  await clickSel("#coach [data-next]");
  await page.waitForFunction(() => window.__AETHERIS__.tutorial().id === "avenue");
  const hud = await api(() => window.__AETHERIS__.hud());
  if (hud.primer.title !== "Lay an avenue") throw new Error(hud.primer.title);
  if (!hud.primer.continueDisabled) throw new Error("Continue should wait for a road");
});

const patch = await findPatch();

await check("Avenue tool click + canvas place lays a road", async () => {
  await clickTool("road");
  const hint = await api(() => window.__AETHERIS__.hud().hint);
  if (!/Avenue/i.test(hint)) throw new Error(`hint is ${hint}`);
  await clickTile(patch.x + 1, patch.y);
  const road = await api((x, y) => Boolean(window.__AETHERIS__.city().get(x, y)?.road), patch.x + 1, patch.y);
  if (!road) throw new Error("road not placed via canvas click");
  const tutorial = await api(() => window.__AETHERIS__.tutorial());
  if (tutorial.id !== "mill") throw new Error(`primer stayed on ${tutorial.id}`);
  const missions = await api(() => window.__AETHERIS__.hud().missions);
  if (missions.includes("Lay the first avenue")) throw new Error("charter still lists first avenue");
});

await check("keyboard 2 selects Avenue and paints a second tile", async () => {
  await page.keyboard.press("2");
  const tool = await api(() => window.__AETHERIS__.tool());
  if (tool !== "road") throw new Error(`tool is ${tool}`);
  await clickTile(patch.x + 2, patch.y);
  const road = await api((x, y) => Boolean(window.__AETHERIS__.city().get(x, y)?.road), patch.x + 2, patch.y);
  if (!road) throw new Error("second road missing");
});

await check("Windmill places and feeds the power meter", async () => {
  await clickTool("mill");
  const hint = await api(() => window.__AETHERIS__.hud().hint);
  if (!/Windmill/i.test(hint)) throw new Error(`hint is ${hint}`);
  await clickTile(patch.x, patch.y);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x, patch.y);
  if (id !== "mill") throw new Error(`tile is ${id}`);
  const stats = await api(() => window.__AETHERIS__.stats());
  if (stats.powerSupply < 48) throw new Error(`power supply ${stats.powerSupply}`);
  const hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.power.includes("/")) throw new Error(`power HUD ${hud.power}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("first_mill")) throw new Error("first_mill laurel missing");
});

await check("Water Tower places and feeds the water meter", async () => {
  await clickTool("water");
  await clickTile(patch.x, patch.y + 1);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x, patch.y + 1);
  if (id !== "water") throw new Error(`tile is ${id}`);
  await api((x, y) => window.__AETHERIS__.place("road", x, y), patch.x + 1, patch.y + 1);
  const stats = await api(() => window.__AETHERIS__.stats());
  if (stats.waterSupply < 140) throw new Error(`water supply ${stats.waterSupply}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("first_water")) throw new Error("first_water laurel missing");
});

await check("Cottage places, then families move in after ticks", async () => {
  await clickTool("cottage");
  await clickTile(patch.x + 2, patch.y + 1);
  const home = await api((x, y) => {
    const t = window.__AETHERIS__.city().get(x, y);
    return t ? { id: t.buildingId, powered: t.powered, watered: t.watered, residents: t.residents } : null;
  }, patch.x + 2, patch.y + 1);
  if (home?.id !== "cottage") throw new Error(`home is ${JSON.stringify(home)}`);
  if (!home.powered) throw new Error("cottage is dark");
  if (!home.watered) throw new Error("cottage is dry");
  await api(() => window.__AETHERIS__.tick(8));
  const after = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.residents, patch.x + 2, patch.y + 1);
  if (!after) throw new Error("no residents after ticks");
  const hud = await api(() => window.__AETHERIS__.hud());
  if (hud.souls === "0") throw new Error("Souls HUD stayed 0");
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("first_home")) throw new Error("first_home laurel missing");
});

await check("Survey tool opens the inspect panel", async () => {
  await clickTool("inspect");
  await clickTile(patch.x + 2, patch.y + 1);
  const hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.inspectOpen) throw new Error("inspect panel closed");
  if (hud.inspectTitle !== "Cottage") throw new Error(`inspect title ${hud.inspectTitle}`);
  const raise = await page.$eval("#inspect-panel .upgrade", (el) => el.textContent ?? "");
  if (!/Villa/i.test(raise)) throw new Error(`raise button ${raise}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("surveyor")) throw new Error("surveyor laurel missing");
});

await check("Raise button upgrades the cottage to a villa", async () => {
  await clickSel("#inspect-panel .upgrade");
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x + 2, patch.y + 1);
  if (id !== "villa") throw new Error(`building is ${id}`);
  const hud = await api(() => window.__AETHERIS__.hud());
  if (hud.inspectTitle !== "Villa") throw new Error(`inspect title ${hud.inspectTitle}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("mason")) throw new Error("mason laurel missing");
});

await check("Boutique places and adds jobs to Labor", async () => {
  await clickTool("shop");
  await clickTile(patch.x + 3, patch.y);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x + 3, patch.y);
  if (id !== "shop") throw new Error(`tile is ${id}`);
  await api(() => window.__AETHERIS__.tick(2));
  const stats = await api(() => window.__AETHERIS__.stats());
  if (stats.jobs < 10) throw new Error(`jobs ${stats.jobs}`);
  const hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.labor.includes("/")) throw new Error(`labor HUD ${hud.labor}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("first_shop")) throw new Error("first_shop laurel missing");
});

await check("Park places and the first-park laurel unlocks", async () => {
  await clickTool("park");
  await clickTile(patch.x + 3, patch.y + 1);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x + 3, patch.y + 1);
  if (id !== "park") throw new Error(`tile is ${id}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("first_park")) throw new Error("first_park laurel missing");
});

await check("Workshop places as industry", async () => {
  await clickTool("workshop");
  await clickTile(patch.x + 2, patch.y + 2);
  await api((x, y) => window.__AETHERIS__.place("road", x, y), patch.x + 1, patch.y + 2);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x + 2, patch.y + 2);
  if (id !== "workshop") throw new Error(`tile is ${id}`);
  const stats = await api(() => window.__AETHERIS__.stats());
  if (stats.pollution < 4) throw new Error(`pollution ${stats.pollution}`);
});

await check("Raze refunds 40% and clears the plot", async () => {
  const before = await api(() => window.__AETHERIS__.stats().money);
  await clickTool("bulldoze");
  const hint = await api(() => window.__AETHERIS__.hud().hint);
  if (!/Raze|40%/i.test(hint)) throw new Error(`hint is ${hint}`);
  await clickTile(patch.x + 2, patch.y + 2);
  const gone = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, patch.x + 2, patch.y + 2);
  if (gone) throw new Error(`workshop still ${gone}`);
  const after = await api(() => window.__AETHERIS__.stats().money);
  if (after <= before) throw new Error(`money ${before} -> ${after}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("salvage")) throw new Error("salvage laurel missing");
});

const shore = await findShore();

await check("Bridge: avenue from shore onto the river", async () => {
  const joined = await api((x, y) => window.__AETHERIS__.place("road", x, y), shore.land.x, shore.land.y);
  if (!joined && !(await api((x, y) => window.__AETHERIS__.city().get(x, y)?.road, shore.land.x, shore.land.y))) {
    throw new Error("could not join shore");
  }
  await clickTool("road");
  await clickTile(shore.water.x, shore.water.y);
  const tile = await api((x, y) => {
    const t = window.__AETHERIS__.city().get(x, y);
    return t ? { water: t.water, road: t.road, id: t.buildingId } : null;
  }, shore.water.x, shore.water.y);
  if (!tile?.water || !tile.road) throw new Error(`bridge tile ${JSON.stringify(tile)}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("span")) throw new Error("span laurel missing");
});

await check("River Dock must face water and then places on shore", async () => {
  const inland = await api((ox, oy) => {
    const city = window.__AETHERIS__.city();
    for (let y = 2; y < 38; y++) {
      for (let x = 2; x < 38; x++) {
        if (Math.abs(x - ox) + Math.abs(y - oy) < 3) continue;
        const t = city.get(x, y);
        if (!t || t.water || t.buildingId || t.road) continue;
        if (!city.neighbors4(x, y).some((n) => n.water)) return { x, y };
      }
    }
    return null;
  }, shore.land.x, shore.land.y);
  if (inland) {
    const blocked = await api((x, y) => window.__AETHERIS__.city().canPlace("dock", x, y), inland.x, inland.y);
    if (blocked.ok) throw new Error("inland dock was allowed");
  }
  const quay = await api(() => {
    const city = window.__AETHERIS__.city();
    for (let y = 2; y < 38; y++) {
      for (let x = 2; x < 38; x++) {
        const t = city.get(x, y);
        if (!t || t.water || t.buildingId || t.road) continue;
        if (city.neighbors4(x, y).some((n) => n.water)) return { x, y };
      }
    }
    return null;
  });
  if (!quay) throw new Error("no free quay");
  await clickTool("dock");
  await clickTile(quay.x, quay.y);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, quay.x, quay.y);
  if (id !== "dock") throw new Error(`dock tile is ${id}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("harbor")) throw new Error("harbor laurel missing");
});

await check("Hearth Inn unlocks after souls and places", async () => {
  const pop = await api(() => window.__AETHERIS__.stats().population);
  if (pop < 12) {
    await api((x, y) => {
      const city = window.__AETHERIS__.city();
      const t = city.get(x, y);
      if (t) t.residents = Math.max(t.residents, 14);
      city.refreshProgress();
    }, patch.x + 2, patch.y + 1);
    await api(() => window.__AETHERIS__.tick(1));
  }
  const locked = await api(() => window.__AETHERIS__.hud().lockedTools);
  if (locked.includes("inn")) throw new Error("inn still locked after souls");
  const slot = await api((ox, oy) => {
    const city = window.__AETHERIS__.city();
    for (const [x, y] of [
      [ox + 3, oy + 2],
      [ox, oy + 2],
      [ox + 2, oy + 3],
    ]) {
      const t = city.get(x, y);
      if (t && !t.water && !t.buildingId && !t.road) return { x, y };
    }
    return null;
  }, patch.x, patch.y);
  if (!slot) throw new Error("no inn slot");
  await clickTool("inn");
  await clickTile(slot.x, slot.y);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, slot.x, slot.y);
  if (id !== "inn") throw new Error(`inn tile is ${id}`);
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("inn")) throw new Error("inn laurel missing");
});

await check("Fire Hall quenches a nearby blaze", async () => {
  await api((x, y) => {
    const city = window.__AETHERIS__.city();
    const t = city.get(x, y);
    if (t) t.residents = Math.max(t.residents, 80);
    city.refreshProgress();
  }, patch.x + 2, patch.y + 1);
  await api(() => window.__AETHERIS__.tick(1));
  const hallSlot = await api((ox, oy) => {
    const city = window.__AETHERIS__.city();
    for (let y = oy; y < oy + 4; y++) {
      for (let x = ox; x < ox + 4; x++) {
        const t = city.get(x, y);
        if (t && !t.water && !t.buildingId && !t.road) return { x, y };
      }
    }
    return null;
  }, patch.x, patch.y);
  if (!hallSlot) throw new Error("no fire hall slot");
  const placed = await api((x, y) => window.__AETHERIS__.place("fire", x, y), hallSlot.x, hallSlot.y);
  if (!placed) throw new Error("fire hall placement failed");
  const victim = await api((ox, oy, hx, hy) => {
    const city = window.__AETHERIS__.city();
    for (const t of city.tiles) {
      if (t.buildingId !== "shop" && t.buildingId !== "cottage" && t.buildingId !== "villa") continue;
      if (t.x === hx && t.y === hy) continue;
      return { x: t.x, y: t.y, id: t.buildingId };
    }
    const t = city.get(ox + 3, oy);
    return t ? { x: t.x, y: t.y, id: t.buildingId } : null;
  }, patch.x, patch.y, hallSlot.x, hallSlot.y);
  if (!victim?.id) throw new Error("no burnable building");
  const lit = await api((x, y) => window.__AETHERIS__.ignite(x, y), victim.x, victim.y);
  if (!lit) throw new Error("ignite failed");
  const hudFire = await api(() => window.__AETHERIS__.hud());
  if (hudFire.blaze === null && (await api(() => window.__AETHERIS__.stats().fires)) < 1) {
    throw new Error("blaze meter did not appear");
  }
  await api(() => window.__AETHERIS__.tick(1));
  const after = await api((x, y) => {
    const t = window.__AETHERIS__.city().get(x, y);
    return t ? { onFire: t.onFire, id: t.buildingId } : null;
  }, victim.x, victim.y);
  if (after?.onFire) throw new Error("fire still burning under a hall");
  if (after?.id !== victim.id) throw new Error("plot was consumed");
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("brigade")) throw new Error("brigade laurel missing");
});

await check("unguarded fire consumes the plot", async () => {
  const far = await api(() => {
    const city = window.__AETHERIS__.city();
    for (let y = 30; y < 38; y++) {
      for (let x = 2; x < 12; x++) {
        const row = [0, 1].map((i) => city.get(x + i, y));
        if (row.every((t) => t && !t.water && !t.buildingId && !t.road)) return { x, y };
      }
    }
    return null;
  });
  if (!far) throw new Error("no distant plot");
  const ok = await api((x, y) => window.__AETHERIS__.place("cottage", x, y), far.x, far.y);
  if (!ok) throw new Error("distant cottage failed");
  const lit = await api((x, y) => window.__AETHERIS__.ignite(x, y), far.x, far.y);
  if (!lit) throw new Error("distant ignite failed");
  await api(() => window.__AETHERIS__.tick(12));
  const gone = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, far.x, far.y);
  if (gone) throw new Error(`ungarded cottage survived as ${gone}`);
});

await check("Power Plant adds a large supply", async () => {
  const slot = await api(() => {
    const city = window.__AETHERIS__.city();
    for (let y = 8; y < 30; y++) {
      for (let x = 8; x < 30; x++) {
        const t = city.get(x, y);
        if (t && !t.water && !t.buildingId && !t.road) return { x, y };
      }
    }
    return null;
  });
  const before = await api(() => window.__AETHERIS__.stats().powerSupply);
  await clickTool("power");
  await clickTile(slot.x, slot.y);
  const after = await api(() => window.__AETHERIS__.stats().powerSupply);
  if (after < before + 160) throw new Error(`power ${before} -> ${after}`);
});

await check("unique City Hall, Beacon, and Observatory", async () => {
  await api((x, y) => {
    const city = window.__AETHERIS__.city();
    const t = city.get(x, y);
    if (t) t.residents = Math.max(t.residents, 90);
    city.refreshProgress();
  }, patch.x + 2, patch.y + 1);
  await api(() => window.__AETHERIS__.tick(1));
  const hall = await api(() => {
    const city = window.__AETHERIS__.city();
    for (let y = 6; y < 34; y++) {
      for (let x = 6; x < 34; x++) {
        const t = city.get(x, y);
        if (t && !t.water && !t.buildingId && !t.road) return { x, y };
      }
    }
    return null;
  });
  const hallOk = await api((x, y) => window.__AETHERIS__.place("cityhall", x, y), hall.x, hall.y);
  if (!hallOk) throw new Error("city hall failed");
  const second = await api((hx, hy) => {
    const city = window.__AETHERIS__.city();
    for (let y = 6; y < 34; y++) {
      for (let x = 6; x < 34; x++) {
        if (x === hx && y === hy) continue;
        const t = city.get(x, y);
        if (t && !t.water && !t.buildingId && !t.road) return city.canPlace("cityhall", x, y);
      }
    }
    return { ok: true, reason: "no tile" };
  }, hall.x, hall.y);
  if (second.ok) throw new Error("second city hall allowed");
  const shore2 = await api((usedX, usedY) => {
    const city = window.__AETHERIS__.city();
    for (let y = 2; y < 38; y++) {
      for (let x = 2; x < 38; x++) {
        const t = city.get(x, y);
        if (!t || t.water || t.buildingId || t.road) continue;
        if (x === usedX && y === usedY) continue;
        if (city.neighbors4(x, y).some((n) => n.water)) return { x, y };
      }
    }
    return null;
  }, shore.land.x, shore.land.y);
  const beaconOk = await api((x, y) => window.__AETHERIS__.place("beacon", x, y), shore2.x, shore2.y);
  if (!beaconOk) throw new Error("beacon failed");
  const obs = await api((hx, hy) => {
    const city = window.__AETHERIS__.city();
    for (let y = 6; y < 34; y++) {
      for (let x = 6; x < 34; x++) {
        if (x === hx && y === hy) continue;
        const t = city.get(x, y);
        if (t && !t.water && !t.buildingId && !t.road) return { x, y };
      }
    }
    return null;
  }, hall.x, hall.y);
  const obsOk = await api((x, y) => window.__AETHERIS__.place("observatory", x, y), obs.x, obs.y);
  if (!obsOk) throw new Error("observatory failed");
  const laurels = await api(() => window.__AETHERIS__.achievements());
  for (const need of ["hall", "beacon", "stars", "wonders"]) {
    if (!laurels.includes(need)) throw new Error(`${need} laurel missing`);
  }
  const prestige = await api(() => window.__AETHERIS__.stats().prestige);
  if (prestige < 15) throw new Error(`prestige ${prestige}`);
});

await check("water tiles reject cottages", async () => {
  const water = await api(() => {
    const city = window.__AETHERIS__.city();
    const t = city.tiles.find((q) => q.water && !q.road && !q.buildingId);
    return t ? city.canPlace("cottage", t.x, t.y) : { ok: true, reason: "no water" };
  });
  if (water.ok) throw new Error("water is buildable");
});

await check("field notes open from H", async () => {
  await page.keyboard.press("h");
  let hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.helpOpen) throw new Error("H did not open field notes");
  const heading = await page.$eval("#help-sheet h3", (el) => el.textContent);
  if (heading !== "Field notes") throw new Error(`heading ${heading}`);
  await page.keyboard.press("h");
  hud = await api(() => window.__AETHERIS__.hud());
  if (hud.helpOpen) throw new Error("H did not close field notes");
  await page.keyboard.press("h");
  hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.helpOpen) throw new Error("H did not reopen field notes");
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("notes")) throw new Error("notes laurel missing");
  await page.keyboard.press("h");
});

await check("Laurels panel lists earned trophies", async () => {
  await clickSel("#btn-laurels");
  const hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.laurelsOpen) throw new Error("laurels closed");
  if (!/\d+ \/ \d+/.test(hud.laurelsEarned)) throw new Error(`count ${hud.laurelsEarned}`);
  const titles = await page.$$eval("#laurels-panel li.on strong", (els) => els.map((el) => el.textContent));
  if (!titles.includes("Catch the wind")) throw new Error(`earned ${titles.join(",")}`);
  await page.keyboard.press("a");
  const closed = await api(() => window.__AETHERIS__.hud().laurelsOpen);
  if (closed) throw new Error("A did not close laurels");
});

await check("phone dock: Charter, Notes, and Look", async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.waitForFunction(() => {
    const btn = document.getElementById("btn-charter");
    return Boolean(btn && btn.getClientRects().length);
  });
  await clickSel("#btn-charter");
  const open = await api(() => window.__AETHERIS__.hud().charterOpen);
  if (!open) throw new Error("charter did not open on phone width");
  await clickSel("#btn-charter");
  const closed = await api(() => window.__AETHERIS__.hud().charterOpen);
  if (closed) throw new Error("charter did not close");
  await clickSel("#btn-notes");
  const notes = await api(() => window.__AETHERIS__.hud().helpOpen);
  if (!notes) throw new Error("Notes did not open on phone");
  await clickSel("#btn-notes");
  await clickSel("#btn-look");
  const look = await api(() => window.__AETHERIS__.lookMode());
  if (!look) throw new Error("Look did not engage on phone");
  await clickSel("#btn-look");
  await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
});

await check("Look mode (L) blocks placement", async () => {
  await page.keyboard.press("l");
  const look = await api(() => window.__AETHERIS__.lookMode());
  if (!look) throw new Error("look mode off");
  const hint = await api(() => window.__AETHERIS__.hud().hint);
  if (!/Look/i.test(hint)) throw new Error(`hint ${hint}`);
  const empty = await api(() => {
    const city = window.__AETHERIS__.city();
    for (let y = 8; y < 32; y++) {
      for (let x = 8; x < 32; x++) {
        const t = city.get(x, y);
        if (t && !t.water && !t.buildingId && !t.road) return { x, y };
      }
    }
    return null;
  });
  await clickTool("cottage");
  await clickTile(empty.x, empty.y);
  const id = await api((x, y) => window.__AETHERIS__.city().get(x, y)?.buildingId, empty.x, empty.y);
  if (id) throw new Error(`look mode still placed ${id}`);
  await page.keyboard.press("l");
  const off = await api(() => window.__AETHERIS__.lookMode());
  if (off) throw new Error("look mode stuck on");
});

await check("pause via Space and clock buttons", async () => {
  await page.keyboard.press(" ");
  const paused = await api(() => window.__AETHERIS__.speed());
  if (paused !== 0) throw new Error(`speed after Space is ${paused}`);
  const on = await page.$eval('[data-speed="0"]', (el) => el.classList.contains("on"));
  if (!on) throw new Error("pause button not lit");
  await clickSel('[data-speed="2"]');
  const fast = await api(() => window.__AETHERIS__.speed());
  if (fast !== 2) throw new Error(`speed after 2x is ${fast}`);
  await clickSel('[data-speed="1"]');
});

await check("levy slider changes the tax rate", async () => {
  await page.$eval("#tax", (el) => {
    el.value = "14";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const hud = await api(() => window.__AETHERIS__.hud());
  if (hud.tax !== "14%") throw new Error(`tax HUD ${hud.tax}`);
  const rate = await api(() => window.__AETHERIS__.city().taxRate);
  if (Math.abs(rate - 0.14) > 0.001) throw new Error(`taxRate ${rate}`);
});

await check("mute and save buttons respond", async () => {
  await clickSel("#btn-mute");
  const muted = await page.$eval("#btn-mute", (el) => el.textContent);
  if (muted !== "🔇") throw new Error(`mute label ${muted}`);
  await clickSel("#btn-save");
  const saved = await api(() => Boolean(localStorage.getItem("aetheris.save.v1")));
  if (!saved) throw new Error("save key missing");
});

await check("Menu then Continue restores the city", async () => {
  const pop = await api(() => window.__AETHERIS__.stats().population);
  await clickSel("#btn-menu");
  await page.waitForFunction(() => {
    const title = document.getElementById("title-screen");
    return Boolean(title && !title.hidden && title.style.display !== "none");
  });
  const cont = await page.$eval("#btn-continue", (el) => !el.hidden);
  if (!cont) throw new Error("Continue hidden after save");
  await clickSel("#btn-continue");
  await page.waitForFunction(() => window.__AETHERIS__.running() === true);
  const again = await api(() => window.__AETHERIS__.stats().population);
  if (again !== pop) throw new Error(`population ${pop} -> ${again}`);
  const name = await api(() => window.__AETHERIS__.hud().cityName);
  if (name !== "Playtest Vale") throw new Error(`restored name ${name}`);
});

await check("primer Skip closes the coach", async () => {
  const done = await api(() => window.__AETHERIS__.tutorial().done);
  if (!done) {
    const coach = await api(() => window.__AETHERIS__.hud().primer.visible);
    if (coach) await clickSel("#coach [data-skip]");
    else await api(() => window.__AETHERIS__.skipTutorial());
  }
  const after = await api(() => window.__AETHERIS__.tutorial());
  if (!after.done) throw new Error("primer still open");
  const hud = await api(() => window.__AETHERIS__.hud());
  if (hud.primer.visible) throw new Error("coach still visible");
  const laurels = await api(() => window.__AETHERIS__.achievements());
  if (!laurels.includes("primer")) throw new Error("primer laurel missing");
});

await check("Replay primer from field notes", async () => {
  await page.keyboard.press("h");
  await clickSel("#btn-replay-primer");
  const tutorial = await api(() => window.__AETHERIS__.tutorial());
  if (tutorial.id !== "welcome" || tutorial.done) throw new Error(JSON.stringify(tutorial));
  const hud = await api(() => window.__AETHERIS__.hud());
  if (!hud.primer.visible) throw new Error("replayed primer hidden");
  await clickSel("#coach [data-skip]");
});

await check("locked late-game tools stay disabled at low souls", async () => {
  await api(() => window.__AETHERIS__.startNew("Locktown"));
  const locked = await api(() => window.__AETHERIS__.hud().lockedTools);
  for (const need of ["villa", "tower", "hospital", "observatory"]) {
    if (!locked.includes(need)) throw new Error(`${need} should be locked in a new hamlet`);
  }
  const disabled = await page.$eval('.tool[data-tool="tower"]', (el) => el.disabled);
  if (!disabled) throw new Error("tower button not disabled");
});

await check("HUD date line shows an era", async () => {
  const date = await api(() => window.__AETHERIS__.hud().date);
  if (!/Hamlet|Village|Town|City|Metropolis/.test(date)) throw new Error(`date ${date}`);
});

await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: "/tmp/aetheris-smoke.png", fullPage: true });

const fatal = errors.filter((e) => !/GPU stall|swiftshader|deprecated|favicon|404 .*favicon/i.test(e));
if (fatal.length) throw new Error(`Page errors: ${fatal.join(" | ")}`);

console.log(JSON.stringify({ ok: true, passed: results.length, features: results.map((r) => r.name) }, null, 2));
await browser.close();
