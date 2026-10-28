// Shared UI pieces. Views return HTML strings; behaviour is wired through data-act attributes (see main.js).

import { esc, fa, num, toman, ltr, ago, smsHref, copyText, daysBetween, now } from "./util.js";
import { STATUS, isOverdue, dueSoon, waitingTooLong, priorOrders } from "./store.js";
import { jDay, MONTHS, toJalali, monthLength } from "./jalali.js";

export const icon = (name) => {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.5 3.5 5.2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    sms: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    back: '<path d="m9 6 6 6-6 6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    wand: '<path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6z"/>',
    insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
};

// ------------------------------------------------------------------ toast

let toastTimer;
export function toast(msg, tone = "") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.className = `toast show ${tone}`;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2600);
}

// ------------------------------------------------------------------ chips & cards

export const chip = (status) => `<span class="chip tone-${STATUS[status]?.tone || "gray"}">${STATUS[status]?.label || status}</span>`;

export function badges(o) {
  const b = [];
  if (isOverdue(o)) {
    const paidAt = o.paidAt || o.createdAt;
    b.push(`<span class="badge red">${icon("alert")} ${fa(Math.floor((now() - paidAt) / 86400000))} روز از واریز، هنوز ارسال نشده</span>`);
  }
  if (dueSoon(o)) {
    const d = daysBetween(now(), o.needBy);
    b.push(`<span class="badge red">${icon("clock")} ${d <= 0 ? "تحویل امروز" : `تحویل تا ${fa(d)} روز دیگر`} (${jDay(o.needBy)})</span>`);
  }
  if (waitingTooLong(o)) b.push(`<span class="badge amber">${fa(Math.floor((now() - o.createdAt) / 86400000))} روز منتظر واریز</span>`);
  const prior = priorOrders(o).length;
  if (prior) b.push(`<span class="badge green">مشتری قدیمی · سفارش ${ordinal(prior + 1)}</span>`);
  return b.join("");
}

export function ordinal(n) {
  const w = ["", "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم"];
  return w[n] || `${fa(n)}ام`;
}

export const itemsText = (items) => items.map((it) => `${fa(it.qty)}× ${esc(it.name)}`).join("، ");

export function orderCard(o) {
  return `<a class="card order-card ${isOverdue(o) || dueSoon(o) ? "urgent" : ""}" href="#/order/${esc(o.id)}">
    <div class="oc-top"><span class="oc-name">${esc(o.customer.name || "بی‌نام")}</span><span class="oc-id">${ltr(o.id)}</span></div>
    <div class="oc-items">${itemsText(o.items)}</div>
    <div class="oc-bottom"><span class="oc-total">${toman(o.total)}</span><span class="muted">${ago(o.createdAt)}</span></div>
    ${badges(o) ? `<div class="badges">${badges(o)}</div>` : ""}
  </a>`;
}

// ------------------------------------------------------------------ "send to customer" panel
// The text is filled in after render (links are built asynchronously): see fillSend().

export function sendPanel(id, { phone = "", title = "پیام آماده", hint = "" } = {}) {
  return `<div class="send" id="${id}" data-phone="${esc(phone)}">
    <div class="send-h">${icon("sms")} ${esc(title)}</div>
    ${hint ? `<p class="muted small">${hint}</p>` : ""}
    <textarea class="send-text" rows="4" readonly aria-label="${esc(title)}">در حال ساختن لینک…</textarea>
    <div class="send-actions">
      ${phone ? `<a class="btn" data-role="sms" href="#">${icon("sms")} پیامک</a>` : ""}
      <button class="btn" data-act="copy-send" data-target="${id}">${icon("copy")} کپی برای دایرکت</button>
      <button class="btn ghost" data-act="share-send" data-target="${id}">${icon("share")} اشتراک</button>
    </div>
  </div>`;
}

export function fillSend(root, id, text) {
  const el = root.querySelector(`#${id}`);
  if (!el) return;
  el.querySelector(".send-text").value = text;
  const sms = el.querySelector('[data-role="sms"]');
  if (sms) sms.href = smsHref(el.dataset.phone, text);
}

export async function copyFrom(id) {
  const el = document.getElementById(id);
  const ok = await copyText(el.querySelector(".send-text, input, textarea")?.value || "");
  toast(ok ? "کپی شد؛ در دایرکت بچسبانید" : "کپی نشد؛ متن را دستی انتخاب کنید", ok ? "ok" : "bad");
}

export async function shareFrom(id) {
  const el = document.getElementById(id);
  const text = el.querySelector(".send-text, input, textarea")?.value || "";
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  await copyFrom(id);
}

// ------------------------------------------------------------------ Jalali date picker (three selects, never <input type=date>)

export function datePicker(name, value, { allowEmpty = true, label = "" } = {}) {
  const today = toJalali(now());
  const j = value ? toJalali(value) : null;
  const years = [today.jy, today.jy + 1];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const opt = (v, text, sel) => `<option value="${v}" ${sel ? "selected" : ""}>${text}</option>`;
  return `<div class="datepick" data-name="${esc(name)}" role="group" aria-label="${esc(label)}">
    <select name="${name}_d" aria-label="روز">${allowEmpty ? opt("", "روز", !j) : ""}${days.map((d) => opt(d, fa(d), j?.jd === d)).join("")}</select>
    <select name="${name}_m" aria-label="ماه">${allowEmpty ? opt("", "ماه", !j) : ""}${MONTHS.map((m, i) => opt(i + 1, m, j?.jm === i + 1)).join("")}</select>
    <select name="${name}_y" aria-label="سال">${years.map((y) => opt(y, fa(y), (j?.jy || today.jy) === y)).join("")}</select>
  </div>`;
}

/** Read a datePicker back from a FormData; returns a timestamp or null. */
export function readDate(fd, name, fromJalali) {
  const d = +fd.get(`${name}_d`), m = +fd.get(`${name}_m`), y = +fd.get(`${name}_y`);
  if (!d || !m || !y) return null;
  return fromJalali(y, m, Math.min(d, monthLength(y, m)));
}

export const money = (n) => `<span class="money">${num(n)}</span> <span class="unit">تومان</span>`;

export function empty(text, sub = "") {
  return `<div class="empty"><div class="empty-t">${text}</div>${sub ? `<div class="muted">${sub}</div>` : ""}</div>`;
}
