// Seller: landing, first-time setup, dashboard, products (+ profit check), order link & saved replies, settings.

import { esc, fa, num, toman, ltr, norm, toInt, igHandle, now, DAY, cardFmt, copyText } from "../util.js";
import { jWeekday } from "../jalali.js";
import { orderFormLink, savedReply, trackingReply } from "../links.js";
import {
  getState, save, replaceState, resetAll, blankShop, blankState, hasShop, isOverdue, dueSoon, waitingTooLong, reminders,
  monthStats, productMargin, whereThisWeek, whereLastWeek, nextProductId, OPEN, markReminder,
} from "../store.js";
import { buildDemo, DEMO_REMINDER_PHONES } from "../seed.js";
import { icon, toast, money, sendPanel, fillSend } from "../ui.js";
import { go } from "./orders.js";

// ------------------------------------------------------------------ landing

export const landing = {
  render() {
    return `<main class="landing">
      <section class="hero">
        <div class="logo">${logoMark()}<span>دفترچه</span></div>
        <h1>حافظه‌ی سفارش و مشتری<br>برای فروشنده‌های دایرکتی</h1>
        <p class="lead">مشتری سفارشش را خودش با یک لینک ثبت می‌کند. شما سفارش‌ها را روی یک تابلو می‌بینید، کد رهگیری را با یک دکمه پیامک می‌کنید، مشتری قدیمی را می‌شناسید و به‌موقع برای خرید دوباره یادآوری می‌فرستید.</p>
        <div class="hero-actions">
          <button class="btn primary big" data-act="start-demo">${icon("eye")} دیدن نسخه‌ی نمایشی</button>
          <button class="btn big" data-act="customer-demo">${icon("users")} از دید مشتری</button>
          <a class="btn ghost big" href="#/setup">${icon("plus")} ساخت دفترچه‌ی خودم</a>
        </div>
      </section>
      <section class="why">
        <div class="why-card"><div class="n">۶۵٪</div><p>فروشنده‌ها در سه ماه اخیر سفارشی را گم یا فراموش کرده‌اند.</p></div>
        <div class="why-card"><div class="n">۴۶٪</div><p>فروش از مشتری‌های قبلی است، اما ۸۳٪ هیچ لیستی از آن‌ها ندارند.</p></div>
        <div class="why-card"><div class="n">۳٫۴ ساعت</div><p>در روز صرف دایرکت می‌شود، بیشترش بعد از ساعت ۱۰ شب.</p></div>
      </section>
      <p class="muted center small">از پژوهش «چالش ریشه‌یابی»: نظرسنجی ۲۰۰ فروشنده، ۲۵ مصاحبه و ۷۲ گفتگوی دایرکت.</p>
      <section class="how">
        <h2>چطور کار می‌کند</h2>
        <ol class="how-steps">
          <li><span>${icon("link")}</span><b>لینک سفارش</b><p>به جای چهل پیام رفت‌وبرگشت، لینک فرم را در دایرکت می‌فرستید. قیمت، هزینه‌ی ارسال، شماره کارت و مشخصات سفارشی همه در فرم است.</p></li>
          <li><span>${icon("inbox")}</span><b>سفارش به دفترچه می‌آید</b><p>مشتری بعد از ثبت، یک پیام آماده برایتان می‌فرستد؛ آن را در دفترچه می‌چسبانید. اگر مشتری خودش تایپ کرده، «ثبت سریع» از متن چت سفارش می‌سازد.</p></li>
          <li><span>${icon("board")}</span><b>تابلوی سفارش‌ها</b><p>منتظر واریز، پرداخت‌شده، آماده‌سازی، ارسال‌شده. سفارشی که پولش آمده و ۴۸ ساعت مانده، قرمز می‌شود.</p></li>
          <li><span>${icon("sms")}</span><b>«بسته‌م کجاست» بی‌جواب نمی‌ماند</b><p>با هر مرحله، پیام آماده همراه لینک وضعیت و کد رهگیری را پیامک یا دایرکت می‌کنید.</p></li>
          <li><span>${icon("users")}</span><b>حافظه‌ی مشتری</b><p>«همون همیشگی» یعنی یک دکمه: آدرس، سایز و خرید قبلی هر مشتری با شماره‌اش ذخیره است.</p></li>
          <li><span>${icon("bell")}</span><b>یادآور خرید دوباره</b><p>وقتی صابون مشتری احتمالاً تمام شده یا تولد سال بعد رسیده، پیام و لینک پیش‌پر آماده است.</p></li>
        </ol>
      </section>
      <section class="privacy card">
        <b>بدون سرور، بدون ثبت‌نام، بدون وابستگی به اینستاگرام.</b>
        <p class="muted">اطلاعات فقط در مرورگر گوشی شما ذخیره می‌شود و بین شما و مشتری داخل خودِ لینک‌ها جابه‌جا می‌شود. برای همین با فیلترینگ و تحریم API اینستاگرام هم کار می‌کند. از بخش تنظیمات می‌توانید فایل پشتیبان بگیرید.</p>
      </section>
      <footer class="pub-foot">MVP · ساخته‌شده برای چالش ریشه‌یابی، AI Solo Founder Camp</footer>
    </main>`;
  },
  actions: {
    "start-demo"() {
      replaceState(buildDemo());
      // the random history would surface a dozen reminders; keep the scripted ones and mark the rest as already sent
      for (const r of reminders()) if (!DEMO_REMINDER_PHONES.includes(r.customer.phone)) markReminder(r.key, { done: true, at: now() - DAY });
      toast("دفترچه‌ی نمایشی باز شد", "ok");
      go("#/home");
    },
    async "customer-demo"() {
      const d = buildDemo();
      location.href = await orderFormLink(d.shop, d.products);
    },
  },
};

