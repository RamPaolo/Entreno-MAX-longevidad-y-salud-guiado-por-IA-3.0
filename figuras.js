/* FIGURAS QUE MUESTRAN CÓMO SE HACE CADA EJERCICIO (sin internet)
   Un maniquí 3D sencillo con volumen (cabeza, torso, brazos y piernas), visto en 3/4 y dibujado en SVG.
   Cada ejercicio tiene dos posturas: C = al terminar el esfuerzo y E = al terminar el regreso;
   la figura va de una a otra con el mismo tempo que suena (rojo = fuerza, azul = regreso, morado = mantener)
   y una flecha muestra hacia dónde se mueve.
   Si un peldaño cambia la forma de hacerlo (pies en la silla, barra, a una pierna…), VARIANTES trae su figura.
   Ejes: x = derecha de la figura, y = arriba, z = adelante (en cm, más o menos). Ángulos en grados:
   φ (0 = colgando, 90 = al frente, 180 = arriba, −90 = atrás) y α (0 = pegado, 90 = al costado).
   El lado que trabaja en los ejercicios de un lado es el derecho (el que queda cerca de la cámara).
   PARA OTRA PERSONA: si su programa trae ejercicios nuevos, agrega su figura en DEMOS (mismo id que en programa.js).
   Uso desde el motor: FIG.html(ejercicio, { sync, cls }) da el <svg>; la animación corre sola. */
