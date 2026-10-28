// Pages the customer sees: the order form (#o=), the "send it to the seller" step, and the status page (#s=).

import { esc, fa, num, toman, ltr, phoneKey, igHandle, norm, toInt, shortId, now, cardFmt, copyText } from "../util.js";
import { jDateTime, jDay, fromJalali } from "../jalali.js";
import { decode } from "../codec.js";
import { readOrderForm, incomingLink, incomingMessage, readStatus } from "../links.js";
import { loadMe, saveMe, getState, hasShop, STATUS, FLOW } from "../store.js";
import { icon, toast, datePicker, readDate } from "../ui.js";

let form = null;      // decoded order-form payload currently on screen
let cart = {};        // pid -> qty
let lastSent = null;  // {order, text, link, shop}

function shopHeader(shop) {
  const initial = esc((shop.name || "?").trim()[0] || "?");
  return `<header class="pub-head">
    <div class="avatar">${initial}</div>
    <div><h1>${esc(shop.name)}</h1>${shop.handle ? `<div class="muted">${ltr("@" + shop.handle)}</div>` : ""}</div>
  </header>`;
}

function totals() {
  const { shop, products } = form;
  const items = products.filter((p) => cart[p.id] > 0).map((p) => ({ pid: p.id, name: p.name, price: p.price, qty: cart[p.id] }));
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipId = document.querySelector('input[name="ship"]:checked')?.value || shop.shipping[0]?.id;
  const method = shop.shipping.find((m) => m.id === shipId) || shop.shipping[0];
  const freeShip = !!(shop.freeShipMin && subtotal >= shop.freeShipMin);
  const shipFee = !items.length ? 0 : freeShip ? 0 : method?.fee || 0;
  return { items, subtotal, shipId: method?.id, shipName: method?.name || "", shipCost: method?.fee || 0, freeShip, shipFee, total: subtotal + shipFee };
}

function updateSummary() {
  const t = totals();
  const box = document.getElementById("summary");
  if (!box) return;
  box.innerHTML = `
    <div class="sum-row"><span>جمع کالاها</span><b>${toman(t.subtotal)}</b></div>
    <div class="sum-row"><span>هزینه‌ی ارسال</span><b>${!t.items.length ? "—" : t.freeShip ? '<span class="free">رایگان</span>' : toman(t.shipFee)}</b></div>
    <div class="sum-row total"><span>مبلغ قابل پرداخت</span><b>${toman(t.total)}</b></div>
    ${form.shop.freeShipMin && !t.freeShip && t.items.length ? `<div class="muted small">با ${toman(form.shop.freeShipMin - t.subtotal)} خرید بیشتر، ارسال رایگان می‌شود.</div>` : ""}`;
  for (const p of form.products) {
    const q = document.querySelector(`[data-qty="${p.id}"]`);
    if (q) q.textContent = fa(cart[p.id] || 0);
    document.querySelector(`[data-prow="${p.id}"]`)?.classList.toggle("on", (cart[p.id] || 0) > 0);
  }
  const pay = document.getElementById("pay-amount");
  if (pay) pay.textContent = toman(t.total);
}

// ------------------------------------------------------------------ #o= order form

