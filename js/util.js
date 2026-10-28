// Small helpers shared by every view: Persian text normalisation, formatting, ids.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian/Arabic digits -> Latin, Arabic yeh/kaf -> Persian, trims. */
export function norm(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d))
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌+/g, "‌")
    .trim();
}

/** Latin digits -> Persian digits (for display only). */
export function fa(s) {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[d]);
}

/** Parse a user-typed amount ("۱۲۰٬۰۰۰", "120,000") into an integer, or null. */
export function toInt(s) {
  const t = norm(s).replace(/[,٬،\s]/g, "");
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

const nf = new Intl.NumberFormat("fa-IR");
export const num = (n) => nf.format(Math.round(n || 0));
export const toman = (n) => `${num(n)} تومان`;

/** Normalise an Iranian mobile number to 09xxxxxxxxx, or "" if it is not one. */
export function phoneKey(s) {
  const d = norm(s).replace(/[^\d+]/g, "");
  const m = d.match(/^(?:\+98|0098|98|0)?(9\d{9})$/);
  return m ? "0" + m[1] : "";
}

export const igHandle = (s) => norm(s).replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();

/** HTML-escape anything interpolated into a template. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Wrap Latin/number runs (phone, card, tracking) so they stay LTR inside RTL text. */
export const ltr = (s) => `<bdi dir="ltr" class="ltr">${esc(s)}</bdi>`;

const ID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function shortId(n = 4) {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(a, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

export const DAY = 86400000;
export const now = () => Date.now();
export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

/** Card number grouped in fours, always LTR. */
export const cardFmt = (s) => norm(s).replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1-");

export function plural(n, word) {
  return `${fa(n)} ${word}`;
}

/** "۳ روز پیش", "امروز", "۲ ساعت پیش" */
export function ago(t) {
  const diff = now() - t;
  if (diff < 3600000) return diff < 120000 ? "همین الان" : `${fa(Math.floor(diff / 60000))} دقیقه پیش`;
  const days = daysBetween(t, now());
  if (days === 0) return `${fa(Math.floor(diff / 3600000))} ساعت پیش`;
  if (days === 1) return "دیروز";
  if (days < 30) return `${fa(days)} روز پیش`;
  if (days < 365) return `${fa(Math.round(days / 30))} ماه پیش`;
  return `${fa(Math.round(days / 365))} سال پیش`;
}

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** sms: link that opens the phone's SMS app with the body filled in. */
export function smsHref(phone, body) {
  const sep = isIOS() ? "&" : "?";
  return `sms:${phoneKey(phone) || ""}${sep}body=${encodeURIComponent(body)}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

/** Base URL of the app (works on localhost and under /<repo>/ on GitHub Pages). */
export const appBase = () => location.origin + location.pathname;
