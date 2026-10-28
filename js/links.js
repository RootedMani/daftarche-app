// Payload builders for the three link types, and the ready-made message texts.
// Keys are kept short on purpose: every byte ends up in a URL pasted into a DM.

import { makeLink } from "./codec.js";
import { fa, num, toman } from "./util.js";
import { jDay } from "./jalali.js";
import { STATUS, productById, computeTotals } from "./store.js";

// ------------------------------------------------------------------ seller -> customer: order form

export function orderFormLink(shop, products, prefill) {
  const p = {
    v: 1,
    s: {
      n: shop.name,
      h: shop.handle,
      c: shop.card,
      co: shop.cardOwner,
      sh: shop.shipping.map((m) => [m.id, m.name, m.fee]),
      f: shop.freeShipMin || 0,
      d: shop.askDate ? 1 : 0,
      cf: shop.customFields.map((f) => (prefill || !f.hint ? [f.id, f.label] : [f.id, f.label, f.hint])),
      w: prefill ? "" : shop.welcome || "", // prefilled links go out in reminders; keep them short
    },
    p: products.filter((x) => x.active !== false).map((x) => [x.id, x.name, x.price]),
  };
  if (prefill) {
    const c = prefill.customer;
    p.pre = {
      c: { n: c.name, ph: c.phone, ig: c.ig, ci: c.city, a: c.address, pc: c.postal },
      i: prefill.items.map((it) => [it.pid, it.qty]),
      sp: prefill.specs || {},
    };
  }
  return makeLink("o", p);
}

export function readOrderForm(p) {
  const s = p.s;
  return {
    shop: {
      name: s.n, handle: s.h, card: s.c, cardOwner: s.co,
      shipping: s.sh.map(([id, name, fee]) => ({ id, name, fee })),
      freeShipMin: s.f, askDate: !!s.d,
      customFields: (s.cf || []).map(([id, label, hint]) => ({ id, label, hint })),
      welcome: s.w || "",
    },
    products: p.p.map(([id, name, price]) => ({ id, name, price })),
    prefill: p.pre
      ? {
          customer: { name: p.pre.c.n || "", phone: p.pre.c.ph || "", ig: p.pre.c.ig || "", city: p.pre.c.ci || "", address: p.pre.c.a || "", postal: p.pre.c.pc || "" },
          items: p.pre.i.map(([pid, qty]) => ({ pid, qty })),
          specs: p.pre.sp || {},
        }
      : null,
  };
}

// ------------------------------------------------------------------ customer -> seller: the submitted order

// Instagram caps DM length, so this carries only what the seller's notebook cannot rebuild:
// product names, shipping name and totals are recomputed from the seller's own catalogue on import.
export function incomingLink(o, handle) {
  const c = o.customer;
  const p = {
    v: 1, id: o.id, t: o.createdAt, h: handle,
    c: { n: c.name, ph: c.phone, ig: c.ig || undefined, ci: c.city, a: c.address, pc: c.postal || undefined },
    i: o.items.map((it) => [it.pid, it.qty, it.price]),
    sh: o.shipId,
  };
  if (Object.keys(o.specs || {}).length) p.sp = o.specs;
  if (o.needBy) p.nb = o.needBy;
  if (o.note) p.no = o.note;
  if (o.payRef) p.pr = o.payRef;
  return makeLink("i", p);
}

export function readIncoming(p) {
  const items = p.i.map(([pid, qty, price, name]) => ({ pid, qty, price, name: name || productById(pid)?.name || `محصول ${pid}` }));
  return {
    id: p.id, createdAt: p.t, handle: p.h, source: "link",
    customer: { name: p.c.n || "", phone: p.c.ph || "", ig: p.c.ig || "", city: p.c.ci || "", address: p.c.a || "", postal: p.c.pc || "" },
    items, shipId: p.sh, ...computeTotals(items, p.sh),
    specs: p.sp || {}, needBy: p.nb || null, note: p.no || "", payRef: p.pr || "",
  };
}

// ------------------------------------------------------------------ seller -> customer: status page

export function statusLink(o, shop) {
  return makeLink("s", {
    v: 1, sn: shop.name, h: shop.handle, id: o.id, st: o.status,
    hs: (o.history || []).map((h) => [h.s, h.t]),
    tr: o.tracking || "", shn: o.shipName || "",
    i: o.items.map((it) => [it.name, it.qty]), tot: o.total, at: Date.now(),
  });
}

