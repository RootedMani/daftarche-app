// Router, app shell and event delegation.

import { esc, fa } from "./util.js";
import { getState, hasShop, OPEN, reminders, isOverdue, resetAll } from "./store.js";
import { orderFormLink } from "./links.js";
import { icon, toast, copyFrom, shareFrom } from "./ui.js";
import { orderForm, sentPage, statusPage, incomingNoShop } from "./views/public.js";
import { board, orderDetail, receive, quick, editor, setRerender } from "./views/orders.js";
import { customerList, customerPage, reminderPage } from "./views/people.js";
import { landing, setup, home, products, share, settings, logoMark } from "./views/shop.js";

const root = document.getElementById("app");
const VIEWS = [orderForm, sentPage, statusPage, incomingNoShop, board, orderDetail, receive, quick, editor, customerList, customerPage, reminderPage, landing, setup, home, products, share, settings];
const ACTIONS = Object.assign({}, ...VIEWS.map((v) => v.actions || {}));
const FORMS = Object.assign({}, ...VIEWS.map((v) => v.forms || {}));

const SELLER_ROUTES = {
  home: [home, "home", "خانه"],
  board: [board, "board", "سفارش‌ها"],
  order: [orderDetail, "board", "سفارش"],
  receive: [receive, "receive", "دریافت سفارش"],
  quick: [quick, "receive", "ثبت سریع"],
  new: [editor, "board", "سفارش تازه"],
  edit: [editor, "board", "ویرایش سفارش"],
  customers: [customerList, "customers", "مشتری‌ها"],
  c: [customerPage, "customers", "مشتری"],
  reminders: [reminderPage, "reminders", "یادآور"],
  products: [products, "products", "محصولات"],
  share: [share, "share", "لینک سفارش"],
  settings: [settings, "settings", "تنظیمات"],
};

let current = { view: null, arg: null, shell: false, nav: "" };

