// Seller state lives only in this browser (localStorage). Everything else is derived from orders.

import { DAY, now, phoneKey, igHandle, norm, daysBetween, startOfDay } from "./util.js";
import { toJalali, fromJalali } from "./jalali.js";

const KEY = "daftarche:v1";
const ME_KEY = "daftarche:me";

export const STATUS = {
  new: { label: "منتظر واریز", short: "منتظر واریز", tone: "amber" },
  paid: { label: "واریز شد", short: "پرداخت‌شده", tone: "blue" },
  making: { label: "در حال آماده‌سازی", short: "آماده‌سازی", tone: "violet" },
  shipped: { label: "ارسال شد", short: "ارسال‌شده", tone: "green" },
  done: { label: "تحویل شد", short: "تحویل‌شده", tone: "gray" },
  cancelled: { label: "لغو شد", short: "لغوشده", tone: "gray" },
};
export const FLOW = ["new", "paid", "making", "shipped", "done"];
export const OPEN = ["new", "paid", "making", "shipped"];
export const OVERDUE_HOURS = 48;

export function blankShop() {
  return {
    name: "",
    handle: "",
    card: "",
    cardOwner: "",
    shipping: [
      { id: "post", name: "پست پیشتاز", fee: 95000 },
      { id: "peyk", name: "پیک (فقط تهران)", fee: 80000 },
    ],
    freeShipMin: 0,
    askDate: false,
    customFields: [],
    welcome: "",
  };
}

export function blankState() {
  return { v: 1, demo: false, shop: null, products: [], orders: [], notes: {}, reminders: {}, whereLog: [], createdAt: now() };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return s;
  } catch { /* storage blocked or corrupt */ }
  return blankState();
}

export const getState = () => state;
export const hasShop = () => !!state.shop;
export const onChange = (fn) => listeners.add(fn);

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ }
  listeners.forEach((fn) => fn());
}

export function replaceState(next) {
  state = next;
  save();
}

export function resetAll() {
  state = blankState();
  save();
}

// ------------------------------------------------------------------ customer-side memory (the buyer's phone)

export function loadMe() {
  try { return JSON.parse(localStorage.getItem(ME_KEY)) || { profiles: {}, orders: [] }; } catch { return { profiles: {}, orders: [] }; }
}
export function saveMe(me) {
  try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ products

export const productById = (id) => state.products.find((p) => p.id === id);

export function nextProductId() {
  let n = state.products.length + 1;
  while (state.products.some((p) => p.id === "p" + n)) n++;
  return "p" + n;
}

// ------------------------------------------------------------------ orders

export const orderById = (id) => state.orders.find((o) => o.id === id);

export function customerKey(c) {
  return phoneKey(c?.phone) || (c?.ig ? "@" + igHandle(c.ig) : "") || norm(c?.name);
}

export function computeTotals(items, shipId, shop = state.shop) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const method = shop?.shipping.find((m) => m.id === shipId) || shop?.shipping[0];
  const fee = method ? method.fee : 0;
  const freeShip = !!(shop?.freeShipMin && subtotal >= shop.freeShipMin);
  const shipFee = freeShip ? 0 : fee;
  return { subtotal, shipFee, freeShip, shipCost: fee, total: subtotal + shipFee, shipName: method?.name || "" };
}

/** Add (or ignore a duplicate of) an order. Returns {order, duplicate}. */
export function addOrder(o) {
  const existing = orderById(o.id);
  if (existing) return { order: existing, duplicate: true };
  const order = {
    status: "new",
    history: [{ s: "new", t: o.createdAt || now() }],
    tracking: "",
    note: "",
    specs: {},
    needBy: null,
    payRef: "",
    ...o,
  };
  order.createdAt = order.createdAt || now();
  order.customer = { name: "", phone: "", ig: "", city: "", address: "", postal: "", ...order.customer };
  order.customer.phone = phoneKey(order.customer.phone) || norm(order.customer.phone);
  state.orders.push(order);
  save();
  return { order, duplicate: false };
}

export function setStatus(order, s, t = now()) {
  order.status = s;
  order.history = [...(order.history || []), { s, t }];
  if (s === "paid") order.paidAt = t;
  if (s === "shipped") order.shippedAt = t;
  save();
}

export const statusTime = (o, s) => [...(o.history || [])].reverse().find((h) => h.s === s)?.t;

export function isOverdue(o) {
  if (o.status !== "paid" && o.status !== "making") return false;
  const paidAt = o.paidAt || statusTime(o, "paid") || o.createdAt;
  return now() - paidAt > OVERDUE_HOURS * 3600000;
}

export function dueSoon(o) {
  if (!o.needBy || !["new", "paid", "making"].includes(o.status)) return false;
  return daysBetween(now(), o.needBy) <= 3;
}

export const waitingTooLong = (o) => o.status === "new" && now() - o.createdAt > 3 * DAY;

// ------------------------------------------------------------------ customers (derived)

