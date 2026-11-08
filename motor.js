/* MOTOR DE LA APP: sesiones guiadas, registro, entrenador, voz, cámara, guardado y GitHub.
   Lee el programa de programa.js y las figuras de figuras.js. */
(function () {
"use strict";
/* ===================== Utilidades ===================== */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
function secsLabel(s) {
  if (s >= 60 && s % 60 === 0) return (s / 60) + " min";
  if (s >= 60) return fmt(s);
  return s + " s";
}
function minLabel(sec) { return Math.round(sec / 60) + " min"; }
function spoken(t) {
  return String(t).replace(/(\d)\s*-\s*(\d)/g, "$1 a $2").replace(/×/g, "por").replace(/~/g, "unos ").replace(/[“”]/g, "").replace(/\bRIR\b/g, "en reserva");
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function uniq(arr) { var o = []; arr.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
function $(id) { return document.getElementById(id); }

/* ===================== Fechas ===================== */
function iso(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
function isoWeek(s) {
  var d = parseISO(s);
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  var w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week: w, id: t.getUTCFullYear() + "-W" + String(w).padStart(2, "0") };
}
function weekDates(s) { var d = parseISO(s), dow = d.getDay() || 7, mon = addDays(s, 1 - dow), out = []; for (var i = 0; i < 7; i++) out.push(addDays(mon, i)); return out; }
function dayKeyOf(s) { var dow = parseISO(s).getDay(); for (var k in DAYS) if (DAYS[k].dow === dow) return k; return "lun"; }
var MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function shortDate(s) { var d = parseISO(s); return d.getDate() + " " + MONTHS[d.getMonth()]; }
function TODAY() { return iso(new Date()); }

/* ===================== Guardado =====================
   Todo vive primero en este dispositivo (localStorage). Si la página corre publicada con tu
   cuenta, los registros se copian a tu espacio privado (data/users/<tu id>) y se sincronizan. */
/* Quién usa la app y cómo se guardan sus datos: viene de PERFIL en programa.js */
var PF = typeof PERFIL !== "undefined" && PERFIL ? PERFIL : {};
var NOMBRE = PF.nombre || "Ram", PROG = PF.prog || "3.0", APPN = PF.app || "Sistema 3.0";
var CUERPO = PF.cuerpo || {}, CINT = CUERPO.cinturaMax || 88, KG0 = CUERPO.kgMes ? CUERPO.kgMes[0] : 0.3, KG1 = CUERPO.kgMes ? CUERPO.kgMes[1] : 0.6;
var LS_KEY = PF.guardado || "s3v2";
var REPO_DATOS = PF.repoDatos || "entreno-datos";   // repositorio privado de GitHub con sus datos
var ST = { prefs: {}, run: null, recs: {} };
var cloud = { db: null, col: null, state: "local", queue: {}, busy: {}, pulledAt: 0 };

function lsGet(k) { try { var raw = window.localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function loadLocal() {
  var old = lsGet(LS_KEY);
  if (old && typeof old === "object" && old.recs) { lsSet(LS_KEY + ".recs", old.recs); lsSet(LS_KEY + ".prefs", old.prefs || {}); lsSet(LS_KEY, null); }
  ST.prefs = lsGet(LS_KEY + ".prefs") || {};
  ST.run = lsGet(LS_KEY + ".run");
  ST.recs = lsGet(LS_KEY + ".recs") || {};
}
function saveLocal() { lsSet(LS_KEY + ".recs", ST.recs); }
function pref(k, d) { return ST.prefs[k] == null ? d : ST.prefs[k]; }
function setPref(k, v) { ST.prefs[k] = v; lsSet(LS_KEY + ".prefs", ST.prefs); prefSyncPut(k, v); }
function rec(id) { return ST.recs[id] || null; }
function recsOf(kind) {
  var out = [];
  for (var id in ST.recs) if (ST.recs[id] && ST.recs[id].k === kind) out.push(ST.recs[id]);
  return out;
}
function put(r) {
  r.u = Date.now();
  ST.recs[r.id] = r;
  saveLocal();
  queueCloud(r);
  ghMark(r);
  return r;
}
function setRun(v) { ST.run = v; lsSet(LS_KEY + ".run", v); }

function queueCloud(r) {
  if (!cloud.col) return;
  cloud.queue[r.id] = r;
  setTimeout(function () { flushOne(r.id); }, 800);
}
function flushOne(id) {
  if (!cloud.col || cloud.busy[id] || !cloud.queue[id]) return;
  var r = cloud.queue[id]; delete cloud.queue[id];
  cloud.busy[id] = true;
  var body = JSON.parse(JSON.stringify(r));
  Promise.resolve().then(function () { return cloud.col.doc(id).set(body); }).then(function () {
    cloud.busy[id] = false;
    if (cloud.state !== "cloud") { cloud.state = "cloud"; paintSync(); }
    if (cloud.queue[id]) flushOne(id);
  }).catch(function (e) {
    cloud.busy[id] = false;
    var code = e && e.code;
    if (code === "unavailable") { cloud.queue[id] = cloud.queue[id] || r; setTimeout(function () { flushOne(id); }, 2500 + Math.random() * 2000); }
    else if (code === "quota_exceeded") { cloud.state = "full"; paintSync(); }
    else { cloud.state = "local"; cloud.col = null; paintSync(); }
  });
}
function pullCloud(then) {
  if (!cloud.col) { if (then) then(false); return; }
  cloud.col.orderBy("u", "desc").limit(900).get().then(function (snap) {
    var changed = false, remote = {};
    snap.docs.forEach(function (d) {
      var v = d.data(); if (!v || !v.id) return;
      remote[v.id] = true;
      var mine = ST.recs[v.id];
      if (!mine || (v.u || 0) > (mine.u || 0)) { ST.recs[v.id] = JSON.parse(JSON.stringify(v)); changed = true; }
    });
    for (var id in ST.recs) { if (!remote[id] && ST.recs[id] && ST.recs[id].k) queueCloud(ST.recs[id]); }
    cloud.pulledAt = Date.now(); cloud.state = "cloud";
    if (changed) saveLocal();
    paintSync();
    if (then) then(changed);
  }).catch(function () { if (then) then(false); });
}
function initCloud(onChange) {
  if (!window.claude || typeof window.claude.use !== "function") { paintSync(); return; }
  Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (res) {
    var db = res[0], user = res[1];
    if (!db || !user) { paintSync(); return null; }
    return Promise.resolve(user.id()).then(function (uid) {
      if (!uid) { paintSync(); return; }
      try { cloud.col = db.collection("data/users/" + uid); cloud.db = db; } catch (e) { cloud.col = null; }
      pullCloud(function (changed) { if (changed && onChange) onChange(); });
    });
  }).catch(function () { paintSync(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && cloud.col && Date.now() - cloud.pulledAt > 5 * 60 * 1000) pullCloud(function (c) { if (c && onChange) onChange(); });
  });
}
function paintSync() {
  var el = $("sync"); if (!el) return;
  if (ghReady()) { el.textContent = "GitHub: " + ghStatusText(); el.className = "sync " + (GH.err ? "gh-err" : "gh-ok"); return; }
  var t = cloud.state === "cloud" ? "Guardado en tu cuenta" : cloud.state === "full" ? "Espacio lleno: exporta y limpia" : "Guardado solo en este dispositivo. Para juntarlo con tus otros equipos, conecta GitHub (más arriba).";
  el.textContent = t; el.className = "sync " + cloud.state;
}

/* ===================== Configuración de semana ===================== */
function cfg() { return rec("config") || { id: "config", k: "cfg", abFlip: false, deload: [] }; }
function saveCfg(c) { c.id = "config"; c.k = "cfg"; put(c); }
function weekAB(s) { var w = isoWeek(s).week % 2 === 1 ? "B" : "A"; if (cfg().abFlip) w = w === "A" ? "B" : "A"; return w; }
function isDeload(s) { return (cfg().deload || []).indexOf(isoWeek(s).id) >= 0; }
function setDeload(weekId, on) {
  var c = clone(cfg()), list = (c.deload || []).filter(function (w) { return w !== weekId; });
  if (on) list.push(weekId);
  c.deload = list.sort();
  c.dl = c.dl || {}; c.dl[weekId] = [on ? 1 : 0, Date.now()];
  saveCfg(c);
}
function weeksSinceDeload(s) {
  var list = (cfg().deload || []).filter(function (w) { return w <= isoWeek(s).id; });
  var first = Object.keys(ST.recs).map(function (k) { return ST.recs[k]; }).filter(function (r) { return r.k === "log"; }).map(function (r) { return r.d; }).sort()[0];
  var ref = list.length ? list[list.length - 1] : (first ? isoWeek(first).id : null);
  if (!ref) return null;
  var a = isoWeek(s), p = ref.split("-W");
  return (a.year - +p[0]) * 52 + (a.week - +p[1]);
}

/* ===================== Ejercicios y peldaños ===================== */
function levels() { var r = rec("niveles"); return (r && r.L) || {}; }
function rungOf(id) { var L = levels(); return L[id] == null ? 0 : L[id]; }
function setRung(id, i, why) {
  var r = rec("niveles") || { id: "niveles", k: "lvl", L: {} };
  r = JSON.parse(JSON.stringify(r));
  var from = r.L[id] == null ? 0 : r.L[id], now = Date.now();
  r.L[id] = i; r.Lt = r.Lt || {}; r.Lt[id] = now;
  if (from !== i) r.H = (r.H || []).concat([{ x: id, from: from, to: i, d: TODAY(), t: now, why: why || "" }]).slice(-300);
  put(r);
}
function rungText(lib, i) { var x = lib.ladder && lib.ladder[i]; return x == null ? "" : (typeof x === "string" ? x : x.t); }
function rungOverride(lib, i) {
  var o = {};
  if (!lib.ladder) return o;
  for (var j = 0; j <= i && j < lib.ladder.length; j++) { var x = lib.ladder[j]; if (x && typeof x === "object" && x.o) for (var k in x.o) o[k] = x.o[k]; }
  return o;
}
/* Prescripción final de un ejercicio: biblioteca + sesión + peldaño actual */
function loadText(x) { return x.rungText && x.rung === 0 && x.load && x.rungText.indexOf(x.load) === 0 ? x.rungText : (x.load || ""); }
function resolve(e) {
  var lib = EX[e.id] || {};
  var r = {};
  for (var k in lib) r[k] = lib[k];
  for (var k2 in e) r[k2] = e[k2];
  var lv = rungOf(e.id), o = rungOverride(lib, lv);
  for (var k3 in o) r[k3] = o[k3];
  r.rung = lv; r.rungText = rungText(lib, lv); r.rungs = lib.ladder ? lib.ladder.length : 0;
  r.phNames = Array.isArray(lib.ph) ? lib.ph : (PH[lib.ph] || PH.squat);
  return r;
}

/* ===================== Tiempos ===================== */
var EST = { over: 8, side: 6, lead: 3, pos: 5, step: 1.2, item: 30, flowOver: 2, flowLead: 1.5 };
/* 6.0: sesión continua. Todo avanza solo: la serie empieza al terminar el descanso, termina sola
   al llegar al tope (con tempo) o al acabar su tiempo (sin tempo), y entre ejercicios distintos sin
   descanso hay un «cambio» corto con su cuenta. Así el plan dura lo que de verdad dura. */
function flowOn() { return pref("flujo", true) !== false; }
function topEnd(x) { return flowOn() && pref("topeFin", true) !== false && pref("tempo", false) && !!x && x.pacer !== false && x.unit !== "pasos" && !!tempoParts(x.tempo); }
function workSecs(x) { if (x.unit === "pasos") return repsMid(x.reps) * EST.step; return (topEnd(x) ? repsRange(x.reps)[1] : repsMid(x.reps)) * repSec(x.tempo); }
function tempoParts(t) {
  if (!t || !/^[\dX]+-[\dX]+-[\dX]+-[\dX]+$/.test(t)) return null;
  return t.split("-").map(function (x) { return x === "X" ? { s: 1, x: true } : { s: +x, x: false }; });
}
function repSec(t) { var p = tempoParts(t); if (!p) return t === "Lento" ? 5 : 3; return p.reduce(function (a, q) { return a + q.s; }, 0); }
function repsRange(r) { var m = String(r || "").match(/(\d+)(?:-(\d+))?/); if (!m) return [0, 0]; var a = +m[1], b = m[2] ? +m[2] : a; return [a, b]; }
function repsMid(r) { var x = repsRange(r); return Math.round((x[0] + x[1]) / 2); }
function stepEst(st) {
  var x = st.ex;
  if (st.type === "work") {
    if (flowOn()) return workSecs(x) + (st.side === 2 ? EST.side : st.afterTr ? EST.flowLead : EST.flowOver);
    if (x.unit === "pasos") return repsMid(x.reps) * EST.step + (st.side ? EST.side : EST.over);
    var per = repsMid(x.reps) * repSec(x.tempo);
    return per + (st.side ? EST.side : EST.over);
  }
  if (st.type === "hold") return x.hold + (flowOn() ? (st.side === 2 ? EST.side : EST.flowLead) : EST.lead + EST.pos);
  if (st.type === "tr") return st.dur;
  if (st.type === "rest" || st.type === "gap") return st.dur;
  if (st.type === "itemhold") return st.dur + (flowOn() ? EST.flowLead : 4);
  if (st.type === "item") return st.item.est || EST.item;
  if (st.type === "phase" || st.type === "seg") return st.dur;
  if (st.type === "wait") return 0;
  return 0;
}

/* ===================== Construcción del plan =====================
   opts: { mode: "full" | "mod" | "stop", deload: bool } */
function halfUp(n) { return Math.max(1, Math.ceil(n / 2)); }
function blocksFor(D, opts) {
  if (opts.mode === "stop" && D.stopPlan) return D.stopPlan.blocks;
  return D.blocks;
}
function buildPlan(D, opts) {
  opts = opts || { mode: "full", deload: false };
  var blocks = blocksFor(D, opts), out = [], all = [];
  var std = opts.mode === "full" && !opts.deload, flow = flowOn(), prevLast = null;
  blocks.forEach(function (b) {
    var steps = stepsForBlock(b, opts);
    if (flow) { steps = withChanges(steps, prevLast); prevLast = steps.length ? steps[steps.length - 1] : prevLast; }
    var stdSteps = stepsForBlock(b, { mode: "full", deload: false });
    var est = steps.reduce(function (a, s) { return a + stepEst(s); }, 0);
    var estStd = stdSteps.reduce(function (a, s) { return a + stepEst(s); }, 0);
    var docLen = (b.end != null && b.start != null) ? b.end - b.start : null;
    var len;
    if (b.kind === "emom") {
      var rounds = opts.deload ? halfUp(b.rounds) : b.rounds;
      len = (std && docLen && !flow) ? docLen : rounds * b.interval + (b.afterRest || 0);
    } else if (flow && b.kind !== "phase") {
      len = Math.round(est);   // 6.0: lo que de verdad suman los pasos con el peldaño de hoy
    } else if (docLen != null) {
      len = std ? docLen : (estStd > 0 ? Math.round(docLen * est / estStd) : docLen);
    } else {
      len = b.len || Math.round(est);
    }
    out.push({ b: b, steps: steps, len: len, est: est });
  });
  var t = 0;
  out.forEach(function (o) {
    o.start = t; o.end = t + o.len;
    var acc = 0, tot = o.est || 1;
    o.steps.forEach(function (s) {
      if (s.type === "wait") s.target = o.start + s.roundStart * o.b.interval;
      s.planAt = Math.round(o.start + (o.len * acc / tot));
      acc += stepEst(s);
      s.blockPlan = o;
      all.push(s);
    });
    t = o.end;
  });
  return { blocks: out, steps: all, total: t, opts: opts };
}
function stepsForBlock(b, opts) {
  var steps = [], mod = opts.mode === "mod";
  if (b.kind === "list") {
    b.items.forEach(function (it) {
      if (mod && it.skipMod) return;
      var sets = it.sets || 1, sides = it.sides || 1;
      for (var s = 1; s <= sets; s++) {
        for (var sd = 1; sd <= sides; sd++) {
          steps.push({ type: it.secs ? "itemhold" : "item", block: b, item: it, dur: it.secs || 0, set: s, sets: sets, side: sides > 1 ? sd : 0 });
        }
        if (it.gap && s < sets) steps.push({ type: "gap", block: b, dur: it.gap, item: it });
      }
    });
    return steps;
  }
  if (b.kind === "phase") {
    var px = resolve(b.ex);
    steps.push({ type: "phase", block: b, ex: px, dur: px.hold, metronome: !!b.metronome, checks: b.checks || [] });
    return steps;
  }
  var exs = b.ex.map(resolve).filter(function (x) { return !(mod && x.skipMod); });
  if (!exs.length) return steps;
  var rounds = opts.deload ? halfUp(b.rounds) : b.rounds;
  if (b.kind === "emom") {
    steps.push({ type: "wait", block: b, target: null, roundStart: 0, first: true });
    for (var r = 1; r <= rounds; r++) {
      exs.forEach(function (x) { pushWork(steps, b, x, r, rounds); });
      if (r < rounds) steps.push({ type: "wait", block: b, roundStart: r, round: r });
      else if (b.afterRest) steps.push({ type: "rest", block: b, dur: b.afterRest, round: r, note: b.afterNote });
    }
    return steps;
  }
  for (var rr = 1; rr <= rounds; rr++) {
    exs.forEach(function (x) {
      var sets = opts.deload ? halfUp(x.sets) : x.sets;
      if (rr > sets) return;
      pushWork(steps, b, x, rr, Math.min(rounds, sets));
      if (x.rest > 0) steps.push({ type: "rest", block: b, dur: x.rest, round: rr, after: x.id });
    });
  }
  var rests = steps.filter(function (s) { return s.type === "rest"; });
  if (b.note && rests.length) {
    var at = b.noteAt || "all";
    rests.forEach(function (s, i) { if (at === "all" || (at === "first" && i === 0) || (at === "last" && i === rests.length - 1)) s.note = b.note; });
  }
  return steps;
}
function pushWork(steps, b, x, r, rounds) {
  var isHold = !!x.hold;
  var sides = x.side ? 2 : 1;
  for (var sd = 1; sd <= sides; sd++) {
    steps.push({ type: isHold ? "hold" : "work", block: b, ex: x, dur: isHold ? x.hold : 0, round: r, rounds: rounds, side: sides > 1 ? sd : 0 });
  }
}
function planFor(D, date) {
  var mode = "full";
  if (D.filter) { var f = rec("flt_" + date); if (f && f.mode) mode = f.mode; if (isNoLegs(date)) mode = "stop"; }
  var deload = D.type === "train" && isDeload(date);
  var DD = D.key === "sab" && mode !== "stop" && phaseN() >= 2 ? sabPhase2(D) : D;
  if (D.key === "lun" && cfg().lunD3) DD = lunD3Plan(DD);
  var p = buildPlan(DD, { mode: mode, deload: deload }); p.D = DD;
  return p;
}

/* ===================== Historial y progresión ===================== */
function logsDesc() { return recsOf("log").filter(function (r) { return r.sets && r.sets.length; }).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.u || 0) - (a.u || 0); }); }
/* Series de un ejercicio en las últimas sesiones donde apareció: [{d, lvl, sets:[{r,rir,t,side,auto}]}] */
function historyOf(id, n) {
  var out = [];
  logsDesc().forEach(function (L) {
    if (out.length >= (n || 3)) return;
    var s = L.sets.filter(function (x) { return x.x === id && !x.skip; });
    if (s.length) out.push({ d: L.d, lvl: s[0].lvl || 0, sets: s, day: L.day });
  });
  return out;
}
/* Por serie, el lado más débil manda */
function perSet(sets) {
  var by = {};
  sets.forEach(function (x) {
    var key = x.s;
    var v = x.t != null ? x.t : x.r;
    if (v == null) return;
    if (by[key] == null || v < by[key].v) by[key] = { v: v, auto: by[key] ? (by[key].auto && x.auto) : x.auto };
    else if (by[key]) by[key].auto = by[key].auto && x.auto;
  });
  return Object.keys(by).sort(function (a, b) { return a - b; }).map(function (k) { return by[k]; });
}
function topTarget(x) { if (x.hold) return x.hold; return repsRange(x.reps)[1]; }
function flaggedDown(id) {
  var last = logsDesc().filter(function (L) { return L.sets.some(function (s) { return s.x === id; }); })[0];
  if (last && last.flags && last.flags.some(function (f) { return f.x === id; })) return { why: "molestia durante la sesión del " + shortDate(last.d), d: last.d };
  var morn = recsOf("chk").filter(function (c) { return c.when === "manana" && c.vs === "peor" && c.suspect === id; }).sort(function (a, b) { return a.d < b.d ? 1 : -1; })[0];
  if (morn) {
    var after = logsDesc().filter(function (L) { return L.d > morn.ref && L.sets.some(function (s) { return s.x === id; }); });
    if (!after.length) return { why: "la rodilla amaneció peor el " + shortDate(morn.d), d: morn.d };
  }
  return null;
}
/* Sugerencia para la próxima: sube, baja o mantén */
/* La decisión la toma el entrenador a largo plazo (versión 4): misma forma de respuesta */
function suggestion(x) {
  var R = coachDecide(x.id, x);
  if (!R || R.kind === "none") return R && R.hist && R.hist.length ? R : null;
  return R;
}
function lastLine(h) {
  if (!h || !h.length) return "";
  var s = h[0], ps = perSet(s.sets);
  if (!ps.length) return "";
  var unit = s.sets[0].t != null ? " s" : "";
  return shortDate(s.d) + ": " + ps.map(function (p) { return p.v + (p.auto ? "*" : ""); }).join(" · ") + unit;
}

/* ===================== Chequeos de rodilla ===================== */
var LEGDAYS = PF.rodilla === false ? {} : (PF.diasRodilla || { mie: true, sab: true });
function sessionLog(date, day) { return rec("log_" + date + "_" + day); }
function pendingFor(date) {
  var out = [];
  var dk = dayKeyOf(date);
  if (LEGDAYS[dk]) { var L = sessionLog(date, dk); if (L && L.sets && L.sets.length && !rec("chk_" + date + "_noche")) out.push({ when: "noche", ref: date, day: dk }); }
  var y = addDays(date, -1), yk = dayKeyOf(y);
  if (LEGDAYS[yk]) { var L2 = sessionLog(y, yk); if (L2 && L2.sets && L2.sets.length && !rec("chk_" + date + "_manana")) out.push({ when: "manana", ref: y, day: yk }); }
  return out;
}
function kneeExercisesOf(L) {
  return uniq(L.sets.filter(function (s) { return (EX[s.x] || {}).knee >= 1; }).map(function (s) { return s.x; }));
}
function consecutiveWorse(date) {
  var weeks = {};
  recsOf("chk").forEach(function (c) { if (c.when === "manana" && c.vs === "peor") weeks[isoWeek(c.d).id] = true; });
  var w0 = isoWeek(date).id, w1 = isoWeek(addDays(date, -7)).id;
  return !!(weeks[w0] && weeks[w1]);
}

/* ===================== Vista: utilidades ===================== */
var current = null;           // día abierto
var viewDate = null;          // fecha de ese día en esta semana
function dateOfKey(key) { var wd = weekDates(TODAY()); var D = DAYS[key]; var idx = D.dow === 0 ? 6 : D.dow - 1; return wd[idx]; }

function tempoBarHTML(x, big) {
  var p = tempoParts(x.tempo); if (!p) return "";
  var names = x.phNames || PH.squat;
  var order = x.start === "bottom" ? [2, 3, 0, 1] : [0, 1, 2, 3];
  var cls = ["ecc", "pau", "con", "pau"];
  var h = '<div class="tbar' + (big ? " big" : "") + '" role="img" aria-label="Tempo ' + esc(x.tempo) + '">';
  order.forEach(function (i, n) {
    var q = p[i]; if (!q.s && !q.x) return;
    h += '<span class="tb ' + cls[i] + (q.x ? " xp" : "") + '" style="flex:' + Math.max(q.s, 1) + '" data-ph="' + n + '"><b>' + (q.x ? "X" : q.s) + "</b> " + esc(q.x ? names[i] + " rápido" : names[i]) + "</span>";
  });
  return h + "</div>";
}
function kneeBadge(k) { var K = KNEE[k || 0]; return '<span class="knee k' + (k || 0) + '" title="' + esc(K[2]) + '"><i></i>' + esc(K[0]) + "</span>"; }
function muscleChips(list) { return (list || []).map(function (m) { return '<span class="mus">' + esc(m) + "</span>"; }).join(""); }
function doseText(x, deload) {
  var sets = deload ? halfUp(x.sets) : x.sets;
  if (x.hold) return sets + " × " + (x.holdLabel && x.hold === (EX[x.id] || {}).hold ? x.holdLabel : (x.holdLabel && x.rung === 0 ? x.holdLabel : secsLabel(x.hold))) + (x.side ? " por lado" : "");
  return sets + " × " + x.reps + (x.unit === "pasos" ? " pasos" : "") + (x.side ? " por lado" : "");
}
function setDose(x) {
  if (x.hold) return (x.holdLabel && x.rung === 0 ? x.holdLabel : secsLabel(x.hold));
  return x.reps + (x.unit === "pasos" ? " pasos" : " repeticiones");
}
function restText(x, b) {
  if (x.rest > 0) return x.rest + " s";
  if (b.kind === "emom") return "Hasta el minuto siguiente";
  return "Directo al siguiente";
}
function checklist(list, p) {
  return '<ul class="checks">' + list.map(function (t, i) { return '<li><label><input type="checkbox" id="' + p + i + '"><span>' + esc(t) + "</span></label></li>"; }).join("") + "</ul>";
}
function siNo(after) {
  return '<div class="sino"><div><h3 class="mini">Hoy sí</h3><ul class="yes">' + after.si.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
    '</ul></div><div><h3 class="mini">Evita</h3><ul class="no">' + after.no.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div></div>";
}
function chipsField(name, legend, opts, val) {
  return '<fieldset class="fs"><legend>' + esc(legend) + '</legend><div class="opts">' + opts.map(function (o) {
    return '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (val === o[0] ? " checked" : "") + "><span>" + esc(o[1]) + "</span></label>";
  }).join("") + "</div></fieldset>";
}
var PAIN = [["0", "0"], ["0.5", "0.5"], ["1", "1"], ["1.5", "1.5"], ["2", "2"], ["2.5", "2.5"], ["3", "3 o más"]];

/* ===================== Pestañas ===================== */
function renderTabs() {
  var today = TODAY(), tk = dayKeyOf(today), wd = weekDates(today);
  var h = "";
  ORDER.forEach(function (k, i) {
    var D = DAYS[k], sel = k === current, d = wd[i];
    var Lk = rec("log_" + d + "_" + k), Ak = rec("aer_" + d);
    var done = D.type !== "rest" && ((Lk && Lk.done) || (D.type === "aero" && Ak && Ak.done));
    var sub = D.type === "rest" ? "Libre" : minLabel(planFor(D, d).total);
    h += '<button role="tab" class="tab' + (sel ? " on" : "") + (D.type === "rest" ? " rest" : "") + '" aria-selected="' + sel + '" data-day="' + k + '">' +
      '<span class="tab-d">' + esc(D.short) + '</span><span class="tab-m">' + sub + "</span>" +
      (k === tk ? '<span class="tab-hoy">hoy</span>' : "") + (done ? '<span class="tab-ok" aria-label="hecha">✓</span>' : "") + "</button>";
  });
  $("tabs").innerHTML = h;
}

/* ===================== Página del día ===================== */
function renderDay(key) {
  current = key; viewDate = dateOfKey(key);
  setPref("day", { key: key, date: TODAY() });
  var D = DAYS[key];
  var keep = key === renderDay.last ? openDetails($("main")) : {};
  renderDay.last = key;
  var h = D.type === "rest" ? restDayHTML(D) : D.type === "aero" ? aeroDayHTML(D) : trainDayHTML(D);
  $("main").innerHTML = injectCoach(h);
  restoreDetails($("main"), keep);
  renderTabs();
  renderGlobal();
}
function heroHTML(D, extraMeta, chips, actions, title, lead) {
  return '<section class="hero"><p class="hero-meta"><span class="hm-day">' + esc(D.day) + " " + shortDate(viewDate) + "</span>" + (extraMeta || "") + "</p>" +
    '<h1 class="hero-title">' + esc(title || D.title) + "</h1>" +
    '<p class="hero-lead">' + esc(lead || D.lead) + "</p>" +
    (chips ? '<div class="status">' + chips + "</div>" : "") +
    (actions ? '<div class="hero-actions">' + actions + "</div>" : "") + "</section>";
}
function resumeOK(key) {
  var r = ST.run;
  return r && r.key === key && r.date === TODAY() && (Date.now() - r.t) < 4 * 3600 * 1000 && r.idx > 0;
}
function trainDayHTML(D) {
  var plan = planFor(D, viewDate), mode = plan.opts.mode, deload = plan.opts.deload;
  var L = rec("log_" + viewDate + "_" + D.key);
  var chips = "";
  if (D.filter) {
    var f = rec("flt_" + viewDate);
    chips += (f && f.mode) ? '<span class="chip ' + (f.mode === "full" ? "ok" : f.mode === "mod" ? "warn" : "bad") + '">' + (f.mode === "full" ? "Filtro: sesión completa" : f.mode === "mod" ? "Filtro: modificada" : "Filtro: sin pierna") + "</span>" :
      '<a class="chip warn" href="#filtro">Filtro de rodilla pendiente</a>';
  }
  chips += '<button class="chip toggle' + (deload ? " on" : "") + '" data-act="deload" aria-pressed="' + deload + '">Semana de descarga' + (deload ? ": sí" : "") + "</button>";
  if (L && L.done) chips += '<span class="chip ok">Hecha hoy en ' + fmt(L.dur) + "</span>";
  var actions = resumeOK(D.key) ? '<button class="btn primary" data-act="resume">Continuar la sesión</button><button class="btn" data-act="start">Empezar de cero</button>' :
    '<button class="btn primary" data-act="start">' + (L && L.done ? "Repetir sesión guiada" : "Empezar sesión guiada") + "</button>";
  if (D.walk) actions += '<button class="btn quiet" data-act="walk">Caminata de las 7:12</button>';
  var title = mode === "stop" && D.stopPlan ? D.stopPlan.title + " · " + D.day : null;
  var lead = mode === "stop" && D.stopPlan ? D.stopPlan.lead : null;
  var h = heroHTML(D, '<span class="hm-win">' + esc((plan.D || D).window) + '</span><span class="hm-dur">' + minLabel(plan.total) + (mode !== "full" || deload ? " (ajustada)" : "") + "</span>", chips, actions, title, lead);
  h += pendingHTML(viewDate) + whatsNewHTML();
  if (D.filter) h += filterHTML(D);
  if (deload) h += '<p class="banner">Semana de descarga: mismas sesiones, la mitad de las series y RIR 3-4. Las caminatas, iguales.</p>';
  h += routeSection(D, plan);
  var setup = mode === "stop" && D.stopPlan && D.stopPlan.setup ? D.stopPlan.setup : D.setup;
  h += '<section class="card"><h2 class="sec-title">Antes de empezar</h2><div class="cols"><div><h3 class="mini">Prepara</h3>' + checklist(D.prep, "p") +
    '</div><div><h3 class="mini">Deja listo el equipo</h3>' + checklist(setup, "e") + "</div></div>" + eqSetupHTML(plan) + "</section>";
  plan.blocks.forEach(function (o) { h += blockHTML(D, o, plan); });
  if (D.phase2 && mode !== "stop") h += '<p class="extra">' + esc(phaseN() >= 2 ? "Fase 2 activa: de 4:00 a 5:00 van los 10 saltos pequeños y el circuito corre de 5:00 a 17:00. Si la rodilla avisa con los saltos, los dejas y lo anotas." : D.phase2 + " Se activa cuando pases a la fase 2 (más abajo, en «Tu fase»).") + "</p>";
  h += afterHTML(D);
  if (D.walk) h += walkCard();
  return h;
}
function routeSection(D, plan) {
  return '<section class="route-wrap" aria-labelledby="rt"><h2 class="sec-title" id="rt">Recorrido</h2>' + routeHTML(plan, true) + "</section>";
}
function routeHTML(plan, links) {
  var total = plan.total || 1, h = '<div class="route">';
  plan.blocks.forEach(function (o) {
    var b = o.b, w = o.len / total * 100;
    var inner = '<span class="seg-l">' + esc(b.label) + '</span><span class="seg-t">' + fmt(o.start) + "</span>";
    var title = b.name + ", " + fmt(o.start) + " a " + fmt(o.end);
    if (links) h += '<a class="seg tone-' + b.tone + '" style="width:' + w.toFixed(3) + '%" href="#b-' + b.id + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + inner + "</a>";
    else h += '<span class="seg tone-' + b.tone + '" data-b="' + b.id + '" style="width:' + w.toFixed(3) + '%">' + inner + "</span>";
  });
  h += "</div>";
  if (links) h += '<p class="route-end">Termina en ' + fmt(total) + "</p>";
  return h;
}
function flowText(b, exs, deload) {
  if (b.kind === "emom") return "3 rondas, una cada 4 minutos. Haces 1-2-3-4 seguidos y descansas hasta el minuto marcado.";
  var rounds = deload ? halfUp(b.rounds) : b.rounds;
  var parts = [];
  exs.forEach(function (x) { parts.push(x.code); if (x.rest > 0) parts.push(x.rest + " s"); });
  var kind = b.kind === "circuit" ? "Circuito" : exs.length === 1 ? "Series" : "Superserie";
  return kind + " de " + rounds + (rounds === 1 ? " ronda" : " rondas") + ": " + parts.join(" → ");
}
function blockHTML(D, o, plan) {
  var b = o.b, deload = plan.opts.deload, mod = plan.opts.mode === "mod";
  var h = '<section class="block tone-' + b.tone + '" id="b-' + b.id + '">';
  h += '<header class="block-head"><span class="block-id">' + esc(b.label) + '</span><div><h2 class="block-name">' + esc(b.name) + "</h2>" +
    '<p class="block-time">' + fmt(o.start) + " a " + fmt(o.end) + '<span class="bt-len">' + secsLabel(Math.round(o.len / 15) * 15) + "</span></p></div></header>";
  if (b.kind === "list") {
    h += '<ol class="items">' + b.items.filter(function (it) { return !(mod && it.skipMod); }).map(function (it) {
      return '<li><div class="it-top"><span class="it-name">' + esc(it.name) + '</span><span class="it-dose">' + esc(it.dose) + '</span></div><p class="it-how">' + esc(it.how) + "</p></li>";
    }).join("") + "</ol>";
    if (mod && b.items.some(function (it) { return it.skipMod; })) h += '<p class="block-note">Filtro modificado: hoy sin aterrizajes; caja un puño más alta en la isométrica.</p>';
  } else if (b.kind === "phase") {
    h += exCard(D, resolve(b.ex), b, true);
  } else {
    var exs = b.ex.map(resolve).filter(function (x) { return !(mod && x.skipMod); });
    h += '<p class="block-format">' + esc(flowText(b, exs, deload)) + "</p>";
    if (b.note) h += '<p class="block-note">' + esc(b.note) + "</p>";
    if (b.kind === "emom") h += '<p class="block-note">Cada ronda empieza en su minuto exacto: ' + [0, 1, 2].slice(0, deload ? halfUp(b.rounds) : b.rounds).map(function (r) { return fmt(o.start + r * b.interval); }).join(", ") + ". Tras la última, 30 s para la mochila y directo a la cargada.</p>";
    if (mod && b.ex.some(function (e) { return (EX[e.id] || {}).skipMod; })) h += '<p class="block-note">Filtro modificado: hoy sin step-downs.</p>';
    exs.forEach(function (x) { h += exCard(D, x, b, false, deload, mod); });
  }
  return h + "</section>";
}
function exCard(D, x, b, isPhase, deload, mod) {
  var h = '<article class="ex" id="ex-' + esc(x.code) + '">';
  h += '<header class="ex-head"><span class="ex-code">' + esc(x.code) + '</span><h3 class="ex-name">' + esc(x.name) + "</h3></header>";
  h += '<div class="ex-tags">' + kneeBadge(x.knee) + muscleChips(x.muscles) + (CAMX[x.id] ? '<span class="mus cam-tag">Cámara: ' + (/frente/.test(CAMX[x.id].view) ? "de frente" : "de lado") + "</span>" : "") + "</div>";
  h += '<dl class="ex-rx">';
  if (isPhase) {
    h += "<div><dt>Duración</dt><dd>" + secsLabel(x.hold) + "</dd></div><div><dt>Cadencia</dt><dd>170-180 pasos/min</dd></div><div><dt>Esfuerzo</dt><dd>4-5 de 10</dd></div>";
  } else {
    h += "<div><dt>Series</dt><dd>" + esc(doseText(x, deload)) + "</dd></div>";
    if (tempoParts(x.tempo)) h += "<div><dt>Tempo</dt><dd>" + esc(x.tempo) + "</dd></div>";
    else if (x.tempo) h += "<div><dt>Ritmo</dt><dd>" + esc(x.tempo) + "</dd></div>";
    h += "<div><dt>Descanso</dt><dd>" + esc(restText(x, b)) + "</dd></div>";
    var rir = deload ? "3-4 (descarga)" : x.rir;
    if (rir) h += "<div><dt>" + (/^\d/.test(rir) ? "RIR" : "Límite") + "</dt><dd>" + esc(rir) + "</dd></div>";
    h += '<div class="rx-load"><dt>Carga</dt><dd>' + eqHTML(effLoadText(x)) + "</dd></div>";
    if (x.rung > 0 && x.rungText) h += "<div><dt>Peldaño</dt><dd>" + esc(x.rungText) + "</dd></div>";
  }
  h += "</dl>";
  if (tempoParts(x.tempo)) h += tempoBarHTML(x);
  if (mod && x.modNote) h += '<p class="block-note">' + esc(x.modNote) + "</p>";
  if (!isPhase) h += progHTML(x);
  h += '<p class="ex-why">' + esc(x.why) + "</p>";
  h += '<details class="ex-how"><summary>Cómo hacerlo</summary><div class="how">' + howHTML(x) + "</div></details>";
  if (x.ladder && x.ladder.length > 1) h += ladderHTML(x);
  return h + "</article>";
}
function progHTML(x) {
  var s = suggestion(x);
  var line = s && s.hist ? lastLine(s.hist) : "";
  var extra = s && (s.kind === "plateau" || s.kind === "effort" || s.gate);
  if (!line && !(s && (s.kind === "up" || s.kind === "down")) && !extra && !(x.rung > 0)) return "";
  var h = '<div class="prog">';
  if (x.rung > 0) h += '<p class="pg-now"><span class="k">Tu peldaño.</span> ' + esc(x.rungText) + "</p>";
  if (line) h += '<p class="pg-last"><span class="k">Última vez.</span> ' + esc(line) + (/\*/.test(line) ? ' <span class="pg-note">* sin registrar</span>' : "") + "</p>";
  if (s && s.kind === "up") h += '<p class="pg-up">' + esc(s.text) + ' <button class="mini-btn" data-act="rung" data-x="' + esc(x.id) + '" data-to="' + s.to + '">Aplicar</button></p>';
  if (s && s.kind === "down") h += '<p class="pg-down">' + esc(s.text) + " (" + esc((s.why || [])[0] || "") + ")" + (x.rung > 0 ? ' <button class="mini-btn" data-act="rung" data-x="' + esc(x.id) + '" data-to="' + s.to + '">Aplicar</button>' : "") + "</p>";
  if (extra) h += '<p class="pg-warn">' + esc(s.text) + (s.why && s.why[0] ? ' <span class="pg-note">' + esc(s.why[0]) + "</span>" : "") + "</p>";
  else if (s && s.kind === "hold" && line) { var t = rirTarget(x); h += '<p class="pg-hold">' + (s.one ? "Una sesión más con el tope y subes." : "Objetivo: " + esc(x.hold ? secsLabel(x.hold) + " en todas las series" : "llegar a " + repsRange(x.reps)[1] + " en todas las series") + ", dos sesiones seguidas" + (x.knee && t && t.lo >= 2 ? ", con " + esc(x.rir) + " en reserva" : "") + ".") + "</p>"; }
  return h + "</div>";
}
function howHTML(x, noDemo) {
  var h = "";
  if (!noDemo && pref("demo", true) !== false && demoOf(x.id)) h += '<div class="how-demo">' + demoHTML(x, false) + "</div>";
  h += '<p class="how-video"><a href="' + esc(videoURL(x)) + '" target="_blank" rel="noopener">Ver videos de la técnica en YouTube</a> <span class="muted">(con internet)</span></p>';
  if (x.setup) h += '<p><span class="k">Posición.</span> ' + esc(x.setup) + "</p>";
  if (x.steps) h += '<ol class="steps">' + x.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
  if (x.side) h += '<p><span class="k">Lados.</span> Empieza por el lado más débil y que el otro iguale sus repeticiones.</p>';
  if (x.breath) h += '<p><span class="k">Respiración.</span> ' + esc(x.breath) + "</p>";
  if (x.cues && x.cues.length) h += '<p><span class="k">Claves.</span> ' + esc(x.cues.join(". ")) + ".</p>";
  if (x.errors && x.errors.length) h += '<p><span class="k">Errores comunes.</span> ' + esc(x.errors.join(". ")) + ".</p>";
  if (x.safety) h += '<p><span class="k">Seguridad.</span> ' + esc(x.safety) + "</p>";
  if (x.alt) h += '<p><span class="k">Alternativa.</span> ' + esc(x.alt) + "</p>";
  return h;
}
function ladderHTML(x) {
  var lib = EX[x.id];
  var h = '<details class="ex-ladder"><summary>Escalera de progresión · nivel ' + (Math.min(x.rung || 0, lib.ladder.length - 1) + 1) + " de " + lib.ladder.length + "</summary>" +
    (x.follow ? '<p class="muted">El peso lo marca ' + esc((EX[x.follow] || {}).name || "") + ": comparten mancuernas en el mismo bloque. Esta escalera es para lo demás.</p>" : "") + '<ol class="ladder">';
  lib.ladder.forEach(function (r, i) {
    var t = rungText(lib, i);
    var st = i < x.rung ? "past" : i === x.rung ? "cur" : "next";
    var mn = eqRungNote(lib, i);
    var lockd = i > x.rung && rungPhase(lib, i) > phaseN();
    h += '<li class="' + st + (lockd ? " lock" : "") + '"><span>' + esc(t) + (mn ? '<small class="eq-miss">' + esc(mn) + "</small>" : "") + "</span>" + (i === x.rung ? '<em>Estás aquí</em>' : lockd ? '<em class="lock">Fase 2</em>' : '<button class="mini-btn quiet" data-act="rung" data-x="' + esc(x.id) + '" data-to="' + i + '">Estoy aquí</button>') + "</li>";
  });
  return h + '</ol><p class="muted">Subes un peldaño cuando haces el tope del rango en todas las series dos sesiones seguidas. La página te lo propone sola.</p></details>';
}

/* ===================== Filtro de rodilla ===================== */
function filterMode(f) {
  if (!f.pain || !f.stiff || !f.swell) return null;
  if (f.swell === "yes" || f.pain === "high") return "stop";
  if (f.pain === "mid" || f.stiff === "no") return "mod";
  return "full";
}
function filterHTML(D) {
  var f = rec("flt_" + viewDate) || {};
  var h = '<section class="card filter" id="filtro"><h2 class="sec-title">Filtro de rodilla</h2><p class="muted">Respóndelo al despertar. La sesión de abajo se ajusta sola.</p>' +
    chipsField("f-pain", "Dolor al despertar", [["ok", "0 a 1 de 10"], ["mid", "Entre 1 y 2"], ["high", "Más de 2"]], f.pain) +
    chipsField("f-stiff", "La rigidez se va en 5 minutos de moverte", [["ok", "Sí"], ["no", "No"]], f.stiff) +
    chipsField("f-swell", "Hinchazón visible", [["ok", "No"], ["yes", "Sí"]], f.swell);
  var m = f.mode;
  var txt = !m ? "Responde las tres preguntas." : m === "full" ? "Sesión completa." : m === "mod" ? "Sesión modificada. " + D.filterMod : (D.stopPlan ? D.stopPlan.lead : "Sin pierna hoy.");
  h += '<p class="filter-out ' + (m === "full" ? "ok" : m === "mod" ? "mod" : m === "stop" ? "stop" : "") + '" aria-live="polite">' + esc(txt) + "</p></section>";
  return h;
}

/* ===================== Después y chequeos ===================== */
function afterHTML(D) {
  var h = '<section class="card"><h2 class="sec-title">Después de la sesión</h2>' + siNo(D.after) + "</section>";
  h += nextHTML(D);
  return h;
}
function nextHTML(D) {
  var N = DAYS[D.next];
  var t = N.type === "rest" ? N.title : N.title + ", " + N.window;
  return '<p class="next-day"><span class="k">Mañana, ' + esc(N.day.toLowerCase()) + ".</span> " + esc(t) + ' <button class="link" data-day="' + N.key + '">Ver</button></p>';
}
function pendingHTML(date) {
  var h = pendingFor(date).map(function (p) { return checkFormHTML(p); }).join("");
  ["noche", "manana"].forEach(function (w) {
    var c = rec("chk_" + date + "_" + w); if (!c) return;
    var a = checkAdvice(c);
    h += '<section class="card check-done ' + a[0] + '"><h2 class="sec-title">' + (w === "noche" ? "Chequeo de esta noche" : "Chequeo de 24 horas") + '</h2><p class="muted">Dolor ' + esc(c.pain) + "/10" +
      (w === "noche" ? ", hinchazón " + (c.swell === "si" ? "sí" : "no") + ", rigidez " + (c.stiff === "si" ? "sí" : "no") : ", " + (c.vs || "") + " que tu normal") + '.</p><p class="adv ' + a[0] + '">' + esc(a[1]) + "</p></section>";
  });
  return h;
}
function checkFormHTML(p) {
  var L = sessionLog(p.ref, p.day), D = DAYS[p.day];
  var id = "chk-" + p.when;
  if (p.when === "noche") {
    return '<section class="card check" id="' + id + '" data-when="noche" data-ref="' + p.ref + '" data-dayk="' + p.day + '"><h2 class="sec-title">Chequeo de esta noche</h2><p class="muted">Antes de dormir, sobre la sesión de hoy.</p>' +
      chipsField("c-pain", "Dolor de rodilla ahora", PAIN, null) +
      chipsField("c-swell", "Hinchazón visible", [["no", "No"], ["si", "Sí"]], null) +
      chipsField("c-stiff", "Rigidez al caminar", [["no", "No"], ["si", "Sí"]], null) +
      '<button class="btn primary" data-act="savecheck">Guardar chequeo</button><p class="check-out" aria-live="polite"></p></section>';
  }
  var opts = (L ? kneeExercisesOf(L) : []).map(function (x) { return [x, (EX[x] || {}).name || x]; });
  opts.push(["nose", "No sé"]);
  return '<section class="card check" id="' + id + '" data-when="manana" data-ref="' + p.ref + '" data-dayk="' + p.day + '"><h2 class="sec-title">Chequeo de 24 horas</h2><p class="muted">Al despertar, después de la sesión del ' + esc(D.day.toLowerCase()) + ".</p>" +
    chipsField("c-pain", "Dolor al despertar", PAIN, null) +
    chipsField("c-fast", "La rigidez se va en 5 minutos", [["si", "Sí"], ["no", "No"]], null) +
    chipsField("c-vs", "Comparado con tu normal", [["mejor", "Mejor"], ["igual", "Igual"], ["peor", "Peor"]], null) +
    '<div class="suspect" hidden>' + chipsField("c-sus", "¿Qué ejercicio sospechas?", opts, null) + "</div>" +
    '<button class="btn primary" data-act="savecheck">Guardar chequeo</button><p class="check-out" aria-live="polite"></p></section>';
}
function checkAdvice(c) {
  var pain = parseFloat(c.pain);
  if (c.when === "noche") {
    if (c.swell === "si") return ["bad", "Esto sí es un brote: hielo 15 min y pierna elevada 20-30 min. Mañana el chequeo de 24 h decide; la próxima sesión de pierna, un peldaño más abajo."];
    if (pain > 1.5 || c.stiff === "si") return ["warn", "Un poco más de lo ideal. Pierna elevada un rato y nada de escaleras rápidas hoy. Mañana al despertar, el chequeo de 24 h."];
    return ["ok", "Bien. Mañana al despertar, el chequeo de 24 h."];
  }
  var nextK = DAYS[DAYS[c.day].next];
  if (pain > 2) return ["bad", "Más de 2/10: hoy descanso completo, sin caminata extra. " + (c.day === "mie" ? "El viernes va normal porque no carga pierna; el sábado decide el filtro." : "El lunes va normal porque no carga pierna; el miércoles decide el filtro.") + (consecutiveWorse(c.d) ? " Es la segunda semana seguida: una semana sin pierna y a evaluación." : "")];
  if (c.vs === "peor") {
    var ex = c.suspect && c.suspect !== "nose" ? (EX[c.suspect] || {}).name : null;
    return ["warn", (ex ? ex + " baja un peldaño la próxima vez (la página ya lo marcó)." : "El ejercicio que más cargó la rodilla baja un paso la próxima vez.") + (consecutiveWorse(c.d) ? " Segunda semana seguida peor: una semana sin pierna y a evaluación." : "")];
  }
  return ["ok", "Regla de 24 horas cumplida: sigue el plan. " + (nextK ? "" : "")];
}

/* ===================== Martes ===================== */
function aeroDayHTML(D) {
  var ab = weekAB(viewDate), W = D.weeks[ab], deload = isDeload(viewDate);
  var A = rec("aer_" + viewDate);
  var chips = '<span class="chip on">Semana ' + ab + '</span><button class="chip toggle" data-act="abflip">Cambiar a semana ' + (ab === "A" ? "B" : "A") + "</button>";
  if (A) chips += '<span class="chip ok">Hecho hoy</span>';
  var actions = ab === "A" ? '<button class="btn primary" data-act="start">Empezar trote lento</button><button class="btn quiet" data-act="hill">Hacer el 4×4 en cuesta</button>' :
    '<button class="btn primary" data-act="hill">Empezar 4×4 en cuesta</button><button class="btn quiet" data-act="start">Hacer el trote lento</button>';
  actions += phaseN() >= 2 ? '<button class="btn quiet" data-act="fxf">4×4 trotando (fase 2)</button>' : '<span class="chip">4×4 trotando: se abre en la fase 2</span>';
  var plan = buildPlan(D, { mode: "full", deload: false });
  var h = heroHTML(D, '<span class="hm-win">' + esc(D.window) + '</span><span class="hm-dur">40 min</span>', chips, actions, W.title, W.lead);
  if (deload && ab === "B") h += '<p class="banner">Semana de descarga: mejor el trote lento de la semana A.</p>';
  h += '<section class="card"><h2 class="sec-title">Antes de salir</h2><div class="cols"><div><h3 class="mini">Prepara</h3>' + checklist(D.prep, "p") + '</div><div><h3 class="mini">Dónde</h3>' + checklist(D.setup, "e") + "</div></div></section>";
  if (ab === "B") {
    h += segCard(HILL, "hill", true);
    h += '<section class="card"><h2 class="sec-title">Cómo se siente el 8 de 10</h2><p>Respiras por la boca, puedes decir 3-4 palabras pero no una oración. A 3,400 m llega antes que en la costa, y está bien. Si te mareas, esa subida va a 7 de 10.</p><p class="muted">Por qué en cuesta: subiendo, la rodilla casi no frena, así que el corazón trabaja cerca de su máximo sin el impacto de correr. El 4×4 noruego (Helgerud 2007) es uno de los protocolos que más suben el VO2max.</p></section>';
  } else {
    h += routeSection(D, plan);
    plan.blocks.forEach(function (o) { h += blockHTML(D, o, plan); });
    h += '<section class="card"><h2 class="sec-title">Si al día siguiente la rodilla amanece peor</h2><p>La semana siguiente haces 20 min alternando 2 min de trote y 1 de caminata. Opcional: si hay barras en la pista, 2 series cómodas de dominadas (la mitad de tu máximo), solo si el dorsal no quedó adolorido del lunes.</p></section>';
  }
  h += '<section class="card"><h2 class="sec-title">Después</h2>' + siNo(D.after) + "</section>" + nextHTML(D);
  return h;
}
function segCard(def, act, open) {
  return '<section class="card"><h2 class="sec-title">' + esc(def.title) + '</h2><p>' + esc(def.window) + ". " + esc(def.lead) + "</p>" +
    '<ol class="walk">' + def.segments.map(function (s) { var fast = /rápid|Fuerte/i.test(s[0]); return '<li class="' + (fast ? "w-fast" : "w-norm") + '"><span>' + esc(s[0]) + "</span><span>" + secsLabel(s[1]) + "</span></li>"; }).join("") + "</ol>" +
    (open ? "" : '<button class="btn" data-act="' + act + '">Empezar</button>') + "</section>";
}
function walkCard() {
  var done = rec("walk_" + viewDate);
  return '<section class="card"><h2 class="sec-title">Caminata de la mañana</h2><p>' + esc(WALK.window) + ". " + esc(WALK.lead) + "</p>" +
    '<ol class="walk">' + WALK.segments.map(function (s) { return '<li class="' + (/rápido/.test(s[0]) ? "w-fast" : "w-norm") + '"><span>' + esc(s[0]) + "</span><span>" + secsLabel(s[1]) + "</span></li>"; }).join("") + "</ol>" +
    (done ? '<p class="log">Hecha hoy.</p>' : '<button class="btn" data-act="walk">Empezar caminata guiada</button>') + "</section>";
}

/* ===================== Jueves y domingo ===================== */
function restDayHTML(D) {
  var h = heroHTML(D, "", "", "", null, null);
  h += pendingHTML(viewDate);
  h += '<section class="card"><h2 class="sec-title">Hoy</h2>' + siNo(D.after) + "</section>";
  if (D.routines) D.routines.forEach(function (R) {
    var done = rec("rut_" + viewDate + "_" + R.id);
    h += '<section class="card routine tone-' + R.tone + '"><h2 class="sec-title">' + esc(R.title) + ' <span class="bt-len">' + R.minutes + " min, opcional</span></h2><p>" + esc(R.lead) + "</p>" +
      '<ol class="items">' + R.items.map(function (it) { return '<li><div class="it-top"><span class="it-name">' + esc(it.name) + '</span><span class="it-dose">' + esc(it.dose) + '</span></div><p class="it-how">' + esc(it.how) + "</p></li>"; }).join("") + "</ol>" +
      (done ? '<p class="log">Hecho hoy.</p>' : '<button class="btn" data-act="routine" data-r="' + R.id + '">Empezar con temporizador</button>') + "</section>";
  });
  if (D.review) h += reviewHTML();
  h += nextHTML(D);
  return h;
}

/* ===================== Seguimiento semanal (domingo) ===================== */
function weekStats(dateInWeek) {
  var wd = weekDates(dateInWeek), sessions = 0, knee = [];
  var marks = {};
  wd.forEach(function (d) {
    ["lun", "mie", "vie", "sab"].forEach(function (k) { var L = rec("log_" + d + "_" + k); if (L && L.sets && L.sets.length && (L.done || !L.planSets || L.sets.filter(function (z) { return !z.skip; }).length >= L.planSets / 2)) { sessions++; L.sets.forEach(function (s) { if (s.r != null && !s.auto) { if (!marks[s.x] || s.r > marks[s.x]) marks[s.x] = s.r; } }); } });
    if (rec("aer_" + d)) sessions++;
    var f = rec("flt_" + d); if (f && f.pain) knee.push(f.pain === "ok" ? 0.5 : f.pain === "mid" ? 1.5 : 2.5);
    var m = rec("chk_" + d + "_manana"); if (m && m.pain != null) knee.push(parseFloat(m.pain));
  });
  var avg = knee.length ? Math.round(knee.reduce(function (a, b) { return a + b; }, 0) / knee.length * 10) / 10 : null;
  return { sessions: sessions, knee: avg, marks: marks };
}
function reviewHTML() {
  var wk = isoWeek(viewDate), id = "wk_" + wk.id, r = rec(id) || {};
  var st = weekStats(viewDate);
  var marks = [["remo1m", "Remo A1 (reps)"], ["splitsq", "Split squat (reps)"], ["rdl2p", "Peso muerto del sábado (reps)"]].map(function (m) { return st.marks[m[0]] != null ? m[1] + ": " + st.marks[m[0]] : null; }).filter(Boolean);
  var h = '<section class="card review" id="review"><h2 class="sec-title">Seguimiento semanal</h2><p class="muted">Solo lo que cambia una decisión. Peso: domingo en ayunas, después del baño. Pulso: al despertar, acostado, 1 minuto.</p>';
  h += '<div class="auto"><p><span class="k">Sesiones hechas:</span> ' + st.sessions + ' de 5</p><p><span class="k">Rodilla al despertar (promedio):</span> ' + (st.knee == null ? "sin datos" : st.knee + "/10") + "</p>" + (marks.length ? '<p><span class="k">Marcas:</span> ' + esc(marks.join(" · ")) + "</p>" : "") + "</div>";
  h += '<div class="grid-in">' +
    numField("w-peso", "Peso (kg)", r.peso, "0.1") + numField("w-cintura", "Cintura en el ombligo (cm)", r.cintura, "0.5") + numField("w-fc", "Pulso en reposo (lpm)", r.fc, "1") +
    numField("w-brazo", "Brazo relajado (cm, mensual)", r.brazo, "0.5") + numField("w-pecho", "Pecho (cm, mensual)", r.pecho, "0.5") + "</div>";
  var sig = r.sig || [];
  var AS = autoSignals(viewDate), autoI = {}; AS.forEach(function (x) { autoI[x.i] = x.t; });
  h += '<fieldset class="fs"><legend>Señales de fatiga esta semana</legend><ul class="checks signals">' + SIG_TXT.map(function (t, i) { return '<li><label><input type="checkbox" class="w-sig" value="' + i + '"' + (sig.indexOf(i) >= 0 || autoI[i] ? " checked" : "") + (autoI[i] ? " disabled" : "") + "><span>" + esc(t) + (autoI[i] ? "<small>Detectado por la app: " + esc(autoI[i]) + "</small>" : "") + "</span></label></li>"; }).join("") + "</ul></fieldset>";
  h += '<button class="btn primary" data-act="savereview">Guardar semana</button><div class="review-out" aria-live="polite">' + reviewAdvice(r, viewDate) + "</div>";
  h += historyTable();
  h += testsHTML() + photoHTML();
  return h + "</section>";
}
function numField(id, label, val, step) {
  return '<label class="num"><span>' + esc(label) + '</span><input type="number" inputmode="decimal" step="' + step + '" id="' + id + '" value="' + (val == null ? "" : esc(val)) + '"></label>';
}
function reviewAdvice(r, date) {
  if (!r || !r.id) return "";
  var out = [], Bo = bodyInfo(), S = weekSignals(date), B = blockInfo(date);
  if (Bo.rate != null) out.push(Bo.rate < KG0 ? ["warn", "Tu peso sube " + esc(Bo.rateTxt) + " al mes (meta +" + KG0 + " a +" + KG1 + "): suma 200-300 kcal al día, por ejemplo un plátano con un puñado de maní."] : Bo.rate > 0.6 ? ["prep", "Peso subiendo " + esc(Bo.rateTxt) + " al mes: más rápido que la meta (+0.3 a +0.6). Mira la cintura."] : ["ok", "Peso subiendo " + esc(Bo.rateTxt) + " al mes: dentro de la meta."]);
  else if (r.peso != null) out.push(["prep", "Con 3 semanas de peso (en 3 o más domingos) la página te dice si ajustar calorías."]);
  if (Bo.waistUp != null && Bo.waistUp > 1 && !Bo.waistArmUp) out.push(["warn", "La cintura subió " + Bo.waistUp + " cm en un mes sin que suba el brazo: quita unas 200 kcal."]);
  if (r.cintura != null && r.cintura >= CINT) out.push(["warn", "Cintura en " + esc(r.cintura) + " cm: el techo es menos de " + CINT + " cm (la mitad de tu estatura)."]);
  if (S.big) out.push(["bad", "Pulso 10 lpm o más sobre tu promedio: si sigue así varios días, para y consulta."]);
  if (S.n >= 2 && !B.nextDel) out.push(["warn", "Dos o más señales de fatiga: la próxima semana, descarga. <button class=\"mini-btn\" data-act=\"deloadnext\">Marcar descarga</button>"]);
  var ws = weeksSinceDeload(date);
  if (ws != null && ws >= 6 && !B.nextDel && !B.isDel && S.n < 2) out.push(["prep", "Llevas " + ws + " semanas desde la última descarga: toca una pronto. <button class=\"mini-btn\" data-act=\"deloadnext\">Marcar la próxima</button>"]);
  if (B.nextDel) out.push(["ok", "La próxima semana ya está marcada como descarga."]);
  return out.map(function (o) { return '<p class="adv ' + o[0] + '">' + o[1] + "</p>"; }).join("");
}
function historyTable() {
  var weeks = recsOf("wk").sort(function (a, b) { return a.id < b.id ? 1 : -1; }).slice(0, 8);
  if (!weeks.length) return "";
  var pts = weeks.slice().reverse().map(function (w) { return w.peso; });
  var h = '<h3 class="mini">Últimas semanas</h3>' + sparkHTML(pts, "Peso") + '<div class="tscroll"><table class="hist"><thead><tr><th>Semana del</th><th>Peso</th><th>Cintura</th><th>Pulso</th><th>Rodilla</th><th>Sesiones</th></tr></thead><tbody>';
  weeks.forEach(function (w) {
    var st = weekStats(w.d || TODAY());
    h += "<tr><td>" + esc(shortDate(weekDates(w.d || TODAY())[0])) + "</td><td>" + (w.peso == null ? "–" : w.peso) + "</td><td>" + (w.cintura == null ? "–" : w.cintura) + "</td><td>" + (w.fc == null ? "–" : w.fc) + "</td><td>" + (st.knee == null ? "–" : st.knee) + "</td><td>" + st.sessions + "</td></tr>";
  });
  return h + "</tbody></table></div>";
}
function sparkHTML(vals, label) {
  var v = vals.filter(function (x) { return x != null; });
  if (v.length < 2) return "";
  var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), W = 260, H = 44, n = vals.length;
  var pts = [];
  vals.forEach(function (x, i) { if (x == null) return; var px = 6 + (W - 12) * i / Math.max(1, n - 1), py = H - 6 - (H - 12) * (hi === lo ? 0.5 : (x - lo) / (hi - lo)); pts.push(px.toFixed(1) + "," + py.toFixed(1)); });
  return '<figure class="spark"><svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(label) + " de " + lo + " a " + hi + '"><polyline fill="none" stroke="currentColor" stroke-width="2" points="' + pts.join(" ") + '"/></svg><figcaption>' + esc(label) + ": " + v[0] + " → " + v[v.length - 1] + " kg</figcaption></figure>";
}

/* ===================== Sección global ===================== */
function openDetails(root) {
  var o = {};
  if (root) root.querySelectorAll("details").forEach(function (d) { if (d.open) { var host = d.closest("[id]"); o[(host ? host.id : "") + "|" + (d.getAttribute("data-k") || d.className)] = 1; } });
  return o;
}
function restoreDetails(root, o) {
  if (!root) return;
  root.querySelectorAll("details").forEach(function (d) { var host = d.closest("[id]"); if (o[(host ? host.id : "") + "|" + (d.getAttribute("data-k") || d.className)]) d.open = true; });
}
function renderGlobal() {
  var today = TODAY(), hb = rec("hab_" + today) || { h: [] };
  var h = '<section class="card habits"><h2 class="sec-title">Hábitos de hoy</h2><p class="muted">' + esc(shortDate(today)) + ". Se marcan para hoy, mires el día que mires.</p>" +
    '<ul class="checks">' + HABITS.map(function (t, i) { return '<li><label><input type="checkbox" class="hab" data-i="' + i + '"' + (hb.h[i] ? " checked" : "") + "><span>" + esc(t) + "</span></label></li>"; }).join("") + "</ul></section>";
  h += '<section class="card cfg-link"><div><h2 class="sec-title">Ajustes</h2><p class="muted">Sesión continua, voz y tempo, mancuernas, cámara, asistente, GitHub y tus datos, cada cosa en su sección.</p></div><button class="btn" data-act="cfgopen" type="button">Abrir ajustes</button></section>';
  $("global").innerHTML = h;
  if (typeof cfgRender === "function") { cfgRender(false); psRender(); }
  paintSync();
}
function settingsHTML() {
  var th = pref("theme", "auto");
  var c = cfg(), wk = isoWeek(TODAY());
  return '<details class="card" data-k="ajustes"><summary>Ajustes</summary><div class="set-grid">' +
    toggleRow("voice", "Voz en la sesión guiada", voiceOn()) +
    optRow("Velocidad de la voz", "vozrate", [["0.92", "Lenta"], ["1.05", "Normal"], ["1.2", "Rápida"]], String(pref("vozRate", 1.05))) +
    optRow("Volumen de los avisos", "vol", [["normal", "Normal"], ["alto", "Alto"], ["max", "Máximo"]], pref("vol", "alto")) +
    '<div class="set-row"><span>Escuchar los sonidos de la sesión</span><div class="opts"><button class="opt-btn" data-act="sndtest" type="button">Probar sonido</button></div></div><p class="muted" id="snd-out" aria-live="polite"></p>' +
    toggleRow("tempo", "Guía de tempo: cuenta las fases y las repeticiones", pref("tempo", false)) +
    optRow("Sonido del tempo", "tempotone", [["largo", "Largo: dura lo que la fase"], ["corto", "Corto"]], pref("tempoTone", "largo")) +
    toggleRow("tempoWords", "En fases de 2 s o más, decir «baja», «quieto», «sube»", prefVal("tempoWords")) +
    toggleRow("logsets", "Registrar repeticiones y RIR de cada serie", pref("logsets", true)) +
    toggleRow("prepScreen", "Al empezar, la pantalla «Prepara tu equipo»", prefVal("prepScreen")) +
    toggleRow("sideAuto", "Ejercicios por lado: el lado 2 empieza solo", prefVal("sideAuto")) +
    toggleRow("side2End", "Con el tempo, el lado 2 termina solo al igualar al lado 1", prefVal("side2End")) +
    toggleRow("demo", "Figura animada que muestra cómo se hace cada ejercicio", prefVal("demo")) +
    camSettingsRows() +
    '<div class="set-row"><span>Tema</span><div class="opts">' + [["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(function (o) { return '<button class="opt-btn' + (th === o[0] ? " on" : "") + '" data-act="theme" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div></div>" +
    '<div class="set-row"><span>Martes de esta semana</span><div class="opts"><span class="chip on">Semana ' + weekAB(TODAY()) + '</span><button class="opt-btn" data-act="abflip">Cambiar</button></div></div>' +
    '<div class="set-row"><span>Esta semana (' + esc(wk.id) + ')</span><div class="opts"><button class="opt-btn' + (isDeload(TODAY()) ? " on" : "") + '" data-act="deload">' + (isDeload(TODAY()) ? "Es de descarga" : "Marcar como descarga") + "</button></div></div>" +
    "</div></details>";
}
function toggleRow(k, label, on) {
  return '<div class="set-row"><span>' + esc(label) + '</span><button class="switch" role="switch" aria-checked="' + !!on + '" data-act="pref" data-k="' + k + '"><i></i><b>' + (on ? "Sí" : "No") + "</b></button></div>";
}
function dataHTML() {
  var n = { log: 0, chk: 0, wk: 0 };
  for (var id in ST.recs) { var k = ST.recs[id] && ST.recs[id].k; if (n[k] != null) n[k]++; }
  return '<details class="card data" data-k="datos"><summary>Datos y respaldo</summary><p><span id="sync" class="sync"></span></p><p class="muted">Versión ' + APP_VER + ' de la app. Se actualiza sola cuando subes una nueva a GitHub.</p>' +
    '<p class="muted">' + n.log + " sesiones, " + n.chk + " chequeos y " + n.wk + " semanas registradas.</p>" +
    '<div class="hero-actions"><button class="btn" data-act="export">Exportar mi historial (JSON)</button><button class="btn quiet" data-act="exportprog">Exportar el programa para tu app</button></div>' +
    '<textarea id="io" class="io" rows="5" placeholder="Aquí aparece el JSON si tu navegador no permite descargar. Para restaurar, pega aquí un respaldo y toca Importar." spellcheck="false"></textarea>' +
    '<div class="hero-actions"><button class="btn quiet" data-act="import">Importar lo pegado</button><label class="btn quiet file-btn">Importar desde archivo<input type="file" id="io-file" accept=".json,application/json" hidden></label><button class="btn quiet" data-act="share">Compartir respaldo</button></div><p class="io-out muted" aria-live="polite"></p></details>';
}

/* ===================== Audio, voz y pantalla ===================== */
var actx = null, sndOut = null;
var VOL = { normal: 1, alto: 1.8, max: 3.2 };
function audio() {
  if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) { try { actx = new AC(); } catch (e) { actx = null; } } }
  if (actx && actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
  return actx;
}
/* Todo sonido pasa por aquí: volumen elegido + compresor, para que se oiga fuerte sin saturar */
function sndDest() {
  var a = audio(); if (!a) return null;
  if (!sndOut) {
    try {
      var comp = a.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 16; comp.attack.value = 0.002; comp.release.value = 0.12;
      sndOut = a.createGain(); sndOut.connect(comp); comp.connect(a.destination);
    } catch (e) { sndOut = null; return a.destination; }
  }
  try { sndOut.gain.value = VOL[pref("vol", "alto")] || VOL.alto; } catch (e) {}
  return sndOut;
}
function sndTone(o) {
  var a = audio(), dst = sndDest(); if (!a || !dst) return;
  try {
    var t = a.currentTime + 0.005 + (o.t || 0), d = o.d || 0.12, v = o.v == null ? 0.5 : o.v, f = o.f || 880;
    /* env: "hit" = golpe corto (toc), "bell" = campana que se apaga sola; si no, tono parejo */
    var add = function (type, fr, vol) {
      var osc = a.createOscillator(), g = a.createGain();
      osc.type = type; osc.frequency.setValueAtTime(fr, t);
      g.gain.setValueAtTime(0.0001, t);
      if (o.hit || o.bell) {
        g.gain.exponentialRampToValueAtTime(vol, t + (o.hit ? 0.002 : 0.004));
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      } else {
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.setValueAtTime(vol, t + Math.max(0.01, d * 0.55));
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      }
      osc.connect(g); g.connect(dst); osc.start(t); osc.stop(t + d + 0.03);
    };
    add(o.w || (o.hit || o.bell ? "sine" : "triangle"), f, v);
    if (o.w !== "square") add("sine", f * (o.bell ? 2.76 : 2), v * (o.bell ? 0.22 : 0.35));
  } catch (e) {}
}
/* Lenguaje de sonidos (5.0). Cada estímulo tiene SU sonido y ningún otro aviso lo imita:
   - FUERZA (subes, empujas, tiras, levantas): «tuiii», un tono que SUBE.
   - REGRESO (bajas o regresas el peso): «tiuuu», un tono que CAE.
   - MANTENER (quieto, aguantar, resistir): «tu-tu-tu», un tono parejo que late.
   Con «Largo» el tono dura lo mismo que la fase: te mueves al ritmo del sonido.
   Todo lo demás son tonos parejos, golpes cortos o campanas: nunca suben ni caen. */
var SNDS = {
  rep: [{ f: 1568, d: 0.07, v: 0.55, hit: 1 }, { f: 2349, d: 0.05, v: 0.22, hit: 1 }],
  top: [{ f: 1046, d: 1.1, v: 0.34, bell: 1 }, { f: 1319, d: 1.1, v: 0.3, bell: 1 }, { f: 1568, d: 1.1, v: 0.3, bell: 1 }, { f: 2093, d: 1.1, v: 0.2, bell: 1 }],
  count: [{ f: 988, d: 0.12, v: 0.62 }],
  lead: [{ f: 988, d: 0.12, v: 0.62 }],
  go: [{ f: 988, d: 0.45, v: 0.7 }],
  end: [{ f: 523, d: 1.0, v: 0.42, bell: 1 }, { f: 659, d: 1.0, v: 0.36, bell: 1 }, { f: 784, d: 1.0, v: 0.36, bell: 1 }],
  warn: [{ f: 196, d: 0.16, w: "square", v: 0.3 }, { f: 196, d: 0.16, w: "square", v: 0.3, t: 0.22 }],
  ok: [{ f: 1319, d: 0.4, v: 0.45, bell: 1 }],
  side: [{ f: 1175, d: 0.35, v: 0.45, bell: 1 }, { f: 1175, d: 0.45, v: 0.45, bell: 1, t: 0.18 }],
  tick: [{ f: 2200, d: 0.035, v: 0.16, hit: 1 }]
};
/* Sonido de un estímulo: kind = "con" (fuerza), "ecc" (regreso) o "pau" (mantener); dur = segundos de la fase */
function stimTone(kind, dur) {
  var a = audio(), dst = sndDest(); if (!a || !dst) return;
  var long = pref("tempoTone", "largo") !== "corto";
  var d = long ? clamp((dur || 1) * 0.9, 0.22, 4) : (kind === "pau" ? 0.36 : 0.26);
  try {
    var t = a.currentTime + 0.005, env = a.createGain(), pk = kind === "pau" ? 0.34 : 0.42, end = t + d;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(pk, t + 0.015);
    env.gain.exponentialRampToValueAtTime(pk * (d > 1.2 ? 0.45 : 0.75), Math.max(t + 0.02, end - 0.06));
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(dst);
    var o1 = a.createOscillator(), o2 = a.createOscillator(), h = a.createGain(); h.gain.value = 0.3;
    if (kind === "con") {        // tuiii: sube
      o1.type = "triangle"; o1.frequency.setValueAtTime(420, t); o1.frequency.exponentialRampToValueAtTime(1260, end);
      o2.type = "sine"; o2.frequency.setValueAtTime(840, t); o2.frequency.exponentialRampToValueAtTime(2520, end);
    } else if (kind === "ecc") { // tiuuu: cae
      o1.type = "sine"; o1.frequency.setValueAtTime(1180, t); o1.frequency.exponentialRampToValueAtTime(370, end);
      o2.type = "sine"; o2.frequency.setValueAtTime(1770, t); o2.frequency.exponentialRampToValueAtTime(555, end); h.gain.value = 0.18;
    } else {                     // tu-tu-tu: parejo y late
      o1.type = "triangle"; o1.frequency.setValueAtTime(587, t);
      o2.type = "sine"; o2.frequency.setValueAtTime(880, t); h.gain.value = 0.22;
    }
    var mix = a.createGain(); mix.gain.value = 1;
    o1.connect(mix); o2.connect(h); h.connect(mix);
    if (kind === "pau") {
      var lfo = a.createOscillator(), lg = a.createGain(); lfo.type = "square"; lfo.frequency.value = 6.5;
      mix.gain.value = 0.5; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(mix.gain);
      lfo.start(t); lfo.stop(end + 0.03);
    }
    mix.connect(env);
    o1.start(t); o2.start(t); o1.stop(end + 0.03); o2.stop(end + 0.03);
  } catch (e) {}
}
function snd(name, dur) {
  if (name === "con" || name === "ecc" || name === "pau") { stimTone(name, dur); return; }
  var s = SNDS[name]; if (s) s.forEach(sndTone);
}
function beep(freq, dur, vol) { sndTone({ f: freq || 880, d: dur || 0.12, v: Math.min(0.7, (vol || 0.25) * 2) }); }
var SND_NAMES = [["con", "FUERZA (subes, empujas, tiras): «tuiii», sube", 1], ["ecc", "REGRESO (bajas o regresas): «tiuuu», cae", 2], ["pau", "MANTENER (quieto, aguantas): «tu-tu-tu», parejo", 1.2], ["rep", "Nueva repetición: «toc»"], ["top", "Llegaste al tope del rango: campana"], ["count", "Cuenta 3-2-1: «pip»"], ["go", "¡Vamos!: «piiip»"], ["side", "Cambia de lado: «tin-tin»"], ["end", "Fin del tiempo: gong"]];
function soundTest(out) {
  audio();
  var at = 0;
  SND_NAMES.forEach(function (s) { setTimeout(function () { snd(s[0], s[2]); if (out) { out.hidden = false; out.textContent = "Sonido: " + s[1]; } }, at); at += Math.max(900, (s[2] || 0.5) * 1000 + 700); });
  setTimeout(function () { if (!out) return; out.textContent = "Si no se oye bien, sube el volumen del equipo o elige «Máximo» en Ajustes."; if (out.id === "p-hfmsg") setTimeout(hfPaint, 4000); }, at + 300);
}
var voices = [];
function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } }
if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }
function voiceOn() { return !!pref("voice", true); }
function esVoice() {
  var i;
  for (i = 0; i < voices.length; i++) if (/^es[-_](PE|419|MX|US|CO|AR|CL)/i.test(voices[i].lang)) return voices[i];
  for (i = 0; i < voices.length; i++) if (/^es/i.test(voices[i].lang)) return voices[i];
  return null;
}
var SAY = { until: 0, last: "", lastT: 0 };
function cleanSpeech(t) { return spoken(String(t == null ? "" : t).replace(/<[^>]+>/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_#`>|•]+/g, " ").replace(/\s+/g, " ").trim()); }
/* Una sola voz para toda la app. urgent = corta lo que esté diciendo. */
function say(text, urgent) {
  if (!voiceOn() || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  var t = cleanSpeech(text); if (!t) return;
  try {
    if (urgent) speechSynthesis.cancel(); else if (speechSynthesis.pending) return;
    var u = new SpeechSynthesisUtterance(t), v = esVoice(), rate = +pref("vozRate", 1.05) || 1.05;
    if (v) u.voice = v; u.lang = v ? v.lang : "es-ES"; u.rate = rate; u.volume = 1;
    var est = t.length * 72 / rate;
    SAY.last = t; SAY.lastT = Date.now(); SAY.until = Date.now() + 900 + est;
    u.onstart = function () { if (SAY.last === t) SAY.until = Math.max(SAY.until, Date.now() + est + 400); };
    u.onend = u.onerror = function () { if (SAY.last === t) SAY.until = Date.now() + 350; };
    speechSynthesis.speak(u);
  } catch (e) {}
}
function speak(text) { say(text, true); }
/* ¿La app está hablando? Usa lo que dice el navegador (con tope por si se queda pegado) y la estimación */
function ttsBusy() {
  var n = Date.now();
  try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending) && n < SAY.until + 4000) return true; } catch (e) {}
  return n < SAY.until;
}
var wakeLock = null;
function keepAwake() { try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {}); } catch (e) {} }
function releaseAwake() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }

var metro = {
  on: false, next: 0, timer: null,
  bpm: function () { return pref("bpm", 175); },
  start: function () {
    var a = audio(); if (!a || this.on) return;
    this.on = true; this.next = a.currentTime + 0.1;
    var self = this; this.timer = setInterval(function () { self.schedule(); }, 25);
  },
  stop: function () { this.on = false; if (this.timer) clearInterval(this.timer); this.timer = null; },
  schedule: function () { if (!actx) return; while (this.next < actx.currentTime + 0.12) { this.click(this.next); this.next += 60 / this.bpm(); } },
  click: function (t) {
    try {
      var o = actx.createOscillator(), g = actx.createGain(), dst = sndDest() || actx.destination;
      o.type = "square"; o.frequency.value = 2000; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + 0.04);
    } catch (e) {}
  }
};

/* ===================== Modo guiado: estado ===================== */
var P = { active: false, kind: null, key: null, date: null, plan: null, steps: [], idx: 0, elapsed: 0, total: 0, remaining: 0, running: false, paused: false, last: 0, timer: null, marks: {}, exitArmed: 0, done: false, title: "", log: [], flags: [], kneeAfter: null, feel: null, plannedSets: 0, notice: "", seg: null, segDef: null, routine: null, lastLog: null };
var FAST = /^(Muy rápido|Subida rápida|Fuerte)/;
function isTimed(st) { return st && (st.type === "itemhold" || st.type === "gap" || st.type === "hold" || st.type === "rest" || st.type === "wait" || st.type === "phase" || st.type === "seg" || st.type === "tr"); }
function needsStart(st) { return st && (st.type === "itemhold" || st.type === "hold" || st.type === "phase" || (st.type === "seg" && st.needsStart)); }
function sig(st) { return [st.type, st.block ? st.block.id : "", st.ex ? st.ex.id : "", st.item ? st.item.name : "", st.round || st.set || 0, st.side || 0, st.roundStart != null ? st.roundStart : ""].join("|"); }
function countSets(steps) { var o = {}; steps.forEach(function (s) { if (s.type === "work" || s.type === "hold") o[s.ex.id + "|" + s.round] = 1; }); return Object.keys(o).length; }
function countLogged(log) { var o = {}; log.forEach(function (e) { if (!e.skip) o[e.x + "|" + e.s] = 1; }); return Object.keys(o).length; }
function dropExercise(steps, from, id) {
  return steps.slice(0, from).concat(steps.slice(from).filter(function (s) {
    if ((s.type === "work" || s.type === "hold") && s.ex.id === id) return false;
    if (s.type === "rest" && s.after === id) return false;
    if (s.type === "tr" && s.to && s.to.ex && s.to.ex.id === id) return false;
    return true;
  }));
}

/* ===================== Abrir el reproductor ===================== */
function openSession(key, resume) {
  var D = DAYS[key], date = TODAY();
  var plan = D.type === "aero" ? buildPlan(D, { mode: "full", deload: false }) : planFor(D, date);
  resetP();
  P.kind = "session"; P.key = key; P.date = date; P.plan = plan; P.steps = plan.steps.slice(); P.total = plan.total;
  P.title = D.day + ": " + (plan.opts.mode === "stop" && D.stopPlan ? D.stopPlan.title : D.type === "aero" ? D.weeks.A.title : D.title);
  P.plannedSets = countSets(P.steps);
  if (resume && resume.date === date) {
    var i0 = P.steps.findIndex(function (s) { return sig(s) === resume.sig; });
    if (i0 < 0) i0 = Math.min(resume.idx || 0, P.steps.length - 1);
    (resume.flags || []).forEach(function (f) { P.steps = dropExercise(P.steps, i0 + 1, f.x); });
    var i1 = P.steps.findIndex(function (s) { return sig(s) === resume.sig; });
    P.idx = i1 >= 0 ? i1 : Math.min(i0, P.steps.length - 1);
    P.elapsed = resume.elapsed || 0; P.log = resume.log || []; P.flags = resume.flags || [];
  }
  P.intro = resume && resume.date === date ? "Seguimos donde quedaste." : D.day + ". " + (plan.opts.mode === "stop" && D.stopPlan ? D.stopPlan.title : D.type === "aero" ? D.weeks.A.title : D.title) + ". " + Math.round(plan.total / 60) + " minutos.";
  P.prep = !(resume && resume.date === date) && D.type === "train" && pref("prepScreen", true) !== false;
  startPlayer(routeHTML(plan, false) + '<span class="p-marker" id="p-marker"></span>');
}
function openSeg(which) {
  var def = which === "walk" ? WALK : which === "hill" ? HILL : FOURBYFOUR;
  resetP();
  P.kind = "seg"; P.seg = which; P.segDef = def; P.key = current; P.date = TODAY(); P.title = def.title;
  var t = 0;
  P.steps = def.segments.map(function (s, i) { var st = { type: "seg", seg: s, dur: s[1], needsStart: i === 0, fast: FAST.test(s[0]), i: i, planAt: t }; t += s[1]; return st; });
  P.total = t;
  var h = '<div class="route">';
  def.segments.forEach(function (s, i) { h += '<span class="seg ' + (FAST.test(s[0]) ? "tone-fuerza" : "tone-prep") + '" data-i="' + i + '" style="width:' + (s[1] / t * 100).toFixed(3) + '%"></span>'; });
  P.intro = def.title + ".";
  startPlayer(h + '</div><span class="p-marker" id="p-marker"></span>');
}
function openRoutine(id) {
  var R = null; DAYS[current].routines.forEach(function (r) { if (r.id === id) R = r; });
  if (!R) return;
  resetP();
  var b = { id: "r", label: "", name: R.title, kind: "list", tone: R.tone, items: R.items };
  P.kind = "routine"; P.routine = R; P.key = current; P.date = TODAY(); P.title = R.title;
  P.steps = stepsForBlock(b, { mode: "full", deload: false });
  var t = 0; P.steps.forEach(function (s) { s.planAt = t; t += stepEst(s); }); P.total = t;
  P.intro = R.title + ". " + R.minutes + " minutos.";
  startPlayer("");
}
function resetP() {
  P.idx = 0; P.elapsed = 0; P.paused = false; P.done = false; P.log = []; P.flags = []; P.kneeAfter = null; P.feel = null; P.notice = ""; P.lastLog = null; P.marks = {};
  P.fb = ""; P.intro = ""; P.leadNext = 0; P.lgOpen = false; P.autoItem = false; P.hfSaid = false; P.autoSaid = false; GEST.since = 0; GEST.needDown = false;
  P.prep = false; P.sideAuto = false; P.side1 = null; SPK.names = {}; SPK.loads = {}; PREP.plan = null;
  P.tm = { serie: 0, descanso: 0, cambio: 0, pausa: 0 }; P.enterAt = null; P.boxed = false; P.quietLead = false; P.pauseT0 = 0;
}
function startPlayer(routeHtml) {
  audio(); keepAwake(); screenStart();
  $("player").hidden = false; document.body.classList.add("playing");
  $("p-name").textContent = P.title;
  $("p-route").innerHTML = routeHtml; $("p-route").hidden = !routeHtml;
  setToolBtns();
  P.active = true; P.last = performance.now();
  if (P.timer) clearInterval(P.timer);
  P.timer = setInterval(tick, 200);
  if (pref("cam", false) && (P.kind === "session" || P.kind === "routine") && !CAM.on) camStart();
  asstSync(false);
  if (P.prep) { renderPrep(); speak((P.intro ? P.intro + " " : "") + prepStartSay()); P.intro = ""; }
  else enterStep(P.idx, true);
  try { $("p-main").focus(); } catch (e) {}
}
function closePlayer() {
  var ids = P.done && P.kind === "session" && DAYS[P.key] && DAYS[P.key].type === "train" ? uniq(P.log.filter(function (e) { return !e.skip; }).map(function (e) { return e.x; })) : [];
  P.active = false; pacerStop(); metro.stop();
  if (P.timer) clearInterval(P.timer); P.timer = null;
  try { if (window.speechSynthesis && !TALK.on) speechSynthesis.cancel(); } catch (e) {}
  if (!TALK.on) releaseAwake();
  camStop(true); askClose(); hfStop(); fbHide();
  if (TALK.on && TALK.bySession) talkStop();
  $("player").hidden = true; document.body.classList.remove("playing");
  if ($("p-sheet")) $("p-sheet").hidden = true;
  screenEnd();
  renderDay(current);
  v4AfterClose(ids);
  talkPaint();
}
function saveRun() {
  if (P.kind !== "session" || P.done) return;
  var st = P.steps[P.idx];
  setRun({ kind: "session", key: P.key, date: P.date, idx: P.idx, sig: st ? sig(st) : "", elapsed: Math.round(P.elapsed), t: Date.now(), log: P.log, flags: P.flags });
}

/* ===================== Pasos ===================== */
function enterStep(i, announce) {
  metro.stop(); pacerStop();
  if (i >= P.steps.length) { finish(); return; }
  if (i < 0) i = 0;
  if (P.prep) { P.prep = false; P.idx = -1; }
  var old = P.idx, prevSt = P.steps[old];
  tmStep(prevSt, old, i);
  P.idx = i; P.marks = {}; P.lgOpen = false; P.autoItem = false; P.boxed = false; P.quietLead = false;
  var st = P.steps[i];
  /* 5.0: terminaste el lado 1 → el lado 2 empieza solo, con una cuenta corta para cambiar */
  P.sideAuto = i === old + 1 && sameMove(prevSt, st) && prevSt.side === 1 && st.side === 2 && pref("sideAuto", true) !== false;
  /* 6.0: sesión continua → nada espera a que toques: empieza sola después del descanso o del cambio */
  var flow = flowOn() && P.kind !== "seg", lead = P.sideAuto ? SIDE_LEAD : flowLead(prevSt, old, i);
  P.quietLead = flow && !P.sideAuto && lead <= 2;
  if (st.type === "wait") { P.remaining = st.target - P.elapsed; P.running = true; }
  else if (isTimed(st)) { P.remaining = st.dur; P.running = !needsStart(st); if (flow && needsStart(st) && st.type !== "phase") { P.running = true; P.remaining = st.dur + lead; } }
  else if (st.type === "item" && autoItemsOn()) { P.autoItem = true; P.remaining = st.item.est || EST.item; P.running = true; }
  else if (st.type === "work" && flow && !pacerEligible(st) && pref("flujoFin", true) !== false) { P.boxed = true; P.remaining = workSecs(st.ex) + lead; P.boxLead = lead; P.running = true; }
  else { P.remaining = 0; P.running = false; }
  if (P.sideAuto && needsStart(st)) { P.running = true; P.remaining = st.dur + SIDE_LEAD; }
  saveRun();
  renderStep();
  if (P.sideAuto) snd("side");
  if (announce !== false) announceStep(st);
  if (P.sideAuto && st.type === "work" && pacerEligible(st)) { pacerStart(st, SIDE_LEAD); updateButtons(); }
  else if (flow && st.type === "work" && pacerEligible(st)) { pacerStart(st, lead); updateButtons(); }
  if (st.type === "wait" && P.remaining <= 0) setTimeout(function () { if (P.steps[P.idx] === st && !P.done) enterStep(P.idx + 1); }, 400);
}
function stepLabel(st) {
  if (!st) return "fin";
  if (st.type === "work" || st.type === "hold") return st.ex.code + ". " + st.ex.name + ", serie " + st.round + " de " + st.rounds + (st.side ? ", lado " + st.side : "");
  if (st.type === "item" || st.type === "itemhold") return st.item.name + (st.sets > 1 ? " " + st.set + " de " + st.sets : "") + (st.side ? ", lado " + st.side : "");
  if (st.type === "gap") return "Pausa de " + st.dur + " s";
  if (st.type === "rest") return "Descanso de " + st.dur + " s";
  if (st.type === "wait") return "Espera hasta el minuto " + fmt(st.target);
  if (st.type === "phase") return st.ex.name;
  if (st.type === "seg") return st.seg[0] + ", " + secsLabel(st.seg[1]);
  return "";
}
function nextWork(i) {
  for (var j = i + 1; j < P.steps.length; j++) { var s = P.steps[j]; if (s.type !== "rest" && s.type !== "wait" && s.type !== "gap") return s; }
  return null;
}
var SIDE_LEAD = 6;
function sameMove(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.ex && b.ex) return a.ex.id === b.ex.id && a.round === b.round;
  if (a.item && b.item) return a.item === b.item && a.set === b.set;
  return false;
}
function sideHint(st) { return st.side === 1 ? "Lado 1: empieza por el más débil." : st.side === 2 ? "Lado 2: iguala las repeticiones del lado 1." : ""; }
/* Qué se dijo hace poco, para no repetir el nombre del ejercicio 2 o 3 veces seguidas (5.0) */
var SPK = { names: {}, loads: {} };
function saidRecently(map, k, ms) { var t = map[k]; return !!t && Date.now() - t < (ms || 75000); }
function exShort(x) { return String(x.name || "").replace(/\s*\([^)]*\)\s*/g, " ").trim(); }
function nextSay(n) {
  if (!n) return "Es lo último.";
  if (n.ex) { SPK.names[n.ex.id] = Date.now(); return "Sigue: " + exShort(n.ex) + (n.side === 2 ? ", lado 2" : "") + "."; }
  if (n.item) return "Sigue: " + n.item.name + ".";
  return "Sigue: " + stepLabel(n) + ".";
}
function announceStep(st) {
  var t = "";
  if (st.type === "work" || st.type === "hold") {
    var x = st.ex, named = saidRecently(SPK.names, x.id);
    if (st.side === 2 && P.sideAuto) t = "Cambia de lado. " + (st.type === "hold" ? "Aguanta igual." : "Iguala las repeticiones.");
    else {
      var lt = effLoadText(x), es = st.round === 1 && (st.side || 1) === 1 && !saidRecently(SPK.loads, lt, 120000) ? eqSay(lt) : "";
      if (es) SPK.loads[lt] = Date.now();
      t = (named ? "" : x.code + ". " + exShort(x) + ". ") + "Serie " + st.round + " de " + st.rounds + ": " + setDose(x) + (st.side ? " por lado" : "") + "." +
        (st.side === 1 ? " Empieza por tu lado más débil." : st.side === 2 ? " Lado 2." : "") + (es ? " Con " + es + "." : "") +
        (st.type === "hold" ? " Toca empezar cuando estés en posición." : "");
      if (st.type === "work" && pref("hf", false) && HF.want && !P.hfSaid) { P.hfSaid = true; t += " Al terminar, di «listo» o «hice ocho»."; }
    }
    SPK.names[x.id] = Date.now();
  }
  else if (st.type === "itemhold") t = st.item.name + (st.side ? ", lado " + st.side : "") + ". " + (st.side === 2 && P.sideAuto ? "" : "Toca empezar.");
  else if (st.type === "item") { t = st.item.name + ", " + st.item.dose + "."; if (P.autoItem && !P.autoSaid) { P.autoSaid = true; t += " Avanzo solo en " + Math.round(P.remaining) + " segundos; di «listo» si terminas antes."; } }
  else if (st.type === "gap") t = "Pausa, " + st.dur + " segundos.";
  else if (st.type === "rest") { var rs = P.kind === "session" ? restSay(P.idx) : ""; t = "Descanso, " + st.dur + " segundos. " + (st.note && !/Ahora/.test(rs) ? st.note + " " : "") + (rs || nextSay(nextWork(P.idx))); }
  else if (st.type === "tr") t = "Cambio, " + st.dur + " segundos. " + restSay(P.idx);
  else if (st.type === "wait") { var rs2 = P.kind === "session" ? restSay(P.idx) : nextSay(nextWork(P.idx)); t = (st.first ? "El circuito empieza en el minuto " : "Descansa hasta el minuto ") + Math.round(st.target / 60) + ". " + rs2; }
  else if (st.type === "phase") t = st.ex.name + ". Treinta minutos. Toca empezar.";
  else if (st.type === "seg") t = st.seg[0] + ", " + (st.seg[1] >= 60 ? Math.round(st.seg[1] / 60) + " minutos" : st.seg[1] + " segundos") + ".";
  var pre = "";
  if (P.intro) { pre += P.intro + " "; P.intro = ""; }
  if (P.fb) { pre += P.fb + " "; P.fb = ""; }
  speak(pre + t);
}
/* Lo que se dice al entrar a un descanso sobre el equipo (el planificador inteligente lo reemplaza si existe) */
function restPrepSay(i) {
  if (typeof prepPlanSay === "function") { var r = prepPlanSay(i); if (r != null) return r; }
  var st = P.steps[i], ps = eqPrepSay(i);
  if (st && st.note && /disco/i.test(st.note) && /^Cambia/.test(ps)) return st.note;
  return ps;
}
function rxRow(x, noCap) {
  var h = '<dl class="p-rx">';
  if (x.tempo) h += "<div><dt>" + (tempoParts(x.tempo) ? "Tempo" : "Ritmo") + "</dt><dd>" + esc(x.tempo) + "</dd></div>";
  var rir = P.plan && P.plan.opts.deload ? "3-4" : x.rir;
  if (rir) h += "<div><dt>" + (/^\d/.test(rir) ? "RIR" : "Límite") + "</dt><dd>" + esc(rir) + "</dd></div>";
  if (x.load) h += '<div class="rx-load"><dt>Carga</dt><dd>' + eqHTML(effLoadText(x), true) + "</dd></div>";
  if (x.rung > 0 && x.rungText) h += "<div><dt>Peldaño</dt><dd>" + esc(x.rungText) + "</dd></div>";
  var cap = noCap ? "" : gobletCap(x); if (cap) h += '<div class="rx-warn"><dt>Ojo</dt><dd>' + esc(cap) + "</dd></div>";
  return h + "</dl>";
}
function gobletCap(x) {
  if (!x || x.id !== "goblet") return "";
  var sp = eqParse(effLoadText(x)), inv = eqInv(); if (!sp || sp.kg == null) return "";
  var tot = sp.kg + (inv.bar || 0) + (sp.moch || 0);
  if (tot <= 20.001) return "";
  return "Suman " + kgTxt(tot) + " kg y el techo es 20 kg hasta la evaluación: usa la mochila de " + kgTxt(Math.max(0, 20 - sp.kg - (inv.bar || 0))) + " kg.";
}
function leaderLabel(x) {
  if (!x || !x.follow) return "";
  var code = "", name = (EX[x.follow] || {}).name || "";
  if (P && P.steps) for (var i = 0; i < P.steps.length; i++) { var st = P.steps[i]; if (st.ex && st.ex.id === x.follow) { code = st.ex.code; break; } }
  return (code ? code + ". " : "") + name;
}
function levelHTML(x) {
  var lib = EX[x.id]; if (!lib || !lib.ladder || lib.ladder.length < 2) return "";
  var n = lib.ladder.length, r = Math.min(x.rung || 0, n - 1), sg = null;
  try { sg = suggestion(x); } catch (e) { sg = null; }
  var goal = (x.hold ? "aguantar " + secsLabel(x.hold) : "llegar a " + repsRange(x.reps)[1]) + (x.side ? " por lado" : "") + " en todas las series, dos sesiones seguidas";
  var next = r < n - 1 ? rungText(lib, r + 1) : "", miss = next ? eqRungNote(lib, r + 1) : "";
  var h = '<p class="p-level"><span class="k">Nivel ' + (r + 1) + " de " + n + ".</span> ";
  if (sg && sg.kind === "up") h += "Ya cumpliste: al terminar te propongo subir a «" + esc(next) + "».";
  else if (sg && (sg.gate || sg.kind === "effort" || sg.kind === "plateau")) h += esc(sg.text) + " ";
  else if (x.unit === "pasos") h += next ? "Cuando te sientas firme: " + esc(next) + "." : "Último nivel.";
  else if (next && rungPhase(lib, r + 1) > phaseN()) h += "Siguiente: " + esc(next) + " (se abre en la fase 2, tras la evaluación).";
  else if (next) h += "Para subir: " + esc(goal) + ". Sigue: " + esc(next) + "." + (miss ? " " + esc(miss) : "");
  else h += "Último nivel: sube el esfuerzo, no los minutos.";
  if (x.follow) h += " El peso lo marca " + esc(leaderLabel(x)) + ".";
  return h + "</p>";
}
function cuesList(x) {
  var c = (x.cues || []).slice(); if (x.breath) c.push(x.breath);
  if (!c.length) return "";
  return '<ul class="p-cues">' + c.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>";
}
function kneeBox(x) {
  if (!x.knee) return "";
  return '<div class="kbox"><button class="pbtn quiet" data-p="knee" type="button">Molestia de rodilla</button><div class="kopts" hidden>' +
    '<p>¿Qué pasó? Se corta este ejercicio por hoy.</p>' +
    '<button class="pbtn" data-p="kneeopt" data-v="dolor" type="button">Dolor mayor a 2/10</button><button class="pbtn" data-p="kneeopt" data-v="hueso" type="button">Hueso desubicado</button><button class="pbtn" data-p="kneeopt" data-v="chasquido" type="button">Chasquido con dolor</button><button class="pbtn quiet" data-p="kneecancel" type="button">Era falsa alarma</button></div></div>';
}
function renderStep() {
  if (P.prep) { renderPrep(); return; }
  var st = P.steps[P.idx];
  var tone = st.block ? st.block.tone : st.type === "seg" ? (st.fast ? "fuerza" : "prep") : (P.routine ? P.routine.tone : "prep");
  var restish = st.type === "rest" || st.type === "gap" || st.type === "wait" || st.type === "tr";
  $("p-body").className = "p-body t-" + st.type + " tone-" + tone + (restish ? " is-rest" : "");
  var k = "", t = "", s = "", x = "", ln = "", more = "", moreLab = "Detalles: carga, tempo y técnica", dm = "";
  var mod = P.plan && P.plan.opts.mode === "mod", demoOn = pref("demo", true) !== false;
  if (P.notice) { x += '<p class="p-note warn">' + esc(P.notice) + "</p>"; P.notice = ""; }
  if (st.type === "work" || st.type === "hold") {
    var ex = st.ex, lt = effLoadText(ex), cap = gobletCap(ex), pos = posOf(ex);
    k = "Bloque " + st.block.label + " · " + st.block.name;
    t = ex.code + ". " + ex.name;
    ln = '<span class="p-setline">Serie ' + st.round + " de " + st.rounds + (st.side ? " · lado " + st.side : "") + lvlChip(ex) + "</span>" + (st.side ? '<span class="p-side">' + esc(st.side === 1 ? "Empieza por tu lado más débil" : P.sideAuto ? "Cambia de lado: iguala las repeticiones" : "Iguala las repeticiones del lado 1") + "</span>" : "");
    s = '<span class="p-dose">' + esc(setDose(ex)) + "</span>" + metaLine(ex) +
      (lt && eqParse(lt) ? '<span class="p-loadline">' + eqChipHTML(lt) + "</span>" : "") +
      (ex.rung > 0 && ex.rungText ? '<span class="p-rung">' + esc(ex.rungText) + "</span>" : "") +
      (pos ? '<span class="p-pos">' + esc(POS_TXT[pos]) + "</span>" : "");
    if (mod && ex.modNote) x += '<p class="p-note warn">' + esc(ex.modNote) + "</p>";
    if (cap) x += '<p class="p-note warn">' + esc(cap) + "</p>";
    x += cuesShort(ex) + kneeBox(ex);
    more = rxRow(ex, true) + levelHTML(ex) + (st.type === "work" && tempoParts(ex.tempo) ? tempoBarHTML(ex, true) : "") + cuesMore(ex) + '<div class="how">' + howHTML(ex, true) + "</div>";
    if (demoOn) dm = demoHTML(ex, st.type === "work", "big");
  } else if (st.type === "item" || st.type === "itemhold") {
    k = st.block.name;
    t = st.item.name + (st.side ? ", lado " + st.side : "");
    s = '<span class="p-dose">' + esc(st.sets > 1 ? "Serie " + st.set + " de " + st.sets + ", " + secsLabel(st.dur) : st.item.dose) + "</span>";
    if (mod && st.item.name === "Sentadilla isométrica en pared") x += '<p class="p-note warn">Filtro modificado: un puño más arriba que tu caja.</p>';
    x += '<p class="p-how-inline">' + esc(st.item.how) + "</p>";
    if (demoOn && ITEM_DEMO[st.item.name]) dm = demoHTML(itemDemoEx(st.item), false, "big");
  } else if (restish) {
    var nx = nextWork(P.idx);
    k = (st.type === "tr" ? "Cambio" : st.type === "gap" ? "Pausa" : st.type === "wait" ? "Espera" : "Descanso") + (st.block ? " · " + (st.type === "gap" ? st.block.name : "Bloque " + st.block.label + " · " + st.block.name) : "");
    t = st.type === "tr" ? "Cambio" : st.type === "gap" ? "Pausa" : st.type === "wait" ? (st.first ? "Empieza en el minuto " + fmt(st.target) : "Descanso hasta el minuto " + fmt(st.target)) : "Descanso";
    if (st.type === "wait") s = '<span class="p-meta">Cada ronda empieza en su minuto exacto</span>';
    x += P.kind === "session" ? restCardHTML(P.idx) : (st.note ? '<p class="p-note">' + esc(st.note) + "</p>" : "") + nextCardHTML(nx) + eqPrepHTML(P.idx, true);
    if (st.type !== "tr") x += '<div id="p-login"></div>';
    if (demoOn && nx && nx.ex) dm = demoHTML(nx.ex, false, "big next");
    else if (demoOn && nx && nx.item && ITEM_DEMO[nx.item.name]) dm = demoHTML(itemDemoEx(nx.item), false, "big next");
  } else if (st.type === "phase") {
    k = st.block.name; t = st.ex.name;
    s = '<span class="p-dose">30 minutos a 170-180 pasos por minuto</span>';
    x += metroHTML() + cuesList(st.ex);
    more = '<div class="how">' + howHTML(st.ex) + "</div>"; moreLab = "Cómo hacerlo";
    if (demoOn && demoOf(st.ex.id)) dm = demoHTML(st.ex, false, "big");
  } else if (st.type === "seg") {
    k = P.title; t = st.seg[0];
    s = '<span class="p-dose">' + secsLabel(st.seg[1]) + "</span>";
    x += '<p class="p-how-inline">' + esc(st.seg[2]) + "</p>";
    if (P.idx === 0) x += '<p class="p-note">' + esc(P.segDef.lead) + "</p>";
  }
  if (more) x += '<details class="p-more" id="p-more"' + (moreOpen() ? " open" : "") + "><summary>" + esc(moreLab) + "</summary>" + more + "</details>";
  $("p-demo").innerHTML = dm;
  $("p-body").classList.toggle("no-demo", !dm);
  $("p-hero").className = "p-hero" + (dm ? " has-demo" : "") + (restish ? " rest" : "");
  $("p-kind").textContent = k;
  $("p-title").textContent = t;
  var pl = $("p-line"); if (pl) { pl.innerHTML = ln; pl.hidden = !ln; }
  $("p-sub").innerHTML = s;
  $("p-extra").innerHTML = x;
  var how = $("p-how"); how.hidden = true; how.open = false;
  $("p-pacer").hidden = true;
  $("p-next").textContent = restish ? "" : P.kind === "session" ? nextLineTxt(P.idx) : (P.steps[P.idx + 1] ? "Sigue: " + stepLabel(P.steps[P.idx + 1]) : "Sigue: fin");
  $("p-live").textContent = t;
  updateButtons(); updateCount(); updateClock(); renderLogBar();
  try { $("p-body").scrollTop = 0; } catch (e) {}
  camOnStep();
}
function metroHTML() {
  var on = pref("metro", true);
  return '<div class="metro"><button class="pbtn" data-p="metro" aria-pressed="' + on + '" type="button">Metrónomo ' + (on ? "activado" : "apagado") + '</button>' +
    '<div class="m-bpm"><button class="pbtn sq" data-p="bpmdown" aria-label="Menos pasos por minuto" type="button">−</button><span id="m-val">' + metro.bpm() + ' ppm</span><button class="pbtn sq" data-p="bpmup" aria-label="Más pasos por minuto" type="button">+</button></div></div>';
}

/* ===================== Guía de tempo ===================== */
var PC = { running: false, paused: false, t0: 0, pauseAt: 0, pausedTotal: 0, phases: [], cycle: 0, lead: 3, reps: 0, key: -1, timer: null, top: 0, lastLead: 4 };
function pacerEligible(st) { return pref("tempo", false) && st && st.type === "work" && st.ex.pacer !== false && st.ex.unit !== "pasos" && !!tempoParts(st.ex.tempo); }
function pacerStart(st, lead) {
  var p = tempoParts(st.ex.tempo), order = st.ex.start === "bottom" ? [2, 3, 0, 1] : [0, 1, 2, 3], names = st.ex.phNames || PH.squat;
  PC.phases = [];
  order.forEach(function (i, n) { var q = p[i]; if (!q.s && !q.x) return; PC.phases.push({ n: n, dur: q.s || 1, x: !!q.x, i: i, name: q.x ? names[i] + " rápido" : names[i], kind: i === 0 ? "ecc" : i === 2 ? "con" : "pau" }); });
  PC.cycle = PC.phases.reduce(function (a, q) { return a + q.dur; }, 0) || 1;
  PC.running = true; PC.paused = false; PC.t0 = performance.now(); PC.pausedTotal = 0; PC.reps = 0; PC.key = -1; PC.sec = 0; PC.lead = lead || 3; PC.lastLead = PC.lead + 1;
  PC.top = repsRange(st.ex.reps)[1];
  $("p-pacer").hidden = false;
  if (PC.timer) clearInterval(PC.timer);
  PC.timer = setInterval(pacerTick, 30);
  pacerTick();
}
function side2Done(cs, reps) {
  if (!P.active || P.done || P.steps[P.idx] !== cs) return;
  pacerStop(); logWork(cs, reps); enterStep(P.idx + 1);
}
function pacerStop() { var r = PC.reps; if (PC.timer) clearInterval(PC.timer); PC.timer = null; var was = PC.running; PC.running = false; PC.paused = false; return was ? r : null; }
function pacerTime() { var now = performance.now(); return (now - PC.t0 - PC.pausedTotal - (PC.paused ? now - PC.pauseAt : 0)) / 1000; }
function pacerTick() {
  if (!PC.running || PC.paused) return;
  var t = pacerTime() - PC.lead;
  if (t < 0) { var l = Math.ceil(-t); if (l !== PC.lastLead) { PC.lastLead = l; if (!P.quietLead) { snd("lead"); if (l <= 3) say(String(l), true); } } paintPacer(-1, l, 0); return; }
  var reps = Math.floor(t / PC.cycle), inC = t - reps * PC.cycle, acc = 0, ph = 0;
  for (ph = 0; ph < PC.phases.length - 1; ph++) { if (inC < acc + PC.phases[ph].dur) break; acc += PC.phases[ph].dur; }
  var q = PC.phases[ph], inPh = inC - acc, newRep = reps !== PC.reps, words = pref("tempoWords", true);
  if (newRep) {
    PC.reps = reps; if (reps > 0) snd(reps === PC.top ? "top" : "rep");
    /* 5.0: en el lado 2, al igualar las repeticiones del lado 1 la serie termina sola */
    var cs = P.steps[P.idx], s1 = P.side1;
    if (reps > 0 && cs && cs.type === "work" && cs.side === 2 && s1 && s1.x === cs.ex.id && s1.s === cs.round && !s1.auto && s1.r > 0 && reps >= s1.r && pref("side2End", true) !== false) {
      PC.running = false; setTimeout(function () { side2Done(cs, reps); }, 380); return;
    }
    /* 6.0: con la sesión continua, la serie termina sola al llegar al tope del rango */
    if (reps > 0 && reps >= PC.top && cs && cs.type === "work" && cs.side !== 2 && topEnd(cs.ex)) {
      PC.running = false; setTimeout(function () { side2Done(cs, reps); }, 380); return;
    }
  }
  var key = reps * 10 + ph;
  if (key !== PC.key) {
    PC.key = key; PC.sec = 0;
    snd(q.kind, q.x ? 0.3 : q.dur);   // cada fase con SU sonido, también la primera de cada repetición
    var txt = "";
    if (newRep && reps > 0) txt = reps === PC.top ? reps + ". Tope del rango." : String(reps);
    if (words && q.dur >= 2 && !(newRep && reps === PC.top)) txt += (txt ? ". " : "") + q.name;
    if (txt) say(txt, true);
  } else if (q.dur >= 2 && pref("tempoTone", "largo") === "corto") { var sec = Math.floor(inPh); if (sec > PC.sec) { PC.sec = sec; snd("tick"); } }
  paintPacer(ph, 0, inPh / q.dur);
}
function paintPacer(ph, lead, frac) {
  var el = $("p-pacer"); if (!el) return;
  var q = ph >= 0 ? PC.phases[ph] : null;
  el.innerHTML = '<div class="pc-rep"><span>' + (lead ? "Prepárate" : "Repetición") + "</span><b>" + (lead ? lead : PC.reps + 1) + "</b></div>" +
    '<div class="pc-ph ' + (q ? q.kind : PC.phases[0] ? PC.phases[0].kind + " pc-lead" : "") + '"><b>' + (q ? esc(q.name) : PC.phases[0] ? "Primero: " + esc(PC.phases[0].name.toLowerCase()) : "…") + '</b><i style="width:' + Math.round(clamp(frac, 0, 1) * 100) + '%"></i></div>' +
    '<p class="pc-done">Hechas: ' + PC.reps + (PC.top ? " de " + PC.top : "") + "</p>";
  var segs = document.querySelectorAll("#p-extra .tbar.big .tb");
  for (var i = 0; i < segs.length; i++) segs[i].classList.toggle("now", !!q && +segs[i].getAttribute("data-ph") === q.n);
}

/* ===================== Registro de series ===================== */
function logSet(e) {
  var i = P.log.findIndex(function (z) { return z.x === e.x && z.s === e.s && (z.side || 0) === (e.side || 0); });
  if (i >= 0) { if (P.log[i].rir != null && e.rir == null) e.rir = P.log[i].rir; P.log[i] = e; } else P.log.push(e);
  P.lastLog = e; saveRun();
}
function logWork(st, reps, force) {
  var x = st.ex, e = { x: x.id, code: x.code, s: st.round, n: st.rounds, side: st.side || 0, lvl: x.rung, auto: true };
  if (x.unit === "pasos") e.r = repsRange(x.reps)[1];
  else if (reps != null && reps > 0) { e.r = reps; e.auto = false; }
  else e.r = repsMid(x.reps);
  var cr = x.unit === "pasos" ? null : camTake(st);
  if (cr) { if (!force) e.r = cr.reps; e.auto = false; e.q = cr.q; }
  if (st.side === 2) { var e1 = P.log.find(function (z) { return z.x === e.x && z.s === e.s && z.side === 1 && !z.skip; }); if (e1 && e1.rir != null && e.rir == null) e.rir = e1.rir; }
  logSet(e);
  if (st.side === 1) P.side1 = { x: x.id, s: st.round, r: e.r, auto: e.auto };
  if (st.side === 1 && sameMove(st, P.steps[P.idx + 1])) return;   // la opinión de la serie va al terminar los dos lados
  afterSet(st, e);
}
function logHold(st, secs) { logSet({ x: st.ex.id, code: st.ex.code, s: st.round, n: st.rounds, side: st.side || 0, lvl: st.ex.rung, t: Math.round(secs), auto: false }); }
/* 5.0: el registro va SOLO en los descansos (nada abajo tapa el contador) y junta lo hecho
   desde el descanso anterior: los dos lados de una serie en un solo cuadro, o toda la ronda de un circuito. */
function restLike(st) { return !!st && (st.type === "rest" || st.type === "gap" || st.type === "wait"); }
function logWorthy(e) { return !!e && !e.skip && !((EX[e.x] || {}).pacer === false && e.t == null); }
function logGroups(i) {
  var j = i - 1, keys = [], seen = {};
  while (j >= 0 && !restLike(P.steps[j])) {
    var s = P.steps[j];
    if ((s.type === "work" || s.type === "hold") && s.ex) { var k = s.ex.id + "|" + s.round; if (!seen[k]) { seen[k] = 1; keys.unshift(k); } }
    j--;
  }
  return keys.map(function (k) {
    var p = k.split("|"), x = p[0], sN = +p[1], li = [];
    P.log.forEach(function (e, n) { if (e.x === x && e.s === sN && !e.skip) li.push(n); });
    li.sort(function (a, b) { return (P.log[a].side || 0) - (P.log[b].side || 0); });
    return { x: x, s: sN, li: li };
  }).filter(function (g) { return g.li.length && logWorthy(P.log[g.li[0]]); });
}
function lastGroupLi() {
  var e = P.lastLog, out = []; if (!e || e.skip) return out;
  P.log.forEach(function (z, n) { if (z.x === e.x && z.s === e.s && !z.skip) out.push(n); });
  return out;
}
function groupEditorHTML(g) {
  var e0 = P.log[g.li[0]], ex = EX[g.x] || {}, isT = e0.t != null, two = g.li.length > 1;
  var auto = g.li.some(function (n) { return P.log[n].auto; });
  var h = '<div class="lg-ed lg-g"><p class="lg-name">' + esc(e0.code + ". " + exShort(ex) + " · serie " + g.s) + (auto ? ' <span class="pg-note">sin confirmar</span>' : "") + "</p>";
  h += '<div class="lg-row lg-reps">';
  g.li.forEach(function (n) {
    var e = P.log[n];
    h += '<span class="lg-side"><span class="lg-l">' + (two ? "Lado " + e.side : isT ? "Segundos" : "Reps") + '</span><button class="pbtn sq" data-p="lgminus" data-li="' + n + '" type="button" aria-label="Menos">−</button><b class="lg-v">' + (isT ? e.t : e.r) + '</b><button class="pbtn sq" data-p="lgplus" data-li="' + n + '" type="button" aria-label="Más">+</button></span>';
  });
  h += "</div>";
  if (!isT) {
    var rir = P.log[g.li[g.li.length - 1]].rir;
    h += '<div class="lg-row"><span class="lg-l">RIR</span>' + [0, 1, 2, 3, 4].map(function (v) { return '<button class="rir' + (rir === v ? " on" : "") + '" data-p="rir" data-g="' + g.li.join(",") + '" data-v="' + v + '" type="button">' + (v === 4 ? "4+" : v) + "</button>"; }).join("") + "</div>";
  }
  return h + "</div>";
}
function renderLogBar() {
  var el = $("p-log"), inl = $("p-login");
  if (el) { el.hidden = true; el.innerHTML = ""; }
  if (inl) inl.innerHTML = "";
  if (P.done || !pref("logsets", true) || !inl) return;
  var st = P.steps[P.idx]; if (!restLike(st)) return;
  var gs = logGroups(P.idx); if (!gs.length) return;
  inl.innerHTML = '<p class="lg-head">' + (gs.length > 1 ? "Anota lo que hiciste" : "Anota la serie que terminaste") + "</p>" + gs.map(groupEditorHTML).join("");
}
function setGroupRir(lis, v) { lis.forEach(function (n) { var e = P.log[n]; if (e && e.t == null && !e.skip) { e.rir = v; e.auto = false; } }); saveRun(); renderLogBar(); }
function editLog(d, li) {
  var e = li != null && P.log[li] ? P.log[li] : P.lastLog; if (!e) return;
  if (e.t != null) e.t = Math.max(0, e.t + d * 5); else e.r = Math.max(0, (e.r || 0) + d);
  e.auto = false; saveRun(); renderLogBar();
}

/* ===================== Botones, conteo y reloj ===================== */
function updateButtons() {
  var st = P.steps[P.idx], main = $("p-main"), plus = $("p-plus"), pause = $("p-pause"), prev = $("p-prev");
  if (P.done) { main.textContent = "Cerrar"; plus.hidden = true; pause.hidden = true; prev.hidden = true; return; }
  if (P.prep) { main.textContent = "Empezar"; plus.hidden = true; pause.hidden = true; prev.hidden = true; return; }
  pause.hidden = false; prev.hidden = false;
  pause.textContent = P.paused ? "Seguir" : "Pausa";
  if (st.type === "work") main.textContent = pacerEligible(st) && !PC.running ? "Empezar serie" : "Hecho";
  else if (st.type === "tr") main.textContent = "Listo";
  else if ((st.type === "rest" || st.type === "gap") && flowOn()) main.textContent = "Empezar";
  else if (st.type === "item") main.textContent = "Hecho";
  else if (needsStart(st) && !P.running) main.textContent = "Empezar";
  else if (st.type === "wait") main.textContent = "Empezar ya";
  else if (st.type === "hold" || st.type === "itemhold" || st.type === "phase") main.textContent = "Terminar";
  else if (st.type === "seg") main.textContent = "Siguiente";
  else main.textContent = "Saltar";
  plus.hidden = !(st.type === "rest" || st.type === "gap" || st.type === "tr" || (st.type === "seg" && P.running));
}
function updateCount() {
  var st = P.steps[P.idx], c = $("p-count");
  if (P.done || !st) { c.textContent = ""; c.className = "p-count empty"; return; }
  if (st.type === "work" && P.boxed) {
    var rb = P.remaining, lb = P.boxLead || 0, inLead = rb > workSecs(st.ex);
    c.textContent = inLead ? Math.ceil(rb - workSecs(st.ex)) : fmt(Math.max(0, Math.ceil(rb)));
    c.className = "p-count box" + (inLead ? " lead" : ""); return;
  }
  if (st.type === "work" || (st.type === "item" && !P.autoItem)) { c.textContent = ""; c.className = "p-count empty"; return; }
  var r = P.remaining, lead = needsStart(st) && P.running && st.dur && r > st.dur;
  if (lead) { c.textContent = Math.ceil(r - st.dur); c.className = "p-count lead"; return; }
  c.className = "p-count" + (P.running ? "" : " idle");
  c.textContent = fmt(Math.max(0, Math.ceil(r)));
}
function updateClock() {
  $("p-el").textContent = fmt(P.elapsed);
  $("p-plan").textContent = "de " + fmt(P.total);
  var st = P.steps[P.idx], status = $("p-status");
  var dl = $("p-delay"), dv = planDelay();
  if (P.kind === "session" && st && !P.done && dv != null) {
    var ab = Math.abs(dv);
    if (dl) { dl.hidden = false; dl.textContent = dv > 20 ? "+" + fmt(dv) : dv < -30 ? "−" + fmt(ab) : "a tiempo"; dl.className = "p-delay " + (dv > 20 ? "late" : dv < -30 ? "early" : "ok"); dl.title = dv > 20 ? "Vas " + fmt(dv) + " atrasado respecto al plan" : dv < -30 ? "Vas " + fmt(ab) + " adelantado" : "Vas en el tiempo del plan"; }
    status.textContent = "Terminas a las " + finishClock(); status.className = "p-status";
  } else {
    if (dl) dl.hidden = true;
    status.textContent = P.done ? "" : P.kind === "seg" ? "Segmento " + (P.idx + 1) + " de " + P.steps.length : P.prep ? "Empieza cuando estés listo" : ""; status.className = "p-status";
  }
  var mk = $("p-marker");
  if (mk) mk.style.left = "calc(16px + (100% - 32px) * " + Math.min(1, P.elapsed / (P.total || 1)).toFixed(4) + ")";
  var segs = document.querySelectorAll("#p-route .seg");
  for (var i = 0; i < segs.length; i++) {
    var on = P.kind === "seg" ? +segs[i].getAttribute("data-i") === P.idx : !!(st && st.block && segs[i].getAttribute("data-b") === st.block.id);
    segs[i].classList.toggle("cur", on && !P.done);
  }
}
function mark(k) { if (P.marks[k]) return false; P.marks[k] = true; return true; }
function tick() {
  var now = performance.now(), dt = (now - P.last) / 1000;
  P.last = now;
  if (!P.active || P.paused || P.done || P.prep) return;
  P.elapsed += dt;
  var st = P.steps[P.idx]; if (!st) return;
  if (st.type === "work" && P.boxed && P.running) {
    P.remaining -= dt;
    var rb = Math.ceil(P.remaining);
    if (rb >= 1 && rb <= 3 && mark("b" + rb)) snd("count");
    if (P.remaining <= 0) { snd("end"); P.boxed = false; logWork(st, null); if (P.steps[P.idx] === st && !P.done) enterStep(P.idx + 1); return; }
    updateCount(); updateClock(); return;
  }
  if (st.type === "item" && P.autoItem) {
    P.remaining -= dt;
    var ri = Math.ceil(P.remaining);
    if (ri >= 1 && ri <= 3 && mark("c" + ri)) snd("count");
    if (P.remaining <= 0) { snd("end"); enterStep(P.idx + 1); return; }
    updateCount(); updateClock(); return;
  }
  if (st.type === "wait") P.remaining = st.target - P.elapsed;
  else if (P.running && isTimed(st)) P.remaining -= dt;
  if (P.running && isTimed(st)) {
    var r = Math.ceil(P.remaining);
    if (needsStart(st) && st.dur && P.remaining > st.dur) {
      var l = Math.ceil(P.remaining - st.dur);
      if (l <= 3 && mark("L" + l) && !P.quietLead) { snd("count"); say(String(l), true); }
    } else if (needsStart(st) && st.dur && mark("go")) {
      snd("go"); say("¡Vamos!", true);
      if (st.type === "hold" || st.type === "itemhold") setTimeout(function () { if (P.active && P.steps[P.idx] === st && !P.paused) snd("pau", 1.6); }, 520);
      if (st.type === "phase" && pref("metro", true)) metro.start();
    }
    if (st.type !== "phase" || P.remaining < 4) { if (r >= 1 && r <= 3 && P.remaining < (st.dur || Infinity) && mark("c" + r)) { snd("count"); say(String(r), true); } }
    /* A los 10 s solo un aviso corto: el nombre de lo que sigue ya se dijo al empezar el descanso */
    if ((st.type === "rest" || st.type === "wait") && r === 10 && mark("ten") && (st.type === "wait" || (st.dur || 0) >= 25)) say("Diez segundos. " + (posSayNext() || "Ponte en posición."), false);
    if (st.type === "phase" && st.checks) {
      var inStep = st.dur - P.remaining;
      st.checks.forEach(function (c) { if (inStep >= c && mark("k" + c)) { snd("warn"); speak("Chequeo: si no podrías conversar, baja la velocidad y acorta el paso."); } });
    }
    if (P.remaining <= 0) {
      snd("end");
      if (st.type === "hold") logHold(st, st.dur);
      enterStep(P.idx + 1); return;
    }
  }
  updateCount(); updateClock();
}
function mainAction() {
  if (P.done) { closePlayer(); return; }
  if (P.prep) { audio(); enterStep(0, true); return; }
  var st = P.steps[P.idx]; audio();
  var ld = P.leadNext || 0; P.leadNext = 0;
  if (st.type === "work") {
    if (pacerEligible(st) && !PC.running) { pacerStart(st, ld || 3); updateButtons(); return; }
    var reps = pacerStop();
    logWork(st, reps);
    enterStep(P.idx + 1); return;
  }
  if (st.type === "item") { enterStep(P.idx + 1); return; }
  if (needsStart(st) && !P.running) {
    P.running = true; P.remaining = st.dur + (ld || 3); P.marks = {};
    if (P.paused) togglePause();
    updateButtons(); updateCount(); return;
  }
  if (st.type === "hold" && P.running) { var held = st.dur - Math.max(0, P.remaining); logHold(st, clamp(held, 0, st.dur)); }
  enterStep(P.idx + 1);
}
function togglePause() {
  P.paused = !P.paused;
  var now = performance.now();
  if (P.paused) P.pauseT0 = now;
  else if (P.pauseT0) { var T = P.tm || (P.tm = { serie: 0, descanso: 0, cambio: 0, pausa: 0 }); T.pausa += (now - P.pauseT0) / 1000; P.pauseT0 = 0; }
  if (PC.running) { if (P.paused) PC.pauseAt = now; else PC.pausedTotal += now - PC.pauseAt; PC.paused = P.paused; }
  if (P.paused) metro.stop();
  else { var st = P.steps[P.idx]; if (st && st.type === "phase" && P.running && pref("metro", true) && P.remaining <= st.dur) metro.start(); }
  P.last = now; updateButtons();
}
function setToolBtns() {
  var v = $("p-voice"), t = $("p-tempo"), te = pref("tempo", false);
  if (v) { v.setAttribute("aria-pressed", voiceOn()); v.textContent = "Voz"; }
  if (t) { t.setAttribute("aria-pressed", te); t.textContent = "Tempo"; t.hidden = P.kind !== "session"; }
  var cb = $("p-camb"); if (cb) { cb.setAttribute("aria-pressed", CAM.on); cb.textContent = "Cámara"; cb.hidden = !(P.kind === "session" || P.kind === "routine"); }
  var fl = $("p-flow"); if (fl) { fl.setAttribute("aria-pressed", flowOn()); fl.hidden = !(P.kind === "session" || P.kind === "routine"); }
  hfPaint();
}

/* ===================== Molestia de rodilla durante la sesión ===================== */
function kneeStop(why) {
  var st = P.steps[P.idx]; if (!st || !st.ex) return;
  var id = st.ex.id, name = st.ex.name;
  pacerStop();
  P.flags.push({ x: id, why: why, s: st.round });
  logSet({ x: id, code: st.ex.code, s: st.round, side: st.side || 0, lvl: st.ex.rung, skip: true, r: null });
  P.lastLog = null;
  P.steps = dropExercise(P.steps, P.idx + 1, id);
  P.notice = "Cortamos " + name + " por hoy. La próxima vez baja un peldaño; la página ya lo marcó.";
  speak("Cortamos " + name + ". Pasa a lo siguiente.");
  enterStep(P.idx + 1);
}

/* ===================== Final ===================== */
function improvements() {
  var out = [];
  uniq(P.log.filter(function (e) { return !e.skip && !e.auto; }).map(function (e) { return e.x; })).forEach(function (id) {
    var today = P.log.filter(function (e) { return e.x === id && !e.skip; });
    var tv = perSet(today).filter(function (p) { return !p.auto; }).map(function (p) { return p.v; });
    if (!tv.length) return;
    var best = Math.max.apply(null, tv);
    var prev = historyOf(id, 4).filter(function (h) { return h.d !== P.date && h.lvl === today[0].lvl; })[0];
    if (!prev) return;
    var pv = perSet(prev.sets).filter(function (p) { return !p.auto; }).map(function (p) { return p.v; });
    if (!pv.length) return;
    var pb = Math.max.apply(null, pv);
    if (best > pb) out.push((EX[id] || {}).name + ": " + best + (today[0].t != null ? " s" : "") + " (antes " + pb + ")");
  });
  return out;
}
function saveResult(done) {
  var dur = Math.round(P.elapsed), D = DAYS[P.key];
  if (P.kind === "session") {
    if (D.type === "aero") put({ id: "aer_" + P.date, k: "aer", d: P.date, type: "A", dur: dur, plan: Math.round(P.total), done: done, knee: P.kneeAfter, feel: P.feel });
    else put({ id: "log_" + P.date + "_" + P.key, k: "log", d: P.date, day: P.key, mode: P.plan.opts.mode, deload: P.plan.opts.deload, dur: dur, plan: Math.round(P.total), done: done, planSets: P.plannedSets, sets: P.log, flags: P.flags, knee: P.kneeAfter,
      tm: { pausa: Math.round((P.tm || {}).pausa || 0), serie: Math.round((P.tm || {}).serie || 0), descanso: Math.round((P.tm || {}).descanso || 0), cambio: Math.round((P.tm || {}).cambio || 0), flujo: flowOn() } });
  } else if (P.kind === "seg") {
    if (P.seg === "walk") put({ id: "walk_" + P.date, k: "walk", d: P.date, dur: dur, done: done });
    else put({ id: "aer_" + P.date, k: "aer", d: P.date, type: P.seg === "hill" ? "B" : "F2", dur: dur, plan: Math.round(P.total), done: done, knee: P.kneeAfter, feel: P.feel });
  } else if (P.kind === "routine") put({ id: "rut_" + P.date + "_" + P.routine.id, k: "rut", d: P.date, r: P.routine.id, dur: dur });
}
function kneeChips() {
  return '<div class="opts">' + PAIN.map(function (o) { return '<button class="opt-btn' + (P.kneeAfter === o[0] ? " on" : "") + '" data-p="kneeafter" data-v="' + o[0] + '" type="button">' + esc(o[1]) + "</button>"; }).join("") + "</div>";
}
function finish() {
  P.done = true; pacerStop(); metro.stop(); camStop(true); hfSync();
  if (P.kind === "session") setRun(null);
  saveResult(true);
  $("p-body").className = "p-body t-done";
  $("p-kind").textContent = P.title;
  $("p-pacer").hidden = true; $("p-how").hidden = true; $("p-next").textContent = ""; $("p-count").textContent = "";
  var D = DAYS[P.key], x = "";
  if (P.kind === "session" && D.type === "train") {
    var done = countLogged(P.log);
    $("p-title").textContent = "Sesión completa";
    var tms = tmSummary(), pz = Math.round((P.tm || {}).pausa || 0);
    $("p-sub").innerHTML = '<span class="p-dose">' + fmt(P.elapsed) + " de " + fmt(P.total) + " planeados, " + done + " de " + P.plannedSets + " series</span>" +
      '<span class="p-meta">' + (tms.length ? "Dónde se fue el tiempo: " + esc(tms.join(" · ")) : "Sin retrasos que valga la pena anotar.") + (pz >= 20 ? "" : "") + "</span>";
    x = finishTrainHTML(D);
    speak("Sesión completa. Buen trabajo.");
  } else if (P.kind === "session" || (P.kind === "seg" && P.seg !== "walk")) {
    var W = P.kind === "session" ? D.weeks.A : P.seg === "hill" ? D.weeks.B : null;
    $("p-title").textContent = "Listo";
    $("p-sub").innerHTML = '<span class="p-dose">' + fmt(P.elapsed) + " de " + fmt(P.total) + "</span>";
    x = '<section class="fin">' + (W ? '<p class="fin-lead">' + esc(W.impact) + "</p>" : "") +
      '<h3 class="mini">¿Cómo te sentiste?</h3><div class="opts">' + [["facil", "Fácil"], ["justo", "Justo"], ["duro", "Duro"]].map(function (o) { return '<button class="opt-btn' + (P.feel === o[0] ? " on" : "") + '" data-p="feel" data-v="' + o[0] + '" type="button">' + o[1] + "</button>"; }).join("") + "</div>" +
      '<h3 class="mini">Rodilla ahora</h3>' + kneeChips() +
      '<p class="muted">Si mañana la rodilla amanece peor que tu normal, la semana siguiente haz 20 min alternando 2 min de trote y 1 de caminata.</p>' +
      siNo(D.after) + nextLine(D) + "</section>";
    speak("Listo. Buen trabajo.");
  } else {
    $("p-title").textContent = "Listo";
    $("p-sub").innerHTML = '<span class="p-dose">' + fmt(P.elapsed) + "</span>";
    x = '<section class="fin"><p class="fin-lead">' + (P.kind === "routine" ? "Hecho. Mañana sigue el plan." : "Caminata hecha. A las 11:00, la sesión.") + "</p></section>";
    speak("Listo.");
  }
  $("p-extra").innerHTML = x;
  renderLogBar(); updateButtons(); updateClock();
}
function nextLine(D) { var N = DAYS[D.next]; return '<p class="next-day"><span class="k">Mañana, ' + esc(N.day.toLowerCase()) + ".</span> " + esc(N.type === "rest" ? N.title : N.title + ", " + N.window) + "</p>"; }
function finishTrainHTML(D) {
  var ids = uniq(P.log.filter(function (e) { return !e.skip; }).map(function (e) { return e.x; }));
  var muscles = uniq([].concat.apply([], ids.map(function (id) { return (EX[id] || {}).muscles || []; })));
  var imp = improvements();
  var unconfirmed = unconfirmedSets();
  var h = '<section class="fin">';
  h += '<p class="fin-lead">' + esc(D.impact) + "</p>";
  if (perfilOn("rodilla")) h += '<h3 class="mini">Rodilla ahora</h3>' + kneeChips();
  h += '<h3 class="mini">Trabajaste</h3><div class="ex-tags">' + muscleChips(muscles) + "</div>";
  h += camSummaryHTML();
  if (imp.length) h += '<h3 class="mini">Mejoraste</h3><ul class="yes">' + imp.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
  h += '<div id="fin-sug">' + sugHTML() + "</div>";
  h += reviewSetsHTML(unconfirmed);
  h += '<h3 class="mini">Lo que sigue hoy</h3>' + siNo(D.after);
  if (LEGDAYS[D.key]) h += '<div class="tonight"><p><span class="k">Esta noche.</span> Antes de dormir, el chequeo en la página de hoy: dolor de 1.5/10 o menos y sin hinchazón.</p><p><span class="k">Mañana al despertar.</span> El chequeo de 24 horas: igual o mejor que tu normal.</p></div>';
  h += nextLine(D);
  return h + "</section>";
}
function unconfirmedSets() { var o = {}; P.log.forEach(function (e) { if (e.auto && !e.skip && (EX[e.x] || {}).ladder) o[e.x + "|" + e.s] = 1; }); return Object.keys(o).length; }
function sugHTML() {
  var ids = uniq(P.log.map(function (e) { return e.x; }));
  var exById = {}; P.plan.steps.forEach(function (s) { if (s.ex && !exById[s.ex.id]) exById[s.ex.id] = s.ex; });
  var sug = [];
  ids.forEach(function (id) { var ex = exById[id]; if (!ex) return; var s = suggestion(resolve(ex)); if (s && (s.kind === "up" || s.kind === "down")) sug.push([resolve(ex), s]); });
  if (!sug.length) return "";
  return '<h3 class="mini">Para la próxima</h3><ul class="plain">' + sug.map(function (p) {
    var ex = p[0], s = p[1];
    return '<li class="' + (s.kind === "up" ? "pg-up" : "pg-down") + '">' + esc(ex.name) + ": " + esc(s.text) + (s.kind === "up" && !ex.knee && !s.eqMiss && prefVal("coachAuto") ? ' <span class="pg-note">(sube solo al cerrar)</span>' : "") + (ex.rung !== s.to ? ' <button class="mini-btn" data-act="rung" data-x="' + esc(ex.id) + '" data-to="' + s.to + '">Aplicar</button>' : "") + "</li>";
  }).join("") + "</ul>";
}
function reviewSetsHTML(unconf) {
  var ids = uniq(P.log.filter(function (e) { return !e.skip && (EX[e.x] || {}).ladder; }).map(function (e) { return e.x; }));
  if (!ids.length) return "";
  var h = '<details class="fin-sets"' + (unconf ? " open" : "") + "><summary>Revisar o corregir tus series" + (unconf ? " (" + unconf + " sin confirmar)" : "") + '</summary><p class="muted">Pon lo que de verdad hiciste. En ejercicios a un lado, el lado más débil manda. Solo las series confirmadas cuentan para subir de peldaño.</p>';
  ids.forEach(function (id) {
    var es = P.log.filter(function (e) { return e.x === id && !e.skip; });
    h += '<div class="fs-row"><span class="fs-name">' + esc(es[0].code + ". " + (EX[id].name || "")) + (es[0].t != null ? " (s)" : "") + '</span><span class="fs-vals">' + es.map(function (e) {
      return '<label><span>S' + e.s + (e.side ? " L" + e.side : "") + '</span><input type="number" min="0" step="1" inputmode="numeric" class="fs-in' + (e.auto ? " auto" : "") + '" data-li="' + P.log.indexOf(e) + '" value="' + (e.t != null ? e.t : e.r) + '"></label>';
    }).join("") + "</span></div>";
  });
  return h + '<button class="btn quiet" data-p="confirmall" type="button">Confirmar todo como está</button></details>';
}
function refreshFinish() {
  saveResult(true);
  var box = $("fin-sug"); if (box) box.innerHTML = sugHTML();
  var n = unconfirmedSets(), sm = document.querySelector(".fin-sets summary");
  if (sm) sm.textContent = "Revisar o corregir tus series" + (n ? " (" + n + " sin confirmar)" : "");
}
function savePartial() {
  if (P.kind === "session" && P.log.some(function (e) { return !e.skip; })) saveResult(false);
  if (P.kind === "session") setRun(null);
}

/* ===================== Exportar e importar ===================== */
function offerFile(name, text) {
  var ta = $("io"), out = document.querySelector(".io-out");
  function fallback(msg) { if (ta) { ta.value = text; try { ta.focus(); ta.select(); } catch (e) {} } if (out) out.textContent = msg || "Copia el texto del cuadro y guárdalo como " + name + "."; }
  if (!window.claude || typeof window.claude.use !== "function") { if (downloadText(name, text)) { if (ta) ta.value = text; if (out) out.textContent = "Descargado: " + name + ". Búscalo en tus descargas."; } else fallback(); return; }
  if (out) out.textContent = "Preparando el archivo...";
  window.claude.use("downloads").then(function (dl) {
    if (!dl) { fallback(); return; }
    return dl.save({ filename: name, data: text }).then(function () { if (out) out.textContent = "Archivo listo: " + name; }).catch(function (e) {
      if (e && e.code === "declined") { if (out) out.textContent = "Descarga cancelada."; } else fallback();
    });
  }).catch(function () { fallback(); });
}
function exportHistory() { offerFile("sistema3-historial-" + TODAY() + ".json", JSON.stringify({ app: "sistema-3", version: 2, exportedAt: new Date().toISOString(), recs: ST.recs }, null, 1)); }
function exportProgram() { offerFile("sistema3-programa.json", JSON.stringify({ app: "sistema-3-programa", version: 2, PH: PH, EX: EX, DAYS: DAYS, ORDER: ORDER, WALK: WALK, HILL: HILL, FOURBYFOUR: FOURBYFOUR, RULES: RULES, HABITS: HABITS, CONFIGS: CONFIGS, KNEE: KNEE, TONES: TONES }, null, 1)); }
function importData() {
  var ta = $("io"), out = document.querySelector(".io-out");
  try {
    var v = JSON.parse(ta.value.trim()), recs = v.recs || v, n = 0;
    for (var id in recs) {
      var r = recs[id]; if (!r || !r.id || !r.k) continue;
      var mg = mergeRec(ST.recs[r.id], r); if (!ST.recs[r.id] || stable(mg) !== stable(ST.recs[r.id])) { ST.recs[r.id] = mg; queueCloud(mg); ghMark(mg); n++; }
    }
    saveLocal();
    var y = window.scrollY; renderDay(current); window.scrollTo(0, y);
    var out2 = document.querySelector(".io-out"); if (out2) out2.textContent = n ? "Importados " + n + " registros." : "No había nada nuevo que importar.";
  } catch (e) { if (out) out.textContent = "Ese texto no es un respaldo válido: pega el JSON completo que exportaste."; }
}

/* ===================== Eventos ===================== */
function rerender() { var y = window.scrollY; renderDay(current); window.scrollTo(0, y); }
function applyTheme() { var t = pref("theme", "auto"); if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

document.addEventListener("click", function (e) {
  var t = e.target.closest("[data-day],[data-act],[data-p]");
  if (!t) return;
  if (t.hasAttribute("data-day")) { renderDay(t.getAttribute("data-day")); window.scrollTo(0, 0); return; }
  var act = t.getAttribute("data-act");
  if (act) {
    if (act === "start") { setRun(null); openSession(current, null); }
    else if (act === "resume") openSession(current, ST.run);
    else if (act === "walk") openSeg("walk");
    else if (act === "hill") openSeg("hill");
    else if (act === "fxf") openSeg("fxf");
    else if (act === "routine") openRoutine(t.getAttribute("data-r"));
    else if (act === "deload") { var wid = isoWeek(viewDate || TODAY()).id; setDeload(wid, !isDeload(viewDate || TODAY())); rerender(); }
    else if (act === "deloadnext") { setDeload(isoWeek(addDays(viewDate || TODAY(), 7)).id, true); t.outerHTML = "<b>Marcada.</b>"; renderTabs(); }
    else if (act === "abflip") { var c = clone(cfg()); c.abFlip = !c.abFlip; saveCfg(c); rerender(); }
    else if (act === "rung") {
      setRung(t.getAttribute("data-x"), +t.getAttribute("data-to"));
      if (P.active) { t.outerHTML = "<b>Aplicado</b>"; } else rerender();
    }
    else if (act === "pref") { prefToggle(t.getAttribute("data-k")); renderGlobal(); }
    else if (act === "eqn") { var inv1 = eqInv(), i1 = +t.getAttribute("data-i"); if (inv1.discs[i1]) { inv1.discs[i1].n = Math.max(0, inv1.discs[i1].n + (+t.getAttribute("data-d"))); eqSave(inv1); } rerender(); }
    else if (act === "eqdel") { var inv2 = eqInv(); inv2.discs.splice(+t.getAttribute("data-i"), 1); eqSave(inv2); rerender(); }
    else if (act === "eqadd") { var kg = parseFloat(String(($("eq-new") || {}).value || "").replace(",", ".")); if (kg > 0) { var inv3 = eqInv(); if (!inv3.discs.some(function (d) { return Math.abs(d.kg - kg) < 0.001; })) inv3.discs.push({ kg: kg, n: 2 }); eqSave(inv3); rerender(); } }
    else if (act === "eqreset") { setPref("equip", null); rerender(); }
    else if (act === "aitest") aiTest();
    else if (act === "asrcheck") asrCheck(false);
    else if (act === "asrinstall") asrCheck(true);
    else if (act === "cammodel") { setPref("camModel", t.getAttribute("data-v")); renderGlobal(); }
    else if (act === "camfacing") { setPref("camFacing", t.getAttribute("data-v")); CAM.facing = null; renderGlobal(); }
    else if (act === "camprep") camPrep();
    else if (act === "camlimreset") { setPref("camLim", {}); renderGlobal(); }
    else if (act === "vol") { setPref("vol", t.getAttribute("data-v")); renderGlobal(); snd("rep"); }
    else if (act === "micmode") { setPref("micMode", t.getAttribute("data-v")); renderGlobal(); }
    else if (act === "tempotone") { setPref("tempoTone", t.getAttribute("data-v")); renderGlobal(); snd("con", 1.5); }
    else if (act === "vozrate") { setPref("vozRate", +t.getAttribute("data-v")); renderGlobal(); say("Así hablo ahora.", true); }
    else if (act === "sndtest") soundTest($("snd-out"));
    else if (act === "aiprov") { var pv = t.getAttribute("data-v"); setPref("aiProv", pv); if (pv === "chrome") chrCheck().then(function () { renderGlobal(); }); renderGlobal(); }
    else if (act === "chromeprep") chromePrep();
    else if (act === "phaseup") phaseSet(Math.min(3, phaseN() + 1));
    else if (act === "phasedown") phaseSet(Math.max(1, phaseN() - 1));
    else if (act === "savetest") saveTest();
    else if (act === "fotos") { put({ id: "fotos", k: "fotos", d: TODAY() }); rerender(); }
    else if (act === "ask") askOpen(null);
    else if (act === "install") doInstall();
    else if (act === "share") shareBackup();
    else if (act === "theme") { setPref("theme", t.getAttribute("data-v")); applyTheme(); renderGlobal(); }
    else if (act === "savecheck") saveCheck(t.closest(".check"));
    else if (act === "savereview") saveReview();
    else if (act === "export") exportHistory();
    else if (act === "exportprog") exportProgram();
    else if (act === "import") importData();
    return;
  }
  var p = t.getAttribute("data-p");
  if (!p || !P.active) return;
  if (p === "main") mainAction();
  else if (p === "prev") { if (!P.done) enterStep(Math.max(0, P.idx - 1)); }
  else if (p === "plus") { P.remaining += 15; P.marks = {}; updateCount(); }
  else if (p === "pause") togglePause();
  else if (p === "cam") { if (CAM.on) camStop(); else camStart(); setToolBtns(); }
  else if (p === "ask") askOpen(null);
  else if (p === "camreset") { var st0 = P.steps[P.idx]; if (CAM.eng && st0) { camCancelClose(); CAM.eng = camNewEng(st0, CAM.eng.cfg); camRender(CAM.eng); camState("warn", "Quieto en la posición inicial…"); } }
  else if (p === "camflip") { CAM.facing = (CAM.facing || pref("camFacing", "user")) === "user" ? "environment" : "user"; setPref("camFacing", CAM.facing); if (CAM.on) camStart(); }
  else if (p === "camlimit") { CAM.limitArm = !CAM.limitArm; camLimitBtn(); if (CAM.limitArm) say("Haz una repetición hasta tu caja", true); }
  else if (p === "camkeep") { camCancelClose(); if (CAM.eng) CAM.eng.lastEnd = performance.now() / 1000; }
  else if (p === "voice") { setPref("voice", !voiceOn()); setToolBtns(); hfSync(); if (voiceOn()) speak("Voz activada."); else { try { speechSynthesis.cancel(); } catch (e) {} } }
  else if (p === "asst") asstToggle();
  else if (p === "hf") { prefToggle("hf"); if (pref("hf", false)) { if (!hfSupported()) hfMsg("Este navegador no entiende la voz: usa Chrome. El gesto con la cámara sí funciona."); else say("Manos libres activado. Di «listo» cuando termines cada serie.", true); } else hfMsg("Manos libres apagado."); }
  else if (p === "snd") soundTest($("p-hfmsg"));
  else if (p === "lgopen") { P.lgOpen = !P.lgOpen; renderLogBar(); }
  else if (p === "tempo") { setPref("tempo", !pref("tempo", false)); setToolBtns(); if (!P.done) { if (PC.running) { pacerStop(); $("p-pacer").hidden = true; } updateButtons(); } }
  else if (p === "exit") {
    if (P.done || Date.now() - P.exitArmed < 3000) { if (!P.done) savePartial(); closePlayer(); }
    else { P.exitArmed = Date.now(); t.textContent = "Toca otra vez"; setTimeout(function () { t.textContent = "Salir"; }, 3000); }
  }
  else if (p === "confirmall") { P.log.forEach(function (e) { e.auto = false; }); document.querySelectorAll(".fs-in.auto").forEach(function (i) { i.classList.remove("auto"); }); refreshFinish(); }
  else if (p === "lgminus") editLog(-1, t.hasAttribute("data-li") ? +t.getAttribute("data-li") : null);
  else if (p === "lgplus") editLog(1, t.hasAttribute("data-li") ? +t.getAttribute("data-li") : null);
  else if (p === "rir") { if (t.hasAttribute("data-g")) setGroupRir(t.getAttribute("data-g").split(",").map(Number), +t.getAttribute("data-v")); else if (P.lastLog) { P.lastLog.rir = +t.getAttribute("data-v"); P.lastLog.auto = false; saveRun(); renderLogBar(); } }
  else if (p === "knee") { var o = t.parentNode.querySelector(".kopts"); if (o) o.hidden = !o.hidden; }
  else if (p === "kneecancel") { var o2 = t.closest(".kopts"); if (o2) o2.hidden = true; }
  else if (p === "kneeopt") kneeStop(t.getAttribute("data-v"));
  else if (p === "kneeafter") { P.kneeAfter = t.getAttribute("data-v"); saveResult(true); t.parentNode.querySelectorAll(".opt-btn").forEach(function (b) { b.classList.toggle("on", b === t); }); }
  else if (p === "feel") { P.feel = t.getAttribute("data-v"); saveResult(true); t.parentNode.querySelectorAll(".opt-btn").forEach(function (b) { b.classList.toggle("on", b === t); }); }
  else if (p === "metro") { var on = !pref("metro", true); setPref("metro", on); t.setAttribute("aria-pressed", on); t.textContent = "Metrónomo " + (on ? "activado" : "apagado"); var st = P.steps[P.idx]; if (on && st && st.type === "phase" && P.running && !P.paused && P.remaining <= st.dur) metro.start(); else metro.stop(); }
  else if (p === "bpmup" || p === "bpmdown") { setPref("bpm", clamp(metro.bpm() + (p === "bpmup" ? 5 : -5), 150, 195)); var mv = $("m-val"); if (mv) mv.textContent = metro.bpm() + " ppm"; }
});

document.addEventListener("change", function (e) {
  var t = e.target;
  if (t.id === "eq-bar" || t.id === "eq-ant" || t.id === "eq-vin" || t.id === "eq-guard") {
    var inv = eqInv(), v = parseFloat(String(t.value).replace(",", "."));
    if (t.id === "eq-bar") inv.bar = v > 0 ? v : 0; else if (t.id === "eq-ant") inv.antigua = v > 0 ? v : inv.antigua; else if (t.id === "eq-vin") inv.vinilo = v > 0 ? v : inv.vinilo; else inv.guard = v >= 0 ? v : inv.guard;
    eqSave(inv); rerender(); return;
  }
  if (t.id === "ai-url" || t.id === "ai-model" || t.id === "ai-key") { aiField(t.id, String(t.value).trim()); return; }
  if (t.classList && t.classList.contains("ph-crit")) { phaseCrit(t.getAttribute("data-c"), t.checked); return; }
  if (t.id === "io-file") { importFile(t); return; }
  if (t.name === "f-pain" || t.name === "f-stiff" || t.name === "f-swell") {
    var f = rec("flt_" + viewDate) ? clone(rec("flt_" + viewDate)) : { id: "flt_" + viewDate, k: "flt", d: viewDate };
    f[t.name.slice(2)] = t.value; f.mode = filterMode(f); put(f);
    rerender(); return;
  }
  if (t.classList && t.classList.contains("fs-in") && P.active && P.done) {
    var e2 = P.log[+t.getAttribute("data-li")], v = parseInt(t.value, 10);
    if (e2 && !isNaN(v)) { if (e2.t != null) e2.t = v; else e2.r = v; e2.auto = false; t.classList.remove("auto"); refreshFinish(); }
    return;
  }
  if (t.name === "c-vs") { var box = t.closest(".check").querySelector(".suspect"); if (box) box.hidden = t.value !== "peor"; return; }
  if (t.classList && t.classList.contains("hab")) {
    var today = TODAY(), hb = rec("hab_" + today) ? clone(rec("hab_" + today)) : { id: "hab_" + today, k: "hab", d: today, h: [] };
    hb.h[+t.getAttribute("data-i")] = t.checked; put(hb);
  }
});
function saveCheck(sec) {
  if (!sec) return;
  function val(n) { var el = sec.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : null; }
  var when = sec.getAttribute("data-when"), out = sec.querySelector(".check-out");
  var c = { id: "chk_" + viewDate + "_" + when, k: "chk", d: viewDate, when: when, ref: sec.getAttribute("data-ref"), day: sec.getAttribute("data-dayk"), pain: val("c-pain") };
  if (when === "noche") { c.swell = val("c-swell"); c.stiff = val("c-stiff"); if (!c.pain || !c.swell || !c.stiff) { out.textContent = "Responde las tres preguntas."; return; } }
  else {
    c.fast = val("c-fast"); c.vs = val("c-vs"); c.suspect = c.vs === "peor" ? val("c-sus") : null;
    if (!c.pain || !c.fast || !c.vs) { out.textContent = "Responde las tres preguntas."; return; }
  }
  put(c); rerender();
}
function saveReview() {
  var wk = isoWeek(viewDate), id = "wk_" + wk.id;
  var r = rec(id) ? clone(rec(id)) : { id: id, k: "wk", d: viewDate };
  function num(i) { var v = parseFloat(($(i) || {}).value); return isNaN(v) ? null : v; }
  r.peso = num("w-peso"); r.cintura = num("w-cintura"); r.fc = num("w-fc"); r.brazo = num("w-brazo"); r.pecho = num("w-pecho");
  r.sig = Array.prototype.slice.call(document.querySelectorAll(".w-sig:checked:not(:disabled)")).map(function (x) { return +x.value; });
  r.d = viewDate;
  put(r); rerender();
}

document.addEventListener("keydown", function (e) {
  if (!P.active) return;
  var tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.code === "Space" && tag !== "BUTTON" && tag !== "SUMMARY") { e.preventDefault(); mainAction(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); if (!P.done) { pacerStop(); enterStep(P.idx + 1); } }
  else if (e.key === "ArrowLeft") { e.preventDefault(); if (!P.done) enterStep(Math.max(0, P.idx - 1)); }
  else if (e.key === "ArrowUp") { e.preventDefault(); editLog(1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); editLog(-1); }
  else if (/^[0-4]$/.test(e.key) && P.lastLog && P.lastLog.t == null) setGroupRir(lastGroupLi(), +e.key);
  else if (e.key === "p" || e.key === "P") togglePause();
  else if ((e.key === "c" || e.key === "C") && (P.kind === "session" || P.kind === "routine")) { if (CAM.on) camStop(); else camStart(); setToolBtns(); }
  else if (e.key === "?") askOpen(null);
  else if (e.key === "v" || e.key === "V") { setPref("voice", !voiceOn()); setToolBtns(); }
  else if (e.key === "m" || e.key === "M" || e.key === "h" || e.key === "H") asstToggle();
  else if (e.key === "s" || e.key === "S") soundTest($("p-hfmsg"));
  else if ((e.key === "t" || e.key === "T") && P.kind === "session") { setPref("tempo", !pref("tempo", false)); setToolBtns(); if (PC.running) { pacerStop(); $("p-pacer").hidden = true; } updateButtons(); }
});
document.addEventListener("visibilitychange", function () { if (P.active && document.visibilityState === "visible") keepAwake(); });

/* =====================================================================
   NUEVO EN ESTA VERSIÓN
   1. Mis mancuernas: un solo vocabulario y el dibujo de los discos por lado.
   2. Cámara: cuenta repeticiones, mide el tempo y avisa errores (MediaPipe,
      corre dentro de tu celular o laptop; las imágenes no salen del equipo).
   3. Dudas: respuestas de la ficha sin internet y, si la configuras, tu IA local.
   4. App instalable que funciona sin internet (GitHub Pages + service worker).
   ===================================================================== */

/* ===================== 1. Mis mancuernas ===================== */
var EQ_DEF = typeof EQUIPO !== "undefined" && EQUIPO ? EQUIPO : { discs: [{ kg: 2.5, n: 4 }, { kg: 1.25, n: 4 }, { kg: 0.5, n: 4 }], bar: 1.5, antigua: 5, vinilo: 1, guard: 7.5 };
function eqInv() {
  var e = pref("equip", null);
  if (e && Array.isArray(e.discs) && !pref("eq05", false)) {
    if (!e.discs.some(function (d) { return Math.abs(+d.kg - 0.5) < 0.001; })) { e = JSON.parse(JSON.stringify(e)); e.discs.push({ kg: 0.5, n: 4 }); setPref("equip", e); }
    setPref("eq05", true);
  }
  var src = e && Array.isArray(e.discs) && e.discs.length ? e : EQ_DEF;
  var d = src.discs.map(function (x) { return { kg: +x.kg, n: Math.max(0, Math.floor(+x.n || 0)) }; }).filter(function (x) { return x.kg > 0; });
  d.sort(function (a, b) { return b.kg - a.kg; });
  return { discs: d, bar: e && e.bar != null ? (+e.bar || 0) : EQ_DEF.bar, antigua: +(e && e.antigua) || EQ_DEF.antigua, vinilo: +(e && e.vinilo) || EQ_DEF.vinilo, guard: e && e.guard != null ? +e.guard : EQ_DEF.guard };
}
function eqSave(inv) { setPref("equip", { discs: inv.discs, bar: inv.bar, antigua: inv.antigua, vinilo: inv.vinilo, guard: inv.guard }); }
function kgTxt(v) { return String(Math.round(v * 100) / 100); }
function kgSay(v) {
  var r = Math.round(v * 100) / 100, i = Math.floor(r), f = Math.round((r - i) * 100);
  if (!f) return String(i);
  if (f === 50) return i ? i + " y medio" : "medio";
  return i + " punto " + f;
}
/* Lee una carga escrita con el vocabulario nuevo. Devuelve null si no hay pesas. */
function eqParse(t) {
  var low = String(t || "").toLowerCase(), s = { kind: null, kg: null, all: false, moch: null }, m;
  if (/todos los discos/.test(low)) { s.kind = "una"; s.all = true; }
  else if (/2 principales sin discos/.test(low)) { s.kind = "par"; s.kg = 0; }
  else if ((m = low.match(/2 principales[^0-9]*([\d.]+)\s*kg/))) { s.kind = "par"; s.kg = parseFloat(m[1]); }
  else if ((m = low.match(/1 principal[^0-9]*([\d.]+)\s*kg/))) { s.kind = "una"; s.kg = parseFloat(m[1]); }
  else if (/antigua/.test(low)) s.kind = "antigua";
  else if (/vinilo/.test(low)) s.kind = "vinilos";
  if (/sin mochila/.test(low)) s.moch = null;
  else if ((m = low.match(/mochila(?: de)? ?([\d.]+)\s*kg/))) s.moch = parseFloat(m[1]);
  else if (/mochila/.test(low)) s.moch = 0;
  return s.kind || s.moch != null ? s : null;
}
/* Combina discos por lado. sides = 4 para el par (2 mancuernas × 2 lados) y 2 para una sola. */
function eqSolve(perSide, sides, inv) {
  var ds = inv.discs, caps = ds.map(function (d) { return Math.floor(d.n / sides); }), best = null, ideal = null;
  function expand(p) { var out = []; p.forEach(function (k, i) { for (var j = 0; j < k; j++) out.push(ds[i].kg); }); return out; }
  function search(i, rem, pick, count, limited) {
    if (Math.abs(rem) < 0.001) {
      var cur = limited ? best : ideal;
      if (!cur || count < cur.count) { if (limited) best = { pick: pick.slice(), count: count }; else ideal = { pick: pick.slice(), count: count }; }
      return;
    }
    if (i >= ds.length || rem < 0) return;
    var top = Math.floor(rem / ds[i].kg + 1e-6); if (limited) top = Math.min(top, caps[i]);
    for (var k = top; k >= 0; k--) { pick[i] = k; search(i + 1, rem - k * ds[i].kg, pick, count + k, limited); }
    pick[i] = 0;
  }
  if (perSide <= 0) return { ok: true, side: [], miss: [] };
  search(0, perSide, ds.map(function () { return 0; }), 0, true);
  if (best) return { ok: true, side: expand(best.pick), miss: [] };
  /* Sin discos suficientes: de todas las combinaciones exactas, la que menos kilos te falta comprar */
  var bestMiss = null;
  (function all(i, rem, pick) {
    if (Math.abs(rem) < 0.001) {
      var miss = [], kgM = 0, nM = 0, cnt = 0;
      pick.forEach(function (k, j) { cnt += k; var need = k * sides - ds[j].n; if (need > 0) { miss.push({ kg: ds[j].kg, n: need }); kgM += need * ds[j].kg; nM += need; } });
      if (!bestMiss || nM < bestMiss.n || (nM === bestMiss.n && (cnt < bestMiss.cnt || (cnt === bestMiss.cnt && kgM < bestMiss.kg - 0.001)))) bestMiss = { kg: kgM, n: nM, cnt: cnt, miss: miss, pick: pick.slice() };
      return;
    }
    if (i >= ds.length || rem < 0) return;
    for (var k = Math.floor(rem / ds[i].kg + 1e-6); k >= 0; k--) { pick[i] = k; all(i + 1, rem - k * ds[i].kg, pick); }
    pick[i] = 0;
  })(0, perSide, ds.map(function () { return 0; }));
  if (!bestMiss) return { ok: false, exact: false, side: [], miss: [] };
  return { ok: false, exact: true, side: expand(bestMiss.pick), miss: bestMiss.miss };
}
function eqAllSide(inv) { var out = []; inv.discs.forEach(function (d) { for (var j = 0; j < Math.floor(d.n / 2); j++) out.push(d.kg); }); return out; }
function eqLayout(spec, inv) {
  if (!spec || !spec.kind) return null;
  if (spec.kind === "par") { var r = eqSolve(spec.kg / 2, 4, inv); return { n: 2, per: spec.kg, side: r.side, ok: r.ok, miss: r.miss, exact: r.exact !== false }; }
  if (spec.kind === "una") {
    if (spec.all) { var s = eqAllSide(inv); return { n: 1, per: 2 * s.reduce(function (a, b) { return a + b; }, 0), side: s, ok: true, miss: [], exact: true, all: true }; }
    var r2 = eqSolve(spec.kg / 2, 2, inv); return { n: 1, per: spec.kg, side: r2.side, ok: r2.ok, miss: r2.miss, exact: r2.exact !== false };
  }
  return { n: 0, per: spec.kind === "antigua" ? inv.antigua : inv.vinilo, side: [], ok: true, miss: [] };
}
function eqName(spec, lay, inv) {
  if (spec.kind === "par") return spec.kg ? "Las 2 principales · " + kgTxt(spec.kg) + " kg cada una" : "Las 2 principales sin discos";
  if (spec.kind === "una") return spec.all ? "1 principal con todos los discos · " + kgTxt(lay.per) + " kg" : "1 principal · " + kgTxt(spec.kg) + " kg";
  if (spec.kind === "antigua") return "La antigua · " + kgTxt(inv.antigua) + " kg";
  if (spec.kind === "vinilos") return "Los 2 vinilos · " + kgTxt(inv.vinilo) + " kg cada uno";
  return "";
}
function eqSay(text) {
  var spec = eqParse(text); if (!spec) return "";
  var s = "";
  if (spec.kind === "par") s = spec.kg ? "las 2 principales con " + kgSay(spec.kg) + " kilos cada una" : "las 2 principales sin discos";
  else if (spec.kind === "una") s = spec.all ? "1 principal con todos los discos" : "1 principal con " + kgSay(spec.kg) + " kilos";
  else if (spec.kind === "antigua") s = "la antigua";
  else if (spec.kind === "vinilos") s = "los 2 vinilos";
  if (spec.moch) s += (s ? " y " : "") + "mochila de " + kgSay(spec.moch) + " kilos";
  else if (spec.moch === 0) s += (s ? " y " : "") + "la mochila";
  return s;
}
function eqMissText(lay) {
  if (!lay.exact) return "No se arma exacto con tus discos.";
  return "Para este paso te faltan " + lay.miss.map(function (m) { return m.n + " disco" + (m.n > 1 ? "s" : "") + " de " + kgTxt(m.kg) + " kg"; }).join(" y ") + ".";
}
/* Lo que la carga dice además del equipo ("al pecho", "en la mano contraria"...) */
function eqRest(text) {
  var r = String(text || "")
    .replace(/(las? )?2 principales[^,+]*/i, "").replace(/1 principal con todos los discos/i, "").replace(/1 principal · [\d.]+ kg/i, "")
    .replace(/la antigua \([\d.]+ kg\)/i, "").replace(/2 vinilos \([^)]*\)/i, "").replace(/\+? ?(con )?(la )?mochila( de)?( [\d.]+ kg)?( encima| puesta)?/i, "")
    .replace(/\s*,\s*,/g, ",").replace(/^[\s,·+]+|[\s,·+]+$/g, "");
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : "";
}
function discDim(kg) { return kg >= 5 ? [100, 22] : kg >= 2.5 ? [100, 15] : kg >= 1.25 ? [74, 11] : [58, 8]; }
function dbHTML(side) {
  function disc(kg) { var d = discDim(kg); return '<i style="height:' + d[0] + "%;width:" + d[1] + 'px"></i>'; }
  return '<span class="db">' + side.slice().reverse().map(disc).join("") + "<b></b>" + side.map(disc).join("") + "</span>";
}
function eqDraw(spec, lay) {
  if (spec.kind === "par") return dbHTML(lay.side) + dbHTML(lay.side);
  if (spec.kind === "una") return dbHTML(lay.side);
  if (spec.kind === "antigua") return '<span class="db db-ant"><i style="height:92%;width:18px"></i><b></b><i style="height:92%;width:18px"></i></span>';
  if (spec.kind === "vinilos") { var v = '<span class="db db-vin"><i></i><b></b><i></i></span>'; return v + v; }
  return "";
}
/* Bloque visual de una carga: chip + dibujo + discos por lado + avisos */
function eqHTML(text, big) {
  var spec = eqParse(text);
  if (!spec) return esc(text);
  var inv = eqInv(), h = '<span class="eq' + (big ? " big" : "") + '">';
  if (spec.kind) {
    var lay = eqLayout(spec, inv), mark = spec.kind === "par" ? "2" : spec.kind === "una" ? "1" : spec.kind === "antigua" ? "A" : "V";
    h += '<span class="eq-row"><span class="eq-chip eq-' + spec.kind + '"><span class="eq-dot" aria-hidden="true">' + mark + "</span>" + esc(eqName(spec, lay, inv)) + '</span><span class="eq-draw" aria-hidden="true">' + eqDraw(spec, lay) + "</span></span>";
    if (spec.kind === "par" || spec.kind === "una") {
      var sub = lay.side.length ? "Por lado: " + lay.side.map(kgTxt).join(" + ") + " kg" : "";
      if (inv.bar && lay.ok) sub += (sub ? ". " : "") + "Con la barra: " + kgTxt(lay.per + inv.bar) + " kg" + (spec.kind === "par" ? " cada una" : "");
      if (sub) h += '<span class="eq-sub">' + esc(sub) + "</span>";
      if (!lay.ok) h += '<span class="eq-miss">' + esc(eqMissText(lay)) + "</span>";
    }
  }
  if (spec.moch != null) h += '<span class="eq-row"><span class="eq-chip eq-moch"><span class="eq-dot" aria-hidden="true">M</span>' + esc(spec.moch ? "Mochila de " + kgTxt(spec.moch) + " kg" : "Mochila puesta") + "</span></span>";
  var rest = eqRest(text);
  if (rest) h += '<span class="eq-sub">' + esc(rest) + "</span>";
  return h + "</span>";
}
/* Carga efectiva.
   - Un peldaño que cambia de implemento (barra, saco, sin peso) manda.
   - Si el peldaño actual no dice carga, vale el último peldaño anterior que sí la dice.
   - Los ejercicios con "follow" usan las mismas mancuernas que el que manda en su bloque. */
function implRung(t) { return /^\s*barra\b|saco de arena|sin peso|peso corporal/i.test(String(t || "")); }
function implTool(t) { return /^\s*barra\b|saco de arena/i.test(String(t || "")); }
function rungLoadText(lib, i, base) {
  if (!lib || !lib.ladder) return base;
  for (var j = Math.min(i, lib.ladder.length - 1); j >= 1; j--) {
    var t = rungText(lib, j); if (!t) continue;
    if (implRung(t)) return t;
    var sp = eqParse(t);
    if (sp && sp.kind) return t;
    if (sp && sp.moch != null) {
      var bs = eqParse(base);
      if (bs && bs.kind && bs.moch == null) return base + " + " + (sp.moch ? "mochila " + kgTxt(sp.moch) + " kg" : "mochila puesta");
      if (!bs || !bs.kind) return t;
      return base;
    }
  }
  return base;
}
function leadLoadText(id) { var L = EX[id]; if (!L || !L.ladder) return ""; return rungLoadText(L, rungOf(id), rungText(L, 0)); }
function followLoadText(x) {
  var sp = eqParse(leadLoadText(x.follow));
  if (!sp || (sp.kind !== "par" && sp.kind !== "una") || sp.kg == null) return null;
  var lib = EX[x.id] || {}, moch = null, j, t;
  for (j = Math.min(x.rung || 0, (lib.ladder || []).length - 1); j >= 0; j--) {
    t = rungText(lib, j); if (!t) continue;
    if (implTool(t)) return t;
    var sp2 = eqParse(t); if (sp2 && sp2.moch != null) { moch = sp2.moch; break; }
  }
  var core = x.as === "una" ? "1 principal · " + kgTxt(sp.kg) + " kg" : (sp.kg ? "2 principales · " + kgTxt(sp.kg) + " kg c/u" : "2 principales sin discos");
  return core + (x.where || "") + (moch != null ? " + " + (moch ? "mochila " + kgTxt(moch) + " kg" : "mochila puesta") : "");
}
function effLoadText(x) {
  if (x.follow) { var f = followLoadText(x); if (f) return f; }
  var base = loadText(x) || "";
  return x.rung > 0 ? rungLoadText(EX[x.id], x.rung, base) : base;
}
function sameSide(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.001) return false; return true; }
function sideTxt(s) { return s.length ? s.map(kgTxt).join(" + ") : "sin discos"; }
function eqStart(inv) { var r = eqSolve(inv.guard / 2, 4, inv), s = r.ok ? r.side : []; return { a: s.slice(), b: s.slice() }; }
/* Qué cambiar en los discos para pasar de un estado a la carga pedida */
function eqCount(side, mult) { var o = {}; side.forEach(function (kg) { var k = kgTxt(kg); o[k] = (o[k] || 0) + mult; }); return o; }
function eqApply(state, text, inv) {
  var spec = eqParse(text);
  if (!spec || (spec.kind !== "par" && spec.kind !== "una")) return { state: state, steps: [] };
  var lay = eqLayout(spec, inv); if (!lay.ok) return { state: state, steps: [] };
  var T = lay.side.slice();
  if (spec.kind === "par") {
    if (sameSide(state.a, T) && sameSide(state.b, T)) return { state: state, steps: [] };
    return { state: { a: T.slice(), b: T.slice() }, steps: [T.length ? "Deja las 2 principales con " + sideTxt(T) + " kg por lado (" + kgTxt(lay.per) + " kg cada una)." : "Quita todos los discos de las 2 principales: quedan solo las barras."] };
  }
  if (sameSide(state.a, T) || sameSide(state.b, T)) return { state: state, steps: [] };
  if (lay.all) return { state: { a: T.slice(), b: [] }, steps: ["Pasa todos los discos a 1 principal: " + sideTxt(T) + " kg por lado (" + kgTxt(lay.per) + " kg). La otra queda vacía."] };
  var need = eqCount(T, 2), other = eqCount(state.b, 2), borrow = false;
  inv.discs.forEach(function (d) { var k = kgTxt(d.kg); if ((need[k] || 0) + (other[k] || 0) > d.n) borrow = true; });
  var nb = borrow ? [] : state.b;
  return { state: { a: T.slice(), b: nb }, steps: ["Arma 1 principal con " + sideTxt(T) + " kg por lado (" + kgTxt(lay.per) + " kg)." + (borrow ? " La otra queda vacía." : "")] };
}
function eqIsWork(st) { return st && (st.type === "work" || st.type === "hold") && st.ex; }
function eqNoteIdx(steps, j) { var st = steps[j]; if (!st || !st.note || !/disco/i.test(st.note)) return -1; return eqNextLoadIdx(steps, j + 1); }
function eqNextLoadIdx(steps, i) { for (var j = Math.max(0, i); j < steps.length; j++) { if (eqIsWork(steps[j])) { var sp = eqParse(effLoadText(steps[j].ex)); if (sp && sp.kind) return j; } } return -1; }
function eqStateBefore(steps, i) {
  var inv = eqInv(), s = eqStart(inv);
  for (var j = 0; j < i && j < steps.length; j++) {
    if (eqIsWork(steps[j])) s = eqApply(s, effLoadText(steps[j].ex), inv).state;
    else { var m = eqNoteIdx(steps, j); if (m >= 0) s = eqApply(s, effLoadText(steps[m].ex), inv).state; }
  }
  return s;
}
function eqNextIdx(steps, i) { for (var j = Math.max(0, i); j < steps.length; j++) if (eqIsWork(steps[j])) return j; return -1; }
function eqPrepAt(steps, i) {
  var n = eqNextIdx(steps, i), far = false; if (n < 0) return null;
  var m = eqNoteIdx(steps, i); if (m >= 0 && m !== n) { n = m; far = true; }
  var text = effLoadText(steps[n].ex), spec = eqParse(text); if (!spec) return null;
  var r = eqApply(eqStateBefore(steps, i), text, eqInv());
  var prev = null; for (var j = n - 1; j >= 0; j--) if (eqIsWork(steps[j])) { prev = steps[j]; break; }
  var changed = !prev || effLoadText(prev.ex) !== text;
  return { text: text, steps: r.steps, changed: changed, st: steps[n], far: far };
}
function eqPrepHTML(i, onlyChange) {
  var p = eqPrepAt(P.steps, i); if (!p || (onlyChange && !p.steps.length)) return "";
  var lab = p.steps.length ? (p.far ? "Ahora, para " + p.st.ex.code + ": cambia los discos" : "Cambia los discos") : p.changed ? "Prepara" : "Sigues con";
  return '<div class="p-prep' + (p.steps.length ? " chg" : "") + '"><span class="k">' + esc(lab) + "</span>" + eqHTML(p.text, true) +
    (p.steps.length ? '<p class="eq-how">' + esc(p.steps.join(" ")) + "</p>" : "") + "</div>";
}
function eqPrepSay(i) {
  var p = eqPrepAt(P.steps, i); if (!p) return "";
  if (p.steps.length) return "Cambia los discos: " + p.steps.join(" ");
  return p.changed ? "Prepara " + eqSay(p.text) + "." : "";
}
function eqSetupHTML(plan) {
  var steps = (plan && plan.steps) || [], i = eqNextIdx(steps, 0);
  for (var j = i; j >= 0 && j < steps.length; j++) { if (eqIsWork(steps[j]) && eqParse(effLoadText(steps[j].ex)) && eqParse(effLoadText(steps[j].ex)).kind) { i = j; break; } }
  if (i < 0 || !steps[i] || !eqIsWork(steps[i])) return "";
  var text = effLoadText(steps[i].ex), spec = eqParse(text); if (!spec || !spec.kind) return "";
  var inv = eqInv(), r = eqApply(eqStart(inv), text, inv);
  return '<div class="eq-setup"><h3 class="mini">Mancuernas para el primer ejercicio con peso (' + esc(steps[i].ex.code) + ")</h3>" + eqHTML(text) +
    (r.steps.length ? '<p class="eq-how">' + esc(r.steps.join(" ")) + "</p>" : '<p class="muted">Como las guardas (' + kgTxt(inv.guard) + " kg cada una) ya sirven.</p>") + "</div>";
}
function eqRungNote(lib, i) {
  var t = rungText(lib, i), spec = eqParse(t); if (!spec || (spec.kind !== "par" && spec.kind !== "una")) return "";
  var lay = eqLayout(spec, eqInv()); return lay.ok ? "" : eqMissText(lay);
}
function eqLegendHTML() {
  var inv = eqInv();
  var rows = [
    ["2 principales · " + kgTxt(inv.guard) + " kg c/u", "Tu par armable, como lo guardas. Antes decía «completas». Con otro peso, la app te dice qué discos poner."],
    ["1 principal · 15 kg", "Los discos de 2.5 y 1.25 en una sola; la otra queda vacía."],
    ["2 principales · 8.5 kg c/u", "Tu primer paso para subir: un disco de 0.5 por lado en cada una."],
    ["2 principales sin discos", "Solo las barras con sus collares."],
    ["La antigua (5 kg)", "Tu mancuerna vieja de una pieza."],
    ["2 vinilos (1 kg c/u)", "Las de vinilo. Antes decía «dos de 1 kg»."]
  ];
  return '<div class="eq-legend">' + rows.map(function (r) { return '<div class="eq-li">' + eqHTML(r[0]) + '<p class="muted">' + esc(r[1]) + "</p></div>"; }).join("") + "</div>";
}
function eqSettingsHTML() {
  var inv = eqInv();
  var h = '<details class="card" data-k="equipo"><summary>Mis mancuernas</summary>' +
    '<p class="muted">Toda la app usa estos nombres. Los kilos son de discos; la barra va aparte (si sabes cuánto pesa, ponlo y te muestro el total).</p>' +
    '<h3 class="mini">Discos que tienes (en total, contando los dos lados de ambas)</h3><div class="eq-inv">';
  inv.discs.forEach(function (d, i) {
    h += '<div class="eq-line"><span class="eq-lab">Discos de ' + kgTxt(d.kg) + ' kg</span><button class="pbtn sq" data-act="eqn" data-i="' + i + '" data-d="-1" type="button" aria-label="Uno menos">−</button><b class="eq-n">' + d.n + '</b><button class="pbtn sq" data-act="eqn" data-i="' + i + '" data-d="1" type="button" aria-label="Uno más">+</button>' +
      (inv.discs.length > 1 ? '<button class="mini-btn quiet" data-act="eqdel" data-i="' + i + '" type="button">Quitar</button>' : "") + "</div>";
  });
  h += '<div class="eq-line"><label class="eq-lab" for="eq-new">Agregar discos de</label><input id="eq-new" type="number" min="0.25" step="0.25" inputmode="decimal" placeholder="kg"><button class="mini-btn" data-act="eqadd" type="button">Agregar</button></div></div>' +
    '<div class="eq-inv"><div class="eq-line"><label class="eq-lab" for="eq-bar">Peso de cada barra principal con sus collares</label><input id="eq-bar" type="number" min="0" step="0.1" inputmode="decimal" value="' + (inv.bar || "") + '" placeholder="no sé"> kg</div>' +
    '<div class="eq-line"><label class="eq-lab" for="eq-ant">La antigua pesa</label><input id="eq-ant" type="number" min="0" step="0.5" inputmode="decimal" value="' + inv.antigua + '"> kg</div>' +
    '<div class="eq-line"><label class="eq-lab" for="eq-vin">Cada vinilo pesa</label><input id="eq-vin" type="number" min="0" step="0.5" inputmode="decimal" value="' + inv.vinilo + '"> kg</div>' +
    '<div class="eq-line"><label class="eq-lab" for="eq-guard">Cuando las guardas, cada principal tiene</label><input id="eq-guard" type="number" min="0" step="0.5" inputmode="decimal" value="' + inv.guard + '"> kg de discos</div></div>' +
    (function () { var one = 2 * eqAllSide(inv).reduce(function (a, b) { return a + b; }, 0), par = eqParMax(inv);
      return '<p class="muted">Con tus discos, el máximo en 1 principal es ' + kgTxt(one) + " kg de discos" + (inv.bar ? " (" + kgTxt(one + inv.bar) + " kg con la barra)" : "") + "; en el par, " + kgTxt(par) + " kg de discos cada una" + (inv.bar ? " (" + kgTxt(2 * (par + inv.bar)) + " kg entre las dos con las barras)" : "") + ".</p>"; })() +
    '<h3 class="mini">Cómo se llama cada cosa</h3>' + eqLegendHTML() +
    '<div class="hero-actions"><button class="btn quiet" data-act="eqreset" type="button">Volver a mis discos de fábrica</button></div></details>';
  return h;
}
function eqParMax(inv) { var best = 0; for (var i = 0; i <= 80; i++) { var kg = i * 0.5; if (eqSolve(kg / 2, 4, inv).ok) best = kg; } return best; }

/* ===================== 2. Cámara: MediaPipe Pose ===================== */
var MP_VER = "1.0.1";
var MP_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VER;
var MP_MODEL = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
};
var CAM = { on: false, lm: null, loading: null, model: null, stream: null, raf: 0, lastTs: 0, lastVT: -1, eng: null, active: false, W: 0, H: 0, facing: null, closeT: null, limitArm: false, cueT: null, fps: 0, fpsN: 0, fpsT: 0 };
var LMI = { nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16, hipL: 23, hipR: 24, knL: 25, knR: 26, anL: 27, anR: 28, heL: 29, heR: 30, ftL: 31, ftR: 32 };
var BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 31], [27, 29], [29, 31], [24, 26], [26, 28], [28, 32], [28, 30], [30, 32]];
var CAM_VIEW = {
  lado: "Celular de lado, a la altura de tu cadera y a 2-3 m: que entres entero en la imagen.",
  frente: "Celular de frente, a la altura del pecho y a 2-3 m: que se vean tus manos y tus pies.",
  piso: "En el piso: celular de lado, bajo (20-40 cm del suelo) y a unos 2 m.",
  pisofrente: "En el piso: celular bajo, frente a tu pecho, a unos 2 m."
};
var SIG_NAME = { elbow: "el codo", knee: "la rodilla", hip: "la cadera", arm: "el brazo", ankle: "el tobillo" };
/* Qué mide la cámara en cada ejercicio.
   sig: ángulo que cuenta las repeticiones. dir: hacia dónde se mueve al salir de la posición inicial.
   amp: recorrido esperado (grados) y min: recorrido mínimo para contar. */
var CAMX = {
  remo1m: { view: "lado", sig: "elbow", dir: "down", amp: 70, min: 30, checks: ["torso45", "shrug"], tip: "Que el brazo que trabaja quede del lado del celular." },
  arquero: { view: "piso", sig: "elbow", side: "min", dir: "down", amp: 60, min: 25, checks: ["line"] },
  pike: { view: "piso", sig: "elbow", side: "min", dir: "down", amp: 50, min: 22, checks: ["pikeV"] },
  facepull: { view: "frente", sig: "elbow", side: "avg", dir: "down", amp: 70, min: 30, checks: ["elbowsHigh", "shrug"] },
  pressinc: { view: "piso", sig: "elbow", dir: "down", amp: 70, min: 30, checks: [] },
  pullover: { view: "piso", sig: "arm", dir: "up", amp: 60, min: 25, checks: ["elbowFixed"] },
  latinc: { view: "frente", sig: "arm", dir: "up", amp: 65, min: 30, checks: ["tooHigh"] },
  curlbay: { view: "lado", sig: "elbow", dir: "down", amp: 90, min: 35, checks: ["elbowStill"], tip: "Que el brazo que trabaja quede del lado del celular." },
  triover: { view: "lado", sig: "elbow", dir: "down", amp: 80, min: 30, checks: ["upperArmUp"] },
  planchaesc: { view: "piso", hold: true, checks: ["line"] },
  splitsq: { view: "lado", sig: "knee", side: "front", dir: "down", amp: 50, min: 18, limit: true, torsoMax: 30, checks: ["torsoUp"] },
  rdl1p: { view: "lado", sig: "hip", side: "stand", dir: "down", amp: 60, min: 25, checks: ["softKnee"] },
  curlfem: { view: "piso", sig: "knee", side: "avg", dir: "up", amp: 60, min: 25, checks: ["hipsUp"] },
  extrod: { view: "lado", sig: "knee", dir: "up", amp: 40, min: 15, maxVal: 142, checks: [] },
  stepdown: { view: "frente", sig: "knee", side: "upfoot", dir: "down", amp: 35, min: 12, limit: true, checks: ["valgus"] },
  hipthrust: { view: "lado", sig: "hip", dir: "up", amp: 60, min: 25, lockout: 160, lockMsg: "Sube la cadera completa y aprieta el glúteo", checks: [] },
  talonpie: { view: "lado", sig: "ankle", side: "stand", dir: "down", amp: 30, min: 10, approx: true, checks: [], tip: "Conteo aproximado: el pie se ve chico en la imagen." },
  copen: { view: "pisofrente", hold: true, checks: ["sidePlank"] },
  flexexp: { view: "piso", sig: "elbow", side: "min", dir: "down", amp: 60, min: 25, vel: true, checks: ["line"] },
  remoexp: { view: "lado", sig: "elbow", dir: "down", amp: 70, min: 30, vel: true, checks: [] },
  arnold: { view: "frente", sig: "elbow", side: "avg", dir: "up", amp: 80, min: 35, lockout: 155, lockMsg: "Estira los brazos arriba", checks: ["sym"] },
  remosup: { view: "lado", sig: "elbow", dir: "down", amp: 70, min: 30, checks: ["torso45", "torsoStill"] },
  deficit: { view: "piso", sig: "elbow", side: "min", dir: "down", amp: 70, min: 30, checks: ["line"] },
  jalon: { view: "frente", sig: "elbow", side: "avg", dir: "down", amp: 70, min: 30, checks: ["sym"] },
  latpie: { view: "frente", sig: "arm", side: "avg", dir: "up", amp: 65, min: 30, checks: ["tooHigh", "sym", "swing"] },
  martillo: { view: "lado", sig: "elbow", dir: "down", amp: 90, min: 35, checks: ["elbowStill", "swing"] },
  frances: { view: "piso", sig: "elbow", dir: "down", amp: 70, min: 30, checks: ["upperArmFixed"] },
  yraise: { view: "lado", sig: "arm", dir: "up", amp: 70, min: 30, checks: [] },
  planchalat: { view: "pisofrente", hold: true, checks: ["sidePlank"] },
  rdl2p: { view: "lado", sig: "hip", dir: "down", amp: 70, min: 30, vel: true, checks: ["softKnee"] },
  goblet: { view: "lado", sig: "knee", side: "min", dir: "down", amp: 45, min: 18, limit: true, vel: true, torsoMax: 45, checks: ["torsoUp"] },
  pressmil: { view: "lado", sig: "elbow", dir: "up", amp: 80, min: 35, lockout: 155, lockMsg: "Estira los brazos arriba", vel: true, checks: ["leanBack"] }
};
var WARN_TXT = { line: "cadera fuera de línea", pikeV: "cadera baja en la V", torso45: "torso muy vertical", torsoStill: "balanceo del torso", shrug: "hombros a las orejas", elbowsHigh: "codos bajos", elbowFixed: "codos que se doblan", tooHigh: "brazo sobre el hombro", elbowStill: "codo que se adelanta", upperArmUp: "codos que se mueven", upperArmFixed: "codos que se mueven", torsoUp: "torso inclinado", softKnee: "demasiada rodilla", hipsUp: "cadera que baja", valgus: "rodilla hacia adentro", sym: "brazos disparejos", swing: "impulso con el cuerpo", leanBack: "espalda arqueada", sidePlank: "cadera caída", ecc: "bajada rápida", pausa: "sin pausa", rango: "rango corto", vel1: "velocidad que cae", vel: "velocidad que cae", lock: "sin extender arriba", limit: "más hondo que tu límite", maxv: "rodilla demasiado estirada" };

function camCfg(x) { if (x && x.rungText && x.rung > 0 && implTool(x.rungText)) return null; return x && CAMX[x.id] ? CAMX[x.id] : null; }
function camSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false; }
function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function ang(a, b, c) {
  if (!a || !b || !c) return null;
  var abx = a.x - b.x, aby = a.y - b.y, cbx = c.x - b.x, cby = c.y - b.y, d = Math.sqrt((abx * abx + aby * aby) * (cbx * cbx + cby * cby));
  if (!d) return null;
  return Math.acos(Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / d))) * 180 / Math.PI;
}
function vis3(a, b, c, m) { m = m || 0.5; return !!(a && b && c && a.v >= m && b.v >= m && c.v >= m); }
var SIG = {
  elbow: function (Pz, s) { var a = Pz["sh" + s], b = Pz["el" + s], c = Pz["wr" + s]; return vis3(a, b, c) ? ang(a, b, c) : null; },
  knee: function (Pz, s) { var a = Pz["hip" + s], b = Pz["kn" + s], c = Pz["an" + s]; return vis3(a, b, c, 0.45) ? ang(a, b, c) : null; },
  hip: function (Pz, s) { var a = Pz["sh" + s], b = Pz["hip" + s], c = Pz["kn" + s]; return vis3(a, b, c) ? ang(a, b, c) : null; },
  arm: function (Pz, s) { var a = Pz["hip" + s], b = Pz["sh" + s], c = Pz["el" + s]; return vis3(a, b, c) ? ang(a, b, c) : null; },
  ankle: function (Pz, s) { var a = Pz["kn" + s], b = Pz["an" + s], c = Pz["ft" + s]; return vis3(a, b, c, 0.4) ? ang(a, b, c) : null; }
};
var SIG_PTS = { elbow: ["sh", "el", "wr"], knee: ["hip", "kn", "an"], hip: ["sh", "hip", "kn"], arm: ["hip", "sh", "el"], ankle: ["kn", "an", "ft"] };
function camPose(lm, W, H) {
  var Pz = { W: W, H: H };
  for (var k in LMI) { var p = lm[LMI[k]]; if (p) Pz[k] = { x: p.x * W, y: p.y * H, v: p.visibility == null ? 1 : p.visibility }; }
  return Pz;
}
function pick(Pz, names) {
  var sL = 1, sR = 1;
  names.forEach(function (n) { var a = Pz[n + "L"], b = Pz[n + "R"]; sL = Math.min(sL, a ? a.v : 0); sR = Math.min(sR, b ? b.v : 0); });
  if (Math.max(sL, sR) < 0.5) return null;
  return sL >= sR ? "L" : "R";
}
function grpVis(Pz, g) { return !!pick(Pz, g); }
function torsoTilt(Pz, s) { var sh = Pz["sh" + s], hp = Pz["hip" + s]; return Math.atan2(Math.abs(sh.x - hp.x), hp.y - sh.y) * 180 / Math.PI; }
function facing(Pz) {
  var e = Pz.earL && Pz.earR ? (Pz.earL.v >= Pz.earR.v ? Pz.earL : Pz.earR) : (Pz.earL || Pz.earR);
  if (!Pz.nose || !e) return 0;
  var d = Pz.nose.x - e.x; return Math.abs(d) < 2 ? 0 : (d > 0 ? 1 : -1);
}
function leanSigned(Pz, s) { var f = facing(Pz) || 1, sh = Pz["sh" + s], hp = Pz["hip" + s]; return Math.atan2((sh.x - hp.x) * f, hp.y - sh.y) * 180 / Math.PI; }
function armFlexSigned(Pz, s) {
  var f = facing(Pz) || 1, sh = Pz["sh" + s], el = Pz["el" + s], hp = Pz["hip" + s];
  var a1 = Math.atan2((hp.x - sh.x) * f, hp.y - sh.y), a2 = Math.atan2((el.x - sh.x) * f, el.y - sh.y), d = (a2 - a1) * 180 / Math.PI;
  while (d > 180) d -= 360; while (d < -180) d += 360; return d;
}
function lineDev(a, h, c) { var dx = c.x - a.x; if (Math.abs(dx) < 1) return 0; var yl = a.y + (c.y - a.y) * (h.x - a.x) / dx, len = Math.hypot(c.x - a.x, c.y - a.y) || 1; return (h.y - yl) / len; }
function earRatio(Pz) {
  var s = pick(Pz, ["ear", "sh", "hip"]); if (!s) return null;
  var e = Pz["ear" + s], sh = Pz["sh" + s], hp = Pz["hip" + s], t = Math.hypot(sh.x - hp.x, sh.y - hp.y);
  return t ? Math.hypot(e.x - sh.x, e.y - sh.y) / t : null;
}
function standSide(Pz) { var a = Pz.anL, b = Pz.anR; if (!a || !b || a.v < 0.4 || b.v < 0.4) return a && a.v >= 0.4 ? "L" : b && b.v >= 0.4 ? "R" : null; return a.y >= b.y ? "L" : "R"; }
function upSide(Pz) { var a = Pz.anL, b = Pz.anR; if (!a || !b || a.v < 0.4 || b.v < 0.4) return null; return a.y <= b.y ? "L" : "R"; }
function frontSide(Pz) {
  if (!Pz.anL || !Pz.anR || !Pz.hipL || !Pz.hipR || !Pz.nose) return null;
  var mid = (Pz.hipL.x + Pz.hipR.x) / 2, f = Pz.nose.x - mid; if (Math.abs(f) < 3) return null;
  return (Pz.anL.x - mid) * Math.sign(f) >= (Pz.anR.x - mid) * Math.sign(f) ? "L" : "R";
}
function hotOf(s, names) { var o = {}; names.forEach(function (n) { o[LMI[n + s]] = 1; }); return o; }
/* Chequeos de forma. Devuelven {msg} si hay algo que corregir. move: solo durante la repetición. */
var CHK = {
  line: { hold: 0.6, fn: function (Pz) {
    var s = pick(Pz, ["sh", "hip", "an"]); if (!s) return null;
    var d = lineDev(Pz["sh" + s], Pz["hip" + s], Pz["an" + s]);
    if (d > 0.07) return { msg: "Sube un poco la cadera: cuerpo en línea", hot: hotOf(s, ["sh", "hip", "an"]) };
    if (d < -0.1) return { msg: "Baja la cadera: cuerpo en línea", hot: hotOf(s, ["sh", "hip", "an"]) };
    return null; } },
  pikeV: { hold: 0.6, fn: function (Pz) { var s = pick(Pz, ["sh", "hip", "an"]); if (!s) return null; var a = ang(Pz["sh" + s], Pz["hip" + s], Pz["an" + s]); return a != null && a > 125 ? { msg: "Cadera arriba: mantén la V invertida", hot: hotOf(s, ["sh", "hip", "an"]) } : null; } },
  torso45: { move: true, hold: 0.6, fn: function (Pz) { var s = pick(Pz, ["sh", "hip"]); if (!s) return null; return torsoTilt(Pz, s) < 25 ? { msg: "Inclina más el torso, a unos 45 grados", hot: hotOf(s, ["sh", "hip"]) } : null; } },
  torsoStill: { move: true, hold: 0.3, fn: function (Pz, E) { var s = pick(Pz, ["sh", "hip"]); if (!s || !E.b0 || E.b0.tilt == null) return null; return Math.abs(torsoTilt(Pz, s) - E.b0.tilt) > 14 ? { msg: "Torso quieto, sin balanceo", hot: hotOf(s, ["sh", "hip"]) } : null; } },
  shrug: { move: true, hold: 0.4, fn: function (Pz, E) { var r = earRatio(Pz); if (r == null || !E.b0 || !E.b0.ear) return null; return r < 0.75 * E.b0.ear ? { msg: "Hombros lejos de las orejas" } : null; } },
  elbowsHigh: { move: true, hold: 0.4, fn: function (Pz, E) {
    if (!E.atFar) return null; var s = pick(Pz, ["sh", "el", "hip"]); if (!s) return null;
    var tl = Math.hypot(Pz["sh" + s].x - Pz["hip" + s].x, Pz["sh" + s].y - Pz["hip" + s].y);
    return Pz["el" + s].y > Pz["sh" + s].y + 0.18 * tl ? { msg: "Codos altos, a la altura de los hombros", hot: hotOf(s, ["sh", "el"]) } : null; } },
  elbowFixed: { move: true, hold: 0.4, fn: function (Pz, E) { var s = E.side || pick(Pz, ["sh", "el", "wr"]); if (!s || !E.b0 || E.b0.el[s] == null) return null; var a = SIG.elbow(Pz, s); return a != null && Math.abs(a - E.b0.el[s]) > 28 ? { msg: "Codos fijos: no lo conviertas en tríceps", hot: hotOf(s, ["sh", "el", "wr"]) } : null; } },
  tooHigh: { move: true, hold: 0.3, fn: function (Pz) { var L = SIG.arm(Pz, "L"), R = SIG.arm(Pz, "R"), m = Math.max(L || 0, R || 0); return m > 112 ? { msg: "Hasta la altura del hombro, no más" } : null; } },
  elbowStill: { move: true, hold: 0.35, fn: function (Pz, E) { var s = E.side || pick(Pz, ["sh", "el", "hip"]); if (!s || !E.b0 || E.b0.flex[s] == null || !vis3(Pz["sh" + s], Pz["el" + s], Pz["hip" + s])) return null; return armFlexSigned(Pz, s) - E.b0.flex[s] > 28 ? { msg: "Codo quieto: no lo adelantes", hot: hotOf(s, ["sh", "el"]) } : null; } },
  upperArmUp: { move: true, hold: 0.4, fn: function (Pz, E) { var s = E.side || pick(Pz, ["sh", "el", "hip"]); if (!s || !E.b0 || E.b0.arm[s] == null) return null; var a = SIG.arm(Pz, s); return a != null && E.b0.arm[s] - a > 22 ? { msg: "Codos apuntando arriba y quietos", hot: hotOf(s, ["sh", "el"]) } : null; } },
  upperArmFixed: { move: true, hold: 0.4, fn: function (Pz, E) { var s = E.side || pick(Pz, ["sh", "el", "hip"]); if (!s || !E.b0 || E.b0.arm[s] == null) return null; var a = SIG.arm(Pz, s); return a != null && Math.abs(a - E.b0.arm[s]) > 22 ? { msg: "Codos quietos apuntando al techo", hot: hotOf(s, ["sh", "el"]) } : null; } },
  torsoUp: { move: true, hold: 0.4, fn: function (Pz, E) { var s = pick(Pz, ["sh", "hip"]); if (!s) return null; return torsoTilt(Pz, s) > (E.cfg.torsoMax || 40) ? { msg: "Pecho arriba, torso más vertical", hot: hotOf(s, ["sh", "hip"]) } : null; } },
  softKnee: { move: true, hold: 0.4, fn: function (Pz, E) { var s = E.cfg.side === "stand" ? standSide(Pz) : pick(Pz, ["hip", "kn", "an"]); if (!s) return null; var k = SIG.knee(Pz, s); return k != null && k < 135 ? { msg: "Menos rodilla: lleva la cadera atrás", hot: hotOf(s, ["hip", "kn", "an"]) } : null; } },
  hipsUp: { move: true, hold: 0.5, fn: function (Pz) { var s = pick(Pz, ["sh", "hip", "kn"]); if (!s) return null; var a = SIG.hip(Pz, s); return a != null && a < 145 ? { msg: "Cadera arriba todo el recorrido", hot: hotOf(s, ["sh", "hip", "kn"]) } : null; } },
  valgus: { move: true, hold: 0.25, fn: function (Pz, E) {
    var s = E.side; if (!s || !Pz.hipL || !Pz.hipR) return null;
    var h = Pz["hip" + s], k = Pz["kn" + s], a = Pz["an" + s]; if (!vis3(h, k, a, 0.45)) return null;
    var kn = ang(h, k, a); if (kn == null || kn > 165) return null;
    var dy = a.y - h.y; if (Math.abs(dy) < 1) return null;
    var xl = h.x + (a.x - h.x) * (k.y - h.y) / dy, leg = Math.hypot(a.x - h.x, a.y - h.y) || 1, mid = (Pz.hipL.x + Pz.hipR.x) / 2;
    var medial = (xl - k.x) * Math.sign(xl - mid) / leg;
    return medial > 0.07 ? { msg: "Rodilla hacia afuera, sobre el segundo dedo", hot: hotOf(s, ["hip", "kn", "an"]) } : null; } },
  sym: { move: true, hold: 0.35, fn: function (Pz, E) { var f = SIG[E.cfg.sig], L = f(Pz, "L"), R = f(Pz, "R"); if (L == null || R == null) return null; return Math.abs(L - R) > 22 ? { msg: "Parejo: los dos brazos a la vez" } : null; } },
  swing: { move: true, hold: 0.3, fn: function (Pz, E) { var s = pick(Pz, ["sh", "hip"]); if (!s || !E.b0 || E.b0.tilt == null) return null; return Math.abs(torsoTilt(Pz, s) - E.b0.tilt) > 11 ? { msg: "Sin impulso: el torso quieto", hot: hotOf(s, ["sh", "hip"]) } : null; } },
  leanBack: { move: true, hold: 0.35, fn: function (Pz) { var s = pick(Pz, ["sh", "hip"]); if (!s || !facing(Pz)) return null; return leanSigned(Pz, s) < -12 ? { msg: "Costillas abajo: no te eches hacia atrás", hot: hotOf(s, ["sh", "hip"]) } : null; } },
  sidePlank: { hold: 0.6, fn: function (Pz) { var s = pick(Pz, ["sh", "hip", "an"]); if (!s) return null; return lineDev(Pz["sh" + s], Pz["hip" + s], Pz["an" + s]) > 0.07 ? { msg: "Sube la cadera: cuerpo en línea", hot: hotOf(s, ["sh", "hip", "an"]) } : null; } }
};
function camNeed(cfg) {
  if (cfg.hold) return [["sh", "hip", "an"]];
  return [SIG_PTS[cfg.sig]];
}
function camLimits() { return pref("camLim", {}) || {}; }
function camSetLimit(id, v) { var o = JSON.parse(JSON.stringify(camLimits())); if (v == null) delete o[id]; else o[id] = Math.round(v); setPref("camLim", o); }
function camLimitOf(id) { var v = camLimits()[id]; return v == null ? null : +v; }

/* Motor de una serie */
function camNewEng(st, cfg) {
  var x = st.ex;
  return {
    st: st, x: x, cfg: cfg, hold: !!cfg.hold || st.type === "hold", first: x.start === "bottom" ? "con" : "ecc",
    tempo: tempoParts(x.tempo), phN: x.phNames || PH.squat, state: "arm", ch: {}, lock: null, mk: null, cur: null, side: null,
    trace: [], peak: 0, peakVal: null, ret: false, valley: null, reps: 0, peaks: [], q: [], lastEnd: 0, missSince: 0,
    cueT: {}, lastCue: 0, warn: {}, badSince: {}, conRef: null, slow: 0, b0: null, hot: null, hotUntil: 0, atFar: false, taken: false, votes: { L: 0, R: 0 }
  };
}
function sigRead(E, Pz) {
  var f = SIG[E.cfg.sig], m = E.cfg.side || "auto", L = f(Pz, "L"), R = f(Pz, "R"), s;
  if (m === "auto") return { L: L, R: R };
  if (m === "avg") return { S: L != null && R != null ? (L + R) / 2 : (L != null ? L : R) };
  if (m === "min") { if (L != null && R != null) { E.side = L <= R ? "L" : "R"; return { S: Math.min(L, R) }; } E.side = L != null ? "L" : R != null ? "R" : null; return { S: L != null ? L : R }; }
  s = m === "front" ? frontSide(Pz) : m === "stand" ? standSide(Pz) : upSide(Pz);
  if (s && !E.sideLock) { E.votes[s]++; if (E.votes[s] > 15) { E.side = s; E.sideLock = true; } }
  s = E.side || s;
  return { S: s ? f(Pz, s) : (L != null ? L : R) };
}
function camBaseline(Pz) {
  var b = { tilt: null, ear: earRatio(Pz), el: {}, arm: {}, flex: {} }, ts = pick(Pz, ["sh", "hip"]);
  if (ts) b.tilt = torsoTilt(Pz, ts);
  ["L", "R"].forEach(function (s) { b.el[s] = SIG.elbow(Pz, s); b.arm[s] = SIG.arm(Pz, s); b.flex[s] = vis3(Pz["sh" + s], Pz["el" + s], Pz["hip" + s]) ? armFlexSigned(Pz, s) : null; });
  return b;
}
function stableBase(buf, t) {
  if (buf.length < 5 || t - buf[0].t < 0.45) return null;
  var lo = Infinity, hi = -Infinity; buf.forEach(function (z) { lo = Math.min(lo, z.v); hi = Math.max(hi, z.v); });
  return hi - lo < 7 ? (lo + hi) / 2 : null;
}
function coachFrame(E, Pz, t) {
  if (E.taken) return;
  E.now = t;
  var need = camNeed(E.cfg);
  var present = !!Pz && need.every(function (g) { return grpVis(Pz, g); });
  if (!present) {
    if (!E.missSince) E.missSince = t;
    var gone = t - E.missSince;
    if (gone > 1.2) camState("warn", Pz ? "No te veo completo: aléjate o acomoda el celular" : "No te veo: ponte frente a la cámara");
    if (gone > 2.5 && E.reps > 0 && !E.hold && E.state !== "move") camAskClose(E, 3);
    return;
  }
  E.missSince = 0;
  if (E.hold) { if (!E.b0) { E.b0 = camBaseline(Pz); } camState("ok", "Te veo bien"); camChecks(E, Pz, t, true); return; }
  var raw = sigRead(E, Pz), any = false, k;
  for (k in raw) {
    var v = raw[k]; if (v == null) continue; any = true;
    var c = E.ch[k] || (E.ch[k] = { sm: null, buf: [], ring: [], base: null, e: 0 });
    c.sm = c.sm == null ? v : c.sm + 0.45 * (v - c.sm);
    c.ring.push({ t: t, v: c.sm }); while (c.ring.length > 1 && t - c.ring[0].t > 0.8) c.ring.shift();
    c.buf.push({ t: t, v: c.sm }); while (c.buf.length > 1 && t - c.buf[0].t > 0.7) c.buf.shift();
  }
  if (!any) { camState("warn", "Gira un poco: no veo bien " + (SIG_NAME[E.cfg.sig] || "el movimiento")); return; }
  var dirDown = E.cfg.dir === "down";
  if (E.state === "arm") {
    var armed = false;
    for (k in E.ch) { var b = stableBase(E.ch[k].buf, t); if (b != null) { E.ch[k].base = b; armed = true; } }
    if (armed) { E.state = "idle"; E.b0 = camBaseline(Pz); camState("ok", "Listo: empieza"); beep(988, 0.08, 0.2); }
    else camState("warn", "Quieto en la posición inicial…");
    return;
  }
  var best = null;
  for (k in E.ch) {
    var c3 = E.ch[k]; if (c3.sm == null) continue;
    if (c3.base == null) { c3.base = stableBase(c3.buf, t); if (c3.base == null) continue; }
    c3.e = dirDown ? c3.base - c3.sm : c3.sm - c3.base;
    if (E.lock && k !== E.lock) continue;
    if (!best || c3.e > best.e) best = { k: k, e: c3.e, c: c3 };
  }
  if (!best) return;
  var amp = E.peaks.length ? median(E.peaks) : E.cfg.amp, minA = E.cfg.min;
  var enter = Math.max(minA * 0.45, 0.22 * amp), exit = Math.max(minA * 0.3, 0.16 * amp), e = best.e, s = best.c.sm;
  if (E.state === "idle") {
    for (k in E.ch) { var c4 = E.ch[k]; if (c4.base == null || c4.sm == null) continue; var e4 = dirDown ? c4.base - c4.sm : c4.sm - c4.base; if (e4 < 0) c4.base = c4.sm; else if (e4 < 3) c4.base += 0.04 * (c4.sm - c4.base); }
    if (e > enter) {
      var C = best.c; E.state = "move"; E.mk = best.k; E.peak = e; E.peakVal = s; E.valley = null; E.ret = false;
      if (best.k !== "S") E.side = best.k;
      E.trace = C.ring.map(function (z) { return { t: z.t, e: dirDown ? C.base - z.v : z.v - C.base, v: z.v }; });
      camCancelClose();
    } else camAutoClose(E, t);
  } else if (E.state === "move") {
    var M = E.ch[E.mk]; e = dirDown ? M.base - M.sm : M.sm - M.base; s = M.sm;
    E.trace.push({ t: t, e: e, v: s }); if (E.trace.length > 900) E.trace.shift();
    if (e > E.peak) { E.peak = e; E.peakVal = s; }
    if (!E.ret && E.peak >= minA && e < 0.55 * E.peak) E.ret = true;
    if (E.ret) {
      if (!E.valley || e < E.valley.e) E.valley = { t: t, e: e, v: s };
      if (e < exit) { camRep(E, t); E.state = "idle"; }
      else if (e - E.valley.e > Math.max(minA * 0.5, 0.25 * amp)) {
        var vt = E.valley.t, vv = E.valley.v;
        camRep(E, vt);
        M.base = M.base + 0.6 * (vv - M.base);
        E.trace = E.trace.filter(function (z) { return z.t >= vt; }).map(function (z) { return { t: z.t, e: dirDown ? M.base - z.v : z.v - M.base, v: z.v }; });
        e = dirDown ? M.base - s : s - M.base;
        E.peak = e; E.peakVal = s; E.valley = null; E.ret = false;
      }
    } else if (e < exit) E.state = "idle";
    else if (t - E.trace[0].t > 25) E.state = "idle";
    E.atFar = E.state === "move" && e > 0.6 * amp;
  }
  if (E.state !== "move") E.atFar = false;
  camChecks(E, Pz, t, E.state === "move");
  camLimitLive(E, s);
}
/* Una repetición terminada: tiempos de cada fase a partir del trazo */
function camRep(E, tEnd) {
  var tr = E.trace.filter(function (z) { return z.t <= tEnd + 1e-6; }), P0 = E.peak, i;
  if (tr.length < 3 || P0 <= 0) return;
  var hi = 0.85 * P0, lo = 0.15 * P0, iF = -1, iL = -1;
  for (i = 0; i < tr.length; i++) if (tr[i].e >= hi) { if (iF < 0) iF = i; iL = i; }
  if (iF < 0) return;
  var iS = 0; for (i = iF; i >= 0; i--) if (tr[i].e <= lo) { iS = i; break; }
  var iE = tr.length - 1; for (i = iL; i < tr.length; i++) if (tr[i].e <= lo) { iE = i; break; }
  var ph1 = tr[iF].t - tr[iS].t, hold = tr[iL].t - tr[iF].t, ph2 = tr[iE].t - tr[iL].t;
  var q = { ecc: E.first === "ecc" ? ph1 : ph2, con: E.first === "ecc" ? ph2 : ph1, far: hold, P: P0, val: E.peakVal, dur: tr[iE].t - tr[iS].t };
  E.lastEnd = tr[iE].t;
  E.reps++; E.peaks.push(P0); if (E.peaks.length > 12) E.peaks.shift(); E.q.push(q);
  if (!E.lock && E.mk && E.mk !== "S") E.lock = E.mk;
  camRepFeedback(E, q);
  camRender(E);
}
function camRepFeedback(E, q) {
  var x = E.x, tp = E.tempo, n = E.reps, top = repsRange(x.reps)[1], msg = null, urgent = false;
  function add(id, text, u) { if (msg && !u) return; if (cue(E, id, text, !!u, true)) { msg = text; urgent = urgent || !!u; } }
  if (CAM.limitArm && E.cfg.limit && q.val != null) {
    camSetLimit(x.id, q.val); CAM.limitArm = false; camLimitBtn();
    add("lim0", "Guardé tu profundidad segura", false);
  } else if (E.cfg.limit && q.val != null) {
    var lim = camLimitOf(x.id);
    if (lim != null && (E.cfg.dir === "down" ? q.val < lim - 6 : q.val > lim + 6)) add("limit", "Bajaste más hondo que tu altura segura", true);
  }
  if (E.cfg.vel || (tp && tp[2] && tp[2].x)) {
    if (E.reps <= 2) E.conRef = E.conRef == null ? q.con : Math.min(E.conRef, q.con);
    else if (E.conRef && q.con > E.conRef * 1.25 && q.con - E.conRef > 0.12) {
      E.slow++;
      if (E.slow >= 2) { add("vel", "Corta la serie: ya bajó la velocidad", true); if (pref("camAuto", true)) setTimeout(function () { camAskClose(E, 3); }, 600); }
      else add("vel1", "La velocidad bajó. Si la siguiente sale igual, corta", false);
    } else E.slow = 0;
  }
  if (tp) {
    var eT = tp[0] && tp[0].s, pFar = E.first === "ecc" ? (tp[1] && tp[1].s) : (tp[3] && tp[3].s);
    if (eT >= 2 && q.ecc < 0.55 * eT) add("ecc", E.phN[0] + " más lento: " + eT + " segundos");
    else if (pFar >= 1 && q.far < 0.3) add("pausa", E.first === "ecc" ? "Quieto " + pFar + " segundo" + (pFar > 1 ? "s" : "") + " abajo" : "Sostén " + pFar + " segundo" + (pFar > 1 ? "s" : "") + " arriba");
  }
  if (E.peaks.length >= 3) { var med = median(E.peaks.slice(0, -1)); if (q.P < 0.7 * med) add("rango", "Rango completo"); }
  if (E.cfg.lockout && q.val != null && (E.cfg.dir === "up" ? q.val < E.cfg.lockout : q.val > E.cfg.lockout)) add("lock", E.cfg.lockMsg || "Termina el movimiento completo");
  snd(n === top ? "top" : "rep");
  var countOn = pref("camCount", true) && !PC.running, txt = "";
  if (countOn) txt = n + (n === top && !msg ? ". Tope del rango." : ".");
  if (msg) txt += (txt ? " " : "") + msg;
  if (txt) say(txt, urgent);
}
function cue(E, id, msg, urgent, quiet) {
  var t = E.now || performance.now() / 1000;
  if (!urgent && t - E.lastCue < 3.5) return false;
  if (E.cueT[id] && t - E.cueT[id] < (urgent ? 4 : 9)) return false;
  E.cueT[id] = t; E.lastCue = t; E.warn[id] = (E.warn[id] || 0) + 1;
  camCue(msg, urgent ? "bad" : "warn");
  if (urgent) snd("warn");
  if (!quiet) say(msg, urgent);
  return true;
}
function camChecks(E, Pz, t, moving) {
  var list = E.cfg.checks || [];
  for (var i = 0; i < list.length; i++) {
    var id = list[i], c = CHK[id]; if (!c) continue;
    if (c.move && !moving) { E.badSince[id] = 0; continue; }
    var r = null; try { r = c.fn(Pz, E); } catch (err) { r = null; }
    if (r) {
      if (!E.badSince[id]) E.badSince[id] = t;
      if (t - E.badSince[id] >= (c.hold || 0.5) && cue(E, id, r.msg, false)) { E.hot = r.hot || null; E.hotUntil = t + 1.6; }
    } else E.badSince[id] = 0;
  }
  if (E.hot && t > E.hotUntil) E.hot = null;
}
function camLimitLive(E, s) {
  if (E.state !== "move" || s == null) return;
  if (E.cfg.maxVal && s > E.cfg.maxVal) cue(E, "maxv", "No estires del todo: para en 45 grados", true);
  if (E.cfg.limit && !CAM.limitArm) { var lim = camLimitOf(E.x.id); if (lim != null && (E.cfg.dir === "down" ? s < lim - 6 : s > lim + 6)) cue(E, "limit", "Más hondo que tu altura segura", true); }
}
function camAutoClose(E, t) {
  if (!pref("camAuto", true) || E.reps < 1 || CAM.closeT) return;
  var avg = E.q.length ? E.q.reduce(function (a, q) { return a + q.dur; }, 0) / E.q.length : 2;
  if (t - E.lastEnd > Math.max(7, avg * 1.6 + 4)) camAskClose(E, 3);
}
function camAskClose(E, secs) {
  if (CAM.closeT || E.taken || !P.active || P.steps[P.idx] !== E.st || E.st.type !== "work") return;
  var n = secs || 3;
  camCue("Cierro la serie en " + n + ". Muévete o toca «Sigo» si continúas.", "ok", true);
  say("Cierro la serie", false);
  var b = $("cam-keep"); if (b) b.hidden = false;
  CAM.closeT = setInterval(function () {
    if (!P.active || P.steps[P.idx] !== E.st) { camCancelClose(); return; }
    n--;
    if (n > 0) { beep(880, 0.08); camCue("Cierro la serie en " + n + ".", "ok", true); return; }
    camCancelClose(); beep(1320, 0.3, 0.3); camFinishSet();
  }, 1000);
}
function camCancelClose() {
  if (!CAM.closeT) return;
  clearInterval(CAM.closeT); CAM.closeT = null;
  var b = $("cam-keep"); if (b) b.hidden = true;
  camCue("", "");
}
function camFinishSet() {
  var st = P.steps[P.idx]; if (!st || st.type !== "work" || P.done) return;
  pacerStop(); logWork(st, null); enterStep(P.idx + 1);
}
/* Lo que la cámara entrega al registro de la serie */
function camTake(st) {
  var E = CAM.eng; if (!CAM.on || !E || E.st !== st || E.taken || !E.reps) return null;
  E.taken = true; camCancelClose();
  var q = { n: E.reps }, ecc = E.q.map(function (z) { return z.ecc; }), con = E.q.map(function (z) { return z.con; });
  if (ecc.length) { q.e = Math.round(median(ecc) * 10) / 10; q.c = Math.round(median(con) * 10) / 10; }
  if (con.length >= 3) { var c0 = Math.min(con[0], con[1]), cl = con[con.length - 1]; if (c0 > 0 && cl > 0) q.v = Math.max(0, Math.round((1 - c0 / cl) * 100)); }
  var w = {}; for (var k in E.warn) if (k !== "lim0") w[k] = E.warn[k];
  if (Object.keys(w).length) q.w = w;
  return { reps: E.reps, q: q };
}
/* Pantalla de la cámara */
function camState(kind, text) { var el = $("cam-state"); if (!el) return; if (el.textContent !== text) el.textContent = text; el.className = "cam-state " + (kind || ""); }
function camCue(text, kind, sticky) {
  var el = $("cam-cue"); if (!el) return;
  if (CAM.cueT) { clearTimeout(CAM.cueT); CAM.cueT = null; }
  if (!text) { el.hidden = true; return; }
  el.textContent = text; el.className = "cam-cue " + (kind || "warn"); el.hidden = false;
  if (!sticky) CAM.cueT = setTimeout(function () { el.hidden = true; }, 3200);
}
function camRender(E) {
  var r = $("cam-reps"); if (r) r.textContent = E && !E.hold ? String(E.reps) : "";
  var q = E && E.q[E.q.length - 1], last = $("cam-last");
  if (last) last.textContent = q ? "Última: " + E.phN[0].toLowerCase() + " " + q.ecc.toFixed(1) + " s" + (q.far >= 0.2 ? ", pausa " + q.far.toFixed(1) + " s" : "") + ", " + E.phN[2].toLowerCase() + " " + q.con.toFixed(1) + " s" : "";
  var st = P.steps[P.idx], main = $("p-main");
  if (st && E && st === E.st && st.type === "work" && E.reps && !(pacerEligible(st) && !PC.running)) main.textContent = "Hecho · " + E.reps;
}
function camLimitBtn() {
  var b = $("cam-limit"), E = CAM.eng; if (!b) return;
  var show = !!(E && E.cfg.limit); b.hidden = !show; if (!show) return;
  var lim = camLimitOf(E.x.id);
  b.textContent = CAM.limitArm ? "Haz 1 repetición hasta tu caja…" : lim != null ? "Tu límite: " + lim + "°. Volver a marcar" : "Marcar mi profundidad segura";
  b.setAttribute("aria-pressed", CAM.limitArm ? "true" : "false");
}
function camDraw(lm) {
  var c = $("cam-c"); if (!c) return;
  var g = c.getContext && c.getContext("2d"); if (!g) return;
  g.clearRect(0, 0, c.width, c.height);
  if (!lm) return;
  var W = c.width, H = c.height, lw = Math.max(3, W / 150), hot = CAM.eng && CAM.eng.hot;
  g.lineCap = "round"; g.lineWidth = lw;
  BONES.forEach(function (b) {
    var p = lm[b[0]], q = lm[b[1]]; if (!p || !q || (p.visibility != null && p.visibility < 0.4) || (q.visibility != null && q.visibility < 0.4)) return;
    g.strokeStyle = hot && hot[b[0]] && hot[b[1]] ? "rgba(240,80,100,0.95)" : "rgba(255,255,255,0.85)";
    g.beginPath(); g.moveTo(p.x * W, p.y * H); g.lineTo(q.x * W, q.y * H); g.stroke();
  });
  g.fillStyle = "rgba(127,178,240,0.95)";
  [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(function (i) { var p = lm[i]; if (!p || (p.visibility != null && p.visibility < 0.4)) return; g.beginPath(); g.arc(p.x * W, p.y * H, lw * 1.3, 0, 6.2832); g.fill(); });
}
function camSize() {
  var v = $("cam-v"), c = $("cam-c"), st = $("cam-stage"); if (!v || !c || !st) return;
  var W = v.videoWidth || 640, H = v.videoHeight || 480;
  CAM.W = W; CAM.H = H; c.width = W; c.height = H;
  st.style.aspectRatio = W + " / " + H;
  st.style.maxWidth = "calc(52vh * " + (W / H).toFixed(4) + ")";
}
function camLoad() {
  var model = pref("camModel", "lite");
  if (CAM.lm && CAM.model === model) return Promise.resolve(CAM.lm);
  if (CAM.loading) return CAM.loading;
  var vision;
  CAM.loading = import(MP_BASE + "/vision_bundle.mjs").then(function (mod) {
    vision = mod; return mod.FilesetResolver.forVisionTasks(MP_BASE + "/wasm");
  }).then(function (fs) {
    function make(dg) { return vision.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MP_MODEL[model] || MP_MODEL.lite, delegate: dg }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 }); }
    return make(pref("camCPU", false) ? "CPU" : "GPU").catch(function () { return make("CPU"); });
  }).then(function (lm) {
    if (CAM.lm && CAM.lm !== lm) { try { CAM.lm.close(); } catch (e) {} }
    CAM.lm = lm; CAM.model = model; CAM.loading = null; return lm;
  }, function (e) { CAM.loading = null; throw e; });
  return CAM.loading;
}
function camErrText(e) {
  var n = e && e.name;
  if (n === "NotAllowedError") return "Diste «no» al permiso de cámara. Actívalo en los ajustes del sitio y vuelve a tocar Cámara.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No encontré una cámara en este equipo.";
  if (n === "NotReadableError") return "Otra app está usando la cámara. Ciérrala y vuelve a intentar.";
  if (!CAM.lm && navigator.onLine === false) return "La primera vez necesito internet para bajar el detector de postura (unos 20 MB). Después funciona sin internet.";
  return "No pude iniciar la cámara (" + (e && e.message ? e.message : String(e)) + ").";
}
function camStart() {
  var box = $("cam"); if (!box) return;
  CAM.on = true; CAM.err = ""; setPref("cam", true);
  if (ST.prefs.voice == null) setPref("voice", true);
  setToolBtns();
  box.hidden = false;
  if (!camSupported()) CAM.err = "Aquí no puedo usar la cámara. Abre la app desde tu página de GitHub (https) en Chrome.";
  camOnStep(true);
  if (CAM.err) return;
  var facingMode = CAM.facing || pref("camFacing", "user"); CAM.facing = facingMode;
  box.classList.toggle("mirror", facingMode === "user");
  var v = $("cam-v");
  var gs = navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
  Promise.all([gs, camLoad()]).then(function (r) {
    if (!CAM.on) { r[0].getTracks().forEach(function (tk) { tk.stop(); }); return; }
    if (CAM.stream) CAM.stream.getTracks().forEach(function (tk) { tk.stop(); });
    CAM.stream = r[0]; v.muted = true; v.setAttribute("playsinline", ""); v.srcObject = CAM.stream;
    return v.play().then(function () {
      camSize(); camState("warn", "Ponte en posición");
      cancelAnimationFrame(CAM.raf); CAM.raf = requestAnimationFrame(camLoop);
      camOnStep(true);
    });
  }).catch(function (e) { CAM.err = camErrText(e); camState("bad", CAM.err); camOnStep(true); });
}
function camStop(keepPref) {
  CAM.on = false; CAM.active = false; cancelAnimationFrame(CAM.raf); CAM.raf = 0; camCancelClose();
  if (!keepPref) setPref("cam", false);
  if (CAM.stream) { CAM.stream.getTracks().forEach(function (tk) { tk.stop(); }); CAM.stream = null; }
  var v = $("cam-v"); if (v) v.srcObject = null;
  var box = $("cam"); if (box) box.hidden = true;
  var pb = $("p-body"); if (pb) pb.classList.remove("has-cam");
  CAM.eng = null; setToolBtns();
}
function camLoop() {
  if (!CAM.on) return;
  CAM.raf = requestAnimationFrame(camLoop);
  var v = $("cam-v");
  if (!CAM.lm || !v || v.readyState < 2 || v.paused) return;
  if (v.videoWidth && (v.videoWidth !== CAM.W || v.videoHeight !== CAM.H)) camSize();
  var gw = gestWanted();
  if ((!CAM.active && !gw) || P.paused) return;
  var now = performance.now();
  if (!CAM.active && now - (CAM.lastProc || 0) < 140) return;
  if (v.currentTime === CAM.lastVT && now - (CAM.lastProc || 0) < 100) return;
  CAM.lastVT = v.currentTime; CAM.lastProc = now;
  var ts = Math.max(Math.round(now), CAM.lastTs + 1), res = null;
  CAM.lastTs = ts;
  try { res = CAM.lm.detectForVideo(v, ts); CAM.detErr = 0; }
  catch (e) {
    CAM.detErr = (CAM.detErr || 0) + 1;
    if (CAM.detErr > 30 && !CAM.loading) { CAM.detErr = 0; setPref("camCPU", true); CAM.model = null; camLoad().catch(function () {}); }
    return;
  }
  var lm = res && res.landmarks && res.landmarks[0];
  camDraw(lm);
  var Pz = lm ? camPose(lm, CAM.W, CAM.H) : null;
  if (CAM.eng && CAM.active) coachFrame(CAM.eng, Pz, now / 1000);
  if (gw) gestFrame(Pz, now / 1000);
}
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || !CAM.on) return;
  var v = $("cam-v"); if (v && v.paused && v.srcObject) { try { v.play().catch(function () {}); } catch (e) {} }
});
/* Se llama al entrar a cada paso de la sesión */
function camOnStep(force) {
  var box = $("cam"), pb = $("p-body"); if (!box || !pb) return;
  if (!CAM.on) { box.hidden = true; pb.classList.remove("has-cam"); return; }
  var st = P.steps[P.idx], cfg = st && st.ex && (st.type === "work" || st.type === "hold") ? camCfg(st.ex) : null;
  if (P.done) { camStop(true); return; }
  box.hidden = false; pb.classList.add("has-cam");
  if (!cfg) {
    CAM.active = false; CAM.eng = null; camDraw(null); camRender(null); camLimitBtn();
    var gs = !!pref("camGest", true) && !CAM.err;
    box.classList.add("idle"); box.classList.toggle("gest", gs);
    $("cam-tip").textContent = (st && st.ex && (st.type === "work" || st.type === "hold") ? "Este ejercicio no lo sigo con cámara: registra a mano." : "La cámara descansa; vuelve en el próximo ejercicio.") + (gs ? " Manos arriba 1 segundo = «Hecho»." : "");
    camState(CAM.err ? "bad" : "", CAM.err || "En pausa"); camCue("", "");
    return;
  }
  box.classList.remove("idle", "gest");
  if (force || !CAM.eng || CAM.eng.st !== st) { camCancelClose(); CAM.eng = camNewEng(st, cfg); camCue("", ""); }
  CAM.active = true;
  var tip = CAM_VIEW[cfg.view] + (cfg.tip ? " " + cfg.tip : "");
  if (cfg.limit) tip += " Para el límite de rodilla, usa siempre el mismo lugar del celular.";
  $("cam-tip").textContent = tip;
  camRender(CAM.eng); camLimitBtn();
  if (CAM.err) camState("bad", CAM.err);
  else if (!CAM.lm) camState("warn", "Cargando la cámara…"); else if (CAM.eng.state === "arm" && !CAM.eng.hold) camState("warn", "Quieto en la posición inicial…");
}
function camSnapshot() {
  var v = $("cam-v"); if (!v || !v.videoWidth || !CAM.on) return null;
  var W = v.videoWidth, H = v.videoHeight, k = Math.min(1, 640 / Math.max(W, H)), c = document.createElement("canvas");
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  var g = c.getContext("2d"); if (!g) return null;
  g.drawImage(v, 0, 0, c.width, c.height);
  try { g.drawImage($("cam-c"), 0, 0, c.width, c.height); } catch (e) {}
  return c.toDataURL("image/jpeg", 0.72);
}
function camSummaryHTML() {
  var by = {}, order = [];
  P.log.forEach(function (e) {
    if (!e.q || e.skip) return;
    if (!by[e.x]) { by[e.x] = { n: 0, ecc: [], w: {} }; order.push(e.x); }
    var b = by[e.x]; b.n++; if (e.q.e != null) b.ecc.push(e.q.e);
    for (var k in (e.q.w || {})) b.w[k] = (b.w[k] || 0) + e.q.w[k];
  });
  if (!order.length) return "";
  return '<h3 class="mini">Lo que vio la cámara</h3><ul class="plain cam-sum">' + order.map(function (id) {
    var b = by[id], ex = EX[id] || {}, parts = [b.n + (b.n === 1 ? " serie contada" : " series contadas")];
    var tp = tempoParts(ex.tempo || ""); var x = null; P.plan.steps.forEach(function (s) { if (!x && s.ex && s.ex.id === id) x = s.ex; });
    if (x) tp = tempoParts(x.tempo);
    if (b.ecc.length) parts.push(((x && x.phNames) || PH.squat)[0].toLowerCase() + " en " + median(b.ecc).toFixed(1) + " s" + (tp && tp[0] && tp[0].s ? " (pedías " + tp[0].s + " s; la cámara mide un poco menos)" : ""));
    var top = null; for (var k in b.w) if (!top || b.w[k] > b.w[top]) top = k;
    if (top) parts.push(b.w[top] + " aviso" + (b.w[top] > 1 ? "s" : "") + " de " + (WARN_TXT[top] || top));
    return "<li><b>" + esc(ex.name || id) + ".</b> " + esc(parts.join(", ")) + "</li>";
  }).join("") + "</ul>";
}

/* (La voz de la cámara usa say(), en «Audio, voz y pantalla».) */

/* ===================== 3. Dudas: ficha sin internet + IA opcional ===================== */
var ASK = { x: null, ctrl: null, rec: null, listening: false, hist: [] };
var ASK_CHIPS = [["como", "¿Cómo se hace?"], ["error", "Errores comunes"], ["peso", "¿Qué peso uso?"], ["resp", "¿Cómo respiro?"], ["dolor", "Me molesta algo"], ["facil", "Más fácil"], ["dificil", "Más difícil"], ["camara", "¿Dónde pongo el celular?"]];
var ASK_RULES = [
  { k: "dolor", re: /(duele|dolor|molest|lastim|rodilla|crujid|chasquid|hueso|punzad|pincha)/ },
  { k: "peso", re: /(peso|kilo|\bkg\b|mancuern|disco|carga|principal|antigua|vinilo|consolidad|mochila)/ },
  { k: "resp", re: /(respir|aire|inhal|exhal)/ },
  { k: "error", re: /(error|mal|evit|incorrect|equivoc|cuidado)/ },
  { k: "camara", re: /(camara|celular|telefono|donde pongo|vista|angulo)/ },
  { k: "tempo", re: /(tempo|lento|rapido|segundos|ritmo|velocidad)/ },
  { k: "rir", re: /(\brir\b|reserva|fallo|cuantas me quedan)/ },
  { k: "descanso", re: /(descans|recuper|pausa entre)/ },
  { k: "facil", re: /(facil|no puedo|no llego|no me sale|cuesta mucho|regresion|mas suave)/ },
  { k: "dificil", re: /(dificil|mas duro|progres|subir de|avanz|siguiente nivel|peldano)/ },
  { k: "porque", re: /(por que|para que|sirve|musculo|trabaja|beneficio)/ },
  { k: "como", re: /(como|posicion|hacer|coloc|pongo|empiez|tecnica|pasos|se hace|ejecut)/ }
];
var EX_ALIAS = {
  remo1m: ["remo a una mano", "remo en tripode", "remo con una mano", "remo unilateral", "remo pesado"], arquero: ["arquero", "flexiones arquero", "flexion arquero"],
  pike: ["pike", "flexiones pike", "paik", "pino"], facepull: ["face pull", "facepull", "face pool", "feis pul", "jalon a la cara"],
  pressinc: ["press inclinado", "press de pecho", "press en la mochila", "press sobre la mochila", "press sobre mochila"], pullover: ["pullover", "pull over", "pulover"],
  latinc: ["lateral inclinada", "elevacion lateral inclinada", "laterales inclinadas", "lateral en el marco", "lateral inclinado"],
  curlbay: ["bayesiano", "curl bayesiano", "bayesian"], triover: ["triceps sobre la cabeza", "triceps por encima de la cabeza", "extension sobre la cabeza", "triceps con una mancuerna"],
  planchaesc: ["plancha con retraccion", "plancha escapular", "plancha con escapulas", "plancha frontal"], bichomuerto: ["bicho muerto", "dead bug", "insecto muerto"],
  trote: ["trote", "trote lento", "niko niko", "trotar"],
  splitsq: ["split squat", "split", "sentadilla dividida", "sentadilla bulgara", "bulgara", "zancada estatica", "estocada"],
  rdl1p: ["peso muerto a una pierna", "rumano a una pierna", "peso muerto unilateral", "peso muerto con una pierna"],
  curlfem: ["curl femoral", "femoral", "curl deslizante", "curl de isquios"], extrod: ["extension de rodilla", "extension de cuadriceps", "extensiones de rodilla"],
  stepdown: ["step down", "step-down", "stepdown", "bajada del escalon", "bajar escalon", "bajadas de escalon", "bajar del escalon"],
  hipthrust: ["hip thrust", "hipthrust", "puente de gluteo", "empuje de cadera"], talonpie: ["talones", "pantorrilla", "pantorrillas", "gemelos", "elevacion de talones", "elevaciones de talon"],
  copen: ["copenhagen", "copenhague", "copenhaguen", "aductores"], flexexp: ["flexiones explosivas", "explosivas", "flexion explosiva", "flexiones con palmada"],
  remoexp: ["remo explosivo", "remo con liga explosivo"], arnold: ["arnold", "press arnold"], remosup: ["remo supino", "remo con palmas arriba"],
  deficit: ["deficit", "flexiones en deficit", "flexiones con libros"], jalon: ["jalon", "jalon con liga", "jalon al pecho", "pulldown"],
  latpie: ["elevacion lateral de pie", "laterales de pie", "elevaciones laterales de pie", "lateral de pie"], martillo: ["martillo", "curl martillo"],
  frances: ["frances", "press frances", "rompecraneos", "rompe craneos"], yraise: ["elevacion en y", "y raise", "elevaciones en y", "vuelos en y"],
  planchalat: ["plancha lateral", "plancha de lado", "plancha de costado"], rdl2p: ["peso muerto rumano", "rumano", "peso muerto del sabado", "peso muerto con las dos"],
  goblet: ["goblet", "sentadilla goblet", "sentadilla copa", "sentadilla con mancuerna"], pressmil: ["press militar", "militar", "press de hombro", "press por encima de la cabeza", "press de pie"],
  maleta: ["maleta", "caminata de maleta", "caminata con maleta", "suitcase"], farmer: ["farmer", "granjero", "caminata del granjero", "cargada final", "cargada"]
};
function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim(); }
function exEntry(id) {
  if (P.active && P.plan) { var hit = null; P.steps.forEach(function (s) { if (!hit && s.ex && s.ex.id === id) hit = s.ex; }); if (hit) return hit; }
  for (var k in DAYS) {
    var D = DAYS[k]; if (!D.blocks) continue;
    for (var i = 0; i < D.blocks.length; i++) { var b = D.blocks[i]; if (!b.ex) continue; for (var j = 0; j < b.ex.length; j++) if (b.ex[j].id === id) return resolve(b.ex[j]); }
  }
  return EX[id] ? resolve({ id: id }) : null;
}
function askFindEx(q) { var m = exMatch(norm(q), askCurrentEx()); return m ? exEntry(m.id) : null; }
function askCurrentEx() {
  if (P.active && !P.done) { var st = P.steps[P.idx]; if (st && st.ex) return st.ex; var nx = nextWork(P.idx); if (nx && nx.ex) return nx.ex; }
  return null;
}
function tempoSpoken(x) {
  var p = tempoParts(x.tempo); if (!p) return x.tempo ? "Ritmo: " + x.tempo + "." : "";
  var names = x.phNames || PH.squat, order = x.start === "bottom" ? [2, 3, 0, 1] : [0, 1, 2, 3], out = [];
  order.forEach(function (i) { var q = p[i]; if (q.x) out.push(names[i] + " lo más rápido posible con control"); else if (q.s) out.push(names[i] + " " + q.s + " s"); });
  return "Tempo " + x.tempo + ": " + out.join(", ") + ".";
}
/* askAnswer y el motor de respuestas están en «Versión 3» (más abajo). */
function askLocal(q, x, intent) { var r = askEngine(q, { x: x, intent: intent }); return { html: r.html, say: r.say, found: r.found }; }
function askOpen(x) {
  ASK.x = x || askCurrentEx();
  $("ask").hidden = false;
  $("ask-title").textContent = ASK.x ? "Dudas: " + ASK.x.name : "Dudas sobre tus ejercicios";
  askChips();
  var nb = $("ask-new"); if (nb) nb.hidden = !(aiReady() && ASK.hist.length);
  if (!$("ask-out").innerHTML) $("ask-out").innerHTML = '<p class="muted">Pregunta con tus palabras o toca un botón. ' + (aiReady() ? "Respondo con tu ficha y tu IA (" + esc(aiName()) + ") completa la respuesta." : "Respondo con tu ficha, sin internet.") + "</p>";
  $("ask-snap").hidden = !(CAM.on && aiReady() && pref("aiVision", false));
  talkPaint();
  setTimeout(function () { try { $("ask-in").focus(); } catch (e) {} }, 60);
}
function askClose() { $("ask").hidden = true; askStopMic(); if (ASK.ctrl && !TALK.on) { try { ASK.ctrl.abort(); } catch (e) {} ASK.ctrl = null; } talkPaint(); updMaybe(); }
function askPush(qText, html) {
  var out = $("ask-out"), box = document.createElement("div");
  box.className = "ask-a"; box.innerHTML = '<p class="ask-q">' + esc(qText) + "</p>" + html;
  if (out.firstChild && out.firstChild.classList && out.firstChild.classList.contains("muted")) out.innerHTML = "";
  out.insertBefore(box, out.firstChild);
  return box;
}
function askRun(q, intent) {
  q = String(q || "").trim(); if (!q) return;
  var mt = !intent ? memIntent(q) : null;
  if (mt) { memAdd(mt); askPush(q, "<p>Anotado: lo tendré en cuenta al responderte. Lo ves en «Progreso» → «Lo que la IA recuerda».</p>"); say("Anotado.", true); return; }
  var r = askEngine(q, { x: ASK.x, intent: intent });
  if (r.x && (!ASK.x || r.x.id !== ASK.x.id)) { ASK.x = r.x; $("ask-title").textContent = "Dudas: " + r.x.name; askChips(); }
  var box = askPush(q, r.html + '<span class="src">De tu ficha, sin internet</span>');
  if (aiReady() && !intent) askAI(q, r.x || ASK.x, null, box, "chat").then(function (c) { if (!c) say(r.say, true); }); else say(r.say, true);
}
function askSubmit() { var i = $("ask-in"), q = i.value; i.value = ""; askRun(q, null); }
function askNote(t) { var out = $("ask-out"), p = document.createElement("p"); p.className = "ask-note"; p.textContent = t; out.insertBefore(p, out.firstChild); }
function askMic() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { askNote("Este navegador no tiene dictado. Escribe la pregunta."); return; }
  if (ASK.listening) { askStopMic(); return; }
  var wasHF = !!(HF.rec || HF.want); hfHold(true);
  var r = new SR(), fin = ""; ASK.rec = r;
  r.lang = pref("asrLang", "es-PE"); r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
  if (pref("asrLocal", false)) { try { r.processLocally = true; } catch (e) {} }
  r.onresult = function (ev) { var tmp = ""; for (var i = ev.resultIndex; i < ev.results.length; i++) { if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; else tmp += ev.results[i][0].transcript; } $("ask-in").value = (fin + " " + tmp).trim(); };
  r.onerror = function (ev) {
    var m = ev.error === "not-allowed" ? "Diste «no» al micrófono: actívalo en los ajustes del sitio." : ev.error === "network" ? "El dictado de este equipo necesita internet. En Ajustes puedes revisar si hay dictado sin internet." : ev.error === "language-not-supported" ? "Falta el paquete de español para dictar sin internet. Instálalo en Ajustes." : ev.error === "no-speech" ? "No te escuché. Toca Hablar y pregunta de nuevo." : "El dictado falló (" + ev.error + ").";
    askNote(m);
  };
  r.onend = function () { ASK.listening = false; var b = $("ask-mic"); b.setAttribute("aria-pressed", "false"); b.textContent = "Hablar"; hfHold(false); if (fin.trim()) askSubmit(); };
  function go() { try { r.start(); ASK.listening = true; var b2 = $("ask-mic"); b2.setAttribute("aria-pressed", "true"); b2.textContent = "Escuchando…"; } catch (e) { hfHold(false); askNote("No pude abrir el micrófono."); } }
  if (wasHF) setTimeout(go, 350); else go();
}
function askStopMic() { if (ASK.rec && ASK.listening) { try { ASK.rec.stop(); } catch (e) {} } ASK.listening = false; }

/* IA opcional: Ollama, Gemini, IA de Chrome u otro servidor (el resto está en «Versión 3») */
function exFicha(x) {
  if (!x) return null;
  return { nombre: x.name, musculos: x.muscles, posicion: x.setup, pasos: x.steps, respiracion: x.breath, claves: x.cues, errores: x.errors, seguridad: x.safety, alternativa: x.alt,
    hoy: { series: x.sets, repeticiones: x.reps || null, segundos: x.hold || null, tempo: x.tempo || null, rir: x.rir || null, descanso_s: x.rest, carga: effLoadText(x) || null, peldano: x.rungText || null } };
}
function askSnap() {
  var img = camSnapshot(); if (!img) { askNote("Prende la cámara para mandar una foto."); return; }
  var E = CAM.eng, x = ASK.x || (E && E.x), last = E && E.q[E.q.length - 1];
  var q = "Estoy haciendo " + (x ? x.name : "un ejercicio") + ". Mira la foto (el esqueleto lo dibujó la cámara). ¿Qué corrijo?" + (last ? " La cámara midió en la última repetición: fase lenta " + last.ecc.toFixed(1) + " s, fase rápida " + last.con.toFixed(1) + " s." : "");
  var box = askPush("Foto: ¿lo hago bien?", '<img class="ask-img" alt="Tu foto con el esqueleto" src="' + img + '">');
  askAI(q, x, img, box, "chat");
}
function asrCheck(install) {
  var out = $("asr-out"), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { if (out) out.textContent = "Este navegador no tiene dictado. Las dudas se escriben."; return; }
  var langs = ["es-US", "es-ES", "es-MX"];
  if (typeof SR.available !== "function") { if (out) out.textContent = "Hay dictado, pero este navegador no avisa si funciona sin internet: lo normal es que use internet."; return; }
  var i = 0;
  (function next() {
    if (i >= langs.length) { if (out) out.textContent = "No hay paquete de español para dictar sin internet en este navegador. El dictado usará internet."; return; }
    var lg = langs[i++];
    Promise.resolve(SR.available({ langs: [lg], processLocally: true })).then(function (st) {
      if (st === "available") { setPref("asrLocal", true); setPref("asrLang", lg); if (out) out.textContent = "Listo: dictado sin internet en español (" + lg + ")."; return; }
      if (st === "downloadable" || st === "downloading") {
        if (!install) { if (out) out.innerHTML = 'Se puede instalar el español para dictar sin internet (unos 60 MB). <button class="mini-btn" data-act="asrinstall" type="button">Instalar</button>'; setPref("asrLang", lg); return; }
        if (out) out.textContent = "Instalando… deja la página abierta.";
        return Promise.resolve(SR.install({ langs: [lg], processLocally: true })).then(function (okk) { if (okk) { setPref("asrLocal", true); if (out) out.textContent = "Instalado: dictado sin internet en español."; } else if (out) out.textContent = "No se pudo instalar. El dictado usará internet."; });
      }
      next();
    }).catch(function () { next(); });
  })();
}

/* ===================== 4. App instalable, descargas y respaldo ===================== */
var INSTALL = null;
window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); INSTALL = e; var b = $("inst"); if (b) b.hidden = false; });
window.addEventListener("appinstalled", function () { INSTALL = null; var b = $("inst"); if (b) b.hidden = true; });
function doInstall() {
  if (!INSTALL) { alert("Para instalarla: en Chrome toca ⋮ y luego «Instalar app» o «Agregar a la pantalla principal»."); return; }
  INSTALL.prompt(); INSTALL.userChoice.then(function () { INSTALL = null; var b = $("inst"); if (b) b.hidden = true; });
}
/* (registro de la versión 3; la versión 4 usa swRegister con actualización sola) */
function swRegisterV3() {
  if (window.claude || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(function () {});
}
function downloadText(name, text, mime) {
  try {
    var blob = new Blob([text], { type: mime || "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  } catch (e) { return false; }
}
function shareBackup() {
  var text = JSON.stringify({ app: "sistema-3", version: 2, exportedAt: new Date().toISOString(), recs: ST.recs }, null, 1), name = "sistema3-historial-" + TODAY() + ".json", out = document.querySelector(".io-out");
  try {
    var f = new File([text], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: "Respaldo " + APPN + "" }).catch(function () {}); return; }
  } catch (e) {}
  if (out) out.textContent = "Tu equipo no deja compartir archivos desde aquí: usa Exportar.";
}
function importFile(input) {
  var f = input.files && input.files[0]; if (!f) return;
  var rd = new FileReader();
  rd.onload = function () { var ta = $("io"); if (ta) { ta.value = String(rd.result || ""); importData(); } input.value = ""; };
  rd.readAsText(f);
}
function camPrep() {
  var out = $("cam-prep-out"); if (out) out.textContent = "Descargando el detector de postura…";
  camLoad().then(function () { if (out) out.textContent = "Listo: la cámara ya funciona sin internet en este equipo."; }).catch(function (e) { if (out) out.textContent = "No se pudo: " + ((e && e.message) || e) + ". Necesitas internet esta vez."; });
}
function camSettingsRows() {
  var md = pref("camModel", "lite"), fc = pref("camFacing", "user");
  return toggleRow("cam", "Cámara en la sesión guiada: cuenta, mide el tempo y corrige", pref("cam", false)) +
    toggleRow("camAuto", "Cerrar la serie sola cuando paras (con 3 s para seguir)", pref("camAuto", true)) +
    toggleRow("camCount", "Decir en voz alta el número de cada repetición", pref("camCount", true)) +
    '<div class="set-row"><span>Detector de postura</span><div class="opts">' + [["lite", "Rápido"], ["full", "Preciso"]].map(function (o) { return '<button class="opt-btn' + (md === o[0] ? " on" : "") + '" data-act="cammodel" data-v="' + o[0] + '" type="button">' + o[1] + "</button>"; }).join("") + "</div></div>" +
    '<div class="set-row"><span>Cámara que uso</span><div class="opts">' + [["user", "Frontal"], ["environment", "Trasera"]].map(function (o) { return '<button class="opt-btn' + (fc === o[0] ? " on" : "") + '" data-act="camfacing" data-v="' + o[0] + '" type="button">' + o[1] + "</button>"; }).join("") + "</div></div>" +
    '<div class="set-row"><span>Preparar la cámara para usarla sin internet</span><div class="opts"><button class="opt-btn" data-act="camprep" type="button">Preparar</button></div></div><p class="muted" id="cam-prep-out" aria-live="polite"></p>' +
    (Object.keys(camLimits()).length ? '<div class="set-row"><span>Límites de rodilla guardados: ' + esc(Object.keys(camLimits()).map(function (k) { return (EX[k] || {}).name + " " + camLimits()[k] + "°"; }).join(", ")) + '</span><div class="opts"><button class="opt-btn" data-act="camlimreset" type="button">Borrar</button></div></div>' : "");
}
window.S3dbg = { eqParse: eqParse, eqSolve: eqSolve, eqLayout: eqLayout, eqApply: eqApply, eqStart: eqStart, eqInv: eqInv, effLoadText: effLoadText, eqStateBefore: eqStateBefore, eqPrepAt: eqPrepAt, eqRest: eqRest,
  camNewEng: camNewEng, coachFrame: coachFrame, camPose: camPose, CAMX: CAMX, CHK: CHK, lineDev: lineDev, askLocal: askLocal, askFindEx: askFindEx, exEntry: exEntry, planFor: planFor, DAYS: DAYS, P: P, CAM: CAM, resolve: resolve };

document.addEventListener("click", function (e) {
  var t = e.target.closest("[data-a]");
  if (!t) { if (e.target === $("ask")) askClose(); return; }
  var a = t.getAttribute("data-a");
  if (a === "close") askClose();
  else if (a === "send") askSubmit();
  else if (a === "mic") askMic();
  else if (a === "snap") askSnap();
  else if (a === "new") { chatNew(); $("ask-out").innerHTML = ""; askOpen(ASK.x); }
  else if (a === "chip") { var k = t.getAttribute("data-k"), lab = t.textContent; if (ASK.x) { var r = askLocal(lab, ASK.x, k); askPush(lab, r.html + '<span class="src">De tu ficha, sin internet</span>'); say(r.say, true); } }
});
document.addEventListener("keydown", function (e) {
  if ($("ask").hidden) return;
  if (e.key === "Escape") { e.preventDefault(); askClose(); }
  else if (e.target && e.target.id === "ask-in" && e.key === "Enter") { e.preventDefault(); askSubmit(); }
});

/* =====================================================================
   VERSIÓN 3
   1. Ajustes con valores por defecto claros.
   2. Pantalla de sesión: carga compacta, detalles plegables, registro corto.
   3. Manos libres: comandos de voz, gesto con la cámara, calentamiento que avanza solo.
   4. Comentario de cada serie (sin internet) y, si quieres, de la IA.
   5. Respuestas sin internet mucho más completas.
   6. IA: Ollama, Gemini gratis, IA de Chrome u otro servidor, con memoria corta.
   7. Fases y puertas del plan, pruebas cada 3 meses y fotos del mes.
   ===================================================================== */

/* ---------- 1. Ajustes ---------- */
var PREF_DEF = { logsets: true, camAuto: true, camCount: true, voice: true, tempoWords: true, camGest: true, aiSpeak: true, demo: true, prepScreen: true, sideAuto: true, side2End: true, flujo: true, topeFin: true, flujoFin: true, demoAnim: true };
function autoItemsOn() { var v = pref("autoItems", null); return v == null ? (flowOn() || !!pref("hf", false)) : !!v; }
function prefVal(k) { return k === "autoItems" ? autoItemsOn() : !!pref(k, !!PREF_DEF[k]); }
function prefToggle(k) {
  if (k === "asst") { var on = !asstOn(); setPref("asst", on); setPref("hf", on); if (P.active) asstSync(true); return; }
  setPref(k, !prefVal(k));
  if (k === "hf" && pref("hf", false) && !voiceOn()) setPref("voice", true);
  if (k === "hf" || k === "voice") hfSync();
  if (P.active) {
    setToolBtns();
    if (k === "autoItems" || k === "hf") { var st = P.steps[P.idx]; if (st && st.type === "item" && !P.done) enterStep(P.idx, false); }
  }
}
function optRow(label, act, opts, cur) {
  return '<div class="set-row"><span>' + esc(label) + '</span><div class="opts">' + opts.map(function (o) { return '<button class="opt-btn' + (String(cur) === o[0] ? " on" : "") + '" data-act="' + act + '" data-v="' + o[0] + '" type="button">' + o[1] + "</button>"; }).join("") + "</div></div>";
}

/* ---------- 2. Pantalla de sesión ---------- */
function moreOpen() { var v = pref("moreOpen", null); return v == null ? false : !!v; }
function lvlChip(x) { return x && x.rungs > 1 ? ' <span class="lvl-chip">Nivel ' + (Math.min(x.rung || 0, x.rungs - 1) + 1) + "/" + x.rungs + "</span>" : ""; }
function metaLine(x) {
  var parts = [];
  if (x.tempo) parts.push((tempoParts(x.tempo) ? "Tempo " : "Ritmo ") + x.tempo);
  var rir = P.plan && P.plan.opts && P.plan.opts.deload ? "3-4" : x.rir;
  if (rir) parts.push(/^\d/.test(rir) ? "RIR " + rir : rir);
  return parts.length ? '<span class="p-meta">' + esc(parts.join(" · ")) + "</span>" : "";
}
/* Carga en una línea: solo el chip, sin dibujo (el dibujo queda en «Detalles» y en el descanso) */
function eqChipHTML(text) {
  var spec = eqParse(text);
  if (!spec) return /peso corporal/i.test(String(text || "")) ? "" : '<span class="eq eq-compact"><span class="eq-sub">' + esc(text) + "</span></span>";
  var inv = eqInv(), h = '<span class="eq eq-compact"><span class="eq-row">';
  if (spec.kind) {
    var lay = eqLayout(spec, inv), mark = spec.kind === "par" ? "2" : spec.kind === "una" ? "1" : spec.kind === "antigua" ? "A" : "V";
    h += '<span class="eq-chip eq-' + spec.kind + '"><span class="eq-dot" aria-hidden="true">' + mark + "</span>" + esc(eqName(spec, lay, inv)) + "</span>";
    if (!lay.ok) h += '<span class="eq-miss">' + esc(eqMissText(lay)) + "</span>";
  }
  if (spec.moch != null) h += '<span class="eq-chip eq-moch"><span class="eq-dot" aria-hidden="true">M</span>' + esc(spec.moch ? "Mochila " + kgTxt(spec.moch) + " kg" : "Mochila puesta") + "</span>";
  h += "</span>";
  var rest = eqRest(text); if (rest) h += '<span class="eq-sub">' + esc(rest) + "</span>";
  return h + "</span>";
}
function cuesShort(x) { var c = (x.cues || []).slice(0, 2); return c.length ? '<ul class="p-keycues">' + c.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : ""; }
function cuesMore(x) { var c = (x.cues || []).slice(2); if (x.breath) c.push(x.breath); return c.length ? '<ul class="p-cues">' + c.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : ""; }
function upNextHTML(n) {
  if (n && n.ex) {
    var lt = effLoadText(n.ex), bits = [setDose(n.ex) + (n.ex.side ? " por lado" : "")];
    if (n.side) bits.push("lado " + n.side);
    if (n.ex.rungs > 1) bits.push("nivel " + (Math.min(n.ex.rung || 0, n.ex.rungs - 1) + 1) + " de " + n.ex.rungs);
    var dm = pref("demo", true) !== false ? demoHTML(n.ex, false) : "", setup = String(n.ex.setup || "").split(". ")[0];
    if (setup && !/\.$/.test(setup)) setup += ".";
    if (setup.length > 110) setup = setup.slice(0, 106).replace(/\s+\S*$/, "") + "…";
    return '<div class="p-upnext' + (dm ? " has-demo" : "") + '"><div class="un-txt"><span class="k">Sigue</span><b>' + esc(n.ex.code + ". " + n.ex.name) + "</b><span>" + esc(bits.join(" · ")) + "</span>" + (lt && eqParse(lt) ? eqChipHTML(lt) : "") +
      (setup ? '<p class="un-setup">' + esc(setup) + "</p>" : "") + "</div>" + (dm ? '<div class="un-demo">' + dm + "</div>" : "") + "</div>";
  }
  return n ? '<div class="p-upnext"><span class="k">Sigue</span><b>' + esc(n.item ? n.item.name : stepLabel(n)) + "</b></div>" : "";
}
function lastWorkIs(e) {
  for (var j = P.idx - 1; j >= 0; j--) { var s = P.steps[j]; if (s && (s.type === "work" || s.type === "hold")) return s.ex.id === e.x && s.round === e.s && (s.side || 0) === (e.side || 0); }
  return false;
}
function logLineHTML(e) {
  var isT = e.t != null;
  return '<div class="lg-line"><span>' + esc(e.code) + " · serie " + e.s + (e.side ? " · lado " + e.side : "") + ": <b>" + (isT ? e.t + " s" : e.r) + "</b>" + (isT ? "" : " rep") +
    (!isT && e.rir != null ? " · RIR " + (e.rir === 4 ? "4+" : e.rir) : "") + (e.auto ? ' <span class="pg-note">sin confirmar</span>' : "") +
    '</span><button class="tbtn act" data-p="lgopen" type="button" aria-expanded="' + !!P.lgOpen + '">' + (P.lgOpen ? "Listo" : "Corregir") + "</button></div>";
}
function logEditorHTML(e, title) {
  var ex = EX[e.x] || {}, isT = e.t != null;
  var h = '<div class="lg-ed">' + (title ? '<p class="lg-name">' + esc(title + ": " + e.code + ". " + (ex.name || "") + (e.side ? ", lado " + e.side : "")) + (e.auto ? ' <span class="pg-note">sin confirmar</span>' : "") + "</p>" : "");
  h += '<div class="lg-row"><span class="lg-l">' + (isT ? "Segundos" : "Repeticiones") + '</span><button class="pbtn sq" data-p="lgminus" type="button" aria-label="Menos">−</button><b class="lg-v">' + (isT ? e.t : e.r) + '</b><button class="pbtn sq" data-p="lgplus" type="button" aria-label="Más">+</button></div>';
  if (!isT) h += '<div class="lg-row"><span class="lg-l">RIR</span>' + [0, 1, 2, 3, 4].map(function (v) { return '<button class="rir' + (e.rir === v ? " on" : "") + '" data-p="rir" data-v="' + v + '" type="button">' + (v === 4 ? "4+" : v) + "</button>"; }).join("") + "</div>";
  return h + "</div>";
}
var FB = { t: null };
function fbShow(text, ms) { var el = $("p-toast"); if (!el || !text) return; el.textContent = text; el.hidden = false; clearTimeout(FB.t); FB.t = setTimeout(fbHide, ms || 8000); }
function fbHide() { var el = $("p-toast"); if (el) el.hidden = true; clearTimeout(FB.t); FB.t = null; }
document.addEventListener("toggle", function (e) { var d = e.target; if (d && d.id === "p-more") setPref("moreOpen", !!d.open); }, true);

/* ---------- 3. Manos libres ---------- */
function secsSpoken(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return m ? m + (m === 1 ? " minuto" : " minutos") + (r ? " y " + r + " segundos" : "") : r + " segundos"; }
function remainingSets() { var o = {}; for (var j = P.idx; j < P.steps.length; j++) { var s = P.steps[j]; if (s.type === "work" || s.type === "hold") o[s.ex.id + "|" + s.round] = 1; } return Object.keys(o).length; }
var HF = { rec: null, want: false, restarts: 0, lastStart: 0, done: {}, confirm: null, err: "", msg: "", msgT: 0, t: null, pt: null, held: false };
var HF_NUM = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, treinta: 30 };
var HF_QUICK = { listo: "go", lista: "go", hecho: "go", siguiente: "go", pausa: "pause", anterior: "prev", silencio: "hush", callate: "hush", basta: "hush", repite: "repeat" };
var HF_HELP = [
  ["«¿Qué preparo?»", "te digo qué discos, liga o mancuerna dejar lista ahora y lo que viene."],
  ["«Listo», «hecho», «siguiente»", "= el botón azul: empezar, terminar o saltar."],
  ["«Pausa» / «sigue»", "detiene y reanuda el tiempo."],
  ["«Anterior»", "vuelve un paso."],
  ["«Más tiempo»", "suma 15 s al descanso."],
  ["«Hice ocho»", "anota las repeticiones; «me quedaban dos» anota el RIR."],
  ["«Repite» / «silencio»", "repite el aviso o calla la voz."],
  ["«¿Qué sigue?», «¿cuánto falta?», «¿cuánto peso?»", "te respondo al toque."],
  ["«Me duele la rodilla»", "te pregunto si corto ese ejercicio."],
  ["Preguntas", "«¿cómo respiro?», «¿por qué el hip thrust?»: respondo con tu ficha o con tu IA."],
  ["«Conversemos»", "abre la conversación por voz con la IA (en tiempo real si tienes clave de Google)."],
  ["«Recuerda que…»", "guarda una nota que la IA tendrá en cuenta, en todos tus equipos."]
];
function hfSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function hfWanted() { return asstOn() && P.active && !P.done && !HF.held && !TALK.on && document.visibilityState !== "hidden"; }
function hfNum(w) { if (/^\d{1,2}$/.test(w)) return +w; return HF_NUM[w] != null ? HF_NUM[w] : null; }
/* Quita muletillas al inicio y al final: «ok listo», «bueno, pausa», «siguiente por favor» */
var HF_FILL = /^(ok|okay|oki|bueno|bien|eh|em|este|a ver|oye|coach|entrenador|entonces|y)\s+(?=\S)/;
function hfClean(n) { var o = String(n || "").trim(), k = 0; while (k++ < 3 && HF_FILL.test(o)) o = o.replace(HF_FILL, ""); return o.replace(/\s+(por favor|porfa|porfavor|ya)$/, ""); }
var RIR_RE = /(?:\brir\b|reserva|me quedaban|me quedan|me quedaron|me quedo|quedaban|quedaron|me sobraban|me sobraron|sobraban|sobraron)\s+(\w+)/;
function hfParse(n) {
  if (!n) return null;
  n = hfClean(n);
  var m, words = n.split(" ").length;
  if (/^(silencio|callate|basta|shh+|para de hablar)\b/.test(n)) return { cmd: "hush" };
  if (/^(conversemos|hablemos|conversa conmigo|quiero conversar|modo conversacion)\b/.test(n)) return { cmd: "talk" };
  if (MEM_RE.test(n)) return { cmd: "mem", q: n };
  if (HF.confirm && Date.now() < HF.confirm.until) {
    if (/^(si|claro|correcto|dale|ok|okay|corta|cortalo)\b/.test(n)) return { cmd: "yes" };
    if (/^(no|falsa alarma|nada|sigo|estoy bien)\b/.test(n)) return { cmd: "no" };
  }
  m = n.match(/\b(?:hice|fueron|salieron|logre|llegue a|son|solo)\s+(\w+)/) || n.match(/^(\w+)\s+(?:repeticiones|reps|repes|veces)\b/);
  if (m) {
    var v = hfNum(m[1]);
    if (v != null && v <= 60) {
      var o = { cmd: "reps", n: v }, mr = n.match(RIR_RE);
      if (mr && hfNum(mr[1]) != null) o.rir = Math.min(4, hfNum(mr[1]));
      else if (/\b(al fallo|a la falla|ninguna mas|no me quedaba ninguna)\b/.test(n)) o.rir = 0;
      return o;
    }
  }
  m = n.match(RIR_RE);
  if (m && hfNum(m[1]) != null) return { cmd: "rir", n: Math.min(4, hfNum(m[1])) };
  if (/\b(llegue al fallo|fue al fallo|al fallo|a la falla|no me quedaba ninguna|ninguna mas)\b/.test(n)) return { cmd: "rir", n: 0 };
  if (/^(listo|lista|hecho|ya|ya esta|ya termine|termine|acabe|siguiente|empezar|empieza|empiezo|comienza|comenzar|dale|vamos|go|start)( ya)?$/.test(n)) return { cmd: "go" };
  if (/^(anterior|atras|regresa|volver|vuelve)$/.test(n)) return { cmd: "prev" };
  if (/^(pausa|para|espera|detente|alto|stop|pausar)( (el tiempo|la sesion|un momento|ahi))?$/.test(n)) return { cmd: "pause" };
  if (/^(sigue|seguir|continua|continuar|reanuda|reanudar|seguimos|continuemos)$/.test(n)) return { cmd: "resume" };
  if (/(mas tiempo|dame mas|15 segundos mas|quince segundos mas|mas descanso|un poco mas)/.test(n)) return { cmd: "more" };
  if (/^(repite|repitelo|repetir|otra vez|que dijiste|no escuche)$/.test(n)) return { cmd: "repeat" };
  if (/(duele la rodilla|dolor de rodilla|molestia de rodilla|molesta la rodilla|me duele rodilla|rodilla me duele|hueso desubicado|chasquido)/.test(n)) return { cmd: "knee" };
  if (/^(que sigue|que viene|y ahora|lo siguiente|que hago ahora)$/.test(n)) return { cmd: "next" };
  if (/^(que preparo|que alisto|que necesito|que equipo necesito|que tengo que preparar|que cambio|que discos pongo ahora)$/.test(n)) return { cmd: "prep" };
  /* Más tolerante: frases cortas que contienen el comando («listo ya está», «eh siguiente», «pausa un rato») */
  if (words <= 4 && /\b(listo|lista|listos|hecho|echo|siguiente|termine|acabe)\b/.test(n) && !/^(que|como|cuando|cuanto|cuantas|por que|porque)\b/.test(n)) return { cmd: "go" };
  if (words <= 3 && /\bpausa\b/.test(n)) return { cmd: "pause" };
  if (words <= 3 && /\b(seguimos|continua|continuamos|reanuda|reanudamos)\b/.test(n)) return { cmd: "resume" };
  if (words <= 2 && P.active && restLike(P.steps[P.idx]) && P.lastLog && !P.lastLog.skip && (m = n.match(/^(\w+)( repeticiones| reps)?$/)) && hfNum(m[1]) != null && hfNum(m[1]) <= 40) return { cmd: "reps", n: hfNum(m[1]) };
  if (/^(cuantas|cuantas son|cuantas repeticiones|cuantas hago|cuanto peso|que peso|cuantos kilos|que carga|que discos)$/.test(n)) return { cmd: "dose" };
  if (/^(cuanto falta|cuanto queda|que tiempo|cuanto tiempo|en que minuto voy|cuanto llevo)$/.test(n)) return { cmd: "time" };
  if (words >= 2 && words <= 25 && /^(como|que|por que|porque|cuando|donde|cuanto|cuanta|cuantas|cuantos|puedo|debo|es normal|explicame|explica|dime|me duele|me molesta|tengo|sirve|para que|cual|cuales)\b/.test(n)) return { cmd: "ask", q: n };
  return null;
}
/* Eco: la app no se obedece a sí misma. Solo se ignoran palabras que la app acaba de decir. */
function hfEcho(n) { return Date.now() < SAY.until + 2500 && n.length > 1 && (" " + norm(SAY.last) + " ").indexOf(" " + n + " ") >= 0; }
function hfResult(ev) {
  for (var i = ev.resultIndex; i < ev.results.length; i++) {
    var res = ev.results[i], key = HF.lastStart + ":" + i;
    if (HF.done[key]) continue;
    var alts = []; for (var a = 0; a < res.length; a++) alts.push(String(res[a].transcript || ""));
    var txt = alts[0] || "", n = norm(txt); if (!n) continue;
    if (!res.isFinal) {
      var q = HF_QUICK[n] ? { cmd: HF_QUICK[n] } : null;
      if (q && (q.cmd === "hush" || !hfEcho(n))) { HF.done[key] = 1; hfMsg("«" + txt.trim() + "»"); hfDo(q, txt); }
      continue;
    }
    HF.done[key] = 1;
    if (hfEcho(n)) continue;
    var cmd = null;
    for (var k = 0; k < alts.length && !cmd; k++) cmd = hfParse(norm(alts[k]));
    if (!cmd && Date.now() < SAY.until + 2500) {
      /* Si hablaste mientras la app hablaba, el texto viene mezclado: vale la última palabra si es un comando */
      var tail = n.split(" ").pop();
      if (HF_QUICK[tail] && !hfEcho(tail)) cmd = { cmd: HF_QUICK[tail] };
    }
    hfMsg("«" + txt.trim() + "»" + (cmd ? "" : " (no es un comando)"));
    if (cmd) hfDo(cmd, txt);
  }
}
function hfStart() {
  if (HF.rec) return;
  if (!hfSupported()) { hfMsg("Este navegador no entiende la voz: usa Chrome. El gesto con la cámara sí funciona."); return; }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, r;
  try { r = new SR(); } catch (e) { hfMsg("No pude usar el micrófono."); return; }
  r.lang = pref("asrLang", "es-PE"); r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
  if (pref("asrLocal", false)) { try { r.processLocally = true; } catch (e) {} }
  HF.rec = r; HF.done = {}; HF.want = true;
  r.onresult = hfResult;
  r.onerror = function (ev) {
    var er = ev && ev.error; HF.err = er || "";
    if (document.visibilityState === "hidden" || er === "aborted" || er === "no-speech") return;
    if (er === "not-allowed" || er === "service-not-allowed" || er === "audio-capture") { HF.want = false; setPref("hf", false); hfMsg(er === "audio-capture" ? "No encontré un micrófono." : "Sin permiso de micrófono: actívalo en los ajustes del sitio."); setToolBtns(); }
    else if (er === "network") hfMsg("Los comandos de voz necesitan internet en este equipo. El gesto con la cámara funciona sin internet.");
    else if (er === "language-not-supported") hfMsg("Falta el español para escuchar sin internet (Ajustes → Dictado).");
  };
  r.onend = function () {
    HF.rec = null;
    if (!HF.want || !hfWanted()) { hfPaint(); return; }
    HF.restarts = Date.now() - HF.lastStart < 1500 ? HF.restarts + 1 : 0;
    var wait = HF.err === "network" ? 5000 : Math.min(6000, 200 * Math.pow(2, HF.restarts));
    HF.err = "";
    clearTimeout(HF.t); HF.t = setTimeout(function () { if (HF.want && hfWanted()) hfStart(); }, wait);
  };
  try { r.start(); HF.lastStart = Date.now(); hfPaint(); } catch (e) { HF.rec = null; hfMsg("No pude abrir el micrófono."); }
}
function hfStop() { HF.want = false; clearTimeout(HF.t); var r = HF.rec; HF.rec = null; if (r) { try { r.onend = null; r.abort(); } catch (e) {} } hfPaint(); }
function hfSync() { if (hfWanted()) { HF.want = true; if (!HF.rec) hfStart(); } else if (HF.rec || HF.want) hfStop(); hfPaint(); }
function hfHold(on) { if (on) { if (HF.rec || HF.want) { HF.held = true; hfStop(); } } else if (HF.held) { HF.held = false; hfSync(); } }
document.addEventListener("visibilitychange", function () { if (P.active) hfSync(); });
function hfMsg(t) { HF.msg = t; HF.msgT = Date.now(); hfPaint(); }
function hfPaint() {
  var b = $("p-hf"); if (b) b.setAttribute("aria-pressed", asstOn());
  asstPaint();
  var el = $("p-hfmsg"); if (!el) return;
  var fresh = !!HF.msg && Date.now() - HF.msgT < 4500;
  var idle = asstOn() && P.active && !P.done ? (HF.want ? "Asistente: te escucho · «listo», «pausa», «hice 8», «¿qué preparo?»…" : TALK.on ? "" : "") : "";
  var txt = fresh ? HF.msg : idle;
  el.textContent = txt; el.hidden = !txt; el.classList.toggle("heard", fresh);
  clearTimeout(HF.pt); if (fresh) HF.pt = setTimeout(hfPaint, 4600);
}
function hfDo(c, raw) {
  if (!P.active || !c) return;
  var st = P.steps[P.idx];
  if (c.cmd === "hush") { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} SAY.until = 0; return; }
  if (c.cmd === "yes" || c.cmd === "no") {
    var cf = HF.confirm; HF.confirm = null; if (!cf) return;
    snd("ok");
    if (c.cmd === "yes" && cf.cmd === "knee" && st && st.ex && st.ex.id === cf.x) kneeStop("dolor"); else say("Sigo.", true);
    return;
  }
  if (c.cmd === "talk") { if (!TALK.on) { TALK.bySession = !!P.active; talkStart(); } return; }
  if (c.cmd === "mem") { var mt = memIntent(raw || c.q || ""); if (mt && memAdd(mt)) { snd("ok"); say("Anotado.", true); } return; }
  if (P.done) { if (c.cmd === "go") closePlayer(); return; }
  if (c.cmd === "go") { snd("ok"); P.leadNext = 6; mainAction(); }
  else if (c.cmd === "prev") { snd("ok"); pacerStop(); enterStep(Math.max(0, P.idx - 1)); }
  else if (c.cmd === "pause") { if (!P.paused) { togglePause(); say("Pausa. Di «sigue» para continuar.", true); } }
  else if (c.cmd === "resume") { if (P.paused) { togglePause(); say("Seguimos.", true); } }
  else if (c.cmd === "more") { if (st && (st.type === "rest" || st.type === "gap" || st.type === "seg" || (st.type === "item" && P.autoItem))) { P.remaining += 15; P.marks = {}; updateCount(); say("Quince segundos más.", true); } else say("Ahora no hay tiempo que alargar.", true); }
  else if (c.cmd === "repeat") { if (st) { SPK.names = {}; SPK.loads = {}; announceStep(st); } }
  else if (c.cmd === "knee") {
    if (st && st.ex && st.ex.knee && (st.type === "work" || st.type === "hold")) { HF.confirm = { cmd: "knee", x: st.ex.id, until: Date.now() + 9000 }; say("¿Corto " + st.ex.name + " por la rodilla? Di sí o no.", true); }
    else say("Si la rodilla molesta, para. Esta noche anótalo en el chequeo.", true);
  }
  else if (c.cmd === "reps") hfReps(c);
  else if (c.cmd === "rir") { if (P.lastLog && P.lastLog.t == null && !P.lastLog.skip) { setGroupRir(lastGroupLi(), c.n); snd("ok"); say("Anotado: te quedaban " + c.n + ".", true); } }
  else if (c.cmd === "next") { var n = nextWork(P.idx); say(n ? "Sigue " + stepLabel(n) + "." : "Es lo último.", true); }
  else if (c.cmd === "dose") doseSay();
  else if (c.cmd === "prep") prepVoice();
  else if (c.cmd === "time") timeSay();
  else if (c.cmd === "ask") hfAsk(c.q || norm(raw));
}
function hfReps(c) {
  var st = P.steps[P.idx];
  if (st && st.type === "work") {
    pacerStop();
    logWork(st, c.n, true);
    if (P.lastLog && c.rir != null) P.lastLog.rir = c.rir;
    snd("ok");
    enterStep(P.idx + 1);
    return;
  }
  if (P.lastLog && P.lastLog.t == null && !P.lastLog.skip) {
    lastGroupLi().forEach(function (n) { var z = P.log[n]; if (z.t == null) { z.r = c.n; z.auto = false; if (c.rir != null) z.rir = c.rir; } });
    saveRun(); renderLogBar(); snd("ok");
    say("Corregido: " + c.n + (c.rir != null ? ", te quedaban " + c.rir : "") + ".", true);
  }
}
function doseSay() {
  var st = P.steps[P.idx], x = st && st.ex ? st.ex : null;
  if (!x) { var n = nextWork(P.idx); x = n && n.ex ? n.ex : null; }
  if (!x) { say("Ahora no hay ejercicio con peso.", true); return; }
  var es = eqSay(effLoadText(x));
  say(x.name + ": " + setDose(x) + (x.side ? " por lado" : "") + (es ? ", con " + es : "") + ".", true);
}
function timeSay() {
  var st = P.steps[P.idx], t = "";
  if (st && P.running && (isTimed(st) || (st.type === "item" && P.autoItem))) t += "Quedan " + secsSpoken(P.remaining) + " de este paso. ";
  t += "Vas en " + secsSpoken(P.elapsed) + " de " + secsSpoken(P.total) + ".";
  if (P.kind === "session") { var r = remainingSets(); t += " Faltan " + r + " serie" + (r === 1 ? "" : "s") + "."; }
  say(t, true);
}
function hfAsk(q) {
  var x = askCurrentEx(), r = askEngine(q, { x: x, voice: true });
  if (aiReady() && (!r.found || r.weak)) { aiVoice(q, r.x || x, r.found ? r.say : ""); return; }
  fbShow(r.say, 12000);
  say(r.found ? r.say : "No te entendí. Prueba, por ejemplo: «¿cómo respiro?» o «¿qué sigue?».", true);
}

/* Gesto: las dos manos sobre la cabeza 1 segundo = botón azul */
var GEST = { since: 0, last: 0, needDown: false };
var GEST_NO = { pressmil: 1, arnold: 1, latpie: 1, latinc: 1, yraise: 1, pullover: 1, triover: 1, frances: 1, jalon: 1, facepull: 1 };
function gestOK() {
  if (!pref("camGest", true) || !P.active || P.done || P.paused) return false;
  var st = P.steps[P.idx]; if (!st) return false;
  var E = CAM.eng;
  if (!E || !CAM.active) return true;
  if (E.hold) return !P.running;
  if (st.type === "work") return E.reps === 0 && E.state !== "move" && pacerEligible(st) && !PC.running && !GEST_NO[st.ex.id];
  return false;
}
function gestWanted() { return CAM.on && !!CAM.lm && gestOK(); }
function gestFrame(Pz, t) {
  var n = Pz && Pz.nose, a = Pz && Pz.wrL, b = Pz && Pz.wrR, sl = Pz && Pz.shL, sr = Pz && Pz.shR, up = false;
  if (n && a && b && sl && sr && n.v > 0.5 && a.v > 0.5 && b.v > 0.5) {
    var span = Math.max(Math.abs(sl.x - sr.x), 0.04 * (Pz.H || 480)), m = 0.15 * span;
    up = a.y < n.y - m && b.y < n.y - m;
  }
  if (!up) { GEST.since = 0; GEST.needDown = false; return; }
  if (GEST.needDown || t - GEST.last < 3) return;
  if (!GEST.since) { GEST.since = t; hfMsg("Manos arriba: sostén 1 segundo…"); }
  if (t - GEST.since >= 1) { GEST.last = t; GEST.since = 0; GEST.needDown = true; gestFire(); }
}
function gestFire() { snd("ok"); hfMsg("Gesto: «Hecho»"); P.leadNext = 6; mainAction(); }

/* ---------- 4. Comentario de cada serie ---------- */
function setFeedbackText(st, e) {
  var x = st && st.ex; if (!x || !e || e.skip || x.unit === "pasos") return "";
  var parts = [], rr = repsRange(x.reps);
  if (!e.auto && e.r != null && e.t == null && rr[1]) {
    if (e.r < rr[0]) parts.push(e.r + ": por debajo del rango (" + x.reps + "). Si se repite, baja un peldaño o el peso.");
    else if (e.r >= rr[1]) parts.push(e.r + ": tope del rango." + (st.side === 1 ? " Iguálalo con el otro lado." : ""));
    else parts.push(e.r + ", dentro del rango.");
  }
  var q = e.q, tp = tempoParts(x.tempo);
  if (q && q.e != null && tp && tp[0] && tp[0].s >= 2 && q.e < 0.6 * tp[0].s) parts.push(((x.phNames || PH.squat)[0]) + " de " + q.e.toFixed(1) + " s; pedías " + tp[0].s + ": más lento.");
  if (q && q.w) { var top = null; for (var k in q.w) if (WARN_TXT[k] && (!top || q.w[k] > q.w[top])) top = k; if (top) parts.push("Ojo con: " + WARN_TXT[top] + "."); }
  return parts.join(" ");
}
function afterSet(st, e) {
  var txt = setFeedbackText(st, e);
  if (txt) { P.fb = txt; fbShow(txt); }
  if (e && !e.auto && aiReady() && pref("aiSet", false)) aiSetComment(st, e);
}

/* ---------- 5. Respuestas sin internet ---------- */
var STOP = {};
("como que para cuando donde cual cuale cuanto cuanta cuantas cuantos porque por hago hacer hace puedo debo tengo tiene esta este esto esos esas eso ese una uno unos unas los las del con sin mas menos muy bien mal ahora hoy dia ejercicio serie sesion entre sobre hasta desde algo nada todo mucho poco mejor peor otra otro favor dime explica explicame quiero necesito estoy siento").split(" ").forEach(function (w) { STOP[w] = 1; });
function stemW(w) { if (w.length > 4) { if (/[lnrdjz]es$/.test(w)) return w.slice(0, -2); if (/[aeiou]s$/.test(w)) return w.slice(0, -1); } return w; }
function stemToks(n) { return String(n || "").split(" ").filter(Boolean).map(stemW); }
function lev(a, b) {
  if (a === b) return 0;
  var m = a.length, n = b.length, prev = [], cur, i, j; if (!m) return n; if (!n) return m;
  for (j = 0; j <= n; j++) prev[j] = j;
  for (i = 1; i <= m; i++) { cur = [i]; for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)); prev = cur; }
  return prev[n];
}
var EX_GENERIC = {
  "remo": ["remo1m", "remosup", "remoexp"], "peso muerto": ["rdl2p", "rdl1p"], "sentadilla": ["goblet", "splitsq"], "sentadillas": ["goblet", "splitsq"],
  "lateral": ["latinc", "latpie"], "elevacion lateral": ["latinc", "latpie"], "plancha": ["planchaesc", "planchalat"],
  "flexion": ["arquero", "flexexp", "deficit", "pike"], "lagartija": ["arquero", "flexexp", "deficit"], "press": ["pressinc", "arnold", "pressmil"],
  "curl": ["curlbay", "martillo", "curlfem"], "triceps": ["triover", "frances"], "extension de triceps": ["triover", "frances"], "dominada": ["remo1m"]
};
var EXA = null, GEN_S = null;
function exAliases() {
  if (EXA) return EXA;
  EXA = [];
  for (var id in EX_ALIAS) EX_ALIAS[id].forEach(function (a) { var s = stemToks(norm(a)).join(" "); if (s) EXA.push({ id: id, a: s, w: s.split(" ").length }); });
  EXA.sort(function (p, q) { return q.a.length - p.a.length; });
  GEN_S = {}; for (var k in EX_GENERIC) GEN_S[stemToks(norm(k)).join(" ")] = EX_GENERIC[k];
  return EXA;
}
function exFuzzy(toks) {
  var A = exAliases(), best = null;
  A.forEach(function (al) {
    if (al.a.length < 5) return;
    var tol = al.a.length >= 7 ? 2 : 1;
    for (var i = 0; i + al.w <= toks.length; i++) {
      var gram = toks.slice(i, i + al.w);
      if (gram.every(function (g) { return STOP[g] || g.length < 3; })) continue;
      var s = gram.join(" "); if (Math.abs(s.length - al.a.length) > tol) continue;
      var d = lev(s, al.a);
      if (d <= tol && (!best || d < best.d || (d === best.d && al.a.length > best.a.length))) best = { id: al.id, a: al.a, d: d };
    }
  });
  return best;
}
function blocksOf(D) { return (D && D.blocks) || []; }
function blockExs(b) { return !b.ex ? [] : Array.isArray(b.ex) ? b.ex : [b.ex]; }
function dayHas(D, id) { return blocksOf(D).some(function (b) { return blockExs(b).some(function (e) { return e.id === id; }); }); }
function exDays(id) { return ORDER.filter(function (k) { return dayHas(DAYS[k], id); }).map(function (k) { return DAYS[k].day.toLowerCase(); }); }
function relevantDay() {
  if (P.active && P.key && DAYS[P.key] && DAYS[P.key].type !== "rest") return DAYS[P.key];
  if (current && DAYS[current] && DAYS[current].type === "train") return DAYS[current];
  var i0 = ORDER.indexOf(dayKeyOf(TODAY()));
  for (var i = 0; i < 7; i++) { var D = DAYS[ORDER[(i0 + i) % 7]]; if (D.type === "train") return D; }
  return null;
}
function exGeneric(ids, ctx) {
  var pick = null, j;
  if (ctx && ids.indexOf(ctx.id) >= 0) pick = ctx.id;
  if (!pick && P.active && P.steps) {
    for (j = P.idx; j < P.steps.length && !pick; j++) if (P.steps[j].ex && ids.indexOf(P.steps[j].ex.id) >= 0) pick = P.steps[j].ex.id;
    for (j = 0; j < P.steps.length && !pick; j++) if (P.steps[j].ex && ids.indexOf(P.steps[j].ex.id) >= 0) pick = P.steps[j].ex.id;
  }
  if (!pick) { var Dv = relevantDay(); if (Dv) pick = ids.filter(function (id) { return dayHas(Dv, id); })[0] || null; }
  if (!pick) pick = ids[0];
  return { id: pick, how: "generic", alts: ids.filter(function (id) { return id !== pick; }) };
}
var RSTOP = { peso: 1, kilo: 1, disco: 1, principal: 1, mancuerna: 1, serie: 1, nivel: 1, repeticion: 1, hago: 1, sale: 1, cada: 1 };
function askRungHit(hit, toks) {
  var lib = EX[hit.id]; if (!lib || !lib.ladder) return;
  var nameT = stemToks(norm(lib.name)), best = null, q = toks.filter(function (w) { return w.length >= 4 && !STOP[w] && !RSTOP[w]; });
  for (var i = 1; i < lib.ladder.length; i++) {
    var rt = stemToks(norm(rungText(lib, i))), pos = 99, n = 0, own = 0;
    q.forEach(function (w) { var p = rt.indexOf(w); if (p >= 0) { n++; if (nameT.indexOf(w) < 0) { own++; pos = Math.min(pos, p); } } });
    if (own) { var sc = n * 10 - (rt.length - n) - pos / 10; if (!best || sc > best.sc) best = { sc: sc, i: i }; }
  }
  if (!best) return;
  var cur = Math.min(rungOf(hit.id), lib.ladder.length - 1);
  hit.rung = best.i;
  hit.rungNote = "«" + rungText(lib, best.i) + "» es el nivel " + (best.i + 1) + " de " + lib.ladder.length + " de " + lib.name + "; tú estás en el " + (cur + 1) + "." + (rungPhase(lib, best.i) > phaseN() ? " Se abre en la fase 2." : "");
}
function exMatch(nq, ctx) {
  var toks = stemToks(nq), s = " " + toks.join(" ") + " ", A = exAliases(), hit = null, i;
  for (i = 0; i < A.length; i++) if (s.indexOf(" " + A[i].a + " ") >= 0) { hit = { id: A[i].id, how: "alias", a: A[i].a }; break; }
  if (!hit) { var fz = exFuzzy(toks); if (fz) hit = { id: fz.id, how: "fuzzy", a: fz.a }; }
  if (!hit) { var g = null; for (var k in GEN_S) if (s.indexOf(" " + k + " ") >= 0 && (!g || k.length > g.length)) g = k; if (g) { hit = exGeneric(GEN_S[g], ctx); hit.a = g; } }
  if (hit && EX[hit.id]) askRungHit(hit, toks);
  return hit && EX[hit.id] ? hit : null;
}
var ASK_E = [
  ["dolor", /(duele|dolor|molest|lastim|crujid|chasquid|hueso desubicado|punzad|pincha|tiron)/],
  ["facil", /(facil|no puedo|no llego|no me sale|me cuesta|cuesta mucho|regresion|mas suave|alternativa|sustitu|reemplaz|cambiar por|en vez de|no tengo|version simple)/],
  ["dificil", /(dificil|mas duro|mas pesado|progres|subir de|subo de|avanz|siguiente nivel|siguiente peldano|cuando subo|cuando paso|peldano)/],
  ["peso", /(peso|kilo|\bkg\b|mancuern|disco|carga|principal|antigua|vinilo|mochila|cuanto levanto|cuanto cargo)/],
  ["resp", /(respir|aire|inhal|exhal)/],
  ["camara", /(camara|celular|telefono|angulo|grabar)/],
  ["tempo", /(tempo|lento|rapido|segundos|ritmo|velocidad|cuanto tarda|cuanto bajo|bajada)/],
  ["rir", /(\brir\b|reserva|fallo|cuantas me quedan)/],
  ["descanso", /(descans|recuper|pausa entre|entre series)/],
  ["reps", /(cuantas repeticiones|cuantas reps|cuantas series|cuantas hago|cuantas son|cuantas veces)/],
  ["nivel", /(en que nivel|mi nivel|que nivel|que peldano|mi escalera)/],
  ["error", /(error|\bmal\b|evit|incorrect|equivoc|cuidado|claves|tips|consejo)/],
  ["porque", /(por que|porque|para que|sirve|musculo|trabaja|beneficio)/],
  ["como", /(como|posicion|hacer|coloc|pongo|empiez|tecnica|pasos|se hace|ejecut|explica|que es)/]
];
var ASK_G = [
  ["saludo", /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/],
  ["gracias", /^(gracias|muchas gracias|ok gracias|listo gracias|perfecto gracias|genial gracias)\b/],
  ["hora", /que hora es/],
  ["faltan", /(cuantas series (me )?faltan|cuantos ejercicios (me )?faltan|me falta|cuanto (me )?falta|cuanto queda|cuantas quedan)/],
  ["sigue", /(que sigue|que viene|siguiente ejercicio|lo siguiente|despues de esto|que toca ahora)/],
  ["sesion", /(cuanto dura|duracion|que toca hoy|que hago hoy|sesion de hoy|entreno de hoy|rutina de hoy|sesion del|sesion de el)/],
  ["dia", /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|pasado manana)\b/],
  ["rirC", /(que es (el )?rir|que significa (el )?rir|rir significa|que es la reserva|repeticiones en reserva|^rir$)/],
  ["tempoC", /(que es el tempo|que significa (el )?tempo|como (se )?lee el tempo|tempo [\dx] [\dx]|^tempo$)/],
  ["filtro", /filtro/],
  ["regla24", /(24 horas|veinticuatro horas|regla de (las )?24)/],
  ["descarga", /(descarga|deload|semana suave)/],
  ["fase", /(\bfase\b|\bfases\b|puerta|cuando (puedo|podre) (saltar|correr|trotar)|evaluacion|visto bueno)/],
  ["progresion", /(cuando subo|subir de nivel|subo de nivel|cuando paso|siguiente nivel|siguiente peldano|como progreso|progresion|cuando aumento|aumentar (el )?peso|subir (el )?peso|subo (de )?peso|cambio de peldano)/],
  ["discos", /(disco|armo|armar|como pongo|que pongo|como llego|cuanto cargo)/],
  ["equipo", /(antigua|vinilo|principales|que mancuerna|mis mancuernas|cuanto pesa la barra|consolidada|\bfija\b)/],
  ["comida", /(comer|comida|proteina|desayun|almuerz|cena|que como|calorias|aliment)/],
  ["progreso", /(como voy|mi progreso|cuantas sesiones|esta semana|cuanto he mejorado|mis marcas)/],
  ["body", /(que ejercicios|ejercicios (de|para)|trabaja[n]? (el|la|los|las) |fortalecer|entrenar (el|la|los|las) )/],
  ["camaraG", /(camara|celular|telefono)/],
  ["respG", /respir/],
  ["descansoG", /(cuanto descans|descanso entre|entre series|cuanto descanso)/],
  ["repsG", /(cuantas repeticiones|cuantas reps|cuantas veces|cuantas hago|cuantas son)/],
  ["dolorG", /(duele|dolor|molest|lastim)/]
];
var BODY = { pecho: ["pecho"], espalda: ["espalda", "dorsal", "trapecio"], dorsal: ["dorsal"], hombro: ["hombro", "deltoide"], biceps: ["biceps"], triceps: ["triceps"], pierna: ["cuadriceps", "isquio", "gluteo", "aductor", "pantorrilla"], gluteo: ["gluteo"], cuadriceps: ["cuadriceps"], isquio: ["isquio"], pantorrilla: ["pantorrilla"], aductor: ["aductor"], core: ["core", "oblicuo"], abdomen: ["core", "oblicuo"], abdominal: ["core", "oblicuo"], brazo: ["biceps", "triceps"] };
var EASY = {
  arquero: "Sin apoyar las rodillas: manos sobre el asiento de una silla contra la pared, o flexiones normales con 1 s de pausa abajo.",
  pike: "Manos sobre un escalón o una pila de libros y pies en el piso: menos inclinación. También vale acortar el rango.",
  flexexp: "Vuelve a la silla contra la pared y despega menos.",
  deficit: "Sin libros (sin déficit) o con las manos en la silla contra la pared.",
  facepull: "Da un paso hacia el ancla: menos tensión en la liga.",
  jalon: "Acércate al ancla o usa una liga más suave.",
  remoexp: "Liga más suave: aquí manda la velocidad, no la tensión.",
  curlbay: "Pisa la liga más cerca del cuerpo para que tense menos.",
  splitsq: "Sin peso y con el cojín más alto; agarra el marco de la puerta para el equilibrio.",
  stepdown: "Escalón más bajo (5-10 cm) y una mano en la pared.",
  curlfem: "A dos piernas y con menos recorrido: sube la cadera solo hasta donde controles.",
  extrod: "Liga más suave o menos recorrido.",
  hipthrust: "Sin peso, a dos piernas y con 2 s arriba.",
  talonpie: "A dos pies, apoyado en la pared.",
  copen: "Silla más cerca de la cadera, para apoyar el muslo, y 10 s.",
  planchaesc: "Menos segundos con técnica perfecta, o con las manos en una silla contra la pared.",
  planchalat: "Menos segundos, o de pie: antebrazo en la pared y el cuerpo inclinado en línea.",
  bichomuerto: "Mueve solo las piernas, o solo los brazos, con la zona lumbar pegada al piso.",
  yraise: "Con las manos vacías, sin los vinilos."
};
var NOEQ = {
  facepull: "Sin liga: inclinado a 45° con los 2 vinilos, abre los brazos hacia atrás en «T» con los pulgares arriba y aprieta las escápulas 1 s. Mismas 15 repeticiones.",
  curlbay: "Sin liga: curl con 1 principal liviana, de pie y con el codo un poco por detrás del cuerpo, bajando en 2 s.",
  jalon: "Sin liga: si tienes barra, negativas de dominada de 5 s; si no, remo con las 2 principales con el torso inclinado.",
  remoexp: "Sin liga: remo explosivo con 1 principal sin discos, subiendo lo más rápido posible y bajando en 2 s.",
  extrod: "Sin liga, sáltalo hoy: con peso en el tobillo la carga sobre la rodilla cambia, y aquí la rodilla manda.",
  stepdown: "Sin escalón: usa el primer peldaño de una escalera, con la mano en la baranda.",
  copen: "Sin silla: apoya la pierna de arriba en el sofá o en la cama, con la toalla doblada.",
  curlfem: "Sin toalla: usa medias sobre el piso liso, o una bolsa plástica bajo los talones."
};
function blockNote(x) {
  for (var k in DAYS) { var bl = blocksOf(DAYS[k]); for (var i = 0; i < bl.length; i++) { if (!bl[i].note) continue; if (blockExs(bl[i]).some(function (e) { return e.id === x.id && (!x.code || e.code === x.code); })) return bl[i].note; } }
  return "";
}
function askKgRaw(q) {
  var low = String(q || "").toLowerCase(), m = low.match(/(\d+(?:[.,]\d+)?)/), v = null;
  if (m) v = parseFloat(m[1].replace(",", "."));
  else { var w = norm(q).split(" "); for (var i = 0; i < w.length; i++) if (HF_NUM[w[i]] != null && w[i] !== "un" && w[i] !== "una") { v = HF_NUM[w[i]]; if (w[i + 1] === "y" && w[i + 2] === "medio") v += 0.5; break; } }
  if (v != null && /\by medio\b/.test(norm(q)) && v % 1 === 0 && m) v += 0.5;
  return v != null && v > 0 && v <= 60 ? v : null;
}
function askDiscs(q, x) {
  var kg = askKgRaw(q), inv = eqInv(), low = norm(q);
  if (kg == null) return { t: "Dime los kilos de discos: por ejemplo «¿qué discos pongo para 8.5?». " + askEquipo().t };
  var wantPar = /(cada una|las 2|las dos|\bpar\b|ambas|c u)/.test(low), wantUna = /(una sola|1 principal|una principal|en una|solo una)/.test(low);
  if (wantPar && /(en total|entre las dos|entre ambas)/.test(low)) kg = kg / 2;
  if (x && !wantPar && !wantUna) { var sp = eqParse(effLoadText(x)); if (sp && sp.kind === "par") wantPar = true; else if (sp && sp.kind === "una") wantUna = true; }
  var out = [], h = "";
  function line(kind) {
    var spec = { kind: kind, kg: kg }, lay = eqLayout(spec, inv), name = eqName(spec, lay, inv);
    if (!lay.ok) return name + ": " + eqMissText(lay);
    h += eqHTML(kind === "par" ? "2 principales · " + kgTxt(kg) + " kg c/u" : "1 principal · " + kgTxt(kg) + " kg", true);
    return name + ": " + (lay.side.length ? lay.side.map(kgTxt).join(" + ") + " kg por lado" : "sin discos") + (inv.bar ? " (" + kgTxt(kg + inv.bar) + " kg con la barra" + (kind === "par" ? " cada una" : "") + ")" : "") + ".";
  }
  if (!wantUna) out.push(line("par"));
  if (!wantPar) out.push(line("una"));
  return { t: out.join(" "), h: h };
}
function askEquipo() {
  var inv = eqInv();
  return { t: "Tus pesas: las 2 principales (par armable; discos: " + inv.discs.map(function (d) { return d.n + " de " + kgTxt(d.kg) + " kg"; }).join(", ") + "; cada barra con collares pesa " + kgTxt(inv.bar) + " kg), 1 principal cuando juntas los discos en una sola, la antigua (" + kgTxt(inv.antigua) + " kg, de una pieza) y los 2 vinilos (" + kgTxt(inv.vinilo) + " kg cada uno). La barra conectora no se usa." };
}
function askAnswer(k, x) {
  var lib = EX[x.id] || {}, t = "", h = "";
  if (k === "como") { t = (x.setup ? "Posición: " + x.setup + " " : "") + (x.steps ? "Pasos: " + x.steps.map(function (s, i) { return (i + 1) + ") " + s; }).join(" ") : "") + (!x.setup && !x.steps && x.how ? x.how : ""); if (x.id && demoOf(x.id) && pref("demo", true) !== false) h = '<div class="how-demo">' + demoHTML(x, false) + '</div><p class="how-video"><a href="' + esc(videoURL(x)) + '" target="_blank" rel="noopener">Ver videos de la técnica en YouTube</a> <span class="muted">(con internet)</span></p>'; }
  else if (k === "error") t = (x.errors && x.errors.length ? "Errores comunes: " + x.errors.join("; ") + ". " : "") + (x.cues && x.cues.length ? "Claves: " + x.cues.join("; ") + "." : "");
  else if (k === "resp") t = x.breath || "Exhala en el esfuerzo e inhala al volver.";
  else if (k === "porque") t = (x.why || "") + (x.muscles ? " Trabaja: " + x.muscles.join(", ") + "." : "");
  else if (k === "dolor") t = (x.safety ? x.safety + " " : "") + (x.knee ? "Rodilla: si el dolor pasa de 2/10, sientes el «hueso desubicado» o hay chasquido con dolor, cortas este ejercicio (botón «Molestia de rodilla» o di «me duele la rodilla») y la app baja el peldaño. " : "") + "Si al día siguiente sigue o empeora, no lo fuerces y consúltalo.";
  else if (k === "peso") {
    var lt = effLoadText(x), sp = eqParse(lt);
    if (sp) { h = eqHTML(lt, true); t = "Usa " + eqSay(lt) + ". "; var r = eqPrepAt(P.active ? P.steps : [], P.active ? P.idx : 0); if (r && r.st && r.st.ex && r.st.ex.id === x.id && r.steps.length) t += r.steps.join(" ") + " "; }
    else t = "Carga: " + (lt || "peso corporal") + ". ";
    var bn = blockNote(x); if (bn && /(no llegas|baja)/i.test(bn)) t += bn + " ";
    t += x.follow ? "Su peso lo marca " + ((EX[x.follow] || {}).name || "otro ejercicio") + ", porque comparten mancuernas: sube cuando ese sube." : "Subes cuando haces el tope del rango en todas las series dos sesiones seguidas.";
  }
  else if (k === "camara") { var c = camCfg(x); t = c ? CAM_VIEW[c.view] + (c.tip ? " " + c.tip : "") : "Este ejercicio no lo sigo con cámara; registra a mano."; }
  else if (k === "tempo") t = x.hold ? "Aquí no hay tempo: aguantas " + setDose(x) + (x.side ? " por lado" : "") + ", " + (x.sets || 1) + " series." : (tempoSpoken(x) || "Este ejercicio no tiene tempo fijo.");
  else if (k === "rir") t = x.rir ? (/^\d/.test(x.rir) ? "RIR " + x.rir + ": termina cuando te queden esas repeticiones en reserva con técnica limpia." : x.rir + ".") : "Aquí no hay RIR fijo: técnica limpia de principio a fin.";
  else if (k === "descanso") t = x.rest ? "Descansa " + x.rest + " s antes del siguiente ejercicio del bloque." : "Sin descanso: pasas directo al siguiente del circuito.";
  else if (k === "reps") t = x.name + ": " + doseText(x, P.active && P.plan && P.plan.opts && P.plan.opts.deload) + (x.tempo ? ", tempo " + x.tempo : "") + (x.rir ? ", RIR " + x.rir : "") + ".";
  else if (k === "nivel") { var n = (lib.ladder || []).length; t = n > 1 ? "Estás en el nivel " + (Math.min(x.rung || 0, n - 1) + 1) + " de " + n + ": " + (rungText(lib, x.rung || 0) || effLoadText(x)) + ". " + askAnswer("dificil", x).t : "Este ejercicio no tiene escalera de niveles."; }
  else if (k === "facil") {
    var bn2 = blockNote(x), parts = [];
    if (bn2 && /(no llegas|si no)/i.test(bn2)) parts.push(bn2);
    if (x.rung > 0) parts.push("Baja un peldaño: " + rungText(lib, x.rung - 1) + ".");
    if (EASY[x.id]) parts.push(EASY[x.id]);
    var sp2 = eqParse(effLoadText(x)); if (sp2 && (sp2.kind === "par" || sp2.kind === "una") && sp2.kg) parts.push("Si es por el peso, quita un disco de 0.5 por lado.");
    t = parts.join(" ") || "Estás en el primer peldaño: acorta el rango o haz menos repeticiones con técnica limpia.";
  }
  else if (k === "dificil") {
    if (x.rungs && x.rung < x.rungs - 1) {
      var nt = rungText(lib, x.rung + 1), miss = eqRungNote(lib, x.rung + 1);
      t = "Siguiente peldaño: " + nt + "." + (rungPhase(lib, x.rung + 1) > phaseN() ? " Se abre en la fase 2, tras la evaluación." : " Lo tomas cuando haces el tope del rango (" + (x.hold ? secsLabel(x.hold) : repsRange(x.reps)[1]) + (x.side ? " por lado" : "") + ") en todas las series dos sesiones seguidas; la app te lo propone." + (miss ? " " + miss : ""));
    } else t = x.rungs ? "Ya estás en el último peldaño: sube el esfuerzo (menos RIR) o 1 s más de bajada." : "Este ejercicio no tiene escalera: sube el esfuerzo con técnica limpia.";
  }
  else if (k === "fase") { var lk = (lib.ladder || []).map(function (r, i) { return rungPhase(lib, i) > 1 ? rungText(lib, i) : null; }).filter(Boolean); t = lk.length ? "En " + x.name + " es de fase 2: " + lk.join("; ") + ". " + (phaseN() >= 2 ? "Ya estás en la fase 2." : "Se abre cuando pases la puerta 1.") : x.name + " no cambia con la fase."; }
  return { t: t.trim(), h: h };
}
function askAltsNote(x, alts) {
  var d = exDays(x.id);
  return "Te respondo de " + x.name + (d.length ? " (" + d.join(" y ") + ")" : "") + ". Si era otro: " + alts.map(function (id) { var dd = exDays(id); return (EX[id] || {}).name + (dd.length ? " (" + dd.join(" y ") + ")" : ""); }).join(" o ") + ".";
}
function askDayKey(nq) {
  var map = { lunes: "lun", martes: "mar", miercoles: "mie", jueves: "jue", viernes: "vie", sabado: "sab", domingo: "dom" }, k;
  for (k in map) if (new RegExp("\\b" + k + "\\b").test(nq)) return map[k];
  var i0 = ORDER.indexOf(dayKeyOf(TODAY()));
  if (/pasado manana/.test(nq)) return ORDER[(i0 + 2) % 7];
  if (/\bmanana\b/.test(nq) && /(que|toca|hay|hago|entreno|sesion)/.test(nq)) return ORDER[(i0 + 1) % 7];
  if (/\bhoy\b/.test(nq)) return ORDER[i0];
  return null;
}
function askSesion(dk) {
  var key = dk || (P.active && P.key ? P.key : dayKeyOf(TODAY())), D = DAYS[key];
  var isToday = key === dayKeyOf(TODAY()), when = isToday ? "Hoy, " + D.day.toLowerCase() + "," : "El " + D.day.toLowerCase();
  if (D.type === "rest") return { t: when + " es " + D.title.toLowerCase() + ". " + (isToday || !D.after ? D.lead : "Toca: " + D.after.si.join("; ") + ".") };
  var date = dateOfKey(key), plan = D.type === "aero" ? buildPlan(D, { mode: "full", deload: false }) : planFor(D, date);
  var W = D.type === "aero" ? D.weeks[weekAB(date)] : null, win = (plan.D || D).window;
  return { t: when + " toca " + (W ? W.title : D.title) + ": " + Math.round(plan.total / 60) + " minutos" + (win ? ", de " + win : "") + ". " + (W ? W.lead : "Bloques: " + plan.blocks.map(function (o) { return o.b.label + " " + o.b.name.toLowerCase(); }).join(", ") + ".") };
}
function nextTrainDay() {
  var i0 = ORDER.indexOf(dayKeyOf(TODAY()));
  for (var i = 0; i < 7; i++) {
    var k = ORDER[(i0 + i) % 7], D = DAYS[k]; if (D.type === "rest") continue;
    if (i === 0) { var L = rec("log_" + TODAY() + "_" + k), A = rec("aer_" + TODAY()); if ((L && L.done) || (D.type === "aero" && A)) continue; }
    return D;
  }
  return null;
}
function askFaltan() {
  if (P.active && !P.done) {
    var mins = Math.max(1, Math.round((P.total - P.elapsed) / 60));
    if (P.kind === "session") { var n = remainingSets(); return { t: "Te faltan " + n + " serie" + (n === 1 ? "" : "s") + " y unos " + mins + " minutos." }; }
    return { t: "Faltan unos " + mins + " minutos." };
  }
  return { t: "No tienes una sesión abierta. " + askSesion(null).t };
}
function askSigue() {
  if (P.active && !P.done) {
    var n = nextWork(P.idx);
    if (!n) return { t: "Es lo último de la sesión." };
    var lt = n.ex ? effLoadText(n.ex) : "", es = lt ? eqSay(lt) : "", ps = eqPrepSay(P.idx);
    return { t: "Sigue " + stepLabel(n) + "." + (n.ex ? " " + setDose(n.ex) + "." : "") + (es ? " Con " + es + "." : "") + (ps && /^Cambia/.test(ps) ? " " + ps : ""), h: lt && eqParse(lt) ? eqHTML(lt, true) : "" };
  }
  var D = nextTrainDay();
  return { t: D ? "La próxima sesión es el " + D.day.toLowerCase() + ": " + (D.type === "aero" ? D.weeks[weekAB(dateOfKey(D.key))].title : D.title) + ", " + D.window + "." : "Esta semana ya no quedan sesiones." };
}
function askTempoC(q, ctx) {
  var m = String(q || "").toLowerCase().match(/(\d|x)\s*[-, ]\s*(\d|x)\s*[-, ]\s*(\d|x)\s*[-, ]\s*(\d|x)/);
  var base = "Son cuatro cifras en segundos: bajada, pausa abajo, subida y pausa arriba. X = lo más rápido posible con control.";
  if (m) {
    var d = [m[1], m[2], m[3], m[4]].map(function (v) { return v === "x" ? "X" : v; }), nm = ["bajando", "quieto abajo", "subiendo", "arriba"];
    return { t: d.join("-") + ": " + d.map(function (v, i) { return v === "X" ? (i === 2 ? "sube" : i === 0 ? "baja" : nm[i]) + " lo más rápido posible" : v + " s " + nm[i]; }).join(", ") + ". " + base };
  }
  return { t: "El tempo: " + base.charAt(0).toLowerCase() + base.slice(1) + (ctx && tempoParts(ctx.tempo) ? " " + tempoSpoken(ctx) : " La barra de colores de cada ejercicio lo muestra en el orden en que lo haces.") };
}
function filtroHoy() {
  var dk = dayKeyOf(TODAY()); if (!DAYS[dk].filter) return " Hoy no hay filtro: lo respondes el miércoles y el sábado al despertar.";
  var f = rec("flt_" + TODAY());
  return f && f.mode ? " Hoy respondiste: " + (f.mode === "full" ? "sesión completa." : f.mode === "mod" ? "sesión modificada." : "sin pierna.") : " Hoy te toca responderlo: está arriba, en la página del día.";
}
function askDescarga() {
  var ws = weeksSinceDeload(TODAY()), now = isDeload(TODAY());
  return { t: RULES[4][1] + (now ? " Esta semana ya es de descarga." : ws != null ? " Llevas " + ws + " semana" + (ws === 1 ? "" : "s") + " desde la última" + (ws >= 6 ? ": toca una pronto." : ".") : "") + " Se marca con el botón «Semana de descarga» de cada día." };
}
function askFase() {
  var n = phaseN(), g = gate1State();
  var t = "Estás en la fase " + n + ", " + PHASES[n].name.toLowerCase() + ": " + PHASES[n].items.join(", ").toLowerCase() + ".";
  if (n === 1) t += " Para pasar a la fase 2: " + GATE1.map(function (x) { return x[1].toLowerCase() + (g[x[0]] ? " (listo)" : " (pendiente)"); }).join("; ") + ". Lo marcas en «Tu fase», abajo en la página.";
  else if (n === 2) t += " Para la fase 3: " + GATE2.map(function (x) { return x[1].toLowerCase(); }).join("; ") + ".";
  return { t: t };
}
function askComida() {
  var D = relevantDay() || DAYS[ORDER.filter(function (k) { return DAYS[k] && DAYS[k].type === "train"; })[0] || ORDER[0]], list = [];
  ORDER.forEach(function (k) { (DAYS[k].after ? DAYS[k].after.si : []).forEach(function (s) { if (/(prote|desayun|\bcena\b|calcio|comida de)/i.test(s) && list.indexOf(s) < 0) list.push(s); }); });
  var own = (D.after ? D.after.si : []).filter(function (s) { return /(prote|desayun|\bcena\b|calcio|comida de)/i.test(s); });
  var seen = own.map(function (s) { return s.slice(0, 18); }), gen = list.filter(function (s) { var k = s.slice(0, 18); if (seen.indexOf(k) >= 0) return false; seen.push(k); return true; });
  return { t: (own.length ? "El " + D.day.toLowerCase() + ": " + own.join("; ") + ". " : "") + (gen.length ? "Otros días: " + gen.slice(0, 3).join("; ") + "." : "") };
}
function askProgreso() {
  var st = weekStats(TODAY());
  return { t: coachText(null, null) + (st.knee != null ? " Rodilla al despertar: " + st.knee + "/10 de promedio." : "") + " El detalle está en «Progreso», arriba." };
}
function askBody(nq) {
  var part = null; stemToks(nq).forEach(function (w) { if (!part && BODY[w]) part = w; });
  if (!part) return null;
  var keys = BODY[part], hits = [];
  for (var id in EX) { var mus = norm((EX[id].muscles || []).join(" ")); if (keys.some(function (k) { return mus.indexOf(k) >= 0; })) hits.push(id); }
  if (!hits.length) return null;
  return { t: "Para " + part + ": " + hits.slice(0, 8).map(function (id) { var d = exDays(id); return EX[id].name + (d.length ? " (" + d.join(" y ") + ")" : ""); }).join("; ") + "." };
}
function askDayDoses() {
  var D = relevantDay(); if (!D) return { t: "Dime el ejercicio y te digo sus repeticiones." };
  var lines = []; blocksOf(D).forEach(function (b) { if (!Array.isArray(b.ex)) return; b.ex.forEach(function (e) { var x = resolve(e); lines.push(x.code + " " + x.name.toLowerCase() + " " + doseText(x, false)); }); });
  return { t: "Cada ejercicio trae su rango. El " + D.day.toLowerCase() + ": " + lines.slice(0, 6).join("; ") + ". Dime cuál y te doy su tempo y su carga." };
}
function askDayLoads() {
  var D = relevantDay(); if (!D) return { t: "Dime el ejercicio y te digo qué peso usar." };
  var lines = []; blocksOf(D).forEach(function (b) { if (!Array.isArray(b.ex)) return; b.ex.forEach(function (e) { var x = resolve(e), lt = effLoadText(x); if (lt && eqParse(lt)) lines.push(x.code + " " + lt); }); });
  return { t: "Dime el ejercicio. El " + D.day.toLowerCase() + " usas: " + lines.join("; ") + "." };
}
function askGeneral(k, nq, ctx, q) {
  if (k === "hora") { var d = new Date(); return { t: "Son las " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2) + "." }; }
  if (k === "faltan") return askFaltan();
  if (k === "sigue") return askSigue();
  if (k === "sesion") {
    var wd = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana)\b/.test(nq);
    if (P.active && !P.done && !wd) { var left = Math.max(0, P.total - P.elapsed); return { t: "Esta sesión dura " + Math.round(P.total / 60) + " minutos: llevas " + fmt(P.elapsed) + " y faltan unos " + Math.max(1, Math.round(left / 60)) + " minutos" + (P.kind === "session" ? " (" + remainingSets() + " series)." : ".") }; }
    return askSesion(askDayKey(nq));
  }
  if (k === "dia") { var dk = askDayKey(nq); return dk && /(que|hay|toca|hago|entreno|sesion|como es|dura)/.test(nq) || dk && nq.split(" ").length <= 2 ? askSesion(dk) : null; }
  if (k === "rirC") return { t: "RIR = repeticiones en reserva: las que todavía podrías hacer con técnica limpia al terminar la serie. RIR 0-1 es casi al fallo; 2-3, te sobran dos o tres." + (ctx && ctx.rir ? " En " + ctx.name + ": " + (/^\d/.test(ctx.rir) ? "RIR " + ctx.rir : ctx.rir) + "." : "") };
  if (k === "tempoC") return askTempoC(q, ctx);
  if (k === "filtro") return { t: RULES[0][1] + filtroHoy() };
  if (k === "regla24") return { t: RULES[1][1] };
  if (k === "descarga") return askDescarga();
  if (k === "fase") return askFase();
  if (k === "progresion") return { t: RULES[3][1] + (ctx ? " " + askAnswer("dificil", ctx).t : "") };
  if (k === "discos") return askKgRaw(q) != null ? askDiscs(q, null) : askEquipo();
  if (k === "equipo") return askEquipo();
  if (k === "comida") return askComida();
  if (k === "progreso") return askProgreso();
  if (k === "body") return askBody(nq);
  if (k === "camaraG") return ctx ? askAnswer("camara", ctx) : { t: "El celular a 2-3 m, apoyado firme. De lado y a la altura de la cadera para casi todo; de frente para laterales, face pull y step-down; bajo (20-40 cm del piso) para lo que se hace en el suelo. Cada ejercicio te dice dónde va cuando prendes la cámara." };
  if (k === "respG") return ctx ? askAnswer("resp", ctx) : { t: RULES[2][1] };
  if (k === "descansoG") return ctx ? askAnswer("descanso", ctx) : { t: "Cada bloque marca su descanso. En las superseries descansas entre un ejercicio y el otro (el lunes, 45 s tras el remo y 60 s tras el arquero); en los circuitos pasas directo y descansas al final de la ronda; el sábado, cada ronda empieza en su minuto exacto." };
  if (k === "repsG") return ctx ? askAnswer("reps", ctx) : askDayDoses();
  if (k === "dolorG") return ctx && (ctx.knee || !/rodilla/.test(nq)) ? askAnswer("dolor", ctx) : { t: "Si es la rodilla durante un ejercicio: dolor de más de 2/10, sensación de hueso desubicado o chasquido con dolor = cortas ese ejercicio (botón «Molestia de rodilla» o di «me duele la rodilla»). " + RULES[7][0] + ": " + RULES[7][1] + " Dime en qué ejercicio te molesta y te digo cómo ajustarlo." };
  return null;
}
function askNoEx(k, nq) {
  if (k === "resp") return { t: RULES[2][1] };
  if (k === "dolor") return askGeneral("dolorG", nq, null);
  if (k === "peso") return askDayLoads();
  if (k === "camara") return askGeneral("camaraG", nq, null);
  if (k === "tempo") return askTempoC("", null);
  if (k === "rir") return askGeneral("rirC", nq, null);
  if (k === "descanso") return askGeneral("descansoG", nq, null);
  if (k === "facil" || k === "dificil") return { t: RULES[3][1] + " Dime el ejercicio y te digo su peldaño anterior o el siguiente." };
  if (k === "reps") return askDayDoses();
  return null;
}
function askSearch(nq) {
  var toks = stemToks(nq).filter(function (w) { return w.length >= 4 && !STOP[w]; });
  if (!toks.length) return null;
  var best = null;
  for (var id in EX) {
    var e = EX[id], hay = stemToks(norm([e.name, (e.muscles || []).join(" "), e.why, e.setup].join(" "))), sc = 0;
    toks.forEach(function (w) { if (hay.indexOf(w) >= 0) sc++; });
    if (sc && (!best || sc > best.sc)) best = { sc: sc, kind: "ex", id: id };
  }
  RULES.forEach(function (r, i) {
    var hn = stemToks(norm(r[0])), ht = stemToks(norm(r[1])), sc = 0;
    toks.forEach(function (w) { if (hn.indexOf(w) >= 0) sc += 2; else if (ht.indexOf(w) >= 0) sc++; });
    if (sc && (!best || sc > best.sc)) best = { sc: sc, kind: "rule", i: i };
  });
  if (!best || (best.sc < 2 && toks.length > 1)) return null;
  if (best.kind === "rule") return { t: RULES[best.i][0] + ": " + RULES[best.i][1] };
  var x = exEntry(best.id); if (!x) return null;
  return { t: x.name + ". " + askAnswer("porque", x).t, x: x };
}
function askEngine(q, o) {
  o = o || {};
  var nq = norm(q), ctx = o.x || null, m = exMatch(nq, ctx), x = m ? exEntry(m.id) : null;
  var res = { items: [], x: x || ctx, found: false, weak: false }, words = nq ? nq.split(" ").length : 0;
  function add(a) { if (a && (a.t || a.h)) res.items.push(a); }
  if (o.intent && (x || ctx)) { add(askAnswer(o.intent, x || ctx)); res.found = true; return askFinish(res, o); }
  var G = {}; ASK_G.forEach(function (r) { if (r[1].test(nq)) G[r[0]] = 1; });
  if (G.body && !askBody(nq)) delete G.body;
  if (G.saludo && words <= 4) { add({ t: "Hola. Pregúntame lo que quieras de tus ejercicios: cómo se hace, qué peso, cómo respiro, qué sigue o qué discos pongo." }); res.found = true; return askFinish(res, o); }
  if (G.gracias && words <= 4) { add({ t: "De nada. Sigue así." }); res.found = true; return askFinish(res, o); }
  var nqI = nq;
  if (m && m.a) { var at = m.a.split(" "); nqI = nq.split(" ").filter(function (w) { return at.indexOf(stemW(w)) < 0; }).join(" "); }
  var E = []; ASK_E.forEach(function (r) { if (r[1].test(nqI)) E.push(r[0]); });
  if (x && NOEQ[x.id] && /(no tengo|sin (la |una |mi )?(liga|silla|escalon|toalla|mochila|barra))/.test(nq)) { add({ t: NOEQ[x.id] }); res.found = true; return askFinish(res, o); }
  if (x) {
    var ks = [];
    if (G.discos && askKgRaw(q) != null) ks.push("discos");
    if (G.progresion) ks.push("dificil");
    if (G.fase) ks.push("fase");
    if (G.repsG) ks.push("reps");
    if (G.tempoC) ks.push("tempo");
    E.forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); });
    if (ks.length > 1 && ks.indexOf("como") >= 0) ks.splice(ks.indexOf("como"), 1);
    if (ks.indexOf("facil") >= 0 && ks.indexOf("dificil") >= 0) ks.splice(ks.indexOf("dificil"), 1);
    if (ks.indexOf("discos") >= 0 && ks.indexOf("peso") >= 0) ks.splice(ks.indexOf("peso"), 1);
    res.found = ks.length > 0;
    if (!ks.length) ks = m.rung != null ? ["como"] : ["como", "error"];
    if (m.rung != null) { add({ t: m.rungNote }); res.found = true; }
    ks.slice(0, 2).forEach(function (k) { add(k === "discos" ? askDiscs(q, x) : askAnswer(k, x)); });
    if (m.how === "generic" && m.alts && m.alts.length && !(ctx && ctx.id === x.id)) add({ t: askAltsNote(x, m.alts) });
    if (m.how === "fuzzy" && !res.found) res.weak = true;
    return askFinish(res, o);
  }
  var gk = ASK_G.map(function (r) { return r[0]; }).filter(function (k) { return G[k] && k !== "saludo" && k !== "gracias"; });
  if (G.sesion) gk = gk.filter(function (k) { return k !== "dia"; });
  if (G.faltan) gk = gk.filter(function (k) { return k !== "repsG"; });
  if (G.discos && askKgRaw(q) == null && gk.length > 1) gk = gk.filter(function (k) { return k !== "discos"; });
  if (gk.length) {
    gk.forEach(function (k) { if (res.items.length < 2) add(askGeneral(k, nq, ctx, q)); });
    if (res.items.length) { res.found = true; return askFinish(res, o); }
  }
  if (E.length && ctx) {
    var ks2 = E.slice(); if (ks2.length > 1 && ks2.indexOf("como") >= 0) ks2.splice(ks2.indexOf("como"), 1);
    ks2.slice(0, 2).forEach(function (k) { add(askAnswer(k, ctx)); });
    res.found = true; res.x = ctx; return askFinish(res, o);
  }
  if (E.length) { var a2 = null; for (var i = 0; i < E.length && !a2; i++) a2 = askNoEx(E[i], nq); if (a2) { add(a2); res.found = true; res.weak = E[0] === "como" || E[0] === "porque" || E[0] === "error"; return askFinish(res, o); } }
  var s = askSearch(nq);
  if (s) { add(s); if (s.x) res.x = s.x; res.found = true; res.weak = true; return askFinish(res, o); }
  if (ctx && words <= 3 && words > 0) { add(askAnswer("como", ctx)); res.weak = true; return askFinish(res, o); }
  add({ t: "No te entendí del todo. Prueba así: «¿cómo hago el remo?», «¿qué peso uso en el press inclinado?», «¿qué es el RIR?», «¿qué sigue?» o «¿qué discos pongo para 8.5?»." + (aiReady() ? "" : " Si configuras una IA en Ajustes, también respondo preguntas libres.") });
  res.weak = true;
  return askFinish(res, o);
}
function askFinish(res, o) {
  var html = "", sayT = [];
  res.items.forEach(function (it) { html += (it.h ? '<div class="ask-eq">' + it.h + "</div>" : "") + (it.t ? "<p>" + esc(it.t) + "</p>" : ""); if (it.t) sayT.push(it.t); });
  var s = sayT.join(" ");
  if (o && o.voice && s.length > 330) { var cut = s.slice(0, 330), dot = cut.lastIndexOf(". "); s = dot > 100 ? cut.slice(0, dot + 1) : cut; }
  return { html: html, say: s, x: res.x, found: res.found, weak: res.weak };
}
function askChips() { $("ask-chips").innerHTML = ASK.x ? ASK_CHIPS.map(function (c) { return '<button class="opt-btn" data-a="chip" data-k="' + c[0] + '" type="button">' + esc(c[1]) + "</button>"; }).join("") : ""; }

/* ---------- 6. IA ---------- */
var AI_PROV = {
  ollama: { label: "Ollama (laptop)", url: "http://localhost:11434", model: "gemma3:4b" },
  gemini: { label: "Gemini gratis", url: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash" },
  chrome: { label: "IA de Chrome", model: "Gemini Nano" },
  openai: { label: "Otro servidor", url: "http://localhost:1234/v1", model: "" }
};
var CHR = { avail: null };
function aiMigrate() {
  if (ST.prefs.aiProv != null) return;
  var u = String(pref("aiUrl", "") || "").trim().replace(/\/+$/, "");
  if (pref("aiOn", false) && u) {
    if (/:11434/.test(u)) { setPref("aiUrlOllama", u.replace(/\/v1$/, "")); if (pref("aiModel", "")) setPref("aiModel_ollama", pref("aiModel", "")); setPref("aiProv", "ollama"); }
    else { setPref("aiUrlOther", u); if (pref("aiModel", "")) setPref("aiModel_openai", pref("aiModel", "")); if (pref("aiKey", "")) setPref("aiKey_openai", pref("aiKey", "")); setPref("aiProv", "openai"); }
  } else setPref("aiProv", "");
}
function aiProv() { var p = pref("aiProv", ""); return AI_PROV[p] ? p : ""; }
function aiUrlOf(p) { var u = String(p === "ollama" ? pref("aiUrlOllama", AI_PROV.ollama.url) : p === "openai" ? pref("aiUrlOther", AI_PROV.openai.url) : p === "gemini" ? AI_PROV.gemini.url : "").trim().replace(/\/+$/, ""); return p === "ollama" ? u.replace(/\/(v1|api)$/, "") : u; }
function aiModelOf(p) { return String(pref("aiModel_" + p, (AI_PROV[p] || {}).model || "") || "").trim(); }
function aiKeyOf(p) { return String(pref("aiKey_" + p, "") || "").trim(); }
function aiReady() {
  var p = aiProv(); if (!p) return false;
  if (p === "chrome") return typeof window.LanguageModel !== "undefined" && CHR.avail !== "unavailable";
  if (p === "gemini") return !!aiKeyOf(p);
  return !!aiUrlOf(p);
}
function aiName() { var p = aiProv(); return p === "chrome" ? "IA de Chrome" : p === "gemini" ? "Gemini · " + aiModelOf(p) : (aiModelOf(p) || "IA"); }
function aiField(id, v) {
  var p = aiProv(); if (!p) return;
  if (id === "ai-url") setPref(p === "ollama" ? "aiUrlOllama" : "aiUrlOther", v);
  else if (id === "ai-model") setPref("aiModel_" + p, v);
  else if (id === "ai-key") setPref("aiKey_" + p, v);
}
function isLanUrl(u) { try { var h = new URL(u).hostname; return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || /\.local$/.test(h); } catch (e) { return false; } }
/* Desde una página https, Chrome pide permiso de «red local» para hablar con la laptop por http */
function aiFetch(url, init) {
  init = init || {};
  if (!(location.protocol === "https:" && /^http:/i.test(url) && isLanUrl(url))) return fetch(url, init);
  var opts = ["local", "private"], i = 0;
  function attempt() {
    var o = {}, k, t0 = Date.now(); for (k in init) o[k] = init[k];
    if (i < opts.length) o.targetAddressSpace = opts[i];
    return fetch(url, o).catch(function (e) { i++; if (i <= opts.length && e && e.name === "TypeError" && Date.now() - t0 < 1500) return attempt(); throw e; });
  }
  return attempt();
}
function readLines(r, onLine) {
  if (!r.body || !r.body.getReader) return r.text().then(function (t) { t.split("\n").forEach(onLine); });
  var rd = r.body.getReader(), dec = new TextDecoder(), buf = "";
  function pump() { return rd.read().then(function (z) { if (z.done) { buf += dec.decode(); if (buf) onLine(buf); return; } buf += dec.decode(z.value, { stream: true }); var ls = buf.split("\n"); buf = ls.pop(); ls.forEach(onLine); return pump(); }); }
  return pump();
}
function httpErr(r) { return r.text().then(function (t) { var m = ""; try { var j = JSON.parse(t); m = (j.error && (j.error.message || j.error)) || j.message || ""; } catch (e) { m = t; } throw new Error("HTTP " + r.status + " " + String(m).slice(0, 200)); }); }
function aiChat(msgs, onTok) {
  var p = aiProv(); onTok = onTok || function () {};
  if (!p) return Promise.reject(new Error("sin IA"));
  if (p === "chrome") return chrChat(msgs, onTok);
  if (typeof fetch !== "function") return Promise.reject(new Error("sin fetch"));
  var ctrl = window.AbortController ? new AbortController() : null; ASK.ctrl = ctrl;
  var sig = ctrl ? ctrl.signal : undefined;
  if (p === "ollama") return ollamaChat(msgs, onTok, sig);
  if (p === "gemini") return geminiChat(msgs, onTok, sig);
  return oaiChat(msgs, onTok, sig);
}
function ollamaChat(msgs, onTok, sig) {
  var out = "", body = { model: aiModelOf("ollama"), stream: true, options: { temperature: 0.3, num_ctx: 8192 }, messages: msgs.map(function (m) { var o = { role: m.role, content: m.content }; if (m.img) o.images = [String(m.img).replace(/^data:[^,]*,/, "")]; return o; }) };
  return aiFetch(aiUrlOf("ollama") + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: sig, body: JSON.stringify(body) }).then(function (r) {
    if (!r.ok) return httpErr(r);
    return readLines(r, function (ln) { ln = ln.trim(); if (!ln) return; var j; try { j = JSON.parse(ln); } catch (e) { return; } if (j.error) throw new Error(String(j.error)); var c = j.message && j.message.content; if (c) { out += c; onTok(out); } }).then(function () { return out; });
  });
}
function geminiChat(msgs, onTok, sig) {
  var model = aiModelOf("gemini").replace(/^models\//, "") || AI_PROV.gemini.model, sys = "", contents = [], out = "";
  msgs.forEach(function (m) {
    if (m.role === "system") { sys += (sys ? "\n" : "") + m.content; return; }
    var parts = [{ text: m.content }];
    if (m.img) parts.push({ inlineData: { mimeType: "image/jpeg", data: String(m.img).replace(/^data:[^,]*,/, "") } });
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: parts });
  });
  function attempt(think) {
    var gc = { temperature: 0.3 };
    if (think && /2\.5-flash/.test(model)) gc.thinkingConfig = { thinkingBudget: 0 };
    else if (think && /gemini-3/.test(model)) gc.thinkingConfig = { thinkingLevel: "low" };
    var body = { contents: contents, generationConfig: gc }; if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    return fetch(AI_PROV.gemini.url + "/v1beta/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": aiKeyOf("gemini") }, signal: sig, body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok) return httpErr(r).catch(function (e) { if (think && gc.thinkingConfig && /HTTP 400/.test(e.message) && /think/i.test(e.message)) return attempt(false); throw e; });
      return readLines(r, function (ln) { ln = ln.trim(); if (ln.indexOf("data:") !== 0) return; var j; try { j = JSON.parse(ln.slice(5)); } catch (e) { return; } var c = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts; if (c) c.forEach(function (pp) { if (pp.text && !pp.thought) { out += pp.text; onTok(out); } }); }).then(function () { return out; });
    });
  }
  return attempt(true);
}
function oaiChat(msgs, onTok, sig) {
  var headers = { "Content-Type": "application/json" }, key = aiKeyOf("openai"), out = "";
  if (key) headers.Authorization = "Bearer " + key;
  var body = { model: aiModelOf("openai"), stream: true, temperature: 0.3, messages: msgs.map(function (m) { return { role: m.role, content: m.img ? [{ type: "text", text: m.content }, { type: "image_url", image_url: { url: m.img } }] : m.content }; }) };
  return aiFetch(aiUrlOf("openai") + "/chat/completions", { method: "POST", headers: headers, signal: sig, body: JSON.stringify(body) }).then(function (r) {
    if (!r.ok) return httpErr(r);
    var ct = (r.headers && r.headers.get && r.headers.get("content-type")) || "";
    if (/json/.test(ct) && !/event-stream/.test(ct)) return r.json().then(function (j) { var t = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : ""; onTok(t); return t; });
    return readLines(r, function (ln) { ln = ln.trim(); if (ln.indexOf("data:") !== 0) return; var d = ln.slice(5).trim(); if (!d || d === "[DONE]") return; var j; try { j = JSON.parse(d); } catch (e) { return; } var ch = j.choices && j.choices[0], c = ch && ((ch.delta && ch.delta.content) || (ch.message && ch.message.content)); if (c) { out += c; onTok(out); } }).then(function () { return out; });
  });
}
function chrOpts(img) { var o = { expectedInputs: [{ type: "text", languages: ["es"] }], expectedOutputs: [{ type: "text", languages: ["es"] }] }; if (img) o.expectedInputs.push({ type: "image" }); return o; }
function chrCheck() {
  var LM = window.LanguageModel;
  if (!LM || typeof LM.availability !== "function") { CHR.avail = "unavailable"; return Promise.resolve("unavailable"); }
  return Promise.resolve().then(function () { return LM.availability(chrOpts(false)); }).then(function (a) { CHR.avail = a; return a; }, function () { CHR.avail = "unavailable"; return "unavailable"; });
}
function dataURLtoBlob(u) { var p = String(u).split(","), mime = (p[0].match(/:(.*?);/) || [])[1] || "image/jpeg", b = atob(p[1] || ""), n = b.length, a = new Uint8Array(n); while (n--) a[n] = b.charCodeAt(n); return new Blob([a], { type: mime }); }
function chrChat(msgs, onTok) {
  var LM = window.LanguageModel;
  if (!LM || typeof LM.create !== "function") return Promise.reject(new Error("chrome-no"));
  var sys = msgs.filter(function (m) { return m.role === "system"; }).map(function (m) { return m.content; }).join("\n");
  var hist = msgs.filter(function (m) { return m.role !== "system"; }), last = hist.pop() || { content: "" }, img = last.img;
  var o = chrOpts(img), ctrl = window.AbortController ? new AbortController() : null; ASK.ctrl = ctrl;
  o.initialPrompts = [{ role: "system", content: sys }].concat(hist.map(function (m) { return { role: m.role === "assistant" ? "assistant" : "user", content: m.content }; }));
  if (ctrl) o.signal = ctrl.signal;
  return Promise.resolve().then(function () { return LM.create(o); }).then(function (s) {
    var input = img ? [{ role: "user", content: [{ type: "text", value: last.content }, { type: "image", value: dataURLtoBlob(img) }] }] : last.content, out = "";
    var stream = s.promptStreaming(input, ctrl ? { signal: ctrl.signal } : undefined), rd = stream.getReader();
    function pump() { return rd.read().then(function (z) { if (z.done) { try { s.destroy(); } catch (e) {} return out; } var ch = String(z.value == null ? "" : z.value); out = out && ch.indexOf(out) === 0 ? ch : out + ch; onTok(out); return pump(); }); }
    return pump();
  });
}
function chrStateText() { var a = CHR.avail; return !window.LanguageModel ? "este navegador no la tiene" : a === "available" ? "lista" : a === "downloadable" ? "hay que descargarla (toca «Preparar la IA de Chrome»)" : a === "downloading" ? "descargando" : a === "unavailable" ? "tu equipo no cumple los requisitos" : "revisando…"; }
function chromePrep() {
  var out = $("ai-out"), LM = window.LanguageModel; if (!out) return;
  if (!LM || typeof LM.create !== "function") { out.textContent = "Este navegador no tiene la IA de Chrome. Necesitas Chrome 148 o más nuevo en una laptop (Windows, Mac o Linux); en el celular no está."; return; }
  out.textContent = "Revisando…";
  chrCheck().then(function (a) {
    var st = $("chr-st"); if (st) st.textContent = chrStateText();
    if (a === "unavailable") { out.textContent = "Tu equipo no cumple lo que pide la IA de Chrome (22 GB libres y una tarjeta de video de más de 4 GB, o 16 GB de RAM con 4 núcleos)."; return; }
    if (a === "available") { out.textContent = "Lista: la IA de Chrome responde sin internet en esta laptop."; return; }
    out.textContent = "Descargando el modelo (varios GB)… deja la página abierta.";
    var o = chrOpts(false); o.monitor = function (m) { m.addEventListener("downloadprogress", function (e) { out.textContent = "Descargando el modelo: " + Math.round((e.loaded || 0) * 100) + "%…"; }); };
    return Promise.resolve(LM.create(o)).then(function (s) { try { s.destroy(); } catch (e) {} CHR.avail = "available"; var st2 = $("chr-st"); if (st2) st2.textContent = chrStateText(); out.textContent = "Lista: la IA de Chrome responde sin internet en esta laptop."; });
  }).catch(function (e) { out.textContent = "No se pudo preparar: " + ((e && e.message) || e); });
}
function eqNamesText() {
  var inv = eqInv();
  return "«las 2 principales» (par armable; discos: " + inv.discs.map(function (d) { return d.n + " de " + kgTxt(d.kg) + " kg"; }).join(", ") + "; cada barra con collares " + kgTxt(inv.bar) + " kg), «1 principal · N kg» (los discos juntos en una sola), «la antigua» (" + kgTxt(inv.antigua) + " kg), «los 2 vinilos» (" + kgTxt(inv.vinilo) + " kg c/u), «mochila». La barra conectora no se usa.";
}
function planSummary(plan) {
  return plan.blocks.map(function (o) {
    var b = o.b, head = b.label + " " + b.name + " (" + fmt(o.start) + "-" + fmt(o.end) + ")";
    if (b.kind === "list") return head + ": " + b.items.map(function (it) { return it.name; }).join(", ");
    return head + ": " + blockExs(b).map(function (e) { var x = resolve(e), lt = effLoadText(x); return x.code + " " + x.name + " " + (b.kind === "phase" ? secsLabel(x.hold) : doseText(x, plan.opts && plan.opts.deload)) + (lt && !/peso corporal/i.test(lt) ? ", " + lt : ""); }).join("; ");
  }).join(" | ");
}
function kneeContext() {
  var parts = [], f = rec("flt_" + TODAY()), mk = rec("chk_" + TODAY() + "_manana");
  if (f && f.mode) parts.push("Filtro de rodilla de hoy: " + (f.mode === "full" ? "sesión completa" : f.mode === "mod" ? "sesión modificada" : "sin pierna") + ".");
  if (mk) parts.push("Chequeo de esta mañana: dolor " + mk.pain + "/10, " + (mk.vs === "peor" ? "peor que lo normal" : "igual o mejor") + ".");
  var st = weekStats(TODAY()); if (st.knee != null) parts.push("Rodilla al despertar esta semana: " + st.knee + "/10 de promedio.");
  return parts.join(" ");
}
function aiContext(x, budget) {
  budget = budget || 7000;
  var parts = [], today = TODAY(), Dt = DAYS[dayKeyOf(today)], n = phaseN();
  parts.push("Hoy es " + Dt.day.toLowerCase() + " " + shortDate(today) + ". Fase del plan: " + n + " (" + PHASES[n].name + "): " + PHASES[n].items.join(", ") + ".");
  if (P.active && !P.done) {
    var o = (P.plan && P.plan.opts) || {};
    parts.push("Sesión en curso: " + P.title + ". Lleva " + fmt(P.elapsed) + " de " + fmt(P.total) + "." + (o.mode === "mod" ? " Filtro de rodilla: sesión modificada." : o.mode === "stop" ? " Filtro de rodilla: hoy sin pierna." : "") + (o.deload ? " Semana de descarga." : ""));
    var st = P.steps[P.idx]; if (st) parts.push("Paso actual: " + stepLabel(st) + ".");
    var nx = nextWork(P.idx); if (nx) parts.push("Sigue: " + stepLabel(nx) + ".");
    if (P.kind === "session") parts.push("Faltan " + remainingSets() + " series.");
    if (P.lastLog && !P.lastLog.skip) parts.push("Última serie anotada: " + P.lastLog.code + " serie " + P.lastLog.s + ": " + (P.lastLog.t != null ? P.lastLog.t + " s" : P.lastLog.r + " repeticiones") + (P.lastLog.rir != null ? ", RIR " + P.lastLog.rir : "") + (P.lastLog.auto ? " (sin confirmar)" : "") + ".");
  }
  if (x) {
    parts.push("Ejercicio en cuestión: " + JSON.stringify(exFicha(x)));
    var lib = EX[x.id] || {};
    if (lib.ladder) parts.push("Escalera: " + lib.ladder.map(function (r, i) { return (i + 1) + ") " + rungText(lib, i) + (rungPhase(lib, i) > n ? " [bloqueado hasta la fase 2]" : ""); }).join("; ") + ". Está en el nivel " + (Math.min(x.rung || 0, lib.ladder.length - 1) + 1) + ".");
    if (x.follow) parts.push("Su peso lo marca " + ((EX[x.follow] || {}).name || "") + " (comparten mancuernas).");
    var bn = blockNote(x); if (bn) parts.push("Nota del bloque: " + bn);
    var h = historyOf(x.id, 2); if (h.length) parts.push("Últimas veces (por serie; * = sin confirmar): " + h.map(function (s) { return lastLine([s]); }).join(" | ") + ".");
  }
  var kc = kneeContext(); if (kc) parts.push(kc);
  var lt = aiLongTerm(x); if (lt) parts.push(lt);
  parts.push("Reglas: " + RULES.map(function (r) { return r[0] + ": " + r[1]; }).join(" | "));
  parts.push("Pesas (usa solo estos nombres): " + eqNamesText());
  var D = P.active && P.key ? DAYS[P.key] : relevantDay();
  if (D && D.type !== "rest") { try { var plan = P.active && P.plan ? P.plan : (D.type === "aero" ? buildPlan(D, { mode: "full", deload: false }) : planFor(D, dateOfKey(D.key))); parts.push("Plan del " + D.day.toLowerCase() + ": " + planSummary(plan)); } catch (e) {} }
  var s = parts.join("\n");
  return s.length > budget ? s.slice(0, budget) + "…" : s;
}
function aiSys(mode) {
  return [
    "Eres el entrenador de la app de " + NOMBRE + " (" + APPN + "): " + (PF.resumen || "entrena en casa con un plan de fuerza, hipertrofia, rodilla y aeróbico") + ". Respondes en español neutro, claro y práctico, como un buen entrenador que conoce su plan al detalle.",
    mode === "live" ? "Conversas por voz en tiempo real mientras " + NOMBRE + " entrena, con el celular a 2-3 metros. Habla en español neutro, natural y breve: 1 o 2 frases por turno, salvo que te pida explicar algo; sin listas. La app ya anuncia con su propia voz los pasos, las series, los descansos y los tiempos: si oyes esos avisos, no respondas ni los repitas. Si lo que oyes no va dirigido a ti (otra persona, la tele, música, ruido) o son palabras sueltas sin sentido, quédate callado. Cuando " + NOMBRE + " dice un comando corto («listo», «pausa», «sigue», «hice ocho»), la app lo hace al instante: no lo repitas ni lo comentes. Usa las funciones: estado_sesion antes de responder algo que dependa del momento de la sesión; anotar_serie cuando diga cuántas repeticiones hizo (y el RIR si lo dice); control_sesion para pasar, volver, pausar, seguir, dar más tiempo o repetir el aviso; progreso para cómo va a largo plazo; guardar_nota si pide recordar algo; cortar_por_rodilla solo si confirma dolor de rodilla en un ejercicio que la carga. Después de usar una función, confirma en pocas palabras." : mode === "review" ? "Tus respuestas se leen en pantalla." :
    mode === "voice" ? "Tu respuesta se leerá en voz alta mientras entrena a 2-3 metros del celular: 1 a 3 frases cortas, sin listas, sin markdown y sin emojis." : mode === "set" ? "Comenta la serie que acaba de terminar en 1 o 2 frases: qué estuvo bien y una sola corrección o decisión concreta. Sin listas ni markdown." : "Responde en 2 a 6 frases; si ayuda, una lista corta de pasos. Sin relleno.",
    "Usa primero los datos de la app (ficha, plan, escalera, reglas, historial). Si algo no está, dilo y da la opción más prudente. No diagnostiques lesiones; si un dolor sigue o empeora, sugiere consultarlo con un profesional.",
    "Reglas de rodilla que nunca contradices: dolor de rodilla mayor a 2/10, sensación de hueso desubicado o chasquido con dolor = se corta ese ejercicio. En la fase 1, nada de saltos ni impacto. No propongas apoyar las rodillas en el piso.",
    "Para las pesas usa solo los nombres de la app: «las 2 principales», «1 principal · N kg», «la antigua», «los 2 vinilos», «mochila». Los kilos son de discos; cada barra con collares pesa aparte. Nunca digas «consolidada» ni «fija».",
    "Si recibes una foto con el esqueleto dibujado, describe solo lo que se ve y da una corrección concreta; si la foto no alcanza para juzgar, dilo."
  ].join("\n");
}
function aiMsgs(mode, x, q, img) {
  var budget = aiProv() === "chrome" ? 3500 : 7000;
  return [{ role: "system", content: aiSys(mode) + "\n\nDatos de la app:\n" + aiContext(x, budget) }].concat(mode === "set" ? [] : ASK.hist.slice(-6)).concat([{ role: "user", content: q, img: img || null }]);
}
function aiErr(e) {
  var m = String((e && e.message) || e), p = aiProv(), model = aiModelOf(p);
  if ((e && e.name === "AbortError") || /abort/i.test(m)) return "Pregunta cancelada.";
  if (m === "chrome-no") return "Este navegador no tiene la IA de Chrome (necesitas Chrome 148 o más nuevo en una laptop).";
  if (e && e.name === "NotAllowedError") return "La IA de Chrome necesita que la prepares una vez: Ajustes → Asistente con IA → «Preparar la IA de Chrome».";
  if (p === "chrome") return "La IA de Chrome no respondió (" + m.slice(0, 120) + ").";
  if (/HTTP 429/.test(m)) return "Llegaste al límite gratis por ahora (por minuto o por día). Espera un poco y vuelve a preguntar.";
  if (p === "gemini" && /HTTP 40[03]/.test(m) && /(api key|api_key|key not valid|permission|unregistered)/i.test(m)) return "Google rechazó la clave. Revisa que la copiaste completa (Ajustes → Asistente con IA).";
  if (/HTTP 404/.test(m)) return p === "ollama" ? "Ollama no tiene el modelo «" + model + "». En la laptop corre: ollama pull " + model : "No existe el modelo «" + model + "» en ese servicio. Toca «Probar conexión» para ver los disponibles.";
  if (/HTTP 403/.test(m) && p === "ollama") return "Ollama rechazó esta página. Ábrelo con OLLAMA_ORIGINS (está en el LEEME) y reinícialo.";
  if (/HTTP 401/.test(m)) return "La clave no es válida.";
  if (/HTTP 400/.test(m)) return "El servicio no aceptó la pregunta (" + m.slice(0, 160) + ").";
  if (/HTTP 5\d\d/.test(m)) return "El servicio de IA tuvo un problema. Prueba otra vez en un rato.";
  if (p === "gemini") return "No pude conectar con Gemini. ¿Hay internet?";
  if (p === "ollama") return "No pude conectar con Ollama en " + aiUrlOf("ollama") + ". ¿Está abierto en la laptop? Desde el celular usa la IP de la laptop (no localhost), la misma wifi, y acepta el permiso de «red local».";
  return "No pude conectar con " + aiUrlOf(p) + ".";
}
function aiClean(t) { return String(t || "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\s*[*-]\s+/gm, "• ").trim(); }
function askAI(q, x, img, box, mode) {
  mode = mode || "chat";
  var host = document.createElement("div"); host.className = "ai-ans";
  host.innerHTML = '<span class="src">' + esc(aiName()) + '</span><p class="ai-t">Pensando…</p>';
  (box || askPush(q, "")).appendChild(host);
  var tEl = host.querySelector(".ai-t"), feed = pref("aiSpeak", true) ? speakStream() : null;
  return aiChat(aiMsgs(mode, x, q, img), function (txt) { tEl.textContent = aiClean(txt) || "Pensando…"; if (feed) feed(txt, false); })
    .then(function (txt) {
      var c = aiClean(txt); tEl.textContent = c || "La IA no respondió nada.";
      if (c) { if (feed) feed(txt, true); chatPush(q, c); }
      return c;
    })
    .catch(function (e) { tEl.textContent = aiErr(e); tEl.classList.add("err"); return ""; });
}
function aiVoice(q, x, fallback) {
  hfMsg("Pensando: «" + q + "»");
  var feed = speakStream(), shown = false;
  aiChat(aiMsgs("voice", x, q, null), function (t) { var c = aiClean(t); if (c) { fbShow(c, 15000); if (!shown) { shown = true; hfMsg("Respondiendo…"); } } feed(t, false); }).then(function (txt) {
    var c = aiClean(txt);
    if (!c) { if (fallback) { fbShow(fallback, 12000); say(fallback, true); } return; }
    feed(txt, true); chatPush(q, c); fbShow(c, 15000);
  }).catch(function (e) { var msg = aiErr(e); fbShow(msg, 10000); say(fallback || msg, true); });
}
function aiSetComment(st, e) {
  var x = st.ex;
  var q = "Terminé " + stepLabel(st) + ": " + (e.t != null ? e.t + " s" : e.r + " repeticiones") + (e.rir != null ? ", RIR " + e.rir : "") + ". Objetivo: " + setDose(x) + (x.tempo ? ", tempo " + x.tempo : "") + "." +
    (e.q ? " La cámara midió" + (e.q.e != null ? ": bajada " + e.q.e + " s, subida " + e.q.c + " s" : "") + (e.q.w ? "; avisos: " + Object.keys(e.q.w).map(function (k) { return WARN_TXT[k] || k; }).join(", ") : "") + "." : "");
  aiChat(aiMsgs("set", x, q, null), null).then(function (txt) { var c = aiClean(txt); if (!c || !P.active || P.done) return; fbShow(c, 12000); if (pref("aiSpeak", true)) say(c, false); }).catch(function () {});
}
function aiTest() {
  var out = $("ai-out"), p = aiProv(); if (!out) return;
  if (!p) { out.textContent = "Elige una IA primero."; return; }
  out.textContent = "Probando…";
  if (p === "chrome") { chrCheck().then(function (a) { var st = $("chr-st"); if (st) st.textContent = chrStateText(); out.textContent = a === "available" ? "Lista: responde sin internet." : a === "unavailable" ? "No está disponible en este equipo o navegador." : "Falta descargarla: toca «Preparar la IA de Chrome»."; }); return; }
  if (typeof fetch !== "function") { out.textContent = "Este navegador no puede conectarse."; return; }
  if (p === "gemini" && !aiKeyOf("gemini")) { out.textContent = "Pega tu clave de Google primero."; return; }
  var url, hd = {};
  if (p === "ollama") url = aiUrlOf("ollama") + "/api/tags";
  else if (p === "gemini") { url = AI_PROV.gemini.url + "/v1beta/models?pageSize=200"; hd["x-goog-api-key"] = aiKeyOf("gemini"); }
  else { url = aiUrlOf("openai") + "/models"; if (aiKeyOf("openai")) hd.Authorization = "Bearer " + aiKeyOf("openai"); }
  aiFetch(url, { headers: hd }).then(function (r) { if (!r.ok) return httpErr(r); return r.json(); }).then(function (j) {
    var ids = p === "ollama" ? (j.models || []).map(function (m) { return m.name || m.model; }) :
      p === "gemini" ? (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0; }).map(function (m) { return String(m.name).replace(/^models\//, ""); }) :
      (j.data || []).map(function (m) { return m.id; });
    var dl = $("ai-models"); if (dl) dl.innerHTML = ids.map(function (id) { return '<option value="' + esc(id) + '">'; }).join("");
    var want = aiModelOf(p), note = "";
    if (ids.length && ids.indexOf(want) < 0 && !(p === "ollama" && ids.indexOf(want + ":latest") >= 0)) {
      var alt = p === "gemini" ? ids.filter(function (id) { return /flash/.test(id) && !/(image|tts|live|audio|embed|thinking|exp|preview|lite|translate|transcribe|robotics)/.test(id); }).sort(function (a, b) { var va = parseFloat((a.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]), vb = parseFloat((b.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]); return vb - va; })[0] : null;
      if (alt) { setPref("aiModel_gemini", alt); var mi = $("ai-model"); if (mi) mi.value = alt; note = " No encontré «" + want + "»; dejé «" + alt + "»."; }
      else note = p === "ollama" ? " Ojo: no veo «" + want + "». En la laptop corre: ollama pull " + want + "." : " Ojo: no veo «" + want + "» en la lista.";
    }
    out.textContent = "Conectado." + (p === "gemini" ? " " + ids.length + " modelos disponibles." : " Modelos: " + (ids.slice(0, 12).join(", ") || "ninguno") + ".") + note;
    if (p === "gemini") liveFind().then(function (m) { if (m) { setPref("liveModel", m); var lm = $("live-model"); if (lm) lm.value = m; out.textContent += " Conversación en tiempo real: " + m + "."; } });
  }).catch(function (e) { out.textContent = aiErr(e); });
}
function aiProvHTML(p) {
  var dl = '<datalist id="ai-models"></datalist>';
  if (p === "ollama") return '<div class="ai-form"><label>Dirección de Ollama<input id="ai-url" type="url" inputmode="url" spellcheck="false" value="' + esc(aiUrlOf("ollama")) + '"></label><label>Modelo<input id="ai-model" type="text" list="ai-models" spellcheck="false" value="' + esc(aiModelOf("ollama")) + '"></label>' + dl + "</div>" +
    '<p class="muted">Gratis y sin internet, en tu laptop. En la laptop: http://localhost:11434. Desde el celular: la IP de la laptop en la misma wifi (por ejemplo http://192.168.1.20:11434) y acepta el permiso de «red local». Para que mire fotos, usa un modelo con visión como gemma3:4b. Antes abre Ollama con OLLAMA_ORIGINS (está en el LEEME).</p>';
  if (p === "gemini") return '<div class="ai-form"><label>Clave de API de Google<input id="ai-key" type="password" autocomplete="off" spellcheck="false" value="' + esc(aiKeyOf("gemini")) + '"></label><label>Modelo<input id="ai-model" type="text" list="ai-models" spellcheck="false" value="' + esc(aiModelOf("gemini")) + '"></label>' + dl + "</div>" +
    '<p class="muted">Funciona en el celular y en la laptop, con internet. La clave es gratis: entra a aistudio.google.com con tu cuenta de Google y toca «Get API key». El plan gratis tiene un límite de preguntas por minuto y por día. Tus preguntas y los datos de la sesión se envían a Google, y en el plan gratis Google puede usarlos para mejorar sus productos. La clave queda solo en este equipo.</p>';
  if (p === "chrome") return '<p class="muted">Corre dentro de Chrome, sin internet y sin cuenta, solo en laptop (Windows 10/11, macOS 13 o más nuevo, Linux o Chromebook Plus) con Chrome 148 o más nuevo. Pide unos 22 GB libres y una tarjeta de video de más de 4 GB, o 16 GB de RAM con 4 núcleos. En el celular no está. Estado: <b id="chr-st">' + esc(chrStateText()) + "</b>.</p>";
  return '<div class="ai-form"><label>Dirección del servidor (termina en /v1)<input id="ai-url" type="url" inputmode="url" spellcheck="false" value="' + esc(aiUrlOf("openai")) + '"></label><label>Modelo<input id="ai-model" type="text" list="ai-models" spellcheck="false" value="' + esc(aiModelOf("openai")) + '"></label>' + dl + '<label>Clave (solo si tu servidor la pide)<input id="ai-key" type="password" autocomplete="off" value="' + esc(aiKeyOf("openai")) + '"></label></div>' +
    '<p class="muted">Cualquier servidor compatible con OpenAI: LM Studio (http://localhost:1234/v1), llama.cpp, Jan… Si es un servicio en internet, tus preguntas y la ficha se envían a ese servicio.</p>';
}
function aiSettingsHTML() {
  var p = aiProv();
  var h = '<details class="card" data-k="ia"><summary>Asistente con IA (opcional)</summary>' +
    '<p class="muted">Sin IA, las dudas se responden con tu ficha y la cámara cuenta y corrige igual. Con una IA, también responde preguntas libres, recuerda lo último que hablaron y conoce tu sesión. Todas estas opciones son gratis.</p>' +
    '<div class="opts ai-provs">' + [["", "Ninguna"], ["ollama", "Ollama (laptop)"], ["gemini", "Gemini gratis"], ["chrome", "IA de Chrome"], ["openai", "Otro servidor"]].map(function (o) { return '<button class="opt-btn' + (p === o[0] ? " on" : "") + '" data-act="aiprov" data-v="' + o[0] + '" type="button">' + o[1] + "</button>"; }).join("") + "</div>";
  if (p) h += aiProvHTML(p) + '<div class="set-grid">' +
    toggleRow("aiSpeak", "Leer en voz alta las respuestas de la IA", prefVal("aiSpeak")) +
    toggleRow("aiSet", "Comentario de la IA después de cada serie", !!pref("aiSet", false)) +
    toggleRow("aiVision", "Permitir mandarle una foto de la cámara", !!pref("aiVision", false)) + "</div>" +
    '<div class="hero-actions"><button class="btn" data-act="aitest" type="button">Probar conexión</button>' + (p === "chrome" ? '<button class="btn quiet" data-act="chromeprep" type="button">Preparar la IA de Chrome</button>' : "") + "</div>";
  h += '<p class="muted" id="ai-out" aria-live="polite"></p>';
  h += liveSettingsHTML();
  h += '<h3 class="mini">Dictado</h3><div class="hero-actions"><button class="btn quiet" data-act="asrcheck" type="button">Revisar dictado sin internet</button></div><p class="muted" id="asr-out" aria-live="polite"></p></details>';
  return h;
}
function hfSettingsHTML() {
  return '<details class="card" data-k="manos"><summary>Asistente de voz (manos libres)</summary>' +
    '<p class="muted">Para entrenar con el celular a 2-3 m sin tocarlo. Se prende con el botón «Asistente» de la sesión. Con tu clave gratis de Google e internet usa Gemini Live (conversa y maneja la sesión); sin eso, entiende los comandos de abajo.</p><div class="set-grid">' +
    toggleRow("asst", "Asistente encendido en cada sesión", asstOn()) +
    optRow("Micrófono", "micmode", [["normal", "Normal"], ["ruido", "Hay ruido o tele"], ["lejos", "Estoy lejos del celular"]], pref("micMode", "normal")) +
    toggleRow("autoItems", "Calentamiento y enfriamiento avanzan solos", autoItemsOn()) +
    toggleRow("camGest", "Con la cámara: manos arriba 1 segundo = «Hecho»", prefVal("camGest")) + "</div>" +
    '<h3 class="mini">Lo que entiendo</h3><ul class="plain hf-list">' + HF_HELP.map(function (r) { return "<li><b>" + esc(r[0]) + "</b> " + esc(r[1]) + "</li>"; }).join("") + "</ul>" +
    '<p class="muted">' + (hfSupported() ? "El reconocimiento de voz de Chrome normalmente usa internet (abajo, en el asistente, puedes revisar si hay dictado sin internet). En Android puede sonar un aviso cada vez que vuelve a escuchar; si molesta, usa el gesto con la cámara." : "Este navegador no reconoce la voz: usa Chrome. El gesto con la cámara funciona igual.") + "</p></details>";
}

/* ---------- 7. Fases, pruebas y fotos ---------- */
var PHASES = {
  1: { name: "Proteger", items: ["Caja a 45°, cero saltos", "Pierna completa sin impacto", "VO2max: 4×4 caminando en cuesta", "Sábado sin impacto"] },
  2: { name: "Recuperar", items: ["Caja más baja poco a poco", "10 saltos pequeños el sábado", "4×4 trotando en cuesta", "Zancada en el miércoles"] },
  3: { name: "Agilidad", items: ["Cambios de dirección", "Subidas cortas", "Saltos más altos en dosis baja", "Revisión anual"] }
};
var GATE1 = [["eval", "Visto bueno del profesional que evaluó tu rodilla"], ["pain", "Dolor de rodilla de 1/10 o menos durante 4 semanas"], ["sd20", "Step-down de 20 cm × 10 limpio, por pierna"], ["bal", "Equilibrio con ojos cerrados 30 s por pierna"]];
var GATE2 = [["g2a", "Saltos sin dolor durante 4 semanas"], ["g2b", "Caja baja sin sensación de hueso desubicado"], ["g2c", "Aterrizaje a una pierna estable"]];
function faseRec() { return rec("fase") || { id: "fase", k: "fase", n: 1, crit: {}, hist: [] }; }
function phaseN() { var n = +faseRec().n || 1; return n < 1 ? 1 : n > 3 ? 3 : n; }
function rungPhase(lib, i) { return /^\s*fase 2/i.test(rungText(lib, i)) ? 2 : 1; }
function testsAll() { return recsOf("test").filter(function (r) { return r.d; }).sort(function (a, b) { return a.d < b.d ? 1 : -1; }); }
function lastTest() { return testsAll()[0] || null; }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function testDue() { var t = lastTest(); return !t || daysBetween(t.d, TODAY()) >= 84; }
function painWeeks() { var out = []; for (var w = 1; w <= 4; w++) out.push(weekStats(addDays(TODAY(), -7 * w)).knee); return out; }
function gate1State() {
  var c = faseRec().crit || {}, pw = painWeeks(), painAuto = pw.every(function (v) { return v != null && v <= 1; });
  var t = lastTest(), balAuto = !!(t && t.balL >= 30 && t.balR >= 30);
  return { eval: !!c.eval, pain: painAuto || !!c.pain, painAuto: painAuto, pw: pw, sd20: !!c.sd20, bal: balAuto || !!c.bal, balAuto: balAuto, test: t };
}
function phaseCrit(c, on) { var F = clone(faseRec()); F.crit = F.crit || {}; F.crit[c] = !!on; if (on) F.crit[c + "D"] = TODAY(); put(F); renderGlobal(); }
function phaseSet(n) { var F = clone(faseRec()); F.hist = (F.hist || []).concat([{ n: n, d: TODAY(), from: F.n || 1 }]); F.n = n; F.since = TODAY(); put(F); rerender(); }
function gateItem(id, label, on, note, auto) {
  return '<li><label><input type="checkbox" class="ph-crit" data-c="' + id + '"' + (on ? " checked" : "") + (auto ? " disabled" : "") + "><span>" + esc(label) + (note ? "<small>" + esc(note) + "</small>" : "") + "</span></label></li>";
}
function phaseCardHTML() {
  var n = phaseN(), F = faseRec(), c = F.crit || {}, g = gate1State();
  var h = '<details class="card phase" data-k="fase"><summary>Tu fase: ' + n + " · " + esc(PHASES[n].name) + "</summary>";
  h += '<ol class="ph-steps">' + [1, 2, 3].map(function (i) { return '<li class="' + (i < n ? "past" : i === n ? "cur" : "") + '"><b>Fase ' + i + " · " + esc(PHASES[i].name) + "</b><span>" + esc(PHASES[i].items.join(" · ")) + "</span></li>"; }).join("") + "</ol>";
  if (n === 1) {
    var pwTxt = "Tus registros, de la semana pasada hacia atrás: " + g.pw.map(function (v) { return v == null ? "sin datos" : v + "/10"; }).join(" · ") + (g.painAuto ? ". Cumplido." : ". Se marca solo cuando las 4 semanas están en 1/10 o menos; si no los registraste, márcalo tú.");
    var balTxt = g.test ? "Última prueba: " + (g.test.balL == null ? "–" : g.test.balL + " s") + " y " + (g.test.balR == null ? "–" : g.test.balR + " s") + "." : "Se marca solo con la prueba de los 3 meses (domingo), o márcalo tú.";
    h += '<h3 class="mini">Puerta 1: para pasar a la fase 2</h3><ul class="checks ph-gate">' +
      gateItem("eval", GATE1[0][1], g.eval, c.evalD ? "Marcado el " + shortDate(c.evalD) + "." : "") +
      gateItem("pain", GATE1[1][1], g.pain, pwTxt, g.painAuto) +
      gateItem("sd20", GATE1[2][1], g.sd20, "Sin que la rodilla se vaya hacia adentro y sin dolor.") +
      gateItem("bal", GATE1[3][1], g.bal, balTxt, g.balAuto) + "</ul>";
    var all = g.eval && g.pain && g.sd20 && g.bal;
    h += '<p class="muted">Al pasar: el sábado suma 10 saltos pequeños (dura 21 min), en el martes se abre el 4×4 trotando y se desbloquean los peldaños «Fase 2».</p>';
    h += '<button class="btn' + (all ? " primary" : "") + '" data-act="phaseup" type="button"' + (all ? "" : " disabled") + ">Pasar a la fase 2</button>";
  } else if (n === 2) {
    var all2 = GATE2.every(function (x) { return !!c[x[0]]; });
    h += '<h3 class="mini">Puerta 2: para pasar a la fase 3</h3><ul class="checks ph-gate">' + GATE2.map(function (x) { return gateItem(x[0], x[1], !!c[x[0]], ""); }).join("") + "</ul>";
    h += '<div class="hero-actions"><button class="btn' + (all2 ? " primary" : "") + '" data-act="phaseup" type="button"' + (all2 ? "" : " disabled") + '>Pasar a la fase 3</button><button class="btn quiet" data-act="phasedown" type="button">Volver a la fase 1</button></div>';
    h += '<p class="muted">Si la rodilla empeora dos semanas seguidas, vuelve a la fase 1 y a evaluación.</p>';
  } else {
    h += '<p>La app no cambia las sesiones en la fase 3: suma los cambios de dirección, las subidas cortas y los saltos más altos en dosis baja como te indique tu evaluación, y haz la revisión anual.</p><div class="hero-actions"><button class="btn quiet" data-act="phasedown" type="button">Volver a la fase 2</button></div>';
  }
  if (testDue()) h += '<p class="adv prep">Toca hacer las pruebas de cada 3 meses: están en el seguimiento del domingo.</p>';
  return h + "</details>";
}
/* Sábado en fase 2: 10 saltos de 4:00 a 5:00 y el circuito de 5:00 a 17:00 */
var JUMPS = { id: "J", label: "Saltos", name: "Saltos pequeños (fase 2)", start: 240, end: 300, kind: "list", tone: "fuerza", items: [
  { name: "Saltos pequeños", dose: "10", est: 45, skipMod: true, how: "Saltos de 5-10 cm en el lugar, aterrizando suave sobre la parte delantera del pie con las rodillas sobre el segundo dedo. Pausa de 1-2 s entre saltos si hace falta. Si la rodilla avisa, paras ahí." }
] };
function sabPhase2(D) {
  var out = {}, k; for (k in D) out[k] = D[k];
  var bl = [];
  D.blocks.forEach(function (b) {
    if (b.start >= 240) { var c = {}; for (var kk in b) c[kk] = b[kk]; c.start = b.start + 60; c.end = b.end + 60; bl.push(c); } else bl.push(b);
    if (b.id === "cal") bl.push(JUMPS);
  });
  out.blocks = bl; out.window = "6:15 a 6:36";
  return out;
}
function testsHTML() {
  var due = testDue(), t = lastTest(), list = testsAll().slice(0, 4);
  var h = '<details class="tests"' + (due ? " open" : "") + "><summary>Pruebas cada 3 meses" + (due ? " · toca hacerlas" : " · las próximas desde el " + shortDate(addDays(t.d, 84))) + "</summary>";
  h += '<p class="muted">Un día fresco, antes de entrenar. Así ves si el plan funciona más allá del espejo.</p><div class="grid-in">' +
    numField("t-push", "Flexiones estrictas seguidas (máximo)", "", "1") +
    numField("t-balL", "Equilibrio ojos cerrados, pierna izquierda (s)", "", "1") +
    numField("t-balR", "Equilibrio ojos cerrados, pierna derecha (s)", "", "1") +
    '<label class="num"><span>2 km a tu ritmo (min:seg)</span><input type="text" inputmode="numeric" id="t-km2" placeholder="15:30"></label>' +
    numField("t-hr2", "Pulso al terminar los 2 km (lpm)", "", "1") +
    numField("t-hang", "Colgado de la barra (s)", "", "1") + "</div>" +
    '<button class="btn" data-act="savetest" type="button">Guardar pruebas de hoy</button><p class="muted" id="t-out" aria-live="polite"></p>';
  if (list.length) {
    h += '<div class="tscroll"><table class="hist"><thead><tr><th>Fecha</th><th>Flexiones</th><th>Equilibrio I / D</th><th>2 km</th><th>Pulso</th><th>Barra</th></tr></thead><tbody>' +
      list.map(function (r) { function v(x, u) { return x == null ? "–" : x + (u || ""); } return "<tr><td>" + esc(shortDate(r.d)) + "</td><td>" + v(r.push) + "</td><td>" + v(r.balL, " s") + " / " + v(r.balR, " s") + "</td><td>" + (r.km2 == null ? "–" : fmt(r.km2)) + "</td><td>" + v(r.hr2) + "</td><td>" + v(r.hang, " s") + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  return h + "</details>";
}
function saveTest() {
  function num(i) { var v = parseFloat(String(($(i) || {}).value || "").replace(",", ".")); return isNaN(v) ? null : v; }
  var km = String(($("t-km2") || {}).value || "").trim(), ks = null, m = km.match(/^(\d{1,2})\s*[:.,']\s*(\d{1,2})$/);
  if (m) ks = (+m[1]) * 60 + (+m[2]); else if (/^\d+$/.test(km)) ks = (+km) * 60;
  var r = { id: "test_" + TODAY(), k: "test", d: TODAY(), push: num("t-push"), balL: num("t-balL"), balR: num("t-balR"), km2: ks, hr2: num("t-hr2"), hang: num("t-hang") };
  var any = ["push", "balL", "balR", "km2", "hr2", "hang"].some(function (k) { return r[k] != null; });
  if (!any) { var out = $("t-out"); if (out) out.textContent = "Escribe al menos una prueba."; return; }
  put(r); rerender();
}
function photoHTML() {
  var f = rec("fotos"), last = f && f.d, days = last ? daysBetween(last, TODAY()) : null;
  if (days != null && days < 28) return '<p class="muted">Fotos del mes: las tomaste el ' + esc(shortDate(last)) + ". Las próximas, desde el " + esc(shortDate(addDays(last, 28))) + ".</p>";
  return '<div class="photo-rem"><p><span class="k">Fotos del mes.</span> Frente, lado y espalda, con la misma luz, ropa y hora; y mide brazo y pecho arriba. Quedan en tu galería, no en la app.</p><button class="btn quiet" data-act="fotos" type="button">Ya las tomé</button></div>';
}

/* =====================================================================
   VERSIÓN 4
   1. Entrenador a largo plazo: lee reps, RIR, cámara, rodilla, medidas y pruebas;
      decide con las reglas del 3.0 y te propone. Tú apruebas (o deja que suba solo
      los peldaños sin rodilla que ya cumplieron la regla).
   2. Tus datos en GitHub: un repositorio privado tuyo junta lo de todos tus equipos, solo.
   3. Actualización sola: cuando subes una versión nueva, se aplica fuera de la sesión.
   4. Conversación en tiempo real: Gemini Live (gratis, con internet) o conversación
      local (Ollama o las respuestas sin internet), con voz que no espera a terminar.
   ===================================================================== */
var APP_VER = "6.0";
var DATAV = 0;   // sube con cada cambio de datos: el entrenador recalcula solo cuando hace falta
PREF_DEF.coachAuto = true; PREF_DEF.liveVad = true; PREF_DEF.live = true;

/* ---------- Utilidades ---------- */
function stable(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  return "{" + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
}
function seq(list, fn) { return list.reduce(function (p, x) { return p.then(function () { return fn(x); }); }, Promise.resolve()); }
function b64enc(str) {
  var bytes = new TextEncoder().encode(String(str)), bin = "", CH = 0x8000;
  for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}
function b64dec(b) {
  var bin = atob(String(b || "").replace(/\s/g, "")), n = bin.length, a = new Uint8Array(n);
  for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(a);
}
function strHash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + s.length; }
function agoText(t) {
  if (!t) return "nunca";
  var s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return "hace " + Math.round(s / 60) + " min";
  if (s < 86400) return "hace " + Math.round(s / 3600) + " h";
  return "hace " + Math.round(s / 86400) + " días";
}

/* ---------- Unir registros de dos equipos sin perder nada ----------
   Regla general: gana la versión más nueva del registro (campo u).
   Registros que juntan varias cosas se unen por partes, cada parte con su hora:
   niveles (un peldaño por ejercicio), config (descargas por semana), ajustes,
   memoria (notas y charla) y entrenador (propuestas descartadas, subidas solas). */
/* Si dos equipos guardaron en el mismo milisegundo, el desempate es siempre el mismo en ambos */
function newer(a, b) { var ua = (a && a.u) || 0, ub = (b && b.u) || 0; if (ua !== ub) return ub > ua ? b : a; return stable(b) > stable(a) ? b : a; }
function mapMerge(A, B, At, Bt, ua, ub) {
  var M = {}, Mt = {}, seen = {};
  A = A || {}; B = B || {}; At = At || {}; Bt = Bt || {};
  Object.keys(A).concat(Object.keys(B)).forEach(function (k) {
    if (seen[k]) return; seen[k] = 1;
    var inA = Object.prototype.hasOwnProperty.call(A, k), inB = Object.prototype.hasOwnProperty.call(B, k);
    var ta = inA ? (At[k] || ua || 0) : -1, tb = inB ? (Bt[k] || ub || 0) : -1;
    if (tb > ta || (tb === ta && stable(B[k]) > stable(A[k]))) { M[k] = B[k]; Mt[k] = tb; } else { M[k] = A[k]; Mt[k] = ta; }
  });
  return [M, Mt];
}
/* Une dos listas sin repetir: misma clave → gana la versión más nueva; el orden final es siempre el mismo
   en todos los equipos (por tiempo y, si empatan, por clave), para que no se peleen subiendo cada uno el suyo. */
function listMerge(a, b, keyFn, max, verFn, ordFn) {
  verFn = verFn || function (e) { return e.u || 0; };
  ordFn = ordFn || function (e) { return e.t || e.ts || 0; };
  var by = {}, out = [];
  (a || []).concat(b || []).forEach(function (e) {
    if (!e) return; var k = keyFn(e), o = by[k];
    if (!o) { by[k] = e; out.push(k); return; }
    var ve = verFn(e), vo = verFn(o);
    if (ve > vo || (ve === vo && stable(e) > stable(o))) by[k] = e;
  });
  out.sort(function (x, y) { var ox = ordFn(by[x]), oy = ordFn(by[y]); if (ox !== oy) return ox - oy; return x < y ? -1 : x > y ? 1 : 0; });
  var arr = out.map(function (k) { return by[k]; });
  return max ? arr.slice(-max) : arr;
}
function cfgDl(c) {   // descargas por semana: { "2026-W41": [1, hora] }
  var dl = {}, k;
  (c.deload || []).forEach(function (w) { dl[w] = [1, c.u || 0]; });
  if (c.dl) for (k in c.dl) dl[k] = c.dl[k];
  return dl;
}
var MERGE = {
  niveles: function (a, b) {
    var m = mapMerge(a.L, b.L, a.Lt, b.Lt, a.u, b.u), r = clone(newer(a, b));
    r.L = m[0]; r.Lt = m[1];
    r.H = listMerge(a.H, b.H, function (e) { return e.x + "|" + e.t + "|" + e.to; }, 300, function () { return 0; }, function (e) { return e.t || 0; });
    r.u = Math.max(a.u || 0, b.u || 0); return r;
  },
  config: function (a, b) {
    var r = clone(newer(a, b)), skip = { id: 1, k: 1, u: 1, _t: 1, dl: 1, deload: 1 }, k;
    var keys = {}; for (k in a) keys[k] = 1; for (k in b) keys[k] = 1;
    r._t = {};
    for (k in keys) {
      if (skip[k]) continue;
      var ta = Object.prototype.hasOwnProperty.call(a, k) ? ((a._t && a._t[k]) || a.u || 0) : -1, tb = Object.prototype.hasOwnProperty.call(b, k) ? ((b._t && b._t[k]) || b.u || 0) : -1;
      if (tb > ta || (tb === ta && stable(b[k]) > stable(a[k]))) { r[k] = b[k]; r._t[k] = tb; } else { r[k] = a[k]; r._t[k] = ta; }
    }
    var da = cfgDl(a), db = cfgDl(b), dl = {};
    Object.keys(da).concat(Object.keys(db)).forEach(function (w) { var x = da[w], y = db[w]; dl[w] = !x ? y : !y ? x : (y[1] > x[1] || (y[1] === x[1] && y[0] > x[0]) ? y : x); });
    r.dl = dl; r.deload = Object.keys(dl).filter(function (w) { return dl[w][0]; }).sort();
    r.u = Math.max(a.u || 0, b.u || 0); return r;
  },
  ajustes: function (a, b) {
    var m = mapMerge(a.p, b.p, a.pt, b.pt, a.u, b.u), r = clone(newer(a, b));
    r.p = m[0]; r.pt = m[1]; r.u = Math.max(a.u || 0, b.u || 0); return r;
  },
  memoria: function (a, b) {
    var r = clone(newer(a, b));
    r.notes = listMerge(a.notes, b.notes, function (e) { return e.id; }, 80, function (e) { return e.u || 0; }, function (e) { return parseInt(String(e.id).slice(1), 36) || e.u || 0; });
    var ca = a.chatFrom || 0, cb = b.chatFrom || 0, from = Math.max(ca, cb);
    r.chat = listMerge(a.chat, b.chat, function (e) { return e.r + "|" + e.ts + "|" + String(e.t || "").slice(0, 24); }, 30, function () { return 0; }, function (e) { return e.ts || 0; }).filter(function (e) { return (e.ts || 0) >= from; });
    r.chatFrom = from; r.u = Math.max(a.u || 0, b.u || 0); return r;
  },
  coach: function (a, b) {
    var m = mapMerge(a.dis, b.dis, a.dist, b.dist, a.u, b.u), r = clone(newer(a, b));
    r.dis = m[0]; r.dist = m[1];
    r.au = listMerge(a.au, b.au, function (e) { return e.x + "|" + e.t; }, 60, function (e) { return e.u || 0; }, function (e) { return e.t || 0; });
    r.u = Math.max(a.u || 0, b.u || 0); return r;
  }
};
function mergeRec(a, b) {
  if (!a) return b; if (!b) return a;
  var f = MERGE[a.id] || MERGE[b.id];
  if (f) { try { return f(a, b); } catch (e) { /* si algo raro, gana el más nuevo */ } }
  return newer(a, b);
}

/* ---------- Ajustes que viajan entre equipos ----------
   Solo lo que es del entrenamiento (tu equipo de discos, cómo registras y tempo).
   Voz, volumen, cámara, IA y claves son de cada equipo y no viajan. */
var SYNC_PREFS = { flujo: 1, topeFin: 1, flujoFin: 1, demoAnim: 1, equip: 1, eq05: 1, coachAuto: 1, tempo: 1, tempoWords: 1, tempoTone: 1, asst: 1, micMode: 1, demo: 1, sideAuto: 1, side2End: 1, prepScreen: 1, logsets: 1, autoItems: 1, camGest: 1, voice: 1, vozRate: 1, aiSpeak: 1, aiSet: 1, aiVision: 1, live: 1, liveCam: 1, liveVad: 1, camAuto: 1, camCount: 1 };
var PREFSYNC = { applying: false };
function prefSyncPut(k, v) {
  if (k === "aiKey_gemini" && typeof keysPut === "function") { keysPut(); return; }   // viaja cifrada, no en «ajustes»
  if (PREFSYNC.applying || !SYNC_PREFS[k]) return;
  var r = clone(rec("ajustes") || { id: "ajustes", k: "prefs", p: {}, pt: {} });
  r.p = r.p || {}; r.pt = r.pt || {};
  if (stable(r.p[k]) === stable(v == null ? null : v)) return;
  r.p[k] = v == null ? null : v; r.pt[k] = Date.now(); put(r);
}
/* Ajustes que ya tenías antes de la versión 4: se suben con fecha «antigua», así cualquier cambio nuevo gana */
function prefSyncSeed() {
  var r = rec("ajustes"), add = {}, any = false, k;
  for (k in SYNC_PREFS) if (ST.prefs[k] != null && !(r && r.p && Object.prototype.hasOwnProperty.call(r.p, k))) { add[k] = ST.prefs[k]; any = true; }
  if (!any) return;
  var n = clone(r || { id: "ajustes", k: "prefs", p: {}, pt: {} }); n.p = n.p || {}; n.pt = n.pt || {};
  for (k in add) { n.p[k] = add[k]; n.pt[k] = 1; }
  put(n);
}
function prefSyncApply() {
  var r = rec("ajustes"); if (!r || !r.p) return;
  PREFSYNC.applying = true;
  try { for (var k in r.p) if (SYNC_PREFS[k] && stable(ST.prefs[k] == null ? null : ST.prefs[k]) !== stable(r.p[k])) { ST.prefs[k] = r.p[k]; } lsSet(LS_KEY + ".prefs", ST.prefs); } finally { PREFSYNC.applying = false; }
}

/* ---------- Tus datos en GitHub ----------
   Un repositorio PRIVADO tuyo (por ejemplo «entreno-datos»), aparte del de la página.
   Los registros se guardan por mes en datos/AAAA-MM.json (más semanas y estado).
   Cada equipo sube lo suyo y baja lo de los otros; si dos cambiaron lo mismo,
   gana lo más nuevo, parte por parte. La clave queda solo en este equipo. */
var GH = { st: null, busy: false, again: false, t: 0, err: "", changed: false, pend: false };
var GH_KEY = LS_KEY + ".gh", GHS_KEY = LS_KEY + ".ghs";
function ghCfg() { return lsGet(GH_KEY); }
function ghSetCfg(c) { lsSet(GH_KEY, c); }
function ghReady() { var c = ghCfg(); return !!(c && c.token && c.owner && c.repo && c.ok); }
function ghAuto() { var c = ghCfg(); return ghReady() && c.auto !== false; }
function ghState() { if (!GH.st) { var s = lsGet(GHS_KEY) || {}; s.sha = s.sha || {}; s.dirty = s.dirty || {}; s.hash = s.hash || {}; GH.st = s; } return GH.st; }
function ghSave() { lsSet(GHS_KEY, ghState()); }
function ghShard(r) {
  var id = String(r && r.id || ""), m = id.match(/(\d{4})-(\d{2})-\d{2}/);
  if (m) return "datos/" + m[1] + "-" + m[2] + ".json";
  m = id.match(/^wk_(\d{4})-W\d+/); if (m) return "datos/semanas-" + m[1] + ".json";
  return "datos/estado.json";
}
function ghLocalShards() { var o = {}; for (var id in ST.recs) { var r = ST.recs[id]; if (r && r.k) o[ghShard(r)] = 1; } return Object.keys(o); }
function ghShardText(path) {
  var recs = {};
  Object.keys(ST.recs).filter(function (id) { var r = ST.recs[id]; return r && r.k && ghShard(r) === path; }).sort().forEach(function (id) { recs[id] = ST.recs[id]; });
  return JSON.stringify({ app: "sistema3", v: 1, archivo: path.replace(/^datos\//, ""), recs: recs }, null, 1);
}
function ghDevName() {
  var n = String(pref("devName", "") || "").trim();
  if (n) return n.slice(0, 30);
  var ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|Mobile/i.test(ua) ? "celular" : "laptop";
}
function ghErrText(st, txt, r) {
  var msg = ""; try { msg = (JSON.parse(txt) || {}).message || ""; } catch (e) { msg = ""; }
  if (st === 401) return "La clave no sirve (venció o se copió mal). Crea otra en GitHub y pégala aquí.";
  if (st === 403 && r && r.headers && r.headers.get && r.headers.get("x-ratelimit-remaining") === "0") return "GitHub pidió esperar un rato (límite de uso). Se reintenta solo.";
  if (st === 403) return "La clave no tiene permiso para escribir. En GitHub, dale «Contents: Read and write» a este repositorio.";
  if (st === 404) return "No encuentro el repositorio. Revisa el usuario y el nombre, y que la clave tenga acceso a ese repositorio.";
  if (st === 409 || st === 422) return "GitHub cambió mientras se guardaba. Vuelve a intentar.";
  return "GitHub respondió con un error (" + st + (msg ? ": " + String(msg).slice(0, 80) : "") + "). Se reintenta en un rato.";
}
function ghApi(c, path, opt) {
  opt = opt || {};
  /* Solo cabeceras que GitHub acepta desde el navegador (CORS): Accept, Authorization y Content-Type */
  var h = { "Accept": opt.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "Authorization": "Bearer " + c.token };
  if (opt.body) h["Content-Type"] = "application/json";
  return fetch("https://api.github.com" + path, { method: opt.method || "GET", cache: "no-store", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) {
    return r.text().then(function (t) {
      if (!r.ok) { var e = new Error(ghErrText(r.status, t, r)); e.status = r.status; throw e; }
      if (opt.raw) return t;
      try { return t ? JSON.parse(t) : null; } catch (er) { return null; }
    });
  }, function () { var e = new Error("Sin internet: se guarda en GitHub cuando vuelva la conexión."); e.status = 0; throw e; });
}
function ghPath(c, p) { return "/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo) + "/contents/" + p.split("/").map(encodeURIComponent).join("/"); }
function ghList(c) {
  return ghApi(c, ghPath(c, "datos")).then(function (arr) {
    var m = {}; (Array.isArray(arr) ? arr : []).forEach(function (f) { if (f && f.type === "file" && /\.json$/.test(f.name)) m[f.path] = f.sha; });
    return m;
  }, function (e) { if (e.status === 404) return {}; throw e; });
}
function ghGet(c, p) {
  return ghApi(c, ghPath(c, p)).then(function (j) {
    if (j && j.encoding === "base64" && j.content) return { sha: j.sha, text: b64dec(j.content) };
    return ghApi(c, ghPath(c, p), { raw: true }).then(function (t) { return { sha: j && j.sha, text: t }; });
  }, function (e) { if (e.status === 404) return { sha: null, text: null }; throw e; });
}
/* Une un archivo de GitHub con lo de este equipo. Devuelve cuántos registros cambiaron aquí y si hay que subir. */
function ghMergeText(p, text) {
  var j; try { j = JSON.parse(text); } catch (e) { return { bad: true, changed: 0, needUp: true }; }
  var R = (j && j.recs) || {}, changed = 0, needUp = false;
  Object.keys(R).forEach(function (id) {
    var r = R[id]; if (!r || !r.id || !r.k) return;
    var L = ST.recs[id], m = mergeRec(L, r);
    if (!L || stable(m) !== stable(L)) { ST.recs[id] = m; changed++; }
    if (stable(m) !== stable(r)) needUp = true;
  });
  Object.keys(ST.recs).forEach(function (id) { var r = ST.recs[id]; if (r && r.k && ghShard(r) === p && !R[id]) needUp = true; });
  return { changed: changed, needUp: needUp };
}
function ghPut(c, p, tries) {
  var st = ghState(), text = ghShardText(p), h = strHash(text);
  if (st.hash[p] === h && st.sha[p]) { delete st.dirty[p]; ghSave(); return Promise.resolve(); }
  var body = { message: "Entreno: " + ghDevName() + " · " + p.replace(/^datos\//, ""), content: b64enc(text) };
  if (st.sha[p]) body.sha = st.sha[p];
  return ghApi(c, ghPath(c, p), { method: "PUT", body: body }).then(function (j) {
    st.sha[p] = j && j.content && j.content.sha; st.hash[p] = h; delete st.dirty[p]; ghSave();
  }, function (e) {
    if ((e.status === 409 || e.status === 422) && (tries || 0) < 3) {
      return ghGet(c, p).then(function (f) {
        st.sha[p] = f.sha || null;
        if (f.text != null) { var r = ghMergeText(p, f.text); if (r.changed) { GH.changed = true; saveLocal(); } }
        return ghPut(c, p, (tries || 0) + 1);
      });
    }
    throw e;
  });
}
function ghSync(manual) {
  if (!ghReady()) return Promise.resolve("off");
  if (GH.busy) { GH.again = true; return Promise.resolve("busy"); }
  if (navigator.onLine === false) { GH.err = "Sin internet: se guarda en GitHub cuando vuelva la conexión."; ghPaint(); return Promise.resolve("offline"); }
  var c = ghCfg(), st = ghState();
  GH.busy = true; GH.changed = false; ghPaint();
  return ghList(c).then(function (remote) {
    var pulls = Object.keys(remote).filter(function (p) { return remote[p] !== st.sha[p]; });
    return seq(pulls, function (p) {
      return ghGet(c, p).then(function (f) {
        if (f.text == null) { delete st.sha[p]; st.dirty[p] = 1; return; }
        var r = ghMergeText(p, f.text);
        st.sha[p] = f.sha || remote[p];
        if (r.bad) { st.dirty[p] = 1; delete st.hash[p]; return; }
        st.hash[p] = strHash(f.text);
        if (r.changed) GH.changed = true;
        if (r.needUp) st.dirty[p] = 1;
      });
    }).then(function () {
      Object.keys(st.sha).forEach(function (p) { if (!remote[p]) { delete st.sha[p]; delete st.hash[p]; st.dirty[p] = 1; } });
      ghLocalShards().forEach(function (p) { if (!remote[p] && !st.sha[p]) st.dirty[p] = 1; });
      if (GH.changed) { saveLocal(); prefSyncApply(); DATAV++; }
      ghSave();
      return seq(Object.keys(st.dirty), function (p) { return ghPut(c, p, 0); });
    });
  }).then(function () {
    st.last = Date.now(); GH.err = ""; ghSave(); return "ok";
  }, function (e) {
    GH.err = (e && e.message) || String(e); ghSave();
    if (e && e.status === 401) {
      /* ¿Cambiaste la clave de GitHub en otro equipo? Si estás unido con la contraseña, la tomo sola de equipos.json */
      if (vLocal() && !GH.recov) { GH.recov = true; return vaultRecover().then(function (ok) { GH.recov = false; if (ok) return "retry"; ghBadKey(); return "error"; }); }
      ghBadKey();
    }
    return "error";
  }).then(function (res) {
    GH.busy = false;
    if (GH.changed) { GH.changed = false; saveLocal(); prefSyncApply(); DATAV++; ghOnChange(); }
    if (res === "retry") return ghSync(manual);
    var keys = res === "ok" ? keysApply().then(function (got) { if (got || VAULT.stale) renderGlobal(); }, function () {}) : Promise.resolve();
    return keys.then(function () {
      ghPaint();
      if (GH.again) { GH.again = false; ghSoon(1500); }
      return res;
    });
  });
}
function ghBadKey() {
  var cc = ghCfg(); if (cc) { cc.ok = false; ghSetCfg(cc); }
  GH.err = vLocal() ? "La clave de GitHub venció o la cambiaste. En el equipo donde pusiste la clave nueva: «Descargar equipos.json» y súbelo; este equipo se arregla solo." : "La clave no sirve (venció o se copió mal). Crea otra en GitHub y pégala aquí.";
}
function ghDirtyN() { return Object.keys(ghState().dirty).length; }
function ghMark(r) {
  DATAV++;
  if (!r || !r.k) return;
  var st = ghState(); st.dirty[ghShard(r)] = 1; ghSave();
  if (ghAuto()) ghSoon(20000);
}
function ghSoon(ms) {
  clearTimeout(GH.t);
  if (!ghAuto()) return;
  if (P.active && !P.done) { GH.pend = true; return; }   // en plena sesión no: se guarda al cerrarla
  GH.t = setTimeout(function () { ghSync(false); }, ms == null ? 20000 : ms);
}
function ghOnChange() {
  if (P.active) { GH.pend = true; return; }
  var pg = $("pg"); if (pg && !pg.hidden) pgRender();
  if (!($("ask") && !$("ask").hidden)) rerender(); else renderTabs();
}
function ghStatusText() {
  var c = ghCfg(), st = ghState();
  if (!c || !c.token) return "Sin conectar: tus datos quedan solo en este equipo.";
  if (!c.ok) return GH.err || "Falta probar la conexión.";
  if (GH.busy) return "Guardando en GitHub…";
  if (GH.err) return GH.err;
  var n = ghDirtyN();
  return (n ? n + (n === 1 ? " archivo por subir" : " archivos por subir") + " · " : "Al día · ") + "último guardado " + agoText(st.last) + ".";
}
function ghPaint() {
  var el = $("gh-st"); if (el) el.textContent = ghStatusText();
  paintSync();
}
function ghHostOwner() { var m = String(location.hostname || "").match(/^([a-z0-9-]+)\.github\.io$/i); return m ? m[1] : ""; }
function ghConnect() {
  var out = $("gh-st"), o = String(($("gh-o") || {}).value || "").trim(), rp = String(($("gh-r") || {}).value || "").trim(), tk = String(($("gh-t") || {}).value || "").trim();
  var old = ghCfg() || {};
  var c = { owner: o || old.owner || ghHostOwner(), repo: rp || old.repo || REPO_DATOS, token: tk || old.token || "", ok: false, auto: old.auto !== false };
  function say2(t) { if (out) out.textContent = t; }
  if (!c.owner || !c.repo || !c.token) { say2("Falta el usuario, el repositorio o la clave."); return Promise.resolve(false); }
  say2("Probando…");
  return ghApi(c, "/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo)).then(function (j) {
    if (j && j.private === false) { ghSetCfg(c); say2("Ese repositorio es PÚBLICO: cualquiera vería tus datos de salud. Hazlo privado (en GitHub: Settings → General → Change visibility) o crea uno privado, y vuelve a probar."); return false; }
    c.ok = true; ghSetCfg(c); GH.err = ""; GH.st = null;
    var s = ghState(); s.dirty = {}; ghLocalShards().forEach(function (p) { s.dirty[p] = 1; }); s.sha = {}; s.hash = {}; ghSave();
    say2("Conectado a " + c.owner + "/" + c.repo + ". Juntando tus datos…");
    return ghSync(true).then(function (r) { renderGlobal(); var el = $("gh-st"); if (el) el.textContent = r === "ok" ? "Listo: tus datos ya están en " + c.owner + "/" + c.repo + "." + (vLocal() ? "" : " Ahora crea la contraseña de tus equipos (aquí abajo): los demás equipos solo te la pedirán una vez.") : ghStatusText(); return r === "ok"; });
  }, function (e) { ghSetCfg(c); say2(e.message); return false; });
}
function ghForget() { var c = ghCfg(); if (c) { c.token = ""; c.ok = false; ghSetCfg(c); } GH.st = null; lsSet(GHS_KEY, null); lsSet(VK_KEY, null); renderGlobal(); }
function ghSettingsHTML() {
  var c = ghCfg() || {}, owner = c.owner || ghHostOwner(), repo = c.repo || REPO_DATOS, ready = ghReady();
  var h = '<details class="card" data-k="github"' + (!ready && VAULT.file ? " open" : "") + '><summary>Tus datos en todos tus equipos (GitHub)</summary>' +
    '<p class="muted">Tus equipos guardan en un repositorio privado tuyo de GitHub y se juntan solos: lo que haces en uno aparece en los otros. Sin internet, sube cuando vuelve la conexión.</p>';
  if (!ready && VAULT.file) h += '<h3 class="mini">Unir este equipo</h3><p class="muted">Escribe la contraseña de tus equipos: este recibe tus datos y tu clave de Google.</p>' +
    '<div class="nt-row"><input id="join-pass2" type="password" autocomplete="current-password" placeholder="Contraseña de tus equipos" aria-label="Contraseña de tus equipos"><button class="pbtn" data-v4="vjoin2" type="button">Unir</button></div><p class="gh-st" id="join-st2" aria-live="polite"></p>';
  if (ready) h += '<p class="gh-st" id="gh-st" aria-live="polite">' + esc(ghStatusText()) + "</p>" +
    '<div class="set-grid"><div class="set-row"><span>Guardar solo (unos segundos después de cada cambio, y al cerrar la sesión)</span><button class="switch" role="switch" aria-checked="' + (c.auto !== false) + '" data-v4="ghauto"><i></i><b>' + (c.auto !== false ? "Sí" : "No") + "</b></button></div></div>" +
    '<div class="hero-actions"><button class="btn" data-v4="ghnow" type="button">Guardar ahora</button></div>' + vaultBlockHTML();
  var manual = '<ol class="steps">' +
    "<li>En github.com toca <b>+</b> → <b>New repository</b>. Nombre: <b>" + esc(repo) + "</b>. Marca <b>Private</b> y <b>Add a README file</b>. Toca <b>Create repository</b>. Es otro repositorio, aparte del de la app: tus datos de salud no deben ser públicos.</li>" +
    "<li>Crea la clave: tu foto (arriba a la derecha) → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>" +
    "<li>Nombre: <b>Entreno</b>. Vencimiento: el que quieras (por ejemplo, 1 año). <b>Repository access</b>: «Only select repositories» y elige <b>" + esc(repo) + "</b>.</li>" +
    "<li><b>Permissions</b> → Repository permissions → <b>Contents</b>: «Read and write». Nada más. <b>Generate token</b> y copia la clave (empieza con <code>github_pat_</code>).</li>" +
    "<li>Pégala aquí y toca <b>Probar y guardar</b>. Después crea la <b>contraseña de tus equipos</b>: los demás equipos solo te pedirán esa contraseña.</li></ol>" +
    '<div class="ai-form"><label>Usuario de GitHub<input id="gh-o" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(owner) + '"></label>' +
    '<label>Repositorio privado<input id="gh-r" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(repo) + '"></label>' +
    '<label>Clave de GitHub<input id="gh-t" type="password" autocomplete="off" spellcheck="false" placeholder="' + (c.token ? "guardada (escribe otra para cambiarla)" : "github_pat_…") + '"></label>' +
    '<label>Nombre de este equipo (para el historial)<input id="gh-dev" autocomplete="off" spellcheck="false" placeholder="' + esc(ghDevName()) + '" value="' + esc(pref("devName", "") || "") + '"></label></div>' +
    (ready ? "" : '<p class="gh-st" id="gh-st" aria-live="polite">' + esc(ghStatusText()) + "</p>") +
    '<div class="hero-actions"><button class="btn' + (ready ? "" : " primary") + '" data-v4="ghsave" type="button">Probar y guardar</button>' + (c.token ? '<button class="btn quiet" data-v4="ghforget" type="button">Desconectar este equipo</button>' : "") + "</div>";
  h += ready || VAULT.file ? '<details class="tests"><summary>' + (ready ? "Cambiar la clave de GitHub o desconectar este equipo" : "Conectar con una clave de GitHub (solo si no tienes la contraseña)") + "</summary>" + manual + "</details>" :
    '<h3 class="mini">Primer equipo: conectarlo (una vez, 3 minutos)</h3>' + manual;
  h += '<p class="muted">Las claves quedan solo en tus equipos; lo que se sube va cifrado con tu contraseña. Si pierdes un equipo, borra la clave en GitHub (Settings → Developer settings → Fine-grained tokens), crea otra y vuelve a subir equipos.json: tus otros equipos la toman solos.</p></details>';
  return h;
}

/* ---------- La app se actualiza sola ----------
   Cada versión nueva trae un sw.js distinto. La app lo revisa al abrir, al volver a
   ella y cada 30 minutos; si hay versión nueva, recarga sola cuando no estás en una
   sesión, en una conversación ni escribiendo. Tus datos no se tocan. */
var UPD = { reg: null, ready: false, hadCtl: false, last: 0, t: 0, shown: false };
function updBusy() {
  var ae = document.activeElement;
  return (P.active && !P.done) || TALK.on || (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || "")) || !!(ASK.listening);
}
function updMaybe() {
  if (!UPD.ready) return;
  if (updBusy()) { updBanner(); return; }
  if (UPD.t) return;
  updBanner("Actualizando a la versión nueva…");
  var go = function () { updReload(); };
  var p = ghReady() && ghDirtyN() ? ghSync(false) : Promise.resolve();
  UPD.t = setTimeout(go, 2500);
  p.then(function () { clearTimeout(UPD.t); UPD.t = setTimeout(go, 600); }, function () {});
}
function updReload() { try { location.reload(); } catch (e) {} }
function updBanner(t) {
  var el = $("upd"); if (!el) return;
  el.textContent = t || "Hay una versión nueva de la app: se pone sola al terminar lo que estás haciendo.";
  el.hidden = false;
}
function updCheck() { if (!UPD.reg || navigator.onLine === false) return; UPD.last = Date.now(); try { var p = UPD.reg.update(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
function swRegister() {
  if (window.claude || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  UPD.hadCtl = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!UPD.hadCtl) { UPD.hadCtl = true; return; }   // la primera instalación no es una actualización
    UPD.ready = true; updMaybe();
  });
  navigator.serviceWorker.register("sw.js").then(function (reg) {
    UPD.reg = reg; UPD.last = Date.now();
    setInterval(updCheck, 30 * 60 * 1000);
  }).catch(function () {});
}

/* ---------- Contraseña de tus equipos (versión 4.1) ----------
   Para no pegar claves en cada equipo:
   1. En un equipo ya conectado creas una contraseña. La app cifra la clave de GitHub con ella
      (AES-GCM de 256 bits; la llave sale de la contraseña con PBKDF2-SHA256 y 600 000 vueltas)
      y arma «equipos.json», que subes una vez al repositorio de la app, junto a index.html.
      También sirve un enlace «#unir=…» que te mandas por WhatsApp.
   2. Un equipo nuevo abre la app, escribe la contraseña y queda unido: baja tus datos y tu
      clave de Google, que viaja cifrada dentro de tus datos (registro «llaves»).
   La contraseña nunca se guarda ni se sube. Cada equipo unido guarda solo la llave derivada. */
var VAULT_ITER = 600000;
var VK_KEY = LS_KEY + ".k";            // { kid, salt, iter, key, t } — solo en este equipo
var VAULT = { file: null, site: null, checked: false, busy: false, stale: false, msg: "", hide: false };
var KEYS = { applying: false };
function vOK() { return !!(window.crypto && window.crypto.subtle && window.TextEncoder); }
function bytesB64(u8) { var s = "", CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
function b64Bytes(b) { var bin = atob(String(b || "")), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
function b64url(str) { return b64enc(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64url(s) { s = String(s || "").replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return b64dec(s); }
function vKid(salt) { return strHash("kid|" + salt); }
function vDerive(pass, salt, iter) {
  var S = window.crypto.subtle;
  return S.importKey("raw", new TextEncoder().encode(String(pass).normalize("NFC")), "PBKDF2", false, ["deriveBits"]).then(function (base) {
    return S.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64Bytes(salt), iterations: iter || VAULT_ITER }, base, 256);
  }).then(function (bits) { return new Uint8Array(bits); });
}
function vAes(raw) { return window.crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]); }
function vEnc(raw, obj) {
  var iv = window.crypto.getRandomValues(new Uint8Array(12));
  return vAes(raw).then(function (k) { return window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(JSON.stringify(obj))); })
    .then(function (ct) { return { iv: bytesB64(iv), data: bytesB64(new Uint8Array(ct)) }; });
}
function vDec(raw, box) {
  return vAes(raw).then(function (k) { return window.crypto.subtle.decrypt({ name: "AES-GCM", iv: b64Bytes(box.iv) }, k, b64Bytes(box.data)); })
    .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
}
function vLocal() { var v = lsGet(VK_KEY); return v && v.key && v.salt ? v : null; }
function vRaw() { var v = vLocal(); return v ? b64Bytes(v.key) : null; }
function passProblem(p, p2) {
  p = String(p || "");
  if (p.length < 10) return "Usa al menos 10 caracteres. Lo más fácil y seguro: 3 o 4 palabras al azar que recuerdes (como «sapo-montaña-guitarra-azul», pero inventa las tuyas).";
  if (p2 != null && p !== p2) return "Las dos contraseñas no son iguales.";
  if (/sapo.?monta[ñn]a.?guitarra.?azul/i.test(p)) return "Esa es la del ejemplo: inventa tus propias 3 o 4 palabras.";
  if (/^(.)\1+$/.test(p) || /^(0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(p)) return "Esa contraseña es muy fácil de adivinar.";
  return "";
}
/* El archivo que se sube: solo datos cifrados y cómo derivar la llave (la sal no es secreta) */
function vaultFile() {
  var v = vLocal(), c = ghCfg();
  if (!v || !c || !c.token) return Promise.resolve(null);
  return vEnc(b64Bytes(v.key), { owner: c.owner, repo: c.repo, token: c.token, t: Date.now() }).then(function (box) {
    return { app: "sistema3", tipo: "equipos", v: 1, kdf: { alg: "PBKDF2-SHA256", iter: v.iter || VAULT_ITER, salt: v.salt }, kid: v.kid, iv: box.iv, data: box.data, creado: TODAY() };
  });
}
function vaultCreate(pass) {
  if (!vOK()) return Promise.reject(new Error("Este navegador no puede cifrar: usa Chrome actualizado."));
  if (!ghReady()) return Promise.reject(new Error("Primero conecta este equipo a GitHub."));
  var salt = bytesB64(window.crypto.getRandomValues(new Uint8Array(16)));
  return vDerive(pass, salt, VAULT_ITER).then(function (raw) {
    lsSet(VK_KEY, { kid: vKid(salt), salt: salt, iter: VAULT_ITER, key: bytesB64(raw), t: Date.now() });
    VAULT.stale = false; VAULT.site = null;
    return keysPut().then(vaultFile);
  });
}
/* Clave de Google (y lo que venga después) cifrada dentro de tus datos */
function keysPut() {
  var v = vLocal(); if (!v || KEYS.applying) return Promise.resolve();
  return vEnc(b64Bytes(v.key), { gemini: aiKeyOf("gemini") || "" }).then(function (box) {
    put({ id: "llaves", k: "keys", kid: v.kid, salt: v.salt, iter: v.iter || VAULT_ITER, iv: box.iv, data: box.data });
    lsSet(LS_KEY + ".keysu", (rec("llaves") || {}).u || 0);
  });
}
function keysApply() {
  var v = vLocal(), r = rec("llaves");
  if (!r || !r.data) return Promise.resolve(false);
  if (!v || r.kid !== v.kid) { VAULT.stale = true; return Promise.resolve(false); }
  VAULT.stale = false;
  if ((r.u || 0) <= (lsGet(LS_KEY + ".keysu") || 0)) return Promise.resolve(false);
  return vDec(b64Bytes(v.key), r).then(function (o) {
    lsSet(LS_KEY + ".keysu", r.u || 0);
    var g = o && o.gemini ? String(o.gemini) : "";
    if (!g || g === aiKeyOf("gemini")) return false;
    KEYS.applying = true;
    try { setPref("aiKey_gemini", g); if (!aiProv()) setPref("aiProv", "gemini"); } finally { KEYS.applying = false; }
    return true;
  }, function () { VAULT.stale = true; return false; });
}
/* Leer la contraseña en un equipo ya conectado (o cuando cambiaste la contraseña en otro) */
function keysUnlock(pass) {
  var r = rec("llaves");
  if (!r || !r.salt) return Promise.reject(new Error("Todavía no hay contraseña de tus equipos."));
  return vDerive(pass, r.salt, r.iter || VAULT_ITER).then(function (raw) {
    return vDec(raw, r).then(function () {
      lsSet(VK_KEY, { kid: r.kid, salt: r.salt, iter: r.iter || VAULT_ITER, key: bytesB64(raw), t: Date.now() });
      lsSet(LS_KEY + ".keysu", 0); VAULT.stale = false;
      return keysApply();
    }, function () { throw new Error("Contraseña incorrecta."); });
  });
}
/* Dónde buscar el llavero en un equipo nuevo: el enlace #unir=… o equipos.json del sitio */
function vaultFromHash() {
  var m = String(location.hash || "").match(/[#&]unir=([^&]+)/);
  if (!m) return null;
  try { var f = JSON.parse(unb64url(decodeURIComponent(m[1]))); return f && f.kdf && f.data && f.iv ? f : null; } catch (e) { return null; }
}
function vaultFetchSite() {
  if (window.claude || !/^https?:$/.test(location.protocol) || typeof fetch !== "function") return Promise.resolve(null);
  return Promise.resolve().then(function () { return fetch("equipos.json?t=" + Date.now(), { cache: "no-store" }); }).then(function (r) { return r && r.ok ? r.json() : null; })
    .then(function (f) { return f && f.tipo === "equipos" && f.kdf && f.data && f.iv ? f : null; }, function () { return null; });
}
function vaultInit() {
  VAULT.initT = Date.now();
  var h = vaultFromHash();
  if (h) { VAULT.file = h; VAULT.checked = true; if (!ghReady()) rerender(); return Promise.resolve(h); }
  if (ghReady()) { VAULT.checked = true; return keysApply().then(function (got) { if (got) renderGlobal(); if (VAULT.stale) renderGlobal(); return null; }); }
  return vaultFetchSite().then(function (f) { VAULT.file = f; VAULT.checked = true; if (f && !P.active) rerender(); return f; });
}
function vaultJoin(pass) {
  var f = VAULT.file;
  if (!f) return Promise.reject(new Error("No encuentro equipos.json: súbelo al repositorio de la app o usa el enlace para unir."));
  if (!vOK()) return Promise.reject(new Error("Este navegador no puede descifrar: usa Chrome actualizado."));
  return vDerive(pass, f.kdf.salt, f.kdf.iter || VAULT_ITER).then(function (raw) {
    return vDec(raw, f).then(function (o) {
      if (!o || !o.token || !o.owner || !o.repo) throw new Error("El archivo de tus equipos está incompleto.");
      var old = ghCfg() || {};
      ghSetCfg({ owner: o.owner, repo: o.repo, token: o.token, ok: true, auto: old.auto !== false });
      lsSet(VK_KEY, { kid: f.kid || vKid(f.kdf.salt), salt: f.kdf.salt, iter: f.kdf.iter || VAULT_ITER, key: bytesB64(raw), t: Date.now() });
      lsSet(LS_KEY + ".keysu", 0);
      GH.st = null; GH.err = "";
      var s = ghState(); s.sha = {}; s.hash = {}; s.dirty = {}; ghLocalShards().forEach(function (p) { s.dirty[p] = 1; }); ghSave();
      try { if (/unir=/.test(location.hash) && history.replaceState) history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      VAULT.file = null;
      return ghSync(true).then(function (res) { return keysApply().then(function () { return { res: res, key: !!aiKeyOf("gemini") }; }); });
    }, function () { throw new Error("Contraseña incorrecta."); });
  });
}
/* Si la clave de GitHub cambió (venció o la renovaste), los equipos unidos la toman solos de equipos.json */
function vaultRecover() {
  var v = vLocal(), c = ghCfg(); if (!v || !c) return Promise.resolve(false);
  return vaultFetchSite().then(function (f) {
    if (!f || (f.kid && f.kid !== v.kid)) return false;
    return vDec(b64Bytes(v.key), f).then(function (o) {
      if (!o || !o.token || o.token === c.token) return false;
      ghSetCfg({ owner: o.owner || c.owner, repo: o.repo || c.repo, token: o.token, ok: true, auto: c.auto !== false });
      return true;
    }, function () { return false; });
  });
}
/* ¿El equipos.json subido está al día con esta clave? */
function vaultSiteCheck() {
  var v = vLocal(), c = ghCfg(); VAULT.siteT = Date.now();
  return vaultFetchSite().then(function (f) {
    if (!f) return "falta";
    if (!v || (f.kid && f.kid !== v.kid)) return "otra";
    return vDec(b64Bytes(v.key), f).then(function (o) { return o && c && o.token === c.token ? "ok" : "vieja"; }, function () { return "otra"; });
  }).then(function (st) { VAULT.site = st; return st; });
}
/* Vuelve a mirar si ya subiste equipos.json (al abrir los ajustes o al volver a la app) */
function vaultSitePaint() { return vaultSiteCheck().then(function (st) { var el = $("vk-site"); if (el) el.textContent = vaultSiteText(st); return st; }); }
function vaultSiteText(st) {
  return st === "ok" ? "equipos.json ya está en tu app: los equipos nuevos solo piden la contraseña." :
    st === "falta" ? "Falta un paso: sube equipos.json al repositorio de la app (donde está index.html). Sin ese archivo, usa el enlace para unir." :
    st === "vieja" ? "El equipos.json de tu app tiene una clave de GitHub vieja: descárgalo y súbelo otra vez." :
    st === "otra" ? "El equipos.json de tu app es de otra contraseña: descárgalo y súbelo otra vez." : "Revisando si equipos.json ya está en tu app…";
}
/* Tarjeta en la página del día de un equipo nuevo */
function joinCardHTML() {
  if (ghReady() || !VAULT.file || VAULT.hide) return "";
  return '<section class="card join-card"><h2 class="sec-title">Une este equipo a tus datos</h2><p class="muted">Tus otros equipos ya guardan en GitHub. Escribe la contraseña de tus equipos y este recibe todo: sesiones, progreso y tu clave de Google.</p>' +
    '<div class="nt-row"><input id="join-pass" type="password" autocomplete="current-password" placeholder="Contraseña de tus equipos" aria-label="Contraseña de tus equipos"><button class="pbtn" data-v4="vjoin" type="button">Unir</button></div>' +
    '<p class="gh-st" id="join-st" aria-live="polite">' + esc(VAULT.msg || "") + '</p><button class="mini-btn quiet" data-v4="vlater" type="button">Ahora no</button></section>';
}
function vaultBlockHTML() {
  var v = vLocal(), r = rec("llaves");
  if (!ghReady()) return "";
  var h = '<h3 class="mini">Contraseña de tus equipos</h3>';
  if (!vOK()) return h + '<p class="muted">Este navegador no puede cifrar. Usa Chrome actualizado.</p>';
  if (VAULT.stale || (!v && r && r.salt)) {
    return h + '<p class="muted">' + (v ? "Cambiaste la contraseña de tus equipos en otro equipo." : "Ya creaste una contraseña de tus equipos en otro equipo.") + " Escríbela aquí una vez para recibir también tu clave de Google.</p>" +
      '<div class="nt-row"><input id="vk-pass" type="password" autocomplete="current-password" placeholder="Contraseña de tus equipos" aria-label="Contraseña de tus equipos"><button class="pbtn" data-v4="vunlock" type="button">Guardar</button></div><p class="gh-st" id="vk-st" aria-live="polite"></p>';
  }
  if (!v) {
    return h + '<p class="muted">Para no pegar claves en cada equipo: crea una contraseña. Los equipos nuevos solo te la piden una vez y reciben tus datos y tu clave de Google. La contraseña no se guarda en ningún lado: anótala donde no la pierdas.</p>' +
      '<div class="ai-form"><label>Contraseña (3 o 4 palabras)<input id="vk-p1" type="password" autocomplete="new-password"></label><label>Repítela<input id="vk-p2" type="password" autocomplete="new-password"></label></div>' +
      '<div class="hero-actions"><button class="btn primary" data-v4="vcreate" type="button">Crear contraseña</button></div><p class="gh-st" id="vk-st" aria-live="polite"></p>';
  }
  if (!VAULT.site || (VAULT.site !== "ok" && Date.now() - (VAULT.siteT || 0) > 15000)) setTimeout(vaultSitePaint, 0);
  return h + '<p class="muted">Lista desde el ' + esc(shortDate(iso(new Date(v.t || Date.now())))) + '. En un equipo nuevo: abre la app, escribe la contraseña y listo.</p>' +
    '<p class="gh-st" id="vk-site" aria-live="polite">' + esc(vaultSiteText(VAULT.site)) + "</p>" +
    '<details class="tests"><summary>Cómo subir equipos.json (una vez, o cuando cambies la clave de GitHub)</summary><ol class="steps"><li>Toca <b>Descargar equipos.json</b>.</li><li>En github.com abre el repositorio de la app (el de index.html) → <b>Add file</b> → <b>Upload files</b> → arrastra <b>equipos.json</b> → <b>Commit changes</b>.</li><li>Desde el celular también sirve <b>Copiar equipos.json</b> → en GitHub <b>Add file</b> → <b>Create new file</b> → nombre <b>equipos.json</b> → pegar → <b>Commit changes</b>.</li></ol><p class="muted">Ese archivo es público pero va cifrado: sin la contraseña no sirve. Por eso conviene una contraseña larga.</p></details>' +
    '<div class="hero-actions"><button class="btn" data-v4="vdl" type="button">Descargar equipos.json</button><button class="btn quiet" data-v4="vcopy" type="button">Copiar equipos.json</button><button class="btn quiet" data-v4="vlink" type="button">Copiar enlace para unir</button></div>' +
    '<p class="gh-st" id="vk-st" aria-live="polite"></p>' +
    '<details class="tests"><summary>Cambiar la contraseña</summary><div class="ai-form"><label>Nueva contraseña<input id="vk-p1" type="password" autocomplete="new-password"></label><label>Repítela<input id="vk-p2" type="password" autocomplete="new-password"></label></div><div class="hero-actions"><button class="btn" data-v4="vcreate" type="button">Cambiar contraseña</button></div><p class="muted">Después sube el equipos.json nuevo. Tus otros equipos siguen guardando; te pedirán la contraseña nueva una vez para recibir tu clave de Google.</p></details>';
}
function copyText(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return false; }); } catch (e) {}
  return Promise.resolve(false);
}

/* ---------- 1. Entrenador a largo plazo ----------
   Lee cada vez que hiciste un ejercicio: series, repeticiones, RIR, lo que midió la
   cámara (bajada, frenada, avisos) y la rodilla. Con las reglas del 3.0 decide:
   - Subir: tope del rango en todas las series dos sesiones seguidas, con el RIR
     que pide el ejercicio (en rodilla, 2-3 en reserva), bajada con el tempo y sin
     avisos repetidos de técnica.
   - Bajar: rodilla que avisó, o dos sesiones bajo el rango.
   - Estancado: 6 sesiones y 4 semanas sin mejorar; te dice qué mover primero.
   Las semanas de descarga y las sesiones modificadas no cuentan para subir.
   También mira la semana (señales de fatiga, algunas detectadas solas), el bloque
   de 6-8 semanas, tu peso, cintura y brazo, y las pruebas de cada 3 meses. */
var KEY_EX = PF.claves || ["remo1m", "arquero", "pressinc", "splitsq", "rdl1p", "arnold", "deficit", "rdl2p", "goblet", "pressmil"];
var ARM_EX = PF.brazos || { curlbay: 1, triover: 1, martillo: 1, frances: 1 };
var SIG_TXT = ["Pulso en reposo 5 lpm o más sobre tu promedio", "Sueño peor dos o más noches seguidas", "Fuerza que cae en un ejercicio clave dos sesiones seguidas", "Hambre o irritabilidad fuera de lo normal, o un resfriado"];
var FORM_W = (function () { var o = {}; for (var k in WARN_TXT) if (!/^(ecc|pausa|vel1|vel|limit|maxv)$/.test(k)) o[k] = 1; return o; })();
function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
function r1(v) { return Math.round(v * 10) / 10; }

/* Prescripción de un ejercicio en un día y peldaño dados (para juzgar sesiones pasadas con su propia meta) */
function dayEx(day, id, mode) {
  var D = DAYS[day]; if (!D) return null;
  var lists = [];
  if (mode === "stop" && D.stopPlan) lists.push(D.stopPlan.blocks);
  lists.push(D.blocks || []);
  if (D.stopPlan && mode !== "stop") lists.push(D.stopPlan.blocks);
  for (var i = 0; i < lists.length; i++) for (var j = 0; j < lists[i].length; j++) {
    var es = blockExs(lists[i][j]);
    for (var k = 0; k < es.length; k++) if (es[k].id === id) return { e: es[k], b: lists[i][j] };
  }
  return null;
}
function rxAt(day, id, lvl, mode) {
  var f = dayEx(day, id, mode);
  if (!f) for (var dk in DAYS) { f = dayEx(dk, id); if (f) break; }
  var lib = EX[id] || {}, r = {}, k;
  for (k in lib) r[k] = lib[k];
  if (f) for (k in f.e) r[k] = f.e[k];
  var o = rungOverride(lib, lvl || 0); for (k in o) r[k] = o[k];
  r.rung = lvl || 0; r.rungText = rungText(lib, r.rung); r.rungs = lib.ladder ? lib.ladder.length : 0;
  return r;
}
function rirTarget(x) {
  var m = String((x && x.rir) || "").match(/^\s*(\d)(?:\s*-\s*(\d))?/);
  if (!m) return null;
  var a = +m[1], b = m[2] != null ? +m[2] : a;
  return { lo: Math.min(a, b), hi: Math.max(a, b), last: /última/.test(x.rir) };
}
/* Por número de serie: el lado más débil manda; el RIR, el más cercano al fallo */
function setsBy(sets) {
  var by = {};
  sets.forEach(function (z) {
    var v = z.t != null ? z.t : z.r; if (v == null) return;
    var c = by[z.s];
    if (!c) { by[z.s] = { s: z.s, v: v, rir: z.rir != null ? z.rir : null, auto: !!z.auto, q: z.q || null }; return; }
    if (v < c.v) c.v = v;
    if (z.rir != null && (c.rir == null || z.rir < c.rir)) c.rir = z.rir;
    c.auto = c.auto && !!z.auto;
    if (!c.q && z.q) c.q = z.q;
  });
  return Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return by[k]; });
}
function coachOcc(id) {
  var out = [];
  logsDesc().forEach(function (L) {
    var all = L.sets.filter(function (z) { return z.x === id; });
    if (!all.length) return;
    var sets = all.filter(function (z) { return !z.skip; });
    out.push({ d: L.d, day: L.day, mode: L.mode || "full", deload: !!L.deload, lvl: ((sets[0] || all[0]).lvl) || 0, sets: sets, cut: all.some(function (z) { return z.skip; }), flag: (L.flags || []).some(function (f) { return f.x === id; }) });
  });
  return out;
}
function occStats(id, o) {
  var x = rxAt(o.day, id, o.lvl, o.mode), isT = !!x.hold, S = setsBy(o.sets);
  var n = 0; o.sets.forEach(function (z) { if (z.n > n) n = z.n; });
  var need = n || (o.deload ? halfUp(x.sets || 1) : (x.sets || 1));
  var rr = isT ? [x.hold, x.hold] : repsRange(x.reps), top = rr[1], bot = rr[0];
  var vals = S.map(function (p) { return p.v; }), mean = avg(vals), last = S[S.length - 1] || null;
  var qs = S.filter(function (p) { return p.q && p.q.e != null; });
  var tp = tempoParts(x.tempo), eT = tp && tp[0] && !tp[0].x ? tp[0].s : 0;
  var warn = null, lim = false;
  S.forEach(function (p) { var w = p.q && p.q.w; if (!w) return; if (w.limit || w.maxv) lim = true; for (var k in w) if (FORM_W[k] && w[k] >= 3 && (!warn || w[k] > warn.n)) warn = { k: k, n: w[k] }; });
  return {
    d: o.d, day: o.day, lvl: o.lvl, mode: o.mode, deload: o.deload, flag: o.flag, cut: o.cut, x: x, isT: isT, S: S, vals: vals, need: need, top: top, bot: bot,
    conf: S.length > 0 && S.every(function (p) { return !p.auto; }),
    topHit: top > 0 && S.length >= need && S.every(function (p) { return p.v >= top; }),
    weak: bot > 0 && S.length >= Math.min(need, 2) && mean != null && mean < bot - (top === bot ? 1 : 0) && S.filter(function (p) { return p.v < bot; }).length * 2 >= S.length,
    mean: mean, lastRir: last ? last.rir : null,
    cap: !S.length ? null : isT ? mean : avg(S.map(function (p) { return p.v + (p.rir != null ? Math.min(4, p.rir) : 0); })),
    eT: eT, eMed: qs.length ? r1(median(qs.map(function (p) { return p.q.e; }))) : null,
    eccFast: eT >= 2 && qs.length >= 2 && qs.filter(function (p) { return p.q.e < 0.6 * eT; }).length * 2 > qs.length,
    vl: last && last.q && last.q.v != null ? last.q.v : null, warn: warn, lim: lim
  };
}
function occValid(id, o) {
  var lib = EX[id] || {};
  if (o.deload || o.flag || o.cut) return false;
  if (lib.knee >= 1 && o.mode !== "full") return false;
  return true;
}
var CO = { v: -1, day: "", ex: {}, run: null };
function coachFresh() { if (CO.v !== DATAV || CO.day !== TODAY()) CO = { v: DATAV, day: TODAY(), ex: {}, run: null }; }
function exStats(id) {
  coachFresh();
  if (!CO.ex[id]) CO.ex[id] = coachOcc(id).map(function (o) { var s = occStats(id, o); s.valid = occValid(id, o); return s; });
  return CO.ex[id];
}
function fmtVals(s) { return s.vals.join("·") + (s.isT ? " s" : ""); }

/* La decisión para la próxima vez. Misma forma que la sugerencia de antes: kind, text, why, to, hist. */
function coachDecide(id, xNow) {
  var lib = EX[id] || {}, x = xNow || exEntry(id);
  if (!x) return null;
  var rung = x.rung != null ? x.rung : rungOf(id), rungs = lib.ladder ? lib.ladder.length : 0;
  var hist = historyOf(id, 2).filter(function (s) { return s.lvl === rung; });
  var R = { id: id, x: x, kind: "none", text: "", why: [], hist: hist, to: null };
  var down = x.knee ? flaggedDown(id) : null;
  if (down) {
    R.kind = "down"; R.knee = true; R.to = Math.max(0, rung - 1);
    R.text = rung > 0 ? "Baja un peldaño: " + rungText(lib, rung - 1) : (x.knee === 2 ? "Baja la exigencia: cojín o escalón un puño más alto, o menos rango" : "Baja la carga o el rango");
    R.why = [down.why.charAt(0).toUpperCase() + down.why.slice(1) + ": la regla de 24 horas baja este ejercicio un paso."];
    return R;
  }
  if (x.unit === "pasos" || !lib.ladder) { R.kind = hist.length ? "hold" : "none"; return R; }
  var cur = exStats(id).filter(function (s) { return s.valid && s.lvl === rung; });
  R.n = cur.length;
  if (!cur.length) { if (hist.length) R.kind = "hold"; return R; }
  var a = cur[0], b = cur[1] || null, tgt = rirTarget(x), strict = !!(x.knee >= 1 && tgt && tgt.lo >= 2), u = x.hold ? " s" : "";
  if (b && a.topHit && b.topHit && a.conf && b.conf) {
    if (rung >= rungs - 1) { R.kind = "hold"; R.max = true; R.text = "Estás en el último peldaño: sostén el tope con técnica perfecta."; return R; }
    if (rungPhase(lib, rung + 1) > phaseN()) { R.kind = "hold"; R.locked = true; return R; }
    if (x.knee && (a.lim || b.lim)) { R.kind = "hold"; R.gate = "lim"; R.text = "Repite este peldaño cuidando tu altura segura."; R.why = ["La cámara te vio bajar más hondo que tu altura segura: con la rodilla, primero la profundidad; después se sube."]; return R; }
    if (strict && a.lastRir != null && a.lastRir < tgt.lo) { R.kind = "hold"; R.gate = "rir"; R.text = "Repite este peldaño con " + tgt.lo + "-" + tgt.hi + " en reserva."; R.why = ["Llegaste al tope, pero con RIR " + a.lastRir + " en la última serie. En ejercicios que cargan la rodilla el " + PROG + " sube solo con " + x.rir + " en reserva."]; return R; }
    if (!strict && tgt && tgt.lo >= 2 && a.lastRir != null && b.lastRir != null && a.lastRir < tgt.lo - 1 && b.lastRir < tgt.lo - 1) { R.kind = "hold"; R.gate = "rir"; R.text = "Repite este peldaño sin llegar al fallo (RIR " + x.rir + ")."; R.why = ["Llegaste al tope yendo al fallo dos veces (RIR " + b.lastRir + " y " + a.lastRir + "); la meta aquí es " + x.rir + "."]; return R; }
    if (strict && a.lastRir == null && a.vl != null && a.vl >= 40) { R.kind = "hold"; R.gate = "vel"; R.text = "Repite este peldaño con " + tgt.lo + "-" + tgt.hi + " en reserva."; R.why = ["La cámara vio que la última serie se frenó un " + a.vl + "% (muy cerca del fallo) y no anotaste el RIR."]; return R; }
    if (a.eccFast) { R.kind = "hold"; R.gate = "tempo"; R.text = "Repite este peldaño bajando en " + a.eT + " s."; R.why = ["Llegaste al tope, pero la cámara midió la bajada en " + a.eMed + " s (pide " + a.eT + " s). Con el tempo correcto, subes."]; return R; }
    if (a.warn) { R.kind = "hold"; R.gate = "tec"; R.text = "Una sesión más con técnica limpia y subes."; R.why = ["La cámara avisó " + a.warn.n + " veces «" + (WARN_TXT[a.warn.k] || a.warn.k) + "» en una serie."]; return R; }
    var mn = eqRungNote(lib, rung + 1);
    R.kind = "up"; R.to = rung + 1; R.eqMiss = !!mn; R.eqNote = mn || "";
    R.text = "Sube un peldaño: " + rungText(lib, rung + 1) + (mn ? ". " + mn : "");
    R.why = ["Tope del rango (" + a.top + u + ") en todas las series dos sesiones seguidas: " + shortDate(b.d) + " y " + shortDate(a.d) + "."];
    if (a.lastRir != null) R.why.push("RIR en la última serie: " + a.lastRir + (tgt ? " (meta " + x.rir + ")" : "") + (tgt && a.lastRir >= tgt.hi + 2 ? ": te sobraba, el siguiente peldaño te queda bien." : "."));
    if (a.eMed != null && a.eT) R.why.push("La cámara midió la bajada en " + a.eMed + " s: tempo cumplido.");
    return R;
  }
  if (b && a.weak && b.weak && a.conf && b.conf) {
    R.kind = "down"; R.to = Math.max(0, rung - 1);
    R.text = rung > 0 ? "Baja un peldaño: " + rungText(lib, rung - 1) : "Usa una versión más fácil hasta llegar a " + a.bot + u;
    R.why = ["Dos sesiones bajo el rango: " + fmtVals(b) + " y " + fmtVals(a) + " (el piso es " + a.bot + u + ")."];
    return R;
  }
  if (a.conf && tgt && !x.knee && a.lastRir != null && !a.topHit && a.lastRir >= tgt.hi + 2) {
    R.kind = "effort"; R.text = "Aprieta más la última serie: RIR " + x.rir + ".";
    R.why = ["En la última serie te quedaban " + a.lastRir + (a.lastRir >= 4 ? " o más" : "") + ". El estímulo está en las últimas repeticiones; con más esfuerzo llegas al tope antes."];
    return R;
  }
  R.kind = "hold";
  if (a.topHit && a.conf) { R.one = true; R.text = "Una sesión más con el tope y subes."; return R; }
  var pl = plateauOf(id, cur);
  if (pl) { R.kind = "plateau"; R.text = pl.text; R.why = pl.why; R.weeks = pl.weeks; }
  return R;
}
function plateauOf(id, cur) {
  var c = cur.filter(function (s) { return s.cap != null && s.conf; });
  if (c.length < 6) return null;
  var span = daysBetween(c[5].d, c[0].d);
  if (span < 28) return null;
  var recent = Math.max.apply(null, c.slice(0, 3).map(function (s) { return s.cap; }));
  var before = Math.max.apply(null, c.slice(3, 6).map(function (s) { return s.cap; }));
  if (recent > before + 0.3) return null;
  var weeks = Math.max(4, Math.round(span / 7)), Bo = bodyInfo(), K = blockInfo(TODAY()), tip;
  if (Bo.rate != null && Bo.rate < KG0) tip = "Primero la comida: tu peso sube " + Bo.rateTxt + " al mes (meta +" + KG0 + " a +" + KG1 + "). Suma 200-300 kcal al día.";
  else if (K.week != null && K.week >= 5) tip = "La descarga suele destrabarlo, y ya está cerca (semana " + K.week + " del bloque).";
  else if (ARM_EX[id] && Bo.armStuck) tip = "Si los brazos siguen igual 8-12 semanas, el primer ajuste del " + PROG + " es una tercera ronda del circuito D del lunes.";
  else tip = "Mantén el peldaño, cuida el tempo y anota el RIR de la última serie: con eso afino la próxima decisión.";
  return { text: "Estancado: unas " + weeks + " semanas sin mejorar en este peldaño.", why: ["Tus 3 últimas sesiones no superan a las 3 anteriores (repeticiones hechas más las que te quedaban).", tip], weeks: weeks };
}
/* «Fuerza que cae en un ejercicio clave dos sesiones seguidas», detectada sola */
function strengthDrop(id) {
  var st = exStats(id).filter(function (s) { return s.valid && s.conf && !s.isT && s.cap != null; });
  if (st.length < 4) return null;
  var cur = st.filter(function (s) { return s.lvl === st[0].lvl; });
  if (cur.length < 4) return null;
  var a = cur[0], b = cur[1], prev = cur.slice(2, 8).filter(function (s) { return daysBetween(s.d, a.d) <= 56; });
  if (!prev.length) return null;
  var best = Math.max.apply(null, prev.map(function (s) { return s.cap; })), thr = Math.max(2, best * 0.1);
  if (a.cap <= best - thr && b.cap <= best - thr) return { id: id, a: a, b: b, best: r1(best), text: (EX[id] || {}).name + ": rendías " + r1(best) + " repeticiones posibles por serie y las dos últimas veces " + r1(b.cap) + " y " + r1(a.cap) };
  return null;
}
function autoSignals(date) {
  var out = [], wid = isoWeek(date).id, w = rec("wk_" + wid);
  var prev = recsOf("wk").filter(function (r) { return r.fc != null && r.id < "wk_" + wid; }).sort(function (x, y) { return x.id < y.id ? 1 : -1; }).slice(0, 4);
  if (w && w.fc != null && prev.length >= 2) {
    var base = median(prev.map(function (r) { return +r.fc; }));
    if (w.fc - base >= 5) out.push({ i: 0, big: w.fc - base >= 10, t: "Pulso en reposo " + w.fc + " lpm: " + Math.round(w.fc - base) + " sobre tu promedio (" + Math.round(base) + ")." });
  }
  KEY_EX.forEach(function (id) {
    var s = strengthDrop(id); if (!s) return;
    var dd = daysBetween(s.a.d, date);
    if (dd >= 0 && dd <= 10) out.push({ i: 2, x: id, t: "Fuerza que cae: " + s.text + "." });
  });
  return out;
}
function weekSignals(date) {
  var w = rec("wk_" + isoWeek(date).id), man = (w && w.sig) || [], auto = autoSignals(date), set = {};
  man.forEach(function (i) { set[i] = SIG_TXT[i]; });
  auto.forEach(function (s) { set[s.i] = s.t; });
  var keys = Object.keys(set);
  return { n: keys.length, list: keys.map(function (k) { return set[k]; }), auto: auto, man: man, big: auto.some(function (s) { return s.big; }) };
}
/* Bloque de 6-8 semanas entre descargas */
function blockInfo(date) {
  date = date || TODAY();
  var wid = isoWeek(date).id, c = cfg(), dl = (c.deload || []).slice().sort();
  var past = dl.filter(function (w) { return w < wid; }), isDel = dl.indexOf(wid) >= 0;
  var ws = weeksSinceDeload(date), week = ws == null ? null : (isDel ? 0 : (past.length ? ws : ws + 1));
  var next = isoWeek(addDays(date, 7)).id;
  return { n: past.length + 1, week: week, isDel: isDel, next: next, nextDel: dl.indexOf(next) >= 0, wid: wid, exam: (c.ex || []).indexOf(wid) >= 0, examNext: (c.ex || []).indexOf(next) >= 0 };
}
function isNoLegs(date) { return (cfg().nl || []).indexOf(isoWeek(date).id) >= 0; }
function setCfgField(k, v) { var c = clone(cfg()); c[k] = v; c._t = c._t || {}; c._t[k] = Date.now(); saveCfg(c); }
function setNoLegs(w, on) { var l = (cfg().nl || []).filter(function (x) { return x !== w; }); if (on) l.push(w); setCfgField("nl", l.sort()); }
function setExam(w, on) { var l = (cfg().ex || []).filter(function (x) { return x !== w; }); if (on) l.push(w); setCfgField("ex", l.sort()); setDeload(w, !!on); }
/* Peso, cintura y brazo: tendencias con varias semanas, no con dos puntos sueltos */
function bodyInfo() {
  var W = recsOf("wk").filter(function (w) { return w.peso != null && w.d; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  var out = { n: W.length, rate: null, rateTxt: "", last: W.length ? +W[W.length - 1].peso : null, pts: W.slice(-12).map(function (w) { return +w.peso; }) };
  var R = W.filter(function (w) { return daysBetween(w.d, TODAY()) <= 63; }).slice(-8);
  if (R.length >= 3 && daysBetween(R[0].d, R[R.length - 1].d) >= 21) {
    var xs = R.map(function (w) { return daysBetween(R[0].d, w.d); }), ys = R.map(function (w) { return +w.peso; }), mx = avg(xs), my = avg(ys), num = 0, den = 0;
    for (var i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
    out.rate = Math.round((den ? num / den : 0) * 30.4 * 100) / 100;
    out.rateTxt = (out.rate >= 0 ? "+" : "") + String(out.rate) + " kg";
  }
  var C = recsOf("wk").filter(function (w) { return w.cintura != null && w.d; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  if (C.length) {
    var cl = C[C.length - 1]; out.waist = +cl.cintura;
    var c0 = C.filter(function (w) { var dd = daysBetween(w.d, cl.d); return dd >= 25 && dd <= 45; }).pop();
    if (c0) { out.waistUp = r1(cl.cintura - c0.cintura); out.waistArmUp = cl.brazo != null && c0.brazo != null && cl.brazo > c0.brazo; }
  }
  var A = recsOf("wk").filter(function (w) { return w.brazo != null && w.d; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  if (A.length) {
    var al = A[A.length - 1]; out.arm = +al.brazo;
    var a0 = A.filter(function (w) { return daysBetween(w.d, al.d) >= 56; }).pop();
    if (a0) { out.armDelta = r1(al.brazo - a0.brazo); out.armWeeks = Math.round(daysBetween(a0.d, al.d) / 7); out.armStuck = out.armDelta < 0.3; }
    out.armPts = A.slice(-8).map(function (w) { return +w.brazo; });
  }
  var Pc = recsOf("wk").filter(function (w) { return w.pecho != null && w.d; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  if (Pc.length) out.chest = +Pc[Pc.length - 1].pecho;
  out.waistPts = C.slice(-12).map(function (w) { return +w.cintura; });
  return out;
}
function coachRec() { return rec("coach") || { id: "coach", k: "coach", dis: {}, dist: {}, au: [] }; }
function propDismissed(pid) { var c = coachRec(), d = c.dis && c.dis[pid]; return !!(d && daysBetween(d, TODAY()) < 7); }
function propDismiss(pid) { var c = clone(coachRec()); c.dis = c.dis || {}; c.dist = c.dist || {}; c.dis[pid] = TODAY(); c.dist[pid] = Date.now(); put(c); }
function planExIds() { var o = {}, out = []; ORDER.forEach(function (k) { blocksOf(DAYS[k]).forEach(function (b) { blockExs(b).forEach(function (e) { if (!o[e.id] && EX[e.id]) { o[e.id] = 1; out.push(e.id); } }); }); }); return out; }
function legWeekTarget() {
  var t = TODAY(), wd = weekDates(t);
  var left = ["mie", "sab"].some(function (k) { var d = wd[DAYS[k].dow === 0 ? 6 : DAYS[k].dow - 1]; return d >= t && !rec("log_" + d + "_" + k); });
  return left ? isoWeek(t).id : isoWeek(addDays(t, 7)).id;
}
/* Todo junto: propuestas, avisos, ejercicios clave, cuerpo, logros y lo que viene */
function coachRun() {
  coachFresh(); if (CO.run) return CO.run;
  var today = TODAY(), B = blockInfo(today), S = weekSignals(today), Sp = weekSignals(addDays(today, -7)), Bo = bodyInfo();
  var dec = {}, props = [], info = [];
  planExIds().forEach(function (id) { dec[id] = coachDecide(id, exEntry(id)); });
  function add(list, p) { if (!propDismissed(p.id)) list.push(p); }
  planExIds().forEach(function (id) {
    var R = dec[id], nm = (EX[id] || {}).name; if (!R) return;
    if (R.kind === "up") add(props, { id: "up:" + id + ":" + R.to, prio: 2, kind: "up", x: id, title: nm + ": sube un peldaño", sub: rungText(EX[id], R.to), why: R.why.concat(R.eqNote ? [R.eqNote] : []), act: { t: "rung", x: id, to: R.to }, btn: "Subir" });
    else if (R.kind === "down") add(props, { id: "down:" + id + ":" + R.to + ":" + (R.knee ? "k" : "w"), prio: R.knee ? 1 : 2, kind: "down", x: id, title: nm + ": " + (R.x.rung > 0 ? "baja un peldaño" : "más fácil"), sub: R.x.rung > 0 ? rungText(EX[id], R.to) : R.text, why: R.why, act: R.x.rung > 0 ? { t: "rung", x: id, to: R.to } : null, btn: "Bajar" });
    else if (R.kind === "plateau") add(info, { id: "pl:" + id + ":" + B.wid, prio: 3, kind: "plateau", x: id, title: nm + ": estancado", why: R.why });
    else if (R.kind === "effort") add(info, { id: "ef:" + id + ":" + (R.hist[0] ? R.hist[0].d : today), prio: 3, kind: "effort", x: id, title: nm + ": aprieta más la última serie", why: R.why });
    else if (R.gate) add(info, { id: "gt:" + id + ":" + R.gate + ":" + (R.hist[0] ? R.hist[0].d : today), prio: 3, kind: "gate", x: id, title: nm + ": " + R.text.charAt(0).toLowerCase() + R.text.slice(1), why: R.why });
  });
  if (!B.isDel && !B.nextDel) {
    var dw = [], dp = 0;
    if (S.n >= 2) { dw.push("Esta semana hay " + S.n + " señales de fatiga: " + S.list.join(" ")); dp = 1; }
    else if (B.week != null && B.week >= 8) { dw.push("Llevas " + B.week + " semanas en este bloque: el " + PROG + " pide una descarga cada 6-8."); dp = 1; }
    else if (B.week != null && B.week >= 6) {
      var pls = planExIds().filter(function (id) { return dec[id] && dec[id].kind === "plateau"; }).length;
      if (S.n + Sp.n >= 1 || pls >= 2) { dw.push("Semana " + B.week + " del bloque" + (S.n + Sp.n ? " con señales de fatiga (" + S.list.concat(Sp.list).join(" ") + ")" : "") + (pls >= 2 ? " y " + pls + " ejercicios estancados" : "") + ": buen momento para descargar."); dp = 2; }
    }
    if (dw.length) { dw.push("Descarga = mismas sesiones, la mitad de las series y RIR 3-4; caminatas iguales."); add(props, { id: "dl:" + B.next, prio: dp, kind: "deload", title: "Descarga la próxima semana", why: dw, act: { t: "deload", w: B.next }, btn: "Marcar descarga" }); }
  }
  if (S.big) add(props, { id: "fc10:" + B.wid, prio: 1, kind: "alert", title: "Pulso en reposo muy alto", why: ["Está 10 lpm o más sobre tu promedio. Regla del " + PROG + ": si sigue así varios días, para y consulta."], act: null });
  if (consecutiveWorse(today)) { var lw = legWeekTarget(); if (!(cfg().nl || []).some(function (w) { return w >= B.wid; })) add(props, { id: "nl:" + lw, prio: 1, kind: "nolegs", title: "Una semana sin pierna y a evaluación", why: ["La rodilla amaneció peor dos semanas seguidas. Regla de 24 horas del " + PROG + ": una semana sin pierna y que la evalúe un profesional.", "El miércoles y el sábado de esa semana van con el plan sin pierna."], act: { t: "nolegs", w: lw }, btn: "Marcar esa semana" }); }
  if (Bo.rate != null && Bo.rate < KG0) add(info, { id: "kc+:" + B.wid, prio: 2, kind: "food", title: "Come un poco más", why: ["Tu peso sube " + Bo.rateTxt + " al mes (meta del " + PROG + ": +" + KG0 + " a +" + KG1 + ").", "Suma 200-300 kcal al día: por ejemplo un plátano con un puñado de maní."] });
  if (Bo.waistUp != null && Bo.waistUp > 1 && !Bo.waistArmUp) add(info, { id: "kc-:" + B.wid, prio: 2, kind: "food", title: "Quita unas 200 kcal", why: ["La cintura subió " + Bo.waistUp + " cm en un mes sin que suba el brazo."] });
  if (Bo.waist != null && Bo.waist >= CINT) add(info, { id: "ws:" + B.wid, prio: 1, kind: "food", title: "Cintura en el techo", why: ["Marca " + Bo.waist + " cm; el techo del " + PROG + " es menos de " + CINT + " cm (la mitad de tu estatura)."] });
  if (Bo.armStuck && !cfg().lunD3) add(props, { id: "lunD3", prio: 2, kind: "arms", title: "Tercera ronda del circuito D del lunes", why: ["El brazo relajado cambió " + Bo.armDelta + " cm en " + Bo.armWeeks + " semanas.", "Es el primer ajuste que indica el " + PROG + " si los brazos se estancan 8-12 semanas. El lunes dura unos 5 minutos más."], act: { t: "lunD3" }, btn: "Activar" });
  if (testDue() && logsDesc().length >= 8) add(info, { id: "ts:" + (lastTest() ? lastTest().d : "0"), prio: 3, kind: "tests", title: "Tocan las pruebas de cada 3 meses", why: ["Están en el seguimiento del domingo: así ves si el plan funciona más allá del espejo."] });
  props.sort(function (a, b) { return a.prio - b.prio; }); info.sort(function (a, b) { return a.prio - b.prio; });
  CO.run = { B: B, S: S, Bo: Bo, dec: dec, props: props, info: info };
  return CO.run;
}
function propApply(p) {
  var a = p && p.act; if (!a) return;
  if (a.t === "rung") setRung(a.x, a.to, p.src === "ia" ? "IA" : "propuesta");
  else if (a.t === "deload") setDeload(a.w, true);
  else if (a.t === "nolegs") setNoLegs(a.w, true);
  else if (a.t === "lunD3") setCfgField("lunD3", true);
}
function propFind(pid) { var C = coachRun(); return C.props.concat(C.info).concat(AIREV.props || []).filter(function (p) { return p.id === pid; })[0] || null; }
/* Al terminar una sesión: sube solo los peldaños sin rodilla que cumplieron la regla (si lo permites) */
function coachAfterSession(ids) {
  if (!prefVal("coachAuto")) return [];
  var done = [];
  ids.forEach(function (id) {
    var lib = EX[id] || {}; if (lib.knee) return;
    var R = coachDecide(id, exEntry(id)), from = rungOf(id);
    if (R && R.kind === "up" && !R.eqMiss && R.to === from + 1) {
      setRung(id, R.to, "auto");
      var c = clone(coachRec()); c.au = (c.au || []).concat([{ x: id, from: from, to: R.to, d: TODAY(), t: Date.now() }]).slice(-60); put(c);
      done.push({ id: id, t: c.au[c.au.length - 1].t, text: lib.name + " → " + rungText(lib, R.to) });
    }
  });
  return done;
}
function coachUndo(t) {
  var c = clone(coachRec()), e = (c.au || []).filter(function (z) { return String(z.t) === String(t); })[0];
  if (!e || e.undone) return false;
  if (rungOf(e.x) === e.to) setRung(e.x, e.from, "deshacer");
  e.undone = 1; e.u = Date.now(); put(c); return true;
}
function coachRecentAuto() { return (coachRec().au || []).filter(function (e) { return !e.undone && daysBetween(e.d, TODAY()) <= 3; }); }

/* Cómo va cada ejercicio clave */
function exTrend(id) {
  var st = exStats(id).filter(function (s) { return s.valid && s.conf && s.cap != null; });
  if (!st.length) return null;
  var lvl = st[0].lvl, cur = st.filter(function (s) { return s.lvl === lvl; });
  var tr = "=";
  if (cur.length >= 4) { var a = avg(cur.slice(0, 2).map(function (s) { return s.cap; })), b = avg(cur.slice(2, 4).map(function (s) { return s.cap; })); tr = a > b + 0.4 ? "up" : a < b - 0.4 ? "down" : "="; }
  else if (st.length > cur.length) tr = "new";
  return { last: st[0], cur: cur, tr: tr, pts: st.slice(0, 10).reverse().map(function (s) { return r1(s.cap); }), lvls: st.slice(0, 10).reverse().map(function (s) { return s.lvl; }) };
}
var KIND_TXT = { up: ["ok", "Listo para subir"], down: ["bad", "Bajar"], plateau: ["warn", "Estancado"], effort: ["warn", "Aprieta más"], none: ["", "Sin datos aún"] };
function statusOf(R) {
  if (!R) return ["", "Sin datos aún"];
  if ((R.kind === "none" || (R.kind === "hold" && !R.n && !R.locked && !R.max)) && exStats(R.id).some(function (s) { return s.valid; })) return ["", "Peldaño nuevo"];
  if (R.kind === "hold") return R.locked ? ["", "Siguiente: fase 2"] : R.max ? ["ok", "Último peldaño"] : R.gate ? ["warn", "Repite (" + ({ rir: "RIR", vel: "RIR", tempo: "tempo", tec: "técnica", lim: "profundidad" }[R.gate] || "") + ")"] : R.one ? ["ok", "1 sesión más"] : ["", "En camino"];
  return KIND_TXT[R.kind] || ["", ""];
}
/* Semana: sesiones, series, subidas y señales */
function weekReport(date) {
  var wd = weekDates(date), st = weekStats(date), sets = 0, planned = 0;
  wd.forEach(function (d) { ["lun", "mie", "vie", "sab"].forEach(function (k) { var L = rec("log_" + d + "_" + k); if (L && L.sets) { sets += countLogged(L.sets); planned += L.planSets || 0; } }); });
  var H = ((rec("niveles") || {}).H || []).filter(function (h) { return h.d >= wd[0] && h.d <= wd[6]; });
  return { sessions: st.sessions, knee: st.knee, sets: sets, planned: planned, ups: H.filter(function (h) { return h.to > h.from; }), downs: H.filter(function (h) { return h.to < h.from; }), sig: weekSignals(date), mon: wd[0] };
}
function achievements() {
  var out = [], logs = recsOf("log").filter(function (L) { return L.sets && L.sets.length && L.done; });
  var n = logs.length + recsOf("aer").filter(function (a) { return a.done; }).length;
  var ms = [300, 200, 100, 50, 25, 10].filter(function (m) { return n >= m; })[0];
  if (ms) out.push({ t: n + " sesiones completas", s: "Pasaste la marca de " + ms + "." });
  var H = ((rec("niveles") || {}).H || []).filter(function (h) { return h.to > h.from; });
  if (H.length) { var l = H[H.length - 1]; out.push({ t: H.length + (H.length === 1 ? " peldaño subido" : " peldaños subidos"), s: "El último: " + ((EX[l.x] || {}).name || l.x) + " → " + rungText(EX[l.x] || {}, l.to) + " (" + shortDate(l.d) + ")." }); }
  var streak = 0;
  for (var w = 1; w <= 52; w++) { var s = weekStats(addDays(TODAY(), -7 * w)).sessions; if (s >= 4) streak++; else break; }
  if (streak >= 2) out.push({ t: streak + " semanas seguidas con 4 o más sesiones", s: "Constancia: lo que más predice el progreso." });
  var prs = [];
  planExIds().forEach(function (id) {
    var st = exStats(id).filter(function (s) { return s.valid && s.conf && s.vals.length; });
    if (st.length < 2) return;
    var a = st[0], best = Math.max.apply(null, a.vals), prev = st.slice(1).filter(function (s) { return s.lvl === a.lvl; });
    if (!prev.length || daysBetween(a.d, TODAY()) > 14) return;
    var pb = Math.max.apply(null, [].concat.apply([], prev.map(function (s) { return s.vals; })));
    if (best > pb) prs.push((EX[id] || {}).name + " " + best + (a.isT ? " s" : "") + " (antes " + pb + ")");
  });
  if (prs.length) out.push({ t: "Récords de estas dos semanas", s: prs.slice(0, 5).join(" · ") + "." });
  var T = testsAll();
  if (T.length >= 2) {
    var t0 = T[0], t1 = T[1], d = [];
    if (t0.push != null && t1.push != null && t0.push !== t1.push) d.push("flexiones " + (t0.push > t1.push ? "+" : "") + (t0.push - t1.push));
    if (t0.km2 != null && t1.km2 != null && t0.km2 !== t1.km2) d.push("2 km " + (t0.km2 < t1.km2 ? Math.round(t1.km2 - t0.km2) + " s más rápido" : Math.round(t0.km2 - t1.km2) + " s más lento"));
    if (t0.hang != null && t1.hang != null && t0.hang !== t1.hang) d.push("barra " + (t0.hang > t1.hang ? "+" : "") + Math.round(t0.hang - t1.hang) + " s");
    if (d.length) out.push({ t: "Pruebas de 3 meses", s: "Contra las anteriores: " + d.join(", ") + "." });
  }
  return out;
}
function rungPace(id) {
  var H = ((rec("niveles") || {}).H || []).filter(function (h) { return h.x === id && h.to > h.from; });
  if (H.length < 2) return null;
  var days = daysBetween(H[0].d, H[H.length - 1].d) / (H.length - 1);
  return days > 0 ? Math.max(1, Math.round(days / 7)) : null;
}
function whatsNext(C) {
  var B = C.B, items = [];
  if (B.isDel) items.push("Esta semana es de descarga: la mitad de las series y RIR 3-4. La próxima arranca el bloque " + (B.n + 1) + ".");
  else if (B.nextDel) items.push("La próxima semana es de descarga" + (B.examNext ? " (exámenes)" : "") + ".");
  else if (B.week != null) items.push(B.week >= 6 ? "Descarga: toca entre esta y la semana 8 del bloque; te aviso si aparecen señales." : "Descarga: en unas " + (6 - B.week) + " a " + (8 - B.week) + " semanas (bloques de 6-8), o antes si se juntan dos señales de fatiga.");
  var t = lastTest(); items.push(testDue() ? "Pruebas de cada 3 meses: tocan (en el seguimiento del domingo)." : "Pruebas de cada 3 meses: desde el " + shortDate(addDays(t.d, 84)) + ".");
  var f = rec("fotos"); items.push(!f ? "Fotos del mes: cuando quieras empezar (domingo)." : daysBetween(f.d, TODAY()) >= 28 ? "Fotos del mes: tocan." : "Fotos del mes: desde el " + shortDate(addDays(f.d, 28)) + ".");
  if (phaseN() === 1) { var g = gate1State(), miss = []; if (!g.eval) miss.push("el visto bueno del profesional"); if (!g.pain) miss.push("4 semanas con dolor de 1/10 o menos"); if (!g.sd20) miss.push("step-down de 20 cm × 10"); if (!g.bal) miss.push("equilibrio 30 s por pierna con ojos cerrados"); items.push(miss.length ? "Para la fase 2 te falta: " + miss.join(", ") + "." : "Cumples la puerta de la fase 2: pásala en «Tu fase»."); }
  KEY_EX.forEach(function (id) {
    var R = C.dec[id]; if (!R) return;
    if (R.one) items.push((EX[id] || {}).name + ": si repites el tope la próxima vez, sube.");
    else { var p = rungPace(id); if (p && R.kind === "hold" && !R.locked && !R.max) items.push((EX[id] || {}).name + ": a tu ritmo, siguiente peldaño en unas " + p + " semanas."); }
  });
  return items;
}
/* Texto corto para la IA y para la voz */
function coachText(exq, idDirect) {
  var C = coachRun(), B = C.B, parts = [];
  if (exq || idDirect) {
    var m = idDirect ? null : exMatch(norm(exq), null), id = idDirect || (m && m.id);
    if (id && EX[id]) {
      var R = C.dec[id] || coachDecide(id, exEntry(id)), T = exTrend(id), lib = EX[id];
      parts.push(lib.name + ": peldaño " + (rungOf(id) + 1) + " de " + (lib.ladder ? lib.ladder.length : 1) + (lib.ladder ? " (" + rungText(lib, rungOf(id)) + ")" : "") + ".");
      if (T) parts.push("Última vez (" + shortDate(T.last.d) + "): " + fmtVals(T.last) + (T.last.lastRir != null ? ", RIR " + T.last.lastRir + " en la última" : "") + ". Tendencia: " + ({ up: "subiendo", down: "bajando", "=": "pareja", "new": "peldaño nuevo" }[T.tr]) + ".");
      parts.push("Decisión: " + (statusOf(R)[1]) + (R.text ? ". " + R.text : "") + (R.why.length ? " (" + R.why.join(" ") + ")" : "") + ".");
      return parts.join(" ");
    }
  }
  if (!logsDesc().length) return "Todavía no hay sesiones con series registradas: cuando las anotes, te digo cómo vas, qué subir y cuándo descargar.";
  parts.push(B.isDel ? "Semana de descarga." : "Bloque " + B.n + (B.week == null ? "." : ", semana " + B.week + " de 6-8."));
  if (C.S.n) parts.push("Señales de fatiga esta semana: " + C.S.list.join(" "));
  var rp = weekReport(TODAY()); parts.push("Esta semana: " + rp.sessions + " de 5 sesiones.");
  if (C.Bo.rate != null) parts.push("Peso: " + C.Bo.rateTxt + " al mes (meta +" + KG0 + " a +" + KG1 + ").");
  var ups = KEY_EX.filter(function (id) { return C.dec[id] && C.dec[id].kind === "up"; }).map(function (id) { return EX[id].name; });
  var stuck = KEY_EX.filter(function (id) { return C.dec[id] && C.dec[id].kind === "plateau"; }).map(function (id) { return EX[id].name; });
  if (ups.length) parts.push("Listos para subir: " + ups.join(", ") + ".");
  if (stuck.length) parts.push("Estancados: " + stuck.join(", ") + ".");
  if (C.props.length) parts.push("Propuestas pendientes: " + C.props.slice(0, 4).map(function (p) { return p.title; }).join("; ") + ".");
  return parts.join(" ");
}

/* ---------- Pantalla «Tu progreso» ---------- */
function miniSpark(vals, label) {
  var v = vals.filter(function (x) { return x != null; });
  if (v.length < 2) return "";
  var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), W = 96, H = 26, n = vals.length, pts = [];
  vals.forEach(function (x, i) { if (x == null) return; pts.push((3 + (W - 6) * i / Math.max(1, n - 1)).toFixed(1) + "," + (H - 3 - (H - 6) * (hi === lo ? 0.5 : (x - lo) / (hi - lo))).toFixed(1)); });
  return '<svg class="msp" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc((label || "Tendencia") + ": de " + v[0] + " a " + v[v.length - 1]) + '"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="' + pts.join(" ") + '"/></svg>';
}
function propHTML(p) {
  var pid = esc(p.id);
  return '<div class="pp pp-' + esc(p.kind || "x") + " prio" + (p.prio || 3) + (p.bad ? " pp-bad" : "") + '"><p class="pp-t">' + esc(p.title || "") + (p.sub ? '<span class="pp-sub">' + esc(p.sub) + "</span>" : "") + (p.src === "ia" ? '<span class="pp-src">Sugerido por la IA</span>' : "") + "</p>" +
    (p.why && p.why.length ? '<ul class="pp-why">' + p.why.filter(Boolean).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>" : "") +
    (p.bad ? '<p class="pp-no">' + esc(p.bad) + "</p>" : "") +
    '<div class="pp-act">' + (p.act && !p.bad ? '<button class="mini-btn" data-v4="papply" data-pid="' + pid + '" type="button">' + esc(p.btn || "Aplicar") + "</button>" : "") + '<button class="mini-btn quiet" data-v4="pdismiss" data-pid="' + pid + '" type="button">' + (p.act && !p.bad ? "Ahora no" : "Entendido") + "</button></div></div>";
}
function blockBarHTML(B) {
  if (B.isDel || B.week == null) return "";
  var h = '<div class="bk-bar" aria-hidden="true">';
  for (var i = 1; i <= 8; i++) h += '<span class="' + (i < B.week ? "on" : i === B.week ? "on now" : "") + (i >= 6 ? " dz" : "") + '">' + i + "</span>";
  return h + '</div><p class="bk-leg"><span class="dz-sw"></span>Semanas 6 a 8: zona de descarga</p>';
}
function autoNoticeHTML() {
  var au = coachRecentAuto(); if (!au.length) return "";
  return au.map(function (a) { var lib = EX[a.x] || {}; return '<p class="cc-auto">Subí solo: <b>' + esc(lib.name || a.x) + "</b> → " + esc(rungText(lib, a.to)) + ' <button class="mini-btn quiet" data-v4="undo" data-t="' + esc(String(a.t)) + '" type="button">Deshacer</button></p>'; }).join("");
}
function keyRowHTML(id, C) {
  var lib = EX[id] || {}, R = C.dec[id], T = exTrend(id), stt = statusOf(R), r = rungOf(id);
  var last = T ? shortDate(T.last.d) + ": " + fmtVals(T.last) + (T.last.lastRir != null ? " · RIR " + T.last.lastRir : "") : "Sin registros todavía";
  var arrow = T ? { up: "↑", down: "↓", "=": "→", "new": "nuevo" }[T.tr] : "";
  var why = R && (R.kind === "up" || R.kind === "down" || R.gate || R.kind === "plateau" || R.kind === "effort") && R.why.length ? R.why[0] : R && R.one ? R.text : "";
  return '<li class="kx"><div class="kx-top"><b>' + esc(lib.name) + '</b><span class="chip ' + stt[0] + '">' + esc(stt[1]) + "</span></div>" +
    '<p class="kx-mid">Nivel ' + (r + 1) + "/" + (lib.ladder ? lib.ladder.length : 1) + " · " + esc(rungText(lib, r)) + "</p>" +
    '<div class="kx-bot"><span>' + esc(last) + "</span>" + (T && T.pts.length >= 2 ? miniSpark(T.pts, lib.name) : "") + (arrow ? '<span class="kx-tr kx-' + (T.tr === "=" ? "eq" : T.tr) + '">' + arrow + "</span>" : "") + "</div>" +
    (why ? '<p class="kx-why">' + esc(why) + "</p>" : "") + "</li>";
}
function weekHTML(rp, title) {
  var s = rp.sig, h = '<section class="pg-sec"><h3 class="mini">' + esc(title) + '</h3><div class="wk-grid">' +
    '<div><b>' + rp.sessions + '</b><span>de 5 sesiones</span></div>' +
    '<div><b>' + rp.sets + '</b><span>series' + (rp.planned ? " de " + rp.planned : "") + "</span></div>" +
    '<div><b>' + (rp.knee == null ? "–" : rp.knee) + '</b><span>rodilla al despertar</span></div>' +
    '<div><b>' + s.n + '</b><span>señales de fatiga</span></div></div>';
  if (rp.ups.length) h += '<p class="muted">Subiste: ' + esc(rp.ups.map(function (u) { return ((EX[u.x] || {}).name || u.x) + " → " + rungText(EX[u.x] || {}, u.to); }).join(" · ")) + ".</p>";
  if (s.list.length) h += '<ul class="plain sig-list">' + s.list.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
  return h + "</section>";
}
function bodyHTML(Bo) {
  var h = '<section class="pg-sec"><h3 class="mini">Cuerpo</h3>';
  if (!Bo.n && Bo.waist == null && Bo.arm == null) return h + '<p class="muted">Anota tu peso el domingo (seguimiento semanal) y aquí verás hacia dónde va.</p></section>';
  var rc = Bo.rate == null ? "" : Bo.rate < KG0 ? "warn" : Bo.rate > KG1 ? "prep" : "ok";
  if (Bo.n) h += '<div class="bd-row"><span>Peso</span><b>' + Bo.last + " kg</b>" + miniSpark(Bo.pts, "Peso") + '<span class="chip ' + rc + '">' + (Bo.rate != null ? esc(Bo.rateTxt) + "/mes" : "faltan semanas") + "</span></div>";
  if (Bo.waist != null) h += '<div class="bd-row"><span>Cintura</span><b>' + Bo.waist + " cm</b>" + miniSpark(Bo.waistPts || [], "Cintura") + '<span class="chip ' + (Bo.waist >= CINT ? "bad" : "") + '">' + (Bo.waistUp != null ? (Bo.waistUp > 0 ? "+" : "") + Bo.waistUp + " en un mes" : "techo 88") + "</span></div>";
  if (Bo.arm != null) h += '<div class="bd-row"><span>Brazo</span><b>' + Bo.arm + " cm</b>" + miniSpark(Bo.armPts || [], "Brazo") + '<span class="chip ' + (Bo.armStuck ? "warn" : Bo.armDelta != null ? "ok" : "") + '">' + (Bo.armDelta != null ? (Bo.armDelta > 0 ? "+" : "") + Bo.armDelta + " en " + Bo.armWeeks + " sem" : "mensual") + "</span></div>";
  if (Bo.chest != null) h += '<div class="bd-row"><span>Pecho</span><b>' + Bo.chest + " cm</b></div>";
  return h + '<p class="muted">Metas del ' + PROG + ': peso +' + KG0 + ' a +' + KG1 + ' kg al mes; cintura bajo ' + CINT + ' cm; si el brazo no cambia en 8-12 semanas, tercera ronda del circuito D del lunes.</p></section>';
}
function pgOpen() {
  var el = $("pg"); if (!el) return; el.hidden = false; pgRender();
  /* Una vez por semana, si tienes IA, pide sola la segunda opinión */
  var last = rec("revision");
  if (aiReady() && navigator.onLine !== false && !AIREV.busy && logsDesc().length >= 4 && (!last || daysBetween(last.d, TODAY()) >= 7)) aiReview();
}
function pgClose() { var el = $("pg"); if (el) el.hidden = true; updMaybe(); }
function pgRender() {
  var body = $("pg-body"); if (!body) return;
  var C = coachRun(), B = C.B, h = "";
  h += '<section class="pg-sec"><h3 class="mini">' + (B.isDel ? "Semana de descarga" : "Bloque " + B.n + " · semana " + (B.week == null ? "–" : B.week) + " de 6-8") + "</h3>" + blockBarHTML(B) +
    '<div class="opts ex-row"><span class="muted">Exámenes (el ' + PROG + ' pide descarga):</span><button class="opt-btn' + (B.exam ? " on" : "") + '" data-v4="exam" data-w="' + B.wid + '" type="button">Esta semana</button><button class="opt-btn' + (B.examNext ? " on" : "") + '" data-v4="exam" data-w="' + B.next + '" type="button">La próxima</button></div></section>';
  var ups = C.props.filter(function (p) { return p.kind === "up"; }), other = C.props.filter(function (p) { return p.kind !== "up"; });
  h += '<section class="pg-sec"><h3 class="mini">Para decidir</h3>' + autoNoticeHTML() + other.map(propHTML).join("");
  if (ups.length) h += '<div class="ups"><div class="ups-head"><b>Listos para subir (' + ups.length + ")</b>" + (ups.length >= 2 ? '<button class="mini-btn" data-v4="papplyall" type="button">Subir todos</button>' : "") + '</div><p class="muted">Cumplieron la regla: tope del rango dos sesiones seguidas, con el RIR y el tempo que pide cada uno.</p><ul class="plain ups-list">' + ups.map(upRowHTML).join("") + "</ul></div>";
  if (!C.props.length) h += '<p class="muted">Nada pendiente: sigue el plan.</p>';
  h += "</section>";
  if (C.info.length) h += '<section class="pg-sec"><h3 class="mini">Avisos del entrenador</h3>' + C.info.map(propHTML).join("") + "</section>";
  h += weekHTML(weekReport(TODAY()), "Esta semana");
  var lw = weekReport(addDays(TODAY(), -7)); if (lw.sessions || lw.sets) h += '<details class="pg-det"><summary>La semana pasada</summary>' + weekHTML(lw, "Semana del " + shortDate(lw.mon)) + "</details>";
  h += '<section class="pg-sec"><h3 class="mini">Tus ejercicios clave</h3><p class="muted">La línea muestra las repeticiones posibles por serie (las que hiciste más las que te quedaban), sesión a sesión.</p><ul class="kxs">' + KEY_EX.map(function (id) { return keyRowHTML(id, C); }).join("") + "</ul>";
  var rest = planExIds().filter(function (id) { return KEY_EX.indexOf(id) < 0 && (EX[id] || {}).ladder; });
  h += '<details class="pg-det"><summary>Todos los demás ejercicios</summary><ul class="kxs">' + rest.map(function (id) { return keyRowHTML(id, C); }).join("") + "</ul></details></section>";
  h += bodyHTML(C.Bo);
  var ach = achievements();
  h += '<section class="pg-sec"><h3 class="mini">Logros</h3>' + (ach.length ? '<ul class="plain ach">' + ach.map(function (a) { return "<li><b>" + esc(a.t) + "</b><span>" + esc(a.s) + "</span></li>"; }).join("") + "</ul>" : '<p class="muted">Aparecen cuando registras tus series: récords, peldaños, constancia.</p>') + "</section>";
  h += '<section class="pg-sec"><h3 class="mini">Lo que viene</h3><ul class="plain">' + whatsNext(C).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
  h += aiRevHTML() + notesHTML();
  h += '<p class="muted pg-foot">Decide con las reglas del ' + PROG + ': progresión doble con RIR, regla de 24 horas, descargas cada 6-8 semanas o con dos señales, y sin sumar minutos. Las sesiones de descarga y las modificadas no cuentan para subir.</p>';
  body.innerHTML = h;
}
function upRowHTML(p) {
  var lib = EX[p.x] || {}, pid = esc(p.id);
  return '<li><div class="up-l"><b>' + esc(lib.name || p.x) + "</b> → " + esc(p.sub || "") + (p.why && p.why[0] ? "<small>" + esc(p.why[0]) + (p.why.length > 1 ? " " + esc(p.why.slice(1).join(" ")) : "") + "</small>" : "") + '</div><span class="up-b"><button class="mini-btn" data-v4="papply" data-pid="' + pid + '" type="button">Subir</button><button class="mini-btn quiet" data-v4="pdismiss" data-pid="' + pid + '" type="button">Ahora no</button></span></li>';
}
/* Tarjeta corta en la página del día */
function coachCardHTML() {
  var C; try { C = coachRun(); } catch (e) { return ""; }
  var B = C.B, n = C.props.length, todayIds = {};
  if (current && DAYS[current]) blocksOf(DAYS[current]).forEach(function (b) { blockExs(b).forEach(function (e) { todayIds[e.id] = 1; }); });
  var h = '<section class="card coach-card"><div class="cc-top"><span class="cc-k">Tu entrenador</span><span class="chip">' + esc(B.isDel ? "Semana de descarga" : "Bloque " + B.n + " · semana " + (B.week == null ? "–" : B.week) + " de 6-8") + "</span>" +
    (n ? '<span class="chip warn">' + n + " para decidir</span>" : '<span class="chip ok">Al día</span>') + "</div>";
  h += autoNoticeHTML();
  var urgent = C.props.filter(function (p) { return p.prio === 1; })[0];
  var todayUps = C.props.filter(function (p) { return p.kind === "up" && todayIds[p.x]; });
  if (urgent) h += '<p class="cc-first"><b>' + esc(urgent.title) + ".</b> " + esc((urgent.why || [])[0] || "") + "</p>";
  if (todayUps.length) h += '<p class="cc-first"><b>Hoy puedes subir:</b> ' + esc(todayUps.map(function (p) { return (EX[p.x] || {}).name; }).join(", ")) + ". Lo aplicas en cada ejercicio o en «Tu progreso».</p>";
  if (!urgent && !todayUps.length) { var f = C.props[0] || C.info[0]; if (f) h += '<p class="cc-first"><b>' + esc(f.title) + ".</b> " + esc((f.why || [])[0] || "") + "</p>"; }
  h += '<div class="hero-actions"><button class="btn" data-v4="pgopen" type="button">Ver tu progreso</button><button class="btn quiet" data-v4="talk" type="button">' + (TALK.on ? "Terminar conversación" : "Conversar por voz") + "</button></div></section>";
  return h;
}
function injectCoach(h) { var i = h.indexOf("</section>"); var c = joinCardHTML() + coachCardHTML(); return i < 0 || !c ? h : h.slice(0, i + 10) + c + h.slice(i + 10); }
function coachSettingsHTML() {
  var c = cfg(), B = blockInfo(TODAY());
  return '<details class="card" data-k="coach"><summary>Entrenador a largo plazo</summary><p class="muted">Lee tus series, el RIR, lo que mide la cámara, la rodilla y tus medidas, y te propone cambios con las reglas del ' + PROG + '. Tú decides en «Tu progreso».</p><div class="set-grid">' +
    toggleRow("coachAuto", "Subir solo los peldaños sin rodilla que ya cumplieron la regla (al cerrar la sesión; se puede deshacer)", prefVal("coachAuto")) +
    '<div class="set-row"><span>Tercera ronda del circuito D del lunes (para brazos estancados; +5 min)</span><button class="switch" role="switch" aria-checked="' + !!c.lunD3 + '" data-v4="lund3" type="button"><i></i><b>' + (c.lunD3 ? "Sí" : "No") + "</b></button></div>" +
    '<div class="set-row"><span>Semana de exámenes (pone descarga)</span><div class="opts"><button class="opt-btn' + (B.exam ? " on" : "") + '" data-v4="exam" data-w="' + B.wid + '" type="button">Esta</button><button class="opt-btn' + (B.examNext ? " on" : "") + '" data-v4="exam" data-w="' + B.next + '" type="button">La próxima</button></div></div>' +
    ((c.nl || []).length ? '<div class="set-row"><span>Semanas sin pierna: ' + esc((c.nl || []).join(", ")) + '</span><button class="opt-btn" data-v4="nlclear" type="button">Quitar</button></div>' : "") +
    '</div><div class="hero-actions"><button class="btn" data-v4="pgopen" type="button">Ver tu progreso</button></div></details>';
}

/* ---------- Memoria: notas y charla que viajan con tus datos ---------- */
function memRec() { return rec("memoria") || { id: "memoria", k: "mem", notes: [], chat: [], chatFrom: 0 }; }
function memNotes() { return (memRec().notes || []).filter(function (n) { return !n.del; }); }
function memAdd(t) {
  t = String(t || "").replace(/\s+/g, " ").trim().slice(0, 300); if (!t) return false;
  var m = clone(memRec()), now = Date.now();
  m.notes = (m.notes || []).concat([{ id: "n" + now.toString(36), t: t.charAt(0).toUpperCase() + t.slice(1), d: TODAY(), u: now }]).slice(-80);
  put(m); return true;
}
function memDel(id) { var m = clone(memRec()); (m.notes || []).forEach(function (n) { if (n.id === id) { n.del = 1; n.u = Date.now(); } }); put(m); }
var MEM_RE = /^(?:oye\s+)?(?:recuerda(?:lo)?|acuerdate|anota|apunta|guarda|no olvides)\s+(?:que|esto|lo siguiente)\b/;
function memIntent(q) {
  var n = norm(q); if (!MEM_RE.test(n)) return null;
  var t = String(q).trim().replace(/^(oye,?\s+)?(recu[eé]rda(lo)?|acu[eé]rdate|anota|apunta|guarda|no olvides)\s+(que|esto|lo siguiente)\s*:?\s*/i, "").trim();
  return t.length >= 3 ? t : null;
}
function chatLoad() {
  var m = memRec(), from = m.chatFrom || 0;
  ASK.hist = (m.chat || []).filter(function (e) { return (e.ts || 0) >= from; }).slice(-6).map(function (e) { return { role: e.r === "a" ? "assistant" : "user", content: e.t }; });
}
function chatPush(q, a) {
  if (!q || !a) return;
  ASK.hist.push({ role: "user", content: q }, { role: "assistant", content: a }); ASK.hist = ASK.hist.slice(-8);
  var m = clone(memRec()), now = Date.now();
  m.chat = (m.chat || []).concat([{ r: "u", t: String(q).slice(0, 800), ts: now }, { r: "a", t: String(a).slice(0, 1200), ts: now + 1 }]).slice(-30);
  put(m);
  var nb = $("ask-new"); if (nb) nb.hidden = false;
}
function chatNew() { ASK.hist = []; var m = clone(memRec()); m.chat = []; m.chatFrom = Date.now(); put(m); }
function notesHTML() {
  var N = memNotes();
  return '<section class="pg-sec"><h3 class="mini">Lo que la IA recuerda de ti</h3><p class="muted">Di o escribe «recuerda que…» en Dudas, en la conversación o con manos libres. La IA lo usa al responder, y viaja con tus datos a tus otros equipos.</p>' +
    (N.length ? '<ul class="plain notes">' + N.slice().reverse().map(function (n) { return '<li><span>' + esc(n.t) + " <small>" + esc(shortDate(n.d)) + '</small></span><button class="mini-btn quiet" data-v4="notedel" data-id="' + esc(n.id) + '" type="button">Borrar</button></li>'; }).join("") + "</ul>" : '<p class="muted">Aún no hay notas.</p>') +
    '<div class="nt-row"><input id="note-in" type="text" autocomplete="off" placeholder="Ej.: el hombro derecho molesta en el press" aria-label="Nueva nota"><button class="pbtn" data-v4="noteadd" type="button">Guardar</button></div></section>';
}
/* Lo que la IA sabe del largo plazo, para responder con tus números */
function aiLongTerm(x) {
  var parts = [];
  try {
    parts.push("Progreso a largo plazo (lo calcula la app con tus registros): " + coachText(null, null));
    if (x && x.id && EX[x.id]) parts.push("Detalle de " + x.name + ": " + coachText(null, x.id));
    var N = memNotes(); if (N.length) parts.push("Notas que " + NOMBRE + " pidió recordar: " + N.slice(-12).map(function (n) { return n.t + " (" + shortDate(n.d) + ")"; }).join("; ") + ".");
  } catch (e) { /* sin datos */ }
  return parts.join("\n");
}

/* ---------- Revisión del mes con IA (sus propuestas pasan por las reglas) ---------- */
var AIREV = { html: "", props: [], busy: false, text: "" };
function aiRevData() {
  var C = coachRun(), o = { hoy: TODAY(), fase: phaseN(), bloque: C.B, senales_semana: C.S.list, cuerpo: { peso_kg: C.Bo.last, ritmo_kg_mes: C.Bo.rate, cintura_cm: C.Bo.waist, cintura_cambio_mes: C.Bo.waistUp, brazo_cm: C.Bo.arm, brazo_cambio: C.Bo.armDelta, brazo_semanas: C.Bo.armWeeks }, ejercicios: {}, propuestas_app: C.props.concat(C.info).map(function (p) { return p.title; }), semana: weekReport(TODAY()) };
  delete o.semana.sig;
  planExIds().forEach(function (id) {
    var st = exStats(id).filter(function (s) { return s.valid; }).slice(0, 6), lib = EX[id];
    if (!st.length) return;
    o.ejercicios[id] = { nombre: lib.name, rodilla: lib.knee || 0, nivel: rungOf(id) + 1, de: lib.ladder ? lib.ladder.length : 1, peldano: rungText(lib, rungOf(id)), meta: (st[0].x.sets || "") + "×" + (st[0].x.hold ? st[0].x.hold + " s" : st[0].x.reps) + (st[0].x.rir ? ", RIR " + st[0].x.rir : ""), decision_app: statusOf(C.dec[id])[1],
      sesiones: st.map(function (s) { return { fecha: s.d, nivel: s.lvl + 1, series: s.vals, rir_ultima: s.lastRir, bajada_s: s.eMed }; }) };
  });
  var T = testsAll().slice(0, 2); if (T.length) o.pruebas = T;
  return JSON.stringify(o);
}
function aiRevParse(t) {
  var s = String(t || ""), m = s.match(/PROPUESTAS\s*:?\s*(\[[\s\S]*\])/i) || s.match(/(\[\s*\{[\s\S]*?"tipo"[\s\S]*\}\s*\])/), arr = [];
  if (m) { try { arr = JSON.parse(m[1]); } catch (e) { try { arr = JSON.parse(m[1].replace(/,\s*\]/, "]")); } catch (e2) { arr = []; } } }
  var C = coachRun(), out = [];
  (Array.isArray(arr) ? arr : []).slice(0, 4).forEach(function (p, i) {
    if (!p || typeof p !== "object") return;
    var tipo = norm(p.tipo || ""), id = String(p.ejercicio || "").trim(), txt = String(p.texto || "").slice(0, 260);
    if (id && !EX[id]) { var mm = exMatch(norm(id), null); id = mm ? mm.id : ""; }
    var lib = id ? EX[id] : null, r = id ? rungOf(id) : 0, R = id ? C.dec[id] : null;
    var b = { id: "ia:" + strHash(s).slice(0, 6) + ":" + i, src: "ia", prio: 3, kind: "ia", why: txt ? [txt] : [] };
    if (tipo === "subir" && lib) {
      b.title = lib.name + ": sube un peldaño";
      if (!lib.ladder || r >= lib.ladder.length - 1) b.bad = "No se aplica: ya está en el último peldaño.";
      else if (rungPhase(lib, r + 1) > phaseN()) b.bad = "No se aplica: el siguiente peldaño se abre en la fase 2.";
      else if (lib.knee && !(R && R.kind === "up")) b.bad = "No la aplico: carga la rodilla y aún no cumple la regla del " + PROG + " (tope dos sesiones seguidas con 2-3 en reserva).";
      else { b.sub = rungText(lib, r + 1); b.act = { t: "rung", x: id, to: r + 1 }; b.btn = "Subir"; if (!(R && R.kind === "up")) b.why.push("Ojo: según tus registros aún no cumple la regla de dos sesiones seguidas."); }
    } else if (tipo === "bajar" && lib) {
      b.title = lib.name + ": baja un peldaño";
      if (r <= 0) b.bad = "Ya está en el primer peldaño: baja la carga o el rango en la sesión.";
      else { b.sub = rungText(lib, r - 1); b.act = { t: "rung", x: id, to: r - 1 }; b.btn = "Bajar"; }
    } else if (tipo === "descarga") {
      b.title = "Descarga la próxima semana";
      if (C.B.isDel || C.B.nextDel) b.bad = "Ya está marcada."; else { b.act = { t: "deload", w: C.B.next }; b.btn = "Marcar descarga"; }
    } else {
      b.title = ({ comida: "Comida", tecnica: "Técnica", nota: "Nota", mantener: "Mantener" }[tipo] || "Sugerencia") + (lib ? ": " + lib.name : "");
    }
    out.push(b);
  });
  return out;
}
function aiRevHTML() {
  if (!aiReady()) return '<section class="pg-sec"><h3 class="mini">Revisión con IA</h3><p class="muted">Si configuras una IA (Ajustes → Asistente con IA), te da una segunda opinión del mes con tus números. Lo que proponga pasa por las reglas del ' + PROG + ' antes de mostrarse.</p></section>';
  var last = rec("revision");
  if (!AIREV.html && last && last.text) { AIREV.text = last.text; AIREV.props = aiRevParse(last.text); AIREV.html = aiRevOut(last.text, last.d); }
  return '<section class="pg-sec"><h3 class="mini">Revisión con IA</h3><p class="muted">Una segunda opinión con tus números de las últimas semanas. Lo que proponga pasa por las reglas del ' + PROG + ' antes de mostrarse.</p><button class="btn" data-v4="airev" type="button"' + (AIREV.busy ? " disabled" : "") + ">Pedir revisión a " + esc(aiName()) + '</button><div id="airev-out" aria-live="polite">' + (AIREV.html || "") + "</div></section>";
}
function aiRevOut(text, d) {
  var body = aiClean(String(text || "").replace(/PROPUESTAS\s*:?[\s\S]*$/i, ""));
  return '<div class="ask-a"><span class="src">' + esc(aiName()) + (d ? " · " + esc(shortDate(d)) : "") + "</span>" + body.split(/\n+/).filter(Boolean).map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") + "</div>" + (AIREV.props || []).map(propHTML).join("");
}
function aiReview() {
  if (!aiReady() || AIREV.busy) return;
  AIREV.busy = true; var out = $("airev-out"); if (out) out.innerHTML = '<p class="muted">Pensando…</p>';
  var sys = aiSys("review") + "\nAhora haces la revisión del mes como un entrenador experto que conoce el " + PROG + ". Con los datos (JSON), escribe en español sencillo y sin markdown:\n1) Cómo va, en 2 o 3 frases.\n2) Hasta 4 observaciones concretas basadas en los números: qué mejora, qué se estanca y por qué podría ser.\n3) Hasta 3 propuestas, solo dentro de las reglas del " + PROG + ": progresión doble con RIR, descargas cada 6-8 semanas o con dos señales, regla de 24 horas de la rodilla, sin agregar ejercicios ni minutos (la única excepción: tercera ronda del circuito D del lunes si los brazos se estancan 8-12 semanas).\nAl final, en una línea aparte: PROPUESTAS: [{\"tipo\":\"subir|bajar|descarga|comida|tecnica|nota\",\"ejercicio\":\"id del ejercicio tal como aparece en los datos, o vacío\",\"texto\":\"una frase\"}]";
  aiChat([{ role: "system", content: sys }, { role: "user", content: "Datos de la app (JSON):\n" + aiRevData() }], function (t) { var o = $("airev-out"); if (o) o.innerHTML = '<div class="ask-a"><p class="ai-t">' + esc(aiClean(String(t).replace(/PROPUESTAS\s*:?[\s\S]*$/i, ""))) + "</p></div>"; })
    .then(function (t) {
      AIREV.text = t; AIREV.props = aiRevParse(t); AIREV.html = aiRevOut(t, TODAY());
      put({ id: "revision", k: "rev", d: TODAY(), text: String(t).slice(0, 6000) });
      var o = $("airev-out"); if (o) o.innerHTML = AIREV.html;
    }, function (e) { var o = $("airev-out"); if (o) o.innerHTML = '<p class="ask-note">' + esc(aiErr(e)) + "</p>"; })
    .then(function () { AIREV.busy = false; });
}

/* ---------- Voz que no espera a que termine la respuesta ----------
   Lee cada frase apenas está completa: la primera llega en 1-2 segundos. */
function sayQueue(t) {
  if (!voiceOn() || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  var s = cleanSpeech(t); if (!s) return;
  try {
    var u = new SpeechSynthesisUtterance(s), v = esVoice(), rate = +pref("vozRate", 1.05) || 1.05, now = Date.now();
    if (v) u.voice = v; u.lang = v ? v.lang : "es-ES"; u.rate = rate; u.volume = 1;
    SAY.last = (SAY.until > now ? SAY.last + " " : "") + s; SAY.lastT = now;
    SAY.until = Math.max(SAY.until, now) + 700 + s.length * 72 / rate;
    u.onend = u.onerror = function () { try { if (!speechSynthesis.pending && !speechSynthesis.speaking) SAY.until = Date.now() + 350; } catch (e) {} };
    speechSynthesis.speak(u);
  } catch (e) {}
}
function speakStream() {
  var off = 0, first = true;
  return function (full, done) {
    var txt = aiClean(full), rest = txt.slice(off), idx = -1, m, re = /([.!?…;:]+["»”)]*)(\s+)|\n+/g;
    while ((m = re.exec(rest))) idx = m.index + m[0].length;
    if (done) idx = rest.length;
    if (idx <= 0) return;
    var chunk = rest.slice(0, idx).trim(); off += idx;
    if (!chunk) return;
    if (first) { first = false; try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} SAY.until = 0; SAY.last = ""; }
    sayQueue(chunk);
  };
}

/* ---------- 4. Conversación en tiempo real ----------
   Dos motores, la app elige sola:
   - Gemini Live (con tu clave gratis de Google e internet): voz a voz, responde al
     instante, puedes interrumpirlo hablando, maneja la sesión con funciones (anotar
     la serie, pasar, pausar, cortar por rodilla) y puede ver la cámara si lo permites.
   - Conversación local (sin clave o sin internet): escucha continuo, responde con tu
     IA (Ollama en la laptop, IA de Chrome u otra) o con las respuestas sin internet, y
     va leyendo cada frase apenas está lista. Si hablas mientras responde, se calla. */
var TALK = { on: false, eng: "", rec: null, restarts: 0, lastStart: 0, done: {}, t: null, err: "", state: "", line: "" };
var LV = { want: false, ws: null, ready: false, model: "", handle: null, handleT: 0, retries: 0, greet: false, goaway: false, triedFind: false,
  stream: null, ctxIn: null, node: null, src: null, mute: null, out: null, outGain: null, outT: 0, srcs: [], speakUntil: 0,
  gate: { open: false, until: 0, floor: 0.006, pre: [] }, sentEnd: true, inTxt: "", outTxt: "", box: null, duckT: null, vidT: null, video: false, lastVoice: 0, bytes: 0 };
var LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
var LIVE_DEF = "gemini-3.8-live";
function liveOK() { return !!(window.WebSocket && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext) && window.AudioWorkletNode); }
function liveReady() { return liveOK() && !!aiKeyOf("gemini") && prefVal("live"); }
function talkEngine() { return liveReady() && navigator.onLine !== false ? "live" : "local"; }
function talkEngName() { return TALK.eng === "live" ? "Gemini Live" : aiReady() ? aiName() : "respuestas sin internet"; }
function talkStart() {
  if (TALK.on) return;
  var eng = talkEngine();
  if (eng === "local" && !hfSupported()) { talkNote("Este navegador no reconoce la voz: usa Chrome (o escribe en Dudas)."); return; }
  TALK.on = true; TALK.eng = eng; TALK.line = ""; hfHold(true); askStopMic(); keepAwake(); audio();
  talkStatus(eng === "live" ? "conectando" : "escuchando");
  if (eng === "live") liveStart(); else talkLocalStart();
}
function talkStop(msg) {
  if (!TALK.on) return;
  TALK.bySession = false;
  var eng = TALK.eng;
  TALK.on = false; TALK.eng = "";
  if (eng === "live") liveStop(); else talkLocalStop();
  hfHold(false); if (!P.active) releaseAwake();
  TALK.state = ""; talkPaint(); if (msg) talkNote(msg);
  updMaybe();
}
function talkToggle() { if (TALK.on) talkStop(); else talkStart(); }
var TALK_ST = { conectando: "Conectando…", escuchando: "Te escucho", oyendo: "Te oigo…", pensando: "Pensando…", hablando: "Hablando… (puedes interrumpir)" };
function talkStatus(s, line) { TALK.state = s; if (line != null) TALK.line = line; talkPaint(); }
function talkPaint() {
  var on = TALK.on, txt = on ? (TALK_ST[TALK.state] || "En conversación") + " · " + talkEngName() : "";
  var pill = $("talk-pill"), st = $("talk-st"), b = $("p-talk"), tb = $("talk-btn"), tl = $("talk-line");
  if (pill) pill.hidden = !on || !$("ask").hidden || P.active;
  asstPaint();
  if (st) st.textContent = txt;
  if (b) b.setAttribute("aria-pressed", on ? "true" : "false");
  if (tb) { tb.textContent = on ? "Terminar conversación" : "Conversar por voz"; tb.classList.toggle("on", on); }
  if (tl) { tl.textContent = on ? txt + (TALK.line ? " — " + TALK.line : "") : (liveReady() ? "En tiempo real con Gemini Live: hablas y te responde al instante; puedes interrumpirlo." : "Conversación por voz con " + (aiReady() ? aiName() : "las respuestas sin internet") + ". Con una clave gratis de Google es en tiempo real (Ajustes → Asistente con IA)."); }
  if (P.active && on) { HF.msg = txt + (TALK.line ? " — " + TALK.line : ""); HF.msgT = Date.now(); var el = $("p-hfmsg"); if (el) { el.textContent = HF.msg; el.hidden = false; el.classList.add("heard"); } }
  document.querySelectorAll('[data-v4="talk"]').forEach(function (x) { if (x.id !== "talk-btn" && x.id !== "p-talk" && !x.closest("#talk-pill")) x.textContent = on ? "Terminar conversación" : "Conversar por voz"; });
}
function talkNote(t) {
  if (!$("ask").hidden) askNote(t);
  else if (P.active) { hfMsg(t); fbShow(t, 8000); }
  else { var s = $("talk-st"), p = $("talk-pill"); if (s && p) { s.textContent = t; p.hidden = false; setTimeout(talkPaint, 6000); } }
}
function talkBox(q) {
  var el;
  if (q) { el = askPush(q, '<p class="ai-t"></p>'); el.classList.add("talk-a"); }
  else {   // la IA habla primero (saludo): sin línea «Tú»
    var out = $("ask-out"); el = document.createElement("div"); el.className = "ask-a talk-solo"; el.innerHTML = '<p class="ai-t"></p>';
    if (out.firstChild && out.firstChild.classList && out.firstChild.classList.contains("muted")) out.innerHTML = "";
    out.insertBefore(el, out.firstChild);
  }
  return { el: el, a: el.querySelector(".ai-t"), q: el.querySelector(".ask-q") };
}
function talkShowAnswer(t) { if (P.active && t) fbShow(t, 12000); }

/* ----- Conversación local ----- */
function talkLocalStart() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, r;
  if (!SR) { talkStop("Este navegador no reconoce la voz."); return; }
  try { r = new SR(); } catch (e) { talkStop("No pude usar el micrófono."); return; }
  r.lang = pref("asrLang", "es-PE"); r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  if (pref("asrLocal", false)) { try { r.processLocally = true; } catch (e) {} }
  TALK.rec = r; TALK.done = {};
  r.onresult = talkResult;
  r.onerror = function (ev) {
    var er = ev && ev.error; TALK.err = er || "";
    if (er === "not-allowed" || er === "service-not-allowed" || er === "audio-capture") talkStop(er === "audio-capture" ? "No encontré un micrófono." : "Sin permiso de micrófono: actívalo en los ajustes del sitio.");
    else if (er === "network") talkStatus("escuchando", "este equipo necesita internet para entender la voz (o el español sin internet: Ajustes → Dictado)");
  };
  r.onend = function () {
    if (TALK.rec !== r) return; TALK.rec = null;
    if (!TALK.on || TALK.eng !== "local") return;
    TALK.restarts = Date.now() - TALK.lastStart < 1500 ? TALK.restarts + 1 : 0;
    var wait = TALK.err === "network" ? 5000 : Math.min(6000, 200 * Math.pow(2, TALK.restarts)); TALK.err = "";
    clearTimeout(TALK.t); TALK.t = setTimeout(function () { if (TALK.on && TALK.eng === "local" && !TALK.rec) talkLocalStart(); }, wait);
  };
  try { r.start(); TALK.lastStart = Date.now(); if (TALK.state !== "pensando" && TALK.state !== "hablando") talkStatus("escuchando"); } catch (e) { TALK.rec = null; }
}
function talkLocalStop() {
  clearTimeout(TALK.t); var r = TALK.rec; TALK.rec = null;
  if (r) { try { r.onend = null; r.abort(); } catch (e) {} }
  if (ASK.ctrl) { try { ASK.ctrl.abort(); } catch (e) {} }
}
function talkSpeaking() { try { return Date.now() < SAY.until || !!(window.speechSynthesis && speechSynthesis.speaking); } catch (e) { return Date.now() < SAY.until; } }
function talkEcho(n) { return !!n && Date.now() < SAY.until + 2500 && (" " + norm(SAY.last) + " ").indexOf(" " + n + " ") >= 0; }
function talkHush() {
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  SAY.until = 0;
  if (ASK.ctrl) { try { ASK.ctrl.abort(); } catch (e) {} ASK.ctrl = null; }
  if (TALK.on) talkStatus("escuchando");
}
function talkResult(ev) {
  for (var i = ev.resultIndex; i < ev.results.length; i++) {
    var res = ev.results[i], key = TALK.lastStart + ":" + i;
    if (TALK.done[key]) continue;
    var txt = String((res[0] && res[0].transcript) || ""), n = norm(txt); if (!n) continue;
    if (!res.isFinal) {
      if (talkSpeaking() && n.split(" ").length >= 2 && !talkEcho(n)) talkHush();   // te pusiste a hablar: me callo
      if (!talkSpeaking()) talkStatus("oyendo", "«" + txt.trim() + "…»");
      continue;
    }
    TALK.done[key] = 1;
    if (talkEcho(n)) continue;
    talkTurn(txt.trim());
  }
}
function talkTurn(text) {
  var n = norm(text);
  if (!n) return;
  if (/^(terminamos|termina la conversacion|terminar conversacion|deja de conversar|para de conversar|fin de la conversacion|ya no conversemos|chau|adios)\b/.test(n)) { talkStop(); say("Listo, termino la conversación.", true); return; }
  if (/^(silencio|callate|basta|shh+)\b/.test(n)) { talkHush(); return; }
  if (P.active && !P.done) { var c = hfParse(n); if (c && c.cmd !== "ask" && c.cmd !== "talk" && c.cmd !== "mem") { talkStatus("escuchando", "«" + text + "»"); hfDo(c, text); return; } }
  var mt = memIntent(text);
  if (mt) { memAdd(mt); var bx = talkBox(text); bx.a.textContent = "Anotado: lo tendré en cuenta."; say("Anotado.", true); talkStatus("escuchando", "nota guardada"); return; }
  var x = askCurrentEx(), r = askEngine(text, { x: x, voice: true }), box = talkBox(text);
  talkStatus("pensando", "«" + text + "»");
  if (!aiReady()) {
    var ans = r.found ? r.say : "Eso no lo tengo sin IA. Prueba con «¿cómo respiro?», «¿qué sigue?» o «¿cómo voy?».";
    box.a.textContent = ans; talkShowAnswer(ans); say(ans, true); talkStatus("escuchando");
    if (r.found) chatPush(text, ans);
    return;
  }
  var feed = speakStream(), shown = false;
  aiChat(aiMsgs("voice", r.x || x, text, null), function (t) {
    var c = aiClean(t); box.a.textContent = c || "Pensando…";
    if (c && !shown) { shown = true; talkStatus("hablando"); }
    feed(t, false);
  }).then(function (t) {
    feed(t, true);
    var c = aiClean(t);
    if (!c) { var fb = r.found ? r.say : "No me llegó respuesta. Pregunta de nuevo."; box.a.textContent = fb; say(fb, true); }
    else { chatPush(text, c); talkShowAnswer(c); }
    if (TALK.on) talkStatus("escuchando", "");
  }, function (e) {
    if ((e && e.name === "AbortError") || /abort/i.test(String((e && e.message) || ""))) { box.a.textContent += " …"; return; }
    var msg = r.found ? r.say : aiErr(e); box.a.textContent = msg; say(msg, true);
    if (TALK.on) talkStatus("escuchando");
  });
}

/* ----- Gemini Live ----- */
var LIVE_FNS = [
  { name: "estado_sesion", description: "Dónde va la sesión guiada ahora: paso actual con dosis y carga, lo que sigue, tiempo, series que faltan y la última serie anotada." },
  { name: "anotar_serie", description: "Anota la serie que " + NOMBRE + " acaba de terminar y pasa al paso siguiente. Úsala cuando diga cuántas repeticiones hizo.", parameters: { type: "object", properties: { repeticiones: { type: "integer", description: "Repeticiones hechas" }, rir: { type: "integer", description: "Repeticiones en reserva (0 a 4), solo si las dijo" } }, required: ["repeticiones"] } },
  { name: "control_sesion", description: "Maneja la sesión guiada: siguiente paso, anterior, pausa, seguir, 15 segundos más de descanso o repetir el aviso.", parameters: { type: "object", properties: { accion: { type: "string", enum: ["siguiente", "anterior", "pausa", "seguir", "mas_tiempo", "repetir_aviso"] } }, required: ["accion"] } },
  { name: "progreso", description: "Resumen del progreso a largo plazo calculado por la app (bloque, señales de fatiga, peso, ejercicios listos para subir o estancados). Con 'ejercicio', el detalle de ese ejercicio.", parameters: { type: "object", properties: { ejercicio: { type: "string", description: "Nombre del ejercicio, si pregunta por uno" } } } },
  { name: "guardar_nota", description: "Guarda algo que " + NOMBRE + " pide recordar (molestias, horarios, gustos). Se usa en conversaciones futuras.", parameters: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
  { name: "cortar_por_rodilla", description: "Corta el ejercicio actual por dolor de rodilla; la app lo baja un peldaño para la próxima. Solo si " + NOMBRE + " confirma dolor de rodilla en un ejercicio que la carga." },
  { name: "terminar_conversacion", description: "Termina la conversación por voz cuando " + NOMBRE + " lo pide (por ejemplo «terminamos», «ya está», «chau»). Despídete en pocas palabras." }
];
var LV_WK = "class S3Mic extends AudioWorkletProcessor{constructor(o){super();var p=(o&&o.processorOptions)||{};this.r=p.ratio||1;this.n=p.chunk||512;this.b=new Int16Array(this.n);this.i=0;this.acc=0;this.cnt=0;this.pos=0;}" +
  "process(ins){var x=ins[0]&&ins[0][0];if(!x)return true;for(var k=0;k<x.length;k++){this.acc+=x[k];this.cnt++;this.pos+=1;if(this.pos>=this.r){this.pos-=this.r;var v=this.acc/this.cnt;this.acc=0;this.cnt=0;v=v<-1?-1:v>1?1:v;this.b[this.i++]=v<0?v*32768:v*32767;if(this.i>=this.n){this.port.postMessage(this.b.buffer,[this.b.buffer]);this.b=new Int16Array(this.n);this.i=0;}}}return true;}}" +
  "registerProcessor('s3-mic',S3Mic);";
function i16b64(a) { var u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), bin = "", CH = 0x8000; for (var i = 0; i < u.length; i += CH) bin += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(bin); }
function rms16(a) { var s = 0; for (var i = 0; i < a.length; i++) { var v = a[i] / 32768; s += v * v; } return Math.sqrt(s / Math.max(1, a.length)); }
function liveSend(o) { var ws = LV.ws; if (!ws || ws.readyState !== 1) return false; try { var s = JSON.stringify(o); ws.send(s); LV.bytes += s.length; return true; } catch (e) { return false; } }
function liveSys() {
  var m = memRec(), from = m.chatFrom || 0, last = (m.chat || []).filter(function (e) { return (e.ts || 0) >= from; }).slice(-8);
  return aiSys("live") + "\n\nDatos de la app:\n" + aiContext(askCurrentEx(), 9000) +
    (last.length ? "\n\nLo último que hablaron (para dar continuidad; no lo repitas): " + last.map(function (e) { return (e.r === "a" ? "Tú: " : "" + NOMBRE + ": ") + e.t; }).join(" | ") : "");
}
function liveSetupMsg() {
  var s = {
    model: "models/" + LV.model,
    generationConfig: { responseModalities: ["AUDIO"], temperature: 0.7 },
    systemInstruction: { parts: [{ text: liveSys() }] },
    tools: [{ functionDeclarations: LIVE_FNS }],
    realtimeInputConfig: { automaticActivityDetection: { disabled: false, startOfSpeechSensitivity: pref("micMode", "normal") === "lejos" ? "START_SENSITIVITY_HIGH" : "START_SENSITIVITY_LOW", prefixPaddingMs: 300, silenceDurationMs: 800 }, activityHandling: "START_OF_ACTIVITY_INTERRUPTS" },
    inputAudioTranscription: {}, outputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: LV.handle ? { handle: LV.handle } : {}
  };
  if (LV.video) s.generationConfig.mediaResolution = "MEDIA_RESOLUTION_LOW";
  return { setup: s };
}
function liveMicStart() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }).then(function (stream) {
    LV.stream = stream;
    var AC = window.AudioContext || window.webkitAudioContext, url = URL.createObjectURL(new Blob([LV_WK], { type: "application/javascript" }));
    function build(ctx) {
      return ctx.audioWorklet.addModule(url).then(function () {
        var src = ctx.createMediaStreamSource(stream);
        var node = new AudioWorkletNode(ctx, "s3-mic", { processorOptions: { ratio: ctx.sampleRate / 16000, chunk: 512 } });
        var mute = ctx.createGain(); mute.gain.value = 0;
        node.port.onmessage = function (e) { liveMic(new Int16Array(e.data)); };
        src.connect(node); node.connect(mute); mute.connect(ctx.destination);
        LV.ctxIn = ctx; LV.node = node; LV.src = src; LV.mute = mute;
        if (ctx.state === "suspended") return ctx.resume();
      });
    }
    var c16 = null; try { c16 = new AC({ sampleRate: 16000 }); } catch (e) { c16 = null; }
    var p = c16 ? build(c16).catch(function () { try { c16.close(); } catch (e) {} return build(new AC()); }) : build(new AC());
    return p.then(function () { URL.revokeObjectURL(url); });
  });
}
/* Micrófono → Gemini. Solo manda audio cuando hablas (con 0.3 s de antes) y nunca mientras la app habla. */
function liveMic(pcm) {
  if (!LV.ready) return;
  var now = Date.now(), g = LV.gate, r = rms16(pcm), aiTalk = now < LV.speakUntil + 200;
  var gated = ttsBusy() || now < SAY.until + 250 || (!!pref("liveEcho", false) && now < LV.speakUntil + 300);
  if (gated) { g.pre = []; g.hot = 0; if (g.open) { g.open = false; liveEndAudio(); } return; }
  if (!prefVal("liveVad")) { liveAudio(pcm); return; }
  /* Mientras la IA habla, el micrófono escucha su eco: se aprende ese nivel y solo una voz
     bastante más fuerte (tú hablándole) la interrumpe, y no con un golpe suelto sino seguido. */
  var mf = MIC_F[pref("micMode", "normal")] || 1;
  if (aiTalk && !g.open) LV.echo = LV.echo ? LV.echo * 0.92 + r * 0.08 : r;
  var thr = Math.max(0.012, g.floor * 3) * mf;
  if (aiTalk) thr = Math.max(thr * 1.8, (LV.echo || 0) * 2.4);
  if (r > thr) g.hot = (g.hot || 0) + 1; else g.hot = 0;
  if (r > thr && (g.open || !aiTalk || g.hot >= 3)) {
    if (!g.open) { g.open = true; g.pre.forEach(liveAudio); g.pre = []; if (TALK.state !== "hablando") talkStatus("oyendo"); }
    g.until = now + 1300; LV.lastVoice = now; liveAudio(pcm);
  } else if (g.open) {
    liveAudio(pcm);
    if (now > g.until) { g.open = false; liveEndAudio(); }
  } else {
    if (!aiTalk) g.floor = g.floor * 0.97 + r * 0.03;
    g.pre.push(pcm); if (g.pre.length > 10) g.pre.shift();
  }
}
var MIC_F = { normal: 1, ruido: 1.6, lejos: 0.75 };
function liveAudio(pcm) { if (liveSend({ realtimeInput: { audio: { data: i16b64(pcm), mimeType: "audio/pcm;rate=16000" } } })) LV.sentEnd = false; }
function liveEndAudio() { if (!LV.sentEnd) { LV.sentEnd = true; liveSend({ realtimeInput: { audioStreamEnd: true } }); } if (TALK.state === "oyendo") talkStatus("pensando"); }
function liveOutInit() {
  var a = audio(); if (!a || LV.outGain) return;
  try {
    var comp = a.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    LV.outGain = a.createGain(); LV.outGain.gain.value = 1.3; LV.outGain.connect(comp); comp.connect(a.destination);
  } catch (e) { LV.outGain = null; }
}
function livePlay(b64) {
  var a = audio(); if (!a || LV.muteTurn) return;
  liveOutInit();
  var bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n);
  for (var i = 0; i < n; i++) { var lo = bin.charCodeAt(2 * i), hi = bin.charCodeAt(2 * i + 1), v = (hi << 8) | lo; if (v >= 32768) v -= 65536; f[i] = v / 32768; }
  if (!n) return;
  try {
    var buf = a.createBuffer(1, n, 24000); buf.getChannelData(0).set(f);
    var s = a.createBufferSource(); s.buffer = buf; s.connect(LV.outGain || a.destination);
    var t0 = Math.max(a.currentTime + 0.06, LV.outT); s.start(t0); LV.outT = t0 + buf.duration;
    LV.srcs.push(s); s.onended = function () { var k = LV.srcs.indexOf(s); if (k >= 0) LV.srcs.splice(k, 1); };
    LV.speakUntil = Date.now() + (LV.outT - a.currentTime) * 1000;
    if (TALK.state !== "hablando") talkStatus("hablando");
  } catch (e) {}
}
function liveStopAudio() { LV.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); LV.srcs = []; LV.outT = 0; LV.speakUntil = 0; }
function liveDuck() {
  if (!LV.outGain) return;
  var want = Date.now() < SAY.until ? 0.35 : 1.3;
  try { if (Math.abs(LV.outGain.gain.value - want) > 0.01) LV.outGain.gain.value = want; } catch (e) {}
  if (TALK.state === "hablando" && Date.now() > LV.speakUntil + 400 && !LV.srcs.length) talkStatus("escuchando");
}
function liveFrame() {
  if (!LV.ready || !LV.video || !CAM.on || Date.now() - LV.lastVoice > 4000) return;
  var v = $("cam-v"); if (!v || !v.videoWidth) return;
  try {
    var W = 320, H = Math.round(v.videoHeight * W / v.videoWidth), c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d"); if (!g) return; g.drawImage(v, 0, 0, W, H);
    var d = c.toDataURL("image/jpeg", 0.6).split(",")[1];
    if (d) liveSend({ realtimeInput: { video: { data: d, mimeType: "image/jpeg" } } });
  } catch (e) {}
}
function liveState() {
  if (!P.active) return "No hay una sesión guiada abierta.";
  if (P.done) return "La sesión ya terminó.";
  var st = P.steps[P.idx], parts = ["Paso actual: " + stepLabel(st) + "."];
  if (st && st.ex && (st.type === "work" || st.type === "hold")) parts.push("Dosis: " + setDose(st.ex) + (st.ex.tempo ? ", tempo " + st.ex.tempo : "") + (st.ex.rir ? ", RIR " + st.ex.rir : "") + ". Carga: " + (effLoadText(st.ex) || "peso corporal") + ".");
  var nx = nextWork(P.idx); if (nx) parts.push("Sigue: " + stepLabel(nx) + ".");
  if (P.kind === "session" && st && (st.type === "rest" || st.type === "wait")) { var pn = prepNow(P.idx); if (pn.length) parts.push("Prepara ahora: " + pn.map(function (t) { return t.say; }).join(" ")); var ah = prepAhead(P.idx, 3); if (ah.length) parts.push("Luego: " + ah.map(function (q) { return q.code + " " + q.name + " (" + q.what + ")"; }).join("; ") + "."); }
  if (st && P.running && isTimed(st)) parts.push("Quedan " + Math.round(P.remaining) + " s de este paso.");
  parts.push("Van " + fmt(P.elapsed) + " de " + fmt(P.total) + (P.kind === "session" ? "; faltan " + remainingSets() + " series" : "") + "." + (P.paused ? " En pausa." : ""));
  if (P.lastLog && !P.lastLog.skip) parts.push("Última anotada: " + P.lastLog.code + " serie " + P.lastLog.s + ", " + (P.lastLog.t != null ? P.lastLog.t + " s" : P.lastLog.r + " repeticiones") + (P.lastLog.rir != null ? ", RIR " + P.lastLog.rir : "") + ".");
  return parts.join(" ");
}
var LIVE_ACT = { siguiente: "go", anterior: "prev", pausa: "pause", seguir: "resume", mas_tiempo: "more", repetir_aviso: "repeat" };
function liveTool(name, a) {
  a = a || {};
  if ((name === "anotar_serie" || name === "control_sesion" || name === "cortar_por_rodilla") && Date.now() - (LV.cmdAt || 0) < 6000) return "La app ya lo hizo al oír tu voz; no repitas la acción. " + liveState();
  if (name === "anotar_serie" || name === "control_sesion" || name === "cortar_por_rodilla") { LV.toolAt = Date.now(); clearTimeout(LV.cmdT); }
  if (name === "estado_sesion") return liveState();
  if (name === "anotar_serie") {
    if (!P.active || P.done) return "No hay una sesión abierta: no anoté nada.";
    var n = parseInt(a.repeticiones, 10); if (!(n >= 0 && n <= 60)) return "Número de repeticiones no válido.";
    var rir = a.rir == null || a.rir === "" ? null : clamp(parseInt(a.rir, 10) || 0, 0, 4);
    hfReps({ cmd: "reps", n: n, rir: rir });
    return "Anotado: " + n + (rir != null ? " con RIR " + rir : "") + ". " + liveState();
  }
  if (name === "control_sesion") {
    if (!P.active) return "No hay una sesión abierta.";
    var c = LIVE_ACT[String(a.accion || "")]; if (!c) return "Acción no válida.";
    hfDo({ cmd: c }, ""); return "Hecho. " + liveState();
  }
  if (name === "progreso") return coachText(a.ejercicio || null, null);
  if (name === "guardar_nota") return memAdd(a.texto) ? "Guardado." : "No había nada que guardar.";
  if (name === "terminar_conversacion") { setTimeout(function () { if (TALK.on) talkStop(); }, 2500); return "Listo: la conversación se cierra en 2 segundos."; }
  if (name === "cortar_por_rodilla") {
    var s = P.active && !P.done ? P.steps[P.idx] : null;
    if (s && s.ex && s.ex.knee && (s.type === "work" || s.type === "hold")) { var nm = s.ex.name; kneeStop("dolor"); return "Cortado: " + nm + ". La próxima vez baja un peldaño. " + liveState(); }
    return "Ahora no hay un ejercicio que cargue la rodilla: no corté nada.";
  }
  return "Función desconocida.";
}
function liveTools(tc) {
  var res = (tc.functionCalls || []).map(function (fc) {
    var out; try { out = liveTool(fc.name, fc.args || {}); } catch (e) { out = "Error: " + ((e && e.message) || e); }
    return { id: fc.id, name: fc.name, response: { result: out } };
  });
  if (res.length) liveSend({ toolResponse: { functionResponses: res } });
}
function liveTurnEnd(cut) {
  var q = LV.inTxt.trim(), a = LV.outTxt.trim();
  if (LV.box && a) LV.box.a.textContent = a + (cut ? " …" : "");
  if (a) { if (q) chatPush(q, a + (cut ? " …" : "")); talkShowAnswer(a); }
  LV.inTxt = ""; LV.outTxt = ""; LV.box = null;
}
function liveMsg(m) {
  if (m.setupComplete) {
    LV.ready = true; LV.retries = 0; talkStatus("escuchando", "");
    if (LV.greet) { LV.greet = false; liveSend({ clientContent: { turns: [{ role: "user", parts: [{ text: "(" + NOMBRE + " abrió la conversación por voz desde la app. Salúdalo en una frase corta y dile que lo escuchas.)" }] }], turnComplete: true } }); }
    return;
  }
  if (m.toolCall) { liveTools(m.toolCall); return; }
  if (m.sessionResumptionUpdate) { var u = m.sessionResumptionUpdate; if (u.resumable && u.newHandle) { LV.handle = u.newHandle; LV.handleT = Date.now(); } }
  if (m.goAway) { liveReconnect(); return; }
  var sc = m.serverContent; if (!sc) return;
  if (sc.interrupted) { liveStopAudio(); liveTurnEnd(true); talkStatus("oyendo"); LV.muteTurn = false; LV.cmdDone = false; }
  if (sc.inputTranscription && sc.inputTranscription.text) {
    if (LV.turnDone) { LV.turnDone = false; LV.cmdDone = false; LV.muteTurn = false; }
    LV.inTxt += sc.inputTranscription.text;
    liveCmdCheck();
    if (!LV.box) LV.box = talkBox(LV.inTxt.trim()); else if (LV.box.q) LV.box.q.textContent = LV.inTxt.trim();
    TALK.line = "«" + LV.inTxt.trim().slice(-60) + "»"; talkPaint();
  }
  if (sc.modelTurn && sc.modelTurn.parts) sc.modelTurn.parts.forEach(function (p) {
    if (p.inlineData && p.inlineData.data && /audio/i.test(p.inlineData.mimeType || "audio/pcm")) livePlay(p.inlineData.data);
    else if (p.text && !p.thought && !sc.outputTranscription) LV.outTxt += p.text;
  });
  if (sc.outputTranscription && sc.outputTranscription.text) {
    LV.outTxt += sc.outputTranscription.text;
    if (!LV.box) LV.box = talkBox(LV.inTxt.trim() || null);
    LV.box.a.textContent = LV.outTxt.trim();
  }
  if (sc.turnComplete) { liveTurnEnd(false); LV.turnDone = true; LV.muteTurn = false; }
}
/* Los comandos («listo», «pausa», «hice ocho y me quedaban dos») se hacen al instante en la app con
   lo que Gemini transcribe de tu voz, sin esperar a que la IA decida llamar una función. */
var LIVE_QUICK = { go: 1, prev: 1, pause: 1, resume: 1, more: 1, repeat: 1, next: 1, dose: 1, time: 1 };
function liveCmdCheck() {
  clearTimeout(LV.cmdT);
  if (!P.active || P.done) return;
  var raw = LV.inTxt.trim(), n = norm(raw); if (!n) return;
  var c = hfParse(n), words = n.split(" ").length;
  if (LV.cmdDone) {   // ya se hizo algo en este turno: solo completa el RIR si llegó después
    if (c && (c.cmd === "rir" || (c.cmd === "reps" && c.rir != null)) && LV.cmdKind === "reps") { LV.cmdT = setTimeout(function () { hfDo({ cmd: "rir", n: c.cmd === "rir" ? c.n : c.rir }, raw); }, 300); }
    return;
  }
  if (!c || c.cmd === "ask" || c.cmd === "talk" || c.cmd === "mem") return;
  var run = function () {
    var c2 = hfParse(norm(LV.inTxt.trim())) || c;
    if (!c2 || c2.cmd === "ask" || c2.cmd === "talk" || c2.cmd === "mem") return;
    if (Date.now() - (LV.toolAt || 0) < 6000 && c2.cmd !== "hush") { LV.cmdDone = true; return; }   // la IA ya lo hizo con una función
    LV.cmdDone = true; LV.cmdAt = Date.now(); LV.cmdKind = c2.cmd;
    if (c2.cmd !== "hush") { LV.muteTurn = true; liveStopAudio(); }
    hfDo(c2, LV.inTxt.trim());
  };
  if (LIVE_QUICK[c.cmd] && words <= 3) run(); else LV.cmdT = setTimeout(run, 650);
}
function liveConnect() {
  var key = aiKeyOf("gemini"), ws;
  try { ws = new WebSocket((pref("liveUrl", "") || LIVE_URL) + "?key=" + encodeURIComponent(key)); } catch (e) { liveFail("No pude abrir la conexión con Gemini.", true); return; }
  ws.binaryType = "arraybuffer"; LV.ws = ws; LV.ready = false; LV.sentEnd = true; LV.gate.open = false; LV.gate.pre = [];
  LV.video = !!pref("liveCam", false) && !!CAM.on;
  ws.onopen = function () { if (LV.ws === ws) liveSend(liveSetupMsg()); };
  ws.onmessage = function (ev) {
    if (LV.ws !== ws) return;
    var d = ev.data, t = typeof d === "string" ? d : new TextDecoder().decode(d), m;
    try { m = JSON.parse(t); } catch (e) { return; }
    liveMsg(m);
  };
  ws.onerror = function () {};
  ws.onclose = function (ev) { if (LV.ws !== ws) return; LV.ws = null; LV.ready = false; if (LV.want) liveClosed(ev.code, ev.reason); };
}
function liveReconnect() {
  var old = LV.ws; LV.ws = null; LV.ready = false;
  if (old) { try { old.onclose = null; old.close(1000); } catch (e) {} }
  liveStopAudio();
  if (LV.want) { talkStatus("conectando", "renovando la conexión"); liveConnect(); }
}
function liveErrText(r) {
  r = String(r || "");
  if (/api.?key|key not valid|permission|unauthenticated|denied/i.test(r)) return "Google rechazó la clave para la conversación. Revísala en Ajustes → Asistente con IA.";
  if (/quota|exhaust|rate|resource/i.test(r)) return "Llegaste al límite gratis de conversación por ahora.";
  if (/not found|not supported|unsupported|is not available/i.test(r)) return "El modelo de conversación no está disponible.";
  return "Se cortó la conversación con Gemini" + (r ? " (" + r.slice(0, 80) + ")" : "") + ".";
}
function liveFind() { return liveFindAll().then(function (l) { return l[0] || null; }); }
function liveFindAll() {
  var key = aiKeyOf("gemini");
  return fetch(AI_PROV.gemini.url + "/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }).then(function (r) { return r.ok ? r.json() : { models: [] }; }).then(function (j) {
    var ids = (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf("bidiGenerateContent") >= 0; }).map(function (m) { return String(m.name).replace(/^models\//, ""); });
    var c = ids.filter(function (id) { return /live|native-audio/.test(id) && !/translate|transcribe|tts|extended|thinking/.test(id); });
    function ver(id) { var mm = id.match(/gemini-(\d+(?:\.\d+)?)/); return (mm ? parseFloat(mm[1]) : 0) * 10 - (/preview|exp/.test(id) ? 1 : 0); }
    c.sort(function (a, b) { return ver(b) - ver(a); });
    return c;
  }).catch(function () { return []; });
}
function liveNextModel(r, quota) {
  LV.tried = LV.tried || {}; LV.tried[LV.model] = 1;
  talkStatus("conectando", quota ? "ese modelo no tiene cuota gratis ahora: pruebo otro" : "buscando otro modelo");
  liveFindAll().then(function (list) {
    if (!LV.want) return;
    var m = (list || []).filter(function (id) { return !LV.tried[id]; })[0];
    if (m) { LV.model = m; if (!quota) setPref("liveModel", m); LV.retries = 0; liveConnect(); }
    else liveFail(liveErrText(r), true);
  });
}
function liveClosed(code, reason) {
  var r = String(reason || "");
  if (/api.?key|key not valid|permission|unauthenticated|denied/i.test(r)) { liveFail(liveErrText(r), false); return; }
  if (/quota|exhaust|rate limit|resource/i.test(r)) { if (Object.keys(LV.tried || {}).length < 4) liveNextModel(r, true); else liveFail(liveErrText(r), true); return; }
  if (/not found|not supported|unsupported|is not available/i.test(r) && Object.keys(LV.tried || {}).length < 4) { liveNextModel(r, false); return; }
  if (LV.retries >= 4) { liveFail("Se cortó la conversación varias veces. Revisa el internet.", true); return; }
  LV.retries++; talkStatus("conectando", "reconectando");
  setTimeout(function () { if (LV.want && !LV.ws) liveConnect(); }, 700 * LV.retries);
}
function liveFail(msg, fallback) {
  liveStop();
  if (!TALK.on) return;
  if (P.active && asstOn()) { talkStop(msg + " Sigo con los comandos de voz del celular."); return; }
  if (fallback && hfSupported()) { TALK.eng = "local"; talkNote(msg + " Sigo con la conversación local."); talkLocalStart(); talkStatus("escuchando"); return; }
  TALK.on = false; TALK.eng = ""; hfHold(false); talkPaint(); talkNote(msg);
}
function liveStart() {
  LV.want = true; LV.retries = 0; LV.triedFind = false; LV.bytes = 0; LV.tried = {}; LV.echo = 0; LV.muteTurn = false; LV.cmdDone = false; LV.turnDone = false; LV.cmdAt = 0; LV.toolAt = 0;
  LV.handle = null; LV.greet = true; LV.inTxt = ""; LV.outTxt = ""; LV.box = null;   // conversación nueva (la continuidad va en el contexto)
  LV.model = String(pref("liveModel", "") || "").trim() || LIVE_DEF;
  liveOutInit();
  liveMicStart().then(function () {
    if (!LV.want) { liveStop(); return; }
    clearInterval(LV.duckT); LV.duckT = setInterval(liveDuck, 150);
    clearInterval(LV.vidT); LV.vidT = setInterval(liveFrame, 2000);
    liveConnect();
  }, function (e) { liveFail(e && e.name === "NotAllowedError" ? "Sin permiso de micrófono: actívalo en los ajustes del sitio." : "No pude abrir el micrófono.", false); });
}
function liveStop() {
  LV.want = false; LV.ready = false;
  var ws = LV.ws; LV.ws = null;
  if (ws) { try { ws.onclose = null; ws.close(1000); } catch (e) {} }
  liveStopAudio();
  clearInterval(LV.duckT); clearInterval(LV.vidT); LV.duckT = LV.vidT = null;
  if (LV.node) { try { LV.node.port.onmessage = null; LV.node.disconnect(); } catch (e) {} LV.node = null; }
  if (LV.src) { try { LV.src.disconnect(); } catch (e) {} LV.src = null; }
  if (LV.stream) { try { LV.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} LV.stream = null; }
  if (LV.ctxIn) { try { LV.ctxIn.close(); } catch (e) {} LV.ctxIn = null; }
  if (LV.outGain) { try { LV.outGain.gain.value = 1.3; } catch (e) {} }
  if (LV.inTxt || LV.outTxt) liveTurnEnd(true);
}
function liveSettingsHTML() {
  var hasKey = !!aiKeyOf("gemini"), p = aiProv();
  return '<h3 class="mini">Conversación en tiempo real</h3><p class="muted">' + (hasKey ? "Con tu clave de Google la conversación usa Gemini Live: hablas y te responde al instante, puedes interrumpirlo, anota tus series y maneja la sesión. Gratis, con internet. El audio (y la cámara, si lo permites) va a Google, y en el plan gratis Google puede usarlo para mejorar sus productos." : "Sin clave de Google, «Conversar por voz» usa tu IA de arriba o las respuestas sin internet. Con una clave gratis (aistudio.google.com → Get API key) es en tiempo real con Gemini Live.") + "</p>" +
    (p !== "gemini" ? '<div class="ai-form"><label>Clave de API de Google (para la conversación)<input id="live-key" type="password" autocomplete="off" spellcheck="false" value="' + esc(aiKeyOf("gemini")) + '"></label></div>' : "") +
    '<div class="set-grid">' + toggleRow("live", "Usar Gemini Live cuando haya clave e internet", prefVal("live")) +
    toggleRow("liveCam", "Que la IA vea la cámara mientras le hablas (una foto cada 2 s)", !!pref("liveCam", false)) +
    toggleRow("liveVad", "Mandar audio solo cuando hablas (ahorra datos)", prefVal("liveVad")) +
    toggleRow("liveEcho", "Parlante fuerte: no escuchar mientras la IA habla (si se interrumpe sola)", !!pref("liveEcho", false)) + "</div>" +
    '<div class="ai-form"><label>Modelo de conversación (lo elige solo; cámbialo solo si falla)<input id="live-model" type="text" spellcheck="false" placeholder="' + LIVE_DEF + '" value="' + esc(pref("liveModel", "") || "") + '"></label></div>' +
    '<div class="hero-actions"><button class="btn" data-v4="talk" type="button">' + (TALK.on ? "Terminar conversación" : "Conversar por voz") + "</button></div>";
}

/* ---------- Plan del lunes con tercera ronda del circuito D (regla del 3.0 para brazos) ---------- */
function lunD3Plan(D) {
  var out = {}, k; for (k in D) out[k] = D[k];
  var add = 0, bl = [];
  D.blocks.forEach(function (b) {
    var c = {}, kk; for (kk in b) c[kk] = b[kk];
    if (add && c.start != null) { c.start += add; c.end += add; }
    if (b.id === "D" && b.kind === "circuit") {
      var len = b.end - b.start; add = Math.round(len / b.rounds / 15) * 15;
      c.rounds = b.rounds + 1; c.end = b.end + add;
      c.ex = b.ex.map(function (e) { var z = {}, q; for (q in e) z[q] = e[q]; z.sets = (e.sets || b.rounds) + 1; return z; });
    }
    bl.push(c);
  });
  out.blocks = bl;
  var m = String(D.window || "").match(/^(\d{1,2}):(\d{2})/);
  if (m) { var end = (+m[1]) * 60 + (+m[2]) + Math.round((bl[bl.length - 1].end || 0) / 60); out.window = m[1] + ":" + m[2] + " a " + Math.floor(end / 60) + ":" + String(end % 60).padStart(2, "0"); }
  return out;
}

/* ---------- Al cerrar una sesión: sube solo lo que cumplió la regla y guarda en GitHub ---------- */
function v4AfterClose(ids) {
  var au = ids && ids.length ? coachAfterSession(ids) : [];
  if (au.length) rerender();
  if (GH.pend || ghDirtyN()) { GH.pend = false; ghSoon(1500); }
  updMaybe();
  return au;
}
function v4Refresh() { var pg = $("pg"); if (pg && !pg.hidden) pgRender(); if (!P.active) rerender(); }

/* ---------- Clics de lo nuevo ---------- */
document.addEventListener("click", function (e) {
  var t = e.target.closest("[data-v4]");
  if (!t) { if (e.target === $("pg")) pgClose(); return; }
  var a = t.getAttribute("data-v4"), pid = t.getAttribute("data-pid");
  if (a === "pgopen") pgOpen();
  else if (a === "pgclose") pgClose();
  else if (a === "papply") {
    var p = propFind(pid);
    if (p) { propApply(p); if (p.src === "ia") AIREV.props = AIREV.props.filter(function (z) { return z.id !== pid; }); else propDismiss(pid); AIREV.html = AIREV.text ? aiRevOut(AIREV.text, (rec("revision") || {}).d) : ""; v4Refresh(); }
  }
  else if (a === "papplyall") { coachRun().props.filter(function (z) { return z.kind === "up"; }).forEach(function (z) { propApply(z); }); v4Refresh(); }
  else if (a === "pdismiss") { if (pid && pid.indexOf("ia:") === 0) { AIREV.props = AIREV.props.filter(function (z) { return z.id !== pid; }); AIREV.html = aiRevOut(AIREV.text, (rec("revision") || {}).d); } else propDismiss(pid); v4Refresh(); }
  else if (a === "undo") { coachUndo(t.getAttribute("data-t")); v4Refresh(); }
  else if (a === "exam") { var w = t.getAttribute("data-w"); setExam(w, (cfg().ex || []).indexOf(w) < 0); v4Refresh(); }
  else if (a === "lund3") { setCfgField("lunD3", !cfg().lunD3); v4Refresh(); }
  else if (a === "nlclear") { setCfgField("nl", []); v4Refresh(); }
  else if (a === "ghsave") { var dv = $("gh-dev"); if (dv) setPref("devName", String(dv.value || "").trim()); ghConnect(); }
  else if (a === "ghnow") { var st = $("gh-st"); if (st) st.textContent = "Guardando…"; ghSync(true).then(function () { ghPaint(); }); }
  else if (a === "ghforget") ghForget();
  else if (a === "ghauto") { var c = ghCfg() || {}; c.auto = c.auto === false; ghSetCfg(c); renderGlobal(); if (ghAuto()) ghSoon(500); }
  else if (a === "talk") talkToggle();
  else if (a === "vjoin" || a === "vjoin2") {
    var two = a === "vjoin2", pi = $(two ? "join-pass2" : "join-pass"), st2 = $(two ? "join-st2" : "join-st"), pw = pi ? String(pi.value || "") : "";
    if (!pw) { if (st2) st2.textContent = "Escribe la contraseña."; return; }
    if (st2) st2.textContent = "Comprobando… (tarda unos segundos)"; t.disabled = true;
    vaultJoin(pw).then(function (r) {
      VAULT.msg = ""; rerender(); renderGlobal();
      var msg = r.res === "ok" ? "Listo: este equipo ya tiene tus datos" + (r.key ? " y tu clave de Google" : "") + "." : "Unido. " + ghStatusText();
      var gs = $("gh-st"); if (gs) gs.textContent = msg; fbShow(msg, 6000); updBanner(msg); setTimeout(function () { var u = $("upd"); if (u && !UPD.ready) u.hidden = true; }, 6000);
    }, function (e) { t.disabled = false; if (st2) st2.textContent = e.message; if (pi) { pi.value = ""; pi.focus(); } });
  }
  else if (a === "vlater") { VAULT.hide = true; rerender(); }
  else if (a === "vcreate") {
    var p1 = String(($("vk-p1") || {}).value || ""), p2 = String(($("vk-p2") || {}).value || ""), vs = $("vk-st"), pb = passProblem(p1, p2);
    if (pb) { if (vs) vs.textContent = pb; return; }
    if (vs) vs.textContent = "Creando… (tarda unos segundos)"; t.disabled = true;
    vaultCreate(p1).then(function () { renderGlobal(); var d = document.querySelector('details[data-k="github"]'); if (d) d.open = true; var v2 = $("vk-st"); if (v2) v2.textContent = "Contraseña lista. Ahora descarga equipos.json y súbelo al repositorio de la app (o copia el enlace para unir)."; },
      function (e) { t.disabled = false; if (vs) vs.textContent = e.message; });
  }
  else if (a === "vunlock") {
    var pu = String(($("vk-pass") || {}).value || ""), vu = $("vk-st");
    if (!pu) { if (vu) vu.textContent = "Escribe la contraseña."; return; }
    if (vu) vu.textContent = "Comprobando…";
    keysUnlock(pu).then(function (got) { renderGlobal(); var v3 = $("vk-st"); if (v3) v3.textContent = got ? "Listo: este equipo ya tiene tu clave de Google." : "Listo: contraseña guardada en este equipo."; }, function (e) { if (vu) vu.textContent = e.message; });
  }
  else if (a === "vdl" || a === "vcopy" || a === "vlink") {
    var vo = $("vk-st");
    vaultFile().then(function (f) {
      if (!f) { if (vo) vo.textContent = "Primero conecta este equipo y crea la contraseña."; return; }
      var txt = JSON.stringify(f, null, 1);
      if (a === "vdl") { var okd = downloadText("equipos.json", txt, "application/json"); if (vo) vo.textContent = okd ? "Descargado equipos.json: súbelo al repositorio de la app, junto a index.html." : "No se pudo descargar: usa «Copiar equipos.json»."; }
      else if (a === "vcopy") copyText(txt).then(function (ok) { if (vo) vo.textContent = ok ? "Copiado. En GitHub: Add file → Create new file → nombre equipos.json → pega → Commit changes." : "No pude copiar: usa «Descargar equipos.json»."; });
      else { var link = location.origin + location.pathname + "#unir=" + encodeURIComponent(b64url(JSON.stringify(f))); copyText(link).then(function (ok) { if (vo) vo.textContent = ok ? "Enlace copiado: mándatelo (por ejemplo por WhatsApp), ábrelo en el equipo nuevo y escribe la contraseña." : link; }); }
    });
  }
  else if (a === "airev") { aiReview(); }
  else if (a === "noteadd") { var ni = $("note-in"); if (ni && String(ni.value).trim()) { memAdd(ni.value); ni.value = ""; pgRender(); } }
  else if (a === "notedel") { memDel(t.getAttribute("data-id")); pgRender(); }
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") { var pg = $("pg"); if (pg && !pg.hidden) { pgClose(); return; } }
  if (e.key === "Enter" && e.target && e.target.id === "note-in") { e.preventDefault(); var b = document.querySelector('[data-v4="noteadd"]'); if (b) b.click(); }
  if (e.key === "Enter" && e.target && /^(join-pass2?|vk-pass)$/.test(e.target.id)) { e.preventDefault(); var jb = document.querySelector(e.target.id === "join-pass" ? '[data-v4="vjoin"]' : e.target.id === "join-pass2" ? '[data-v4="vjoin2"]' : '[data-v4="vunlock"]'); if (jb) jb.click(); }
  if (P.active && (e.key === "h" || e.key === "H") && !/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) talkToggle();
});
document.addEventListener("change", function (e) {
  var t = e.target;
  if (t.id === "live-key") { setPref("aiKey_gemini", String(t.value || "").trim()); talkPaint(); }
  else if (t.id === "live-model") setPref("liveModel", String(t.value || "").trim());
});

/* ---------- Arranque de lo nuevo ---------- */
function v4Init() {
  chatLoad(); prefSyncSeed(); prefSyncApply(); vaultInit();
  if (ghAuto()) setTimeout(function () { ghSync(false); }, 1500);
  setInterval(function () { if (ghAuto() && !(P.active && !P.done) && document.visibilityState === "visible") ghSync(false); }, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (ghAuto() && Date.now() - (ghState().last || 0) > 2 * 60 * 1000) ghSync(false);
      if (UPD.ready) updMaybe(); else if (UPD.reg && Date.now() - UPD.last > 10 * 60 * 1000) updCheck();
      /* ¿Subiste equipos.json mientras tanto? */
      if (!ghReady() && !VAULT.file && Date.now() - (VAULT.initT || 0) > 30000) vaultInit();
      else if (ghReady() && vLocal() && $("vk-site") && VAULT.site !== "ok") vaultSitePaint();
    } else if (ghAuto() && ghDirtyN() && !(P.active && !P.done)) ghSync(false);
  });
  window.addEventListener("online", function () { if (ghAuto()) ghSoon(1000); });
  document.addEventListener("toggle", function (e) { var d = e.target; if (d && d.getAttribute && d.getAttribute("data-k") === "github" && d.open && ghReady() && vLocal() && VAULT.site !== "ok") vaultSitePaint(); }, true);
  window.addEventListener("storage", function (e) { if (e.key === LS_KEY + ".recs" && !P.active) { ST.recs = lsGet(LS_KEY + ".recs") || {}; DATAV++; rerender(); } });
  talkPaint();
}

/* =====================================================================
   VERSIÓN 5.0
   1. Equipo inteligente: pantalla «Prepara tu equipo» al empezar y, en cada
      descanso, lo que conviene preparar AHORA pensando 2-3 pasos adelante
      (discos, liga, mancuerna que sigue), más un vistazo a lo que viene.
   ===================================================================== */
/* Qué pide cada ejercicio además de las mancuernas. liga = dónde va anclada. */
/* Qué pide cada ejercicio además de las mancuernas y dónde va la liga: vienen de programa.js */
var EQX = typeof EQUIPO_EXTRA !== "undefined" ? EQUIPO_EXTRA : {};
var LIGA_TXT = typeof LIGAS !== "undefined" ? LIGAS.donde : {}, LIGA_DO = typeof LIGAS !== "undefined" ? LIGAS.hacer : {};
function prepNeeds(st) {
  var x = st.ex, q = EQX[x.id] || {}, lt = effLoadText(x), sp = eqParse(lt);
  return { lt: lt, db: sp && (sp.kind === "par" || sp.kind === "una") ? lt : null, pick: sp && (sp.kind === "antigua" || sp.kind === "vinilos") ? lt : null,
    liga: q.liga || null, it: q.it || [], moch: !!q.moch || !!(sp && sp.moch) };
}
function isWorkSt(s) { return !!s && (s.type === "work" || s.type === "hold") && !!s.ex; }
/* Reparte los cambios de equipo en los descansos: cada cambio va en el descanso más largo que
   queda entre el último uso de lo anterior y el primer uso de lo nuevo (si el 3.0 marca uno, ese). */
function prepPlan(steps) {
  var inv = eqInv(), state = eqStart(inv), at = {}, start = [], lastDb = -1, liga = null, lastLiga = -1, slots = [];
  steps.forEach(function (s, i) { if (s.type === "rest" || s.type === "wait") slots.push(i); });
  function len(i) { var s = steps[i]; return s.type === "rest" ? s.dur || 0 : Math.max(0, (s.target || 0) - (s.planAt || 0)); }
  function add(i, t) { if (i === -1) start.push(t); else (at[i] = at[i] || []).push(t); }
  function slot(from, to, noteRe) {
    if (from < 0) return -1;
    var c = slots.filter(function (i) { return i > from && i < to; });
    if (!c.length) return from;   // sin descanso entre medio: justo después del último uso
    if (noteRe) { var n = c.filter(function (i) { return steps[i].note && noteRe.test(steps[i].note); }); if (n.length) return n[n.length - 1]; }
    /* el descanso más largo; si empatan, el que tenga menos tareas y, luego, el más cercano a cuando se usa */
    function score(i) { return len(i) - 8 * ((at[i] || []).length); }
    var best = c[0]; c.forEach(function (i) { if (score(i) >= score(best)) best = i; });
    return best;
  }
  steps.forEach(function (s, j) {
    if (!isWorkSt(s)) return;
    var nd = prepNeeds(s);
    if (nd.db) {
      var r = eqApply(state, nd.db, inv);
      if (r.steps.length) add(slot(lastDb, j, /disco/i), { k: "db", j: j, txt: r.steps.join(" "), lt: nd.db, code: s.ex.code });
      state = r.state; lastDb = j;
    }
    if (nd.liga && nd.liga !== liga) { add(slot(liga ? lastLiga : -1, j, null), { k: "liga", j: j, from: liga, to: nd.liga, code: s.ex.code }); liga = nd.liga; }
    if (nd.liga) lastLiga = j;
  });
  return { start: start, at: at };
}
var PREP = { plan: null, key: "" };
function prepFor() { var k = P.title + "|" + P.steps.length; if (!PREP.plan || PREP.key !== k) { PREP.plan = prepPlan(P.steps); PREP.key = k; } return PREP.plan; }
function stepCode(j) { var s = P.steps[j]; return s && s.ex ? s.ex.code : ""; }
function prepTaskTxt(t) {
  if (t.k === "db") return { say: t.txt, html: '<b>Discos</b> ' + esc(t.txt) + ' <span class="pp-for">para ' + esc(t.code) + "</span>", lt: t.lt };
  var tx = LIGA_DO[t.to] + (t.from ? " (mueve la que usabas o usa otra)" : "") + ".";
  return { say: tx, html: '<b>Liga</b> ' + esc(tx) + ' <span class="pp-for">para ' + esc(t.code) + "</span>" };
}
function workIdxAfter(i) { for (var j = i + 1; j < P.steps.length; j++) if (isWorkSt(P.steps[j])) return j; return -1; }
function workIdxBefore(i) { for (var j = i - 1; j >= 0; j--) if (isWorkSt(P.steps[j])) return j; return -1; }
/* Lo que conviene hacer en el descanso i */
function prepNow(i) {
  if (P.kind !== "session") return [];
  var out = (prepFor().at[i] || []).map(prepTaskTxt), n = workIdxAfter(i);
  if (n >= 0) {
    var nd = prepNeeds(P.steps[n]), pv = workIdxBefore(n), pd = pv >= 0 ? prepNeeds(P.steps[pv]) : null, same = pv >= 0 && P.steps[pv].ex.id === P.steps[n].ex.id;
    var firstTime = true; for (var j = 0; j < n; j++) if (isWorkSt(P.steps[j]) && P.steps[j].ex.id === P.steps[n].ex.id) { firstTime = false; break; }
    if (!same && firstTime) {
      if (nd.pick && (!pd || pd.pick !== nd.pick)) out.push({ say: "Ten a mano " + eqSay(nd.pick) + ".", html: "<b>Ten a mano</b> " + esc(eqSay(nd.pick)), lt: nd.pick });
      var used = {}; for (var k = 0; k < n; k++) if (isWorkSt(P.steps[k])) prepNeeds(P.steps[k]).it.forEach(function (z) { used[z] = 1; });
      var it = nd.it.filter(function (x) { return !used[x]; });
      if (nd.moch && !(pd && pd.moch)) it.push("la mochila con peso");
      if (it.length) out.push({ say: "Ten a mano: " + it.join(", ") + ".", html: "<b>Ten a mano</b> " + esc(it.join(" · ")) });
    }
  }
  return out;
}
function prepPlanSay(i) {
  var t = prepNow(i); if (!t.length) return "";
  return "Mientras: " + t.map(function (x) { return x.say; }).join(" ");
}
/* Los 2-3 ejercicios que vienen después del siguiente, con lo que usan */
function prepAhead(i, nMax) {
  var out = [], seen = {}, first = workIdxAfter(i);
  if (first >= 0) seen[P.steps[first].ex.id] = 1;
  for (var k = 0; k < i; k++) if (isWorkSt(P.steps[k])) seen[P.steps[k].ex.id] = 1;   // lo ya hecho no es «lo que viene»
  for (var j = first + 1; first >= 0 && j < P.steps.length && out.length < (nMax || 3); j++) {
    var s = P.steps[j]; if (!isWorkSt(s) || seen[s.ex.id]) continue; seen[s.ex.id] = 1;
    var nd = prepNeeds(s), bits = [];
    if (nd.db || nd.pick) bits.push(eqSay(nd.db || nd.pick)); else if (nd.lt && !/^peso corporal$/i.test(nd.lt)) bits.push(nd.lt);
    if (nd.liga) bits.push("liga " + LIGA_TXT[nd.liga]);
    nd.it.forEach(function (x) { if (!(nd.liga && /silla/.test(x) && nd.liga === "silla")) bits.push(x); });
    out.push({ code: s.ex.code, name: exShort(s.ex), what: bits.join(" · ") || "sin equipo" });
  }
  return out;
}
function prepNowHTML(i) {
  var now = prepNow(i);
  return now.length ? '<div class="pp-now"><span class="k">Mientras descansas</span><ul>' + now.map(function (t) { return "<li>" + t.html + "</li>"; }).join("") + "</ul></div>" : "";
}
function prepAheadHTML(i) {
  var ah = prepAhead(i, 3);
  return ah.length ? '<div class="pp-ahead"><span class="k">Luego</span><ol>' + ah.map(function (a) { return "<li><b>" + esc(a.code + " " + a.name) + "</b> <span>" + esc(a.what) + "</span></li>"; }).join("") + "</ol></div>" : "";
}
/* ---------- Pantalla «Prepara tu equipo» al empezar la sesión ---------- */
function prepStartData() {
  var D = DAYS[P.key] || {}, mode = P.plan && P.plan.opts.mode, pl = prepFor();
  var setup = (mode === "stop" && D.stopPlan && D.stopPlan.setup ? D.stopPlan.setup : D.setup || []).filter(function (l) { return !/principal/i.test(l); });
  var first = -1; for (var j = 0; j < P.steps.length; j++) if (isWorkSt(P.steps[j]) && prepNeeds(P.steps[j]).db) { first = j; break; }
  var dbNow = pl.start.filter(function (t) { return t.k === "db"; }), lt = first >= 0 ? prepNeeds(P.steps[first]).db : null;
  var later = []; Object.keys(pl.at).map(Number).sort(function (a, b) { return a - b; }).forEach(function (i) { pl.at[i].forEach(function (t) { if (t.k === "db") later.push({ i: i, t: t }); }); });
  return { D: D, setup: setup, prep: D.prep || [], lt: lt, first: first, dbNow: dbNow, later: later };
}
function prepWhen(i) {
  var s = P.steps[i]; if (!s) return "";
  if (s.type === "rest" || s.type === "wait") { var b = s.block; var lastOfBlock = true; for (var j = i + 1; j < P.steps.length; j++) { if (P.steps[j].block !== b) break; if (P.steps[j].type === "rest" || P.steps[j].type === "wait") { lastOfBlock = false; break; } } return (lastOfBlock ? "En el último descanso del bloque " : "En un descanso del bloque ") + (b ? b.label : ""); }
  return "Después de " + (s.ex ? s.ex.code : "ese ejercicio");
}
function prepStartHTML() {
  var d = prepStartData(), h = "";
  if (d.lt) {
    h += '<div class="pp-db"><span class="k">Mancuernas para empezar' + (d.first >= 0 ? " (" + esc(P.steps[d.first].ex.code) + ")" : "") + "</span>" + eqHTML(d.lt, true) +
      (d.dbNow.length ? '<p class="eq-how">' + esc(d.dbNow.map(function (t) { return t.txt; }).join(" ")) + "</p>" : '<p class="muted">Como las guardas ya sirven.</p>') + "</div>";
    if (d.later.length) h += '<div class="pp-later"><span class="k">Cambios durante la sesión</span><ul>' + d.later.map(function (o) { return "<li><b>" + esc(prepWhen(o.i)) + ":</b> " + esc(o.t.txt) + "</li>"; }).join("") + "</ul></div>";
  }
  var rows = d.setup.map(function (l, k) { return '<li><button class="pp-chk" data-v5="ppchk" type="button" aria-pressed="false">' + esc(l) + "</button></li>"; }).join("");
  if (rows) h += '<div class="pp-list"><span class="k">Deja listo</span><ul>' + rows + "</ul></div>";
  if (d.prep.length) h += '<div class="pp-list pp-small"><span class="k">Antes</span><ul>' + d.prep.map(function (l) { return '<li><button class="pp-chk" data-v5="ppchk" type="button" aria-pressed="false">' + esc(l) + "</button></li>"; }).join("") + "</ul></div>";
  return h;
}
function prepStartSay() {
  var d = prepStartData(), parts = [];
  if (d.dbNow.length) parts.push(d.dbNow.map(function (t) { return t.txt; }).join(" "));
  else if (d.lt) parts.push("Empiezas con " + eqSay(d.lt) + ".");
  if (d.setup.length) parts.push("Deja listo: " + d.setup.map(function (l) { return l.replace(/\s*\([^)]*\)\s*/g, " ").replace(/,.*$/, "").trim(); }).join("; ") + ".");
  return "Antes de empezar. " + parts.join(" ") + " Toca empezar cuando estés listo.";
}
function renderPrep() {
  var tone = "prep";
  $("p-body").className = "p-body t-prep tone-" + tone;
  $("p-kind").textContent = "Antes de empezar";
  $("p-title").textContent = "Prepara tu equipo";
  var pl = $("p-line"); if (pl) { pl.innerHTML = ""; pl.hidden = true; }
  $("p-demo").innerHTML = ""; $("p-hero").className = "p-hero";
  $("p-sub").innerHTML = '<span class="p-dose">' + esc(minLabel(P.total)) + " · " + countSets(P.steps) + " series</span>";
  $("p-extra").innerHTML = prepStartHTML();
  $("p-count").textContent = ""; $("p-count").className = "p-count empty";
  $("p-pacer").hidden = true;
  var nx = P.steps[0]; $("p-next").textContent = nx ? "Primero: " + stepLabel(nx) : "";
  $("p-live").textContent = "Prepara tu equipo";
  updateButtons(); updateClock(); renderLogBar();
}
document.addEventListener("click", function (e) {
  var t = e.target.closest ? e.target.closest("[data-v5]") : null; if (!t) return;
  var a = t.getAttribute("data-v5");
  if (a === "ppchk") t.setAttribute("aria-pressed", t.getAttribute("aria-pressed") === "true" ? "false" : "true");
  else if (a === "seen50" || a === "seen60") { setPref(a, true); var c = t.closest(".news"); if (c) c.remove(); }
});
/* =====================================================================
   2. Figura que muestra cómo se hace cada ejercicio: el dibujo vive en figuras.js (FIG).
   Aquí solo se conecta con la sesión (la figura sigue la guía de tempo) y con los ajustes.
   ===================================================================== */
function figOK() { return typeof FIG !== "undefined"; }
function demoOf(id) { return figOK() && FIG.has(id) ? FIG.get(id, 0) : null; }
/* x = el ejercicio ya resuelto (con su tempo y peldaño). sync = sigue la guía de tempo de la serie actual. */
function demoHTML(x, sync, cls) {
  if (!figOK() || !x || !FIG.has(x.id)) return "";
  FIG.setAnim(pref("demoAnim", true) !== false);
  return FIG.html(x, { sync: sync, cls: cls });
}
if (figOK()) {
  FIG.pacer = function (id) { var st = P.active ? P.steps[P.idx] : null; if (!PC.running || !st || !st.ex || st.ex.id !== id) return null; return { t: pacerTime() - PC.lead, phases: PC.phases }; };
  FIG.slow = function () { return !!CAM.on; };
}
/* Video de referencia (con internet): búsqueda en YouTube del ejercicio */
function videoURL(x) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(String(x.name || "").replace(/\s*\([^)]*\)/g, "") + " técnica correcta"); }
var ITEM_DEMO = typeof FIGURA_DE_ITEM !== "undefined" ? FIGURA_DE_ITEM : {};
function itemDemoEx(it) { var id = ITEM_DEMO[it.name], x = EX[id] || {}; return { id: id, name: it.name, tempo: "", start: x.start, hold: 0, rung: 0 }; }
/* =====================================================================
   3. Un solo asistente de voz en la sesión.
   Encendido: con clave de Google e internet usa Gemini Live (te oye, conversa, maneja la sesión
   y los comandos se hacen al instante con lo que transcribe); si no, los comandos de voz del celular.
   Si Live se corta o se acaba la cuota, sigue solo con los comandos del celular.
   ===================================================================== */
function asstOn() { var v = pref("asst", null); return v == null ? !!pref("hf", false) : !!v; }
function asstEngine() { return liveReady() && navigator.onLine !== false ? "live" : "local"; }
function asstSync(announce) {
  if (!P.active || P.done) { hfSync(); return; }
  if (asstOn() && asstEngine() === "live" && !TALK.on) { TALK.bySession = true; talkStart(); LV.greet = false; }
  else if (!asstOn() && TALK.on && TALK.bySession) talkStop();
  hfSync();
  if (announce) {
    if (!asstOn()) say("Asistente apagado.", true);
    else if (TALK.on && TALK.eng === "live") say("Asistente con Gemini: háblame cuando quieras. Los comandos como «listo» o «pausa» los hago al instante.", true);
    else if (hfSupported()) say("Asistente activado. Di «listo» al terminar cada serie, «pausa» o «hice ocho».", true);
    else hfMsg("Este navegador no entiende la voz: usa Chrome. El gesto con la cámara sí funciona.");
  }
  asstPaint();
}
function asstToggle() { var on = !asstOn(); setPref("asst", on); setPref("hf", on); asstSync(true); }
function asstPaint() {
  var b = $("p-asst"); if (!b) return;
  var on = asstOn(), live = TALK.on && TALK.eng === "live";
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.textContent = on ? (live ? "Asistente · Gemini" : "Asistente") : "Asistente";
  b.classList.toggle("live", on && live);
}
function prepVoice() {
  if (P.kind !== "session") { say("En esta rutina no hay equipo que cambiar.", true); return; }
  var i = P.idx, st = P.steps[i];
  if (!restLike(st)) { for (var j = i; j < P.steps.length; j++) if (restLike(P.steps[j])) { i = j; break; } }
  var now = prepNow(i), ah = prepAhead(i, 2);
  var t = now.length ? (restLike(st) ? "Ahora: " : "En el próximo descanso: ") + now.map(function (q) { return q.say; }).join(" ") : "Nada que cambiar por ahora.";
  if (ah.length) t += " Luego: " + ah.map(function (q) { return q.name + (q.what && q.what !== "sin equipo" ? ", con " + q.what : ""); }).join("; ") + ".";
  say(t, true);
}
/* Tarjeta de novedades (una vez) */
function whatsNewHTML() {
  if (pref("seen60", false)) return "";
  return '<section class="card news"><h2 class="sec-title">Novedades de la versión 6.0</h2><ul class="plain">' +
    "<li><b>Sesión continua:</b> el descanso, la serie y los cambios avanzan solos. Con tempo, la serie termina sola al llegar al tope; el reloj de arriba dice si vas atrasado y a qué hora terminas.</li>" +
    "<li><b>Cambios con su cuenta:</b> entre ejercicios sin descanso hay unos segundos con lo que debes hacer (tomar la liga, bajar al piso…).</li>" +
    "<li><b>En cada descanso, con detalle:</b> qué hacer ahora (discos exactos, liga, mancuerna), cómo empieza el siguiente ejercicio y qué dejar listo para después. Ya no una lista de nombres.</li>" +
    "<li><b>Figuras con cuerpo y movimiento</b>, y la de tu peldaño: si tu variante cambia la forma (pies en la silla, barra, a una pierna…), la figura también.</li>" +
    "<li><b>Todo en una pantalla</b>, en vertical y en horizontal, y <b>Ajustes aparte</b> (botón de engranaje), también dentro de la sesión.</li>" +
    '</ul><div class="hero-actions"><button class="btn" data-v5="seen60" type="button">Entendido</button></div></section>';
}
window.S3v5 = { demoHTML: demoHTML, demoDraw: figOK() ? FIG.draw : null, demoFit: figOK() ? FIG.fit : null, DEMOS: figOK() ? FIG.DEMOS : {}, prepPlan: prepPlan, enterStep: enterStep, prepNow: prepNow };
/* =====================================================================
   VERSIÓN 6.0
   1. Sesión continua: cambios entre ejercicios con su cuenta, retraso real
      y lo que hay que preparar, con detalle (qué, cómo, para qué ejercicio).
   ===================================================================== */
/* Dónde se hace cada ejercicio, según su figura: de pie, sentado, en el piso o en la barra */
function posOf(x) {
  if (!figOK() || !x || !FIG.has(x.id)) return "";
  var D = FIG.get(x.id, x.rung); if (!D || !D.C) return "";
  if ((D.props || []).some(function (o) { return !!o.bar; })) return "barra";
  var J = FIG.joints(D, D.C), py = J.pel[1], hand = Math.min(J.wrR[1], J.wrL[1]), lean = Math.abs((D.C.t || [0])[0]);
  if (hand < 12 || py < 30 || (py < 52 && lean > 45)) return "piso";
  if (py < 60 && lean < 30) return "sentado";
  return "pie";
}
var POS_TXT = { pie: "de pie", sentado: "sentado", piso: "en el piso", barra: "en la barra" };
var POS_GO = { pie: "Ponte de pie", sentado: "Siéntate", piso: "Baja al piso", barra: "Ve a la barra" };
function setupShort(x, max) {
  var s = String((x && x.setup) || "").split(/\.\s/)[0].trim();
  if (s && !/\.$/.test(s)) s += ".";
  max = max || 120;
  if (s.length > max) s = s.slice(0, max - 4).replace(/\s+\S*$/, "") + "…";
  return s;
}
function flowLead(prevSt, old, i) {
  if (!prevSt || old < 0) return 5;                                   // primer paso: tiempo para ponerte en posición
  if (i !== old + 1) return 3;                                        // saltaste o volviste
  if (restLike(prevSt) || prevSt.type === "tr") return EST.flowLead;  // la cuenta 3-2-1 ya sonó en el descanso o el cambio
  return 3;
}
/* ---------- Cambios entre ejercicios distintos sin descanso ---------- */
function movable(s) { return !!s && (s.type === "work" || s.type === "hold" || s.type === "item" || s.type === "itemhold"); }
function needsChange(a, b) {
  if (!movable(a) || !movable(b) || sameMove(a, b)) return false;
  if (!a.ex && !b.ex) return false;                                   // entre pasos del calentamiento o del enfriamiento no hace falta
  if (a.ex && b.ex && a.ex.id === b.ex.id) return false;
  return true;
}
function moveInfo(s) {
  if (!s || !s.ex) return { pos: "", eq: "", liga: "", it: "", moch: false };
  var nd = prepNeeds(s);
  return { pos: posOf(s.ex), eq: nd.db || nd.pick || "", pick: nd.pick || "", db: nd.db || "", liga: nd.liga || "", it: nd.it.join("|"), its: nd.it, moch: nd.moch };
}
function trSecs(a, b) {
  var A = moveInfo(a), B = moveInfo(b), t = 6;
  if (A.pos && B.pos && A.pos !== B.pos) t += 4;
  if (B.eq !== A.eq) t += 3;
  if (B.liga && B.liga !== A.liga) t += 5;
  if (B.it && B.it !== A.it) t += 2;
  return Math.min(18, t);
}
function withChanges(steps, prevLast) {
  var out = [], last = prevLast;
  steps.forEach(function (s) {
    if (last && needsChange(last, s)) { out.push({ type: "tr", block: s.block, dur: trSecs(last, s), to: s, from: last }); if (s.type === "work" || s.type === "hold") s.afterTr = true; }
    out.push(s); last = s;
  });
  return out;
}
/* ---------- Cuánto vas atrasado (o adelantado) y a qué hora terminas ---------- */
function estOf(st) { return st.type === "wait" ? Math.max(0, (st.target || 0) - (st.planAt || 0)) : stepEst(st); }
function planDelay() {
  var st = P.steps[P.idx];
  if (!st || P.kind !== "session" || P.done || P.prep || P.enterAt == null || st.planAt == null) return null;
  return (P.enterAt - st.planAt) + Math.max(0, (P.elapsed - P.enterAt) - estOf(st));
}
function finishClock() {
  var st = P.steps[P.idx]; if (!st || st.planAt == null) return "";
  var left = Math.max(0, P.total - (st.planAt + Math.min(P.elapsed - (P.enterAt || 0), estOf(st))));
  var d = new Date(Date.now() + left * 1000);
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
}
/* Lo que se pasó del plan en cada paso (para ver dónde se va el tiempo al final) */
function tmStep(prevSt, old, i) {
  if (P.kind !== "session" || !prevSt || P.enterAt == null || P.prep) { P.enterAt = P.elapsed; return; }
  var T = P.tm || (P.tm = { serie: 0, descanso: 0, cambio: 0, pausa: 0 });
  if (i === old + 1) {
    var k = restLike(prevSt) ? "descanso" : prevSt.type === "tr" ? "cambio" : "serie";
    T[k] += Math.max(0, (P.elapsed - P.enterAt) - estOf(prevSt));
  }
  P.enterAt = P.elapsed;
}
function tmSummary() {
  var T = P.tm || {}, parts = [];
  [["serie", "series más largas"], ["descanso", "descansos alargados"], ["cambio", "cambios lentos"], ["pausa", "pausas"]].forEach(function (k) { if ((T[k[0]] || 0) >= 20) parts.push(k[1] + " +" + fmt(T[k[0]])); });
  return parts;
}
/* ---------- Qué preparar: ahora, lo que sigue y lo que conviene dejar listo ---------- */
function taskLI(t) { return '<li class="rt-' + (t.k || "x") + '">' + t.html + "</li>"; }
function prepTasks(i) {
  if (P.kind !== "session") return [];
  var st = P.steps[i], pl = prepFor(), out = (pl.at[i] || []).map(prepTaskTxt), n = workIdxAfter(i);
  if (st && st.type === "tr" && i > 0 && pl.at[i - 1] && isWorkSt(P.steps[i - 1])) out = pl.at[i - 1].map(prepTaskTxt).concat(out);   // cambios sin descanso de por medio
  out.forEach(function (t) { t.k = /^<b>Liga/.test(t.html) ? "liga" : "db"; });
  if (n < 0) return out;
  var nx = P.steps[n], B = moveInfo(nx), pv = workIdxBefore(n), A = pv >= 0 ? moveInfo(P.steps[pv]) : { pos: "", pick: "", liga: "", its: [], moch: false };
  var same = pv >= 0 && P.steps[pv].ex.id === nx.ex.id;
  if (!same) {
    if (A.pick && A.pick !== B.pick) out.push({ k: "x", say: "Deja " + eqSay(A.pick) + ".", html: "<b>Deja</b> " + esc(eqSay(A.pick)) });
    if (B.pick && B.pick !== A.pick) out.push({ k: "x", say: "Toma " + eqSay(B.pick) + ".", html: "<b>Toma</b> " + esc(eqSay(B.pick)), lt: B.pick });
    var used = {}; for (var k = 0; k < n; k++) if (isWorkSt(P.steps[k])) prepNeeds(P.steps[k]).it.forEach(function (z) { used[z] = 1; });
    var it = B.its.filter(function (z) { return !used[z] && A.its.indexOf(z) < 0; });
    if (B.moch && !A.moch) it.push(eqParse(effLoadText(nx.ex)) && eqParse(effLoadText(nx.ex)).moch ? "la mochila de " + kgTxt(eqParse(effLoadText(nx.ex)).moch) + " kg" : "la mochila con peso");
    if (it.length) out.push({ k: "x", say: "Ten a mano " + it.join(", ") + ".", html: "<b>Ten a mano</b> " + esc(it.join(" · ")) });
    /* cambiar de postura solo se pide en el cambio (en el descanso lo dice la tarjeta «Sigue») */
    if (B.pos && A.pos !== B.pos && st && st.type === "tr") out.push({ k: "pos", say: POS_GO[B.pos] + ".", html: "<b>" + esc(POS_GO[B.pos]) + "</b>" + (A.pos ? ' <span class="pp-for">(antes ' + esc(POS_TXT[A.pos]) + ")</span>" : "") });
  }
  return out;
}
/* Lo de los ejercicios que vienen después del siguiente, hasta el próximo descanso largo, que conviene dejar listo ya */
function laterTasks(i) {
  if (P.kind !== "session") return [];
  var first = workIdxAfter(i), out = [], seen = {}, base = P.steps[i] ? P.steps[i].planAt || 0 : 0, pl = prepFor();
  if (first < 0) return out;
  for (var k = 0; k <= first; k++) if (isWorkSt(P.steps[k])) seen[P.steps[k].ex.id] = 1;
  var have = moveInfo(P.steps[first]), haveIt = {}; have.its.forEach(function (z) { haveIt[z] = 1; });
  for (var j = first + 1; j < P.steps.length && out.length < 3; j++) {
    var s = P.steps[j];
    if ((s.type === "rest" && s.dur >= 25) || (s.type === "wait")) break;     // ese descanso ya alcanza para prepararlo
    if (!isWorkSt(s) || seen[s.ex.id]) continue;
    seen[s.ex.id] = 1;
    var B = moveInfo(s), bits = [], mins = Math.max(0, Math.round(((s.planAt || 0) - base) / 60));
    if (B.pick && B.pick !== have.pick) bits.push(eqSay(B.pick));
    if (B.liga && B.liga !== have.liga && !(pl.at[j - 1] || []).length) bits.push("la liga " + LIGA_TXT[B.liga]);
    B.its.forEach(function (z) { if (!haveIt[z]) bits.push(z); });
    if (B.moch && !have.moch) bits.push("la mochila");
    if (!bits.length) continue;
    out.push({ k: "later", say: "Para " + s.ex.code + ", deja listo: " + bits.join(", ") + ".", html: "<b>Para " + esc(s.ex.code) + "</b> " + esc(exShort(s.ex)) + (mins ? ' <span class="pp-for">en ~' + mins + " min</span>" : "") + ": deja listo " + esc(bits.join(" · ")) });
  }
  return out;
}
function nextCardHTML(nx) {
  if (!nx) return "";
  if (!nx.ex) return '<div class="rc rc-next"><span class="k">Sigue</span><b>' + esc(nx.item ? nx.item.name : stepLabel(nx)) + "</b>" + (nx.item && nx.item.how ? '<p class="rc-pos">' + esc(nx.item.how) + "</p>" : "") + "</div>";
  var x = nx.ex, lt = effLoadText(x), pos = posOf(x), dose = setDose(x) + (x.side ? " por lado" : ""), meta = [];
  if (x.tempo) meta.push((tempoParts(x.tempo) ? "tempo " : "") + x.tempo);
  var rir = P.plan && P.plan.opts && P.plan.opts.deload ? "3-4" : x.rir; if (rir) meta.push(/^\d/.test(rir) ? "RIR " + rir : rir);
  return '<div class="rc rc-next"><span class="k">Sigue · serie ' + nx.round + " de " + nx.rounds + (nx.side ? " · lado " + nx.side : "") + (x.rungs > 1 ? " · nivel " + (Math.min(x.rung || 0, x.rungs - 1) + 1) : "") + "</span>" +
    "<b>" + esc(x.code + ". " + x.name) + "</b>" +
    '<span class="rc-dose">' + esc(dose + (meta.length ? " · " + meta.join(" · ") : "")) + "</span>" +
    (lt && eqParse(lt) ? eqChipHTML(lt) : "") +
    (x.rung > 0 && x.rungText ? '<span class="rc-rung">' + esc(x.rungText) + "</span>" : "") +
    '<p class="rc-pos">' + (pos ? "<b>" + esc(POS_TXT[pos].charAt(0).toUpperCase() + POS_TXT[pos].slice(1)) + ".</b> " : "") + esc(setupShort(x)) + "</p></div>";
}
function restCardHTML(i) {
  var st = P.steps[i], nx = nextWork(i), now = prepTasks(i), later = laterTasks(i), h = "";
  var noteDone = st.note && /disco/i.test(st.note) && now.some(function (q) { return q.k === "db"; });
  if (st.note && !noteDone) h += '<p class="p-note">' + esc(st.note) + "</p>";
  if (now.length) h += '<div class="rc rc-now"><span class="k">' + (st.type === "tr" ? "Haz ahora" : "Ahora, mientras descansas") + "</span><ul>" + now.map(taskLI).join("") + "</ul></div>";
  h += nextCardHTML(nx);
  if (later.length) h += '<div class="rc rc-later"><span class="k">Deja listo para después</span><ul>' + later.map(taskLI).join("") + "</ul></div>";
  return h;
}
/* Lo que se dice al entrar al descanso o al cambio */
function restSay(i) {
  var now = prepTasks(i), later = laterTasks(i).slice(0, 1), nx = nextWork(i), parts = [];
  if (now.length) parts.push((P.steps[i].type === "tr" ? "" : "Ahora: ") + now.map(function (q) { return q.say; }).join(" "));
  if (later.length) parts.push(later[0].say);
  if (nx) { var pos = nx.ex ? posOf(nx.ex) : ""; parts.push(nextSay(nx).replace(/\.$/, "") + (pos && !(now.some(function (q) { return q.k === "pos"; })) ? ", " + POS_TXT[pos] : "") + "."); }
  return parts.join(" ");
}
function posSayNext() {
  var nx = nextWork(P.idx); if (!nx || !nx.ex) return "";
  var pos = posOf(nx.ex); return "En posición" + (pos ? ", " + POS_TXT[pos] : "") + ".";
}
/* Línea de abajo durante la serie: qué viene después, con lo que hace falta */
function nextLineTxt(i) {
  var st = P.steps[i], nx = P.steps[i + 1]; if (!nx) return "Después: fin de la sesión";
  if (nx.type === "rest") { var w = nextWork(i + 1); return "Después: descanso " + nx.dur + " s" + (w && w.ex ? " → " + w.ex.code + " " + exShort(w.ex) : ""); }
  if (nx.type === "tr") { var w2 = nx.to; return "Después: cambio de " + nx.dur + " s → " + (w2 && w2.ex ? w2.ex.code + " " + exShort(w2.ex) : stepLabel(w2)); }
  if (st && sameMove(st, nx)) return "Después: lado " + nx.side + ", empieza solo";
  return "Después: " + stepLabel(nx);
}
/* =====================================================================
   2. Ajustes en su propia pantalla (por secciones) y una hoja rápida
      dentro de la sesión, que se abre sin salir (el reloj espera).
   ===================================================================== */
var CFGT = [["sesion", "Sesión"], ["voz", "Voz y sonido"], ["equipo", "Mis mancuernas"], ["camara", "Cámara"], ["asistente", "Asistente e IA"], ["datos", "Mis equipos y datos"], ["entrenador", "Entrenador y fase"], ["ayuda", "Pantalla y ayuda"]];
var CFG = { tab: "sesion", open: false };
function openCards(h) { return String(h || "").replace(/<details class="card/g, '<details open class="card'); }
function secHTML(title, rows) { return '<section class="card"><h2 class="sec-title">' + esc(title) + '</h2><div class="set-grid">' + rows + "</div></section>"; }
function flowRowsHTML() {
  return toggleRow("flujo", "Sesión continua: todo avanza solo, sin tocar el celular", prefVal("flujo")) +
    toggleRow("topeFin", "Con tempo, la serie termina sola al llegar al tope del rango", prefVal("topeFin")) +
    toggleRow("flujoFin", "Sin tempo, pasar solo al descanso cuando se acaba el tiempo de la serie", prefVal("flujoFin"));
}
var GIRO = { msg: "", mine: false };
function screenRowsHTML() {
  return toggleRow("pantalla", "Pantalla completa al empezar la sesión (más espacio)", !!pref("pantalla", false)) +
    optRow("Giro de la pantalla en la sesión", "giro", [["auto", "Automático"], ["vertical", "Fijo vertical"], ["horizontal", "Fijo horizontal"]], pref("giro", "auto")) +
    '<p class="muted" id="giro-out">' + esc(GIRO.msg || "Fijar el giro usa la pantalla completa (Chrome en Android). Si tu celular no lo permite, usa el bloqueo de rotación del celular.") + "</p>";
}
function voiceRowsHTML() {
  return toggleRow("voice", "Voz en la sesión guiada", voiceOn()) +
    optRow("Velocidad de la voz", "vozrate", [["0.92", "Lenta"], ["1.05", "Normal"], ["1.2", "Rápida"]], String(pref("vozRate", 1.05))) +
    optRow("Volumen de los avisos", "vol", [["normal", "Normal"], ["alto", "Alto"], ["max", "Máximo"]], pref("vol", "alto")) +
    '<div class="set-row"><span>Escuchar los sonidos de la sesión</span><div class="opts"><button class="opt-btn" data-act="sndtest" type="button">Probar sonido</button></div></div><p class="muted" id="snd-out" aria-live="polite"></p>';
}
function tempoRowsHTML() {
  return toggleRow("tempo", "Guía de tempo: cuenta las fases y las repeticiones", pref("tempo", false)) +
    optRow("Sonido del tempo", "tempotone", [["largo", "Largo: dura lo que la fase"], ["corto", "Corto"]], pref("tempoTone", "largo")) +
    toggleRow("tempoWords", "En fases de 2 s o más, decir «baja», «quieto», «sube»", prefVal("tempoWords"));
}
function weekRowsHTML() {
  var wk = isoWeek(TODAY());
  return '<div class="set-row"><span>Martes de esta semana</span><div class="opts"><span class="chip on">Semana ' + weekAB(TODAY()) + '</span><button class="opt-btn" data-act="abflip" type="button">Cambiar</button></div></div>' +
    '<div class="set-row"><span>Esta semana (' + esc(wk.id) + ')</span><div class="opts"><button class="opt-btn' + (isDeload(TODAY()) ? " on" : "") + '" data-act="deload" type="button">' + (isDeload(TODAY()) ? "Es de descarga" : "Marcar como descarga") + "</button></div></div>";
}
function figRowsHTML() {
  return toggleRow("demo", "Mostrar la figura que hace el ejercicio", prefVal("demo")) +
    toggleRow("demoAnim", "Que la figura se mueva (con el tempo, va a tu ritmo)", prefVal("demoAnim"));
}
function cfgTabHTML(t) {
  if (t === "sesion") return '<p class="cfg-lead">Cómo corre la sesión guiada. Con la sesión continua no hace falta tocar el celular: el descanso, la serie y los cambios avanzan solos.</p>' +
    secHTML("Cómo avanza", flowRowsHTML() + toggleRow("prepScreen", "Al empezar, la pantalla «Prepara tu equipo»", prefVal("prepScreen")) +
      toggleRow("sideAuto", "Ejercicios por lado: el lado 2 empieza solo", prefVal("sideAuto")) +
      toggleRow("side2End", "Con el tempo, el lado 2 termina solo al igualar al lado 1", prefVal("side2End")) +
      toggleRow("logsets", "Anotar repeticiones y RIR en los descansos", pref("logsets", true))) +
    secHTML("Figura del ejercicio", figRowsHTML()) +
    secHTML("Pantalla en la sesión", screenRowsHTML()) +
    (DAYS.mar && DAYS.mar.weeks ? secHTML("Esta semana", weekRowsHTML()) : secHTML("Esta semana", weekRowsHTML().replace(/^<div class="set-row"><span>Martes[\s\S]*?<\/div><\/div>/, "")));
  if (t === "voz") return secHTML("Voz", voiceRowsHTML()) + secHTML("Tempo", tempoRowsHTML()) + openCards(hfSettingsHTML());
  if (t === "equipo") return openCards(eqSettingsHTML());
  if (t === "camara") return secHTML("Cámara", camSettingsRows());
  if (t === "asistente") return openCards(aiSettingsHTML());
  if (t === "datos") return openCards(ghSettingsHTML()) + openCards(dataHTML());
  if (t === "entrenador") return openCards(coachSettingsHTML()) + (perfilOn("fases") ? openCards(phaseCardHTML()) : "");
  var th = pref("theme", "auto");
  return secHTML("Pantalla", '<div class="set-row"><span>Tema</span><div class="opts">' + [["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(function (o) { return '<button class="opt-btn' + (th === o[0] ? " on" : "") + '" data-act="theme" data-v="' + o[0] + '" type="button">' + o[1] + "</button>"; }).join("") + "</div></div>") +
    '<details open class="card" data-k="reglas"><summary>Reglas que siempre mandan</summary><dl class="rules">' + RULES.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl></details>" +
    '<details class="card" data-k="leer"><summary>Cómo leer tempo, RIR, cargas y colores</summary><dl class="rules">' +
    "<div><dt>Tempo</dt><dd>Cuatro cifras en segundos: bajada, pausa abajo, subida, pausa arriba. La barra de colores lo muestra en el orden en que lo haces. X = lo más rápido posible con control.</dd></div>" +
    "<div><dt>RIR</dt><dd>Repeticiones que te quedan en reserva con técnica limpia. 0-1 es casi al fallo; 2-3, te sobran dos o tres.</dd></div>" +
    "<div><dt>Figura</dt><dd>Rojo = fuerza (subir, empujar, tirar); azul = regreso controlado; morado = mantener. La flecha muestra hacia dónde se mueve.</dd></div>" +
    KNEE.map(function (k, i) { return "<div><dt>" + kneeBadge(i) + "</dt><dd>" + esc(k[2]) + "</dd></div>"; }).join("") +
    CONFIGS.map(function (c) { return "<div><dt>" + esc(c[0]) + "</dt><dd>" + esc(c[1]) + "</dd></div>"; }).join("") +
    '</dl><ul class="tones">' + Object.keys(TONES).map(function (k) { return '<li class="tone-' + k + '"><span class="sw"></span>' + esc(TONES[k]) + "</li>"; }).join("") + "</ul></details>" +
    '<p class="muted">Versión ' + esc(APP_VER) + " de la app.</p>";
}
function cfgOpen(tab) {
  CFG.open = true; if (tab) CFG.tab = tab;
  $("cfg").hidden = false; document.body.classList.add("cfg-on");
  cfgRender(true);
}
function cfgClose() { CFG.open = false; $("cfg").hidden = true; document.body.classList.remove("cfg-on"); if (!P.active) rerender(); else { psRender(); setToolBtns(); } }
function cfgRender(top) {
  if (!CFG.open || !$("cfg-body")) return;
  var body = $("cfg-body"), y = top ? 0 : body.scrollTop, keep = openDetails(body);
  $("cfg-tabs").innerHTML = CFGT.map(function (t) { return '<button class="cfg-tab" role="tab" data-v6="cfgtab" data-t="' + t[0] + '" aria-selected="' + (t[0] === CFG.tab) + '" type="button">' + esc(t[1]) + "</button>"; }).join("");
  body.innerHTML = cfgTabHTML(CFG.tab);
  if (!top) restoreDetails(body, keep);
  body.scrollTop = y;
  paintSync();
}
/* Hoja de ajustes dentro de la sesión */
function psOpen() {
  if (!P.active) return;
  P.sheetPaused = !P.paused && !P.done;
  if (P.sheetPaused) togglePause();
  $("p-sheet").hidden = false; psRender();
}
function psClose() {
  $("p-sheet").hidden = true;
  if (P.sheetPaused && P.paused) togglePause();
  P.sheetPaused = false; setToolBtns();
  if (P.active && !P.done && !P.prep) { var pc = PC.running; renderStep(); if (pc) $("p-pacer").hidden = false; }
}
function psRender() {
  var sh = $("p-sheet"); if (!sh || sh.hidden) return;
  $("ps-body").innerHTML =
    '<div class="ps-sec"><h3>Cómo avanza</h3>' + flowRowsHTML() + toggleRow("sideAuto", "El lado 2 empieza solo", prefVal("sideAuto")) + toggleRow("logsets", "Anotar repeticiones y RIR en los descansos", pref("logsets", true)) + "</div>" +
    '<div class="ps-sec"><h3>Tempo y voz</h3>' + tempoRowsHTML() + voiceRowsHTML() + "</div>" +
    '<div class="ps-sec"><h3>Figura</h3>' + figRowsHTML() + "</div>" +
    '<div class="ps-sec"><h3>Pantalla</h3>' + screenRowsHTML() + "</div>" +
    '<div class="ps-sec"><button class="btn quiet" data-act="cfgopen" type="button">Todos los ajustes (mancuernas, cámara, asistente, datos)</button></div>';
}
/* Pantalla completa y giro fijo (necesita el toque de «Empezar»: los navegadores lo piden así) */
function fsEnter() {
  var d = document.documentElement;
  if (document.fullscreenElement || !d.requestFullscreen) return Promise.resolve(!!document.fullscreenElement);
  try { return d.requestFullscreen({ navigationUI: "hide" }).then(function () { GIRO.mine = true; return true; }, function () { return false; }); } catch (e) { return Promise.resolve(false); }
}
function fsExit() { try { if (GIRO.mine && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) {} GIRO.mine = false; }
function applyGiro(gesture) {
  var g = pref("giro", "auto"), so = window.screen && screen.orientation, want = g === "vertical" ? "portrait" : g === "horizontal" ? "landscape" : null;
  if (!want) { try { if (so && so.unlock) so.unlock(); } catch (e) {} return; }
  function go() {
    if (!so || !so.lock) { GIRO.msg = "Este navegador no deja fijar el giro: usa el bloqueo de rotación del celular."; psRender(); return; }
    so.lock(want).then(function () { GIRO.msg = ""; psRender(); }, function () { GIRO.msg = "Tu celular no dejó fijar el giro desde la app: usa el bloqueo de rotación del celular."; psRender(); });
  }
  if (document.fullscreenElement || !gesture) go(); else fsEnter().then(go);
}
function screenStart() {   // al empezar la sesión, dentro del toque
  if (pref("pantalla", false) || pref("giro", "auto") !== "auto") fsEnter().then(function () { applyGiro(false); });
}
function screenEnd() { try { var so = window.screen && screen.orientation; if (so && so.unlock && pref("giro", "auto") !== "auto") so.unlock(); } catch (e) {} fsExit(); }
document.addEventListener("click", function (e) {
  var t = e.target.closest ? e.target.closest("[data-v6],[data-act],[data-p]") : null; if (!t) return;
  var v = t.getAttribute("data-v6"), a = t.getAttribute("data-act"), p = t.getAttribute("data-p");
  if (v === "cfgtab") { CFG.tab = t.getAttribute("data-t"); cfgRender(true); }
  else if (a === "cfgopen") { if (!$("p-sheet").hidden) psClose(); cfgOpen(t.getAttribute("data-t")); }
  else if (a === "cfgclose") cfgClose();
  else if (a === "giro") { setPref("giro", t.getAttribute("data-v")); GIRO.msg = ""; if (P.active) applyGiro(true); renderGlobal(); }
  else if (p === "cfg" && P.active) psOpen();
  else if (p === "cfgclose") psClose();
  else if (p === "flow" && P.active) { setPref("flujo", !flowOn()); setToolBtns(); say(flowOn() ? "Sesión continua: avanzo sola." : "Sesión continua apagada: avanzo cuando toques.", true); }
});
document.addEventListener("click", function (e) { var sh = $("p-sheet"); if (sh && !sh.hidden && e.target === sh) psClose(); });
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") { if ($("p-sheet") && !$("p-sheet").hidden) { psClose(); return; } if (CFG.open) { cfgClose(); return; } }
  if (!P.active) return;
  var tag = (e.target && e.target.tagName) || ""; if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "a" || e.key === "A") { if ($("p-sheet").hidden) psOpen(); else psClose(); }
});
window.S3v6 = { cfgOpen: cfgOpen, cfgClose: cfgClose, psOpen: psOpen, psClose: psClose, planDelay: planDelay, prepTasks: prepTasks, laterTasks: laterTasks, posOf: posOf, flowOn: flowOn };
/* Qué viene de PERFIL (programa.js): para la app de otra persona se apagan las partes que no usa */
function perfilOn(k) { return !(typeof PERFIL !== "undefined" && PERFIL && PERFIL[k] === false); }
/*V6JS*/
/*V5JS*/

/* ===================== Inicio ===================== */
function pickInitial() {
  var q = null;
  try { q = new URLSearchParams(location.search).get("d"); } catch (e) {}
  if (DAYS[q]) return q;
  var saved = pref("day", null);
  if (saved && saved.date === TODAY() && DAYS[saved.key]) return saved.key;
  return dayKeyOf(TODAY());
}
loadLocal();
aiMigrate();
applyTheme();
(function brand() {   // nombre de la app según PERFIL (programa.js)
  try { document.title = APPN + ": " + (PF.lema || "entrenador en casa").toLowerCase(); var br = document.querySelector(".brand"); if (br) br.innerHTML = "<b>" + esc(APPN) + "</b><span>" + esc(PF.lema || "") + "</span>"; } catch (e) {}
})();
current = pickInitial();
renderDay(current);
initCloud(function () { if (!P.active) rerender(); });
swRegister();
v4Init();
if (aiProv() === "chrome") chrCheck();

})();
