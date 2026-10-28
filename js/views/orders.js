// Seller: order board, order detail, receiving an order from a DM, quick add from chat text, and the order editor.

import { esc, fa, toman, ltr, ago, norm, phoneKey, igHandle, toInt, shortId, now, copyText, smsHref } from "../util.js";
import { jDateTime, jDay, fromJalali } from "../jalali.js";
import { decode, findLink } from "../codec.js";
import { readIncoming, statusLink, statusMessage, itemsLine } from "../links.js";
import {
  getState, save, STATUS, FLOW, OPEN, orderById, addOrder, setStatus, isOverdue, dueSoon, priorOrders,
  customers, customerKey, computeTotals, productById, orderProfit,
} from "../store.js";
import { parseChat } from "../parse.js";
import { icon, toast, chip, badges, orderCard, sendPanel, fillSend, empty, datePicker, readDate, ordinal, itemsText } from "../ui.js";

export const go = (h) => { location.hash = h; };

// A draft order handed from quick-add / customer profile to the editor.
let draft = null;
export const setDraft = (d) => { draft = d; };

// ------------------------------------------------------------------ board

const COLS = ["new", "paid", "making", "shipped"];

function sortCol(st, list) {
  const urgent = (o) => (isOverdue(o) || dueSoon(o) ? 0 : 1);
  return list.sort((a, b) => urgent(a) - urgent(b) || (st === "shipped" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
}

function matches(o, q) {
  if (!q) return true;
  const hay = norm([o.id, o.customer.name, o.customer.phone, o.customer.ig, o.customer.city, ...o.items.map((i) => i.name)].join(" ")).toLowerCase();
  return norm(q).toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function boardBody(q) {
  const { orders } = getState();
  const cols = COLS.map((st) => {
    const list = sortCol(st, orders.filter((o) => o.status === st && matches(o, q)));
    return `<section class="col" data-col="${st}">
      <h3 class="col-h">${STATUS[st].short} <span class="count">${fa(list.length)}</span></h3>
      ${list.length ? list.map(orderCard).join("") : `<div class="col-empty">خالی</div>`}
    </section>`;
  }).join("");
  const archived = orders.filter((o) => (o.status === "done" || o.status === "cancelled") && matches(o, q)).sort((a, b) => b.createdAt - a.createdAt);
  return { cols, archived };
}

export const board = {
  render(arg) {
    const st = getState();
    const active = COLS.includes(arg) ? arg : sessionStorage.getItem("board-tab") || (st.orders.some(isOverdue) ? "paid" : "new");
    const counts = Object.fromEntries(COLS.map((s) => [s, st.orders.filter((o) => o.status === s).length]));
    const urgentIn = (s) => st.orders.some((o) => o.status === s && (isOverdue(o) || dueSoon(o)));
    const { cols, archived } = boardBody("");
    return `<div class="page">
      <div class="page-h">
        <h1>سفارش‌ها</h1>
        <div class="row-actions">
          <a class="btn primary" href="#/receive">${icon("inbox")} دریافت از دایرکت</a>
          <a class="btn" href="#/new">${icon("plus")} سفارش دستی</a>
        </div>
      </div>
      <div class="search">${icon("search")}<input id="board-q" type="search" placeholder="جستجو: نام، موبایل، کد سفارش، محصول" aria-label="جستجوی سفارش"></div>
      <div class="tabs" role="tablist">
        ${COLS.map((s) => `<button role="tab" class="tab ${s === active ? "on" : ""}" data-act="tab" data-tab="${s}" aria-selected="${s === active}">
          ${STATUS[s].short} <span class="count ${urgentIn(s) ? "hot" : ""}">${fa(counts[s])}</span></button>`).join("")}
      </div>
      <div class="kanban" id="kanban" data-active="${active}">${cols}</div>
      <details class="archive"><summary>بایگانی: تحویل‌شده و لغوشده (${fa(archived.length)})</summary>
        <div class="archive-list" id="archive">${archived.slice(0, 60).map(archiveRow).join("")}</div>
      </details>
    </div>`;
  },
  mount(root) {
    const q = root.querySelector("#board-q");
    q.addEventListener("input", () => {
      const { cols, archived } = boardBody(q.value);
      root.querySelector("#kanban").innerHTML = cols;
      root.querySelector("#archive").innerHTML = archived.slice(0, 60).map(archiveRow).join("");
    });
  },
  actions: {
    tab(el, ev, root) {
      const t = el.dataset.tab;
      sessionStorage.setItem("board-tab", t);
      root.querySelector("#kanban").dataset.active = t;
      root.querySelectorAll(".tab").forEach((b) => { b.classList.toggle("on", b === el); b.setAttribute("aria-selected", b === el); });
    },
  },
};

const archiveRow = (o) => `<a class="arow" href="#/order/${esc(o.id)}"><span>${esc(o.customer.name)}</span><span class="muted">${itemsText(o.items)}</span><span class="muted">${jDay(o.createdAt)}</span>${chip(o.status)}</a>`;

// ------------------------------------------------------------------ order detail

const SOURCE = { link: "از لینک سفارش (مشتری خودش پر کرد)", quick: "ثبت سریع از متن چت", manual: "ثبت دستی" };

function nextStep(o) {
  switch (o.status) {
    case "new":
      return `<div class="next">
        <div><b>قدم بعد:</b> واریز را بررسی کنید.${o.payRef ? ` نشانه‌ی واریز از مشتری: <b>${esc(o.payRef)}</b>` : ""}</div>
        <button class="btn primary" data-act="set-status" data-s="paid">${icon("check")} واریز تأیید شد</button>
      </div>`;
    case "paid":
    case "making":
      return `<form class="next" data-form="ship">
        <div><b>قدم بعد:</b> ${o.status === "paid" ? "آماده‌سازی و ارسال." : "ارسال."} کد رهگیری را بنویسید تا خودکار در پیام مشتری قرار بگیرد.</div>
        <label>کد رهگیری <span class="opt">اختیاری برای پیک</span><input name="tracking" dir="ltr" inputmode="numeric" value="${esc(o.tracking || "")}"></label>
        <div class="row-actions">
          <button class="btn primary" type="submit">${icon("box")} ارسال شد</button>
          ${o.status === "paid" ? `<button class="btn" type="button" data-act="set-status" data-s="making">شروع آماده‌سازی</button>` : ""}
        </div>
      </form>`;
    case "shipped":
      return `<div class="next"><div><b>قدم بعد:</b> وقتی رسید، سفارش را ببندید.</div><button class="btn" data-act="set-status" data-s="done">${icon("check")} تحویل شد</button></div>`;
    case "cancelled":
      return `<div class="next"><div>این سفارش لغو شده است.</div><button class="btn" data-act="set-status" data-s="new">بازگرداندن سفارش</button></div>`;
    default:
      return "";
  }
}

export const orderDetail = {
  render(id) {
    const o = orderById(id);
    if (!o) return empty("این سفارش پیدا نشد.", `<a href="#/board">بازگشت به سفارش‌ها</a>`);
    const st = getState();
    const prior = priorOrders(o).sort((a, b) => b.createdAt - a.createdAt);
    const c = o.customer;
    const ck = customerKey(c);
    const note = st.notes[ck];
    const prof = orderProfit(o);
    const fields = st.shop.customFields;
    const specRows = Object.entries(o.specs || {}).filter(([, v]) => v).map(([k, v]) => `<div class="kv"><span>${esc(fields.find((f) => f.id === k)?.label || k)}</span><b>${esc(v)}</b></div>`).join("");
    return `<div class="page narrow">
      <a class="back" href="#/board">${icon("back")} سفارش‌ها</a>
      <div class="page-h">
        <h1>سفارش ${ltr(o.id)} ${chip(o.status)}</h1>
        <div class="muted small">${jDateTime(o.createdAt)} · ${SOURCE[o.source] || ""}</div>
      </div>
      ${badges(o) ? `<div class="badges">${badges(o)}</div>` : ""}
      ${nextStep(o)}

      <section class="card">
        <h2>به مشتری خبر بدهید</h2>
        ${sendPanel("status-msg", { phone: c.phone, title: `پیام «${STATUS[o.status].label}»`, hint: "متن همراه لینک وضعیت سفارش است؛ مشتری بدون پرسیدن، وضعیت و کد رهگیری را می‌بیند." })}
      </section>

      <section class="card">
        <h2>مشتری</h2>
        <div class="cust-line"><b>${esc(c.name || "بی‌نام")}</b> ${prior.length ? `<a class="badge green" href="#/c/${encodeURIComponent(ck)}">مشتری قدیمی · ${fa(prior.length)} خرید قبلی</a>` : `<span class="badge">مشتری جدید</span>`}</div>
        <div class="contact">
          ${c.phone ? `<a class="btn small" href="tel:${esc(c.phone)}">${icon("phone")} ${ltr(c.phone)}</a>` : ""}
          ${c.ig ? `<a class="btn small ghost" href="https://instagram.com/${esc(igHandle(c.ig))}" target="_blank" rel="noopener">${icon("insta")} ${ltr("@" + igHandle(c.ig))}</a>` : ""}
        </div>
        ${c.address ? `<div class="addr"><div>${esc(c.city ? c.city + "، " : "")}${esc(c.address)}${c.postal ? ` · کد پستی ${ltr(c.postal)}` : ""}</div>
          <button class="btn small ghost" data-act="copy-addr">${icon("copy")} کپی آدرس</button></div>` : ""}
        ${note ? `<div class="note-box">${icon("edit")} ${esc(note)}</div>` : ""}
        ${prior.length ? `<div class="prior"><div class="muted small">دفعه‌های قبل:</div>${prior.slice(0, 3).map((p) => `<div class="prow-mini"><span>${jDay(p.createdAt)}</span><span>${itemsText(p.items)}</span></div>`).join("")}</div>` : ""}
      </section>

      <section class="card">
        <h2>اقلام</h2>
        ${o.items.map((it) => `<div class="sum-row"><span>${fa(it.qty)}× ${esc(it.name)}</span><b>${toman(it.price * it.qty)}</b></div>`).join("")}
        <div class="sum-row"><span>ارسال (${esc(o.shipName || "")})</span><b>${o.freeShip ? '<span class="free">رایگان</span>' : toman(o.shipFee)}</b></div>
        <div class="sum-row total"><span>مبلغ کل</span><b>${toman(o.total)}</b></div>
        ${prof.known ? `<div class="muted small">سود تقریبی این سفارش: <b class="${prof.profit < 0 ? "neg" : "pos"}">${toman(prof.profit)}</b>${prof.shipLoss ? ` (با ${toman(prof.shipLoss)} هزینه‌ی ارسال رایگان)` : ""}</div>` : ""}
        ${specRows || o.needBy ? `<div class="specs">${specRows}${o.needBy ? `<div class="kv"><span>تاریخ لازم</span><b>${jDay(o.needBy)}</b></div>` : ""}</div>` : ""}
        ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ""}
        ${o.payRef ? `<div class="muted small">نشانه‌ی واریز: ${esc(o.payRef)}</div>` : ""}
        ${o.tracking ? `<div class="muted small">کد رهگیری: ${ltr(o.tracking)}</div>` : ""}
      </section>

      <section class="card">
        <h2>تاریخچه</h2>
        <ol class="hist">${(o.history || []).map((h) => `<li>${chip(h.s)} <span class="muted small">${jDateTime(h.t)}</span></li>`).join("")}</ol>
      </section>

      <div class="row-actions end">
        <a class="btn ghost" href="#/edit/${esc(o.id)}">${icon("edit")} ویرایش</a>
        ${o.status !== "cancelled" && o.status !== "done" ? `<button class="btn ghost" data-act="set-status" data-s="cancelled">لغو سفارش</button>` : ""}
        <button class="btn ghost danger" data-act="delete-order">${icon("trash")} حذف</button>
      </div>
    </div>`;
  },
  async mount(root, id) {
    const o = orderById(id);
    if (!o) return;
    const link = await statusLink(o, getState().shop);
    fillSend(root, "status-msg", statusMessage(o, getState().shop, link));
  },
  actions: {
    "set-status"(el, ev, root, id) {
      const o = orderById(id);
      setStatus(o, el.dataset.s);
      toast(`وضعیت: ${STATUS[o.status].label}. حالا به مشتری خبر بدهید.`, "ok");
      rerender();
      setTimeout(() => document.querySelector("#status-msg")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    },
    async "copy-addr"(el, ev, root, id) {
      const c = orderById(id).customer;
      const text = [c.name, c.phone, [c.city, c.address].filter(Boolean).join("، "), c.postal && `کد پستی ${c.postal}`].filter(Boolean).join("\n");
      toast((await copyText(text)) ? "نام، موبایل و آدرس کپی شد" : "کپی نشد", "ok");
    },
    "delete-order"(el, ev, root, id) {
      if (!confirm("این سفارش برای همیشه حذف شود؟")) return;
      const st = getState();
      st.orders = st.orders.filter((o) => o.id !== id);
      save();
      toast("حذف شد");
      go("#/board");
    },
  },
  forms: {
    ship(f, fd, root, id) {
      const o = orderById(id);
      o.tracking = norm(fd.get("tracking")).replace(/\s/g, "");
      setStatus(o, "shipped");
      toast("ارسال ثبت شد. پیام ارسال با کد رهگیری آماده است.", "ok");
      rerender();
      setTimeout(() => document.querySelector("#status-msg")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    },
  },
};

let rerender = () => {};
export const setRerender = (fn) => { rerender = fn; };

// ------------------------------------------------------------------ receive an order pasted from a DM (or opened via #i=)

let incoming = null;   // decoded incoming order waiting for confirmation
let pasted = "";

async function readPasted(text) {
  const l = findLink(text, "i");
  if (!l) return null;
  return readIncoming(await decode(l.payload));
}

function incomingPreview(o) {
  const st = getState();
  const dup = orderById(o.id);
  const prior = st.orders.filter((x) => customerKey(x.customer) === customerKey(o.customer) && x.status !== "cancelled").sort((a, b) => b.createdAt - a.createdAt);
  const wrongShop = o.handle && st.shop.handle && igHandle(o.handle) !== igHandle(st.shop.handle);
  const fields = st.shop.customFields;
  return `<section class="card incoming">
    <div class="page-h"><h2>سفارش ${ltr(o.id)}</h2><span class="muted small">${jDateTime(o.createdAt)}</span></div>
    ${dup ? `<div class="hello soft">این سفارش قبلاً در دفترچه ثبت شده. <a href="#/order/${esc(o.id)}">دیدن سفارش</a></div>` : ""}
    ${wrongShop ? `<div class="hello bad">این سفارش برای ${ltr("@" + o.handle)} است، نه ${ltr("@" + st.shop.handle)}.</div>` : ""}
    <div class="cust-line"><b>${esc(o.customer.name)}</b> ${ltr(o.customer.phone)}
      ${prior.length ? `<span class="badge green">مشتری قدیمی · سفارش ${ordinal(prior.length + 1)}</span>` : `<span class="badge">مشتری جدید</span>`}</div>
    ${prior.length ? `<div class="muted small">دفعه‌ی قبل (${jDay(prior[0].createdAt)}): ${itemsText(prior[0].items)}</div>` : ""}
    <div class="muted small">${esc(o.customer.city)}، ${esc(o.customer.address)}</div>
    <div class="items-mini">${o.items.map((it) => `<div class="sum-row"><span>${fa(it.qty)}× ${esc(it.name)}</span><b>${toman(it.price * it.qty)}</b></div>`).join("")}
      <div class="sum-row total"><span>مبلغ کل${o.freeShip ? " (ارسال رایگان)" : ""}</span><b>${toman(o.total)}</b></div></div>
    ${Object.entries(o.specs || {}).map(([k, v]) => `<div class="kv"><span>${esc(fields.find((f) => f.id === k)?.label || k)}</span><b>${esc(v)}</b></div>`).join("")}
    ${o.needBy ? `<div class="kv"><span>تاریخ لازم</span><b>${jDay(o.needBy)}</b></div>` : ""}
    ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ""}
    ${o.payRef ? `<div class="muted small">نشانه‌ی واریز: ${esc(o.payRef)}</div>` : ""}
    ${dup ? "" : `<button class="btn primary block big" data-act="add-incoming">${icon("plus")} افزودن به دفترچه</button>`}
  </section>`;
}

export const receive = {
  async load(payload) {
    incoming = payload ? readIncoming(await decode(payload)) : null;
  },
  render() {
    return `<div class="page narrow">
      <div class="page-h"><h1>دریافت سفارش از دایرکت</h1></div>
      ${incoming ? incomingPreview(incoming) : `
      <p class="muted">پیامی را که مشتری بعد از پر کردن فرم در دایرکت فرستاده کپی کنید و اینجا بچسبانید. اگر پیام لینک دفترچه ندارد (مثلاً مشتری خودش تایپ کرده)، با «ثبت سریع» از همان متن سفارش بسازید.</p>
      <form data-form="paste" class="card">
        <textarea name="text" rows="6" placeholder="پیام مشتری را اینجا بچسبانید…" aria-label="متن پیام مشتری">${esc(pasted)}</textarea>
        <div class="row-actions">
          <button type="button" class="btn" data-act="paste-clip">${icon("copy")} چسباندن از کلیپ‌بورد</button>
          <button type="submit" class="btn primary">بررسی پیام</button>
        </div>
        <div id="paste-result"></div>
      </form>`}
    </div>`;
  },
  actions: {
    async "paste-clip"(el, ev, root) {
      try {
        const t = await navigator.clipboard.readText();
        root.querySelector('textarea[name="text"]').value = t;
        root.querySelector('form[data-form="paste"]').requestSubmit();
      } catch {
        toast("مرورگر اجازه‌ی خواندن کلیپ‌بورد نداد؛ با نگه داشتن انگشت بچسبانید", "bad");
      }
    },
    "add-incoming"() {
      const { order, duplicate } = addOrder({ ...incoming, status: "new" });
      incoming = null;
      pasted = "";
      toast(duplicate ? "این سفارش از قبل بود" : "سفارش به دفترچه اضافه شد", "ok");
      go(`#/order/${order.id}`);
    },
    "to-quick"() {
      go("#/quick");
    },
  },
  forms: {
    async paste(f, fd, root) {
      const text = String(fd.get("text") || "");
      pasted = text;
      const out = root.querySelector("#paste-result");
      if (!text.trim()) { out.innerHTML = ""; return; }
      try {
        const o = await readPasted(text);
        if (o) {
          incoming = o;
          rerender();
          return;
        }
      } catch {
        out.innerHTML = `<div class="hello bad">لینک داخل پیام ناقص است؛ احتمالاً موقع کپی بریده شده. کل پیام را دوباره کپی کنید.</div>`;
        return;
      }
      quickText = text;
      out.innerHTML = `<div class="hello soft">${icon("wand")} <div>در این پیام لینک دفترچه نبود. می‌توانید از همین متن با «ثبت سریع» سفارش بسازید.
        <button type="button" class="btn small primary" data-act="to-quick">ثبت سریع از این متن</button></div></div>`;
    },
  },
};

// ------------------------------------------------------------------ quick add from chat text

let quickText = "";

export const quick = {
  render() {
    return `<div class="page narrow">
      <div class="page-h"><h1>ثبت سریع از متن چت</h1></div>
      <p class="muted">وقتی مشتری فرم را پر نمی‌کند: پیام‌های دایرکت را کپی کنید و اینجا بچسبانید. نام، موبایل، آدرس، محصول‌ها و تعدادشان از متن بیرون کشیده می‌شود تا فقط بررسی و ذخیره کنید.</p>
      <form data-form="extract" class="card">
        <textarea name="text" rows="8" placeholder="مثلاً: سلام دو تا صابون زغال می‌خوام با یه شامپو بار. آدرس: تهران، خیابان … به اسم … ۰۹۱۲…" aria-label="متن چت">${esc(quickText)}</textarea>
        <div class="row-actions"><button class="btn primary" type="submit">${icon("wand")} استخراج سفارش</button>
          <button type="button" class="btn ghost" data-act="sample-chat">نمونه‌ی متن</button></div>
      </form>
    </div>`;
  },
  actions: {
    "sample-chat"(el, ev, root) {
      const p = getState().products;
      const a = p[1]?.name || "صابون", b = p[2]?.name || "شامپو بار";
      root.querySelector('textarea[name="text"]').value = `سلام وقتتون بخیر 🌸\nدو تا ${a} می‌خوام با یه ${b}\nآدرس: تهران، خیابان شریعتی، کوچه یاس، پلاک ۱۲، واحد ۳\nبه اسم سارا یزدی\n۰۹۱۲ ۰۰۰ ۰۱۹۹`;
    },
  },
  forms: {
    extract(f, fd) {
      quickText = String(fd.get("text") || "");
      const r = parseChat(quickText, getState().products);
      setDraft({ ...r, source: "quick", found: r.found });
      go("#/new");
    },
  },
};

// ------------------------------------------------------------------ order editor (new / edit)

let edit = null; // working copy {customer, cart, shipId, specs, needBy, note, payRef, status, source, id?}

function startEdit(id) {
  const st = getState();
  if (id) {
    const o = orderById(id);
    if (!o) return null;
    return { id, customer: { ...o.customer }, cart: Object.fromEntries(o.items.map((i) => [i.pid, i.qty])), shipId: o.shipId, specs: { ...o.specs }, needBy: o.needBy, note: o.note, payRef: o.payRef, status: o.status, source: o.source };
  }
  const d = draft || {};
  draft = null;
  return {
    customer: { name: "", phone: "", ig: "", city: "", address: "", postal: "", ...(d.customer || {}) },
    cart: Object.fromEntries((d.items || []).map((i) => [i.pid, i.qty])),
    shipId: st.shop.shipping[0]?.id, specs: d.specs || {}, needBy: null, note: d.note || "", payRef: "", status: "new",
    source: d.source || "manual", found: d.found,
  };
}

function editorItems() {
  const st = getState();
  return st.products.filter((p) => p.active !== false || edit.cart[p.id]).map((p) => `<div class="prow ${edit.cart[p.id] ? "on" : ""}">
    <div class="pinfo"><div class="pname">${esc(p.name)}</div><div class="muted">${toman(p.price)}</div></div>
    <div class="stepper">
      <button type="button" class="sbtn" data-act="ed-qty" data-pid="${p.id}" data-d="1" aria-label="بیشتر">+</button>
      <span class="sqty">${fa(edit.cart[p.id] || 0)}</span>
      <button type="button" class="sbtn" data-act="ed-qty" data-pid="${p.id}" data-d="-1" aria-label="کمتر">−</button>
    </div></div>`).join("");
}

function knownCustomerBox(phone) {
  const k = phoneKey(phone);
  if (!k) return "";
  const c = customers().find((x) => x.key === k);
  if (!c || (edit.id && c.orders.every((o) => o.id === edit.id))) return "";
  const last = c.lastOrder;
  return `<div class="hello">${icon("users")} <div><b>${esc(c.name)}</b> را می‌شناسیم: ${fa(c.count)} خرید قبلی، آخری ${ago(last.createdAt)} (${itemsText(last.items)}).
    <button type="button" class="btn small" data-act="ed-repeat" data-key="${esc(k)}">همان سفارش قبلی</button></div></div>`;
}

export const editor = {
  render(id) {
    edit = startEdit(id);
    if (!edit) return empty("سفارش پیدا نشد.");
    const st = getState();
    const c = edit.customer;
    const v = (k) => esc(c[k] || "");
    return `<div class="page narrow">
      <a class="back" href="${id ? `#/order/${esc(id)}` : "#/board"}">${icon("back")} بازگشت</a>
      <div class="page-h"><h1>${id ? `ویرایش سفارش ${ltr(id)}` : edit.source === "quick" ? "بررسی سفارش استخراج‌شده" : "سفارش دستی"}</h1></div>
      ${edit.found ? `<div class="hello soft">${icon("wand")} <div>${edit.found.length ? `از متن پیدا شد: <b>${edit.found.join("، ")}</b>. بقیه را کامل کنید.` : "چیزی از متن پیدا نشد؛ دستی کامل کنید."}</div></div>` : ""}
      <form data-form="save-order" class="card">
        <h2>مشتری</h2>
        <div class="grid2">
          <label>موبایل<input name="phone" dir="ltr" inputmode="tel" value="${v("phone")}" placeholder="09…" data-live="phone"></label>
          <label>نام<input name="name" value="${v("name")}"></label>
        </div>
        <div id="known">${knownCustomerBox(c.phone)}</div>
        <div class="grid2">
          <label>آیدی اینستاگرام<input name="ig" dir="ltr" value="${v("ig")}"></label>
          <label>شهر<input name="city" value="${v("city")}"></label>
        </div>
        <label>آدرس<textarea name="address" rows="2">${v("address")}</textarea></label>
        <label>کد پستی<input name="postal" dir="ltr" inputmode="numeric" value="${v("postal")}"></label>

        <h2>اقلام</h2>
        <div class="plist" id="ed-items">${editorItems()}</div>
        <label>روش ارسال<select name="ship">${st.shop.shipping.map((m) => `<option value="${esc(m.id)}" ${m.id === edit.shipId ? "selected" : ""}>${esc(m.name)}، ${toman(m.fee)}</option>`).join("")}</select></label>
        ${st.shop.customFields.map((f) => `<label>${esc(f.label)}<input name="sp_${esc(f.id)}" value="${esc(edit.specs[f.id] || "")}"></label>`).join("")}
        ${st.shop.askDate ? `<div class="field"><span class="flabel">تاریخ لازم</span>${datePicker("needby", edit.needBy)}</div>` : ""}
        <label>یادداشت<textarea name="note" rows="2">${esc(edit.note || "")}</textarea></label>
        ${id ? "" : `<label>وضعیت<select name="status"><option value="new">منتظر واریز</option><option value="paid">واریز شده</option></select></label>`}
        <button class="btn primary block big" type="submit">${id ? "ذخیره‌ی تغییرات" : "ثبت در دفترچه"}</button>
      </form>
    </div>`;
  },
  mount(root) {
    const ph = root.querySelector('[data-live="phone"]');
    ph?.addEventListener("input", () => {
      edit.customer.phone = ph.value;
      root.querySelector("#known").innerHTML = knownCustomerBox(ph.value);
      // fill empty fields from the customer's history as soon as the number is recognised
      const c = customers().find((x) => x.key === phoneKey(ph.value));
      if (c) for (const k of ["name", "ig", "city", "address", "postal"]) {
        const inp = root.querySelector(`[name="${k}"]`);
        if (inp && !inp.value && c[k]) inp.value = c[k];
      }
    });
  },
  actions: {
    "ed-qty"(el, ev, root) {
      const pid = el.dataset.pid;
      edit.cart[pid] = Math.max(0, (edit.cart[pid] || 0) + +el.dataset.d);
      root.querySelector("#ed-items").innerHTML = editorItems();
    },
    "ed-repeat"(el, ev, root) {
      const c = customers().find((x) => x.key === el.dataset.key);
      edit.cart = Object.fromEntries(c.lastOrder.items.map((i) => [i.pid, i.qty]));
      root.querySelector("#ed-items").innerHTML = editorItems();
      toast("اقلام سفارش قبلی گذاشته شد", "ok");
    },
  },
  forms: {
    "save-order"(f, fd) {
      const st = getState();
      const items = st.products.filter((p) => edit.cart[p.id] > 0).map((p) => ({ pid: p.id, name: p.name, price: p.price, qty: edit.cart[p.id] }));
      if (!items.length) return toast("دست‌کم یک محصول انتخاب کنید", "bad");
      const customer = {
        name: norm(fd.get("name")), phone: phoneKey(fd.get("phone")) || norm(fd.get("phone")), ig: igHandle(fd.get("ig")),
        city: norm(fd.get("city")), address: norm(fd.get("address")), postal: norm(fd.get("postal")),
      };
      if (!customer.name && !customer.phone) return toast("نام یا موبایل مشتری را بنویسید", "bad");
      const specs = {};
      for (const fl of st.shop.customFields) { const val = norm(fd.get("sp_" + fl.id)); if (val) specs[fl.id] = val; }
      const shipId = fd.get("ship");
      const fields = { customer, items, shipId, ...computeTotals(items, shipId), specs, needBy: st.shop.askDate ? readDate(fd, "needby", fromJalali) : null, note: norm(fd.get("note")) };
      if (edit.id) {
        Object.assign(orderById(edit.id), fields);
        save();
        toast("ذخیره شد", "ok");
        go(`#/order/${edit.id}`);
      } else {
        const status = fd.get("status") || "new";
        const { order } = addOrder({ id: shortId(), createdAt: now(), source: edit.source, ...fields });
        if (status === "paid") setStatus(order, "paid");
        toast("سفارش ثبت شد", "ok");
        go(`#/order/${order.id}`);
      }
    },
  },
};
