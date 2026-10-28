// Requires: npm i puppeteer-core. Run: node tests/judge.mjs http://127.0.0.1:8765/
// The path a judge takes in ONE browser: landing -> "از دید مشتری" -> order -> (reload) -> into the seller's notebook.
// Also reports the length of every message type, since Instagram DMs cap message length.
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";

const BASE = process.argv[2] || "http://127.0.0.1:8765/";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE, { waitUntil: "networkidle0" });
await page.click('[data-act="customer-demo"]');
await page.waitForFunction(() => location.hash.startsWith("#o="));
await page.waitForSelector('form[data-form="place-order"]');
for (const pid of ["p1", "p1", "p3", "p5", "p7"]) await page.click(`[data-act="qty"][data-pid="${pid}"][data-d="1"]`);
await page.type('[name="name"]', "داور آزمایشی با نام نسبتاً بلند");
await page.type('[name="phone"]', "09121112233");
await page.type('[name="ig"]', "judge.account_name");
await page.type('[name="city"]', "تهران");
await page.type('[name="address"]', "خیابان ولیعصر، بالاتر از پارک ساعی، کوچه‌ی بهار، ساختمان نیلوفر، پلاک ۱۲۳، طبقه‌ی چهارم، واحد ۱۴");
await page.type('[name="postal"]', "1234567890");
await page.type('[name="sp_occasion"]', "تولد خواهرم");
await page.type('[name="sp_card"]', "تولدت مبارک خواهر عزیزم، همیشه بخند");
await page.type('[name="note"]', "لطفاً بسته‌بندی کادویی باشد و قبل از ارسال تماس بگیرید. زنگ خراب است.");
await page.type('[name="payref"]', "ساعت ۲۱:۳۰، ۴ رقم آخر ۹۹۸۸");
await page.click('form[data-form="place-order"] button[type="submit"]');
await page.waitForFunction(() => location.hash === "#sent");
const sentText = await page.$eval("#sent-msg .send-text", (e) => e.value);
// the customer switches to Instagram and the tab reloads when they come back
await page.reload({ waitUntil: "networkidle0" });
assert.equal(await page.$eval("#sent-msg .send-text", (e) => e.value), sentText, "order survives a reload");
const dmA = await page.$('a[data-act="copy-to-dm"]');
assert.ok(dmA, "copy-to-dm is a real link");
assert.match(await dmA.evaluate((a) => a.href), /^https:\/\/ig\.me\/m\/daftarche\.demo$/);
console.log("✓ sent page survives reload; DM button is a real link");

await page.click(".demo-note a");
await page.waitForSelector('[data-act="add-incoming"]');
await page.click('[data-act="add-incoming"]');
await page.waitForFunction(() => location.hash.startsWith("#/order/"));
await wait(300);
assert.match(await page.$eval("#view", (e) => e.innerText), /داور آزمایشی/);
await page.goto(BASE + "#/board", { waitUntil: "networkidle0" });
assert.match(await page.$eval("#kanban", (e) => e.innerText), /داور آزمایشی/);
console.log("✓ judge path: landing → customer view → order → seller notebook → board");

// demo bar "order as customer" stays in the same tab
await page.click('[data-act="demo-customer"]');
await page.waitForFunction(() => location.hash.startsWith("#o="));
console.log("✓ demo bar opens the customer form in the same tab");

// message lengths
const lens = { "incoming (fat order)": sentText.length };
await page.goto(BASE + "#/reminders", { waitUntil: "networkidle0" });
await page.waitForFunction(() => [...document.querySelectorAll(".send-text")].every((t) => t.value.includes("http")));
lens.reminder = Math.max(...(await page.$$eval(".send-text", (l) => l.map((t) => t.value.length))));
await page.goto(BASE + "#/c/09120000101", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("#reorder-msg .send-text").value.includes("http"));
lens.reorder = await page.$eval("#reorder-msg .send-text", (t) => t.value.length);
const ids = await page.evaluate(() => JSON.parse(localStorage.getItem("daftarche:v1")).orders.slice(-8).map((o) => o.id));
let st = 0;
for (const id of ids) {
  await page.goto(BASE + "#/order/" + id, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("#status-msg .send-text").value.includes("http") || document.querySelector("#status-msg .send-text").value.includes("لذت"));
  st = Math.max(st, await page.$eval("#status-msg .send-text", (t) => t.value.length));
}
lens.status = st;
await page.goto(BASE + "#/share", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("#reply-order .send-text").value.includes("http"));
lens["saved reply"] = await page.$eval("#reply-order .send-text", (t) => t.value.length);
console.log("message lengths:", lens);
await browser.close();
if (errors.length) { console.log("ERRORS", errors); process.exit(1); }
console.log("JUDGE PATH PASSED");