var FIG = (function () {
"use strict";
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
var DM = { tor: 50, nk: 6, hd: 9, sh: 12, hip: 8, ua: 27, fa: 25, th: 41, sn: 40, ft: 12 };
function vAdd(a, b, k) { k = k == null ? 1 : k; return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vLen(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1e-9; }
function vNorm(a) { var l = vLen(a); return [a[0] / l, a[1] / l, a[2] / l]; }
function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vLerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function dirA(phi, alp, side) { var f = phi * Math.PI / 180, a = alp * Math.PI / 180; return [side * Math.sin(a), -Math.cos(a) * Math.cos(f), Math.cos(a) * Math.sin(f)]; }
/* Dos huesos que llegan a un punto; la articulación del medio se dobla hacia «pole» */
function ik2(root, tgt, a, b, pole) {
  var d = vSub(tgt, root), L = vLen(d), u = [d[0] / L, d[1] / L, d[2] / L];
  L = clamp(L, Math.abs(a - b) + 0.5, a + b - 0.01);
  var ca = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1), sa = Math.sqrt(1 - ca * ca);
  var w = vSub(pole, vAdd([0, 0, 0], u, vDot(pole, u))); if (vLen(w) < 1e-6) w = [0, 0, 1]; w = vNorm(w);
  var mid = vAdd(vAdd(root, u, a * ca), w, a * sa);
  return [mid, vAdd(root, u, L)];
}
/* q = { p: pelvis [x,y,z], t: [inclinación adelante, lateral, giro], h: cabeza,
         aR/aL/a: [φ brazo, α brazo, φ antebrazo, α antebrazo] o { k: [x,y,z] mano, pole },
         lR/lL/l: [φ muslo, α muslo, φ pierna, α pierna, φ pie] o { k: [x,y,z] tobillo, pole, f } } */
function demoSkel(q) {
  var J = {}, p = q.p || [0, 85, 0], t = q.t || [0, 0, 0], lam = t[0] * Math.PI / 180, bet = (t[1] || 0) * Math.PI / 180, tw = (t[2] || 0) * Math.PI / 180, ro = (t[3] || 0) * Math.PI / 180;
  var T = vNorm([Math.sin(bet), Math.cos(lam) * Math.cos(bet), Math.sin(lam) * Math.cos(bet)]);
  function lat(a) { var X = [Math.cos(a), 0, -Math.sin(a)]; X = vNorm(vSub(X, vAdd([0, 0, 0], T, vDot(X, T)))); if (ro) { var C = [T[1] * X[2] - T[2] * X[1], T[2] * X[0] - T[0] * X[2], T[0] * X[1] - T[1] * X[0]]; X = vNorm(vAdd(vAdd([0, 0, 0], X, Math.cos(ro)), C, Math.sin(ro))); } return X; }
  var X = lat(tw), X0 = lat(0);
  J.pel = p; J.hipR = vAdd(p, X0, DM.hip); J.hipL = vAdd(p, X0, -DM.hip);
  J.neck = vAdd(p, T, DM.tor);
  var shc = vAdd(J.neck, T, -3); J.shR = vAdd(shc, X, DM.sh); J.shL = vAdd(shc, X, -DM.sh);
  var hl = lam + ((q.h || 0) * Math.PI / 180), Th = vNorm([Math.sin(bet), Math.cos(hl) * Math.cos(bet), Math.sin(hl) * Math.cos(bet)]);
  J.head = vAdd(J.neck, Th, DM.nk + DM.hd);
  J.face = [0, -Math.sin(hl), Math.cos(hl)];
  if (ro) { var F = J.face, TF = [T[1] * F[2] - T[2] * F[1], T[2] * F[0] - T[0] * F[2], T[0] * F[1] - T[1] * F[0]]; J.face = vNorm(vAdd(vAdd(vAdd([0, 0, 0], F, Math.cos(ro)), TF, Math.sin(ro)), T, vDot(T, F) * (1 - Math.cos(ro)))); }
  [["R", 1], ["L", -1]].forEach(function (sd) {
    var S = sd[0], g = sd[1], a = q["a" + S] || q.a || [0, 8, 0, 8], l = q["l" + S] || q.l || [0, 4, 0, 4, 90], r;
    if (a.k) { var ak = a.k.length === 3 && q.a && q.a.k && !q["a" + S] ? [g * Math.abs(a.k[0]), a.k[1], a.k[2]] : a.k; r = ik2(J["sh" + S], ak, DM.ua, DM.fa, a.pole ? [a.pole[0] * g, a.pole[1], a.pole[2]] : [g * 0.5, -0.4, -1]); J["el" + S] = r[0]; J["wr" + S] = r[1]; }
    else { J["el" + S] = vAdd(J["sh" + S], dirA(a[0], a[1], g), DM.ua); J["wr" + S] = vAdd(J["el" + S], dirA(a[2], a[3], g), DM.fa); }
    if (l.k) { var lk = q.l && q.l.k && !q["l" + S] ? [g * Math.abs(l.k[0]), l.k[1], l.k[2]] : l.k; r = ik2(J["hip" + S], lk, DM.th, DM.sn, l.pole ? [l.pole[0] * g, l.pole[1], l.pole[2]] : [0, 0.2, 1]); J["kn" + S] = r[0]; J["an" + S] = r[1]; }
    else { J["kn" + S] = vAdd(J["hip" + S], dirA(l[0], l[1], g), DM.th); J["an" + S] = vAdd(J["kn" + S], dirA(l[2], l[3], g), DM.sn); }
    var fa = l.k ? (l.f == null ? 90 : l.f) : (l[4] == null ? 90 : l[4]);
    J["to" + S] = vAdd(J["an" + S], dirA(fa, 0, g), DM.ft);
  });
  return J;
}
function demoJoints(D, q) {
  var J = demoSkel(q);
  if (D.g === "feet") {
    var sh = [-(J.anR[0] + J.anL[0]) / 2, 4 - Math.min(J.anR[1], J.anL[1], J.toR[1] + 1, J.toL[1] + 1), -(J.anR[2] + J.anL[2]) / 2 + (D.gz || 0)];
    Object.keys(J).forEach(function (k) { if (k !== "face") J[k] = vAdd(J[k], sh, 1); });
  }
  return J;
}
function demoLerpPose(A, B, k) {
  if (!B || k <= 0) return A; if (k >= 1) return B;
  var o = {};
  Object.keys(A).concat(Object.keys(B)).forEach(function (key) {
    if (o[key] !== undefined) return;
    var a = A[key], b = B[key] === undefined ? a : B[key]; if (a === undefined) a = b;
    if (typeof a === "number") o[key] = a + (b - a) * k;
    else if (Array.isArray(a) && Array.isArray(b)) o[key] = a.map(function (v, i) { return v + ((b[i] == null ? v : b[i]) - v) * k; });
    else if (a && a.k && b && b.k) o[key] = { k: vLerp(a.k, b.k, k), pole: a.pole, f: a.f == null ? null : a.f + ((b.f == null ? a.f : b.f) - a.f) * k };
    else o[key] = k < 0.5 ? a : b;
  });
  return o;
}
/* Cámara: ψ gira alrededor de la figura (90 = de costado) y θ mira un poco desde arriba */
function demoCam(v) { var y = (v && v[0] != null ? v[0] : 62) * Math.PI / 180, p = (v && v[1] != null ? v[1] : 12) * Math.PI / 180; return { cy: Math.cos(y), sy: Math.sin(y), cp: Math.cos(p), sp: Math.sin(p) }; }
function demoProj(P, c) { var x = P[0] * c.cy + P[2] * c.sy, d = P[0] * c.sy - P[2] * c.cy, y = P[1] * c.cp - d * c.sp; return [x, -y, d]; }
function hull2(pts) {
  pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  var lo = [], up = [], i;
  for (i = 0; i < pts.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop(); lo.push(pts[i]); }
  for (i = pts.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(pts[i]); }
  up.pop(); lo.pop(); return lo.concat(up);
}
/* Objetos de la escena: silla (asiento + respaldo + patas), caja, pared */
function dmChair(x0, x1, z0, z1, seat, back) {   // back = "z0" | "z1" | null
  var o = [{ box: [x0, x1, seat - 4, seat, z0, z1], c: "wood" }];
  [[x0, z0], [x1 - 3, z0], [x0, z1 - 3], [x1 - 3, z1 - 3]].forEach(function (q) { o.push({ box: [q[0], q[0] + 3, 0, seat - 4, q[1], q[1] + 3], c: "wood" }); });
  if (back === "z0") o.push({ box: [x0, x1, seat, seat + 40, z0, z0 + 3], c: "wood" });
  if (back === "z1") o.push({ box: [x0, x1, seat, seat + 40, z1 - 3, z1], c: "wood" });
  return o;
}
/* ---------- Dibujo con volumen ----------
   Cada parte del cuerpo es una cápsula (dos círculos unidos por sus tangentes): con la cámara
   ortográfica, una cápsula 3D se ve exactamente así. El torso y la cabeza salen de cortes en 3D
   proyectados (envolvente convexa). Se dibuja de atrás hacia adelante; lo del lado lejano, más oscuro. */
function f1(v) { return (Math.round(v * 10) / 10).toString(); }
function vCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
/* Hacia dónde está la cámara (en el espacio de la figura) */
function camView(c) { return vNorm([c.sy * c.cp, c.sp, -c.cy * c.cp]); }
function cap2(A, B, ra, rb) {
  var dx = B[0] - A[0], dy = B[1] - A[1], d = Math.sqrt(dx * dx + dy * dy);
  if (d < Math.abs(ra - rb) + 0.05) {
    var C = ra >= rb ? A : B, r = Math.max(ra, rb);
    return "M" + f1(C[0] - r) + " " + f1(C[1]) + "a" + f1(r) + " " + f1(r) + " 0 1 0 " + f1(2 * r) + " 0a" + f1(r) + " " + f1(r) + " 0 1 0 " + f1(-2 * r) + " 0Z";
  }
  var th = Math.atan2(dy, dx), ph = Math.acos(clamp((ra - rb) / d, -1, 1));
  var p1 = [A[0] + ra * Math.cos(th + ph), A[1] + ra * Math.sin(th + ph)], p2 = [A[0] + ra * Math.cos(th - ph), A[1] + ra * Math.sin(th - ph)];
  var q1 = [B[0] + rb * Math.cos(th + ph), B[1] + rb * Math.sin(th + ph)], q2 = [B[0] + rb * Math.cos(th - ph), B[1] + rb * Math.sin(th - ph)];
  return "M" + f1(p1[0]) + " " + f1(p1[1]) + "L" + f1(q1[0]) + " " + f1(q1[1]) +
    "A" + f1(rb) + " " + f1(rb) + " 0 " + (ph > Math.PI / 2 ? 1 : 0) + " 0 " + f1(q2[0]) + " " + f1(q2[1]) +
    "L" + f1(p2[0]) + " " + f1(p2[1]) + "A" + f1(ra) + " " + f1(ra) + " 0 " + (ph < Math.PI / 2 ? 1 : 0) + " 0 " + f1(p1[0]) + " " + f1(p1[1]) + "Z";
}
/* Contorno suave que pasa por los puntos de la envolvente (curvas de Catmull-Rom) */
function smoothPath(pts) {
  var n = pts.length; if (n < 3) return "";
  var h = "M" + f1(pts[0][0]) + " " + f1(pts[0][1]);
  for (var i = 0; i < n; i++) {
    var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    h += "C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + " " + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " + f1(p2[0] - (p3[0] - p1[0]) / 6) + " " + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + " " + f1(p2[1]);
  }
  return h + "Z";
}
function ring(C, X, Fw, rx, rz, n, out) {
  for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; out.push(vAdd(vAdd(C, X, Math.cos(a) * rx), Fw, Math.sin(a) * rz)); }
  return out;
}
function hullOf(pts3, c) { return hull2(pts3.map(function (p) { return demoProj(p, c); })); }
/* Medidas del maniquí (radios en cm) */
var BODY = { ua: [4.8, 3.7], fa: [3.6, 2.6], hand: 3.3, th: [7.2, 4.9], sn: [4.8, 3.0], shoe: [3.5, 2.6], neck: 3.9, head: 9.2 };
function partsOf(D, q, c) {
  var J = demoJoints(D, q), V = camView(c), P = function (p) { return demoProj(p, c); };
  var T = vNorm(vSub(J.neck, J.pel)), X = vNorm(vSub(J.shR, J.shL)), X0 = vNorm(vSub(J.hipR, J.hipL));
  var Fw = vNorm(vCross(X, T)), F0 = vNorm(vCross(X0, T)), Xm = vNorm(vAdd(X, X0));
  var units = [], torsoD = P(vLerp(J.pel, J.neck, 0.5))[2];
  function unit(key, d, items) { units.push({ key: key, d: d, items: items }); }
  /* Torso: short (cadera) y polo (cintura a hombros) */
  var hipC = vAdd(J.pel, T, -1), waist = vAdd(J.pel, T, 15), chest = vAdd(J.pel, T, 33), upper = vAdd(J.pel, T, DM.tor - 7), top = vAdd(J.neck, T, -1.5);
  var shorts = [], shirt = [];
  ring(vAdd(hipC, T, -4), X0, F0, 10.2, 7.2, 14, shorts); ring(hipC, X0, F0, 11.6, 8.4, 14, shorts); ring(vAdd(waist, T, -3), Xm, vNorm(vAdd(Fw, F0)), 10.4, 7.6, 14, shorts);
  ring(vAdd(waist, T, -5), Xm, vNorm(vAdd(Fw, F0)), 10.6, 7.8, 14, shirt); ring(waist, Xm, vNorm(vAdd(Fw, F0)), 10.1, 7.6, 14, shirt);
  ring(chest, X, Fw, 12.6, 9.4, 14, shirt); ring(upper, X, Fw, 13.4, 8.2, 14, shirt); ring(top, X, Fw, 9.5, 6, 12, shirt);
  var shoulderCaps = [vAdd(J.shR, T, -0.5), vAdd(J.shL, T, -0.5)];
  shoulderCaps.forEach(function (s) { ring(s, X, Fw, 5, 5, 8, shirt); ring(s, T, Fw, 5, 5, 8, shirt); });
  unit("t", torsoD, [{ c: "sho", d: smoothPath(hullOf(shorts, c)) }, { c: "shi", d: smoothPath(hullOf(shirt, c)) }]);
  /* Cuello y cabeza (con pelo atrás y nariz: así se ve hacia dónde mira) */
  var Th = vNorm(vSub(J.head, J.neck)), face = J.face, H = P(J.head), hr = BODY.head;
  var hair = [], hd = vNorm(vAdd(vAdd([0, 0, 0], Th, 0.75), face, -0.85)), Xh = vNorm(vCross(Th, face));
  for (var la = -80; la <= 80; la += 20) for (var lo = 0; lo < 360; lo += 24) {
    var a = la * Math.PI / 180, b = lo * Math.PI / 180, n = vAdd(vAdd(vAdd([0, 0, 0], Th, Math.sin(a)), face, Math.cos(a) * Math.cos(b)), Xh, Math.cos(a) * Math.sin(b));
    if (vDot(n, hd) > 0.12 && vDot(n, V) > -0.05) hair.push(vAdd(J.head, n, hr * 1.02));
  }
  var headItems = [{ c: "sk", d: cap2(P(vAdd(J.neck, T, -2.5)), P(vAdd(J.neck, Th, 4)), BODY.neck, BODY.neck * 0.92) },
    { c: "sk hd", d: "M" + f1(H[0] - hr) + " " + f1(H[1]) + "a" + f1(hr) + " " + f1(hr) + " 0 1 0 " + f1(2 * hr) + " 0a" + f1(hr) + " " + f1(hr) + " 0 1 0 " + f1(-2 * hr) + " 0Z" }];
  if (hair.length > 3) headItems.push({ c: "hair", d: smoothPath(hullOf(hair, c)) });
  if (vDot(face, V) > -0.35) { var nz = P(vAdd(vAdd(J.head, face, hr * 0.98), Th, -1)); headItems.push({ c: "sk nose", d: cap2(nz, nz, 2.1, 2.1) }); }
  [1, -1].forEach(function (g) { var e3 = vAdd(vAdd(J.head, Xh, g * hr * 0.97), face, -1), ear = P(e3); if (vDot(vNorm(vSub(e3, J.head)), V) > 0.1) headItems.push({ c: "sk ear", d: cap2(ear, ear, 2.2, 2.2) }); });
  unit("h", H[2], headItems);
  /* Brazos: manga corta, antebrazo y mano */
  ["R", "L"].forEach(function (S) {
    var sh = J["sh" + S], el = J["el" + S], wr = J["wr" + S], A = P(sh), E = P(el), W = P(wr);
    var sleeveEnd = vLerp(sh, el, 0.42);
    unit("a" + S + "u", (A[2] + E[2]) / 2, [{ c: "sk", d: cap2(A, E, BODY.ua[0], BODY.ua[1]) }, { c: "shi", d: cap2(A, P(sleeveEnd), BODY.ua[0] + 0.6, BODY.ua[1] + 1.1) }]);
    var hand = vAdd(wr, vNorm(vSub(wr, el)), 3.2), Hd = P(hand);
    unit("a" + S + "f", (E[2] + W[2]) / 2, [{ c: "sk", d: cap2(E, W, BODY.fa[0], BODY.fa[1]) }, { c: "sk hand", d: cap2(W, Hd, BODY.fa[1] + 0.2, BODY.hand) }]);
  });
  /* Piernas: short, pierna y zapatilla */
  ["R", "L"].forEach(function (S) {
    var hp = J["hip" + S], kn = J["kn" + S], an = J["an" + S], to = J["to" + S], A = P(hp), K = P(kn), N = P(an);
    unit("l" + S + "u", (A[2] + K[2]) / 2, [{ c: "sk", d: cap2(A, K, BODY.th[0], BODY.th[1]) }, { c: "sho", d: cap2(A, P(vLerp(hp, kn, 0.5)), BODY.th[0] + 0.7, BODY.th[0] - 0.4) }]);
    unit("l" + S + "l", (K[2] + N[2]) / 2, [{ c: "sk", d: cap2(K, N, BODY.sn[0], BODY.sn[1]) }]);
    var fd = vNorm(vSub(to, an)), up = vNorm(vCross(fd, vCross([0, 1, 0], fd))); if (vDot(up, [0, 1, 0]) < 0) up = vAdd([0, 0, 0], up, -1);
    var heel = vAdd(vAdd(an, fd, -2.2), up, -1.6), toe = vAdd(to, up, -1.2);
    unit("l" + S + "f", (P(heel)[2] + P(toe)[2]) / 2, [{ c: "shoe", d: cap2(P(heel), P(toe), BODY.shoe[0], BODY.shoe[1]) }]);
  });
  return { J: J, units: units, torsoD: torsoD, T: T, Fw: Fw, V: V };
}
var WORK_UNITS = { aR: ["aRu", "aRf"], aL: ["aLu", "aLf"], lR: ["lRu", "lRl"], lL: ["lLu", "lLl"], t: ["t"] };
/* Mochila puesta (en la espalda) y saco de arena (abrazado) */
function packItems(D, J, c, b) {
  var out = [];
  if (D.pack) {
    var C3 = vAdd(vLerp(J.pel, J.neck, 0.58), b.Fw, -13), pts = [];
    [-1, 1].forEach(function (u) { [-1, 1].forEach(function (v) { [-1, 1].forEach(function (w) { pts.push(vAdd(vAdd(vAdd(C3, vNorm(vSub(J.shR, J.shL)), 10 * u), b.T, 13 * v), b.Fw, 5 * w)); }); }); });
    out.push({ key: "pack", d: demoProj(C3, c)[2], items: [{ c: "pk", d: smoothPath(hullOf(pts, c)) }] });
  }
  if (D.packAt) {
    var C4 = vAdd(J[D.packAt], [0, 1, 0], 10), pts4 = [];
    [-1, 1].forEach(function (u) { [-1, 1].forEach(function (v) { [-1, 1].forEach(function (w) { pts4.push(vAdd(C4, [12 * u, 5 * v, 9 * w])); }); }); });
    out.push({ key: "pack", d: demoProj(C4, c)[2] + 8, items: [{ c: "pk", d: smoothPath(hullOf(pts4, c)) }] });
  }
  if (D.sack) {
    var at = D.sack === "hug" ? vAdd(vLerp(J.wrR, J.wrL, 0.5), b.Fw, -4) : J[D.sack], s = [];
    ring(at, [1, 0, 0], [0, 0, 1], 17, 11, 12, s); ring(vAdd(at, [0, 1, 0], 9), [1, 0, 0], [0, 0, 1], 14, 9, 12, s); ring(vAdd(at, [0, 1, 0], -9), [1, 0, 0], [0, 0, 1], 14, 9, 12, s);
    out.push({ key: "sack", d: demoProj(at, c)[2] + 6, items: [{ c: "sack", d: smoothPath(hullOf(s, c)) }] });
  }
  return out;
}
/* Mancuernas: barra y dos discos (elipses según desde dónde se miren) */
function bellItems(D, J, c, V) {
  var kind = D.db; if (!kind) return [];
  function bell(Pc, axis, small) {
    var R = small ? 3.6 : 6.2, half = small ? 5.5 : 6.5, a = demoProj(vAdd(Pc, axis, -half), c), b = demoProj(vAdd(Pc, axis, half), c);
    var ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, k = Math.max(0.28, Math.abs(vDot(axis, V))), h = '<path class="dbar" d="M' + f1(a[0]) + " " + f1(a[1]) + "L" + f1(b[0]) + " " + f1(b[1]) + '"/>';
    [a, b].forEach(function (p) { h += '<ellipse class="dplate" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="' + f1(R * k + 1.2) + '" ry="' + f1(R) + '" transform="rotate(' + f1(ang) + " " + f1(p[0]) + " " + f1(p[1]) + ')"/>'; });
    return { d: demoProj(Pc, c)[2] + 4, h: h };
  }
  var out = [];
  if (kind === "hip") out.push(bell(vAdd(J.pel, [0, 1, 0], 10), [1, 0, 0], false));
  else if (kind === "two") { var m = vLerp(J.wrR, J.wrL, 0.5); out.push(bell(vAdd(m, [0, 1, 0], D.dbOff || 0), [0, 1, 0], false)); }
  else {
    if (kind === "R" || kind === "LR") out.push(bell(vAdd(J.wrR, vNorm(vSub(J.wrR, J.elR)), 3), D.dbAxis || [1, 0, 0], D.dbSmall));
    if (kind === "L" || kind === "LR") out.push(bell(vAdd(J.wrL, vNorm(vSub(J.wrL, J.elL)), 3), D.dbAxis || [1, 0, 0], D.dbSmall));
  }
  return out.map(function (o) { return { key: "db", d: o.d, raw: o.h }; });
}
/* Flecha que muestra hacia dónde se mueve la parte que más se mueve */
function arrowHTML(A, B, ph) {
  var dx = B[0] - A[0], dy = B[1] - A[1], L = Math.sqrt(dx * dx + dy * dy);
  if (L < 0.9) return "";
  var ux = dx / L, uy = dy / L, len = clamp(L * 2.6, 9, 20), off = 13, ox = -uy * off, oy = ux * off;
  var s = [A[0] + ox - ux * len * 0.5, A[1] + oy - uy * len * 0.5], e = [A[0] + ox + ux * len * 0.5, A[1] + oy + uy * len * 0.5];
  var h1 = [e[0] - ux * 6 - uy * 4.5, e[1] - uy * 6 + ux * 4.5], h2 = [e[0] - ux * 6 + uy * 4.5, e[1] - uy * 6 - ux * 4.5];
  return '<path class="darrow a-' + (ph || "pau") + '" d="M' + f1(s[0]) + " " + f1(s[1]) + "L" + f1(e[0]) + " " + f1(e[1]) + "M" + f1(h1[0]) + " " + f1(h1[1]) + "L" + f1(e[0]) + " " + f1(e[1]) + "L" + f1(h2[0]) + " " + f1(h2[1]) + '"/>';
}
/* La articulación que más cambia entre las dos posturas (ahí va la flecha) */
var MOVERS = ["wrR", "wrL", "anR", "anL", "pel", "neck", "knR", "knL", "elR"];
function mover(D) {
  if (D._mv) return D._mv;
  var c = demoCam(D.v), a = demoJoints(D, D.C), b = demoJoints(D, D.E), best = "pel", bd = -1;
  MOVERS.forEach(function (k) { var p = demoProj(a[k], c), q = demoProj(b[k], c), d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > bd + 0.5) { bd = d; best = k; } });
  D._mv = D.arrow || best; return D._mv;
}
/* Dibuja la figura. ph = "con" | "ecc" | "pau" | "" (colorea lo que trabaja). q2 = postura un instante después (para la flecha). */
function draw(D, q, ph, q2) {
  var c = demoCam(D.v), b = partsOf(D, q, c), J = b.J, work = {}, out = "";
  (D.work || []).forEach(function (g) { (WORK_UNITS[g] || []).forEach(function (u) { work[u] = 1; }); });
  var all = b.units.concat(packItems(D, J, c, b)).concat(bellItems(D, J, c, b.V));
  all.sort(function (u, v) { return u.d - v.d; });
  var fl = demoProj([J.pel[0], 0, J.pel[2]], c);
  out += '<ellipse class="dshadow" cx="' + f1(fl[0]) + '" cy="' + f1(fl[1] + 1) + '" rx="44" ry="6.5"/>';
  out += demoProps(D, J, c) + demoBand(D, J, c);
  all.forEach(function (u) {
    if (u.raw) { out += u.raw; return; }
    var far = u.key !== "t" && u.key !== "h" && u.d < b.torsoD - 2.5;
    if (ph && work[u.key]) out += '<g class="halo h-' + ph + '">' + u.items.map(function (it) { return it.c === "hair" ? "" : '<path d="' + it.d + '"/>'; }).join("") + "</g>";
    out += '<g class="u' + (far ? " far" : "") + '">' + u.items.map(function (it) { return '<path class="' + it.c + '" d="' + it.d + '"/>'; }).join("") + "</g>";
  });
  if (q2 && ph) { var k = mover(D), J2 = demoJoints(D, q2), A = demoProj(J[k], c), B = demoProj(J2[k], c); out += arrowHTML(A, B, ph); }
  return out;
}
/* ---------- Objetos de la escena ---------- */
function demoBox(b, c, cls) {   // b = [x0,x1, y0,y1, z0,z1]
  var P = [], k;
  for (k = 0; k < 8; k++) P.push(demoProj([b[k & 1 ? 1 : 0], b[k & 2 ? 3 : 2], b[k & 4 ? 5 : 4]], c));
  var h = hull2(P), top = [P[2], P[3], P[7], P[6]];
  return '<path class="dp ' + (cls || "") + '" d="M' + h.map(function (q) { return f1(q[0]) + " " + f1(q[1]); }).join("L") + 'Z"/>' +
    '<path class="dp-top ' + (cls || "") + '" d="M' + top.map(function (q) { return f1(q[0]) + " " + f1(q[1]); }).join("L") + 'Z"/>';
}
function demoProps(D, J, c) {
  var h = "";
  (D.props || []).forEach(function (o) {
    if (o.box) h += demoBox(o.box, c, o.c);
    else if (o.post) { var a = demoProj([o.post[0], 0, o.post[1]], c), b = demoProj([o.post[0], o.post[2] || 200, o.post[1]], c); h += '<path class="dpost" d="M' + f1(a[0]) + " " + f1(a[1]) + "L" + f1(b[0]) + " " + f1(b[1]) + '"/>'; }
    else if (o.bar) { var p = demoProj([o.bar[0], o.bar[2], o.bar[3]], c), q = demoProj([o.bar[1], o.bar[2], o.bar[3]], c); h += '<path class="dpullbar" d="M' + f1(p[0]) + " " + f1(p[1]) + "L" + f1(q[0]) + " " + f1(q[1]) + '"/>'; }
  });
  return h;
}
function demoBand(D, J, c) {
  if (!D.band) return "";
  var A = typeof D.band.from === "string" ? J[D.band.from] : D.band.from, out = "";
  (D.band.to || ["wrR"]).forEach(function (j) { var a = demoProj(A, c), b = demoProj(J[j], c); out += '<path class="dband" d="M' + f1(a[0]) + " " + f1(a[1]) + "L" + f1(b[0]) + " " + f1(b[1]) + '"/>'; });
  return out;
}
/* Encuadre: caja que contiene las dos posturas, el volumen del cuerpo, los objetos y la flecha */
function fit(D) {
  if (D._fit) return D._fit;
  var c = demoCam(D.v), xs = [], ys = [];
  function add(p, r) { xs.push(p[0] - r, p[0] + r); ys.push(p[1] - r, p[1] + r); }
  [D.C, D.E].forEach(function (q) {
    if (!q) return;
    var J = demoJoints(D, q);
    Object.keys(J).forEach(function (k) { if (k !== "face") add(demoProj(J[k], c), k === "head" ? BODY.head + 2 : /^(hip|pel)/.test(k) ? 12 : 8); });
    if (D.pack) add(demoProj(vAdd(vLerp(J.pel, J.neck, 0.58), [0, 0, -1], 16), c), 14);
    if (D.sack) add(demoProj(D.sack === "hug" ? vLerp(J.wrR, J.wrL, 0.5) : J[D.sack], c), 18);
    if (D.packAt) add(demoProj(vAdd(J[D.packAt], [0, 1, 0], 10), c), 14);
  });
  if (D.band && typeof D.band.from !== "string") add(demoProj(D.band.from, c), 2);
  (D.props || []).forEach(function (o) {
    if (o.box) for (var k = 0; k < 8; k++) add(demoProj([o.box[k & 1 ? 1 : 0], o.box[k & 2 ? 3 : 2], o.box[k & 4 ? 5 : 4]], c), 1);
    if (o.bar) { add(demoProj([o.bar[0], o.bar[2], o.bar[3]], c), 3); add(demoProj([o.bar[1], o.bar[2], o.bar[3]], c), 3); }
  });
  var fl = demoProj([0, 0, 0], c); ys.push(fl[1] + 8);
  var x0 = Math.min.apply(null, xs) - 12, x1 = Math.max.apply(null, xs) + 12, y0 = Math.min.apply(null, ys) - 8, y1 = Math.max.apply(null, ys) + 6;
  var w = x1 - x0, h = y1 - y0, side = Math.max(w, h * 1.15);
  D._fit = [x0 - (side - w) / 2, y0 - (side / 1.15 - h) / 2, side, side / 1.15];
  return D._fit;
}
var DEMOS = {
  remo1m: { v: [72, 14], db: "R", work: ["aR"], props: dmChair(-30, 2, 44, 74, 46, "z1"),
    C: { p: [0, 79, 0], t: [52, 0, 0], h: 12, aR: [-72, 10, -4, 6], aL: { k: [-14, 47, 54], pole: [-0.2, 0.6, -1] }, lR: [-12, 4, -6, 4], lL: [14, 4, 4, 4] },
    E: { p: [0, 79, 0], t: [52, 0, 0], h: 12, aR: [4, 6, 4, 6], aL: { k: [-14, 47, 54], pole: [-0.2, 0.6, -1] }, lR: [-12, 4, -6, 4], lL: [14, 4, 4, 4] } },
  arquero: { v: [54, 22], work: ["aR", "aL"],
    C: { p: [0, 40, -10], t: [76, 0, 0], h: 4, a: { k: [32, 2, 42], pole: [0.5, 0.2, -1] }, l: { k: [7, 5, -88], f: 8 } },
    E: { p: [7, 22, -8], t: [86, 8, 0], h: 4, aR: { k: [32, 2, 42], pole: [0.6, 0.3, -1] }, aL: { k: [-32, 2, 42], pole: [-0.6, 0.3, -1] }, l: { k: [7, 5, -88], f: 8 } } },
  pike: { v: [80, 10], work: ["aR", "aL"],
    C: { p: [0, 80, -66], t: [140, 0, 0], h: 6, a: { k: [12, 2, 0], pole: [0.3, 0.3, -1] }, l: { k: [7, 5, -100], f: 30 } },
    E: { p: [0, 75, -62], t: [151, 0, 0], h: 6, a: { k: [12, 2, 0], pole: [0.2, 0.4, -1] }, l: { k: [7, 5, -100], f: 30 } } },
  facepull: { v: [40, 12], g: "feet", work: ["aR", "aL"], band: { from: [0, 146, 80], to: ["wrR", "wrL"] },
    C: { t: [-2, 0, 0], a: { k: [22, 150, 0], pole: [1, 0.3, -0.4] }, lR: [8, 6, 3, 6], lL: [-8, 6, -3, 6] },
    E: { t: [2, 0, 0], a: { k: [8, 144, 48], pole: [0.6, -0.4, -1] }, lR: [8, 6, 3, 6], lL: [-8, 6, -3, 6] } },
  pressinc: { v: [72, 14], db: "LR", work: ["aR", "aL"], props: [{ box: [-16, 16, 0, 24, -50, -26], c: "pack" }],
    C: { p: [0, 9, 0], t: [-62, 0, 0], h: 8, a: [178, 6, 178, 4], l: { k: [12, 5, 44], pole: [0, 1, 0.3] } },
    E: { p: [0, 9, 0], t: [-62, 0, 0], h: 8, a: [-38, 52, 178, 0], l: { k: [12, 5, 44], pole: [0, 1, 0.3] } } },
  pullover: { v: [72, 14], db: "two", work: ["aR", "aL"], props: [{ box: [-16, 16, 0, 24, -50, -26], c: "pack" }],
    C: { p: [0, 9, 0], t: [-62, 0, 0], h: 8, a: [170, -14, 170, -14], l: { k: [12, 5, 44], pole: [0, 1, 0.3] } },
    E: { p: [0, 9, 0], t: [-62, 0, 0], h: 8, a: [-80, -12, -76, -14], l: { k: [12, 5, 44], pole: [0, 1, 0.3] } } },
  latinc: { v: [12, 10], db: "R", work: ["aR"], props: [{ post: [-40, -4, 205] }, { post: [-40, 6, 205] }],
    C: { p: [6, 85, 0], t: [0, 13, 0], aR: [0, 88, 0, 82], aL: { k: [-38, 116, 2], pole: [-0.5, -1, 0] }, lR: [0, 1, 0, 1], lL: [0, 5, 0, 5] },
    E: { p: [6, 85, 0], t: [0, 13, 0], aR: [0, 10, 0, 8], aL: { k: [-38, 116, 2], pole: [-0.5, -1, 0] }, lR: [0, 1, 0, 1], lL: [0, 5, 0, 5] } },
  curlbay: { v: [112, 10], g: "feet", work: ["aR"], band: { from: "toR", to: ["wrR"] },
    C: { t: [10, 0, 0], aR: [-34, 10, 150, 8], aL: [4, 8, 4, 8], lR: [-20, 4, -10, 4], lL: [18, 4, 4, 4] },
    E: { t: [10, 0, 0], aR: [-34, 10, -32, 8], aL: [4, 8, 4, 8], lR: [-20, 4, -10, 4], lL: [18, 4, 4, 4] } },
  triover: { v: [70, 10], db: "two", dbOff: -6, work: ["aR", "aL"], props: dmChair(-17, 17, -18, 16, 46, "z0"),
    C: { p: [0, 50, 0], t: [-4, 0, 0], a: [176, -10, 176, -10], l: [86, 7, 0, 7] },
    E: { p: [0, 50, 0], t: [-4, 0, 0], a: [166, -10, -20, -12], l: [86, 7, 0, 7] } },
  planchaesc: { v: [76, 14], work: ["t"],
    C: { p: [0, 46, -14], t: [77, 0, 0], h: 6, a: { k: [13, 2, 36], pole: [0.2, 0, -1] }, l: { k: [6, 5, -85], f: 8 } },
    E: { p: [0, 43, -14], t: [80, 0, 0], h: 6, a: { k: [13, 2, 36], pole: [0.2, 0, -1] }, l: { k: [6, 5, -85], f: 8 } } },
  bichomuerto: { v: [60, 24], work: ["aR", "lL"],
    C: { p: [0, 9, 0], t: [-90, 0, 0], h: -6, a: [180, 6, 180, 6], l: [180, 6, 90, 6, 140] },
    E: { p: [0, 9, 0], t: [-90, 0, 0], h: -6, aR: [-86, 6, -86, 6], aL: [180, 6, 180, 6], lR: [180, 6, 90, 6, 140], lL: [96, 6, 94, 6, 160] } },
  splitsq: { v: [80, 10], db: "two", work: ["lR", "lL"], props: [{ box: [-20, 4, 0, 12, -42, -20], c: "soft" }],
    C: { p: [0, 78, -6], t: [6, 0, 0], h: 4, a: { k: [5, 120, 14], pole: [1, -0.6, 0] }, lR: { k: [8, 5, 34] }, lL: { k: [-8, 9, -48], pole: [0, -0.3, 1], f: 25 } },
    E: { p: [0, 50, -9], t: [12, 0, 0], h: 4, a: { k: [5, 93, 14], pole: [1, -0.6, 0] }, lR: { k: [8, 5, 34] }, lL: { k: [-8, 9, -48], pole: [0, -0.3, 1], f: 25 } } },
  rdl1p: { v: [82, 10], db: "R", work: ["lL", "t"],
    C: { p: [0, 84, 0], t: [0, 0, 0], aR: [2, 6, 2, 6], aL: [12, 22, 12, 22], lL: { k: [-8, 4, 2] }, lR: [-10, 4, -6, 4] },
    E: { p: [0, 79, -16], t: [80, 0, 0], h: 8, aR: [0, 4, 0, 4], aL: [0, 30, 0, 30], lL: { k: [-8, 4, 2] }, lR: [-94, 4, -94, 4, 0] } },
  curlfem: { v: [70, 18], work: ["lR", "lL"], props: [{ box: [-15, 15, 0, 2.5, 22, 44], c: "soft", key: "C" }],
    C: { p: [0, 40, 0], t: [-122, 0, 0], h: -20, a: [84, 14, 88, 14], l: { k: [9, 6, 32], pole: [0, 1, 0.4] } },
    E: { p: [0, 22, -4], t: [-104, 0, 0], h: -20, a: [84, 14, 88, 14], l: { k: [9, 6, 70], pole: [0, 1, 0.2] } } },
  extrod: { v: [76, 10], work: ["lR"], props: dmChair(-18, 18, -18, 16, 46, "z0"), band: { from: [8, 6, -16], to: ["anR"] },
    C: { p: [0, 50, 0], t: [-6, 0, 0], a: { k: [20, 48, 6], pole: [1, 0, -0.3] }, lR: [88, 5, 45, 5], lL: [88, 7, 0, 7] },
    E: { p: [0, 50, 0], t: [-6, 0, 0], a: { k: [20, 48, 6], pole: [1, 0, -0.3] }, lR: [88, 5, 2, 5], lL: [88, 7, 0, 7] } },
  stepdown: { v: [18, 12], work: ["lR"], props: [{ box: [-4, 24, 0, 12, -16, 18], c: "wood" }],
    C: { p: [2, 97, 0], t: [0, 0, 0], a: [30, 10, 40, 10], lR: { k: [9, 16, 2] }, lL: [6, 10, 8, 10] },
    E: { p: [4, 76, -12], t: [16, -4, 0], a: [55, 10, 60, 10], lR: { k: [9, 16, 2], pole: [0, 0, 1] }, lL: { k: [-20, 5, 4] } } },
  hipthrust: { v: [74, 12], db: "hip", work: ["lR", "lL", "t"], props: [{ box: [-34, 34, 0, 40, -98, -44], c: "soft" }, { box: [-34, 34, 40, 70, -98, -84], c: "soft" }],
    C: { p: [0, 47, 0], t: [-92, 0, 0], h: -30, a: { k: [12, 58, 2], pole: [1, 0.4, -0.5] }, l: { k: [10, 5, 42], pole: [0, 1, 0.5] } },
    E: { p: [0, 22, -8], t: [-58, 0, 0], h: -30, a: { k: [12, 33, -6], pole: [1, 0.4, -0.5] }, l: { k: [10, 5, 42], pole: [0, 1, 0.5] } } },
  talonpie: { v: [80, 10], db: "R", work: ["lR"], props: [{ box: [-14, 20, 0, 12, 4, 30], c: "wood" }, { box: [-60, 60, 0, 190, 62, 66], c: "wall" }],
    C: { p: [0, 106, 0], aR: [0, 6, 0, 6], aL: { k: [-14, 128, 58], pole: [-0.5, -1, 0] }, lR: [0, 2, 0, 2, 32], lL: [-12, 6, -78, 6, 0] },
    E: { p: [0, 90, 0], aR: [0, 6, 0, 6], aL: { k: [-14, 112, 58], pole: [-0.5, -1, 0] }, lR: [0, 2, 0, 2, 124], lL: [-12, 6, -78, 6, 0] } },
  copen: { v: [90, 16], work: ["lL", "t"], props: dmChair(-22, 22, -70, -38, 46, null),
    C: { p: [0, 40, -4], t: [84, 0, 0, 90], h: 0, aL: [0, 0, 90, 0], aR: [-40, 0, 40, 0], lR: [-90, 0, -90, 0, 0], lL: [-88, 0, -88, 0, 0] },
    E: { p: [0, 38, -4], t: [86, 0, 0, 90], h: 0, aL: [0, 0, 90, 0], aR: [-40, 0, 40, 0], lR: [-90, 0, -90, 0, 0], lL: [-70, 0, -60, 0, 0] } },
  flexexp: { v: [80, 10], work: ["aR", "aL"], props: dmChair(-22, 22, 30, 60, 46, "z1").concat([{ box: [-70, 70, 0, 170, 62, 66], c: "wall" }]),
    C: { p: [0, 58, -32], t: [56, 0, 0], h: 4, a: { k: [15, 48, 42], pole: [0.4, 0, -1] }, l: { k: [7, 5, -94], f: 8 } },
    E: { p: [0, 44, -26], t: [64, 0, 0], h: 4, a: { k: [15, 48, 42], pole: [0.6, 0.2, -1] }, l: { k: [7, 5, -94], f: 8 } } },
  remoexp: { v: [70, 10], g: "feet", work: ["aR", "aL"], band: { from: [0, 118, 86], to: ["wrR", "wrL"] },
    C: { t: [4, 0, 0], a: { k: [17, 106, 4], pole: [0.5, -0.2, -1] }, lR: [6, 6, 2, 6], lL: [-6, 6, -2, 6] },
    E: { t: [6, 0, 0], a: { k: [10, 114, 48], pole: [0.5, -0.4, -1] }, lR: [6, 6, 2, 6], lL: [-6, 6, -2, 6] } },
  arnold: { v: [38, 10], db: "LR", work: ["aR", "aL"], props: dmChair(-17, 17, -18, 16, 46, "z0"),
    C: { p: [0, 50, 0], t: [-3, 0, 0], a: { k: [14, 152, 4], pole: [1, 0, 0] }, l: [86, 8, 0, 8] },
    E: { p: [0, 50, 0], t: [-3, 0, 0], a: { k: [10, 101, 14], pole: [0.3, -1, 0.6] }, l: [86, 8, 0, 8] } },
  remosup: { v: [80, 12], g: "feet", db: "LR", work: ["aR", "aL"],
    C: { t: [50, 0, 0], h: 14, a: [-76, 10, -8, 8], l: [12, 6, -6, 6] },
    E: { t: [50, 0, 0], h: 14, a: [4, 8, 4, 8], l: [12, 6, -6, 6] } },
  deficit: { v: [78, 14], work: ["aR", "aL"], props: [{ box: [8, 24, 0, 10, 32, 50], c: "wood" }, { box: [-24, -8, 0, 10, 32, 50], c: "wood" }],
    C: { p: [0, 46, -14], t: [76, 0, 0], h: 4, a: { k: [16, 12, 40], pole: [0.5, 0.2, -1] }, l: { k: [7, 5, -90], f: 8 } },
    E: { p: [0, 24, -14], t: [84, 0, 0], h: 4, a: { k: [16, 12, 40], pole: [0.7, 0.4, -1] }, l: { k: [7, 5, -90], f: 8 } } },
  jalon: { v: [70, 10], work: ["aR", "aL"], band: { from: [0, 160, 56], to: ["wrR", "wrL"] },
    C: { p: [0, 9, 0], t: [-8, 0, 0], a: { k: [18, 72, 6], pole: [1, -1, -0.3] }, l: [92, 8, 90, 8, 180] },
    E: { p: [0, 9, 0], t: [-4, 0, 0], a: { k: [12, 104, 26], pole: [1, -0.6, -0.4] }, l: [92, 8, 90, 8, 180] } },
  latpie: { v: [10, 8], g: "feet", db: "LR", work: ["aR", "aL"],
    C: { a: [0, 88, 0, 84], l: [0, 5, 0, 5] }, E: { a: [0, 12, 0, 10], l: [0, 5, 0, 5] } },
  martillo: { v: [68, 10], g: "feet", db: "LR", work: ["aR", "aL"],
    C: { a: [6, 8, 158, 6], l: [0, 5, 0, 5] }, E: { a: [3, 8, 3, 8], l: [0, 5, 0, 5] } },
  frances: { v: [70, 16], db: "LR", work: ["aR", "aL"],
    C: { p: [0, 9, 0], t: [-90, 0, 0], h: -10, a: [178, 6, 178, 6], l: { k: [12, 5, 40], pole: [0, 1, 0.3] } },
    E: { p: [0, 9, 0], t: [-90, 0, 0], h: -10, a: [172, 6, -70, 6], l: { k: [12, 5, 40], pole: [0, 1, 0.3] } } },
  yraise: { v: [55, 16], g: "feet", db: "LR", dbSmall: 1, work: ["aR", "aL"],
    C: { t: [80, 0, 0], h: 12, a: [100, 34, 100, 34], l: [16, 6, -8, 6] },
    E: { t: [80, 0, 0], h: 12, a: [2, 8, 2, 8], l: [16, 6, -8, 6] } },
  planchalat: { v: [90, 16], work: ["t", "lR"],
    C: { p: [0, 36, 0], t: [84, 0, 0, 90], aL: [0, 0, 90, 0], aR: [-40, 0, 40, 0], lL: [-84, 0, -84, 0, 0], lR: [-104, 0, -104, 0, 0] },
    E: { p: [0, 34, 0], t: [86, 0, 0, 90], aL: [0, 0, 90, 0], aR: [-40, 0, 40, 0], lL: [-84, 0, -84, 0, 0], lR: [-96, 0, -96, 0, 0] } },
  rdl2p: { v: [80, 10], g: "feet", db: "LR", work: ["t"],
    C: { t: [0, 0, 0], a: [6, 6, 4, 6], l: [0, 6, 0, 6] },
    E: { t: [72, 0, 0], h: 10, a: [0, 6, 0, 6], l: [16, 6, -6, 6] } },
  goblet: { v: [74, 10], db: "two", pack: 1, work: ["lR", "lL"], props: [{ box: [-18, 18, 0, 41, -44, -18], c: "wood" }],
    C: { p: [0, 85, -2], t: [4, 0, 0], a: { k: [5, 122, 14], pole: [1, -0.6, 0] }, l: { k: [14, 4, 2], pole: [0.5, 0.2, 1] } },
    E: { p: [0, 50, -22], t: [32, 0, 0], h: -10, a: { k: [5, 92, 16], pole: [1, -0.6, 0] }, l: { k: [14, 4, 2], pole: [0.5, 0.2, 1] } } },
  pressmil: { v: [40, 10], g: "feet", db: "LR", work: ["aR", "aL"],
    C: { a: { k: [14, 188, 2], pole: [1, 0, 0] }, l: [0, 6, 0, 6] },
    E: { a: { k: [16, 136, 8], pole: [0.5, -1, 0.3] }, l: [0, 6, 0, 6] } },
  maleta: { v: [70, 8], g: "feet", db: "R", walk: 1, work: ["t"],
    C: { t: [0, 0, 0], aR: [0, 10, 0, 10], aL: [14, 8, 20, 8], lR: [22, 4, 6, 4], lL: [-16, 4, -14, 4, 70] },
    E: { t: [0, 0, 0], aR: [0, 10, 0, 10], aL: [-12, 8, -6, 8], lR: [-16, 4, -14, 4, 70], lL: [22, 4, 6, 4] } },
  farmer: { v: [70, 8], g: "feet", db: "LR", pack: 1, walk: 1, work: ["t"],
    C: { t: [0, 0, 0], a: [0, 12, 0, 12], lR: [22, 4, 6, 4], lL: [-16, 4, -14, 4, 70] },
    E: { t: [0, 0, 0], a: [0, 12, 0, 12], lR: [-16, 4, -14, 4, 70], lL: [22, 4, 6, 4] } },
  trote: { v: [72, 8], g: "feet", walk: 0.34, work: ["lR", "lL"],
    C: { t: [6, 0, 0], aR: [-40, 6, 60, 6], aL: [30, 6, 120, 6], lR: [30, 4, -10, 4], lL: [-14, 4, -40, 4, 60] },
    E: { t: [6, 0, 0], aR: [30, 6, 120, 6], aL: [-40, 6, 60, 6], lR: [-14, 4, -40, 4, 60], lL: [30, 4, -10, 4] } }
};
/* Figuras de los peldaños que cambian la forma de hacer el ejercicio.
   from/to = peldaños (0 = el primero); d = lo que cambia respecto de la figura base (o use: otra figura). */
