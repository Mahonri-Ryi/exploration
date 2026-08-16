#!/usr/bin/env node
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
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("response", (res) => {
  if (res.status() === 404) errors.push(`404 ${res.url()}`);
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__AETHERIS__), { timeout: 20000 });
await page.waitForSelector("#title-screen .title-card", { timeout: 20000 });

const titleVisible = await page.$eval("#title-screen", (el) => el.offsetParent !== null || el.style.display !== "none");
if (!titleVisible) throw new Error("Title screen not visible on load");

await page.click("#btn-new");
await page.waitForFunction(() => window.__AETHERIS__.running() === true, { timeout: 10000 });

const titleGone = await page.$eval("#title-screen", (el) => el.hidden || el.style.display === "none");
if (!titleGone) throw new Error("Title screen still visible after Found City");

const hudVisible = await page.$eval("#hud", (el) => !el.hidden);
if (!hudVisible) throw new Error("HUD hidden after Found City");

const primer = await page.evaluate(() => {
  const coach = document.getElementById("coach");
  return {
    tutorial: window.__AETHERIS__.tutorial(),
    coachVisible: Boolean(coach && !coach.hidden),
    title: coach?.querySelector("h3")?.textContent ?? "",
  };
});
if (!primer.coachVisible) throw new Error("Primer coach hidden on a new city");
if (primer.tutorial.id !== "welcome") throw new Error(`Expected welcome primer, got ${JSON.stringify(primer.tutorial)}`);

const built = await page.evaluate(() => {
  const api = window.__AETHERIS__;
  const city = api.city();
  let x = 18;
  let y = 16;
  outer: for (let yy = 12; yy < 26; yy++) {
    for (let xx = 12; xx < 26; xx++) {
      const row = [0, 1, 2, 3].map((i) => city.get(xx + i, yy));
      const next = [0, 1, 2, 3].map((i) => city.get(xx + i, yy + 1));
      const third = [0, 1, 2, 3].map((i) => city.get(xx + i, yy + 2));
      if (
        row.every((t) => t && !t.water && !t.buildingId) &&
        next.every((t) => t && !t.water && !t.buildingId) &&
        third.every((t) => t && !t.water && !t.buildingId)
      ) {
        x = xx;
        y = yy;
        break outer;
      }
    }
  }
  const steps = [
    ["road", x + 1, y],
    ["road", x + 2, y],
    ["road", x + 1, y + 1],
    ["power", x, y],
    ["water", x, y + 1],
    ["cottage", x + 2, y + 1],
    ["shop", x + 3, y],
    ["park", x + 3, y + 1],
    ["mill", x, y + 2],
    ["road", x + 1, y + 2],
  ];
  const results = steps.map(([id, px, py]) => ({ id, ok: api.place(id, px, py), x: px, y: py }));
  api.tick(8);
  const home = city.get(x + 2, y + 1);
  return {
    origin: { x, y },
    results,
    stats: api.stats(),
    home: home
      ? { powered: home.powered, watered: home.watered, residents: home.residents, road: city.hasRoadAccess(home.x, home.y) }
      : null,
  };
});

const failed = built.results.filter((r) => !r.ok);
if (failed.length) throw new Error(`Placement failed: ${JSON.stringify(failed)}`);
if (!built.home?.powered) throw new Error("Cottage is not powered");
if (!built.home?.watered) throw new Error("Cottage is not watered");
if (!built.home?.residents) throw new Error("Cottage has no residents after ticks");
if (built.stats.population <= 0) throw new Error("Population stayed at 0");
if (built.stats.powerSupply <= 160) throw new Error("Windmill did not add power");
if (built.stats.powerSupply <= 0 || built.stats.waterSupply <= 0) {
  throw new Error("Utilities did not register supply");
}

await page.waitForFunction(() => window.__AETHERIS__.stats().population > 0);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "/tmp/aetheris-smoke.png", fullPage: true });

const waterBlocked = await page.evaluate(() => {
  const city = window.__AETHERIS__.city();
  const water = city.tiles.find((t) => t.water);
  return water ? city.canPlace("cottage", water.x, water.y) : { ok: true, reason: "no water" };
});
if (waterBlocked.ok) throw new Error("Water tiles are buildable");

const blaze = await page.evaluate((x, y) => {
  const api = window.__AETHERIS__;
  const ok = api.ignite(x, y);
  api.tick(1);
  const tile = api.city().get(x, y);
  return { ok, fires: api.stats().fires, onFire: Boolean(tile?.onFire), buildingId: tile?.buildingId };
}, built.origin.x + 3, built.origin.y);
if (!blaze.ok || !blaze.onFire) throw new Error(`Ignite failed: ${JSON.stringify(blaze)}`);

const moneyBefore = built.stats.money;
const demolished = await page.evaluate((x, y) => window.__AETHERIS__.demolish(x, y), built.origin.x + 2, built.origin.y + 1);
if (!demolished) throw new Error("Demolish failed");
const after = await page.evaluate(() => window.__AETHERIS__.stats());
if (after.money <= moneyBefore) throw new Error("Demolish did not refund");

const progress = await page.evaluate(() => {
  const api = window.__AETHERIS__;
  api.skipTutorial();
  return {
    tutorial: api.tutorial(),
    laurels: api.achievements(),
    coachHidden: document.getElementById("coach")?.hidden === true,
  };
});
if (!progress.tutorial.done || !progress.coachHidden) {
  throw new Error(`Primer did not close: ${JSON.stringify(progress.tutorial)}`);
}
if (!progress.laurels.includes("primer")) throw new Error("Field-primer laurel missing");
if (!progress.laurels.includes("first_mill")) throw new Error("Windmill laurel missing");
if (!progress.laurels.includes("salvage")) throw new Error("Salvage laurel missing");

const fatal = errors.filter(
  (e) => !/GPU stall|swiftshader|deprecated|favicon|404 .*favicon/i.test(e),
);
if (fatal.length) throw new Error(`Page errors: ${fatal.join(" | ")}`);

console.log(JSON.stringify({ ok: true, stats: built.stats, afterDemolish: after, home: built.home, origin: built.origin, blaze, progress }, null, 2));
await browser.close();