export function logoMark() {
  return `<svg class="logomark" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="3" width="22" height="26" rx="4" fill="currentColor"/><path d="M10 3v26" stroke="#fff" stroke-width="2" opacity=".55"/><path d="M14 11h9M14 16h9M14 21h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}

// ------------------------------------------------------------------ setup

const CYCLES = [[0, "بدون یادآوری"], [15, "۱۵ روز"], [30, "۳۰ روز"], [45, "۴۵ روز"], [60, "۶۰ روز"], [90, "۹۰ روز"], [180, "۶ ماه"], [365, "یک سال"]];
const PRESET_FIELDS = [
  ["size", "سایزها (مثلاً دور سینه، کمر، قد)"],
  ["name_on", "اسم یا متن روی محصول (فارسی و لاتین)"],
  ["design", "رنگ یا طرح انتخابی"],
  ["occasion", "مناسبت (تولد، سالگرد…)"],
];

const productRow = (p = {}) => `<div class="prod-row">
  <input name="pname" placeholder="نام محصول" value="${esc(p.name || "")}" aria-label="نام محصول">
  <input name="pprice" inputmode="numeric" placeholder="قیمت (تومان)" value="${p.price ? num(p.price) : ""}" aria-label="قیمت">
  <input name="pcost" inputmode="numeric" placeholder="هزینه‌ی تمام‌شده (اختیاری)" value="${p.cost ? num(p.cost) : ""}" aria-label="هزینه‌ی تمام‌شده">
  <select name="pcycle" aria-label="یادآوری خرید دوباره">${CYCLES.map(([v, l]) => `<option value="${v}" ${p.cycle === v ? "selected" : ""}>یادآوری: ${l}</option>`).join("")}</select>
</div>`;

export const setup = {
  render() {
    return `<div class="page narrow">
      <div class="page-h"><h1>ساخت دفترچه</h1><span class="muted">۲ دقیقه</span></div>
      ${getState().demo ? `<div class="hello soft">دفترچه‌ی نمایشی با ساختن دفترچه‌ی خودتان پاک می‌شود.</div>` : ""}
      <form data-form="setup" class="card">
        <h2>فروشگاه</h2>
        <div class="grid2">
          <label>نام فروشگاه<input name="name" required placeholder="مثلاً کارگاه شمع ستاره"></label>
          <label>آیدی اینستاگرام<input name="handle" dir="ltr" required placeholder="@"></label>
          <label>شماره کارت برای واریز<input name="card" dir="ltr" inputmode="numeric" placeholder="6037 …"></label>
          <label>به نام<input name="owner"></label>
        </div>
        <h2>محصولات</h2>
        <p class="muted small">هزینه‌ی تمام‌شده (مواد + بسته‌بندی هر عدد) اختیاری است، ولی با آن دفترچه می‌گوید کدام محصول زیر قیمت فروخته می‌شود. «یادآوری» یعنی معمولاً بعد از چند روز تمام می‌شود.</p>
        <div id="prod-rows">${productRow()}${productRow()}${productRow()}</div>
        <button type="button" class="btn small ghost" data-act="add-prod-row">${icon("plus")} محصول دیگر</button>
        <h2>ارسال</h2>
        <div class="grid2">
          <label>هزینه‌ی پست (تومان)<input name="post" inputmode="numeric" value="۹۵٬۰۰۰"></label>
          <label>هزینه‌ی پیک (تومان؛ خالی یعنی ندارم)<input name="peyk" inputmode="numeric" value=""></label>
          <label>ارسال رایگان برای خرید بالای (اختیاری)<input name="free" inputmode="numeric" placeholder="مثلاً ۷۰۰٬۰۰۰"></label>
        </div>
        <h2>سفارش سفارشی یا هدیه</h2>
        <label class="check"><input type="checkbox" name="askDate"> از مشتری بپرس «تا چه تاریخی لازم دارید؟»</label>
        <p class="muted small">فیلدهایی که مشتری باید همان اول پر کند (به جای اینکه از وسط چت پیدایشان کنید):</p>
        ${PRESET_FIELDS.map(([id, label]) => `<label class="check"><input type="checkbox" name="cf" value="${id}"> ${label}</label>`).join("")}
        <button class="btn primary block big" type="submit">ساختن دفترچه و گرفتن لینک سفارش</button>
      </form>
    </div>`;
  },
  actions: {
    "add-prod-row"(el, ev, root) {
      root.querySelector("#prod-rows").insertAdjacentHTML("beforeend", productRow());
    },
  },
  forms: {
    setup(f, fd) {
      const names = fd.getAll("pname"), prices = fd.getAll("pprice"), costs = fd.getAll("pcost"), cycles = fd.getAll("pcycle");
      const products = [];
      names.forEach((n, i) => {
        const name = norm(n);
        const price = toInt(prices[i]);
        if (name && price) products.push({ id: "p" + (products.length + 1), name, price, cost: toInt(costs[i]) || 0, cycle: +cycles[i] || 0, active: true });
      });
      const name = norm(fd.get("name")), handle = igHandle(fd.get("handle"));
      if (!name || !handle) return toast("نام فروشگاه و آیدی اینستاگرام لازم است", "bad");
      if (!products.length) return toast("دست‌کم یک محصول با قیمت وارد کنید", "bad");
      const shop = { ...blankShop(), name, handle, card: norm(fd.get("card")).replace(/\D/g, ""), cardOwner: norm(fd.get("owner")) };
      shop.shipping = [];
      const post = toInt(fd.get("post")), peyk = toInt(fd.get("peyk"));
      if (post != null) shop.shipping.push({ id: "post", name: "پست پیشتاز", fee: post });
      if (peyk != null) shop.shipping.push({ id: "peyk", name: "پیک", fee: peyk });
      if (!shop.shipping.length) shop.shipping.push({ id: "post", name: "پست", fee: 0 });
      shop.freeShipMin = toInt(fd.get("free")) || 0;
      shop.askDate = !!fd.get("askDate");
      shop.customFields = fd.getAll("cf").map((id) => ({ id, label: PRESET_FIELDS.find((p) => p[0] === id)[1] }));
      const st = blankState();
      st.shop = shop;
      st.products = products;
      replaceState(st);
      toast("دفترچه ساخته شد. این لینک سفارش شماست.", "ok");
      go("#/share");
    },
  },
};

// ------------------------------------------------------------------ dashboard

export const home = {
  render() {
    const st = getState();
    const overdue = st.orders.filter(isOverdue);
    const soon = st.orders.filter(dueSoon);
    const waiting = st.orders.filter((o) => o.status === "new");
    const stale = waiting.filter(waitingTooLong);
    const rem = reminders();
    const below = st.products.filter((p) => p.active !== false && p.cost && p.cost >= p.price);
    const m = monthStats(30);
    const open = st.orders.filter((o) => OPEN.includes(o.status)).length;
    const w = whereThisWeek(), wl = whereLastWeek();
    const todo = [
      overdue.length && [`#/board/paid`, "red", "alert", `${fa(overdue.length)} سفارش پول‌شان آمده و بیش از ۴۸ ساعت است ارسال نشده‌اند`],
      soon.length && [`#/order/${soon[0].id}`, "red", "clock", `${fa(soon.length)} سفارش تا ۳ روز دیگر لازم است (${esc(soon[0].customer.name)})`],
      waiting.length && [`#/board/new`, "amber", "inbox", `${fa(waiting.length)} سفارش منتظر تأیید واریز${stale.length ? `، ${fa(stale.length)} مورد بیش از ۳ روز` : ""}`],
      rem.length && [`#/reminders`, "violet", "bell", `${fa(rem.length)} مشتری برای یادآوری خرید دوباره`],
      below.length && [`#/products`, "red", "chart", `${fa(below.length)} محصول زیر قیمت تمام‌شده فروخته می‌شود: ${below.map((p) => esc(p.name)).join("، ")}`],
    ].filter(Boolean);
    return `<div class="page">
      <div class="page-h"><h1>سلام 🌸</h1><span class="muted">${jWeekday(now())}</span></div>
      <section class="todo">
        <h2>کارهای امروز</h2>
        ${todo.length ? todo.map(([href, tone, ic, text]) => `<a class="todo-item ${tone}" href="${href}">${icon(ic)}<span>${text}</span>${icon("back")}</a>`).join("") : `<div class="todo-item ok">${icon("check")}<span>همه‌چیز مرتب است.</span></div>`}
      </section>
      <section class="quick-grid">
        <a class="qa primary" href="#/receive">${icon("inbox")}<b>دریافت سفارش</b><span>پیام مشتری را بچسبانید</span></a>
        <a class="qa" href="#/quick">${icon("wand")}<b>ثبت سریع</b><span>از متن چت</span></a>
        <a class="qa" href="#/share">${icon("link")}<b>لینک سفارش من</b><span>برای دایرکت</span></a>
        <a class="qa" href="#/new">${icon("plus")}<b>سفارش دستی</b><span>تلفنی یا حضوری</span></a>
      </section>
      <section>
        <h2>۳۰ روز اخیر</h2>
        <div class="stats4">
          <div class="stat"><div class="label">فروش</div><div class="n">${money(m.revenue)}</div><div class="muted small">${fa(m.count)} سفارش</div></div>
          <div class="stat"><div class="label">سود تقریبی</div><div class="n ${m.profit < 0 ? "neg" : ""}">${money(m.profit)}</div><div class="muted small">${m.freeShipCost ? `${toman(m.freeShipCost)} خرج ارسال رایگان` : "بعد از هزینه‌ی مواد"}</div></div>
          <div class="stat"><div class="label">سهم مشتری قدیمی</div><div class="n">${fa(Math.round(m.repeatShare * 100))}٪</div><div class="muted small">از سفارش‌ها</div></div>
          <div class="stat"><div class="label">سفارش باز</div><div class="n">${fa(open)}</div><div class="muted small"><a href="#/board">تابلو</a></div></div>
        </div>
      </section>
      <section class="card metric">
        <div>
          <h2>پیام‌های «سفارشم کجاست؟»</h2>
          <p class="muted small">شاخص اصلی آزمون: هر بار کسی پرسید، یک بار بزنید. هدف: نصف شدن.</p>
        </div>
        <div class="metric-nums">
          <div><div class="n">${fa(w)}</div><div class="muted small">این هفته</div></div>
          <div><div class="n muted">${fa(wl)}</div><div class="muted small">هفته‌ی قبل</div></div>
          ${wl ? `<div class="delta ${w <= wl ? "good" : "bad"}">${w <= wl ? "−" : "+"}${fa(Math.round((Math.abs(w - wl) / wl) * 100))}٪</div>` : ""}
        </div>
        <button class="btn" data-act="log-where">${icon("plus")} یکی دیگر پرسید</button>
      </section>
    </div>`;
  },
  actions: {
    "log-where"(el, ev, root, arg, rerender) {
      getState().whereLog.push(now());
      save();
      toast("ثبت شد");
      rerender();
    },
  },
};