var BARRA = [{ bar: [-46, 46, 200, 2] }, { post: [-50, 2, 210] }, { post: [50, 2, 210] }];
DEMOS.barra = { v: [34, 8], work: ["aR", "aL"], props: BARRA,
  C: { p: [0, 143, -4], t: [-6, 0, 0], h: -12, a: { k: [20, 200, 2], pole: [1, -1, 0.5] }, l: [14, 5, -64, 5, 30] },
  E: { p: [0, 101, -2], t: [-2, 0, 0], h: -4, a: { k: [20, 200, 2], pole: [1, -0.6, 0.6] }, l: [12, 5, -70, 5, 25] } };
var VARIANTS = {
  remo1m: [{ from: 3, to: 3, label: "negativas en la barra", d: { use: "barra" } },
    { from: 4, to: 4, label: "dominadas asistidas con liga", d: { use: "barra", band: { from: [0, 200, 2], to: ["knR", "knL"] } } },
    { from: 5, to: 5, label: "dominadas", d: { use: "barra" } },
    { from: 6, label: "dominadas con mochila", d: { use: "barra", pack: 1 } }],
  jalon: [{ from: 2, to: 3, label: "en la barra, agarre supino", d: { use: "barra", C: { p: [0, 143, -4], t: [-6, 0, 0], h: -12, a: { k: [13, 200, 2], pole: [0.6, -1, 0.8] }, l: [14, 5, -64, 5, 30] }, E: { p: [0, 101, -2], t: [-2, 0, 0], h: -4, a: { k: [13, 200, 2], pole: [0.5, -0.6, 0.8] }, l: [12, 5, -70, 5, 25] } } },
    { from: 4, label: "en la barra con mochila", d: { use: "barra", pack: 1, C: { p: [0, 143, -4], t: [-6, 0, 0], h: -12, a: { k: [13, 200, 2], pole: [0.6, -1, 0.8] }, l: [14, 5, -64, 5, 30] }, E: { p: [0, 101, -2], t: [-2, 0, 0], h: -4, a: { k: [13, 200, 2], pole: [0.5, -0.6, 0.8] }, l: [12, 5, -70, 5, 25] } } }],
  arquero: [{ from: 1, to: 1, label: "pies en la silla", d: { props: dmChair(-20, 20, -110, -78, 46, null),
      C: { p: [0, 50, -14], t: [93, 0, 0], h: 4, a: { k: [32, 2, 42], pole: [0.5, 0.2, -1] }, l: { k: [7, 49, -92], f: 8 } },
      E: { p: [7, 30, -12], t: [101, 8, 0], h: 4, aR: { k: [32, 2, 42], pole: [0.6, 0.3, -1] }, aL: { k: [-32, 2, 42], pole: [-0.6, 0.3, -1] }, l: { k: [7, 49, -92], f: 8 } } } },
    { from: 2, to: 2, label: "a una mano", d: { work: ["aR"],
      C: { p: [0, 42, -12], t: [78, -6, 10], h: 4, aR: { k: [10, 2, 38], pole: [0.8, 0.2, -1] }, aL: [-60, 20, 60, 40], l: { k: [24, 5, -88], f: 8 } },
      E: { p: [3, 24, -10], t: [86, -10, 10], h: 4, aR: { k: [10, 2, 38], pole: [0.4, 0.6, -1] }, aL: [-60, 20, 60, 40], l: { k: [24, 5, -88], f: 8 } } } },
    { from: 3, to: 3, label: "a una mano, la otra en un apoyo", d: { work: ["aR"], props: [{ box: [-58, -36, 0, 14, 24, 48], c: "wood" }],
      C: { p: [0, 42, -12], t: [78, 2, 4], h: 4, aR: { k: [12, 2, 38], pole: [0.8, 0.2, -1] }, aL: { k: [-46, 15, 36], pole: [-0.6, 0.3, -1] }, l: { k: [20, 5, -88], f: 8 } },
      E: { p: [2, 24, -10], t: [86, -4, 4], h: 4, aR: { k: [12, 2, 38], pole: [0.4, 0.6, -1] }, aL: { k: [-46, 15, 36], pole: [-0.6, 0.6, -1] }, l: { k: [20, 5, -88], f: 8 } } } },
    { from: 4, label: "a una mano", d: { work: ["aR"],
      C: { p: [0, 42, -12], t: [78, -6, 10], h: 4, aR: { k: [10, 2, 38], pole: [0.8, 0.2, -1] }, aL: [-60, 20, 60, 40], l: { k: [24, 5, -88], f: 8 } },
      E: { p: [3, 24, -10], t: [86, -10, 10], h: 4, aR: { k: [10, 2, 38], pole: [0.4, 0.6, -1] }, aL: [-60, 20, 60, 40], l: { k: [24, 5, -88], f: 8 } } } }],
  pike: [{ from: 1, to: 1, label: "pies en la silla", d: { props: dmChair(-20, 20, -112, -80, 46, null),
      C: { p: [0, 92, -28], t: [160, 0, 0], h: 8, a: { k: [12, 2, 0], pole: [0.3, 0.3, -1] }, l: { k: [7, 49, -97], pole: [0, 1, 0], f: 0 } },
      E: { p: [0, 84, -24], t: [170, 0, 0], h: 8, a: { k: [12, 2, 0], pole: [0.2, 0.5, -1] }, l: { k: [7, 49, -97], pole: [0, 1, 0], f: 0 } } } },
    { from: 2, to: 2, label: "pino contra la pared", d: { v: [80, 8], hold: 1, work: ["aR", "aL", "t"], props: [{ box: [-60, 60, 0, 200, 25, 29], c: "wall" }],
      C: { p: [0, 101, 2], t: [180, 0, 0], h: 14, a: { k: [13, 2, 8], pole: [0, 0, 1] }, l: { k: [7, 178, 18], f: 180 } },
      E: { p: [0, 100, 1], t: [179, 0, 0], h: 16, a: { k: [13, 2, 8], pole: [0, 0, 1] }, l: { k: [7, 177, 18], f: 180 } } } },
    { from: 3, label: "flexión en pino", d: { v: [80, 8], work: ["aR", "aL"], props: [{ box: [-60, 60, 0, 200, 25, 29], c: "wall" }],
      C: { p: [0, 101, 2], t: [180, 0, 0], h: 14, a: { k: [13, 2, 8], pole: [0.6, 0, -1] }, l: { k: [7, 178, 18], f: 180 } },
      E: { p: [0, 84, 4], t: [176, 0, 0], h: 22, a: { k: [13, 2, 8], pole: [0.6, 0, -1] }, l: { k: [7, 161, 20], f: 180 } } } }],
  splitsq: [{ from: 1, to: 3, label: "con mochila", d: { pack: 1 } },
    { from: 4, label: "pie de atrás en la silla (búlgara)", d: { props: dmChair(-26, 10, -86, -54, 46, null),
      C: { p: [0, 76, -10], t: [6, 0, 0], h: 4, a: { k: [5, 118, 10], pole: [1, -0.6, 0] }, lR: { k: [8, 5, 28] }, lL: { k: [-8, 49, -66], pole: [0, -1, 0.3], f: -80 } },
      E: { p: [0, 48, -12], t: [14, 0, 0], h: 4, a: { k: [5, 90, 8], pole: [1, -0.6, 0] }, lR: { k: [8, 5, 28] }, lL: { k: [-8, 49, -66], pole: [0, -1, 0.3], f: -80 } } } }],
  rdl1p: [{ from: 2, to: 2, label: "con mochila", d: { pack: 1 } }, { from: 3, label: "con saco de arena", d: { db: null, sack: "wrR" } }],
  curlfem: [{ from: 1, to: 1, label: "bajada a una pierna", d: { work: ["lR"],
      C: { p: [0, 40, 0], t: [-122, 0, 0], h: -20, a: [84, 14, 88, 14], lR: { k: [9, 6, 32], pole: [0, 1, 0.4] }, lL: [168, 4, 168, 4, 180] },
      E: { p: [0, 22, -4], t: [-104, 0, 0], h: -20, a: [84, 14, 88, 14], lR: { k: [9, 6, 70], pole: [0, 1, 0.2] }, lL: [150, 4, 150, 4, 170] } } },
    { from: 2, to: 2, label: "ida y vuelta sin bajar la cadera", d: {
      E: { p: [0, 36, -2], t: [-110, 0, 0], h: -20, a: [84, 14, 88, 14], l: { k: [9, 6, 70], pole: [0, 1, 0.2] } } } },
    { from: 3, label: "ida y vuelta a una pierna", d: { work: ["lR"],
      C: { p: [0, 40, 0], t: [-122, 0, 0], h: -20, a: [84, 14, 88, 14], lR: { k: [9, 6, 32], pole: [0, 1, 0.4] }, lL: [168, 4, 168, 4, 180] },
      E: { p: [0, 36, -2], t: [-110, 0, 0], h: -20, a: [84, 14, 88, 14], lR: { k: [9, 6, 70], pole: [0, 1, 0.2] }, lL: [160, 4, 160, 4, 175] } } }],
  stepdown: [{ from: 1, to: 1, label: "escalón de 15 cm", d: { props: [{ box: [-4, 24, 0, 17, -16, 18], c: "wood" }],
      C: { p: [2, 102, 0], t: [0, 0, 0], a: [30, 10, 40, 10], lR: { k: [9, 21, 2] }, lL: [6, 10, 8, 10] },
      E: { p: [4, 78, -12], t: [16, -4, 0], a: [55, 10, 60, 10], lR: { k: [9, 21, 2], pole: [0, 0, 1] }, lL: { k: [-20, 5, 4] } } } },
    { from: 2, label: "escalón de 20 cm", d: { props: [{ box: [-4, 24, 0, 22, -16, 18], c: "wood" }],
      C: { p: [2, 107, 0], t: [0, 0, 0], a: [30, 10, 40, 10], lR: { k: [9, 26, 2] }, lL: [6, 10, 8, 10] },
      E: { p: [4, 77, -12], t: [16, -4, 0], a: [55, 10, 60, 10], lR: { k: [9, 26, 2], pole: [0, 0, 1] }, lL: { k: [-20, 5, 4] } } } }],
  hipthrust: [{ from: 1, to: 1, label: "con mochila encima", d: { packAt: "pel" } },
    { from: 2, label: "a una pierna", d: { work: ["lR", "t"],
      C: { p: [0, 47, 0], t: [-92, 0, 0], h: -30, a: { k: [12, 58, 2], pole: [1, 0.4, -0.5] }, lR: { k: [10, 5, 42], pole: [0, 1, 0.5] }, lL: [92, 4, 92, 4, 100] },
      E: { p: [0, 22, -8], t: [-58, 0, 0], h: -30, a: { k: [12, 33, -6], pole: [1, 0.4, -0.5] }, lR: { k: [10, 5, 42], pole: [0, 1, 0.5] }, lL: [62, 4, 62, 4, 80] } } }],
  talonpie: [{ from: 1, label: "con mochila", d: { pack: 1 } }],
  copen: [{ from: 2, label: "versión larga: el tobillo en la silla", d: { props: dmChair(-22, 22, -100, -70, 46, null) } }],
  flexexp: [{ from: 1, to: 1, label: "en el piso", d: { v: [76, 14], props: [],
      C: { p: [0, 44, -10], t: [76, 0, 0], h: 4, a: { k: [16, 2, 40], pole: [0.5, 0.2, -1] }, l: { k: [7, 5, -88], f: 8 } },
      E: { p: [0, 24, -12], t: [85, 0, 0], h: 4, a: { k: [16, 2, 40], pole: [0.7, 0.4, -1] }, l: { k: [7, 5, -88], f: 8 } } } },
    { from: 2, label: "con palmada", d: { v: [76, 14], props: [],
      C: { p: [0, 50, -10], t: [70, 0, 0], h: 4, a: { k: [4, 22, 34], pole: [0.6, -0.4, -1] }, l: { k: [7, 5, -88], f: 8 } },
      E: { p: [0, 24, -12], t: [85, 0, 0], h: 4, a: { k: [16, 2, 40], pole: [0.7, 0.4, -1] }, l: { k: [7, 5, -88], f: 8 } } } }],
  rdl2p: [{ from: 1, to: 1, label: "postura B: el pie de atrás solo apoya", d: {
      C: { t: [0, 0, 0], a: [6, 6, 4, 6], lR: [0, 6, 0, 6], lL: [-14, 6, -6, 6, 50] },
      E: { t: [72, 0, 0], h: 10, a: [0, 6, 0, 6], lR: [16, 6, -6, 6], lL: [-6, 6, -16, 6, 40] } } },
    { from: 2, to: 2, label: "a una pierna con las 2 principales", d: { use: "rdl1p", db: "LR",
      C: { p: [0, 84, 0], t: [0, 0, 0], aR: [2, 6, 2, 6], aL: [2, 6, 2, 6], lL: { k: [-8, 4, 2] }, lR: [-10, 4, -6, 4] },
      E: { p: [0, 79, -16], t: [80, 0, 0], h: 8, a: [0, 6, 0, 6], lL: { k: [-8, 4, 2] }, lR: [-94, 4, -94, 4, 0] } } },
    { from: 3, label: "saco de arena, a dos piernas", d: { db: null, sack: "hug" } }],
  farmer: [{ from: 2, label: "saco de arena abrazado", d: { db: null, pack: 0, sack: "hug",
      C: { t: [0, 0, 0], a: { k: [9, 112, 24], pole: [1, -0.6, 0] }, lR: [22, 4, 6, 4], lL: [-16, 4, -14, 4, 70] },
      E: { t: [0, 0, 0], a: { k: [9, 112, 24], pole: [1, -0.6, 0] }, lR: [-16, 4, -14, 4, 70], lL: [22, 4, 6, 4] } } }],
  maleta: [{ from: 1, label: "con mochila", d: { pack: 1 } }],
  deficit: [{ from: 2, label: "con mochila", d: { pack: 1 } }],
  bichomuerto: [{ from: 2, label: "liga en los pies", d: { band: { from: "toR", to: ["toL"] } } }],
  planchalat: [{ from: 2, label: "con elevaciones de la pierna", d: {
      C: { p: [0, 36, 0], t: [84, 0, 0, 90], aL: [0, 0, 90, 0], aR: [-40, 0, 40, 0], lL: [-84, 0, -84, 0, 0], lR: [-124, 0, -124, 0, 0] } } }],
  latinc: [{ from: 1, label: "con más inclinación", d: {
      C: { p: [8, 84, 0], t: [0, 19, 0], aR: [0, 88, 0, 82], aL: { k: [-38, 116, 2], pole: [-0.5, -1, 0] }, lR: [0, 1, 0, 1], lL: [0, 7, 0, 7] },
      E: { p: [8, 84, 0], t: [0, 19, 0], aR: [0, 10, 0, 8], aL: { k: [-38, 116, 2], pole: [-0.5, -1, 0] }, lR: [0, 1, 0, 1], lL: [0, 7, 0, 7] } } }]
};
/* ---------- Tiempo: mismas fases que la guía de tempo ---------- */
function tempoParts(t) {
  if (!t || !/^[\dX]+-[\dX]+-[\dX]+-[\dX]+$/.test(t)) return null;
  return t.split("-").map(function (x) { return x === "X" ? { s: 1, x: true } : { s: +x, x: false }; });
}
function demoEase(f) { return f * f * (3 - 2 * f); }
function phasesOf(x, D) {
  if (D.walk) { var w = typeof D.walk === "number" && D.walk < 1 ? D.walk : 0.6; return [{ k: "pau", d: w, to: "E" }, { k: "pau", d: w, to: "C" }]; }
  var p = tempoParts(x.tempo), out = [];
  if (!p) {
    if (x.hold || D.hold) return [{ k: "pau", d: 1.8, to: "E" }, { k: "pau", d: 1.8, to: "C" }];
    var s = x.tempo === "Lento" ? 2.4 : 1.6; return [{ k: "ecc", d: s, to: "E" }, { k: "pau", d: 0.5, to: "E" }, { k: "con", d: s, to: "C" }, { k: "pau", d: 0.5, to: "C" }];
  }
  (x.start === "bottom" ? [2, 3, 0, 1] : [0, 1, 2, 3]).forEach(function (i) { var q = p[i]; if (!q.s && !q.x) return; out.push({ k: i === 0 ? "ecc" : i === 2 ? "con" : "pau", d: q.x ? 0.45 : q.s, to: i <= 1 ? "E" : "C" }); });
  return out.length ? out : [{ k: "pau", d: 1.8, to: "E" }, { k: "pau", d: 1.8, to: "C" }];
}
function startPose(x, D) { return D.walk || (!tempoParts(x.tempo) && (x.hold || D.hold)) ? "C" : x.start === "bottom" ? "E" : "C"; }
function poseAt(D, x, t, phases) {
  var cyc = phases.reduce(function (a, q) { return a + q.d; }, 0) || 1, tc = ((t % cyc) + cyc) % cyc, acc = 0, from = startPose(x, D);
  for (var n = 0; n < phases.length; n++) {
    var q = phases[n];
    if (tc < acc + q.d || n === phases.length - 1) { var f = clamp((tc - acc) / q.d, 0, 1); return { q: demoLerpPose(from === "E" ? D.E : D.C, q.to === "E" ? D.E : D.C, demoEase(f)), ph: q.k }; }
    acc += q.d; from = q.to;
  }
  return { q: D.C, ph: "" };
}

