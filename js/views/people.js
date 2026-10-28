// Seller: customer memory (list + profile) and re-order reminders.

import { esc, fa, toman, ltr, ago, norm, igHandle, now, DAY } from "../util.js";
import { jDay, jFull } from "../jalali.js";
import { orderFormLink, reminderMessage } from "../links.js";
import { getState, save, customers, customerByKey, reminders, markReminder } from "../store.js";
import { icon, toast, chip, sendPanel, fillSend, empty, itemsText } from "../ui.js";
import { setDraft, go } from "./orders.js";

const initials = (name) => esc((name || "?").trim()[0] || "?");

function custRow(c) {
  const regular = c.count >= 3;
  return `<a class="card cust-row" href="#/c/${encodeURIComponent(c.key)}">
    <div class="avatar sm">${initials(c.name)}</div>
    <div class="cr-main">
      <div><b>${esc(c.name || c.key)}</b> ${regular ? `<span class="badge green">مشتری ثابت</span>` : ""}</div>
      <div class="muted small">${c.phone ? ltr(c.phone) + " · " : ""}${fa(c.count)} خرید · آخری ${ago(c.last)}</div>
    </div>
    <div class="cr-side"><b>${toman(c.spent)}</b></div>
  </a>`;
}

function filterList(q) {
  const list = customers();
  if (!q) return list;
  const words = norm(q).toLowerCase().split(/\s+/);
  return list.filter((c) => {
    const hay = norm([c.name, c.phone, c.ig, c.city, c.address].join(" ")).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export const customerList = {
  render() {
    const list = customers();
    const regular = list.filter((c) => c.count >= 2).length;
    return `<div class="page">
      <div class="page-h"><h1>مشتری‌ها</h1><span class="muted">${fa(list.length)} نفر · ${fa(regular)} نفر بیش از یک بار خریده‌اند</span></div>
      <p class="muted">لیست مشتری خودش ساخته می‌شود: هر سفارش با شماره موبایل به صاحبش وصل است. وقتی کسی می‌گوید «همون همیشگی»، اینجا را جستجو کنید.</p>
      <div class="search">${icon("search")}<input id="cust-q" type="search" placeholder="نام، موبایل، آیدی یا شهر" aria-label="جستجوی مشتری"></div>
      <div id="cust-list" class="list">${list.length ? list.map(custRow).join("") : empty("هنوز مشتری‌ای ثبت نشده.", "با اولین سفارش، مشتری‌ها خودشان اینجا می‌آیند.")}</div>
    </div>`;
  },
  mount(root) {
    const q = root.querySelector("#cust-q");
    q.addEventListener("input", () => {
      const l = filterList(q.value);
      root.querySelector("#cust-list").innerHTML = l.length ? l.map(custRow).join("") : empty("کسی با این مشخصات پیدا نشد.");
    });
  },
};

export const customerPage = {
  render(key) {
    const c = customerByKey(key);
    if (!c) return empty("این مشتری پیدا نشد.", `<a href="#/customers">بازگشت</a>`);
    const st = getState();
    const p = st.products;
    const usual = c.usual.slice(0, 3).map((pid) => p.find((x) => x.id === pid)?.name).filter(Boolean);
    const fields = st.shop.customFields;
    const avgGap = c.count > 1 ? Math.round((c.live[c.live.length - 1].createdAt - c.live[0].createdAt) / DAY / (c.count - 1)) : null;
    return `<div class="page narrow">
      <a class="back" href="#/customers">${icon("back")} مشتری‌ها</a>
      <div class="profile">
        <div class="avatar lg">${initials(c.name)}</div>
        <div><h1>${esc(c.name || c.key)}</h1>
          <div class="muted">${c.phone ? ltr(c.phone) : ""}${c.ig ? " · " + ltr("@" + igHandle(c.ig)) : ""}</div></div>
      </div>
      <div class="stats3">
        <div class="stat"><div class="n">${fa(c.count)}</div><div class="muted small">خرید</div></div>
        <div class="stat"><div class="n">${toman(c.spent).replace(" تومان", "")}</div><div class="muted small">تومان، جمع خرید</div></div>
        <div class="stat"><div class="n">${avgGap ? fa(avgGap) : "—"}</div><div class="muted small">روز، فاصله‌ی معمول خرید</div></div>
      </div>
      <section class="card">
        <h2>«همون همیشگی»</h2>
        <p>${usual.length ? usual.map(esc).join("، ") : "—"}</p>
        <div class="muted small">آخرین سفارش (${jDay(c.lastOrder.createdAt)}): ${itemsText(c.lastOrder.items)}</div>
        <div class="row-actions">
          <button class="btn primary" data-act="repeat-order" data-key="${esc(c.key)}">${icon("plus")} ثبت همان سفارش</button>
        </div>
        ${sendPanel("reorder-msg", { phone: c.phone, title: "لینک سفارش دوباره برای مشتری", hint: "فرم سفارش با آدرس و اقلام دفعه‌ی قبل از پیش پر شده؛ مشتری فقط تأیید می‌کند." })}
      </section>
      <section class="card">
        <h2>آدرس و مشخصات</h2>
        <div>${esc(c.city ? c.city + "، " : "")}${esc(c.address || "—")}${c.postal ? ` · ${ltr(c.postal)}` : ""}</div>
        ${Object.entries(c.specs).map(([k, v]) => `<div class="kv"><span>${esc(fields.find((f) => f.id === k)?.label || k)}</span><b>${esc(v)}</b></div>`).join("")}
        <form data-form="cust-note" class="note-form">
          <label>یادداشت درباره‌ی این مشتری<textarea name="note" rows="2" placeholder="مثلاً: بوی تند دوست ندارد">${esc(c.note)}</textarea></label>
          <button class="btn small" type="submit">ذخیره‌ی یادداشت</button>
        </form>
      </section>
      <section class="card">
        <h2>همه‌ی سفارش‌ها</h2>
        ${[...c.orders].reverse().map((o) => `<a class="arow" href="#/order/${esc(o.id)}"><span>${jFull(o.createdAt)}</span><span class="muted">${itemsText(o.items)}</span><span>${toman(o.total)}</span>${chip(o.status)}</a>`).join("")}
      </section>
    </div>`;
  },
  async mount(root, key) {
    const c = customerByKey(key);
    if (!c) return;
    const st = getState();
    const link = await orderFormLink(st.shop, st.products, { customer: c, items: c.lastOrder.items, specs: c.specs });
    const first = (c.name || "").split(" ")[0];
    fillSend(root, "reorder-msg", `سلام ${first} عزیز 🌸 سفارش دفعه‌ی قبل‌تان را آماده کرده‌ایم؛ اگر همان را می‌خواهید فقط تأیید کنید (می‌توانید تغییرش هم بدهید):\n${link}`);
  },
  actions: {
    "repeat-order"(el) {
      const c = customerByKey(el.dataset.key);
      setDraft({ customer: { name: c.name, phone: c.phone, ig: c.ig, city: c.city, address: c.address, postal: c.postal }, items: c.lastOrder.items, specs: c.specs, source: "manual" });
      go("#/new");
    },
  },
  forms: {
    "cust-note"(f, fd, root, key) {
      getState().notes[key] = norm(fd.get("note"));
      save();
      toast("یادداشت ذخیره شد", "ok");
    },
  },
};

// ------------------------------------------------------------------ reminders

function reason(r) {
  if (r.type === "occasion") {
    return `${r.label ? esc(r.label) + "، " : ""}پارسال ${jDay(r.order.needBy)}: ${itemsText(r.order.items)}. ${r.days > 0 ? `${fa(r.days)} روز دیگر` : r.days === 0 ? "امروز" : "دیروز"}`;
  }
  return r.entries.map((e) => `${fa(Math.round((now() - e.order.createdAt) / DAY))} روز از خرید ${esc(e.product.name)} گذشته؛ معمولاً هر ${fa(e.product.cycle)} روز تمام می‌شود.`).join("<br>");
}

export const reminderPage = {
  render() {
    const list = reminders();
    return `<div class="page narrow">
      <div class="page-h"><h1>یادآور خرید دوباره</h1><span class="muted">${fa(list.length)} مورد</span></div>
      <p class="muted">از روی چرخه‌ی هر محصول (در «محصولات» تنظیم می‌شود) و تاریخ مناسبت‌های سال قبل ساخته می‌شود. پیام همراه لینک فرم پیش‌پر است؛ مشتری با یک تأیید دوباره سفارش می‌دهد.</p>
      ${list.length ? list.map((r, i) => `<section class="card reminder ${r.days <= 0 ? "due" : ""}">
        <div class="page-h"><div><b>${esc(r.customer.name)}</b> <span class="badge ${r.type === "occasion" ? "violet" : r.days <= 0 ? "amber" : ""}">${r.type === "occasion" ? "مناسبت" : r.days < 0 ? `${fa(-r.days)} روز گذشته` : r.days === 0 ? "امروز" : `${fa(r.days)} روز دیگر`}</span></div>
          <a class="muted small" href="#/c/${encodeURIComponent(r.customer.key)}">پرونده‌ی مشتری</a></div>
        <p class="small">${reason(r)}</p>
        ${sendPanel("rem-" + i, { phone: r.customer.phone, title: "پیام یادآوری" })}
        <div class="row-actions">
          <button class="btn small" data-act="rem-done" data-key="${esc(r.key)}">${icon("check")} پیام دادم</button>
          <button class="btn small ghost" data-act="rem-snooze" data-key="${esc(r.key)}">بعداً (۷ روز)</button>
        </div>
      </section>`).join("") : empty("امروز یادآوری‌ای نیست.", "وقتی خرید مشتری‌ها به چرخه‌ی محصول برسد، اینجا ظاهر می‌شوند.")}
    </div>`;
  },
  async mount(root) {
    const st = getState();
    const list = reminders();
    await Promise.all(list.map(async (r, i) => {
      const items = r.type === "cycle" ? r.items : r.order.items;
      const link = await orderFormLink(st.shop, st.products, { customer: r.customer, items, specs: r.customer.specs });
      fillSend(root, "rem-" + i, reminderMessage(r, st.shop, link));
    }));
  },
  actions: {
    "rem-done"(el, ev, root, arg, rerender) {
      markReminder(el.dataset.key, { done: true, at: now() });
      toast("ثبت شد", "ok");
      rerender();
    },
    "rem-snooze"(el, ev, root, arg, rerender) {
      markReminder(el.dataset.key, { snoozeUntil: now() + 7 * DAY });
      toast("۷ روز دیگر دوباره یادآوری می‌شود");
      rerender();
    },
  },
};