// ------------------------------------------------------------------ products & profit check

export const products = {
  render() {
    const st = getState();
    const m = monthStats(30);
    return `<div class="page narrow">
      <div class="page-h"><h1>محصولات و چک سود</h1></div>
      <p class="muted">هزینه‌ی تمام‌شده‌ی هر عدد (مواد + بسته‌بندی) را یک بار بنویسید و هر وقت مواد گران شد، همین‌جا به‌روز کنید. دفترچه محصولی را که زیر هزینه فروخته می‌شود قرمز می‌کند.</p>
      <div class="stats3">
        <div class="stat"><div class="label">سود تقریبی ۳۰ روز</div><div class="n ${m.profit < 0 ? "neg" : ""}">${money(m.profit)}</div></div>
        <div class="stat"><div class="label">خرج ارسال رایگان</div><div class="n">${money(m.freeShipCost)}</div></div>
        <div class="stat"><div class="label">فروش ۳۰ روز</div><div class="n">${money(m.revenue)}</div></div>
      </div>
      ${st.products.map((p) => {
        const mg = productMargin(p);
        const bad = mg && mg.margin <= 0;
        const thin = mg && !bad && mg.pct < 0.15;
        return `<form class="card prod ${bad ? "bad" : ""}" data-form="prod" data-pid="${esc(p.id)}">
          <div class="page-h"><b>${esc(p.name)}</b>
            ${mg ? `<span class="badge ${bad ? "red" : thin ? "amber" : "green"}">${bad ? `زیان ${toman(-mg.margin)} در هر عدد` : `سود ${toman(mg.margin)} (${fa(Math.round(mg.pct * 100))}٪)`}</span>` : `<span class="badge">هزینه وارد نشده</span>`}</div>
          ${bad ? `<p class="small neg">با این قیمت، هر فروش از جیب شما می‌رود. برای سود ۳۰٪ قیمت باید حدود ${toman(Math.ceil(p.cost / 0.7 / 10000) * 10000)} باشد.</p>` : ""}
          <div class="grid4">
            <label>نام<input name="name" value="${esc(p.name)}"></label>
            <label>قیمت<input name="price" inputmode="numeric" value="${num(p.price)}"></label>
            <label>هزینه‌ی تمام‌شده<input name="cost" inputmode="numeric" value="${p.cost ? num(p.cost) : ""}"></label>
            <label>یادآوری<select name="cycle">${CYCLES.map(([v, l]) => `<option value="${v}" ${(p.cycle || 0) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          </div>
          <div class="row-actions">
            <label class="check"><input type="checkbox" name="active" ${p.active !== false ? "checked" : ""}> در فرم سفارش نمایش داده شود</label>
            <button class="btn small" type="submit">ذخیره</button>
          </div>
        </form>`;
      }).join("")}
      <form class="card" data-form="prod-new">
        <h2>محصول تازه</h2>
        ${productRow()}
        <button class="btn small primary" type="submit">${icon("plus")} افزودن</button>
      </form>
    </div>`;
  },
  forms: {
    prod(f, fd, root, arg, rerender) {
      const p = getState().products.find((x) => x.id === f.dataset.pid);
      const price = toInt(fd.get("price"));
      if (!norm(fd.get("name")) || !price) return toast("نام و قیمت لازم است", "bad");
      Object.assign(p, { name: norm(fd.get("name")), price, cost: toInt(fd.get("cost")) || 0, cycle: +fd.get("cycle") || 0, active: !!fd.get("active") });
      save();
      toast("ذخیره شد. لینک سفارش با قیمت تازه به‌روز شد.", "ok");
      rerender();
    },
    "prod-new"(f, fd, root, arg, rerender) {
      const name = norm(fd.get("pname")), price = toInt(fd.get("pprice"));
      if (!name || !price) return toast("نام و قیمت لازم است", "bad");
      getState().products.push({ id: nextProductId(), name, price, cost: toInt(fd.get("pcost")) || 0, cycle: +fd.get("pcycle") || 0, active: true });
      save();
      toast("اضافه شد", "ok");
      rerender();
    },
  },
};

// ------------------------------------------------------------------ order link & saved replies

export const share = {
  render() {
    const st = getState();
    return `<div class="page narrow">
      <div class="page-h"><h1>لینک سفارش من</h1></div>
      <section class="card">
        <p>این لینک را به جای جواب‌دادن تک‌تک پیام‌ها بفرستید. مشتری قیمت‌ها، هزینه‌ی ارسال و شماره کارت را می‌بیند و سفارش و مشخصاتش را خودش کامل می‌کند.</p>
        <div class="linkbox" id="order-link"><input readonly value="در حال ساختن…" aria-label="لینک سفارش"></div>
        <div class="row-actions">
          <button class="btn primary" data-act="copy-send" data-target="order-link">${icon("copy")} کپی لینک</button>
          <a class="btn" id="open-as-customer" href="#" target="_blank" rel="noopener">${icon("eye")} دیدن از دید مشتری</a>
          <button class="btn ghost" data-act="share-send" data-target="order-link">${icon("share")} اشتراک</button>
        </div>
        <p class="muted small">قیمت‌ها داخل خود لینک است؛ اگر قیمت یا محصولی را عوض کردید، لینک تازه را از همین‌جا بردارید.</p>
      </section>
      <section class="card">
        <h2>جواب‌های آماده برای دایرکت</h2>
        <p class="muted small">در اینستاگرام: تنظیمات ← ابزارهای کسب‌وکار ← «پاسخ‌های ذخیره‌شده». این متن‌ها را با میان‌بر کوتاه (مثل «سفارش») ذخیره کنید تا با دو حرف بفرستید.</p>
        ${sendPanel("reply-order", { title: "جواب «چطور سفارش بدم؟ / قیمت چنده؟»" })}
        ${sendPanel("reply-track", { title: "جواب «بسته‌م کجاست؟»" })}
      </section>
      <section class="card">
        <h2>لینک بیو</h2>
        <p class="muted small">همین لینک را می‌توانید در بیو یا هایلایت «سفارش» بگذارید تا مشتری‌ها قبل از پیام دادن خودشان ثبت کنند.</p>
      </section>
    </div>`;
  },
  async mount(root) {
    const st = getState();
    const link = await orderFormLink(st.shop, st.products);
    root.querySelector("#order-link input").value = link;
    root.querySelector("#open-as-customer").href = link;
    fillSend(root, "reply-order", savedReply(st.shop, link));
    fillSend(root, "reply-track", trackingReply());
  },
};

// ------------------------------------------------------------------ settings

const shipRow = (m = {}) => `<div class="ship-row"><input name="sname" placeholder="نام روش ارسال" value="${esc(m.name || "")}" aria-label="نام روش ارسال"><input name="sfee" inputmode="numeric" placeholder="هزینه" value="${m.fee != null ? num(m.fee) : ""}" aria-label="هزینه"><input type="hidden" name="sid" value="${esc(m.id || "")}"></div>`;
const fieldRow = (f = {}) => `<div class="ship-row"><input name="flabel" placeholder="مثلاً سایز دور کمر" value="${esc(f.label || "")}" aria-label="عنوان فیلد"><input type="hidden" name="fid" value="${esc(f.id || "")}"></div>`;

export const settings = {
  render() {
    const st = getState();
    const s = st.shop;
    return `<div class="page narrow">
      <div class="page-h"><h1>تنظیمات</h1></div>
      <form class="card" data-form="settings">
        <h2>فروشگاه</h2>
        <div class="grid2">
          <label>نام فروشگاه<input name="name" value="${esc(s.name)}"></label>
          <label>آیدی اینستاگرام<input name="handle" dir="ltr" value="${esc(s.handle)}"></label>
          <label>شماره کارت<input name="card" dir="ltr" inputmode="numeric" value="${esc(cardFmt(s.card))}"></label>
          <label>به نام<input name="owner" value="${esc(s.cardOwner)}"></label>
        </div>
        <label>پیام خوش‌آمد بالای فرم<textarea name="welcome" rows="2">${esc(s.welcome || "")}</textarea></label>
        <h2>ارسال</h2>
        <div id="ship-rows">${s.shipping.map(shipRow).join("")}</div>
        <button type="button" class="btn small ghost" data-act="add-ship">${icon("plus")} روش ارسال</button>
        <label>ارسال رایگان برای خرید بالای (۰ یعنی ندارد)<input name="free" inputmode="numeric" value="${num(s.freeShipMin || 0)}"></label>
        <h2>فیلدهای سفارش</h2>
        <label class="check"><input type="checkbox" name="askDate" ${s.askDate ? "checked" : ""}> پرسیدن «تا چه تاریخی لازم دارید؟»</label>
        <div id="field-rows">${s.customFields.map(fieldRow).join("")}</div>
        <button type="button" class="btn small ghost" data-act="add-field">${icon("plus")} فیلد تازه</button>
        <button class="btn primary block" type="submit">ذخیره</button>
      </form>
      <section class="card">
        <h2>پشتیبان</h2>
        <p class="muted small">همه‌چیز فقط در همین مرورگر است. اگر حافظه‌ی مرورگر پاک شود یا گوشی عوض شود، دفترچه هم پاک می‌شود؛ هفته‌ای یک بار فایل پشتیبان بگیرید.</p>
        <div class="row-actions">
          <button class="btn" data-act="export">${icon("download")} دریافت فایل پشتیبان</button>
          <label class="btn ghost">${icon("upload")} بازگردانی از فایل<input type="file" accept="application/json,.json" data-act-change="import" hidden></label>
        </div>
      </section>
      <section class="card">
        <h2>${st.demo ? "خروج از نسخه‌ی نمایشی" : "پاک کردن دفترچه"}</h2>
        <button class="btn ghost danger" data-act="reset">${icon("trash")} ${st.demo ? "پاک کردن داده‌های نمایشی" : "پاک کردن همه‌چیز"}</button>
      </section>
    </div>`;
  },
  actions: {
    "add-ship"(el, ev, root) { root.querySelector("#ship-rows").insertAdjacentHTML("beforeend", shipRow()); },
    "add-field"(el, ev, root) { root.querySelector("#field-rows").insertAdjacentHTML("beforeend", fieldRow()); },
    export() {
      const blob = new Blob([JSON.stringify(getState(), null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `daftarche-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    async import(el) {
      const file = el.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data?.v !== 1 || !data.shop) throw new Error("bad");
        if (!confirm("دفترچه‌ی فعلی با فایل پشتیبان جایگزین شود؟")) return;
        replaceState(data);
        toast("بازگردانی شد", "ok");
        go("#/home");
      } catch {
        toast("این فایل پشتیبان دفترچه نیست", "bad");
      }
    },
    reset() {
      if (!confirm("همه‌ی سفارش‌ها و مشتری‌های این دفترچه پاک شود؟")) return;
      resetAll();
      go("#/");
    },
  },
  forms: {
    settings(f, fd) {
      const s = getState().shop;
      s.name = norm(fd.get("name")) || s.name;
      s.handle = igHandle(fd.get("handle")) || s.handle;
      s.card = norm(fd.get("card")).replace(/\D/g, "");
      s.cardOwner = norm(fd.get("owner"));
      s.welcome = norm(fd.get("welcome"));
      s.freeShipMin = toInt(fd.get("free")) || 0;
      s.askDate = !!fd.get("askDate");
      const names = fd.getAll("sname"), fees = fd.getAll("sfee"), ids = fd.getAll("sid");
      const ship = [];
      names.forEach((n, i) => { if (norm(n)) ship.push({ id: ids[i] || "s" + (i + 1) + Date.now().toString(36).slice(-3), name: norm(n), fee: toInt(fees[i]) || 0 }); });
      if (ship.length) s.shipping = ship;
      const labels = fd.getAll("flabel"), fids = fd.getAll("fid");
      s.customFields = labels.map((l, i) => ({ id: fids[i] || "f" + Date.now().toString(36) + i, label: norm(l) })).filter((x) => x.label);
      save();
      toast("ذخیره شد", "ok");
    },
  },
};