/* ---------- Variantes por peldaño ---------- */
var VCACHE = {};
function get(id, rung) {
  var base = DEMOS[id]; if (!base) return null;
  var r = +rung || 0, key = id + "|" + r;
  if (VCACHE[key]) return VCACHE[key];
  var v = (VARIANTS[id] || []).filter(function (e) { return r >= e.from && r <= (e.to == null ? 99 : e.to); })[0], D = base;
  if (v) {
    var src = v.d.use ? DEMOS[v.d.use] : base, o = {};
    Object.keys(src).forEach(function (k) { if (k.charAt(0) !== "_") o[k] = src[k]; });
    Object.keys(v.d).forEach(function (k) { if (k !== "use") o[k] = v.d[k]; });
    o.vlabel = v.label || ""; D = o;
  }
  VCACHE[key] = D; return D;
}
function has(id) { return !!DEMOS[id]; }

/* ---------- En la página ---------- */
var LOOP = { raf: 0, t0: 0, last: 0, anim: true, fps: 24 };
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
function xOf(el) { return { id: el.getAttribute("data-demo"), tempo: el.getAttribute("data-tempo") || "", start: el.getAttribute("data-start") || "", hold: +el.getAttribute("data-hold") || 0, rung: +el.getAttribute("data-rung") || 0 }; }
/* x = el ejercicio ya resuelto (id, tempo, start, hold, rung, name). o = { sync: sigue la guía de tempo, cls } */
function html(x, o) {
  o = o || {};
  var D = x && get(x.id, x.rung); if (!D) return "";
  var f = fit(D), r = poseAt(D, x, 0, phasesOf(x, D));
  if (!LOOP.t0) LOOP.t0 = now();
  setTimeout(kick, 0);
  return '<svg class="demo fig' + (o.cls ? " " + o.cls : "") + '" data-demo="' + esc(x.id) + '" data-rung="' + (+x.rung || 0) + '" data-tempo="' + esc(x.tempo || "") + '" data-start="' + esc(x.start || "") + '" data-hold="' + (x.hold || "") + '"' + (o.sync ? ' data-sync="1"' : "") +
    ' viewBox="' + f.map(function (v) { return v.toFixed(1); }).join(" ") + '" role="img" aria-label="Cómo se hace: ' + esc(x.name || "") + (D.vlabel ? " (" + esc(D.vlabel) + ")" : "") + '">' + draw(D, r.q, r.ph, null) + "</svg>";
}
function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
/* pc = { t: segundos desde que empezó la serie, phases: [{ kind, dur, i }] } cuando sigue la guía de tempo */
function paint(el, ms) {
  var x = xOf(el), D = get(x.id, x.rung); if (!D) return;
  var pc = el.hasAttribute("data-sync") && FIG.pacer ? FIG.pacer(x.id) : null, r, r2, ph;
  if (pc && pc.t < 0) { r = { q: startPose(x, D) === "E" ? D.E : D.C, ph: "" }; r2 = null; }
  else if (pc) { ph = pc.phases.map(function (q) { return { k: q.kind, d: q.dur, to: q.i <= 1 ? "E" : "C" }; }); r = poseAt(D, x, pc.t, ph); r2 = poseAt(D, x, pc.t + 0.12, ph); }
  else { var t = (ms - LOOP.t0) / 1000, phs = phasesOf(x, D); r = poseAt(D, x, t, phs); r2 = poseAt(D, x, t + 0.12, phs); }
  el.innerHTML = draw(D, r.q, r.ph, r2 && r2.q);
}
function tick(ms) {
  LOOP.raf = 0;
  if (!LOOP.anim || document.visibilityState === "hidden") return;
  var els = document.querySelectorAll("svg.fig[data-demo]"), live = 0, gap = 1000 / (FIG.slow && FIG.slow() ? 12 : LOOP.fps);
  if (ms - LOOP.last >= gap - 2) {
    LOOP.last = ms;
    for (var i = 0; i < els.length; i++) { var el = els[i]; if (!el.getClientRects().length) continue; live++; paint(el, ms); }
  } else live = els.length;
  if (live) LOOP.raf = requestAnimationFrame(tick);
}
function kick() { if (!LOOP.raf && LOOP.anim && window.requestAnimationFrame) LOOP.raf = requestAnimationFrame(tick); }
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") kick(); });
function setAnim(on) { LOOP.anim = on !== false; if (LOOP.anim) kick(); }
/* Hoja de contacto para revisar las figuras: cada ejercicio (y variante) en sus dos posturas */
function sheet(list) {
  return list.map(function (it) {
    var D = get(it.id, it.rung); if (!D) return "";
    var vb = fit(D).map(function (v) { return v.toFixed(1); }).join(" "), mid = demoLerpPose(D.E, D.C, 0.5);
    return '<div class="cell"><b>' + esc(it.id + (it.rung ? " · peldaño " + (it.rung + 1) : "") + (D.vlabel ? " · " + D.vlabel : "")) + "</b>" +
      ["C", "M", "E"].map(function (k) { var q = k === "M" ? mid : D[k], q2 = k === "M" ? demoLerpPose(D.E, D.C, 0.6) : null; return "<svg class='demo fig' viewBox='" + vb + "'>" + draw(D, q, k === "C" ? "con" : k === "E" ? "ecc" : "con", q2) + "</svg>"; }).join("") + "</div>";
  }).join("");
}
var FIG = { joints: demoJoints, has: has, get: get, html: html, paint: paint, kick: kick, setAnim: setAnim, sheet: sheet, phases: phasesOf, DEMOS: DEMOS, VARIANTS: VARIANTS, draw: draw, fit: fit, pacer: null, slow: null, loop: LOOP };
return FIG;
})();
