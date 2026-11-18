/* Headless-Lader für Race Control: lädt alle Spielskripte in einen vm-Kontext mit DOM-Attrappe. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../race-control");

function stub(name = "stub") {
  const fn = function () {};
  fn.__props = {};
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return (hint) => (hint === "string" ? "" : 0);
      if (k === Symbol.iterator) return function* () {};
      if (k === "then") return undefined;
      if (k === "length") return 0;
      if (k === "children" || k === "childNodes") return [];
      if (k === "contains") return () => false;
      if (k in t && k !== "prototype" && k !== "name") return t[k];
      if (!(k in t.__props)) t.__props[k] = stub(String(k));
      return t.__props[k];
    },
    set(t, k, v) { t.__props[k] = v; return true; },
    apply() { return stub(name + "()"); },
    construct() { return stub("new " + name); },
    has() { return true; },
  });
}

export function loadGame({ track = "madrid", quiet = true, root = ROOT } = {}) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const files = [...html.matchAll(/<script src="([a-z0-9-]+\.js)(?:\?[^"]*)?"><\/script>/g)].map((m) => m[1]);
  const store = new Map();
  const g = {
    console: quiet ? { log() {}, warn() {}, error: console.error, info() {} } : console,
    Math, JSON, Date, Float32Array, Uint8Array, Uint16Array, Int16Array, Int32Array, Float64Array, Uint32Array,
    Map, Set, WeakMap, Array, Object, String, Number, Boolean, RegExp, Error, Promise, Symbol, Proxy, Reflect, isFinite, isNaN, parseInt, parseFloat,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: stub("document"),
    getComputedStyle: () => ({ position: "absolute" }),
    Image: function () { return stub("img"); },
    Path2D: function () { return stub("path"); },
    AudioContext: undefined, webkitAudioContext: undefined,
    devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    location: { search: "", hash: "", hostname: "localhost" },
    navigator: { userAgent: "node" },
  };
  g.window = g; g.self = g; g.globalThis = g;
  const ctx = vm.createContext(g);
  let src = "";
  for (const f of files) src += fs.readFileSync(path.join(root, f), "utf8").replace(/^"use strict";/, "") + "\n;\n";
  src += `\n;globalThis.__G={get S(){return S;},set S(v){S=v;},get W(){return W;},get REC(){return REC;},get TRACK(){return TRACK;},get L(){return L;}};`;
  vm.runInContext('"use strict";' + src, ctx, { filename: "race-control-bundle.js" });
  return ctx;
}

/* Ruft fn in allen Funktionen mit Namen names mit; liefert Zähler */
export function countCalls(ctx, names) {
  const cnt = Object.fromEntries(names.map((n) => [n, 0]));
  for (const n of names) {
    vm.runInContext(`{const __o=${n};${n}=function(...a){__cnt.${n}++;return __o.apply(this,a);};}`, Object.assign(ctx, { __cnt: cnt }));
  }
  return cnt;
}

/* Spielt die Rennleitung minimal: Formationsrunde, Lichter, Start */
export function autopilot(ctx) {
  vm.runInContext(`if(S.type==="race"){if(S.phase==="pre")startFormation();else if(S.phase==="gridwait"){if(S.stall)abortStart();else startLights();}else if(S.phase==="lights"&&S.holdReady)lightsOut();}
    else if(!S.started)openPitExit();
    if(S.hazard&&(S.hazard.t||0)>12&&!S.hazard.nuke){S.hazard.cars.forEach(c=>c.removed=true);S.hazard=null;S.sec=[0,0,0];}
    for(const inc of S.incidents)if(inc.status==="open"){try{decide(inc,"nfa");}catch(e){inc.status="done";}if(inc.status==="open")inc.status="done";}`, ctx);
}
