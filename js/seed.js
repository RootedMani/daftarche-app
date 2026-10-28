// Demo notebook for a fictional shop. All names and numbers are invented.
// Dates are relative to "now" so the demo always shows: an overdue paid order, an order needed soon,
// a returning customer, reminders due today, a birthday coming back a year later, and a product sold below cost.

import { DAY, now } from "./util.js";
import { blankState, blankShop, computeTotals } from "./store.js";
import { toJalali, fromJalali } from "./jalali.js";

const PRODUCTS = [
  { id: "p1", name: "صابون جو دوسر", price: 120000, cost: 62000, cycle: 30 },
  { id: "p2", name: "صابون زغال", price: 120000, cost: 64000, cycle: 30 },
  { id: "p3", name: "شامپو بار رزماری", price: 150000, cost: 71000, cycle: 45 },
  { id: "p4", name: "ست ۳ تایی صابون", price: 320000, cost: 192000, cycle: 0 },
  { id: "p5", name: "شمع لیوانی کوچک", price: 260000, cost: 238000, cycle: 60 },
  { id: "p6", name: "شمع لیوانی بزرگ", price: 380000, cost: 401000, cycle: 90 },
  { id: "p7", name: "باکس هدیه شمع و صابون", price: 520000, cost: 405000, cycle: 0 },
];

const PEOPLE = [
  ["مهرنوش کرمی", "09120000101", "mehrnoosh.k", "تهران", "خیابان پاسداران، کوچه نیلوفر، پلاک ۸، واحد ۲"],
  ["آتنا رحیمی", "09120000102", "atena.rhm", "تهران", "سعادت‌آباد، بلوار پاک‌نژاد، پلاک ۴۱"],
  ["شبنم نوروزی", "09120000103", "", "کرج", "گوهردشت، بلوار موذن، کوچه ۱۲، پلاک ۵"],
  ["پرستو قاسمی", "09120000104", "parastoo.gh", "اصفهان", "خیابان چهارباغ بالا، کوچه ۹، پلاک ۳"],
  ["ریحانه صدری", "09120000105", "reyhane.sdr", "تهران", "نارمک، میدان هفت‌حوض، خیابان ۴۶، پلاک ۱۸"],
  ["سولماز فتحی", "09120000106", "", "تبریز", "ولیعصر، خیابان فروغی، پلاک ۲۲"],
  ["گلاره امیری", "09120000107", "gelare.am", "تهران", "یوسف‌آباد، خیابان ۲۱، پلاک ۷، واحد ۴"],
  ["نیوشا بهرامی", "09120000108", "niusha.b", "شیراز", "معالی‌آباد، کوچه ۳۲، پلاک ۱۰"],
  ["ترلان وکیلی", "09120000109", "", "رشت", "گلسار، بلوار سمیه، کوچه ۱۰۹، پلاک ۶"],
  ["هستی نیک‌نام", "09120000110", "hasti.nn", "تهران", "شهرک غرب، فاز ۲، خیابان زرافشان، پلاک ۱۵"],
  ["بهار شکیبا", "09120000111", "bahar.shk", "مشهد", "بلوار سجاد، خیابان بهار ۸، پلاک ۴"],
  ["یگانه مقدم", "09120000112", "", "تهران", "تهرانپارس، خیابان جشنواره، کوچه ۲۲، پلاک ۹"],
  ["آوا زندی", "09120000113", "ava.zandi", "قزوین", "خیابان نوروزیان، کوچه ۵، پلاک ۲"],
  ["مژگان طلوعی", "09120000114", "", "تهران", "ونک، خیابان ملاصدرا، پلاک ۶۰، واحد ۱۲"],
  ["فرانک اسدی", "09120000115", "faranak.as", "کرج", "عظیمیه، میدان مهران، کوچه ۴، پلاک ۱"],
  ["دلارام کیانی", "09120000116", "delaram.k", "تهران", "پیروزی، خیابان نبرد شمالی، پلاک ۲۷"],
];

// customers whose reminders the demo is built to show (soap, shampoo, candle cycles and a birthday)
export const DEMO_REMINDER_PHONES = ["09120000103", "09120000108", "09120000112", "09120000113"];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

