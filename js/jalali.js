// Jalali <-> Gregorian conversion (algorithm from jalaali-js, MIT) plus display helpers.

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy) {
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function toJalali(t) {
  const d = new Date(t);
  return d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
}

/** Local-midnight timestamp for a Jalali date. */
export function fromJalali(jy, jm, jd) {
  const r = jalCal(jy);
  const g = d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
  return new Date(g.gy, g.gm - 1, g.gd).getTime();
}

export const monthLength = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jalCal(jy).leap === 0 ? 30 : 29);

export const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

const dayFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" });
const fullFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" });

export const jDay = (t) => dayFmt.format(t);           // ۵ مهر
export const jFull = (t) => fullFmt.format(t);         // ۵ مهر ۱۴۰۵
export const jTime = (t) => timeFmt.format(t);         // ۲۳:۴۰
export const jWeekday = (t) => weekdayFmt.format(t);   // دوشنبه ۵ مهر
export const jDateTime = (t) => `${dayFmt.format(t)}، ساعت ${timeFmt.format(t)}`;