export function readStatus(p) {
  return {
    shopName: p.sn, handle: p.h, id: p.id, status: p.st,
    history: (p.hs || []).map(([s, t]) => ({ s, t })),
    tracking: p.tr, shipName: p.shn, items: p.i.map(([name, qty]) => ({ name, qty })), total: p.tot, at: p.at,
  };
}

// ------------------------------------------------------------------ message texts

const first = (name) => (name || "").trim().split(/\s+/)[0] || "";
const hi = (name) => (first(name) ? `سلام ${first(name)} عزیز` : "سلام");
export const itemsLine = (items) => items.map((it) => `${fa(it.qty)}× ${it.name}`).join("، ");

export function incomingMessage(o, link) {
  return [
    `🧾 سفارش جدید · کد ${o.id}`,
    ...o.items.map((it) => `${fa(it.qty)}× ${it.name}`),
    `جمع: ${toman(o.total)}`,
    `${o.customer.name} · ${o.customer.phone}`,
    "",
    "لینک ثبت در دفترچه:",
    link,
  ].join("\n");
}

export function statusMessage(o, shop, link) {
  const h = hi(o.customer.name);
  switch (o.status) {
    case "new":
      return `${h} 🌸 سفارش ${o.id} ثبت شد. مبلغ ${toman(o.total)} را به کارت ${shop.card} (${shop.cardOwner}) واریز کنید و فیش را همین‌جا بفرستید.\nوضعیت سفارش: ${link}`;
    case "paid":
      return `${h} 🌸 واریزتان برای سفارش ${o.id} تأیید شد و سفارش در صف آماده‌سازی است.\nوضعیت سفارش همیشه اینجاست: ${link}`;
    case "making":
      return `${h} ✨ سفارش ${o.id} در حال آماده‌سازی است.\nوضعیت سفارش: ${link}`;
    case "shipped":
      return `${h} 📦 سفارش ${o.id} ارسال شد.${o.tracking ? `\nکد رهگیری${o.shipName ? " " + o.shipName : ""}: ${o.tracking}` : ""}\nوضعیت سفارش همیشه اینجاست: ${link}`;
    case "done":
      return `${h} 💛 امیدواریم از سفارش‌تان لذت ببرید. ممنون که از ${shop.name} خرید کردید.`;
    default:
      return `${h}، سفارش ${o.id}: ${STATUS[o.status]?.label || ""}\n${link}`;
  }
}

export function reminderMessage(r, shop, link) {
  const h = hi(r.customer.name);
  if (r.type === "occasion") {
    return `${h} 🎉 پارسال حوالی ${jDay(r.due)} ${r.label ? `برای ${r.label} ` : ""}از ${shop.name} سفارش دادید. امسال هم در خدمتیم؛ سفارش قبلی با یک تأیید آماده است:\n${link}`;
  }
  const days = Math.max(1, Math.round((Date.now() - r.order.createdAt) / 86400000));
  const names = r.entries.map((e) => e.product.name);
  const what = names.length > 1 ? `${names.slice(0, -1).join("، ")} و ${names[names.length - 1]}` : names[0];
  const when = r.entries.length > 1 ? "" : `حدود ${fa(days)} روز پیش `;
  return `${h} 🌿 ${when}${what} گرفتید؛ شاید رو به اتمام باشد. همان سفارش آماده است و فقط یک تأیید می‌خواهد:\n${link}`;
}

export function savedReply(shop, link) {
  return `سلام عزیزم 🌸 برای ثبت سفارش لطفاً این فرم را پر کنید. قیمت‌ها، هزینه‌ی ارسال و شماره‌کارت همان‌جاست و سفارش‌تان مستقیم در دفتر ما ثبت می‌شود:\n${link}`;
}

export function trackingReply() {
  return "سلام عزیزم 🌸 لینک «وضعیت سفارش» که بعد از ثبت برایتان فرستادیم همیشه آخرین وضعیت و کد رهگیری را نشان می‌دهد. اگر پیدایش نمی‌کنید، کد سفارش را بفرستید.";
}

export const moneyLine = (n) => `${num(n)} تومان`;