export function customers() {
  const map = new Map();
  const sorted = [...state.orders].sort((a, b) => a.createdAt - b.createdAt);
  for (const o of sorted) {
    const k = customerKey(o.customer);
    if (!k) continue;
    let c = map.get(k);
    if (!c) {
      c = { key: k, orders: [], spent: 0, specs: {}, first: o.createdAt };
      map.set(k, c);
    }
    c.orders.push(o);
    // the latest non-empty value of each field wins
    for (const f of ["name", "phone", "ig", "city", "address", "postal"]) if (o.customer[f]) c[f] = o.customer[f];
    Object.assign(c.specs, Object.fromEntries(Object.entries(o.specs || {}).filter(([, v]) => v)));
    if (o.status !== "cancelled") c.spent += o.subtotal || 0;
    c.last = o.createdAt;
  }
  for (const c of map.values()) {
    c.live = c.orders.filter((o) => o.status !== "cancelled");
    c.count = c.live.length;
    c.lastOrder = c.live[c.live.length - 1] || c.orders[c.orders.length - 1];
    c.note = state.notes[c.key] || "";
    const usual = new Map();
    c.live.forEach((o) => o.items.forEach((it) => usual.set(it.pid, (usual.get(it.pid) || 0) + it.qty)));
    c.usual = [...usual.entries()].sort((a, b) => b[1] - a[1]).map(([pid]) => pid);
  }
  return [...map.values()].sort((a, b) => b.last - a.last);
}

export function customerByKey(k) {
  return customers().find((c) => c.key === k);
}

/** How many earlier (non-cancelled) orders this customer had before `order`. */
export function priorOrders(order) {
  const k = customerKey(order.customer);
  return state.orders.filter((o) => o !== order && o.status !== "cancelled" && customerKey(o.customer) === k && o.createdAt < order.createdAt);
}

// ------------------------------------------------------------------ reminders (derived)

function nextAnniversary(t) {
  const j = toJalali(t);
  const today = startOfDay(now());
  for (let y = toJalali(today).jy - 1; y <= toJalali(today).jy + 1; y++) {
    const jd = Math.min(j.jd, j.jm === 12 ? 29 : j.jd);
    const at = fromJalali(y, j.jm, jd);
    if (at >= today - 2 * DAY && at > t + 300 * DAY) return at;
  }
  return null;
}

export function reminders() {
  const out = [];
  const t = now();
  for (const c of customers()) {
    if (!c.count) continue;
    // re-order cycle per product, grouped into one reminder per customer
    const seen = new Set();
    const due = [];
    for (const o of [...c.live].reverse()) {
      for (const it of o.items) {
        if (seen.has(it.pid)) continue;
        seen.add(it.pid);
        const p = productById(it.pid);
        if (!p?.cycle) continue;
        const at = o.createdAt + p.cycle * DAY;
        const d = daysBetween(t, at);
        if (d > 3 || d < -30) continue;
        const key = `${c.key}|${it.pid}|${o.id}`;
        const st = state.reminders[key];
        if (st?.done || (st?.snoozeUntil && st.snoozeUntil > t)) continue;
        due.push({ key, product: p, order: o, item: it, due: at, days: d });
      }
    }
    if (due.length) {
      due.sort((a, b) => a.days - b.days);
      out.push({
        key: due.map((x) => x.key).join(","), type: "cycle", customer: c, entries: due,
        product: due[0].product, order: due[0].order, due: due[0].due, days: due[0].days,
        items: due.map((x) => ({ pid: x.item.pid, name: x.product.name, price: x.product.price, qty: x.item.qty })),
      });
    }
    // occasions: an order that was needed by a date (birthday, anniversary) repeats next year
    for (const o of c.live) {
      if (!o.needBy) continue;
      const at = nextAnniversary(o.needBy);
      if (!at) continue;
      const d = daysBetween(t, at);
      if (d < -1 || d > 10) continue;
      out.push({ key: `${c.key}|occ|${o.id}|${toJalali(at).jy}`, type: "occasion", customer: c, order: o, due: at, days: d, label: o.specs?.occasion || "" });
    }
  }
  return out
    .filter((r) => {
      if (r.type === "cycle") return true; // already filtered per product above
      const st = state.reminders[r.key];
      return !(st?.done || (st?.snoozeUntil && st.snoozeUntil > t));
    })
    .sort((a, b) => a.days - b.days);
}

/** Mark one reminder (a grouped reminder's key is a comma-separated list of per-product keys). */
export function markReminder(key, patch) {
  for (const k of key.split(",")) state.reminders[k] = { ...(state.reminders[k] || {}), ...patch };
  save();
}

// ------------------------------------------------------------------ money (light profit check)

export function productMargin(p) {
  if (!p.cost) return null;
  return { margin: p.price - p.cost, pct: (p.price - p.cost) / p.price };
}

export function orderProfit(o) {
  let cost = 0;
  let known = true;
  for (const it of o.items) {
    const p = productById(it.pid);
    if (p?.cost) cost += p.cost * it.qty;
    else known = false;
  }
  const shipLoss = o.freeShip ? o.shipCost || 0 : 0;
  return { profit: (o.subtotal || 0) - cost - shipLoss, known, shipLoss };
}

export function monthStats(sinceDays = 30) {
  const since = now() - sinceDays * DAY;
  const orders = state.orders.filter((o) => o.createdAt >= since && o.status !== "cancelled");
  let revenue = 0, profit = 0, freeShipCost = 0, repeat = 0;
  for (const o of orders) {
    revenue += o.subtotal || 0;
    const p = orderProfit(o);
    profit += p.profit;
    freeShipCost += p.shipLoss;
    if (priorOrders(o).length) repeat++;
  }
  return { count: orders.length, revenue, profit, freeShipCost, repeatShare: orders.length ? repeat / orders.length : 0 };
}

export function whereThisWeek() {
  const since = now() - 7 * DAY;
  return state.whereLog.filter((t) => t >= since).length;
}

export function whereLastWeek() {
  const a = now() - 14 * DAY, b = now() - 7 * DAY;
  return state.whereLog.filter((t) => t >= a && t < b).length;
}
