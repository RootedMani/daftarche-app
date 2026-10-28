// Requires: npm i puppeteer-core, and Chrome at /usr/bin/google-chrome. Run: node tests/e2e.mjs http://127.0.0.1:8765/
// Smoke test: open the demo, visit every route at phone and desktop sizes, collect errors, take screenshots.
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://127.0.0.1:8765/";
const OUT = new URL("./shots/", import.meta.url).pathname;
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const errors = [];
const sizes = { m: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, d: { width: 1366, height: 900 } };

for (const [tag, vp] of Object.entries(sizes)) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(vp);
  page.on("pageerror", (e) => errors.push(`[${tag}] pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${tag}] console ${m.text()}`); });
  page.on("requestfailed", (r) => errors.push(`[${tag}] requestfailed ${r.url()}`));
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}${tag}-landing.png`, fullPage: true });
  await page.click('[data-act="start-demo"]');
  await new Promise((r) => setTimeout(r, 400));
  const routes = ["home", "board", "board/paid", "receive", "quick", "new", "customers", "reminders", "products", "share", "settings", "setup"];
  for (const r of routes) {
    await page.goto(`${BASE}#/${r}`, { waitUntil: "networkidle0" });
    await new Promise((res) => setTimeout(res, 300));
    await page.screenshot({ path: `${OUT}${tag}-${r.replace("/", "_")}.png`, fullPage: true });
  }
  // an order detail and a customer profile from the demo
  const ids = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("daftarche:v1"));
    const o = s.orders.find((x) => x.status === "paid");
    return { order: o.id, cust: o.customer.phone, back: s.orders[s.orders.length - 1].id };
  });
  for (const [name, h] of [["order", `order/${ids.order}`], ["order-back", `order/${ids.back}`], ["customer", `c/09120000101`]]) {
    await page.goto(`${BASE}#/${h}`, { waitUntil: "networkidle0" });
    await new Promise((res) => setTimeout(res, 400));
    await page.screenshot({ path: `${OUT}${tag}-${name}.png`, fullPage: true });
  }
  // the public order form as the customer sees it
  const link = await page.evaluate(() => document.querySelector("#order-link input")?.value);
  await page.goto(`${BASE}#/share`, { waitUntil: "networkidle0" });
  await new Promise((res) => setTimeout(res, 300));
  const orderLink = await page.$eval("#order-link input", (i) => i.value);
  await page.goto(orderLink, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}${tag}-form.png`, fullPage: true });
  // horizontal overflow check on phone
  if (tag === "m") {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) errors.push(`[m] form overflows horizontally by ${over}px`);
  }
  console.log(tag, "order link length", orderLink.length);
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no errors");