export function buildDemo() {
  const t0 = now();
  const st = blankState();
  st.demo = true;
  st.shop = {
    ...blankShop(),
    name: "کارگاه شمع و صابون مهتاب",
    handle: "daftarche.demo",
    card: "6037991234567890",
    cardOwner: "مهتاب نمونه",
    freeShipMin: 700000,
    askDate: true,
    customFields: [
      { id: "occasion", label: "مناسبت (مثلاً تولد مادر)", hint: "اگر هدیه است" },
      { id: "card", label: "متن کارت هدیه", hint: "اختیاری" },
    ],
    welcome: "همه‌ی محصولات دست‌سازند و ۲ تا ۳ روز کاری بعد از واریز ارسال می‌شوند.",
  };
  st.products = PRODUCTS.map((p) => ({ ...p, active: true }));
  const rand = rng(1405);
  let n = 0;
  const pid = () => "D" + String(++n).padStart(3, "0");
  const person = (i) => {
    const [name, phone, ig, city, address] = PEOPLE[i];
    return { name, phone, ig, city, address, postal: "" };
  };

  function order(i, daysAgo, items, status, extra = {}) {
    const createdAt = t0 - daysAgo * DAY - Math.floor(rand() * 10) * 3600000;
    const its = items.map(([id, qty]) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return { pid: id, name: p.name, price: p.price, qty };
    });
    const shipId = person(i).city === "تهران" && rand() < 0.4 ? "peyk" : "post";
    const totals = computeTotals(its, shipId, st.shop);
    const flow = ["new", "paid", "making", "shipped", "done"];
    const history = [];
    let t = createdAt;
    for (const s of flow.slice(0, flow.indexOf(status === "cancelled" ? "new" : status) + 1)) {
      history.push({ s, t });
      t += (0.4 + rand()) * DAY;
    }
    if (status === "cancelled") history.push({ s: "cancelled", t: createdAt + DAY });
    const o = {
      id: pid(), createdAt, source: rand() < 0.7 ? "link" : "quick",
      customer: person(i), items: its, shipId, ...totals, specs: {}, needBy: null, note: "", payRef: "",
      status, history,
      tracking: ["shipped", "done"].includes(status) && shipId === "post" ? String(Math.floor(1e11 + rand() * 9e11)) + "0" : "",
      ...extra,
    };
    if (history.find((h) => h.s === "paid")) o.paidAt = history.find((h) => h.s === "paid").t;
    if (history.find((h) => h.s === "shipped")) o.shippedAt = history.find((h) => h.s === "shipped").t;
    st.orders.push(o);
    return o;
  }

  // ---- background history: ~5 months of finished orders, most of them from returning customers
  const regulars = [0, 1, 4, 6, 9, 10, 13, 15];
  const basket = () => {
    const r = rand();
    if (r < 0.28) return [["p1", 1 + Math.floor(rand() * 2)]];
    if (r < 0.45) return [["p2", 2]];
    if (r < 0.58) return [["p4", 1]];
    if (r < 0.72) return [["p5", 1 + Math.floor(rand() * 2)]];
    if (r < 0.84) return [["p6", 1]];
    if (r < 0.93) return [["p3", 1], ["p1", 1]];
    return [["p7", 1]];
  };
  for (let d = 150; d > 12; d -= 2 + Math.floor(rand() * 3)) {
    const i = rand() < 0.65 ? regulars[Math.floor(rand() * regulars.length)] : Math.floor(rand() * PEOPLE.length);
    order(i, d, basket(), rand() < 0.04 ? "cancelled" : "done");
  }

  // ---- scenario orders (these drive what the demo shows)
  order(2, 30, [["p1", 2]], "done");                                   // reminder due today (soap, 30-day cycle)
  order(7, 43, [["p3", 1]], "done");                                   // reminder due in 2 days (shampoo, 45-day cycle)
  order(11, 61, [["p5", 1]], "done");                                  // reminder 1 day overdue (candle, 60-day cycle)
  // a birthday box ordered last year, needed by a date that comes round again in 5 days
  const soon = toJalali(t0 + 5 * DAY);
  const lastYear = fromJalali(soon.jy - 1, soon.jm, Math.min(soon.jd, soon.jm === 12 ? 29 : soon.jd));
  order(12, Math.round((t0 - lastYear) / DAY) + 6, [["p7", 1]], "done", {
    needBy: lastYear, specs: { occasion: "تولد مادر", card: "مامان جان تولدت مبارک" },
  });

  order(3, 6, [["p4", 1], ["p3", 1]], "shipped");
  order(9, 5, [["p6", 2]], "shipped");
  order(14, 4, [["p1", 1], ["p2", 1]], "shipped");
  const late = order(5, 4, [["p5", 2]], "paid");                       // paid 3+ days ago, still not shipped
  late.paidAt = t0 - 3.2 * DAY;
  late.history = [{ s: "new", t: late.createdAt }, { s: "paid", t: late.paidAt }];
  order(8, 3, [["p7", 1]], "making", {                                // custom gift needed in 2 days
    needBy: t0 + 2 * DAY, specs: { occasion: "سالگرد ازدواج", card: "برای همیشه‌ی من" },
  });
  order(1, 2, [["p1", 2], ["p3", 1]], "paid");
  order(13, 4.2, [["p2", 1]], "new");                                  // waiting for payment for 4 days
  order(10, 1, [["p6", 1], ["p5", 1]], "new");
  const back = order(0, 0.05, [["p1", 2], ["p2", 1]], "new");          // a regular, today, via the order link
  back.source = "link";
  back.payRef = "ساعت ۲۲:۴۰، ۴ رقم آخر ۷۷۲۱";

  st.orders.sort((a, b) => a.createdAt - b.createdAt);
  // "where is my order?" messages logged by hand during the test: last week vs this week
  for (let k = 0; k < 9; k++) st.whereLog.push(t0 - (7.5 + rand() * 6) * DAY);
  for (let k = 0; k < 3; k++) st.whereLog.push(t0 - rand() * 6 * DAY);
  st.notes["09120000101"] = "بوی تند دوست ندارد؛ همیشه جو دوسر بدون اسانس.";
  return st;
}
