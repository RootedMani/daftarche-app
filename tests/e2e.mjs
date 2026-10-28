// Requires: npm i puppeteer-core, and Chrome at /usr/bin/google-chrome. Run: node tests/e2e.mjs http://127.0.0.1:8765/
// End-to-end: seller and customer in two separate browser contexts (separate storage, like two phones).
// Data only moves between them through the links/messages, exactly as in real use.
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";

const BASE = process.argv[2] || "http://127.0.0.1:8765/";
import { mkdirSync } from "node:fs";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const errors = [];
async function phone(tag) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${tag}] console ${m.text()}`); });
  page.on("dialog", (d) => d.accept());
  return page;
}
const text = (page, sel) => page.$eval(sel, (e) => e.innerText);
const val = (page, sel) => page.$eval(sel, (e) => e.value);
async function waitVal(page, sel) {
  await page.waitForFunction((s) => { const e = document.querySelector(s); return e && e.value && !e.value.includes("در حال ساختن"); }, {}, sel);
  return val(page, sel);
}
const step = (s) => console.log("✓", s);

const seller = await phone("seller");
const buyer = await phone("buyer");

// 1. seller creates a notebook
await seller.goto(BASE, { waitUntil: "networkidle0" });
await seller.click('a[href="#/setup"]');
await seller.waitForSelector('form[data-form="setup"]');
await seller.type('[name="name"]', "کارگاه سفال آزمایشی");
await seller.type('[name="handle"]', "@Test.Shop");
await seller.type('[name="card"]', "۶۰۳۷۹۹۱۱۱۱۲۲۲۲۳۳");
await seller.type('[name="owner"]', "سارا آزمون");
const rows = await seller.$$(".prod-row");
const prods = [["لیوان سفالی", "۲۵۰٬۰۰۰", "۱۴۰۰۰۰", "0"], ["بشقاب دست‌ساز", "380000", "", "0"], ["گلدان کوچک", "190000", "200000", "30"]];
for (let i = 0; i < 3; i++) {
  await rows[i].$eval('[name="pname"]', (e, v) => (e.value = v), prods[i][0]);
  await rows[i].$eval('[name="pprice"]', (e, v) => (e.value = v), prods[i][1]);
  await rows[i].$eval('[name="pcost"]', (e, v) => (e.value = v), prods[i][2]);
  await rows[i].$eval('[name="pcycle"]', (e, v) => (e.value = v), prods[i][3]);
}
await seller.type('[name="peyk"]', "60000");
await seller.type('[name="free"]', "۵۰۰۰۰۰");
await seller.click('[name="askDate"]');
await seller.click('[name="cf"][value="name_on"]');
await seller.click('form[data-form="setup"] button[type="submit"]');
await seller.waitForFunction(() => location.hash === "#/share");
const orderLink = await waitVal(seller, "#order-link input");
assert.match(orderLink, /#o=[zj]/);
step(`seller set up shop; order link ${orderLink.length} chars`);

// 2. customer opens the link on their own phone and orders (Persian digits in the phone number)
await buyer.goto(orderLink, { waitUntil: "networkidle0" });
assert.match(await text(buyer, ".pub-head h1"), /کارگاه سفال آزمایشی/);
await buyer.click('[data-act="qty"][data-pid="p1"][data-d="1"]');
await buyer.click('[data-act="qty"][data-pid="p1"][data-d="1"]');
await buyer.click('[data-act="qty"][data-pid="p2"][data-d="1"]');
assert.match(await text(buyer, "#summary"), /۸۸۰٬۰۰۰/); // 2×250k + 380k
assert.match(await text(buyer, "#summary"), /رایگان/);   // over the 500k free-shipping threshold
await buyer.click('form[data-form="place-order"] button[type="submit"]');
assert.match(await text(buyer, "#form-error"), /نام/);   // validation fires before anything is sent
await buyer.type('[name="name"]', "نگین آزمایشی");
await buyer.type('[name="phone"]', "۰۹۱۲ ۷۷۷ ۶۶۵۵");
await buyer.type('[name="city"]', "تهران");
await buyer.type('[name="address"]', "خیابان آزادی، کوچه ۴، پلاک ۹");
await buyer.type('[name="sp_name_on"]', "Negin / نگین");
await buyer.select('[name="needby_d"]', "15");
await buyer.select('[name="needby_m"]', "10");
await buyer.type('[name="payref"]', "۴ رقم آخر ۱۲۳۴");
await buyer.screenshot({ path: OUT + "e2e-form-filled.png", fullPage: true });
await buyer.click('form[data-form="place-order"] button[type="submit"]');
await buyer.waitForFunction(() => location.hash === "#sent");
const dm = await val(buyer, "#sent-msg .send-text");
assert.match(dm, /سفارش جدید/);
assert.match(dm, /#i=[zj]/);
assert.equal(await buyer.$(".demo-note"), null, "no same-browser shortcut on a separate phone");
await buyer.screenshot({ path: OUT + "e2e-sent.png", fullPage: true });
step("customer placed order and got the DM text");

// 3. seller pastes the DM text into "receive"
await seller.goto(BASE + "#/receive", { waitUntil: "networkidle0" });
await seller.$eval('textarea[name="text"]', (e, v) => (e.value = v), dm);
await seller.click('form[data-form="paste"] button[type="submit"]');
await seller.waitForSelector('[data-act="add-incoming"]');
const preview = await text(seller, ".incoming");
assert.match(preview, /نگین آزمایشی/);
assert.match(preview, /مشتری جدید/);
assert.match(preview, /Negin/);
await seller.click('[data-act="add-incoming"]');
await seller.waitForFunction(() => location.hash.startsWith("#/order/"));
await wait(300);
const detail = await text(seller, "#view");
assert.match(detail, /۸۸۰٬۰۰۰/);
assert.match(detail, /09127776655/);
assert.match(detail, /۱۵ دی/);
step("seller imported the order from the pasted DM");

// 4. paid -> shipped with a tracking code; the message carries a status link
await seller.click('[data-act="set-status"][data-s="paid"]');
await seller.waitForFunction(() => document.querySelector(".chip")?.innerText.includes("واریز شد"));
await seller.waitForFunction(() => document.querySelector("#status-msg .send-text").value.includes("#s="));
await seller.type('[name="tracking"]', "۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰۱۲");
await seller.click('form[data-form="ship"] button[type="submit"]');
await seller.waitForFunction(() => document.querySelector("#status-msg .send-text").value.includes("کد رهگیری"));
const shipMsg = await val(seller, "#status-msg .send-text");
assert.match(shipMsg, /123456789012345678901 2|1234567890123456789012/);
const smsHref = await seller.$eval('#status-msg [data-role="sms"]', (a) => a.href);
assert.match(smsHref, /^sms:09127776655\?body=/);
await seller.screenshot({ path: OUT + "e2e-shipped.png", fullPage: true });
const statusUrl = shipMsg.match(/https?:\S+#s=[zj][\w-]+/)[0];
step("seller marked paid + shipped; SMS link and status link ready");

// 5. customer opens the status link
await buyer.goto(statusUrl, { waitUntil: "networkidle0" });
const st = await text(buyer, "main");
assert.match(st, /ارسال شد/);
assert.match(st, /1234567890123456789012/);
assert.equal(await buyer.$$eval(".timeline li.done", (l) => l.length), 3);
await buyer.screenshot({ path: OUT + "e2e-status.png", fullPage: true });
step("customer sees status timeline + tracking code");

// 6. returning customer: their own phone remembers them; seller recognises them
await buyer.goto(orderLink, { waitUntil: "networkidle0" });
assert.match(await text(buyer, "main"), /اطلاعات دفعه‌ی قبل/);
assert.equal(await val(buyer, '[name="name"]'), "نگین آزمایشی");
await buyer.click('[data-act="qty"][data-pid="p3"][data-d="1"]');
await buyer.click('form[data-form="place-order"] button[type="submit"]');
await buyer.waitForFunction(() => location.hash === "#sent");
const dm2 = await val(buyer, "#sent-msg .send-text");
await seller.goto(BASE + "#/receive", { waitUntil: "networkidle0" });
await seller.$eval('textarea[name="text"]', (e, v) => (e.value = v), dm2);
await seller.click('form[data-form="paste"] button[type="submit"]');
await seller.waitForSelector('[data-act="add-incoming"]');
assert.match(await text(seller, ".incoming"), /مشتری قدیمی · سفارش دوم/);
assert.match(await text(seller, ".incoming"), /دفعه‌ی قبل/);
await seller.click('[data-act="add-incoming"]');
await seller.waitForFunction(() => location.hash.startsWith("#/order/"));
// pasting the same DM again must not duplicate
await seller.goto(BASE + "#/receive", { waitUntil: "networkidle0" });
await seller.$eval('textarea[name="text"]', (e, v) => (e.value = v), dm2);
await seller.click('form[data-form="paste"] button[type="submit"]');
await seller.waitForSelector(".incoming");
assert.match(await text(seller, ".incoming"), /قبلاً در دفترچه ثبت شده/);
step("returning customer prefilled on their phone, recognised by seller, duplicates blocked");

// 7. customer profile -> pre-filled re-order link opened by the customer
await seller.goto(BASE + "#/c/09127776655", { waitUntil: "networkidle0" });
const reorder = await waitVal(seller, "#reorder-msg .send-text");
const reorderUrl = reorder.match(/https?:\S+#o=[zj][\w-]+/)[0];
await buyer.goto(reorderUrl, { waitUntil: "networkidle0" });
assert.match(await text(buyer, "main"), /خوش برگشتید/);
assert.equal(await text(buyer, '[data-qty="p3"]'), "۱");
step("re-order link opens with last order pre-filled");

// 8. quick add from raw chat text
await seller.goto(BASE + "#/quick", { waitUntil: "networkidle0" });
await seller.$eval('textarea[name="text"]', (e) => (e.value = "سلام دو تا لیوان سفالی می‌خوام و یه گلدان کوچک\nآدرس: کرج، گوهردشت، بلوار موذن، پلاک ۳\nبه اسم مینا تست\n۰۹۳۵۱۱۱۲۲۳۳"));
await seller.click('form[data-form="extract"] button[type="submit"]');
await seller.waitForSelector('form[data-form="save-order"]');
assert.equal(await val(seller, '[name="phone"]'), "09351112233");
assert.equal(await val(seller, '[name="name"]'), "مینا تست");
const qtys = await seller.$$eval("#ed-items .sqty", (l) => l.map((e) => e.innerText));
assert.deepEqual(qtys, ["۲", "۰", "۱"]);
await seller.click('form[data-form="save-order"] button[type="submit"]');
await seller.waitForFunction(() => location.hash.startsWith("#/order/"));
step("quick add extracted name, phone, address, items and quantities");

// 9. profit check flags the product sold below cost; reminders appear after the cycle
await seller.goto(BASE + "#/products", { waitUntil: "networkidle0" });
assert.match(await text(seller, "#view"), /زیان ۱۰٬۰۰۰ تومان در هر عدد/);
await seller.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("daftarche:v1"));
  s.orders.find((o) => o.items.some((i) => i.pid === "p3")).createdAt -= 30 * 86400000;
  localStorage.setItem("daftarche:v1", JSON.stringify(s));
});
await seller.goto(BASE + "#/reminders", { waitUntil: "networkidle0" });
await seller.reload({ waitUntil: "networkidle0" });
await seller.waitForFunction(() => [...document.querySelectorAll(".send-text")].some((t) => t.value.includes("#o=")));
assert.match(await text(seller, "#view"), /گلدان کوچک/);
await seller.click('[data-act="rem-done"]');
await wait(200);
assert.match(await text(seller, "#view"), /امروز یادآوری‌ای نیست/);
step("below-cost product flagged; reminder appeared after the 30-day cycle and can be closed");

// 10. an incoming link opened on a phone without a notebook (e.g. inside Instagram) explains what to do
const inLink = dm.match(/https?:\S+#i=[zj][\w-]+/)[0];
await buyer.goto(inLink, { waitUntil: "networkidle0" });
assert.match(await text(buyer, "main"), /دفترچه‌ی فروشنده/);
await buyer.goto(BASE + "#o=zBROKEN", { waitUntil: "networkidle0" });
assert.match(await text(buyer, "main"), /ناقص/);
step("incoming link without notebook explains; broken link handled");

// 11. backup export is valid JSON with all orders
const count = await seller.evaluate(() => JSON.parse(localStorage.getItem("daftarche:v1")).orders.length);
assert.equal(count, 3);
step("3 orders stored on the seller's phone only");

await browser.close();
if (errors.length) { console.log("ERRORS:\n" + errors.join("\n")); process.exit(1); }
console.log("ALL PASSED");