export const orderForm = {
  async load(payload) {
    form = readOrderForm(await decode(payload));
    cart = {};
    if (form.prefill) for (const it of form.prefill.items) if (form.products.some((p) => p.id === it.pid)) cart[it.pid] = it.qty;
  },
  render() {
    const { shop, products, prefill } = form;
    const me = loadMe().profiles[shop.handle];
    const c = prefill?.customer || me || {};
    const specs = prefill?.specs || me?.specs || {};
    const fromMemory = !prefill && me;
    const v = (k) => esc(c[k] || "");
    return `<main class="pub">
      ${shopHeader(shop)}
      ${prefill ? `<div class="hello">${icon("check")} <div><b>خوش برگشتید${c.name ? " " + esc(c.name.split(" ")[0]) : ""}!</b> سفارش قبلی‌تان را آماده کرده‌ایم؛ فقط بررسی و تأیید کنید.</div></div>` : ""}
      ${fromMemory ? `<div class="hello soft">${icon("check")} <div>اطلاعات دفعه‌ی قبل روی همین گوشی بود و پر شد.</div></div>` : ""}
      ${shop.welcome ? `<p class="welcome">${esc(shop.welcome)}</p>` : ""}
      <form data-form="place-order" novalidate>
        <section class="pub-sec">
          <h2><span class="step">۱</span> چه می‌خواهید؟</h2>
          <div class="plist">
            ${products.map((p) => `<div class="prow" data-prow="${p.id}">
              <div class="pinfo"><div class="pname">${esc(p.name)}</div><div class="muted">${toman(p.price)}</div></div>
              <div class="stepper">
                <button type="button" class="sbtn" data-act="qty" data-pid="${p.id}" data-d="1" aria-label="یکی بیشتر ${esc(p.name)}">+</button>
                <span class="sqty" data-qty="${p.id}" aria-live="polite">${fa(cart[p.id] || 0)}</span>
                <button type="button" class="sbtn" data-act="qty" data-pid="${p.id}" data-d="-1" aria-label="یکی کمتر ${esc(p.name)}">−</button>
              </div>
            </div>`).join("")}
          </div>
        </section>

        <section class="pub-sec">
          <h2><span class="step">۲</span> گیرنده</h2>
          <div class="grid2">
            <label>نام و نام خانوادگی<input name="name" autocomplete="name" required value="${v("name")}"></label>
            <label>موبایل<input name="phone" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="09…" required value="${v("phone")}"></label>
            <label>آیدی اینستاگرام <span class="opt">اختیاری</span><input name="ig" dir="ltr" placeholder="@" value="${v("ig")}"></label>
            <label>شهر<input name="city" autocomplete="address-level2" required value="${v("city")}"></label>
          </div>
          <label>آدرس کامل<textarea name="address" rows="2" autocomplete="street-address" required>${v("address")}</textarea></label>
          <label>کد پستی <span class="opt">اختیاری</span><input name="postal" inputmode="numeric" dir="ltr" value="${v("postal")}"></label>
        </section>

        <section class="pub-sec">
          <h2><span class="step">۳</span> ارسال${shop.customFields.length || shop.askDate ? " و جزئیات" : ""}</h2>
          <div class="ship-list">
            ${shop.shipping.map((m, i) => `<label class="radio-card"><input type="radio" name="ship" value="${esc(m.id)}" ${i === 0 ? "checked" : ""}><span>${esc(m.name)}</span><b>${toman(m.fee)}</b></label>`).join("")}
          </div>
          ${shop.freeShipMin ? `<p class="muted small">ارسال برای خرید بالای ${toman(shop.freeShipMin)} رایگان است.</p>` : ""}
          ${shop.customFields.map((f) => `<label>${esc(f.label)} ${f.hint ? `<span class="opt">${esc(f.hint)}</span>` : ""}<input name="sp_${esc(f.id)}" value="${esc(specs[f.id] || "")}"></label>`).join("")}
          ${shop.askDate ? `<div class="field"><span class="flabel">تا چه تاریخی لازم دارید؟ <span class="opt">اگر برای مناسبت است</span></span>${datePicker("needby", null, { label: "تاریخ لازم" })}</div>` : ""}
          <label>توضیحات <span class="opt">اختیاری</span><textarea name="note" rows="2"></textarea></label>
        </section>

        <section class="pub-sec">
          <h2><span class="step">۴</span> پرداخت</h2>
          <div id="summary" class="summary"></div>
          ${shop.card ? `<div class="paycard">
            <div class="muted small">مبلغ <b id="pay-amount"></b> را کارت‌به‌کارت کنید به:</div>
            <div class="cardno">${ltr(cardFmt(shop.card))}</div>
            <div class="muted small">${esc(shop.cardOwner || "")}</div>
            <button type="button" class="btn small" data-act="copy-card" data-card="${esc(norm(shop.card).replace(/\D/g, ""))}">${icon("copy")} کپی شماره کارت</button>
          </div>` : ""}
          <label>نشانه‌ی واریز <span class="opt">اختیاری؛ ساعت واریز یا ۴ رقم آخر کارت. عکس فیش را هم می‌توانید در دایرکت بفرستید</span><input name="payref"></label>
          <label class="check"><input type="checkbox" name="remember" checked> اطلاعاتم برای دفعه‌ی بعد روی همین گوشی بماند</label>
        </section>

        <div class="form-error" id="form-error" role="alert"></div>
        <button class="btn primary block big" type="submit">ثبت سفارش</button>
        <p class="muted small center">بعد از ثبت، یک پیام آماده می‌گیرید که در دایرکت برای فروشنده می‌فرستید.</p>
      </form>
      <footer class="pub-foot">ساخته‌شده با <a href="./">دفترچه</a></footer>
    </main>`;
  },
  mount() {
    updateSummary();
    document.querySelectorAll('input[name="ship"]').forEach((r) => r.addEventListener("change", updateSummary));
  },
  actions: {
    qty(el) {
      const pid = el.dataset.pid;
      cart[pid] = Math.max(0, Math.min(99, (cart[pid] || 0) + +el.dataset.d));
      updateSummary();
    },
    async "copy-card"(el) {
      toast((await copyText(el.dataset.card)) ? "شماره کارت کپی شد" : "کپی نشد", "ok");
    },
  },
  forms: {
    async "place-order"(f, fd) {
      const err = (m) => {
        const e = document.getElementById("form-error");
        e.textContent = m;
        e.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      const t = totals();
      if (!t.items.length) return err("دست‌کم یک محصول انتخاب کنید.");
      const name = norm(fd.get("name"));
      const phone = phoneKey(fd.get("phone"));
      if (!name) return err("نام گیرنده را بنویسید.");
      if (!phone) return err("شماره موبایل درست نیست (مثل ۰۹۱۲۱۲۳۴۵۶۷).");
      if (!norm(fd.get("city")) || !norm(fd.get("address"))) return err("شهر و آدرس کامل را بنویسید.");
      const { shop } = form;
      const specs = {};
      for (const fld of shop.customFields) {
        const val = norm(fd.get("sp_" + fld.id));
        if (val) specs[fld.id] = val;
      }
      const order = {
        id: shortId(),
        createdAt: now(),
        customer: { name, phone, ig: igHandle(fd.get("ig")), city: norm(fd.get("city")), address: norm(fd.get("address")), postal: norm(fd.get("postal")) },
        ...t,
        specs,
        needBy: shop.askDate ? readDate(fd, "needby", fromJalali) : null,
        note: norm(fd.get("note")),
        payRef: norm(fd.get("payref")),
      };
      const link = await incomingLink(order, shop.handle);
      const text = incomingMessage(order, link);
      const me = loadMe();
      if (fd.get("remember")) me.profiles[shop.handle] = { ...order.customer, specs };
      else delete me.profiles[shop.handle];
      me.orders = [{ shop: shop.name, handle: shop.handle, id: order.id, at: order.createdAt, total: order.total }, ...(me.orders || [])].slice(0, 20);
      lastSent = { order, text, link, shop };
      me.lastSent = lastSent; // survives the tab reloading when the customer comes back from Instagram
      saveMe(me);
      location.hash = "#sent";
    },
  },
};

// ------------------------------------------------------------------ #sent

export const sentPage = {
  render() {
    if (!lastSent) lastSent = loadMe().lastSent || null;
    if (!lastSent) return `<main class="pub"><p>سفارشی برای نمایش نیست.</p><a class="btn" href="./">بازگشت</a></main>`;
    const { order, text, shop } = lastSent;
    const sameBrowserSeller = hasShop() && getState().shop.handle === shop.handle;
    return `<main class="pub">
      <div class="sent-hero">
        <div class="big-check">${icon("check")}</div>
        <h1>سفارش ${ltr(order.id)} آماده شد</h1>
        <p><b>یک قدم مانده:</b> این پیام را در دایرکت برای ${ltr("@" + shop.handle)} بفرستید. سفارش با همین پیام به دفترچه‌ی فروشنده می‌رسد.</p>
      </div>
      <div class="send" id="sent-msg">
        <textarea class="send-text" rows="7" readonly aria-label="متن پیام سفارش">${esc(text)}</textarea>
        <div class="send-actions">
          <a class="btn primary" href="https://ig.me/m/${esc(encodeURIComponent(shop.handle))}" target="_blank" rel="noopener" data-act="copy-to-dm" data-keep-default>${icon("insta")} کپی و رفتن به دایرکت</a>
          <button class="btn" data-act="share-send" data-target="sent-msg">${icon("share")} اشتراک</button>
          <button class="btn ghost" data-act="copy-send" data-target="sent-msg">${icon("copy")} فقط کپی</button>
        </div>
      </div>
      ${shop.card ? `<div class="paycard">
        <div class="muted small">اگر هنوز واریز نکرده‌اید: ${toman(order.total)} به کارت</div>
        <div class="cardno">${ltr(cardFmt(shop.card))}</div><div class="muted small">${esc(shop.cardOwner || "")}</div>
      </div>` : ""}
      ${sameBrowserSeller ? `<div class="demo-note">
        <b>حالت نمایشی:</b> دفترچه‌ی همین فروشنده روی این مرورگر هم باز است. در واقعیت فروشنده این پیام را در دایرکت می‌گیرد و در دفترچه می‌چسباند؛ اینجا می‌توانید مستقیم ببینید چه می‌شود.
        <a class="btn primary" href="#i=${esc(lastSent.link.split("#i=")[1])}">باز کردن در دفترچه‌ی فروشنده</a>
      </div>` : ""}
    </main>`;
  },
  actions: {
    // the <a> itself opens Instagram; the clipboard write starts synchronously inside the same click
    async "copy-to-dm"() {
      const ok = await copyText(lastSent?.text || "");
      toast(ok ? "متن کپی شد؛ در دایرکت بچسبانید و بفرستید" : "کپی نشد؛ با «فقط کپی» دوباره امتحان کنید", ok ? "ok" : "bad");
    },
  },
};

// ------------------------------------------------------------------ #s= status page

let status = null;

export const statusPage = {
  async load(payload) {
    status = readStatus(await decode(payload));
  },
  render() {
    const s = status;
    const at = (st) => s.history.filter((h) => h.s === st).pop()?.t;
    const cancelled = s.status === "cancelled";
    const cur = FLOW.indexOf(s.status);
    const steps = [
      ["new", "سفارش ثبت شد"],
      ["paid", "واریز تأیید شد"],
      ["making", "در حال آماده‌سازی"],
      ["shipped", "ارسال شد"],
      ["done", "تحویل شد"],
    ];
    const isPost = /پست/.test(s.shipName || "");
    return `<main class="pub">
      <header class="pub-head"><div class="avatar">${esc((s.shopName || "?")[0])}</div><div><h1>${esc(s.shopName)}</h1><div class="muted">وضعیت سفارش ${ltr(s.id)}</div></div></header>
      ${cancelled ? `<div class="hello bad">این سفارش لغو شده است.</div>` : `
      <ol class="timeline">
        ${steps.map(([st, label], i) => `<li class="${i < cur ? "done" : i === cur ? "now" : ""}">
          <span class="dot">${i <= cur ? icon("check") : ""}</span>
          <div><b>${label}</b>${at(st) ? `<div class="muted small">${jDateTime(at(st))}</div>` : ""}</div>
        </li>`).join("")}
      </ol>`}
      ${s.tracking ? `<div class="paycard">
        <div class="muted small">کد رهگیری${s.shipName ? " " + esc(s.shipName) : ""}</div>
        <div class="cardno">${ltr(s.tracking)}</div>
        <div class="send-actions">
          <button class="btn small" data-act="copy-track" data-code="${esc(s.tracking)}">${icon("copy")} کپی کد</button>
          ${isPost ? `<a class="btn small ghost" href="https://tracking.post.ir/" target="_blank" rel="noopener">پیگیری در سایت پست</a>` : ""}
        </div>
      </div>` : ""}
      <section class="pub-sec">
        <h2>اقلام سفارش</h2>
        ${s.items.map((it) => `<div class="sum-row"><span>${esc(it.name)}</span><b>${fa(it.qty)} عدد</b></div>`).join("")}
        <div class="sum-row total"><span>مبلغ</span><b>${toman(s.total)}</b></div>
      </section>
      <p class="muted small">این صفحه وضعیت سفارش را تا ${jDateTime(s.at)} نشان می‌دهد. هر مرحله‌ی تازه با پیامک یا دایرکت برایتان فرستاده می‌شود.</p>
      ${s.handle ? `<a class="btn block" href="https://ig.me/m/${esc(s.handle)}" target="_blank" rel="noopener">${icon("insta")} سؤال دارید؟ دایرکت ${ltr("@" + s.handle)}</a>` : ""}
      <footer class="pub-foot">ساخته‌شده با <a href="./">دفترچه</a></footer>
    </main>`;
  },
  actions: {
    async "copy-track"(el) {
      toast((await copyText(el.dataset.code)) ? "کد رهگیری کپی شد" : "کپی نشد", "ok");
    },
  },
};

// ------------------------------------------------------------------ #i= opened somewhere without a notebook

export const incomingNoShop = {
  render() {
    return `<main class="pub">
      <header class="pub-head"><div class="avatar">د</div><div><h1>این یک سفارش برای دفترچه است</h1><div class="muted">لینکی که مشتری برای فروشنده فرستاده</div></div></header>
      <section class="pub-sec">
        <p>این لینک باید در <b>دفترچه‌ی فروشنده</b> باز شود. اگر فروشنده‌اید و این صفحه داخل اینستاگرام باز شده، اینستاگرام مرورگر جداگانه‌ای دارد که دفترچه‌ی شما در آن نیست:</p>
        <ol class="steps-list">
          <li>در دایرکت، روی پیام مشتری انگشت را نگه دارید و «کپی» را بزنید.</li>
          <li>دفترچه را در مرورگر همیشگی‌تان (یا از صفحه‌ی اصلی گوشی) باز کنید.</li>
          <li>دکمه‌ی «دریافت سفارش» را بزنید و پیام را بچسبانید.</li>
        </ol>
        <a class="btn primary block" href="./">رفتن به دفترچه</a>
      </section>
    </main>`;
  },
};
