// Unit checks for pure modules. Run: node tests/core.test.mjs
import assert from "node:assert/strict";
import { toJalali, fromJalali, monthLength } from "../js/jalali.js";
import { encode, decode, findLink } from "../js/codec.js";
import { parseChat } from "../js/parse.js";
import { phoneKey, norm, toInt } from "../js/util.js";

// Jalali: compare against ICU's Persian calendar for ~12 years of days
const icu = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric" });
let checked = 0;
for (let t = new Date(2020, 0, 1).getTime(); t < new Date(2032, 0, 1).getTime(); t += 86400000) {
  const d = new Date(t); d.setHours(12);
  const p = Object.fromEntries(icu.formatToParts(d).map((x) => [x.type, x.value]));
  const j = toJalali(d.getTime());
  assert.deepEqual([j.jy, j.jm, j.jd], [+p.year.split(" ")[0], +p.month, +p.day], d.toDateString());
  const back = new Date(fromJalali(j.jy, j.jm, j.jd));
  assert.equal(back.toDateString(), d.toDateString());
  checked++;
}
assert.equal(monthLength(1403, 12), 30); // 1403 is a leap year
assert.equal(monthLength(1404, 12), 29);
console.log("jalali ok", checked, "days");

// codec round trip incl. Persian text, plus link discovery inside a pasted DM
const obj = { s: { n: "کارگاه مهتاب", h: "mahtab" }, p: [["p1", "صابون جو دوسر", 120000]], note: "سلام 🌸" };
const enc = await encode(obj);
assert.deepEqual(await decode(enc), obj);
const msg = `🧾 سفارش جدید\nلینک: https://x.github.io/app/#i=${enc}\nممنون`;
assert.deepEqual(findLink(msg), { kind: "i", payload: enc });
assert.deepEqual(await decode("j" + Buffer.from(JSON.stringify({ a: "ب" })).toString("base64url")), { a: "ب" });
console.log("codec ok, payload length", enc.length);

// normalisation
assert.equal(phoneKey("+98 912 123 4567"), "09121234567");
assert.equal(phoneKey("۰۹۱۲۱۲۳۴۵۶۷"), "09121234567");
assert.equal(phoneKey("00989121234567"), "09121234567");
assert.equal(phoneKey("12345"), "");
assert.equal(norm("علي كريمي"), "علی کریمی");
assert.equal(toInt("۱۲۰٬۰۰۰"), 120000);
console.log("normalise ok");

// quick-add parser on a realistic chat
const products = [
  { id: "p1", name: "صابون جو دوسر", price: 120000 },
  { id: "p2", name: "صابون زغال", price: 120000 },
  { id: "p3", name: "شامپو بار رزماری", price: 150000 },
  { id: "p4", name: "ست ۳ تایی صابون", price: 320000 },
];
const chat = `سلام وقتتون بخیر
دو تا صابون زغال می‌خوام با یه شامپو بار
آدرس: تهران، خیابان شریعتی، کوچه یاس، پلاک ۱۲، واحد ۳
به اسم آتنا رحیمی
شماره‌م ۰۹۱۲ ۳۴۵ ۶۷۸۹`;
const r = parseChat(chat, products);
assert.equal(r.customer.phone, "09123456789");
assert.equal(r.customer.name, "آتنا رحیمی");
assert.equal(r.customer.city, "تهران");
assert.match(r.customer.address, /شریعتی/);
assert.deepEqual(r.items.map((i) => [i.pid, i.qty]).sort(), [["p2", 2], ["p3", 1]]);
console.log("parser ok", r.found.join("، "));
