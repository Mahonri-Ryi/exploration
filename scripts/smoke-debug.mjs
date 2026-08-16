import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
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
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
page.on("requestfailed", (r) => logs.push(`fail: ${r.url()} ${r.failure()?.errorText}`));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle0", timeout: 30000 }).catch((e) => logs.push(String(e)));
await new Promise((r) => setTimeout(r, 3000));
const info = await page.evaluate(() => ({
  title: document.title,
  hasApi: Boolean(window.__AETHERIS__),
  boot: Boolean(document.getElementById("boot")),
  titleScreen: document.getElementById("title-screen")?.hidden,
  body: document.body?.innerText?.slice(0, 400),
}));
console.log(JSON.stringify({ info, logs }, null, 2));
await page.screenshot({ path: "/tmp/aetheris-debug.png" });
await browser.close();
