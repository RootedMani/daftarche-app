// Rule-based extraction for "ثبت سریع": the seller pastes a chunk of DM conversation and
// gets a draft order (name, phone, address, items, quantities) to review before saving.

import { norm, phoneKey, fa } from "./util.js";

const NUM_WORDS = {
  "یه": 1, "یک": 1, "یدونه": 1, "یکی": 1, "دو": 2, "دوتا": 2, "سه": 3, "سه‌تا": 3, "چهار": 4, "چار": 4,
  "پنج": 5, "شش": 6, "شیش": 6, "هفت": 7, "هشت": 8, "نه": 9, "ده": 10,
};
const ADDRESS_HINTS = /آدرس|خیابان|خ\.|کوچه|پلاک|بلوار|میدان|واحد|طبقه|بن‌بست|شهرک|محله|کدپستی|کد پستی/;
const CITIES = ["تهران", "کرج", "اصفهان", "شیراز", "مشهد", "تبریز", "رشت", "قزوین", "اهواز", "قم", "کرمان", "یزد", "ساری", "همدان", "اراک", "ارومیه", "زنجان", "سنندج", "کرمانشاه", "گرگان", "بندرعباس", "بوشهر", "خرم‌آباد", "سمنان", "بجنورد", "بیرجند", "زاهدان", "ایلام", "یاسوج", "شهرکرد", "اردبیل"];
// words that appear in many product names and so say little about which product is meant
const STOP = new Set(["و", "با", "از", "به", "برای", "تا", "عدد", "عددی", "تایی", "گرمی", "ست", "کوچک", "بزرگ", "متوسط"]);

const words = (s) => norm(s).replace(/[،,.:؛!?؟()«»"'\-]/g, " ").split(/\s+/).filter(Boolean);

function qtyBefore(tokens, idx) {
  for (let k = idx - 1; k >= Math.max(0, idx - 4); k--) {
    const t = tokens[k].replace(/تا$/, "");
    if (/^\d{1,2}$/.test(t)) return parseInt(t, 10);
    if (NUM_WORDS[tokens[k]] != null) return NUM_WORDS[tokens[k]];
    if (NUM_WORDS[t] != null) return NUM_WORDS[t];
  }
  return 1;
}

/** Score how well a line mentions a product: share of the product's words that appear, with distinctive words weighted up. */
function matchProduct(lineTokens, product) {
  const pw = words(product.name);
  if (!pw.length) return { score: 0 };
  let hit = 0, total = 0, firstIdx = -1;
  const used = [];
  for (const w of pw) {
    const weight = STOP.has(w) || /^\d+$/.test(w) ? 0.5 : 1;
    total += weight;
    const idx = lineTokens.findIndex((t) => t === w || (w.length > 3 && t.startsWith(w)) || (t.length > 3 && w.startsWith(t)));
    if (idx >= 0) {
      hit += weight;
      if (weight === 1) used.push(idx);
      if (firstIdx < 0 || idx < firstIdx) firstIdx = idx;
    }
  }
  return { score: used.length ? hit / total : 0, idx: firstIdx, used };
}

export function parseChat(text, products) {
  const raw = norm(text);
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out = { customer: { name: "", phone: "", ig: "", city: "", address: "", postal: "" }, items: [], note: "", found: [] };

  const phone = raw.replace(/[\s-]/g, "").match(/(?:\+98|0098|0)?9\d{9}/);
  if (phone) { out.customer.phone = phoneKey(phone[0]); out.found.push("موبایل"); }

  const ig = raw.match(/@([A-Za-z0-9._]{3,30})/);
  if (ig) { out.customer.ig = ig[1]; out.found.push("آیدی"); }

  const postal = raw.replace(/[\s-]/g, "").match(/(?<!\d)\d{10}(?!\d)/);
  if (postal && !/^09/.test(postal[0])) out.customer.postal = postal[0];

  const nameM = raw.match(/(?:به اسم|به نام|اسمم|اسم|نام|گیرنده)\s*[:：]?\s*([^\n،,0-9@]{2,30})/);
  if (nameM) {
    out.customer.name = nameM[1].replace(/(هست|هستم|است|ه)$/, "").trim();
  } else {
    const titled = raw.match(/(?:خانم|آقای)\s+([^\n،,0-9@]{2,25})/);
    if (titled) out.customer.name = titled[0].trim();
  }
  if (out.customer.name) out.found.push("نام");

  const addrLine = lines.find((l) => ADDRESS_HINTS.test(l) && l.length > 8);
  if (addrLine) {
    out.customer.address = addrLine.replace(/^.*?(آدرس(م)?\s*[:：]?\s*)/, "").replace(/(?:\+98|0)?9\d{9}/, "").trim();
    out.found.push("آدرس");
  }
  const city = CITIES.find((c) => raw.includes(c));
  if (city) out.customer.city = city;

  const picked = new Map();
  for (const line of lines) {
    const toks = words(line);
    // several products can share a line; a weaker match only counts if it claims words the stronger ones did not
    const cands = products.map((p) => ({ ...matchProduct(toks, p), p })).filter((m) => m.score >= 0.5).sort((a, b) => b.score - a.score);
    const claimed = new Set();
    for (const m of cands) {
      if (m.used.every((i) => claimed.has(i))) continue;
      m.used.forEach((i) => claimed.add(i));
      const qty = qtyBefore(toks, m.idx);
      picked.set(m.p.id, { pid: m.p.id, name: m.p.name, price: m.p.price, qty: Math.max(qty, picked.get(m.p.id)?.qty || 0) });
    }
  }
  out.items = [...picked.values()];
  if (out.items.length) out.found.push(`${fa(out.items.length)} محصول`);

  const dateM = raw.match(/(?:تا|برای|تاریخ)\s+(\d{1,2})\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)/);
  if (dateM) out.note = `تاریخ لازم: ${dateM[1]} ${dateM[2]}`;
  return out;
}
