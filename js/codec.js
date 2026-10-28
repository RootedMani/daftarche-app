// Everything that travels between seller and customer is packed into the link itself:
// JSON -> UTF-8 -> deflate (when the browser supports it) -> base64url.
// Prefix "z" = deflated, "j" = plain, so old browsers can still read plain payloads.

import { appBase } from "./util.js";

const hasCompression = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buf);
}

export async function encode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (hasCompression) {
    const z = await pipe(raw, new CompressionStream("deflate-raw"));
    if (z.length < raw.length) return "z" + b64url(z);
  }
  return "j" + b64url(raw);
}

export async function decode(str) {
  const kind = str[0];
  let bytes = unb64url(str.slice(1));
  if (kind === "z") {
    if (!hasCompression) throw new Error("old-browser");
    bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  } else if (kind !== "j") {
    throw new Error("bad-payload");
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Link types: o = order form (seller -> customer), i = incoming order (customer -> seller), s = status (seller -> customer). */
export async function makeLink(kind, obj) {
  return `${appBase()}#${kind}=${await encode(obj)}`;
}

/** Find the first daftarche link of the given kinds inside arbitrary pasted text. */
export function findLink(text, kinds = "ios") {
  const m = String(text).match(new RegExp(`#([${kinds}])=([zj][A-Za-z0-9_-]+)`));
  return m ? { kind: m[1], payload: m[2] } : null;
}