function route() {
  const h = location.hash || "#/";
  const link = h.match(/^#([ois])=(.+)$/);
  if (link) {
    const [, kind, payload] = link;
    if (kind === "o") return { view: orderForm, payload, title: "ثبت سفارش" };
    if (kind === "s") return { view: statusPage, payload, title: "وضعیت سفارش" };
    if (hasShop()) return { view: receive, payload, shell: true, nav: "receive", title: "دریافت سفارش" };
    return { view: incomingNoShop, title: "سفارش" };
  }
  if (h === "#sent") return { view: sentPage, title: "سفارش ثبت شد" };
  const [name, ...rest] = h.replace(/^#\/?/, "").split("/");
  const arg = rest.length ? decodeURIComponent(rest.join("/")) : null;
  if (name === "setup") return { view: setup, shell: hasShop(), nav: "settings", title: "ساخت دفترچه" };
  if (!hasShop()) return { view: landing, title: "دفترچه" };
  const r = SELLER_ROUTES[name] || SELLER_ROUTES.home;
  return { view: r[0], arg, shell: true, nav: r[1], title: r[2] };
}

function navLink(id, href, ic, label, badge = "") {
  return `<a class="nav-a ${current.nav === id ? "on" : ""}" href="${href}" ${current.nav === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${badge}</a>`;
}

function shell(inner) {
  const st = getState();
  const open = st.orders.filter((o) => OPEN.includes(o.status) && o.status !== "shipped").length;
  const hot = st.orders.some(isOverdue);
  const rem = reminders().length;
  const b = (n, cls = "") => (n ? `<span class="nbadge ${cls}">${fa(n)}</span>` : "");
  return `<div class="app">
    <aside class="side">
      <div class="brand">${logoMark()}<div><b>دفترچه</b><div class="muted small">${esc(st.shop.name)}</div></div></div>
      <nav>
        ${navLink("home", "#/home", "home", "خانه")}
        ${navLink("board", "#/board", "board", "سفارش‌ها", b(open, hot ? "hot" : ""))}
        ${navLink("receive", "#/receive", "inbox", "دریافت سفارش")}
        ${navLink("customers", "#/customers", "users", "مشتری‌ها")}
        ${navLink("reminders", "#/reminders", "bell", "یادآور", b(rem))}
        ${navLink("products", "#/products", "chart", "محصولات و سود")}
        ${navLink("share", "#/share", "link", "لینک سفارش من")}
        ${navLink("settings", "#/settings", "gear", "تنظیمات")}
      </nav>
    </aside>
    <div class="main">
      ${st.demo ? `<div class="demo-bar"><span><b>نسخه‌ی نمایشی</b> با داده‌های ساختگی</span>
        <button class="link-btn" data-act="demo-customer">${icon("eye")} سفارش از دید مشتری</button>
        <button class="link-btn" data-act="exit-demo">خروج</button></div>` : ""}
      <header class="topbar">
        <a class="brand" href="#/home">${logoMark()}<b>${esc(st.shop.name)}</b></a>
        <div class="top-actions">
          <a href="#/products" aria-label="محصولات">${icon("chart")}</a>
          <a href="#/share" aria-label="لینک سفارش">${icon("link")}</a>
          <a href="#/settings" aria-label="تنظیمات">${icon("gear")}</a>
        </div>
      </header>
      <div id="view">${inner}</div>
    </div>
    <nav class="tabbar">
      ${navLink("home", "#/home", "home", "خانه")}
      ${navLink("board", "#/board", "board", "سفارش‌ها", b(open, hot ? "hot" : ""))}
      <a class="nav-a fab ${current.nav === "receive" ? "on" : ""}" href="#/receive">${icon("inbox")}<span>دریافت</span></a>
      ${navLink("customers", "#/customers", "users", "مشتری‌ها")}
      ${navLink("reminders", "#/reminders", "bell", "یادآور", b(rem))}
    </nav>
  </div>`;
}

async function render({ fresh = true } = {}) {
  const r = fresh ? route() : current;
  if (fresh) {
    try {
      if (r.view.load) await r.view.load(r.payload || null);
    } catch (e) {
      root.innerHTML = `<main class="pub"><div class="hello bad">${e.message === "old-browser" ? "مرورگر شما قدیمی است و این لینک را باز نمی‌کند. لطفاً با کروم یا سافاری جدید باز کنید." : "این لینک ناقص است؛ احتمالاً موقع کپی کامل نشده. لطفاً دوباره کامل کپی کنید."}</div><a class="btn" href="./">صفحه‌ی اصلی دفترچه</a></main>`;
      return;
    }
    current = r;
  }
  const y = window.scrollY;
  const html = r.view.render(r.arg);
  root.innerHTML = r.shell ? shell(html) : html;
  document.title = `${r.title || "دفترچه"} · دفترچه`;
  if (fresh) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
  await r.view.mount?.(root, r.arg);
}

const rerender = () => render({ fresh: false });
setRerender(rerender);

const GLOBAL = {
  "copy-send": (el) => copyFrom(el.dataset.target),
  "share-send": (el) => shareFrom(el.dataset.target),
  // same tab: popup blockers stop window.open after an await, and storage is shared so the way back still works
  async "demo-customer"() {
    const st = getState();
    location.href = await orderFormLink(st.shop, st.products);
  },
  "exit-demo"() {
    if (!confirm("از نسخه‌ی نمایشی خارج شوید؟ داده‌های نمایشی پاک می‌شوند.")) return;
    resetAll();
    location.hash = "#/";
  },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = GLOBAL[el.dataset.act] || ACTIONS[el.dataset.act];
  if (!fn) return;
  if (!("keepDefault" in el.dataset)) e.preventDefault();
  Promise.resolve(fn(el, e, root, current.arg, rerender)).catch((err) => { console.error(err); toast("خطایی پیش آمد", "bad"); });
});

document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-act-change]");
  const fn = el && ACTIONS[el.dataset.actChange];
  if (fn) Promise.resolve(fn(el, e, root, current.arg, rerender)).catch(console.error);
});

document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form];
  if (fn) Promise.resolve(fn(f, new FormData(f), root, current.arg, rerender)).catch((err) => { console.error(err); toast("خطایی پیش آمد", "bad"); });
});

window.addEventListener("hashchange", () => render());
render();
